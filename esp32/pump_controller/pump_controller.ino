#include <SPI.h>
#include <LoRa.h>
#include <ArduinoJson.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <WiFi.h>
#include <SPIFFS.h>
#include <EEPROM.h>
#include <Update.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

// EEPROM addresses
#define EEPROM_SIZE 32
#define ADDR_THRESHOLD_LOW 0
#define ADDR_THRESHOLD_HIGH 4

// Pin definitions untuk LoRa
#define LORA_SS 5       // LoRa radio chip select
#define LORA_RST 14     // LoRa radio reset
#define LORA_DIO0 2     // LoRa radio DIO0 (interrupt)

// Pin untuk relay
#define SYSTEM_POWER_RELAY 26  // Relay untuk power sistem
#define MOTOR_RELAY 27         // Relay untuk starter motor
#define LED_STATUS_PIN 12      // LED untuk indikator status

// Debounce settings
#define DEBOUNCE_DELAY 50      // Delay debounce dalam ms
unsigned long lastDebounceTime = 0;

// Retry settings untuk LoRa
#define LORA_MAX_RETRIES 3
#define LORA_RETRY_DELAY 1000
int loraRetryCount = 0;

// Konfigurasi LoRa - HARUS SAMA dengan transmitter
const long LORA_FREQUENCY = 433E6;  // Frekuensi LoRa (433 MHz)
const int LORA_SYNC_WORD = 0xF3;    // Sync word untuk komunikasi privat
const int LORA_TX_POWER = 20;       // Power transmisi (dBm)
const long LORA_BANDWIDTH = 125E3;   // Bandwidth (Hz)
const int LORA_SPREADING_FACTOR = 7; // Spreading Factor (7-12)
const int LORA_CODING_RATE = 5;      // Coding Rate (5-8)

// WiFi credentials
const char* ssid = "DLJ1";
const char* password = "dlj12345";

// Timing constants
const unsigned long RELAY_STABILIZE_DELAY = 1000;  // Delay untuk stabilisasi relay (ms)
const unsigned long MOTOR_START_DURATION = 2000;    // Durasi starter motor (ms)
const unsigned long LORA_HEALTH_CHECK = 5000;      // Interval cek koneksi LoRa (ms)
const unsigned long STATUS_UPDATE_INTERVAL = 2000;  // Interval update status (ms)
const unsigned long WATCHDOG_TIMEOUT = 300000;     // 5 menit timeout untuk safety

// Threshold untuk kontrol otomatis
float moistureThresholdLow = 30.0;   // Start pump if below this
float moistureThresholdHigh = 70.0;  // Stop pump if above this

// Variables
bool systemOn = false;
bool motorRunning = false;
bool loraConnected = false;
float remoteMoisture = 0;
unsigned long lastLoRaReceive = 0;
unsigned long lastStatusUpdate = 0;
unsigned long motorStartTime = 0;
unsigned long lastWatchdog = 0;
bool ledState = false;

// Server instances
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

// Fungsi untuk broadcast status ke semua client WebSocket
void broadcastStatus() {
  StaticJsonDocument<200> doc;
  doc["systemOn"] = systemOn;
  doc["motorRunning"] = motorRunning;
  doc["moisture"] = remoteMoisture;
  doc["loraConnected"] = loraConnected;
  doc["thresholdLow"] = moistureThresholdLow;
  doc["thresholdHigh"] = moistureThresholdHigh;
  
  String status;
  serializeJson(doc, status);
  ws.textAll(status);
}

