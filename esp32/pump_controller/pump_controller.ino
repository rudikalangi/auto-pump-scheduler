#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <SPI.h>
#include <LoRa.h>

// WiFi credentials
const char* ssid = "TAP DLJ";      // Ganti dengan nama WiFi Anda
const char* password = "tap12345!";   // Ganti dengan password WiFi Anda

// Pin definitions for LoRa
#define LORA_SS 5       // LoRa radio chip select
#define LORA_RST 14     // LoRa radio reset
#define LORA_DIO0 2     // LoRa radio DIO0 (interrupt)

// Pin definitions for Relay
const int SYSTEM_POWER_RELAY = 26;  // Relay 1 untuk daya sistem
const int MOTOR_RELAY = 27;         // Relay 2 untuk starter motor

// Constants
const unsigned long WATCHDOG_TIMEOUT = 30000;  // 30 detik timeout
const int EEPROM_SIZE = 512;
const int MAX_RETRY_WIFI = 20;  // Maksimum percobaan koneksi WiFi

// LoRa configuration
const long LORA_FREQUENCY = 433E6;  // Frekuensi LoRa (433 MHz)
const int LORA_SYNC_WORD = 0xF3;    // Sync word untuk komunikasi privat

// WebSocket server
WebSocketsServer webSocket = WebSocketsServer(80);

// System state
bool systemOn = false;
bool motorRunning = false;
unsigned long lastWatchdog = 0;
unsigned long lastStateUpdate = 0;
float remoteMoisture = 0.0;
unsigned long lastRemoteUpdate = 0;

// Fungsi untuk menyimpan state ke EEPROM
void saveState() {
  EEPROM.write(0, systemOn ? 1 : 0);
  EEPROM.write(1, motorRunning ? 1 : 0);
  EEPROM.commit();
}

// Fungsi untuk membaca state dari EEPROM
void loadState() {
  systemOn = EEPROM.read(0) == 1;
  motorRunning = EEPROM.read(1) == 1;
  
  // Terapkan state yang tersimpan ke relay
  digitalWrite(SYSTEM_POWER_RELAY, systemOn ? HIGH : LOW);
  digitalWrite(MOTOR_RELAY, motorRunning ? HIGH : LOW);
}

// Inisialisasi LoRa
bool initLoRa() {
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  
  if (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("LoRa initialization failed!");
    return false;
  }
  
  LoRa.setSyncWord(LORA_SYNC_WORD);
  Serial.println("LoRa Receiver initialized!");
  return true;
}

// Fungsi untuk memproses perintah dari transmitter
void processCommand(const String& command) {
  lastWatchdog = millis(); // Update watchdog timer saat menerima perintah
  
  if (command == "ON" && !systemOn) {
    // Nyalakan sistem dan motor
    systemOn = true;
    digitalWrite(SYSTEM_POWER_RELAY, HIGH);
    delay(1000); // Tunggu 1 detik
    motorRunning = true;
    digitalWrite(MOTOR_RELAY, HIGH);
    saveState();
    broadcastState();
  }
  else if (command == "OFF" && systemOn) {
    // Matikan motor dan sistem
    motorRunning = false;
    digitalWrite(MOTOR_RELAY, LOW);
    delay(1000); // Tunggu 1 detik
    systemOn = false;
    digitalWrite(SYSTEM_POWER_RELAY, LOW);
    saveState();
    broadcastState();
  }
}

void setup() {
  Serial.begin(115200);
  EEPROM.begin(EEPROM_SIZE);
  
  // Inisialisasi pin
  pinMode(SYSTEM_POWER_RELAY, OUTPUT);
  pinMode(MOTOR_RELAY, OUTPUT);
  
  // Set kondisi awal relay
  digitalWrite(SYSTEM_POWER_RELAY, LOW);
  digitalWrite(MOTOR_RELAY, LOW);
  
  // Load state terakhir
  loadState();

  // Inisialisasi LoRa
  if (!initLoRa()) {
    Serial.println("Failed to initialize LoRa! System will continue without remote control.");
  }
  
  // Koneksi WiFi dengan retry
  WiFi.begin(ssid, password);
  int retryCount = 0;
  
  while (WiFi.status() != WL_CONNECTED && retryCount < MAX_RETRY_WIFI) {
    delay(500);
    Serial.print(".");
    retryCount++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi terhubung!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    
    // Mulai WebSocket server
    webSocket.begin();
    webSocket.onEvent(webSocketEvent);
  } else {
    Serial.println("\nGagal terhubung ke WiFi!");
    ESP.restart();  // Restart ESP32 jika gagal terhubung
  }
}

