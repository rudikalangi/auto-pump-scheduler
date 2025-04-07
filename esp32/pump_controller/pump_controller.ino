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
const unsigned long STARTER_TIMEOUT = 2000;     // Motor selalu menyala 2 detik lalu mati
const unsigned long STATUS_INTERVAL = 1000;     // 1 detik antara broadcast status
const unsigned long MOISTURE_CHECK_INTERVAL = 5000; // 5 detik antara cek moisture
const unsigned long SYSTEM_STABILIZE_DELAY = 500;   // 500ms untuk system stabilize

// Global variables
volatile bool systemOn = false;
volatile bool motorRunning = false;
volatile bool motorStarting = false;
unsigned long motorStartTime = 0;
unsigned long lastStatus = 0;
unsigned long lastMoistureCheck = 0;
float remoteMoisture = 0.0;
int dryThreshold = 30;    // Default dry threshold
int wetThreshold = 70;    // Default wet threshold
bool autoMode = false;     // Auto mode disabled by default

// WebSocket server on port 81
WebSocketsServer webSocket = WebSocketsServer(81);

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
    Serial.printf("Received command: %s\n", command);
    
    if (strcmp(command, "toggleSystem") == 0) {
      if (systemOn) {
        stopSystem();
      } else {
        startSystem();
      }
    }
    else if (strcmp(command, "startMotor") == 0) {
      if (systemOn && !motorStarting && !motorRunning) {
        startMotor();
      } else {
        Serial.printf("Cannot start motor: System: %s, Starting: %s, Running: %s\n",
          systemOn ? "ON" : "OFF",
          motorStarting ? "YES" : "NO",
          motorRunning ? "YES" : "NO"
        );
        broadcastStatus();
      }
    }
    else if (strcmp(command, "stopMotor") == 0) {
      if (motorRunning || motorStarting) {
        stopMotor();
      }
      broadcastStatus();
    }
    else if (strcmp(command, "stopAll") == 0) {
      stopSystem(); // This will also stop motor if running
    }
    else if (strcmp(command, "scheduleStart") == 0) {
      Serial.println("Schedule start command received");
      handleScheduledOperation(true);
    }
    else if (strcmp(command, "scheduleEnd") == 0) {
      Serial.println("Schedule end command received");
      handleScheduledOperation(false);
    }
    else if (strcmp(command, "getStatus") == 0) {
      // Verifikasi status aktual relay sebelum broadcast
      bool actualSystemState = digitalRead(SYSTEM_POWER_RELAY) == HIGH;
      bool actualMotorState = digitalRead(MOTOR_RELAY) == HIGH;
      
      if (actualSystemState != systemOn) {
        Serial.println("System state mismatch, correcting...");
        systemOn = actualSystemState;
      }
      
      if (actualMotorState != motorRunning) {
        Serial.println("Motor state mismatch, correcting...");
        motorRunning = actualMotorState;
        if (!motorRunning) motorStarting = false;
      }
      
      broadcastStatus();
    }
    else if (strcmp(command, "setMoistureThresholds") == 0) {
      dryThreshold = doc["dry"];
      wetThreshold = doc["wet"];
      Serial.printf("Updated thresholds - Dry: %d, Wet: %d\n", dryThreshold, wetThreshold);
      broadcastStatus();
    }
    else if (strcmp(command, "toggleAutoMode") == 0) {
      autoMode = !autoMode;
      Serial.printf("Auto mode: %s\n", autoMode ? "ON" : "OFF");
      broadcastStatus();
    }
  }
}

void startSystem() {
  if (!systemOn) {
    Serial.println("Starting system...");
    systemOn = true;
    digitalWrite(SYSTEM_POWER_RELAY, HIGH);
    
    // Tunggu relay stabil dan verifikasi
    delay(SYSTEM_STABILIZE_DELAY);
    if (digitalRead(SYSTEM_POWER_RELAY) == HIGH) {
      Serial.println("System ON confirmed");
    } else {
      Serial.println("Failed to turn system ON");
      systemOn = false;
    }
    broadcastStatus();
  }
}

void stopSystem() {
  if (systemOn) {
    Serial.println("Stopping system...");
    // Matikan motor dulu jika masih nyala
    if (motorRunning || motorStarting) {
      stopMotor();
      delay(100); // Tunggu motor benar-benar berhenti
    }
    
    systemOn = false;
    digitalWrite(SYSTEM_POWER_RELAY, LOW);
    
    // Verifikasi system benar-benar mati
    delay(100);
    if (digitalRead(SYSTEM_POWER_RELAY) == LOW) {
      Serial.println("System OFF confirmed");
    } else {
      Serial.println("Failed to turn system OFF");
    }
    broadcastStatus();
  }
}

