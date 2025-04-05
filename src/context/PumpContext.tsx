import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { v4 as uuidv4 } from 'uuid';

// Konstanta untuk konfigurasi
const MAX_HISTORY_POINTS = 100;
const HEARTBEAT_INTERVAL = 30000; // 30 detik
const RECONNECT_DELAY = 3000; // 3 detik
const MAX_RECONNECT_ATTEMPTS = 5;
const WS_CLOSE_NORMAL = 1000;
const DEFAULT_IP = '10.33.83.130'; // Updated default IP

// Tipe untuk pesan WebSocket
interface WSMessage {
  type: string;
  command?: string;
  data?: any;
  message?: string;
}

// Tipe untuk LogEntry dengan timestamp sebagai number
interface LogEntry {
  id: string;
  timestamp: number;
  category: string;
  message: string;
  type: 'info' | 'warning' | 'error';
}

// Tipe untuk Schedule
interface Schedule {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
  isActive: boolean;
}

interface PumpContextType {
  // Connection
  ipAddress: string;
  setIpAddress: (ip: string) => void;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  
  // Pump State
  systemOn: boolean;
  motorRunning: boolean;
  relayOn: boolean;
  toggleSystem: () => Promise<void>;
  startMotor: () => Promise<void>;
  stopMotor: () => Promise<void>;
  stopAll: () => Promise<void>;
  
  // Remote Sensor Data
  remoteMoisture: number;
  lastRemoteUpdate: number;
  moistureHistory: { timestamp: number; value: number }[];
  
  // Moisture Thresholds
  setMoistureThresholds: (dry: number, wet: number) => Promise<void>;
  
  // Schedules
  schedules: Schedule[];
  addSchedule: (schedule: Omit<Schedule, 'id'>) => void;
  updateSchedule: (schedule: Schedule) => void;
  deleteSchedule: (id: string) => void;
  
  // Logs
  logs: LogEntry[];
  clearLogs: () => void;
}

const PumpContext = createContext<PumpContextType | undefined>(undefined);

