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

// Konfigurasi LoRa
const long LORA_FREQUENCY = 433E6;  // Frekuensi LoRa (433 MHz)
const int LORA_SYNC_WORD = 0xF3;    // Sync word (harus sama dengan receiver)
const int LORA_TX_POWER = 20;       // Power transmisi (dBm)

// EEPROM addresses
#define EEPROM_SIZE 512
#define ADDR_THRESHOLD_DRY 0
#define ADDR_THRESHOLD_WET 4

// Konfigurasi sensor
int moistureThresholdDry = 30;    // Batas bawah kelembaban (tanah kering)
int moistureThresholdWet = 70;    // Batas atas kelembaban (tanah basah)
const int MOISTURE_SAMPLES = 10;          // Jumlah sampel untuk rata-rata
const int READING_INTERVAL = 1000;        // Interval pembacaan sensor (ms)
const int SEND_INTERVAL = 2000;           // Interval pengiriman data (ms)
const int CHECK_SETTINGS_INTERVAL = 1000;  // Interval cek setting baru (ms)

// Variable untuk timing
unsigned long lastReadTime = 0;
unsigned long lastSendTime = 0;
unsigned long lastCheckSettings = 0;

// Variable untuk sensor
float currentMoisture = 0;
bool pumpActive = false;

// Simpan threshold ke EEPROM
void saveThresholds() {
  EEPROM.writeInt(ADDR_THRESHOLD_DRY, moistureThresholdDry);
  EEPROM.writeInt(ADDR_THRESHOLD_WET, moistureThresholdWet);
  EEPROM.commit();
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
}

// Inisialisasi LoRa
bool initLoRa() {
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  
  if (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("LoRa initialization failed!");
    return false;
  }
  
  LoRa.setSyncWord(LORA_SYNC_WORD);
  LoRa.setTxPower(LORA_TX_POWER);
  Serial.println("LoRa Transmitter initialized!");
  return true;
}

// Cek dan proses pesan setting dari receiver
void checkSettings() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String received = "";
    while (LoRa.available()) {
      received += (char)LoRa.read();
    }
    
    // Debug print
    Serial.println("Received packet: " + received);
    
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, received);
    
    if (!error) {
      if (doc.containsKey("type") && doc["type"] == "settings") {
        if (doc.containsKey("dryThreshold") && doc.containsKey("wetThreshold")) {
          int newDryThreshold = doc["dryThreshold"];
          int newWetThreshold = doc["wetThreshold"];
          
          // Validasi nilai baru
          if (newDryThreshold >= 0 && newDryThreshold < newWetThreshold && 
              newWetThreshold <= 100) {
            moistureThresholdDry = newDryThreshold;
            moistureThresholdWet = newWetThreshold;
            saveThresholds();
            
            // Kirim konfirmasi ke receiver
            StaticJsonDocument<200> confirmDoc;
            confirmDoc["type"] = "settings_confirm";
            confirmDoc["dryThreshold"] = moistureThresholdDry;
            confirmDoc["wetThreshold"] = moistureThresholdWet;
            
            String confirmJson;
            serializeJson(confirmDoc, confirmJson);
            
            LoRa.beginPacket();
            LoRa.print(confirmJson);
            LoRa.endPacket();
            
            Serial.println("New thresholds set and confirmed - Dry: " + 
                         String(moistureThresholdDry) + "%, Wet: " + 
                         String(moistureThresholdWet) + "%");
          } else {
            Serial.println("Invalid threshold values received");
          }
        }
      }
    } else {
      Serial.println("Failed to parse JSON: " + String(error.c_str()));
    }
  }
}

// Baca sensor kelembaban dengan rata-rata beberapa pembacaan
float readMoisture() {
  if (MOISTURE_POWER_PIN >= 0) {
    digitalWrite(MOISTURE_POWER_PIN, HIGH);  // Nyalakan sensor
    delay(100);  // Tunggu sensor stabil
  }
  
  long sum = 0;
  for(int i = 0; i < MOISTURE_SAMPLES; i++) {
    sum += analogRead(MOISTURE_SENSOR_PIN);
    delay(10);
  }
  
  if (MOISTURE_POWER_PIN >= 0) {
    digitalWrite(MOISTURE_POWER_PIN, LOW);  // Matikan sensor
  }
  
  // Konversi ke persentase (0-100%)
  // Asumsi analogRead memberikan nilai 0-4095 (12-bit ADC)
  float moisture = 100.0 - ((sum / MOISTURE_SAMPLES) * 100.0 / 4095.0);
  return moisture;
}

// Kirim data melalui LoRa
void sendData(float moisture, const char* command) {
  StaticJsonDocument<200> doc;
  doc["moisture"] = moisture;
  doc["command"] = command;
  
  String json;
  serializeJson(doc, json);
  
  LoRa.beginPacket();
  LoRa.print(json);
  LoRa.endPacket();
  
  Serial.print("Sent: Moisture = ");
  Serial.print(moisture);
  Serial.print("%, Command = ");
  Serial.println(command);
}

void setup() {
  Serial.begin(115200);
  
  // Inisialisasi EEPROM
  EEPROM.begin(EEPROM_SIZE);
  
  // Setup pin modes
  pinMode(MOISTURE_SENSOR_PIN, INPUT);
  if (MOISTURE_POWER_PIN >= 0) {
    pinMode(MOISTURE_POWER_PIN, OUTPUT);
    digitalWrite(MOISTURE_POWER_PIN, LOW);
  }
  
  // Load thresholds dari EEPROM
  loadThresholds();
  
  // Inisialisasi LoRa
  while (!initLoRa()) {
    Serial.println("Retrying LoRa initialization in 5 seconds...");
    delay(5000);
  }
  
  Serial.println("System initialized with thresholds:");
  Serial.println("Dry: " + String(moistureThresholdDry) + "%");
  Serial.println("Wet: " + String(moistureThresholdWet) + "%");
}

void loop() {
  unsigned long currentTime = millis();
  
  // Baca sensor pada interval yang ditentukan
  if (currentTime - lastReadTime >= READING_INTERVAL) {
    currentMoisture = readMoisture();
    lastReadTime = currentTime;
    
    // Update status pompa berdasarkan kelembaban
    if (currentMoisture < moistureThresholdDry && !pumpActive) {
      pumpActive = true;
    } else if (currentMoisture > moistureThresholdWet && pumpActive) {
      pumpActive = false;
    }
  }
  
  // Kirim data pada interval yang ditentukan
  if (currentTime - lastSendTime >= SEND_INTERVAL) {
    const char* command = pumpActive ? "ON" : "OFF";
    sendData(currentMoisture, command);
    lastSendTime = currentTime;
  }
  
  // Cek setting baru dari receiver
  if (currentTime - lastCheckSettings >= CHECK_SETTINGS_INTERVAL) {
    checkSettings();
    lastCheckSettings = currentTime;
  }
  
  // Delay kecil untuk menghindari pembacaan yang terlalu cepat
  delay(100);
}
