#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <EEPROM.h>

// WiFi credentials
const char* ssid = "TAP DLJ";      // Ganti dengan nama WiFi Anda
const char* password = "tap12345!";   // Ganti dengan password WiFi Anda

// Pin definitions
const int SYSTEM_POWER_RELAY = 26;  // Relay 1 untuk daya sistem
const int MOTOR_RELAY = 27;         // Relay 2 untuk starter motor
const int WATER_LEVEL_SENSOR = 34;  // Sensor level air (opsional)
const int FLOW_SENSOR = 35;         // Sensor aliran air (opsional)

// Constants
const unsigned long WATCHDOG_TIMEOUT = 30000;  // 30 detik timeout
const int EEPROM_SIZE = 512;
const int MAX_RETRY_WIFI = 20;  // Maksimum percobaan koneksi WiFi

// WebSocket server
WebSocketsServer webSocket = WebSocketsServer(80);

// System state
bool systemOn = false;
bool motorRunning = false;
unsigned long lastWatchdog = 0;
unsigned long lastStateUpdate = 0;
int waterLevel = 0;
float flowRate = 0.0;

// Fungsi untuk menyimpan state ke EEPROM
void saveState() {
  EEPROM.write(0, systemOn);
  EEPROM.write(1, motorRunning);
  EEPROM.commit();
}

// Fungsi untuk membaca state dari EEPROM
void loadState() {
  systemOn = EEPROM.read(0);
  motorRunning = EEPROM.read(1);
}

void setup() {
  Serial.begin(115200);
  EEPROM.begin(EEPROM_SIZE);
  
  // Inisialisasi pin
  pinMode(SYSTEM_POWER_RELAY, OUTPUT);
  pinMode(MOTOR_RELAY, OUTPUT);
  pinMode(WATER_LEVEL_SENSOR, INPUT);
  pinMode(FLOW_SENSOR, INPUT);
  
  // Set kondisi awal relay
  digitalWrite(SYSTEM_POWER_RELAY, LOW);
  digitalWrite(MOTOR_RELAY, LOW);
  
  // Load state terakhir
  loadState();
  
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
  
  // Baca sensor setiap 1 detik
  if (millis() - lastStateUpdate > 1000) {
    waterLevel = analogRead(WATER_LEVEL_SENSOR);
    flowRate = analogRead(FLOW_SENSOR) * 0.1;  // Konversi ke L/min (contoh)
    
    // Kirim update status ke semua client
    broadcastState();
    lastStateUpdate = millis();
  }
  
  // Watchdog timer
  if (systemOn && (millis() - lastWatchdog > WATCHDOG_TIMEOUT)) {
    emergencyStop();
  }
  
  // Cek koneksi WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Koneksi WiFi terputus! Mencoba menghubungkan kembali...");
    WiFi.reconnect();
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
        lastWatchdog = millis();  // Reset watchdog timer
        
        String text = String((char*)payload);
        StaticJsonDocument<200> doc;
        DeserializationError error = deserializeJson(doc, text);
        
        if (error) {
          Serial.println("Gagal parsing JSON");
          return;
        }
        
        const char* command = doc["command"];
        
        if (strcmp(command, "system_on") == 0) {
          toggleSystem();
        }
        else if (strcmp(command, "start_motor") == 0) {
          startMotor();
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

void toggleSystem() {
  systemOn = !systemOn;
  digitalWrite(SYSTEM_POWER_RELAY, systemOn ? HIGH : LOW);
  
  if (!systemOn) {
    motorRunning = false;
    digitalWrite(MOTOR_RELAY, LOW);
  }
  
  Serial.printf("Sistem: %s\n", systemOn ? "ON" : "OFF");
}

void startMotor() {
  if (!systemOn) {
    Serial.println("Tidak bisa menjalankan motor: Sistem OFF");
    return;
  }
  
  digitalWrite(MOTOR_RELAY, HIGH);
  motorRunning = true;
  Serial.println("Motor starting...");
  
  delay(2000);  // Tunda 2 detik
  
  digitalWrite(MOTOR_RELAY, LOW);
  Serial.println("Motor running");
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
  doc["waterLevel"] = waterLevel;
  doc["flowRate"] = flowRate;
  
  String json;
  serializeJson(doc, json);
  webSocket.sendTXT(num, json);
}

void broadcastState() {
  StaticJsonDocument<200> doc;
  doc["systemOn"] = systemOn;
  doc["motorRunning"] = motorRunning;
  doc["waterLevel"] = waterLevel;
  doc["flowRate"] = flowRate;
  
  String json;
  serializeJson(doc, json);
  webSocket.broadcastTXT(json);
}
