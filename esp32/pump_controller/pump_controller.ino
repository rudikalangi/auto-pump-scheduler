#pragma GCC diagnostic ignored "-fpermissive"

#if CONFIG_FREERTOS_UNICORE
#define ARDUINO_RUNNING_CORE 0
#else
#define ARDUINO_RUNNING_CORE 1
#endif

#define CONFIG_ASYNC_TCP_RUNNING_CORE 0

#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <SPIFFS.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <LoRa.h>
#include <EEPROM.h>

// Forward declarations
void controlMotor(bool turnOn);
void broadcastStatus();

// Konstanta pin
#define LED_STATUS_PIN     2
#define SYSTEM_POWER_RELAY 4  
#define MOTOR_RELAY        16
#define LORA_SS           18
#define LORA_RST          14
#define LORA_DIO0         26
#define LORA_SCK          5
#define LORA_MISO         19
#define LORA_MOSI         27

// Konstanta EEPROM addresses
#define EEPROM_SIZE 512
#define EEPROM_THRESHOLD_LOW  0
#define EEPROM_THRESHOLD_HIGH 4
#define EEPROM_IP_START      8   // 4 bytes untuk IP
#define EEPROM_GW_START      12  // 4 bytes untuk gateway
#define EEPROM_DNS_START     16  // 4 bytes untuk DNS
#define DEFAULT_THRESHOLD_LOW  30.0
#define DEFAULT_THRESHOLD_HIGH 70.0

// Konstanta WiFi
const char* ssid = "TAP DLJ";
const char* password = "tap12345!";
#define WIFI_TIMEOUT 10000
#define WIFI_CHECK_INTERVAL 5000

// Network Configuration
IPAddress local_IP;
IPAddress gateway;
IPAddress subnet(255, 255, 255, 0);
IPAddress dns;

// Default network settings jika belum ada di EEPROM
const uint8_t default_ip[4] = {10, 33, 83, 130};
const uint8_t default_gw[4] = {10, 33, 83, 1};
const uint8_t default_dns[4] = {10, 16, 9, 142};

// WebSocket Configuration
#define WS_PING_INTERVAL 2000        // Kirim ping setiap 2 detik
#define WS_TIMEOUT 5000              // Timeout setelah 5 detik tidak ada respons
unsigned long lastPing = 0;
unsigned long lastBroadcast = 0;

// Konstanta LoRa
#define LORA_FREQUENCY    915E6
#define LORA_BANDWIDTH    125E3
#define LORA_SPREADING    7
#define LORA_CODING_RATE  5
#define LORA_SYNC_WORD   0x12
#define LORA_TX_POWER    20
#define LORA_CHECK_INTERVAL 100
#define LORA_HEALTH_CHECK 5000

// Konstanta Task
#define STACK_SIZE 4096
#define TASK_PRIORITY 1
#define TASK_CORE_0 0
#define TASK_CORE_1 1

// Global variables
bool systemOn = false;
bool motorRunning = false;
bool isWifiConnected = false;
bool loraConnected = false;
float remoteMoisture = 0;
float moistureThresholdLow = DEFAULT_THRESHOLD_LOW;
float moistureThresholdHigh = DEFAULT_THRESHOLD_HIGH;
unsigned long lastLoraReceive = 0;

// Task handles
TaskHandle_t wifiTaskHandle = NULL;
TaskHandle_t loraTaskHandle = NULL;

// Mutexes
SemaphoreHandle_t wifiMutex = NULL;
SemaphoreHandle_t loraMutex = NULL;

// Server instances
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

// Fungsi kontrol sistem
void controlSystemPower(bool turnOn) {
    if (turnOn && !systemOn) {
        digitalWrite(SYSTEM_POWER_RELAY, HIGH);
        systemOn = true;
        Serial.println("System ON");
    } 
    else if (!turnOn && systemOn) {
        controlMotor(false);  // Matikan motor dulu
        digitalWrite(SYSTEM_POWER_RELAY, LOW);
        systemOn = false;
        Serial.println("System OFF");
    }
    broadcastStatus();
}

void controlMotor(bool turnOn) {
    if (!systemOn) return;
    
    if (turnOn && !motorRunning) {
        digitalWrite(MOTOR_RELAY, HIGH);
        motorRunning = true;
        Serial.println("Motor ON");
    } 
    else if (!turnOn && motorRunning) {
        digitalWrite(MOTOR_RELAY, LOW);
        motorRunning = false;
        Serial.println("Motor OFF");
    }
    broadcastStatus();
}

void emergencyStop() {
    digitalWrite(MOTOR_RELAY, LOW);
    digitalWrite(SYSTEM_POWER_RELAY, LOW);
    systemOn = false;
    motorRunning = false;
    Serial.println("EMERGENCY STOP!");
    broadcastStatus();
}

