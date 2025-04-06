/**
 * ESP32 communication utility
 * This module provides functions to communicate with the ESP32 controller via WebSocket
 */

import { toast } from "@/components/ui/use-toast";

let ws: WebSocket | null = null;
let statusCallback: ((status: any) => void) | null = null;
let connectionCallback: ((connected: boolean) => void) | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let lastActivity = 0;

export const onStatus = (callback: (status: any) => void) => {
  statusCallback = callback;
};

export const onConnection = (callback: (connected: boolean) => void) => {
  connectionCallback = callback;
};

const handleClose = () => {
  console.log('WebSocket closed');
  if (connectionCallback) {
    connectionCallback(false);
  }
  ws = null;
  
  toast({
    title: "Disconnected",
    description: "Lost connection to ESP32",
    variant: "destructive"
  });
};

const handleError = (error: Event) => {
  console.error('WebSocket error:', error);
  if (ws) {
    ws.close();
    ws = null;
  }
  
  toast({
    title: "Connection Error",
    description: "WebSocket error occurred",
    variant: "destructive"
  });
};

const handleMessage = (event: MessageEvent) => {
  try {
    const data = JSON.parse(event.data);
    lastActivity = Date.now();
    console.log('Received message:', data);

    if (data.type === 'status' && statusCallback) {
      statusCallback(data);
    }
  } catch (error) {
    console.error('Error parsing message:', error);
    toast({
      title: "Message Error",
      description: "Failed to parse message from ESP32",
      variant: "destructive"
    });
  }
};

export const connectToEsp32 = (ip: string) => {
  // Clean up existing connection
  if (ws) {
    console.log('Closing existing connection...');
    ws.close();
    ws = null;
  }

  // Clear any existing reconnect timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  try {
    console.log('Connecting to ESP32:', ip);
    ws = new WebSocket(`ws://${ip}:80`);
    lastActivity = Date.now();

    ws.onopen = () => {
      console.log('WebSocket connected');
      if (connectionCallback) {
        connectionCallback(true);
      }
      
      toast({
        title: "Connected",
        description: "Successfully connected to ESP32"
      });

      // Request initial status
      setTimeout(() => {
        console.log('Requesting initial status...');
        sendCommand('getStatus');
      }, 500); // Small delay to ensure WebSocket is ready
    };

    ws.onclose = handleClose;
    ws.onerror = handleError;
    ws.onmessage = handleMessage;

  } catch (error) {
    console.error('Connection error:', error);
    if (connectionCallback) {
      connectionCallback(false);
    }
    
    toast({
      title: "Connection Failed",
      description: "Failed to connect to ESP32",
      variant: "destructive"
    });
  }
};

const sendCommand = (command: string) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('WebSocket not connected');
    toast({
      title: "Command Failed",
      description: "Not connected to ESP32",
      variant: "destructive"
    });
    return;
  }

  try {
    const message = JSON.stringify({
      type: 'command',
      command: command
    });
    
    console.log('Sending command:', message);
    ws.send(message);
    lastActivity = Date.now();
  } catch (error) {
    console.error('Error sending command:', error);
    if (ws) {
      ws.close();
      ws = null;
    }
    
    toast({
      title: "Command Failed",
      description: "Failed to send command to ESP32",
      variant: "destructive"
    });
  }
};

export const toggleSystem = () => {
  sendCommand('toggleSystem');
};

export const toggleMotor = () => {
  sendCommand('toggleMotor');
};

export const stopAll = () => {
  sendCommand('stopAll');
};

// Clean up function for unmounting
export const cleanup = () => {
  if (ws) {
    ws.close();
    ws = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  statusCallback = null;
  connectionCallback = null;
};
