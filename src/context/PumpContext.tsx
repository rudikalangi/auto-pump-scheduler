import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';
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
  stopAll: () => void;
  
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
  
  // Connect/Disconnect WebSocket
  const connect = () => {
    if (ws) {
      ws.close();
    }

    const newWs = new WebSocket(`ws://${ipAddress}/ws`);
    
    newWs.onopen = () => {
      setIsConnected(true);
      addLogEntry('Connection', `Connected to ESP32 at ${ipAddress}`, 'success');
      toast.success(`Connected to ESP32 at ${ipAddress}`);
    };
    
    newWs.onclose = () => {
      setIsConnected(false);
      setSystemOn(false);
      setMotorRunning(false);
      setRelayOn(false);
      addLogEntry('Connection', `Disconnected from ESP32 at ${ipAddress}`, 'info');
      toast.info('Disconnected from ESP32');
    };
    
    newWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setSystemOn(data.systemOn);
      setMotorRunning(data.motorRunning);
    };
    
    setWs(newWs);
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
      toast.error('Not connected to ESP32');
      return;
    }
    
    // Toggle system state
    const newSystemState = !systemOn;
    setSystemOn(newSystemState);
    
    // Send command to ESP32
    ws.send(JSON.stringify({ 
      command: newSystemState ? 'system_on' : 'system_off',
      relay: 1,
      state: newSystemState
    }));
    
    addLogEntry('System', newSystemState ? 'System turned ON' : 'System turned OFF', 'info');
    toast.success(newSystemState ? 'System turned ON' : 'System turned OFF');
  };
  
  const startMotor = () => {
    if (!isConnected || !ws) {
      toast.error('Not connected to ESP32');
      return;
    }
    
    if (!systemOn) {
      toast.error('System power is OFF');
      return;
    }
    
    // Start motor by activating Relay 2
    ws.send(JSON.stringify({ 
      command: 'start_motor',
      relay: 2,
      state: true
    }));
    
    setMotorRunning(true);
    setRelayOn(true);
    addLogEntry('Motor', 'Starting motor', 'info');
    toast.success('Starting motor');
    
    // After 2 seconds, turn off Relay 2 but keep system on
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
          command: 'motor_off',
          relay: 2,
          state: false
        }));
      }
      setRelayOn(false);
      setMotorRunning(false);
    }, 2000);
  };
  
  const stopAll = () => {
    if (!isConnected || !ws) {
      toast.error('Not connected to ESP32');
      return;
    }
    
    // Stop everything
    ws.send(JSON.stringify({ 
      command: 'stop_all',
      relay1: false,
      relay2: false
    }));
    
    setSystemOn(false);
    setMotorRunning(false);
    setRelayOn(false);
    
    addLogEntry('System', 'Emergency stop - all systems OFF', 'warning');
    toast.success('Emergency stop - all systems OFF');
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
              command: 'system_on',
              relay: 1,
              state: true
            }));
            setSystemOn(true);
            addLogEntry('Schedule', `Starting scheduled pump operation at ${schedule.startTime}`, 'info');
            toast.success(`Schedule: Starting pump operation`);

            // Wait 1 second to ensure system is on, then start motor
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                // Start motor (Relay 2)
                ws.send(JSON.stringify({ 
                  command: 'start_motor',
                  relay: 2,
                  state: true
                }));
                setMotorRunning(true);
                setRelayOn(true);

                // Turn off motor after 2 seconds but keep system on
                setTimeout(() => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ 
                      command: 'motor_off',
                      relay: 2,
                      state: false
                    }));
                    setRelayOn(false);
                    setMotorRunning(false);
                  }
                }, 2000);
              }
            }, 1000);
          }
        }

        // Check end time
        if (currentTime === schedule.endTime) {
          // Turn off everything at end time
          if (systemOn) {
            ws.send(JSON.stringify({ 
              command: 'stop_all',
              relay1: false,
              relay2: false
            }));
            setSystemOn(false);
            setMotorRunning(false);
            setRelayOn(false);
            addLogEntry('Schedule', `Completed scheduled pump operation at ${schedule.endTime}`, 'info');
            toast.success(`Schedule: Completed pump operation`);
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
    toast.success('Schedule added');
  };
  
  const updateSchedule = (schedule: Schedule) => {
    setSchedules(prev =>
      prev.map(s => (s.id === schedule.id ? schedule : s))
    );
    addLogEntry('Schedule', `Schedule updated: ${schedule.startTime} - ${schedule.endTime}`, 'info');
    toast.success('Schedule updated');
  };
  
  const deleteSchedule = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
    addLogEntry('Schedule', 'Schedule deleted', 'info');
    toast.success('Schedule deleted');
  };
  
  const clearLogs = () => {
    setLogs([]);
    addLogEntry('Logs', 'All logs cleared', 'info');
    toast.success('Logs cleared');
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
    stopAll,
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
