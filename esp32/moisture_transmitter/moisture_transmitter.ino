#include <SPI.h>
#include <LoRa.h>
#include <ArduinoJson.h>
#include <EEPROM.h>

// Pin definitions for LoRa
#define LORA_SS 5       // LoRa radio chip select
#define LORA_RST 14     // LoRa radio reset
#define LORA_DIO0 2     // LoRa radio DIO0 (interrupt)

// Pin untuk sensor kelembaban
#define MOISTURE_SENSOR_PIN 34  // ADC pin untuk sensor kelembaban
#define MOISTURE_POWER_PIN 13   // Pin untuk power sensor (opsional, untuk mengurangi korosi)
#define LED_STATUS_PIN 12       // LED untuk indikator status

// Konfigurasi LoRa
const long LORA_FREQUENCY = 433E6;  // Frekuensi LoRa (433 MHz)
const int LORA_SYNC_WORD = 0xF3;    // Sync word (harus sama dengan receiver)
const int LORA_TX_POWER = 20;       // Power transmisi (dBm)
const long LORA_BANDWIDTH = 125E3;   // Bandwidth (Hz)
const int LORA_SPREADING_FACTOR = 7; // Spreading Factor (7-12)
const int LORA_CODING_RATE = 5;      // Coding Rate (5-8)

// EEPROM addresses
#define EEPROM_SIZE 512
#define ADDR_THRESHOLD_DRY 0
#define ADDR_THRESHOLD_WET 4

// Konfigurasi sensor
int moistureThresholdDry = 30;    // Batas bawah kelembaban (tanah kering)
int moistureThresholdWet = 70;    // Batas atas kelembaban (tanah basah)
const int MOISTURE_SAMPLES = 20;          // Jumlah sampel untuk rata-rata
const int READING_INTERVAL = 1000;        // Interval pembacaan sensor (ms)
const int SEND_INTERVAL = 2000;           // Interval pengiriman data (ms)
const int CHECK_SETTINGS_INTERVAL = 1000;  // Interval cek setting baru (ms)
const int ACK_TIMEOUT = 1000;             // Timeout untuk ACK (ms)
const int MAX_RETRIES = 3;                // Maksimum retry pengiriman

// Variable untuk timing
unsigned long lastReadTime = 0;
unsigned long lastSendTime = 0;
unsigned long lastCheckSettings = 0;
unsigned long ackTimeout = 0;

// Variable untuk sensor
float currentMoisture = 0;
bool waitingForAck = false;
int retryCount = 0;
int successCount = 0;
int failCount = 0;
bool ledState = false;

// Simpan threshold ke EEPROM
void saveThresholds() {
  EEPROM.writeInt(ADDR_THRESHOLD_DRY, moistureThresholdDry);
  EEPROM.writeInt(ADDR_THRESHOLD_WET, moistureThresholdWet);
  EEPROM.commit();
  Serial.printf("Threshold disimpan: Dry=%d, Wet=%d\n", 
    moistureThresholdDry, moistureThresholdWet);
}

// Baca threshold dari EEPROM
void loadThresholds() {
  moistureThresholdDry = EEPROM.readInt(ADDR_THRESHOLD_DRY);
  moistureThresholdWet = EEPROM.readInt(ADDR_THRESHOLD_WET);
  
  // Validasi nilai
  if (moistureThresholdDry < 0 || moistureThresholdDry > 100 ||
      moistureThresholdWet < 0 || moistureThresholdWet > 100 ||
      moistureThresholdDry >= moistureThresholdWet) {
    // Reset ke default jika tidak valid
    moistureThresholdDry = 30;
    moistureThresholdWet = 70;
    saveThresholds();
  }
  
  Serial.printf("Threshold dimuat: Dry=%d, Wet=%d\n", 
    moistureThresholdDry, moistureThresholdWet);
}

// Inisialisasi LoRa
bool initLoRa() {
  Serial.println("Initializing LoRa...");
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  
  if (!LoRa.begin(LORA_FREQUENCY)) {
    return false;
  }
  
  LoRa.setTxPower(LORA_TX_POWER);
  LoRa.setSignalBandwidth(LORA_BANDWIDTH);
  LoRa.setSpreadingFactor(LORA_SPREADING_FACTOR);
  LoRa.setCodingRate4(LORA_CODING_RATE);
  LoRa.setSyncWord(LORA_SYNC_WORD);
  LoRa.enableCrc();
  
  Serial.println("LoRa initialized successfully!");
  Serial.printf("- Frequency: %.2f MHz\n", LORA_FREQUENCY/1E6);
  Serial.printf("- Power: %d dBm\n", LORA_TX_POWER);
  Serial.printf("- Bandwidth: %.1f kHz\n", LORA_BANDWIDTH/1E3);
  Serial.printf("- SF: %d, CR: 4/%d\n", LORA_SPREADING_FACTOR, LORA_CODING_RATE);
  return true;
}

// Cek dan proses pesan setting dari receiver
void checkSettings() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String message = "";
    while (LoRa.available()) {
      message += (char)LoRa.read();
    }
    
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, message);
    
    if (!error && doc.containsKey("type") && doc["type"] == "settings") {
      int newDry = doc["dry"];
      int newWet = doc["wet"];
      
      // Validasi nilai baru
      if (newDry >= 0 && newDry < newWet && newWet <= 100) {
        moistureThresholdDry = newDry;
        moistureThresholdWet = newWet;
        saveThresholds();
        
        // Kirim konfirmasi
        StaticJsonDocument<100> ackDoc;
        ackDoc["type"] = "settings_ack";
        ackDoc["success"] = true;
        
        String ackMsg;
        serializeJson(ackDoc, ackMsg);
        
        LoRa.beginPacket();
        LoRa.print(ackMsg);
        LoRa.endPacket();
      }
    }
  }
}