// Fungsi status
void broadcastStatus() {
    if (!isWifiConnected) return;
    
    StaticJsonDocument<300> doc;
    doc["systemOn"] = systemOn;
    doc["motorRunning"] = motorRunning;
    doc["moisture"] = remoteMoisture;
    doc["thresholdLow"] = moistureThresholdLow;
    doc["thresholdHigh"] = moistureThresholdHigh;
    doc["wifi"] = WiFi.RSSI();
    doc["lora"] = loraConnected;
    doc["timestamp"] = millis();
    
    String status;
    serializeJson(doc, status);
    ws.textAll(status);
    
    lastBroadcast = millis();
}

// Fungsi EEPROM
void saveThresholds() {
    EEPROM.writeFloat(EEPROM_THRESHOLD_LOW, moistureThresholdLow);
    EEPROM.writeFloat(EEPROM_THRESHOLD_HIGH, moistureThresholdHigh);
    EEPROM.commit();
}

void loadThresholds() {
    moistureThresholdLow = EEPROM.readFloat(EEPROM_THRESHOLD_LOW);
    moistureThresholdHigh = EEPROM.readFloat(EEPROM_THRESHOLD_HIGH);
    
    if (isnan(moistureThresholdLow) || moistureThresholdLow < 0 || moistureThresholdLow > 100) {
        moistureThresholdLow = DEFAULT_THRESHOLD_LOW;
    }
    if (isnan(moistureThresholdHigh) || moistureThresholdHigh < 0 || moistureThresholdHigh > 100) {
        moistureThresholdHigh = DEFAULT_THRESHOLD_HIGH;
    }
}

// Fungsi untuk menyimpan network settings ke EEPROM
void saveNetworkSettings() {
    for (int i = 0; i < 4; i++) {
        EEPROM.write(EEPROM_IP_START + i, local_IP[i]);
        EEPROM.write(EEPROM_GW_START + i, gateway[i]);
        EEPROM.write(EEPROM_DNS_START + i, dns[i]);
    }
    EEPROM.commit();
}

// Fungsi untuk memuat network settings dari EEPROM
void loadNetworkSettings() {
    bool valid = true;
    uint8_t temp_ip[4], temp_gw[4], temp_dns[4];
    
    // Baca settings dari EEPROM
    for (int i = 0; i < 4; i++) {
        temp_ip[i] = EEPROM.read(EEPROM_IP_START + i);
        temp_gw[i] = EEPROM.read(EEPROM_GW_START + i);
        temp_dns[i] = EEPROM.read(EEPROM_DNS_START + i);
        
        // Validasi basic (tidak 0 atau 255 untuk semua oktet)
        if (temp_ip[i] == 0 || temp_ip[i] == 255) valid = false;
    }
    
    if (valid) {
        local_IP = IPAddress(temp_ip[0], temp_ip[1], temp_ip[2], temp_ip[3]);
        gateway = IPAddress(temp_gw[0], temp_gw[1], temp_gw[2], temp_gw[3]);
        dns = IPAddress(temp_dns[0], temp_dns[1], temp_dns[2], temp_dns[3]);
    } else {
        // Gunakan default settings
        local_IP = IPAddress(default_ip[0], default_ip[1], default_ip[2], default_ip[3]);
        gateway = IPAddress(default_gw[0], default_gw[1], default_gw[2], default_gw[3]);
        dns = IPAddress(default_dns[0], default_dns[1], default_dns[2], default_dns[3]);
        saveNetworkSettings(); // Simpan default ke EEPROM
    }
}

// Fungsi untuk menginisialisasi WiFi
bool initWiFi() {
    Serial.println("Configuring WiFi...");
    
    // Configure static IP
    if (!WiFi.config(local_IP, gateway, subnet, dns)) {
        Serial.println("Static IP Configuration Failed");
        return false;
    }
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);
    
    Serial.print("Connecting to WiFi");
    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < WIFI_TIMEOUT) {
        delay(100);
        Serial.print(".");
    }
    Serial.println();
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nConnected to WiFi");
        Serial.print("SSID: ");
        Serial.println(WiFi.SSID());
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
        Serial.print("Gateway: ");
        Serial.println(WiFi.gatewayIP());
        Serial.print("DNS: ");
        Serial.println(WiFi.dnsIP());
        Serial.print("Signal strength (RSSI): ");
        Serial.println(WiFi.RSSI());
        return true;
    }
    
    Serial.println("\nFailed to connect to WiFi");
    return false;
}

