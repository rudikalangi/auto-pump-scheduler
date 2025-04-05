#include <SPI.h>
#include <LoRa.h>
#include <ArduinoJson.h>

// Pin definitions for LoRa - HARUS SAMA dengan controller
#define LORA_SS 5       // LoRa radio chip select
#define LORA_RST 14     // LoRa radio reset
#define LORA_DIO0 2     // LoRa radio DIO0 (interrupt)

// Pin untuk sensor
#define MOISTURE_PIN 34  // ADC pin untuk sensor kelembaban
#define BATTERY_PIN 35   // ADC pin untuk monitoring baterai
#define LED_PIN 12      // LED untuk indikator status

// LoRa configuration - HARUS SAMA dengan controller
const long LORA_FREQUENCY = 433E6;  // Frekuensi LoRa (433 MHz)
const int LORA_SYNC_WORD = 0xF3;    // Sync word untuk komunikasi privat
const int LORA_TX_POWER = 20;       // Power transmisi (dBm)
const long LORA_BANDWIDTH = 125E3;   // Bandwidth (Hz)
const int LORA_SPREADING_FACTOR = 7; // Spreading Factor (7-12)
const int LORA_CODING_RATE = 5;      // Coding Rate (5-8)

// Timing constants
const unsigned long SEND_INTERVAL = 2000;     // Kirim data setiap 2 detik
const unsigned long ACK_TIMEOUT = 1000;       // Timeout untuk ACK (1 detik)
const unsigned long LED_BLINK_INTERVAL = 100; // Interval kedip LED (ms)
const int MAX_RETRIES = 3;                    // Maksimum retry
const int SAMPLES_COUNT = 20;                 // Jumlah sampel untuk rata-rata

// Variables
unsigned long lastSendTime = 0;
unsigned long lastLedToggle = 0;
int retryCount = 0;
bool waitingForAck = false;
unsigned long ackTimeout = 0;
float lastMoisture = 0;
float lastBattery = 100;
bool ledState = false;
int successCount = 0;
int failCount = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("\nLoRa Moisture Sensor Node Starting...");
  
  // Setup pins
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  
  // ADC configuration
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  
  // Initialize LoRa
  if (!initLoRa()) {
    Serial.println("LoRa initialization failed!");
    while (1) {
      digitalWrite(LED_PIN, HIGH);
      delay(100);
      digitalWrite(LED_PIN, LOW);
      delay(100);
    }
  }
  
  // Warm up ADC
  for(int i = 0; i < 10; i++) {
    analogRead(MOISTURE_PIN);
    analogRead(BATTERY_PIN);
    delay(10);
  }
  
  Serial.println("Setup complete - starting measurements");
}

bool initLoRa() {
  Serial.println("Initializing LoRa...");
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  
  if (!LoRa.begin(LORA_FREQUENCY)) {
    return false;
  }
  
  // Konfigurasi detail
  LoRa.setTxPower(LORA_TX_POWER);
  LoRa.setSignalBandwidth(LORA_BANDWIDTH);
  LoRa.setSpreadingFactor(LORA_SPREADING_FACTOR);
  LoRa.setCodingRate4(LORA_CODING_RATE);
  LoRa.setSyncWord(LORA_SYNC_WORD);
  LoRa.enableCrc();
  
  // Log konfigurasi
  Serial.println("LoRa initialization successful!");
  Serial.printf("- Frequency: %.2f MHz\n", LORA_FREQUENCY/1E6);
  Serial.printf("- TX Power: %d dBm\n", LORA_TX_POWER);
  Serial.printf("- Bandwidth: %.2f kHz\n", LORA_BANDWIDTH/1E3);
  Serial.printf("- Spreading Factor: %d\n", LORA_SPREADING_FACTOR);
  Serial.printf("- Coding Rate: 4/%d\n", LORA_CODING_RATE);
  return true;
}

float readMoisture() {
  float sum = 0;
  // Ambil beberapa sampel untuk mengurangi noise
  for(int i = 0; i < SAMPLES_COUNT; i++) {
    sum += analogRead(MOISTURE_PIN);
    delay(5);
  }
  float average = sum / SAMPLES_COUNT;
  
  // Konversi ke persentase (kalibrasi sesuai sensor)
  float percentage = map(average, 4095, 1800, 0, 100);
  percentage = constrain(percentage, 0, 100);
  
  return percentage;
}

float readBattery() {
  float sum = 0;
  // Multiple readings untuk stabilitas
  for(int i = 0; i < 10; i++) {
    sum += analogRead(BATTERY_PIN);
    delay(5);
  }
  float average = sum / 10;
  
  // Konversi ke voltase dan persentase
  float voltage = (average * 3.3) / 4095.0;
  float percentage = (voltage - 2.5) / (3.3 - 2.5) * 100;
  percentage = constrain(percentage, 0, 100);
  
  return percentage;
}

void sendData() {
  float moisture = readMoisture();
  float battery = readBattery();
  
  // Kirim jika ada perubahan atau retry
  if (abs(moisture - lastMoisture) > 0.5 || 
      abs(battery - lastBattery) > 0.5 || 
      retryCount > 0) {
    
    StaticJsonDocument<200> doc;
    doc["moisture"] = moisture;
    doc["battery"] = battery;
    
    String message;
    serializeJson(doc, message);
    
    // Log pengiriman
    Serial.printf("Sending data (attempt %d): ", retryCount + 1);
    Serial.printf("Moisture=%.1f%%, Battery=%.1f%%\n", moisture, battery);
    
    // Kirim dengan LoRa
    LoRa.beginPacket();
    LoRa.print(message);
    LoRa.endPacket();
    
    // Update state
    waitingForAck = true;
    ackTimeout = millis() + ACK_TIMEOUT;
    lastMoisture = moisture;
    lastBattery = battery;
    
    // LED indikator
    digitalWrite(LED_PIN, HIGH);
  }
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
      } else {
        failCount++;
      }
      
      return success;
    }
  }
  return false;
}

void updateLED() {
  unsigned long currentTime = millis();
  
  if (waitingForAck) {
    // Blink cepat saat menunggu ACK
    if (currentTime - lastLedToggle >= LED_BLINK_INTERVAL) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastLedToggle = currentTime;
    }
  } else {
    // LED menyala solid jika komunikasi lancar
    digitalWrite(LED_PIN, successCount > failCount);
  }
}

void loop() {
  unsigned long currentTime = millis();
  
  // Update LED status
  updateLED();
  
  // Handle ACK jika sedang menunggu
  if (waitingForAck) {
    if (checkAcknowledgment()) {
      // ACK success
      waitingForAck = false;
      retryCount = 0;
      lastSendTime = currentTime;
      digitalWrite(LED_PIN, HIGH);
    } else if (currentTime >= ackTimeout) {
      // ACK timeout
      waitingForAck = false;
      digitalWrite(LED_PIN, LOW);
      
      if (++retryCount < MAX_RETRIES) {
        Serial.println("ACK timeout - retrying...");
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
    sendData();
  }
  
  // Log statistik setiap 30 detik
  if ((currentTime / 1000) % 30 == 0) {
    Serial.printf("\nCommunication Stats:\n");
    Serial.printf("- Success: %d\n", successCount);
    Serial.printf("- Failed: %d\n", failCount);
    Serial.printf("- Success Rate: %.1f%%\n", 
      (successCount * 100.0) / (successCount + failCount));
    Serial.printf("- Current Values: Moisture=%.1f%%, Battery=%.1f%%\n", 
      lastMoisture, lastBattery);
  }
  
  // Small delay to prevent CPU hogging
  delay(10);
}
