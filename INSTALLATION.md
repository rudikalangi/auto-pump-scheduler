# Installation Guide for Auto Pump Scheduler

## Prerequisites

### For Web Application
1. Node.js v18 or higher
2. npm (Node Package Manager)
3. Git

### For ESP32
1. Arduino IDE
2. Required Libraries:
   - WebSocketsServer
   - ArduinoJson
   - WiFi

## Installation Steps

### Web Application Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/auto-pump-scheduler.git
   cd auto-pump-scheduler
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Access the application at:
   ```
   http://localhost:5173
   ```

### ESP32 Setup

1. Open Arduino IDE

2. Install Required Libraries:
   - Go to Sketch > Include Library > Manage Libraries
   - Search and install:
     - "WebSocketsServer"
     - "ArduinoJson"

3. Configure ESP32:
   - Open `esp32/pump_controller/pump_controller.ino`
   - Update WiFi credentials:
     ```cpp
     const char* ssid = "YourWiFiName";      // Change to your WiFi name
     const char* password = "YourPassword";   // Change to your WiFi password
     ```

4. Connect ESP32:
   - Connect Relay 1 (System Power) to GPIO 26
   - Connect Relay 2 (Motor Starter) to GPIO 27

5. Upload the code:
   - Select correct board and port in Arduino IDE
   - Click Upload button

## Connecting Web App to ESP32

1. Get ESP32 IP Address:
   - The IP address will be printed in Arduino Serial Monitor
   - Usually starts with 192.168.x.x

2. Configure Web Application:
   - Open the web application
   - Go to Settings
   - Enter the ESP32's IP address
   - Click Connect

## Testing the Connection

1. Check connection status in the web app's dashboard
2. The status indicator should show "Connected"
3. Try toggling the system power
4. Monitor the Serial Monitor in Arduino IDE for debugging

## Troubleshooting

1. Connection Issues:
   - Ensure ESP32 and computer are on the same network
   - Check if ESP32 IP address is correct
   - Verify WiFi credentials

2. Relay Control Issues:
   - Check wiring connections
   - Verify relay pin assignments
   - Monitor Serial output for debugging

3. Web App Issues:
   - Clear browser cache
   - Check console for errors
   - Verify correct IP address input

## Support

For additional help or reporting issues, please visit the GitHub repository's issue section.