void startMotor() {
  if (!systemOn) {
    Serial.println("Cannot start motor: System is OFF");
    return;
  }
  
  if (motorStarting || motorRunning) {
    Serial.println("Motor already running or starting");
    return;
  }
  
  Serial.println("Starting motor for 2 seconds...");
  motorStarting = true;
  motorStartTime = millis();
  digitalWrite(MOTOR_RELAY, HIGH);
  
  // Verifikasi motor benar-benar hidup
  delay(100);
  if (digitalRead(MOTOR_RELAY) == HIGH) {
    Serial.println("Motor ON confirmed");
    motorRunning = true;
  } else {
    Serial.println("Failed to turn motor ON");
    motorStarting = false;
    motorStartTime = 0;
  }
  
  // Broadcast status setelah perubahan
  broadcastStatus();
}

void stopMotor() {
  if (motorRunning || motorStarting) {
    Serial.println("Stopping motor");
    digitalWrite(MOTOR_RELAY, LOW);
    
    // Verifikasi motor benar-benar mati
    delay(100);
    if (digitalRead(MOTOR_RELAY) == LOW) {
      Serial.println("Motor OFF confirmed");
      motorStarting = false;
      motorRunning = false;
      motorStartTime = 0;
    } else {
      Serial.println("Failed to turn motor OFF");
    }
    
    // Broadcast status setelah perubahan
    broadcastStatus();
  }
}

void checkMotorTimer() {
  // Motor selalu mati setelah 2 detik di semua mode
  if (motorRunning && (millis() - motorStartTime >= STARTER_TIMEOUT)) {
    Serial.println("Motor 2 second timeout reached");
    stopMotor();
  }
}

void checkMoistureThresholds() {
  if (!autoMode) return;  // Skip if not in auto mode
  
  if (remoteMoisture <= dryThreshold) {
    // Jika kering, hidupkan system dulu lalu motor
    if (!systemOn) {
      startSystem();
    }
    // Motor akan hidup 2 detik lalu mati otomatis
    if (systemOn && !motorRunning && !motorStarting) {
      startMotor(); // Motor akan mati sendiri setelah 2 detik
    }
  } 
  else if (remoteMoisture >= wetThreshold || remoteMoisture > dryThreshold) {
    // Jika basah atau optimal, matikan semuanya
    stopSystem();
  }
}

void handleScheduledOperation(bool shouldStart) {
  Serial.printf("Handling scheduled operation: %s\n", shouldStart ? "START" : "STOP");
  
  if (shouldStart) {
    // Jika system belum ON, hidupkan dulu
    if (!systemOn) {
      startSystem();
      delay(SYSTEM_STABILIZE_DELAY);
    }
    
    // Hanya start motor jika system ON dan motor belum running/starting
    if (systemOn && !motorRunning && !motorStarting) {
      Serial.println("Starting motor for scheduled operation");
      startMotor(); // Motor akan mati sendiri setelah 2 detik
    } else {
      Serial.printf("Skip motor start - System: %d, Motor running: %d, Motor starting: %d\n", 
                   systemOn, motorRunning, motorStarting);
    }
  } else {
    // Jika stop, matikan system (ini akan matikan motor juga)
    if (systemOn) {
      Serial.println("Stopping system for scheduled operation");
      stopSystem();
    } else {
      Serial.println("System already OFF");
    }
  }
  
  // Broadcast status setelah perubahan
  broadcastStatus();
}

void broadcastStatus() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Cannot broadcast status: WiFi not connected");
    return;
  }

  // Verifikasi status aktual sebelum broadcast
  bool actualSystemState = digitalRead(SYSTEM_POWER_RELAY) == HIGH;
  bool actualMotorState = digitalRead(MOTOR_RELAY) == HIGH;
  
  // Update status jika tidak sesuai
  if (actualSystemState != systemOn) {
    Serial.println("System state mismatch detected in broadcast");
    systemOn = actualSystemState;
  }
  
  if (actualMotorState != motorRunning) {
    Serial.println("Motor state mismatch detected in broadcast");
    motorRunning = actualMotorState;
    if (!motorRunning) motorStarting = false;
  }

  StaticJsonDocument<200> doc;
  doc["type"] = "status";
  doc["system"] = systemOn;
  doc["motor"] = motorRunning;
  doc["starting"] = motorStarting;
  doc["moisture"] = remoteMoisture;
  doc["autoMode"] = autoMode;
  doc["dryThreshold"] = dryThreshold;
  doc["wetThreshold"] = wetThreshold;

  String status;
  serializeJson(doc, status);
  Serial.printf("Broadcasting status: %s\n", status.c_str());
  webSocket.broadcastTXT(status);
}

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
  
  // Check motor timer - selalu cek di semua mode
  checkMotorTimer();
  
  // Check moisture thresholds
  if (currentMillis - lastMoistureCheck >= MOISTURE_CHECK_INTERVAL) {
    lastMoistureCheck = currentMillis;
    checkMoistureThresholds();
  }
  
  // Broadcast status periodically
  if (currentMillis - lastStatus >= STATUS_INTERVAL) {
    lastStatus = currentMillis;
    broadcastStatus();
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
