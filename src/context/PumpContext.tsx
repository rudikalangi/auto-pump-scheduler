
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
  
  // Pump state
  const [systemOn, setSystemOn] = useState(false);
  const [motorRunning, setMotorRunning] = useState(false);
  
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
  
  // Connect/Disconnect
  const connect = () => {
    // In a real app, this would connect to the ESP32 via websocket
    // For now, we'll simulate it
    setIsConnected(true);
    addLogEntry('Connection', `Connected to ESP32 at ${ipAddress}`, 'success');
    toast.success(`Connected to ESP32 at ${ipAddress}`);
  };
  
  const disconnect = () => {
    setIsConnected(false);
    setSystemOn(false);
    setMotorRunning(false);
    addLogEntry('Connection', `Disconnected from ESP32 at ${ipAddress}`, 'info');
    toast.info('Disconnected from ESP32');
  };
  
  // Pump controls
  const toggleSystem = () => {
    if (!isConnected) {
      toast.error('Not connected to ESP32');
      return;
    }
    
    const newState = !systemOn;
    setSystemOn(newState);
    
    if (!newState) {
      setMotorRunning(false);
    }
    
    addLogEntry(
      'System Power',
      newState ? 'System turned ON' : 'System turned OFF',
      newState ? 'success' : 'info'
    );
    toast(newState ? 'System turned ON' : 'System turned OFF');
  };
  
  const startMotor = () => {
    if (!isConnected) {
      toast.error('Not connected to ESP32');
      return;
    }
    
    if (!systemOn) {
      toast.error('System power is OFF');
      return;
    }
    
    setMotorRunning(true);
    addLogEntry('Motor', 'Motor started', 'success');
    toast.success('Motor started');
  };
  
  const stopAll = () => {
    if (!isConnected) {
      toast.error('Not connected to ESP32');
      return;
    }
    
    setMotorRunning(false);
    setSystemOn(false);
    addLogEntry('Emergency Stop', 'Motor and system power turned OFF', 'warning');
    toast.info('Motor and system power turned OFF');
  };
  
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