// Fungsi untuk memeriksa koneksi WiFi
void checkWiFiConnection() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi connection lost!");
        isWifiConnected = false;
        digitalWrite(LED_STATUS_PIN, LOW);
        
        // Coba reconnect
        if (initWiFi()) {
            isWifiConnected = true;
            digitalWrite(LED_STATUS_PIN, HIGH);
            Serial.println("WiFi reconnected!");
            
            // Broadcast status setelah reconnect
            broadcastStatus();
        }
    }
}

// Handle WebSocket messages dengan validasi
void handleWebSocketMessage(AsyncWebSocket *server, AsyncWebSocketClient *client, void *arg, uint8_t *data, size_t len) {
    AwsFrameInfo *info = (AwsFrameInfo*)arg;
    if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
        data[len] = 0;
        String message = (char*)data;
        
        StaticJsonDocument<200> doc;
        DeserializationError error = deserializeJson(doc, message);
        
        if (!error) {
            if (doc.containsKey("command")) {
                String command = doc["command"];
                
                if (command == "power") {
                    controlSystemPower(doc["value"].as<bool>());
                }
                else if (command == "motor") {
                    controlMotor(doc["value"].as<bool>());
                }
                else if (command == "emergency") {
                    emergencyStop();
                }
                else if (command == "threshold") {
                    float low = doc["low"];
                    float high = doc["high"];
                    if (low >= 0 && low <= 100 && high >= 0 && high <= 100 && high > low) {
                        moistureThresholdLow = low;
                        moistureThresholdHigh = high;
                        saveThresholds();
                        broadcastStatus();
                    }
                }
                else if (command == "network") {
                    // Update network settings
                    if (doc.containsKey("ip") && doc.containsKey("gateway") && doc.containsKey("dns")) {
                        const char* new_ip = doc["ip"];
                        const char* new_gw = doc["gateway"];
                        const char* new_dns = doc["dns"];
                        
                        IPAddress temp_ip;
                        IPAddress temp_gw;
                        IPAddress temp_dns;
                        
                        if (temp_ip.fromString(new_ip) && 
                            temp_gw.fromString(new_gw) && 
                            temp_dns.fromString(new_dns)) {
                            
                            local_IP = temp_ip;
                            gateway = temp_gw;
                            dns = temp_dns;
                            
                            saveNetworkSettings();
                            
                            // Send response before restarting
                            StaticJsonDocument<100> response;
                            response["type"] = "network";
                            response["status"] = "success";
                            response["message"] = "Network settings updated. Restarting...";
                            
                            String responseStr;
                            serializeJson(response, responseStr);
                            client->text(responseStr);
                            
                            // Tunggu sebentar agar response terkirim
                            delay(1000);
                            ESP.restart();
                        } else {
                            // Invalid IP format
                            StaticJsonDocument<100> response;
                            response["type"] = "network";
                            response["status"] = "error";
                            response["message"] = "Invalid IP format";
                            
                            String responseStr;
                            serializeJson(response, responseStr);
                            client->text(responseStr);
                        }
                    }
                }
                else if (command == "getnetwork") {
                    // Send current network settings
                    StaticJsonDocument<200> response;
                    response["type"] = "network";
                    response["ip"] = local_IP.toString();
                    response["gateway"] = gateway.toString();
                    response["dns"] = dns.toString();
                    response["wifi_rssi"] = WiFi.RSSI();
                    response["wifi_ssid"] = WiFi.SSID();
                    
                    String responseStr;
                    serializeJson(response, responseStr);
                    client->text(responseStr);
                }
                else if (command == "ping") {
                    if (client) {
                        client->text("{\"type\":\"pong\"}");
                    }
                }
            }
        }
    }
}

// WebSocket event handler dengan ping/pong
void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
    switch(type) {
        case WS_EVT_CONNECT:
            Serial.printf("WebSocket client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
            broadcastStatus(); // Send initial status
            break;
            
        case WS_EVT_DISCONNECT:
            Serial.printf("WebSocket client #%u disconnected\n", client->id());
            break;
            
        case WS_EVT_DATA:
            handleWebSocketMessage(server, client, arg, data, len);
            break;
            
        case WS_EVT_PONG:
            Serial.println("Received Pong");
            break;
            
        case WS_EVT_ERROR:
            Serial.println("WebSocket Error");
            break;
    }
}

// Tasks
void wifiTask(void *parameter) {
    while (true) {
        if (WiFi.status() != WL_CONNECTED) {
            initWiFi();
            isWifiConnected = (WiFi.status() == WL_CONNECTED);
            digitalWrite(LED_STATUS_PIN, isWifiConnected);
        }
        delay(WIFI_CHECK_INTERVAL);
    }
}

