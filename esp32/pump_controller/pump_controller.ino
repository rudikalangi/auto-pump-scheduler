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
const int RELAY_STABILIZE_DELAY = 500;  // Delay untuk stabilisasi relay (ms)
const int MOTOR_START_DURATION = 2000;   // Durasi starter motor (ms)
const int POWER_ON_DELAY = 1000;        // Delay setelah power on sebelum operasi lain

// LoRa configuration
const long LORA_FREQUENCY = 433E6;  // Frekuensi LoRa (433 MHz)
const int LORA_SYNC_WORD = 0xF3;    // Sync word untuk komunikasi privat

// WebSocket server
WebSocketsServer webSocket = WebSocketsServer(80);

// System state
bool systemOn = false;         // Status sistem (Relay 1)
bool motorStarting = false;    // Status starter motor (Relay 2)
bool motorRunning = false;     // Status motor sudah running
unsigned long motorStartTime = 0; // Waktu mulai starter
unsigned long lastWatchdog = 0;
unsigned long lastStateUpdate = 0;
float remoteMoisture = 0.0;
unsigned long lastRemoteUpdate = 0;

// Fungsi untuk mengontrol sistem power (Relay 1)
void controlSystemPower(bool turnOn) {
  if (turnOn) {
    // Nyalakan sistem power (Relay 1)
    digitalWrite(SYSTEM_POWER_RELAY, HIGH);  // Active HIGH relay
    delay(RELAY_STABILIZE_DELAY);
    
    if (digitalRead(SYSTEM_POWER_RELAY) == HIGH) {
      systemOn = true;
      Serial.println("Sistem ON - Power aktif");
    } else {
      // Coba sekali lagi
      digitalWrite(SYSTEM_POWER_RELAY, HIGH);
      delay(RELAY_STABILIZE_DELAY);
      
      if (digitalRead(SYSTEM_POWER_RELAY) == HIGH) {
        systemOn = true;
        Serial.println("Sistem ON - Power aktif (retry success)");
      } else {
        systemOn = false;
        Serial.println("Gagal menyalakan sistem");
      }
    }
  } else {
    // Matikan sistem
    digitalWrite(SYSTEM_POWER_RELAY, LOW);  // Inactive LOW
    delay(RELAY_STABILIZE_DELAY);
    systemOn = false;
    motorStarting = false;
    motorRunning = false;
    Serial.println("Sistem OFF");
  }
  
  saveState();
  broadcastState();
}

// Fungsi untuk kontrol motor starter (Relay 2)
void controlMotor(bool turnOn) {
  if (!systemOn) {
    Serial.println("Tidak bisa menjalankan motor: Sistem belum ON");
    return;
  }

  if (turnOn && !motorStarting && !motorRunning) {
    // Aktifkan starter motor (Relay 2)
    digitalWrite(MOTOR_RELAY, HIGH);  // Active HIGH
    motorStarting = true;
    motorStartTime = millis();
    Serial.println("Motor Starter ON");
    
    // Timer untuk mematikan starter
    delay(MOTOR_START_DURATION);
    
    digitalWrite(MOTOR_RELAY, LOW);  // Inactive LOW
    motorStarting = false;
    motorRunning = true;
    Serial.println("Motor Starter OFF - Motor Running");
  } else if (!turnOn) {
    digitalWrite(MOTOR_RELAY, LOW);  // Inactive LOW
    motorStarting = false;
    motorRunning = false;
    Serial.println("Motor OFF");
  }
  
  saveState();
  broadcastState();
}

void setup() {
  Serial.begin(115200);
  
  // Initialize pins
  pinMode(SYSTEM_POWER_RELAY, OUTPUT);
  pinMode(MOTOR_RELAY, OUTPUT);
  
  // Set initial relay states (Inactive LOW)
  digitalWrite(SYSTEM_POWER_RELAY, LOW);
  digitalWrite(MOTOR_RELAY, LOW);
  delay(RELAY_STABILIZE_DELAY);
  
  EEPROM.begin(EEPROM_SIZE);
  
  // Initialize WiFi with more detailed logging
  WiFi.begin(ssid, password);
  Serial.println("\nMenghubungkan ke WiFi...");
  Serial.printf("SSID: %s\n", ssid);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < MAX_RETRY_WIFI) {
    delay(500);
    Serial.print(".");
    attempts++;
    
    if (attempts % 5 == 0) {
      Serial.printf("\nPercobaan ke-%d, Status WiFi: %d\n", attempts, WiFi.status());
    }
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nTerhubung ke WiFi!");
    Serial.printf("IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("Gateway: %s\n", WiFi.gatewayIP().toString().c_str());
    Serial.printf("Subnet: %s\n", WiFi.subnetMask().toString().c_str());
    Serial.printf("DNS: %s\n", WiFi.dnsIP().toString().c_str());
    Serial.printf("Channel: %d\n", WiFi.channel());
    Serial.printf("RSSI: %d dBm\n", WiFi.RSSI());
    
    // Start WebSocket server with debug info
    webSocket.begin();
    webSocket.onEvent(webSocketEvent);
    Serial.println("WebSocket server started on port 80");
  } else {
    Serial.println("\nGagal terhubung ke WiFi!");
    Serial.printf("Status WiFi terakhir: %d\n", WiFi.status());
  }
  
  // Initialize LoRa
  if (!initLoRa()) {
    Serial.println("LoRa initialization failed!");
  }
  
  // Load saved state
  loadState();
  Serial.println("Setup complete!");
}

