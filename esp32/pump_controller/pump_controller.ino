#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>

// Pin definitions
#define SYSTEM_POWER_RELAY 25
#define MOTOR_RELAY        26

// WiFi credentials
const char* ssid = "TAP DLJ";
const char* password = "tap12345!";

// Global variables
volatile bool systemOn = false;
volatile bool motorRunning = false;
bool isWifiConnected = false;
unsigned long motorStartTime = 0;
const unsigned long MOTOR_TIMEOUT = 2000; // 2 seconds for motor starter

// WebSocket server instance
WebSocketsServer webSocket = WebSocketsServer(80);

// Initialize WiFi
bool initWiFi() {
    if (WiFi.status() == WL_CONNECTED) {
        WiFi.disconnect(true);
        delay(1000);
    }
    
    WiFi.mode(WIFI_STA); // Set WiFi to station mode
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    Serial.println();
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.print("Connected! IP address: ");
        Serial.println(WiFi.localIP());
        return true;
    } else {
        Serial.println("Failed to connect to WiFi");
        return false;
    }
}

// Send system status to all connected clients
void broadcastStatus() {
    if (!isWifiConnected) return;

    StaticJsonDocument<200> doc;
    doc["type"] = "status";
    doc["system"] = systemOn;
    doc["motor"] = motorRunning;
    
    String status;
    serializeJson(doc, status);
    
    Serial.print("Broadcasting status: ");
    Serial.println(status);
    webSocket.broadcastTXT(status);
}

// Control system power with safety checks
void controlSystem(bool turnOn) {
    if (!isWifiConnected) return;

    if (turnOn != systemOn) {
        if (!turnOn && motorRunning) {
            // Turn off motor first if system is being turned off
            controlMotor(false);
            delay(100); // Small delay to ensure motor is off
        }

        digitalWrite(SYSTEM_POWER_RELAY, turnOn ? HIGH : LOW);
        systemOn = turnOn;
        
        Serial.print("System power: ");
        Serial.println(systemOn ? "ON" : "OFF");
        
        broadcastStatus();
    }
}

// Control motor with safety checks
void controlMotor(bool turnOn) {
    if (!isWifiConnected || !systemOn) return;

    if (turnOn != motorRunning) {
        digitalWrite(MOTOR_RELAY, turnOn ? HIGH : LOW);
        motorRunning = turnOn;
        
        if (turnOn) {
            motorStartTime = millis();
        } else {
            motorStartTime = 0;
        }
        
        Serial.print("Motor: ");
        Serial.println(motorRunning ? "ON" : "OFF");
        
        broadcastStatus();
    }
}

// Emergency stop with safety checks
void stopAll() {
    if (!isWifiConnected) return;

    // Stop motor first
    digitalWrite(MOTOR_RELAY, LOW);
    motorRunning = false;
    motorStartTime = 0;
    
    // Then turn off system power
    digitalWrite(SYSTEM_POWER_RELAY, LOW);
    systemOn = false;
    
    Serial.println("Emergency stop triggered");
    broadcastStatus();
}

// WebSocket event handler with improved error handling
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.printf("[%u] Disconnected!\n", num);
            break;
            
        case WStype_CONNECTED:
            {
                Serial.printf("[%u] Connected!\n", num);
                broadcastStatus();
            }
            break;
            
        case WStype_TEXT:
            {
                if (!payload || length == 0) {
                    Serial.println("Empty payload received");
                    return;
                }
                
                Serial.printf("[%u] Received text: %s\n", num, payload);
                
                StaticJsonDocument<200> doc;
                DeserializationError error = deserializeJson(doc, payload, length);
                
                if (error) {
                    Serial.print("Failed to parse JSON: ");
                    Serial.println(error.c_str());
                    return;
                }
                
                if (!doc.containsKey("type")) {
                    Serial.println("Missing 'type' field in message");
                    return;
                }
                
                const char* type = doc["type"];
                if (strcmp(type, "command") == 0) {
                    if (!doc.containsKey("command")) {
                        Serial.println("Missing 'command' field in message");
                        return;
                    }
                    
                    const char* command = doc["command"];
                    
                    if (strcmp(command, "toggleSystem") == 0) {
                        controlSystem(!systemOn);
                    } 
                    else if (strcmp(command, "toggleMotor") == 0) {
                        controlMotor(!motorRunning);
                    }
                    else if (strcmp(command, "stopAll") == 0) {
                        stopAll();
                    }
                    else if (strcmp(command, "getStatus") == 0) {
                        broadcastStatus();
                    }
                }
            }
            break;
    }
}

void setup() {
    Serial.begin(115200);
    delay(1000); // Give time for serial to initialize
    
    // Initialize pins with pull-down
    pinMode(SYSTEM_POWER_RELAY, OUTPUT);
    pinMode(MOTOR_RELAY, OUTPUT);
    digitalWrite(SYSTEM_POWER_RELAY, LOW);
    digitalWrite(MOTOR_RELAY, LOW);
    
    Serial.println("Pins initialized");
    
    // Initialize WiFi
    isWifiConnected = initWiFi();
    
    if (isWifiConnected) {
        // Start WebSocket server
        webSocket.begin();
        webSocket.onEvent(webSocketEvent);
        Serial.println("WebSocket server started on port 80");
    }
}

void loop() {
    if (isWifiConnected) {
        webSocket.loop();
        
        // Check motor timer with overflow protection
        if (motorRunning && motorStartTime > 0) {
            unsigned long currentTime = millis();
            if (currentTime - motorStartTime >= MOTOR_TIMEOUT || currentTime < motorStartTime) {
                Serial.println("Motor timeout reached, stopping motor");
                controlMotor(false);
            }
        }
        
        // Monitor WiFi connection
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("WiFi disconnected. Attempting to reconnect...");
            isWifiConnected = initWiFi();
            if (!isWifiConnected) {
                stopAll();
            }
        }
    } else {
        // Try to reconnect WiFi if disconnected
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("Attempting to connect to WiFi...");
            isWifiConnected = initWiFi();
        }
    }
    
    delay(10); // Small delay to prevent watchdog issues
}