// Handler untuk event WebSocket
void onWsEvent(AsyncWebSocket * server, AsyncWebSocketClient * client, AwsEventType type, void * arg, uint8_t *data, size_t len) {
  if(type == WS_EVT_CONNECT) {
    Serial.printf("WebSocket client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
    logToFile("New WebSocket client connected");
    broadcastStatus();
  } else if(type == WS_EVT_DISCONNECT) {
    Serial.printf("WebSocket client #%u disconnected\n", client->id());
    logToFile("WebSocket client disconnected");
  } else if(type == WS_EVT_DATA) {
    AwsFrameInfo *info = (AwsFrameInfo*)arg;
    if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
      data[len] = 0;
      String message = String((char*)data);
      
      StaticJsonDocument<200> doc;
      DeserializationError error = deserializeJson(doc, message);
      
      if (!error) {
        if (doc.containsKey("command")) {
          String command = doc["command"];
          Serial.printf("Received command: %s\n", command.c_str());
          
          // Log command
          char logMsg[64];
          snprintf(logMsg, sizeof(logMsg), "Received command: %s", command.c_str());
          logToFile(logMsg);
          
          // Debounce protection untuk relay
          if (millis() - lastDebounceTime < DEBOUNCE_DELAY) {
            Serial.println("Command ignored (debounce)");
            return;
          }
          lastDebounceTime = millis();
          
          if (command == "system_on") {
            controlSystemPower(true);
          } 
          else if (command == "system_off") {
            controlSystemPower(false);
          }
          else if (command == "start_motor" && systemOn) {
            controlMotor(true);
          } 
          else if (command == "motor_off") {
            controlMotor(false);
          } 
          else if (command == "stop_all") {
            emergencyStop();
          }
          else if (command == "set_thresholds" && 
                   doc.containsKey("dry") && 
                   doc.containsKey("wet")) {
            float newLow = doc["dry"];
            float newHigh = doc["wet"];
            
            if (newLow >= 0 && newLow < newHigh && newHigh <= 100) {
              moistureThresholdLow = newLow;
              moistureThresholdHigh = newHigh;
              
              // Simpan ke EEPROM
              saveThresholds();
              
              // Kirim threshold baru ke sensor
              StaticJsonDocument<200> settingsDoc;
              settingsDoc["type"] = "settings";
              settingsDoc["dry"] = newLow;
              settingsDoc["wet"] = newHigh;
              
              String settingsMsg;
              serializeJson(settingsDoc, settingsMsg);
              
              LoRa.beginPacket();
              LoRa.print(settingsMsg);
              LoRa.endPacket();
              
              char logMsg[64];
              snprintf(logMsg, sizeof(logMsg), 
                "New thresholds set: Low=%.1f%%, High=%.1f%%", 
                newLow, newHigh);
              logToFile(logMsg);
            }
          }
          
          // Update watchdog
          lastWatchdog = millis();
        }
      } else {
        logToFile("Error parsing WebSocket message");
      }
    }
  }
}

// Fungsi untuk menyimpan threshold ke EEPROM
void saveThresholds() {
  EEPROM.writeFloat(ADDR_THRESHOLD_LOW, moistureThresholdLow);
  EEPROM.writeFloat(ADDR_THRESHOLD_HIGH, moistureThresholdHigh);
  EEPROM.commit();
  Serial.printf("Thresholds saved to EEPROM: Low=%.1f%%, High=%.1f%%\n", 
    moistureThresholdLow, moistureThresholdHigh);
}

// Fungsi untuk membaca threshold dari EEPROM
void loadThresholds() {
  moistureThresholdLow = EEPROM.readFloat(ADDR_THRESHOLD_LOW);
  moistureThresholdHigh = EEPROM.readFloat(ADDR_THRESHOLD_HIGH);
  
  // Validasi nilai yang dibaca
  if (isnan(moistureThresholdLow) || isnan(moistureThresholdHigh) ||
      moistureThresholdLow < 0 || moistureThresholdLow > 100 ||
      moistureThresholdHigh < 0 || moistureThresholdHigh > 100 ||
      moistureThresholdLow >= moistureThresholdHigh) {
    // Set default jika nilai tidak valid
    moistureThresholdLow = 30.0;
    moistureThresholdHigh = 70.0;
    saveThresholds();
  }
  
  Serial.printf("Thresholds loaded from EEPROM: Low=%.1f%%, High=%.1f%%\n", 
    moistureThresholdLow, moistureThresholdHigh);
}

// Fungsi untuk logging ke SPIFFS
void logToFile(const char* message) {
  File logFile = SPIFFS.open("/pump.log", "a");
  if (logFile) {
    // Format: [timestamp] message
    char timestamp[32];
    unsigned long now = millis();
    sprintf(timestamp, "[%lu] ", now);
    
    logFile.print(timestamp);
    logFile.println(message);
    logFile.close();
  }
}