void loadState() {
  systemOn = EEPROM.read(0) == 1;
  motorRunning = EEPROM.read(1) == 1;
  motorStarting = false;
  
  // Apply saved state (remember relays are active HIGH)
  digitalWrite(SYSTEM_POWER_RELAY, systemOn ? HIGH : LOW);
  digitalWrite(MOTOR_RELAY, LOW); // Motor relay selalu inactive saat startup
}

void emergencyStop() {
  digitalWrite(MOTOR_RELAY, LOW);     // Inactive LOW
  digitalWrite(SYSTEM_POWER_RELAY, LOW); // Inactive LOW
  systemOn = false;
  motorStarting = false;
  motorRunning = false;
  Serial.println("EMERGENCY STOP!");
  saveState();
  broadcastState();
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
        Serial.println("Received command: " + text);  // Debug print
        
        StaticJsonDocument<200> doc;
        DeserializationError error = deserializeJson(doc, text);
        
        if (error) {
          Serial.println("Gagal parsing JSON");
          return;
        }
        
        const char* command = doc["command"];
        Serial.println("Processing command: " + String(command));  // Debug print
        
        if (strcmp(command, "system_on") == 0) {
          Serial.println("Executing system_on command...");  // Debug print
          controlSystemPower(true);
          Serial.println("System power state after command: " + String(systemOn ? "ON" : "OFF"));  // Debug print
          Serial.println("Relay pin state: " + String(digitalRead(SYSTEM_POWER_RELAY)));  // Debug print
        }
        else if (strcmp(command, "system_off") == 0) {
          Serial.println("Executing system_off command...");  // Debug print
          controlSystemPower(false);
        }
        else if (strcmp(command, "start_motor") == 0) {
          Serial.println("Executing start_motor command...");  // Debug print
          controlMotor(true);
        }
        else if (strcmp(command, "stop_motor") == 0) {
          Serial.println("Executing stop_motor command...");  // Debug print
          controlMotor(false);
        }
        else if (strcmp(command, "stop_all") == 0) {
          Serial.println("Executing emergency stop...");  // Debug print
          emergencyStop();
        }
        
        Serial.println("Command processing complete");  // Debug print
      }
      break;
  }
}

void saveState() {
  EEPROM.write(0, systemOn ? 1 : 0);
  EEPROM.write(1, motorRunning ? 1 : 0);
  EEPROM.commit();
}

void sendState(uint8_t num) {
  StaticJsonDocument<200> doc;
  doc["systemOn"] = systemOn;
  doc["motorStarting"] = motorStarting;
  doc["motorRunning"] = motorRunning;
  doc["remoteMoisture"] = remoteMoisture;
  doc["lastRemoteUpdate"] = lastRemoteUpdate;
  
  String state;
  serializeJson(doc, state);
  webSocket.sendTXT(num, state);
}

void broadcastState() {
  StaticJsonDocument<200> doc;
  doc["systemOn"] = systemOn;
  doc["motorStarting"] = motorStarting;
  doc["motorRunning"] = motorRunning;
  doc["remoteMoisture"] = remoteMoisture;
  doc["lastRemoteUpdate"] = lastRemoteUpdate;
  
  String state;
  serializeJson(doc, state);
  webSocket.broadcastTXT(state);
}

void loop() {
  webSocket.loop();
  
  // Monitor WiFi connection
  static unsigned long lastWiFiCheck = 0;
  if (millis() - lastWiFiCheck > 5000) {  // Check every 5 seconds
    lastWiFiCheck = millis();
    
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi terputus! Mencoba menghubungkan kembali...");
      WiFi.reconnect();
    }
  }
  
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
        if (command == "ON" && !systemOn) {
          controlSystemPower(true);
        }
        else if (command == "OFF" && systemOn) {
          controlSystemPower(false);
        }
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
    controlSystemPower(false);
  }
}

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