// Baca sensor kelembaban dengan rata-rata beberapa pembacaan
float readMoisture() {
  if (digitalRead(MOISTURE_POWER_PIN) == LOW) {
    digitalWrite(MOISTURE_POWER_PIN, HIGH);
    delay(100); // Tunggu sensor stabil
  }
  
  float sum = 0;
  for (int i = 0; i < MOISTURE_SAMPLES; i++) {
    sum += analogRead(MOISTURE_SENSOR_PIN);
    delay(10);
  }
  float average = sum / MOISTURE_SAMPLES;
  
  // Konversi ke persentase (kalibrasi sesuai sensor)
  float percentage = map(average, 4095, 1800, 0, 100);
  percentage = constrain(percentage, 0, 100);
  
  // Matikan power sensor untuk mengurangi korosi
  digitalWrite(MOISTURE_POWER_PIN, LOW);
  
  return percentage;
}

// Kirim data melalui LoRa
void sendData(float moisture) {
  StaticJsonDocument<200> doc;
  doc["moisture"] = moisture;
  
  String message;
  serializeJson(doc, message);
  
  LoRa.beginPacket();
  LoRa.print(message);
  LoRa.endPacket();
  
  waitingForAck = true;
  ackTimeout = millis() + ACK_TIMEOUT;
  
  Serial.printf("Sending data (attempt %d): Moisture=%.1f%%\n", 
    retryCount + 1, moisture);
}

bool checkAcknowledgment() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String response = "";
    while (LoRa.available()) {
      response += (char)LoRa.read();
    }
    
    StaticJsonDocument<100> doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error && doc.containsKey("type") && doc["type"] == "ack") {
      bool success = doc["success"];
      Serial.printf("ACK received: %s\n", success ? "SUCCESS" : "FAILED");
      
      if (success) {
        successCount++;
        digitalWrite(LED_STATUS_PIN, HIGH);
        return true;
      } else {
        failCount++;
      }
    }
  }
  return false;
}

void updateLED() {
  if (waitingForAck) {
    // Blink cepat saat menunggu ACK
    ledState = !ledState;
    digitalWrite(LED_STATUS_PIN, ledState);
  } else {
    // Solid ON jika komunikasi baik
    digitalWrite(LED_STATUS_PIN, successCount > failCount);
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("\nMoisture Sensor Node Starting...");
  
  // Setup pins
  pinMode(MOISTURE_POWER_PIN, OUTPUT);
  pinMode(LED_STATUS_PIN, OUTPUT);
  digitalWrite(MOISTURE_POWER_PIN, LOW);
  digitalWrite(LED_STATUS_PIN, LOW);
  
  // Initialize ADC
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  
  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);
  loadThresholds();
  
  // Initialize LoRa
  if (!initLoRa()) {
    Serial.println("LoRa initialization failed!");
    while (1) {
      digitalWrite(LED_STATUS_PIN, HIGH);
      delay(100);
      digitalWrite(LED_STATUS_PIN, LOW);
      delay(100);
    }
  }
  
  // Warm up sensor
  readMoisture();
  
  Serial.println("Setup complete!");
}

void loop() {
  unsigned long currentTime = millis();
  
  // Update LED status
  updateLED();
  
  // Baca sensor pada interval
  if (currentTime - lastReadTime >= READING_INTERVAL) {
    currentMoisture = readMoisture();
    lastReadTime = currentTime;
  }
  
  // Handle ACK jika sedang menunggu
  if (waitingForAck) {
    if (checkAcknowledgment()) {
      waitingForAck = false;
      retryCount = 0;
      lastSendTime = currentTime;
    } else if (currentTime >= ackTimeout) {
      waitingForAck = false;
      digitalWrite(LED_STATUS_PIN, LOW);
      
      if (++retryCount < MAX_RETRIES) {
        Serial.println("ACK timeout - retrying...");
        sendData(currentMoisture);
      } else {
        Serial.println("Max retries reached - waiting for next interval");
        retryCount = 0;
        lastSendTime = currentTime;
        failCount++;
      }
    }
  }
  // Kirim data baru jika waktunya
  else if (currentTime - lastSendTime >= SEND_INTERVAL) {
    sendData(currentMoisture);
  }
  
  // Cek pengaturan baru
  if (currentTime - lastCheckSettings >= CHECK_SETTINGS_INTERVAL) {
    checkSettings();
    lastCheckSettings = currentTime;
  }
  
  // Log statistik setiap 30 detik
  static unsigned long lastStats = 0;
  if (currentTime - lastStats >= 30000) {
    Serial.printf("\nStatus:\n");
    Serial.printf("- Moisture: %.1f%%\n", currentMoisture);
    Serial.printf("- Thresholds: Dry=%d%%, Wet=%d%%\n", 
      moistureThresholdDry, moistureThresholdWet);
    Serial.printf("- Communication: Success=%d, Failed=%d\n", 
      successCount, failCount);
    Serial.printf("- Success Rate: %.1f%%\n", 
      (successCount * 100.0) / (successCount + failCount));
    lastStats = currentTime;
  }
  
  // Small delay to prevent CPU hogging
  delay(10);
}