// Fungsi untuk retry koneksi LoRa
bool retryLoRaConnection() {
  while (loraRetryCount < LORA_MAX_RETRIES) {
    Serial.printf("LoRa connection attempt %d/%d\n", 
      loraRetryCount + 1, LORA_MAX_RETRIES);
    
    if (initLoRa()) {
      loraRetryCount = 0;
      return true;
    }
    
    loraRetryCount++;
    delay(LORA_RETRY_DELAY);
  }
  
  loraRetryCount = 0;
  return false;
}

// Fungsi untuk inisialisasi LoRa
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

// Fungsi untuk inisialisasi WiFi
void initWiFi() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ssid, password);
  
  Serial.println("WiFi AP started");
  Serial.print("IP Address: ");
  Serial.println(WiFi.softAPIP());
}

// Fungsi untuk mengontrol power sistem
void controlSystemPower(bool turnOn) {
  if (turnOn && !systemOn) {
    digitalWrite(SYSTEM_POWER_RELAY, HIGH);
    delay(RELAY_STABILIZE_DELAY);
    
    if (digitalRead(SYSTEM_POWER_RELAY) == HIGH) {
      systemOn = true;
      Serial.println("System power ON");
    } else {
      Serial.println("Failed to turn system ON");
    }
  } 
  else if (!turnOn && systemOn) {
    controlMotor(false);  // Stop motor first
    digitalWrite(SYSTEM_POWER_RELAY, LOW);
    systemOn = false;
    Serial.println("System power OFF");
  }
  
  broadcastStatus();
}

// Fungsi untuk mengontrol motor
void controlMotor(bool turnOn) {
  if (!systemOn) {
    Serial.println("Cannot control motor: System is OFF");
    return;
  }
  
  if (turnOn && !motorRunning) {
    digitalWrite(MOTOR_RELAY, HIGH);
    motorStartTime = millis();
    motorRunning = true;
    Serial.println("Motor starting");
  } 
  else if (!turnOn && motorRunning) {
    digitalWrite(MOTOR_RELAY, LOW);
    motorRunning = false;
    Serial.println("Motor stopped");
  }
  
  broadcastStatus();
}

// Fungsi untuk emergency stop
void emergencyStop() {
  digitalWrite(MOTOR_RELAY, LOW);
  digitalWrite(SYSTEM_POWER_RELAY, LOW);
  systemOn = false;
  motorRunning = false;
  Serial.println("EMERGENCY STOP!");
  broadcastStatus();
}

// Fungsi untuk handle LoRa message
void handleLoRaMessage() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String message = "";
    while (LoRa.available()) {
      message += (char)LoRa.read();
    }
    
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, message);
    
    if (!error) {
      if (doc.containsKey("moisture")) {
        remoteMoisture = doc["moisture"];
        lastLoRaReceive = millis();
        loraConnected = true;
        
        // Send acknowledgment
        StaticJsonDocument<100> ackDoc;
        ackDoc["type"] = "ack";
        ackDoc["success"] = true;
        
        String ackMsg;
        serializeJson(ackDoc, ackMsg);
        
        LoRa.beginPacket();
        LoRa.print(ackMsg);
        LoRa.endPacket();
        
        Serial.printf("Moisture update: %.1f%%\n", remoteMoisture);
        
        // Auto-control based on moisture
        if (systemOn && !motorRunning && remoteMoisture < moistureThresholdLow) {
          Serial.printf("Auto-start: Moisture (%.1f%%) below threshold (%.1f%%)\n",
            remoteMoisture, moistureThresholdLow);
          controlMotor(true);
        } 
        else if (motorRunning && remoteMoisture > moistureThresholdHigh) {
          Serial.printf("Auto-stop: Moisture (%.1f%%) above threshold (%.1f%%)\n",
            remoteMoisture, moistureThresholdHigh);
          controlMotor(false);
        }
        
        broadcastStatus();
      }
      else if (doc.containsKey("type") && doc["type"] == "settings_ack") {
        bool success = doc["success"];
        Serial.printf("Settings update %s\n", success ? "successful" : "failed");
      }
    }
  }
}

// Fungsi untuk cek koneksi LoRa
void checkLoRaHealth() {
  if (millis() - lastLoRaReceive > LORA_HEALTH_CHECK) {
    if (loraConnected) {
      loraConnected = false;
      Serial.println("LoRa connection lost!");
      if (motorRunning) {
        Serial.println("Safety stop: LoRa connection lost");
        controlMotor(false);
      }
    }
  }
}

