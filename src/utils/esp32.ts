/**
 * ESP32 communication utility
 * This module provides functions to communicate with the ESP32 controller via WebSocket
 */

import { toast } from '@/components/ui/use-toast';

// WebSocket instance
let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let isConnecting = false;

// Callback functions
type StatusCallback = (status: any) => void;
type ConnectionCallback = (connected: boolean) => void;

let statusCallback: StatusCallback | null = null;
let connectionCallback: ConnectionCallback | null = null;

/**
 * Set the ESP32 controller IP address and connect WebSocket
 * @param ip - IP address of the ESP32
 */
export const connectToEsp32 = (ip: string) => {
  if (isConnecting) return;
  isConnecting = true;

  // Close existing connection if any
  if (ws) {
    ws.close();
    ws = null;
  }

  // Clear any existing reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Create new WebSocket connection
  ws = new WebSocket(`ws://${ip}/ws`);

  ws.onopen = () => {
    console.log('Connected to ESP32');
    isConnecting = false;
    if (connectionCallback) connectionCallback(true);
    
    // Get initial network settings
    sendCommand('getnetwork');
  };

  ws.onclose = () => {
    console.log('Disconnected from ESP32');
    isConnecting = false;
    if (connectionCallback) connectionCallback(false);
    
    // Try to reconnect after 5 seconds
    reconnectTimer = setTimeout(() => {
      connectToEsp32(ip);
    }, 5000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    toast({
      title: "Connection Error",
      description: "Failed to connect to ESP32. Retrying...",
      variant: "destructive"
    });
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Handle different message types
      switch (data.type) {
        case 'status':
          if (statusCallback) statusCallback(data);
          break;
          
        case 'pong':
          console.log('Received pong from ESP32');
          break;
          
        case 'network':
          if (data.status === 'error') {
            toast({
              title: "Network Error",
              description: data.message,
              variant: "destructive"
            });
          } else if (data.status === 'success') {
            toast({
              title: "Network Updated",
              description: data.message
            });
          }
          break;
          
        default:
          console.log('Received message:', data);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };
};

/**
 * Send a command to the ESP32
 * @param command - Command to send
 * @param params - Additional parameters
 */
export const sendCommand = (command: string, params: Record<string, any> = {}) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    toast({
      title: "Connection Error",
      description: "Not connected to ESP32",
      variant: "destructive"
    });
    return;
  }

  try {
    ws.send(JSON.stringify({
      command,
      ...params
    }));
  } catch (error) {
    console.error('Error sending command:', error);
    toast({
      title: "Error",
      description: "Failed to send command to ESP32",
      variant: "destructive"
    });
  }
};

/**
 * Register callback for status updates
 * @param callback - Function to call when status is received
 */
export const onStatus = (callback: StatusCallback) => {
  statusCallback = callback;
};

/**
 * Register callback for connection state changes
 * @param callback - Function to call when connection state changes
 */
export const onConnection = (callback: ConnectionCallback) => {
  connectionCallback = callback;
};

/**
 * Update network settings
 * @param ip - New IP address
 * @param gateway - New gateway address
 * @param dns - New DNS server address
 */
export const updateNetwork = (ip: string, gateway: string, dns: string) => {
  sendCommand('network', { ip, gateway, dns });
};

/**
 * Control system power
 * @param on - True to turn on, false to turn off
 */
export const controlPower = (on: boolean) => {
  sendCommand('power', { value: on });
};

/**
 * Control motor
 * @param on - True to turn on, false to turn off
 */
export const controlMotor = (on: boolean) => {
  sendCommand('motor', { value: on });
};

/**
 * Emergency stop
 */
export const emergencyStop = () => {
  sendCommand('emergency');
};

/**
 * Update moisture thresholds
 * @param low - Low threshold (0-100)
 * @param high - High threshold (0-100)
 */
export const updateThresholds = (low: number, high: number) => {
  sendCommand('threshold', { low, high });
};
