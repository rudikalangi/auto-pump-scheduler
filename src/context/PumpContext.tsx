import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Toast } from "@/components/ui/toast";
import { LogEntry } from '@/components/LogItem';
import { Schedule } from '@/components/ScheduleItem';
import { v4 as uuidv4 } from 'uuid';

interface PumpContextType {
  // Connection
  ipAddress: string;
  setIpAddress: (ip: string) => void;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  
  // Pump State
  systemOn: boolean;
  motorRunning: boolean;
  relayOn: boolean;
  toggleSystem: () => void;
  startMotor: () => void;
  stopMotor: () => void;
  stopAll: () => void;
  
  // Remote Sensor Data
  remoteMoisture: number;
  lastRemoteUpdate: number;
  moistureHistory: { timestamp: number; value: number }[];
  
  // Moisture Thresholds
  setMoistureThresholds: (dry: number, wet: number) => void;
  
  // Schedules
  schedules: Schedule[];
  addSchedule: (schedule: Omit<Schedule, 'id'>) => void;
  updateSchedule: (schedule: Schedule) => void;
  deleteSchedule: (id: string) => void;
  
  // Logs
  logs: LogEntry[];
  clearLogs: () => void;
}

interface ToastMessage {
  title: string;
  description: string;
  variant?: "default" | "destructive";
}

const PumpContext = createContext<PumpContextType | undefined>(undefined);