export const PumpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast: showToast } = useToast();
  
  // Refs untuk timers dan WebSocket
  const heartbeatTimer = useRef<NodeJS.Timeout>();
  const reconnectTimer = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  
  // State untuk koneksi
  const [ipAddress, setIpAddress] = useState<string>(() => {
    return localStorage.getItem('pumpIpAddress') || DEFAULT_IP;
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  // State untuk pompa
  const [systemOn, setSystemOn] = useState(false);
  const [motorRunning, setMotorRunning] = useState(false);
  const [relayOn, setRelayOn] = useState(false);
  const [remoteMoisture, setRemoteMoisture] = useState(0);
  const [lastRemoteUpdate, setLastRemoteUpdate] = useState(0);
  const [moistureHistory, setMoistureHistory] = useState<{ timestamp: number; value: number }[]>([]);
  
  // State untuk schedule dan logs
  const [schedules, setSchedules] = useState<Schedule[]>(() => {
    const saved = localStorage.getItem('pumpSchedules');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const saved = localStorage.getItem('pumpLogs');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Fungsi untuk menambah log entry
  const addLogEntry = useCallback((category: string, message: string, type: 'info' | 'warning' | 'error') => {
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      category,
      message,
      type
    };
    setLogs(prev => {
      const newLogs = [entry, ...prev].slice(0, 100); // Keep last 100 logs
      localStorage.setItem('pumpLogs', JSON.stringify(newLogs));
      return newLogs;
    });
  }, []);
  
  // Fungsi untuk clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    localStorage.setItem('pumpLogs', '[]');
  }, []);
  
  // Fungsi untuk mengirim pesan WebSocket dengan aman
  const safeSend = useCallback((message: WSMessage): boolean => {
    try {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      addLogEntry('Error', 'Failed to send message to pump controller', 'error');
      return false;
    }
  }, [ws, addLogEntry]);
  
  // Fungsi untuk heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
    }
    
    heartbeatTimer.current = setInterval(() => {
      if (!safeSend({ type: 'ping' })) {
        disconnect();
      }
    }, HEARTBEAT_INTERVAL);
  }, [safeSend]);
  
  // Fungsi untuk disconnect
  const disconnect = useCallback(() => {
    reconnectAttempts.current = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
    
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = undefined;
    }
    
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = undefined;
    }
    
    if (ws) {
      try {
        ws.close(WS_CLOSE_NORMAL, 'Manual disconnect');
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
    }
    
    wsRef.current = null;
    setWs(null);
    setIsConnected(false);
    setIsConnecting(false);
    setSystemOn(false);
    setMotorRunning(false);
    setRelayOn(false);
    
    addLogEntry('Connection', 'Manually disconnected', 'info');
  }, [ws, addLogEntry]);
  
  // Fungsi untuk connect
  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return;
    
    try {
      setIsConnecting(true);
      
      if (wsRef.current) {
        wsRef.current.close(WS_CLOSE_NORMAL);
      }
      
      const newWs = new WebSocket(`ws://${ipAddress}/ws`);
      
      newWs.onopen = () => {
        console.log('Connected to ESP32');
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttempts.current = 0;
        
        // Send initial ping
        newWs.send(JSON.stringify({ command: 'ping' }));
        
        // Start heartbeat
        heartbeatTimer.current = setInterval(() => {
          if (newWs.readyState === WebSocket.OPEN) {
            newWs.send(JSON.stringify({ command: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL);
        
        showToast({
          title: "Connected",
          description: `Successfully connected to ESP32 at ${ipAddress}`,
        });
      };
      
      newWs.onclose = () => {
        console.log('Disconnected from ESP32');
        setIsConnected(false);
        setIsConnecting(false);
        
        // Clear heartbeat timer
        if (heartbeatTimer.current) {
          clearInterval(heartbeatTimer.current);
        }
        
        // Attempt reconnect if not manually closed
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current++;
          reconnectTimer.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
          
          showToast({
            title: "Disconnected",
            description: `Lost connection to ESP32. Attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS}...`,
            variant: "destructive"
          });
        }
      };
      
      newWs.onerror = (error) => {
        console.error('WebSocket error:', error);
        showToast({
          title: "Connection Error",
          description: "Failed to connect to ESP32",
          variant: "destructive"
        });
      };
      
      newWs.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          console.log('Received message:', message);
          
          switch (message.type) {
            case 'pong':
              console.log('Received pong');
              break;
              
            case 'status':
              if (message.data) {
                setSystemOn(message.data.system_power);
                setMotorRunning(message.data.motor);
                setRemoteMoisture(message.data.moisture || 0);
                setLastRemoteUpdate(Date.now());
              }
              break;
              
            case 'error':
              showToast({
                title: "Error",
                description: message.message || "Unknown error occurred",
                variant: "destructive"
              });
              break;
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };
      
      wsRef.current = newWs;
      setWs(newWs);
      
    } catch (error) {
      console.error('Connection error:', error);
      setIsConnecting(false);
      showToast({
        title: "Connection Error",
        description: "Failed to establish connection",
        variant: "destructive"
      });
    }
  }, [ipAddress, isConnecting, isConnected, showToast]);
  
  // Effect untuk cleanup
  useEffect(() => {
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
      }
      if (ws) {
        try {
          ws.close(WS_CLOSE_NORMAL);
        } catch (error) {
          console.error('Error closing WebSocket on cleanup:', error);
        }
      }
      wsRef.current = null;
    };
  }, [ws]);
  
  // Effect untuk menyimpan schedules
  useEffect(() => {
    localStorage.setItem('pumpSchedules', JSON.stringify(schedules));
  }, [schedules]);
  
  // Effect untuk menyimpan IP address
  useEffect(() => {
    localStorage.setItem('pumpIpAddress', ipAddress);
  }, [ipAddress]);
  
  // Pump control functions
  const toggleSystem = useCallback(async () => {
    if (!isConnected || !ws) {
      showToast({
        variant: "destructive",
        title: "Error",
        description: "Not connected to ESP32"
      });
      return;
    }
    
    try {
      const newSystemState = !systemOn;
      if (!safeSend({ 
        type: 'command',
        command: newSystemState ? 'system_on' : 'system_off'
      })) {
        throw new Error('Failed to send command');
      }
      
      setSystemOn(newSystemState);
      addLogEntry('System', newSystemState ? 'System turned ON' : 'System turned OFF', 'info');
      showToast({
        title: 'System Status',
        description: newSystemState ? 'System turned ON' : 'System turned OFF',
      });
    } catch (error) {
      console.error('Failed to toggle system:', error);
      addLogEntry('Error', 'Failed to toggle system', 'error');
      showToast({
        variant: "destructive",
        title: "Error",
        description: "Failed to toggle system"
      });
    }
  }, [isConnected, ws, systemOn, safeSend, addLogEntry, showToast]);
  
  const startMotor = useCallback(async () => {
    if (!isConnected || !ws) {
      showToast({
        variant: "destructive",
        title: "Error",
        description: "Not connected to ESP32"
      });
      return;
    }
    
    if (!systemOn) {
      showToast({
        variant: "destructive",
        title: "Error",
        description: "System power is OFF"
      });
      return;
    }
    
    try {
      if (!safeSend({ 
        type: 'command',
        command: 'start_motor'
      })) {
        throw new Error('Failed to send command');
      }
      
      setMotorRunning(true);
      setRelayOn(true);
      addLogEntry('Motor', 'Starting motor...', 'info');
      showToast({
        title: 'Motor Status',
        description: 'Starting motor...',
      });

      // Update UI after 2 seconds
      setTimeout(() => {
        setRelayOn(false);
        addLogEntry('Motor', 'Motor started, starter relay off', 'info');
      }, 2000);
    } catch (error) {
      console.error('Failed to start motor:', error);
      addLogEntry('Error', 'Failed to start motor', 'error');
      showToast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start motor"
      });
    }
  }, [isConnected, ws, systemOn, safeSend, addLogEntry, showToast]);
  
  const stopMotor = useCallback(async () => {
    if (!isConnected || !ws) {
      showToast({
        variant: "destructive",
        title: "Error",
        description: "Not connected to ESP32"
      });
      return;
    }
    
    try {
      if (!safeSend({ 
        type: 'command',
        command: 'motor_off'
      })) {
        throw new Error('Failed to send command');
      }
      
      setMotorRunning(false);
      setRelayOn(false);
      addLogEntry('Motor', 'Motor stopped', 'info');
      showToast({
        title: 'Motor Status',
        description: 'Motor stopped',
      });
    } catch (error) {
      console.error('Failed to stop motor:', error);
      addLogEntry('Error', 'Failed to stop motor', 'error');
      showToast({
        variant: "destructive",
        title: "Error",
        description: "Failed to stop motor"
      });
    }
  }, [isConnected, ws, safeSend, addLogEntry, showToast]);
  
  const stopAll = useCallback(async () => {
    if (!isConnected || !ws) {
      showToast({
        variant: "destructive",
        title: "Error",
        description: "Not connected to ESP32"
      });
      return;
    }
    
    try {
      if (!safeSend({ 
        type: 'command',
        command: 'stop_all'
      })) {
        throw new Error('Failed to send command');
      }
      
      setSystemOn(false);
      setMotorRunning(false);
      setRelayOn(false);
      addLogEntry('System', 'Emergency stop - all systems OFF', 'warning');
      showToast({
        variant: "destructive",
        title: 'Emergency Stop',
        description: 'All systems turned OFF',
      });
    } catch (error) {
      console.error('Failed to execute emergency stop:', error);
      addLogEntry('Error', 'Failed to execute emergency stop', 'error');
      showToast({
        variant: "destructive",
        title: "Error",
        description: "Failed to execute emergency stop"
      });
    }
  }, [isConnected, ws, safeSend, addLogEntry, showToast]);
  
  const setMoistureThresholds = useCallback(async (dry: number, wet: number) => {
    if (!ws) {
      addLogEntry('Error', 'Not connected to pump controller', 'error');
      throw new Error('Not connected to pump controller');
    }
    
    try {
      if (!safeSend({
        type: 'command',
        command: 'set_thresholds',
        data: {
          dryThreshold: dry,
          wetThreshold: wet
        }
      })) {
        throw new Error('Failed to send thresholds');
      }
      
      addLogEntry(
        'Settings',
        `Updated moisture thresholds - Dry: ${dry}%, Wet: ${wet}%`,
        'info'
      );
      
      showToast({
        title: 'Settings Updated',
        description: `Moisture thresholds updated - Dry: ${dry}%, Wet: ${wet}%`
      });
    } catch (error) {
      console.error('Failed to set thresholds:', error);
      addLogEntry('Error', 'Failed to set moisture thresholds', 'error');
      throw error;
    }
  }, [ws, safeSend, addLogEntry, showToast]);
  
  // Schedule management functions
  const addSchedule = useCallback((schedule: Omit<Schedule, 'id'>) => {
    const newSchedule: Schedule = {
      ...schedule,
      id: uuidv4()
    };
    setSchedules(prev => [...prev, newSchedule]);
    addLogEntry('Schedule', `Added new schedule: ${schedule.name}`, 'info');
  }, [addLogEntry]);
  
  const updateSchedule = useCallback((schedule: Schedule) => {
    setSchedules(prev => prev.map(s => s.id === schedule.id ? schedule : s));
    addLogEntry('Schedule', `Updated schedule: ${schedule.name}`, 'info');
  }, [addLogEntry]);
  
  const deleteSchedule = useCallback((id: string) => {
    setSchedules(prev => {
      const schedule = prev.find(s => s.id === id);
      if (schedule) {
        addLogEntry('Schedule', `Deleted schedule: ${schedule.name}`, 'info');
      }
      return prev.filter(s => s.id !== id);
    });
  }, [addLogEntry]);

  // Context value
  const value: PumpContextType = {
    ipAddress,
    setIpAddress,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    systemOn,
    motorRunning,
    relayOn,
    toggleSystem,
    startMotor,
    stopMotor,
    stopAll,
    remoteMoisture,
    lastRemoteUpdate,
    moistureHistory,
    setMoistureThresholds,
    schedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    logs,
    clearLogs
  };
  
  return (
    <PumpContext.Provider value={value}>
      {children}
    </PumpContext.Provider>
  );
};

// Export hook untuk menggunakan PumpContext
export const usePump = () => {
  const context = useContext(PumpContext);
  if (context === undefined) {
    throw new Error('usePump must be used within a PumpProvider');
  }
  return context;
};
