import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { connectToEsp32, onStatus, onConnection, toggleSystem as esp32ToggleSystem, toggleMotor as esp32ToggleMotor, stopAll as esp32StopAll } from '@/utils/esp32';
import { toast } from '@/components/ui/use-toast';

interface MoistureData {
  timestamp: number;
  value: number;
}

interface PumpContextType {
  isConnected: boolean;
  systemOn: boolean;
  motorRunning: boolean;
  remoteMoisture: number;
  moistureHistory: MoistureData[];
  lastRemoteUpdate: number | null;
  toggleSystem: () => Promise<void>;
  startMotor: () => Promise<void>;
  stopMotor: () => Promise<void>;
  stopAll: () => Promise<void>;
  connectToDevice: (ip: string) => void;
}

const PumpContext = createContext<PumpContextType | null>(null);

export const usePump = () => {
  const context = useContext(PumpContext);
  if (!context) {
    throw new Error('usePump must be used within a PumpProvider');
  }
  return context;
};

export const PumpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [systemOn, setSystemOn] = useState(false);
  const [motorRunning, setMotorRunning] = useState(false);
  const [remoteMoisture, setRemoteMoisture] = useState(0);
  const [moistureHistory, setMoistureHistory] = useState<MoistureData[]>([]);
  const [lastRemoteUpdate, setLastRemoteUpdate] = useState<number | null>(null);

  const handleStatusUpdate = useCallback((status: any) => {
    console.log('Status update received:', status);
    if (status.system !== undefined) setSystemOn(status.system);
    if (status.motor !== undefined) setMotorRunning(status.motor);
    if (status.moisture !== undefined) {
      setRemoteMoisture(status.moisture);
      const now = Date.now();
      setMoistureHistory(prev => {
        // Keep last 60 minutes of data (60 points with 1 minute interval)
        const newHistory = [...prev, { timestamp: now, value: status.moisture }];
        const cutoff = now - 60 * 60 * 1000; // 1 hour ago
        return newHistory.filter(point => point.timestamp > cutoff);
      });
    }
    setLastRemoteUpdate(Date.now());
  }, []);

  const handleConnectionChange = useCallback((connected: boolean) => {
    console.log('Connection state changed:', connected);
    setIsConnected(connected);
    if (connected) {
      toast({
        title: "Connected",
        description: "Successfully connected to ESP32",
      });
    } else {
      toast({
        title: "Disconnected",
        description: "Lost connection to ESP32",
        variant: "destructive",
      });
      // Reset states when disconnected
      setSystemOn(false);
      setMotorRunning(false);
    }
  }, []);

  useEffect(() => {
    // Register callbacks
    onStatus(handleStatusUpdate);
    onConnection(handleConnectionChange);

    // Try to connect to last known IP
    const lastIp = localStorage.getItem('esp32_ip');
    if (lastIp) {
      connectToDevice(lastIp);
    }

    return () => {
      // Cleanup not needed as callbacks are global
    };
  }, [handleStatusUpdate, handleConnectionChange]);

  const connectToDevice = useCallback((ip: string) => {
    localStorage.setItem('esp32_ip', ip);
    connectToEsp32(ip);
  }, []);

  const toggleSystem = useCallback(async () => {
    try {
      if (!esp32ToggleSystem()) {
        throw new Error('Failed to toggle system');
      }
    } catch (error) {
      console.error('Error toggling system:', error);
      toast({
        title: "Error",
        description: "Failed to toggle system",
        variant: "destructive",
      });
    }
  }, []);

  const startMotor = useCallback(async () => {
    if (!systemOn) {
      toast({
        title: "Error",
        description: "System must be ON to start motor",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!esp32ToggleMotor()) {
        throw new Error('Failed to start motor');
      }
    } catch (error) {
      console.error('Error starting motor:', error);
      toast({
        title: "Error",
        description: "Failed to start motor",
        variant: "destructive",
      });
    }
  }, [systemOn]);

  const stopMotor = useCallback(async () => {
    try {
      if (!esp32ToggleMotor()) {
        throw new Error('Failed to stop motor');
      }
    } catch (error) {
      console.error('Error stopping motor:', error);
      toast({
        title: "Error",
        description: "Failed to stop motor",
        variant: "destructive",
      });
    }
  }, []);

  const stopAll = useCallback(async () => {
    try {
      if (!esp32StopAll()) {
        throw new Error('Failed to stop all');
      }
    } catch (error) {
      console.error('Error stopping all:', error);
      toast({
        title: "Error",
        description: "Failed to stop all systems",
        variant: "destructive",
      });
    }
  }, []);

  const value = {
    isConnected,
    systemOn,
    motorRunning,
    remoteMoisture,
    moistureHistory,
    lastRemoteUpdate,
    toggleSystem,
    startMotor,
    stopMotor,
    stopAll,
    connectToDevice,
  };

  return (
    <PumpContext.Provider value={value}>
      {children}
    </PumpContext.Provider>
  );
};