void loop() {
  webSocket.loop();
  
  // Check for LoRa packets
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String received = "";
    while (LoRa.available()) {
      received += (char)LoRa.read();
    }
    
    // Parse JSON data from transmitter
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, received);
    
    if (!error) {
      if (doc.containsKey("moisture") && doc.containsKey("command")) {
        remoteMoisture = doc["moisture"].as<float>();
        String command = doc["command"].as<String>();
        lastRemoteUpdate = millis();
        
        Serial.println("Received: Moisture = " + String(remoteMoisture) + ", Command = " + command);
        
        // Process command
        processCommand(command);
      } else {
        Serial.println("Invalid LoRa packet format");
      }
    } else {
      Serial.println("Failed to parse LoRa JSON data");
    }
  }
  
  // Kirim update status setiap 1 detik
  if (millis() - lastStateUpdate > 1000) {
    broadcastState();
    lastStateUpdate = millis();
  }
  
  // Watchdog timer - matikan sistem jika tidak ada update
  if (systemOn && (millis() - lastWatchdog > WATCHDOG_TIMEOUT)) {
    Serial.println("Watchdog timeout - shutting down system");
    systemOn = false;
    motorRunning = false;
    digitalWrite(SYSTEM_POWER_RELAY, LOW);
    digitalWrite(MOTOR_RELAY, LOW);
    saveState();
    broadcastState();
  }
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.printf("[%u] Terputus!\n", num);
      break;
      
    case WStype_CONNECTED:
      {
        Serial.printf("[%u] Terhubung!\n", num);
        sendState(num);
      }
      break;
      
    case WStype_TEXT:
      {
        String text = String((char*)payload);
        StaticJsonDocument<200> doc;
        DeserializationError error = deserializeJson(doc, text);
        
        if (error) {
          Serial.println("Gagal parsing JSON");
          return;
        }
        
        const char* command = doc["command"];
        
        if (strcmp(command, "set_thresholds") == 0) {
          int dryThreshold = doc["dryThreshold"] | 30;
          int wetThreshold = doc["wetThreshold"] | 70;
          
          // Validasi nilai
          if (dryThreshold < 0 || dryThreshold >= wetThreshold || wetThreshold > 100) {
            String errorMsg = "{\"error\":\"Invalid threshold values\"}";
            webSocket.sendTXT(num, errorMsg);
            return;
          }
          
          // Kirim setting ke transmitter
          StaticJsonDocument<200> settingsDoc;
          settingsDoc["type"] = "settings";
          settingsDoc["dryThreshold"] = dryThreshold;
          settingsDoc["wetThreshold"] = wetThreshold;
          
          String settingsJson;
          serializeJson(settingsDoc, settingsJson);
          
          LoRa.beginPacket();
          LoRa.print(settingsJson);
          LoRa.endPacket();
          
          Serial.println("Sent new thresholds to transmitter: " + settingsJson);
          
          // Tunggu konfirmasi dari transmitter
          unsigned long startWait = millis();
          bool confirmed = false;
          
          while (millis() - startWait < 5000) { // Timeout 5 detik
            int packetSize = LoRa.parsePacket();
            if (packetSize) {
              String received = "";
              while (LoRa.available()) {
                received += (char)LoRa.read();
              }
              
              StaticJsonDocument<200> confirmDoc;
              DeserializationError error = deserializeJson(confirmDoc, received);
              
              if (!error && confirmDoc["type"] == "settings_confirm") {
                // Kirim konfirmasi ke web client
                String response = "{\"success\":true,\"message\":\"Thresholds updated\"}";
                webSocket.sendTXT(num, response);
                confirmed = true;
                Serial.println("Threshold update confirmed by transmitter");
                break;
              }
            }
            delay(100);
          }
          
          if (!confirmed) {
            String errorMsg = "{\"error\":\"No confirmation from transmitter\"}";
            webSocket.sendTXT(num, errorMsg);
            Serial.println("No confirmation received from transmitter");
          }
          
          return;
        }
        
        bool state = doc["state"] | false;
        bool keepSystemOn = doc["keepSystemOn"] | false;
        
        if (strcmp(command, "system_on") == 0) {
          systemOn = true;  // Selalu nyalakan sistem
          digitalWrite(SYSTEM_POWER_RELAY, HIGH);
          Serial.println("Sistem ON");
        }
        else if (strcmp(command, "system_off") == 0) {
          systemOn = false;
          motorRunning = false;
          digitalWrite(SYSTEM_POWER_RELAY, LOW);
          digitalWrite(MOTOR_RELAY, LOW);
          Serial.println("Sistem OFF");
        }
        else if (strcmp(command, "start_motor") == 0) {
          if (!systemOn) {
            Serial.println("Tidak bisa menjalankan motor: Sistem OFF");
            return;
          }
          // Aktifkan starter (Relay 2)
          digitalWrite(MOTOR_RELAY, HIGH);
          motorRunning = true;
          Serial.println("Motor starting...");

          // Matikan starter setelah 2 detik
          delay(2000);
          digitalWrite(MOTOR_RELAY, LOW);
          motorRunning = false;
          Serial.println("Starter OFF, motor running");
        }
        else if (strcmp(command, "motor_off") == 0) {
          digitalWrite(MOTOR_RELAY, LOW);
          motorRunning = false;
          Serial.println("Motor OFF");
        }
        else if (strcmp(command, "stop_all") == 0) {
          emergencyStop();
        }
        
        saveState();  // Simpan state setelah perubahan
        broadcastState();
      }
      break;
  }
}

void startMotor() {
  if (!systemOn) {
    Serial.println("Tidak bisa menjalankan motor: Sistem OFF");
    return;
  }
  
  digitalWrite(MOTOR_RELAY, HIGH);
  motorRunning = true;
  Serial.println("Motor ON");
}

void emergencyStop() {
  systemOn = false;
  motorRunning = false;
  digitalWrite(SYSTEM_POWER_RELAY, LOW);
  digitalWrite(MOTOR_RELAY, LOW);
  Serial.println("EMERGENCY STOP!");
  saveState();
  broadcastState();
}

void sendState(uint8_t num) {
  StaticJsonDocument<200> doc;
  doc["systemOn"] = systemOn;
  doc["motorRunning"] = motorRunning;
  doc["remoteMoisture"] = remoteMoisture;
  doc["lastUpdate"] = millis();
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(num, output);
}

void broadcastState() {
  StaticJsonDocument<200> doc;
  doc["systemOn"] = systemOn;
  doc["motorRunning"] = motorRunning;
  doc["remoteMoisture"] = remoteMoisture;
  doc["lastUpdate"] = millis();
  
  String output;
  serializeJson(doc, output);
  webSocket.broadcastTXT(output);
}
