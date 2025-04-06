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

// Send a command to the ESP32
const sendCommand = (command: string, params: Record<string, any> = {}) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('WebSocket is not connected');
    return false;
  }

  try {
    const message = {
      type: 'command',
      command,
      ...params
    };
    
    console.log('Sending command:', message);
    ws.send(JSON.stringify(message));
    return true;
  } catch (error) {
    console.error('Failed to send command:', error);
    return false;
  }
};

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

  console.log('Connecting to ESP32 at:', ip);
  
  // Create new WebSocket connection
  ws = new WebSocket(`ws://${ip}`); 

  ws.onopen = () => {
    console.log('Connected to ESP32');
    isConnecting = false;
    if (connectionCallback) connectionCallback(true);
    
    // Get initial status
    sendCommand('getStatus');
  };

  ws.onclose = (event) => {
    console.log('Disconnected from ESP32:', event.code, event.reason);
    isConnecting = false;
    if (connectionCallback) connectionCallback(false);
    ws = null;
    
    // Try to reconnect after 3 seconds
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connectToEsp32(ip);
      }, 3000);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    isConnecting = false;
    if (ws) ws.close();
    ws = null;
    
    toast({
      title: "Connection Error",
      description: "Failed to connect to ESP32. Check if the device is powered on and connected to the network.",
      variant: "destructive"
    });
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Received message:', data);
      
      if (data.type === 'status' && statusCallback) {
        statusCallback(data);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  };
};

// Register callback for status updates
export const onStatus = (callback: StatusCallback) => {
  statusCallback = callback;
};

// Register callback for connection state changes
export const onConnection = (callback: ConnectionCallback) => {
  connectionCallback = callback;
};

// Control system power
export const toggleSystem = () => {
  return sendCommand('toggleSystem');
};

// Control motor
export const toggleMotor = () => {
  return sendCommand('toggleMotor');
};

// Emergency stop
export const stopAll = () => {
  return sendCommand('stopAll');
};

// Get current status
export const getStatus = () => {
  return sendCommand('getStatus');
};
