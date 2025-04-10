#include <SPI.h>
#include <LoRa.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <DHT.h>  // Tambahan library untuk DHT22

// Pin definitions for LoRa
#define LORA_SS 5       // LoRa radio chip select
#define LORA_RST 14     // LoRa radio reset
#define LORA_DIO0 2     // LoRa radio DIO0 (interrupt)

// Pin untuk sensor kelembaban (multi-sensor)
#define MOISTURE_SENSOR_COUNT 5  // Jumlah sensor kelembaban
const int MOISTURE_SENSOR_PINS[MOISTURE_SENSOR_COUNT] = {34, 35, 32, 33, 25};  // ADC pins untuk 5 sensor kelembaban
const int MOISTURE_POWER_PINS[MOISTURE_SENSOR_COUNT] = {13, 12, 15, 0, 4};     // Pins untuk power sensor

// Pin untuk flood sensor
#define FLOOD_SENSOR_PIN 26
#define FLOOD_THRESHOLD 1000     // Threshold untuk deteksi banjir (sesuaikan dengan sensor)

// Pin dan setup untuk DHT22
#define DHTPIN 27        // Pin untuk DHT22
#define DHTTYPE DHT22   // Tipe sensor DHT22
DHT dht(DHTPIN, DHTTYPE);

// Konfigurasi LoRa
const long LORA_FREQUENCY = 433E6;  // Frekuensi LoRa (433 MHz)
const int LORA_SYNC_WORD = 0xF3;    // Sync word (harus sama dengan receiver)
const int LORA_TX_POWER = 20;       // Power transmisi (dBm)

// EEPROM addresses
#define EEPROM_SIZE 512
#define ADDR_THRESHOLD_DRY 0
#define ADDR_THRESHOLD_WET 4
// Alokasikan ruang untuk thresholds semua sensor (5 sensor x 2 thresholds x 4 bytes)
#define ADDR_SENSOR_THRESHOLDS 100

// Konfigurasi sensor
// Array untuk menyimpan thresholds setiap sensor
int moistureThresholdDry[MOISTURE_SENSOR_COUNT] = {30, 30, 30, 30, 30};    // Default batas bawah kelembaban
int moistureThresholdWet[MOISTURE_SENSOR_COUNT] = {70, 70, 70, 70, 70};    // Default batas atas kelembaban
const int MOISTURE_SAMPLES = 10;          // Jumlah sampel untuk rata-rata
const int READING_INTERVAL = 1000;        // Interval pembacaan sensor (ms)
const int SEND_INTERVAL = 2000;           // Interval pengiriman data (ms)
const int CHECK_SETTINGS_INTERVAL = 1000;  // Interval cek setting baru (ms)

// Variable untuk timing
unsigned long lastReadTime = 0;
unsigned long lastSendTime = 0;
unsigned long lastCheckSettings = 0;

// Variable untuk sensor
float currentMoisture[MOISTURE_SENSOR_COUNT] = {0, 0, 0, 0, 0}; // Data dari 5 sensor
bool pumpActive = false;
bool floodDetected = false;
float temperature = 0;    // Variabel untuk suhu dari DHT22
float humidity = 0;       // Variabel untuk kelembaban dari DHT22

// Nama zona untuk setiap sensor
const char* zoneNames[MOISTURE_SENSOR_COUNT] = {
  "Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"
};

// Simpan threshold ke EEPROM
void saveThresholds() {
  // Simpan threshold global (backward compatibility)
  EEPROM.writeInt(ADDR_THRESHOLD_DRY, moistureThresholdDry[0]);
  EEPROM.writeInt(ADDR_THRESHOLD_WET, moistureThresholdWet[0]);
  
  // Simpan threshold untuk setiap sensor
  int addr = ADDR_SENSOR_THRESHOLDS;
  for (int i = 0; i < MOISTURE_SENSOR_COUNT; i++) {
    EEPROM.writeInt(addr, moistureThresholdDry[i]);
    addr += 4;
    EEPROM.writeInt(addr, moistureThresholdWet[i]);
    addr += 4;
  }
  
  EEPROM.commit();
}

