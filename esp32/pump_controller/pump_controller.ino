#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <LoRa.h>

// Pin definitions
#define SYSTEM_POWER_RELAY 26
#define MOTOR_RELAY 27
#define LORA_SS 5
#define LORA_RST 14
#define LORA_DIO0 2

// WiFi credentials
const char* WIFI_SSID = "TAP DLJ";
const char* WIFI_PASSWORD = "tap12345!";

// Constants
const unsigned long STARTER_TIMEOUT = 2000;     // 2 seconds for starter
const unsigned long MOTOR_RUN_TIME = 2000;     // 2 seconds total run time
const unsigned long STATUS_INTERVAL = 2000;     // 2 seconds between status broadcasts

// Global variables
volatile bool systemOn = false;
volatile bool motorRunning = false;
volatile bool motorStarting = false;
unsigned long motorStartTime = 0;
unsigned long lastStatus = 0;
float remoteMoisture = 0.0;

// WebSocket server on port 81 instead of 80
WebSocketsServer webSocket = WebSocketsServer(81);

void setupWiFi() {
    WiFi.disconnect(true);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    Serial.print("Connecting to WiFi");
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        Serial.print("Connected! IP: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("Connection failed!");
    }
}

void handleWebSocketMessage(uint8_t num, uint8_t *payload, size_t length) {
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, payload, length);

  if (error) {
    Serial.println("Failed to parse WebSocket message");
    return;
  }

  const char* type = doc["type"];
  if (strcmp(type, "command") == 0) {
    const char* command = doc["command"];
    
    if (strcmp(command, "toggleSystem") == 0) {
      systemOn = !systemOn;
      digitalWrite(SYSTEM_POWER_RELAY, systemOn ? HIGH : LOW);
      if (!systemOn) {
        motorRunning = false;
        digitalWrite(MOTOR_RELAY, LOW);
      }
      broadcastStatus();
    }
    else if (strcmp(command, "toggleMotor") == 0) {
      if (systemOn && !motorStarting) {
        startMotor();
      } else if (motorRunning) {
        stopMotor();
      }
      broadcastStatus();
    }
    else if (strcmp(command, "stopAll") == 0) {
      systemOn = false;
      motorRunning = false;
      digitalWrite(SYSTEM_POWER_RELAY, LOW);
      digitalWrite(MOTOR_RELAY, LOW);
      broadcastStatus();
    }
    else if (strcmp(command, "setSystemState") == 0) {
      bool state = doc["state"];
      systemOn = state;
      digitalWrite(SYSTEM_POWER_RELAY, systemOn ? HIGH : LOW);
      if (!systemOn) {
        motorRunning = false;
        digitalWrite(MOTOR_RELAY, LOW);
      }
      broadcastStatus();
    }
    else if (strcmp(command, "setMotorState") == 0) {
      bool state = doc["state"];
      if (systemOn && state && !motorStarting) {
        startMotor();
      } else if (!state && motorRunning) {
        stopMotor();
      }
      broadcastStatus();
    }
    else if (strcmp(command, "getStatus") == 0) {
      broadcastStatus();
    }
  }
}

void startMotor() {
  if (!systemOn || motorStarting || motorRunning) return;
  
  motorStarting = true;
  motorStartTime = millis();
  digitalWrite(MOTOR_RELAY, HIGH);
  motorRunning = true;
  
  // Broadcast status immediately after starting
  broadcastStatus();
}

void stopMotor() {
  motorStarting = false;
  motorRunning = false;
  digitalWrite(MOTOR_RELAY, LOW);
  
  // Broadcast status immediately after stopping
  broadcastStatus();
}

void broadcastStatus() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Cannot broadcast status: WiFi not connected");
    return;
  }

  StaticJsonDocument<200> doc;
  doc["type"] = "status";
  doc["system"] = systemOn;
  doc["motor"] = motorRunning;
  doc["moisture"] = remoteMoisture;

  String status;
  serializeJson(doc, status);
  webSocket.broadcastTXT(status);
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\nESP32 Pump Controller Starting...");
    
    // Initialize pins
    pinMode(SYSTEM_POWER_RELAY, OUTPUT);
    pinMode(MOTOR_RELAY, OUTPUT);
    digitalWrite(SYSTEM_POWER_RELAY, LOW);
    digitalWrite(MOTOR_RELAY, LOW);
    
    // Setup WiFi
    setupWiFi();
    
    // Start WebSocket server
    webSocket.begin();
    webSocket.onEvent([&](uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
        if (type == WStype_TEXT) {
            handleWebSocketMessage(num, payload, length);
        }
    });
    Serial.println("WebSocket server running");
    Serial.printf("Connect to: %s:81\n", WiFi.localIP().toString().c_str());
}

void loop() {
    webSocket.loop();
    
    unsigned long currentMillis = millis();
    
    // Handle motor timing
    if (motorRunning) {
        if (motorStarting && (currentMillis - motorStartTime >= STARTER_TIMEOUT)) {
            motorStarting = false;
            broadcastStatus();
        }
        
        if (currentMillis - motorStartTime >= MOTOR_RUN_TIME) {
            stopMotor();
        }
    }
    
    // Periodic status broadcast
    if (currentMillis - lastStatus >= STATUS_INTERVAL) {
        if (WiFi.status() == WL_CONNECTED) {
            broadcastStatus();
        }
        lastStatus = currentMillis;
    }
    
    // Check WiFi
    if (WiFi.status() != WL_CONNECTED) {
        static unsigned long lastWiFiCheck = 0;
        if (currentMillis - lastWiFiCheck >= 5000) {  // Check every 5 seconds
            Serial.println("WiFi disconnected, reconnecting...");
            setupWiFi();
            lastWiFiCheck = currentMillis;
        }
    }
}