export const PumpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  
  // Connection state
  const [ipAddress, setIpAddress] = useState<string>(() => {
    const saved = localStorage.getItem('pumpIpAddress');
    return saved || '192.168.1.100';
  });
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  // Pump state
  const [systemOn, setSystemOn] = useState(false);
  const [motorRunning, setMotorRunning] = useState(false);
  const [relayOn, setRelayOn] = useState(false);
  
  // Remote sensor state
  const [remoteMoisture, setRemoteMoisture] = useState(0);
  const [lastRemoteUpdate, setLastRemoteUpdate] = useState(0);
  const [moistureHistory, setMoistureHistory] = useState<{ timestamp: number; value: number }[]>([]);
  
  // Schedules
  const [schedules, setSchedules] = useState<Schedule[]>(() => {
    const saved = localStorage.getItem('pumpSchedules');
    return saved ? JSON.parse(saved) : [
      {
        id: uuidv4(),
        startTime: '08:00',
        endTime: '08:30',
        days: ['monday', 'wednesday', 'friday'],
        isActive: true
      }
    ];
  });
  
  // Logs
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const saved = localStorage.getItem('pumpLogs');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem('pumpIpAddress', ipAddress);
  }, [ipAddress]);
  
  useEffect(() => {
    localStorage.setItem('pumpSchedules', JSON.stringify(schedules));
  }, [schedules]);
  
  useEffect(() => {
    localStorage.setItem('pumpLogs', JSON.stringify(logs));
  }, [logs]);
  
  // Add log entry
  const addLogEntry = (action: string, details: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      action,
      details,
      type,
    };
    
    setLogs(prevLogs => [newLog, ...prevLogs.slice(0, 99)]); // Keep last 100 logs
    return newLog;
  };
  
  const showToast = (message: ToastMessage) => {
    toast({
      ...message
    });
  };

  // WebSocket message handler
  const handleWebSocketMessage = (data: any) => {
    try {
      // Handle system state updates
      if (data.systemOn !== undefined) {
        setSystemOn(data.systemOn);
      }
      if (data.motorRunning !== undefined) {
        setMotorRunning(data.motorRunning);
      }
      if (data.remoteMoisture !== undefined) {
        setRemoteMoisture(data.remoteMoisture);
        setLastRemoteUpdate(Date.now());
        
        // Add to history
        setMoistureHistory(prev => {
          const newPoint = {
            timestamp: Date.now(),
            value: data.remoteMoisture
          };
          // Keep last 50 points
          const history = [...prev, newPoint].slice(-50);
          return history;
        });
      }
      
      // Handle threshold update responses
      if (data.success && data.message === "Thresholds updated") {
        showToast({
          title: "Success",
          description: "Moisture thresholds updated successfully"
        });
      }
      
      // Handle errors
      if (data.error) {
        showToast({
          variant: "destructive",
          title: "Error",
          description: data.error
        });
      }
      
    } catch (error) {
      console.error('Failed to process WebSocket message:', error);
      showToast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process server message"
      });
    }
  };

  // WebSocket connection effect
  useEffect(() => {
    if (!ipAddress) return;

    const wsUrl = `ws://${ipAddress}`;  // Menggunakan port default 80
    let reconnectTimer: NodeJS.Timeout;
    let connectionAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 10;  // Menambah jumlah percobaan
    const RECONNECT_DELAY = 2000;      // Mengurangi delay reconnect

    const connectWebSocket = () => {
      console.log(`Attempting to connect to ${wsUrl}`);
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        connectionAttempts = 0;
        showToast({
          title: "Connected",
          description: `Connected to pump controller at ${ipAddress}`
        });
      };

      socket.onclose = (event) => {
        console.log('WebSocket connection closed:', event);
        setIsConnected(false);
        setSystemOn(false);
        setMotorRunning(false);
        
        if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
          connectionAttempts++;
          showToast({
            variant: "destructive",
            title: "Connection Lost",
            description: `Attempting to reconnect (${connectionAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
          });
          reconnectTimer = setTimeout(connectWebSocket, RECONNECT_DELAY);
        } else {
          showToast({
            variant: "destructive",
            title: "Connection Failed",
            description: "Maximum reconnection attempts reached. Please check:\n1. ESP32 is powered on\n2. Connected to same network\n3. IP address is correct"
          });
        }
      };

      socket.onmessage = (event) => {
        try {
          console.log('Received WebSocket message:', event.data);
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          showToast({
            variant: "destructive",
            title: "Error",
            description: "Failed to parse server message"
          });
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        showToast({
          variant: "destructive",
          title: "Connection Error",
          description: "Failed to connect. Please check network settings and ESP32 status."
        });
      };

      setWs(socket);
    };

    connectWebSocket();

    return () => {
      console.log('Cleaning up WebSocket connection');
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (ws?.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [ipAddress]);
  
  // Connect/Disconnect WebSocket
  const connect = () => {
    if (ws) {
      ws.close();
    }
  };
  
  const disconnect = () => {
    if (ws) {
      ws.close();
    }
    setWs(null);
  };
  
  // Pump controls with WebSocket
  const toggleSystem = () => {
    if (!isConnected || !ws) {
      showToast({
        variant: "destructive",
        title: "Error",
        description: "Not connected to ESP32"
      });
      return;
    }
    
    // Toggle system state
    const newSystemState = !systemOn;
    
    // Send command to ESP32
    ws.send(JSON.stringify({ 
      command: newSystemState ? 'system_on' : 'system_off'
    }));
    
    addLogEntry('System', newSystemState ? 'System turned ON' : 'System turned OFF', 'info');
    showToast({
      title: newSystemState ? 'System turned ON' : 'System turned OFF',
      description: newSystemState ? 'System turned ON' : 'System turned OFF',
    });
  };
  
  const startMotor = () => {
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
    
    // Start motor by activating Relay 2
    ws.send(JSON.stringify({ 
      command: 'start_motor'
    }));
    
    setMotorRunning(true);
    addLogEntry('Motor', 'Starting motor...', 'info');
    showToast({
      title: 'Starting motor...',
      description: 'Starting motor...',
    });

    // Update UI after 2 seconds
    setTimeout(() => {
      setMotorRunning(false);
      addLogEntry('Motor', 'Motor started, starter off', 'info');
    }, 2000);
  };
  
  const stopMotor = () => {
    if (!isConnected || !ws) {
      showToast({
        variant: "destructive",
        title: "Error",
        description: "Not connected to ESP32"
      });
      return;
    }
    
    ws.send(JSON.stringify({ 
      command: 'motor_off'
    }));
    
    addLogEntry('Motor', 'Stopping motor', 'info');
    showToast({
      title: 'Motor stopped',
      description: 'Motor stopped',
    });
  };
  
  const stopAll = () => {
    if (!isConnected || !ws) {
      showToast({
        variant: "destructive",
        title: "Error",
        description: "Not connected to ESP32"
      });
      return;
    }
    
    // Stop everything
    ws.send(JSON.stringify({ 
      command: 'stop_all'
    }));
    
    addLogEntry('System', 'Emergency stop - all systems OFF', 'warning');
    showToast({
      title: 'Emergency stop - all systems OFF',
      description: 'Emergency stop - all systems OFF',
    });
  };
  
  // Fungsi untuk mengatur threshold kelembaban
  const setMoistureThresholds = async (dry: number, wet: number) => {
    if (!ws) {
      addLogEntry('Error', 'Not connected to pump controller', 'error');
      return;
    }
    
    try {
      const message = {
        command: 'set_thresholds',
        dryThreshold: dry,
        wetThreshold: wet
      };
      
      // Kirim perintah ke ESP32
      ws.send(JSON.stringify(message));
      
      // Tambah log entry
      addLogEntry(
        'Settings',
        `Updating moisture thresholds - Dry: ${dry}%, Wet: ${wet}%`,
        'info'
      );
      
    } catch (error) {
      console.error('Failed to set thresholds:', error);
      addLogEntry('Error', 'Failed to set moisture thresholds', 'error');
    }
  };
  
  // Scheduler Effect
  useEffect(() => {
    if (!isConnected || !ws) return;

    const checkSchedule = () => {
      const now = new Date();
      const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      schedules.forEach(schedule => {
        if (!schedule.isActive) return;
        if (!schedule.days.includes(currentDay)) return;

        // Check start time
        if (currentTime === schedule.startTime) {
          // First turn on system power (Relay 1)
          if (!systemOn) {
            ws.send(JSON.stringify({ 
              command: 'system_on'
            }));
            setSystemOn(true);
            addLogEntry('Schedule', `Starting scheduled pump operation at ${schedule.startTime}`, 'info');
            showToast({
              title: `Schedule: Starting pump operation`,
              description: `Schedule: Starting pump operation`,
            });
          }

          // Wait 1 second to ensure system is on, then start motor
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              // Start motor (Relay 2)
              ws.send(JSON.stringify({ 
                command: 'start_motor'
              }));
              setMotorRunning(true);
              setRelayOn(true);
            }
          }, 1000);
        }

        // Check end time
        if (currentTime === schedule.endTime) {
          // Turn off everything at end time
          if (systemOn) {
            ws.send(JSON.stringify({ 
              command: 'stop_all'
            }));
            setSystemOn(false);
            setMotorRunning(false);
            setRelayOn(false);
            addLogEntry('Schedule', `Completed scheduled pump operation at ${schedule.endTime}`, 'info');
            showToast({
              title: `Schedule: Completed pump operation`,
              description: `Schedule: Completed pump operation`,
            });
          }
        }
      });
    };

    // Check schedule every minute
    const intervalId = setInterval(checkSchedule, 60000);
    // Also check immediately on mount or when schedules/connection changes
    checkSchedule();

    return () => clearInterval(intervalId);
  }, [isConnected, ws, schedules, systemOn]);

  // Schedule management
  const addSchedule = (schedule: Omit<Schedule, 'id'>) => {
    const newSchedule: Schedule = {
      ...schedule,
      id: uuidv4(),
    };
    
    setSchedules(prev => [...prev, newSchedule]);
    addLogEntry('Schedule', `New schedule added: ${schedule.startTime} - ${schedule.endTime}`, 'info');
    showToast({
      title: 'Schedule added',
      description: 'Schedule added',
    });
  };
  
  const updateSchedule = (schedule: Schedule) => {
    setSchedules(prev =>
      prev.map(s => (s.id === schedule.id ? schedule : s))
    );
    addLogEntry('Schedule', `Schedule updated: ${schedule.startTime} - ${schedule.endTime}`, 'info');
    showToast({
      title: 'Schedule updated',
      description: 'Schedule updated',
    });
  };
  
  const deleteSchedule = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
    addLogEntry('Schedule', 'Schedule deleted', 'info');
    showToast({
      title: 'Schedule deleted',
      description: 'Schedule deleted',
    });
  };
  
  const clearLogs = () => {
    setLogs([]);
    addLogEntry('Logs', 'All logs cleared', 'info');
    showToast({
      title: 'Logs cleared',
      description: 'Logs cleared',
    });
  };
  
  const contextValue: PumpContextType = {
    ipAddress,
    setIpAddress,
    isConnected,
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
    clearLogs,
  };
  
  return (
    <PumpContext.Provider value={contextValue}>
      {children}
    </PumpContext.Provider>
  );
};

export const usePump = () => {
  const context = useContext(PumpContext);
  if (context === undefined) {
    throw new Error('usePump must be used within a PumpProvider');
  }
  return context;
};