// Baca threshold dari EEPROM
void loadThresholds() {
  // Baca threshold global (backward compatibility)
  moistureThresholdDry[0] = EEPROM.readInt(ADDR_THRESHOLD_DRY);
  moistureThresholdWet[0] = EEPROM.readInt(ADDR_THRESHOLD_WET);
  
  // Validasi nilai global
  if (moistureThresholdDry[0] < 0 || moistureThresholdDry[0] > 100 ||
      moistureThresholdWet[0] < 0 || moistureThresholdWet[0] > 100 ||
      moistureThresholdDry[0] >= moistureThresholdWet[0]) {
    // Reset ke default jika tidak valid
    moistureThresholdDry[0] = 30;
    moistureThresholdWet[0] = 70;
  }
  
  // Baca threshold untuk setiap sensor
  int addr = ADDR_SENSOR_THRESHOLDS;
  bool needDefaultSave = false;
  
  for (int i = 0; i < MOISTURE_SENSOR_COUNT; i++) {
    int dryVal = EEPROM.readInt(addr);
    addr += 4;
    int wetVal = EEPROM.readInt(addr);
    addr += 4;
    
    // Validasi nilai
    if (dryVal < 0 || dryVal > 100 || wetVal < 0 || wetVal > 100 || dryVal >= wetVal) {
      // Jika tidak valid, gunakan threshold global atau default
      moistureThresholdDry[i] = (i == 0) ? 30 : moistureThresholdDry[0];
      moistureThresholdWet[i] = (i == 0) ? 70 : moistureThresholdWet[0];
      needDefaultSave = true;
    } else {
      moistureThresholdDry[i] = dryVal;
      moistureThresholdWet[i] = wetVal;
    }
  }
  
  if (needDefaultSave) {
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
            moistureThresholdDry[0] = newDryThreshold;
            moistureThresholdWet[0] = newWetThreshold;
            saveThresholds();
            
            // Kirim konfirmasi ke receiver
            StaticJsonDocument<200> confirmDoc;
            confirmDoc["type"] = "settings_confirm";
            confirmDoc["dryThreshold"] = moistureThresholdDry[0];
            confirmDoc["wetThreshold"] = moistureThresholdWet[0];
            
            String confirmJson;
            serializeJson(confirmDoc, confirmJson);
            
            LoRa.beginPacket();
            LoRa.print(confirmJson);
            LoRa.endPacket();
            
            Serial.println("New thresholds set and confirmed - Dry: " + 
                         String(moistureThresholdDry[0]) + "%, Wet: " + 
                         String(moistureThresholdWet[0]) + "%");
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
float readMoistureSensor(int sensorIndex) {
  if (sensorIndex < 0 || sensorIndex >= MOISTURE_SENSOR_COUNT) {
    return 0;
  }

  int sensorPin = MOISTURE_SENSOR_PINS[sensorIndex];
  int powerPin = MOISTURE_POWER_PINS[sensorIndex];
  
  if (powerPin >= 0) {
    digitalWrite(powerPin, HIGH);  // Nyalakan sensor
    delay(100);  // Tunggu sensor stabil
  }
  
  long sum = 0;
  for(int i = 0; i < MOISTURE_SAMPLES; i++) {
    sum += analogRead(sensorPin);
    delay(10);
  }
  
  if (powerPin >= 0) {
    digitalWrite(powerPin, LOW);  // Matikan sensor
  }
  
  // Konversi ke persentase (0-100%)
  // Asumsi analogRead memberikan nilai 0-4095 (12-bit ADC)
  float moisture = 100.0 - ((sum / MOISTURE_SAMPLES) * 100.0 / 4095.0);
  return moisture;
}

// Baca semua sensor kelembaban
void readAllMoistureSensors() {
  for (int i = 0; i < MOISTURE_SENSOR_COUNT; i++) {
    currentMoisture[i] = readMoistureSensor(i);
  }
}

// Baca sensor banjir
bool checkFloodSensor() {
  int value = analogRead(FLOOD_SENSOR_PIN);
  return value > FLOOD_THRESHOLD;
}

// Baca sensor DHT22
void readDHT() {
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();
  
  // Cek apakah pembacaan berhasil
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Gagal membaca sensor DHT22!");
    temperature = 0;
    humidity = 0;
  }
}

// Kirim data melalui LoRa
void sendData(const char* command) {
  StaticJsonDocument<768> doc;  // Ukuran buffer JSON lebih besar untuk multi-sensor
  
  // Array untuk data moisture
  JsonArray moistureArray = doc.createNestedArray("moisture");
  for (int i = 0; i < MOISTURE_SENSOR_COUNT; i++) {
    JsonObject sensorObj = moistureArray.createNestedObject();
    sensorObj["id"] = i + 1;
    sensorObj["value"] = currentMoisture[i];
    sensorObj["location"] = zoneNames[i];
    sensorObj["dryThreshold"] = moistureThresholdDry[i];
    sensorObj["wetThreshold"] = moistureThresholdWet[i];
  }
  
  doc["command"] = command;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["floodAlert"] = floodDetected;
  
  String json;
  serializeJson(doc, json);
  
  LoRa.beginPacket();
  LoRa.print(json);
  LoRa.endPacket();
  
  Serial.print("Sent: ");
  Serial.print(json);
  Serial.println();
}

void setup() {
  Serial.begin(115200);
  
  // Inisialisasi EEPROM
  EEPROM.begin(EEPROM_SIZE);
  
  // Setup pin modes untuk moisture sensors
  for (int i = 0; i < MOISTURE_SENSOR_COUNT; i++) {
    pinMode(MOISTURE_SENSOR_PINS[i], INPUT);
    if (MOISTURE_POWER_PINS[i] >= 0) {
      pinMode(MOISTURE_POWER_PINS[i], OUTPUT);
      digitalWrite(MOISTURE_POWER_PINS[i], LOW);  // Matikan semua sensor saat inisialisasi
    }
  }
  
  // Setup pin mode untuk flood sensor
  pinMode(FLOOD_SENSOR_PIN, INPUT);
  
  // Inisialisasi DHT22
  dht.begin();
  
  // Load thresholds dari EEPROM
  loadThresholds();
  
  // Inisialisasi LoRa
  while (!initLoRa()) {
    Serial.println("Retrying LoRa initialization in 5 seconds...");
    delay(5000);
  }
  
  Serial.println("Multi-Sensor System initialized with thresholds:");
  for (int i = 0; i < MOISTURE_SENSOR_COUNT; i++) {
    Serial.println("Sensor " + String(i+1) + " - " + String(zoneNames[i]));
    Serial.println("  Dry: " + String(moistureThresholdDry[i]) + "%");
    Serial.println("  Wet: " + String(moistureThresholdWet[i]) + "%");
  }
}

void loop() {
  unsigned long currentTime = millis();
  
  // Baca semua sensor pada interval yang ditentukan
  if (currentTime - lastReadTime >= READING_INTERVAL) {
    readAllMoistureSensors();
    readDHT();  // Baca sensor DHT22
    floodDetected = checkFloodSensor();  // Cek flood sensor
    
    lastReadTime = currentTime;
    
    // Update status pompa berdasarkan kelembaban dan kondisi banjir
    if (floodDetected) {
      // Jika terdeteksi banjir, matikan pompa untuk keamanan
      pumpActive = false;
      Serial.println("FLOOD ALERT: Pump deactivated for safety");
    } else {
      // Logika untuk mengaktifkan/matikan pompa berdasarkan sensor
      // Disini kita gunakan rata-rata atau sensor paling kering sebagai acuan
      float avgMoisture = 0;
      float minMoisture = 100;
      
      for (int i = 0; i < MOISTURE_SENSOR_COUNT; i++) {
        avgMoisture += currentMoisture[i];
        if (currentMoisture[i] < minMoisture) {
          minMoisture = currentMoisture[i];
        }
      }
      avgMoisture /= MOISTURE_SENSOR_COUNT;
      
      // Gunakan nilai minimum (paling kering) untuk menentukan aktivasi pompa
      if (minMoisture < moistureThresholdDry[0] && !pumpActive) {
        pumpActive = true;
        Serial.println("Pump activated: Min moisture below threshold");
      } else if (avgMoisture > moistureThresholdWet[0] && pumpActive) {
        pumpActive = false;
        Serial.println("Pump deactivated: Avg moisture above threshold");
      }
    }
  }
  
  // Kirim data pada interval yang ditentukan
  if (currentTime - lastSendTime >= SEND_INTERVAL) {
    const char* command = pumpActive ? "ON" : "OFF";
    sendData(command);
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