void loraTask(void *parameter) {
    while (true) {
        int packetSize = LoRa.parsePacket();
        if (packetSize) {
            String message = "";
            while (LoRa.available()) {
                message += (char)LoRa.read();
            }
            
            StaticJsonDocument<200> doc;
            DeserializationError error = deserializeJson(doc, message);
            
            if (!error && doc.containsKey("moisture")) {
                remoteMoisture = doc["moisture"];
                lastLoraReceive = millis();
                loraConnected = true;
                
                if (systemOn && !motorRunning && remoteMoisture < moistureThresholdLow) {
                    controlMotor(true);
                } 
                else if (motorRunning && remoteMoisture > moistureThresholdHigh) {
                    controlMotor(false);
                }
                
                broadcastStatus();
            }
        }
        
        if (millis() - lastLoraReceive > LORA_HEALTH_CHECK) {
            loraConnected = false;
            if (motorRunning) controlMotor(false);
        }
        
        delay(LORA_CHECK_INTERVAL);
    }
}

void setup() {
    Serial.begin(115200);
    delay(1000); // Give time for serial to initialize
    
    Serial.println("Starting setup...");
    
    // Init pins
    pinMode(LED_STATUS_PIN, OUTPUT);
    pinMode(SYSTEM_POWER_RELAY, OUTPUT);
    pinMode(MOTOR_RELAY, OUTPUT);
    pinMode(LORA_RST, OUTPUT);
    
    // Set initial pin states
    digitalWrite(LED_STATUS_PIN, LOW);
    digitalWrite(SYSTEM_POWER_RELAY, LOW);
    digitalWrite(MOTOR_RELAY, LOW);
    
    // Init SPIFFS
    if (!SPIFFS.begin(true)) {
        Serial.println("SPIFFS init failed!");
        return;
    }
    Serial.println("SPIFFS initialized");
    
    // Init EEPROM
    if (!EEPROM.begin(EEPROM_SIZE)) {
        Serial.println("EEPROM init failed!");
        return;
    }
    Serial.println("EEPROM initialized");
    
    // Load saved thresholds
    loadThresholds();
    
    // Load network settings
    loadNetworkSettings();
    Serial.print("IP Address: ");
    Serial.println(local_IP);
    
    // Create mutexes before any network operations
    wifiMutex = xSemaphoreCreateMutex();
    loraMutex = xSemaphoreCreateMutex();
    
    // Init WiFi with proper delay
    if (!initWiFi()) {
        Serial.println("WiFi connection failed!");
        return;
    }
    
    // Init LoRa
    SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
    LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
    
    if (!LoRa.begin(LORA_FREQUENCY)) {
        Serial.println("LoRa init failed!");
        return;
    }
    Serial.println("LoRa initialized");
    
    // Setup CORS and WebSocket
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, PUT");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Content-Type");
    
    // Init WebSocket
    ws.onEvent(onWsEvent);
    server.addHandler(&ws);
    
    // Add HTTP routes
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "text/plain", "ESP32 Pump Controller Running");
    });
    
    server.on("/status", HTTP_GET, [](AsyncWebServerRequest *request) {
        String status = "{\"ip\":\"" + local_IP.toString() + 
                       "\",\"rssi\":" + String(WiFi.RSSI()) +
                       ",\"connected\":" + String(WiFi.status() == WL_CONNECTED) + "}";
        request->send(200, "application/json", status);
    });
    
    // Start server
    server.begin();
    Serial.println("Web server started");
    
    // Create tasks
    xTaskCreatePinnedToCore(
        wifiTask,
        "WiFiTask",
        STACK_SIZE,
        NULL,
        TASK_PRIORITY,
        &wifiTaskHandle,
        TASK_CORE_0
    );
    
    xTaskCreatePinnedToCore(
        loraTask,
        "LoRaTask",
        STACK_SIZE,
        NULL,
        TASK_PRIORITY,
        &loraTaskHandle,
        TASK_CORE_1
    );
    
    Serial.println("Setup completed successfully");
}

void loop() {
    unsigned long currentMillis = millis();
    
    // Check WiFi connection
    static unsigned long lastWiFiCheck = 0;
    if (currentMillis - lastWiFiCheck >= 5000) { // Check every 5 seconds
        checkWiFiConnection();
        lastWiFiCheck = currentMillis;
    }
    
    // WebSocket ping/pong untuk menjaga koneksi
    if (currentMillis - lastPing >= WS_PING_INTERVAL) {
        ws.cleanupClients();
        if (ws.count() > 0) {
            ws.textAll("{\"type\":\"ping\"}");
            Serial.printf("Sending ping to %u clients\n", ws.count());
        }
        lastPing = currentMillis;
    }
    
    // Broadcast status secara berkala
    if (currentMillis - lastBroadcast >= 1000) { // setiap 1 detik
        if (isWifiConnected && ws.count() > 0) {
            broadcastStatus();
        }
        lastBroadcast = currentMillis;
    }
    
    delay(10); // Prevent watchdog timeout
}