// Fungsi untuk update LED status
void updateLED() {
  unsigned long currentTime = millis();
  static unsigned long lastBlink = 0;
  
  if (!loraConnected) {
    // Blink slowly when LoRa disconnected
    if (currentTime - lastBlink >= 1000) {
      ledState = !ledState;
      lastBlink = currentTime;
    }
  } else if (motorRunning) {
    // Blink fast when motor running
    if (currentTime - lastBlink >= 200) {
      ledState = !ledState;
      lastBlink = currentTime;
    }
  } else {
    // Solid ON when system healthy
    ledState = systemOn;
  }
  
  digitalWrite(LED_STATUS_PIN, ledState);
}

void setup() {
  Serial.begin(115200);
  Serial.println("\nPump Controller Starting...");
  
  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);
  
  // Load thresholds from EEPROM
  loadThresholds();
  
  // Setup pins
  pinMode(SYSTEM_POWER_RELAY, OUTPUT);
  pinMode(MOTOR_RELAY, OUTPUT);
  pinMode(LED_STATUS_PIN, OUTPUT);
  digitalWrite(SYSTEM_POWER_RELAY, LOW);
  digitalWrite(MOTOR_RELAY, LOW);
  digitalWrite(LED_STATUS_PIN, LOW);
  
  // Initialize SPIFFS
  if(!SPIFFS.begin(true)){
    Serial.println("SPIFFS initialization error");
    return;
  }
  
  // Clear old log file
  if(SPIFFS.exists("/pump.log")) {
    SPIFFS.remove("/pump.log");
  }
  logToFile("System starting...");
  
  // Initialize LoRa with retry
  if (!retryLoRaConnection()) {
    Serial.println("LoRa initialization failed after retries!");
    logToFile("LoRa initialization failed");
    while (1) {
      digitalWrite(LED_STATUS_PIN, HIGH);
      delay(100);
      digitalWrite(LED_STATUS_PIN, LOW);
      delay(100);
    }
  }
  logToFile("LoRa initialized successfully");
  
  // Initialize WiFi
  initWiFi();
  logToFile("WiFi AP started");
  
  // Initialize WebSocket
  ws.onEvent(onWsEvent);
  server.addHandler(&ws);
  
  // Configure web server
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(SPIFFS, "/index.html", "text/html");
  });
  
  // Add endpoint untuk mengakses log
  server.on("/logs", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(SPIFFS, "/pump.log", "text/plain");
  });
  
  server.serveStatic("/", SPIFFS, "/");
  server.begin();
  
  Serial.println("Setup complete!");
  logToFile("Setup complete");
}

void loop() {
  // Clean up disconnected clients
  ws.cleanupClients();
  
  // Handle LoRa messages
  handleLoRaMessage();
  
  // Check LoRa connection health
  checkLoRaHealth();
  
  // Update LED status
  updateLED();
  
  // Auto-stop motor after start duration
  if (motorRunning && (millis() - motorStartTime >= MOTOR_START_DURATION)) {
    digitalWrite(MOTOR_RELAY, LOW);
  }
  
  // Regular status updates
  if (millis() - lastStatusUpdate >= STATUS_UPDATE_INTERVAL) {
    broadcastStatus();
    lastStatusUpdate = millis();
    
    // Log status setiap 10 detik
    if ((millis() / 1000) % 10 == 0) {
      Serial.printf("\nSystem Status:\n");
      Serial.printf("- LoRa Connected: %s\n", loraConnected ? "YES" : "NO");
      Serial.printf("- System Power: %s\n", systemOn ? "ON" : "OFF");
      Serial.printf("- Motor: %s\n", motorRunning ? "RUNNING" : "OFF");
      Serial.printf("- Moisture: %.1f%%\n", remoteMoisture);
      Serial.printf("- Thresholds: Low=%.1f%%, High=%.1f%%\n", 
        moistureThresholdLow, moistureThresholdHigh);
    }
  }
  
  // Watchdog check
  if (systemOn && (millis() - lastWatchdog > WATCHDOG_TIMEOUT)) {
    Serial.println("Watchdog timeout - emergency stop!");
    emergencyStop();
    lastWatchdog = millis();
  }
  
  // Small delay to prevent CPU hogging
  delay(10);
}
