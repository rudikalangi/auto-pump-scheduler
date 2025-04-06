import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Schedule, SystemStatus, MoistureData } from '@/types';
import { toast } from '@/components/ui/use-toast';

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
  schedules: Schedule[];
  addSchedule: (schedule: Omit<Schedule, 'id' | 'createdAt'>) => void;
  updateSchedule: (id: string, updates: Partial<Schedule>) => void;
  deleteSchedule: (id: string) => void;
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
  const [schedules, setSchedules] = useState<Schedule[]>(() => {
    const saved = localStorage.getItem('schedules');
    return saved ? JSON.parse(saved) : [];
  });

  const ws = useRef<WebSocket | null>(null);
  const scheduleTimers = useRef<{ [key: string]: { start: NodeJS.Timeout; end: NodeJS.Timeout } }>({});

  // Save schedules to localStorage
  useEffect(() => {
    localStorage.setItem('schedules', JSON.stringify(schedules));
  }, [schedules]);

  // Schedule management
  const addSchedule = useCallback((schedule: Omit<Schedule, 'id' | 'createdAt'>) => {
    const newSchedule: Schedule = {
      ...schedule,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    setSchedules(prev => [...prev, newSchedule]);
  }, []);

  const updateSchedule = useCallback((id: string, updates: Partial<Schedule>) => {
    setSchedules(prev => prev.map(schedule => 
      schedule.id === id ? { ...schedule, ...updates } : schedule
    ));
  }, []);

  const deleteSchedule = useCallback((id: string) => {
    if (scheduleTimers.current[id]) {
      clearTimeout(scheduleTimers.current[id].start);
      clearTimeout(scheduleTimers.current[id].end);
      delete scheduleTimers.current[id];
    }
    setSchedules(prev => prev.filter(s => s.id !== id));
  }, []);

  // WebSocket message sender with retry
  const sendMessage = useCallback((message: any) => {
    if (!ws.current) {
      console.error('WebSocket not initialized');
      toast({
        title: "Connection Error",
        description: "Not connected to ESP32",
        variant: "destructive"
      });
      return Promise.reject(new Error('WebSocket not initialized'));
    }

    return new Promise<void>((resolve, reject) => {
      const maxRetries = 3;
      let retryCount = 0;

      const tryToSend = () => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          try {
            const messageStr = JSON.stringify(message);
            console.log('Sending message:', messageStr);
            ws.current.send(messageStr);
            resolve();
          } catch (error) {
            console.error('Error sending message:', error);
            reject(error);
            toast({
              title: "Error",
              description: "Failed to send command",
              variant: "destructive"
            });
          }
        } else if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying send (${retryCount}/${maxRetries})...`);
          setTimeout(tryToSend, 100); // Retry after 100ms
        } else {
          const error = new Error('WebSocket not ready after retries');
          console.error(error);
          reject(error);
          toast({
            title: "Connection Error",
            description: "WebSocket not ready",
            variant: "destructive"
          });
        }
      };

      tryToSend();
    });
  }, []);

  // Control functions with Promise return
  const toggleSystem = useCallback(async () => {
    console.log('Toggle system requested');
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to ESP32",
        variant: "destructive"
      });
      return Promise.reject(new Error('Not connected'));
    }
    return sendMessage({ type: 'command', command: 'toggleSystem' });
  }, [isConnected, sendMessage]);

  const startMotor = useCallback(async () => {
    console.log('Start motor requested');
    if (!systemOn) {
      toast({
        title: "Error",
        description: "System must be ON to start motor",
        variant: "destructive"
      });
      return Promise.reject(new Error('System is off'));
    }
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to ESP32",
        variant: "destructive"
      });
      return Promise.reject(new Error('Not connected'));
    }
    return sendMessage({ type: 'command', command: 'toggleMotor' });
  }, [systemOn, isConnected, sendMessage]);

  const stopMotor = useCallback(async () => {
    console.log('Stop motor requested');
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to ESP32",
        variant: "destructive"
      });
      return Promise.reject(new Error('Not connected'));
    }
    return sendMessage({ type: 'command', command: 'toggleMotor' });
  }, [isConnected, sendMessage]);

  const stopAll = useCallback(async () => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to ESP32",
        variant: "destructive"
      });
      return Promise.reject(new Error('Not connected'));
    }
    return sendMessage({ type: 'command', command: 'stopAll' });
  }, [isConnected, sendMessage]);

  // Schedule execution
  const executeSchedule = useCallback(async (schedule: Schedule) => {
    if (!isConnected || !schedule.enabled) return;

    try {
      console.log(`Executing schedule: ${schedule.name}`);
      
      // Get current time
      const now = new Date();
      const currentTime = now.toTimeString().substring(0, 5); // HH:mm
      
      // Check if we should turn system on or off
      if (currentTime === schedule.startTime) {
        console.log('Turning system ON per schedule');
        await sendMessage({
          type: 'command',
          command: 'setSystemState',
          state: true
        });
        
        // Turn on motor with 2-second timer
        await new Promise(resolve => setTimeout(resolve, 1000));
        await sendMessage({
          type: 'command',
          command: 'setMotorState',
          state: true
        });

        toast({
          title: "Schedule Started",
          description: `System turned ON for schedule: ${schedule.name}`
        });
      }
      else if (currentTime === schedule.endTime) {
        console.log('Turning system OFF per schedule');
        await sendMessage({
          type: 'command',
          command: 'setSystemState',
          state: false
        });

        toast({
          title: "Schedule Ended",
          description: `System turned OFF for schedule: ${schedule.name}`
        });
      }
    } catch (error) {
      console.error('Failed to execute schedule:', error);
      toast({
        title: "Schedule Failed",
        description: `Failed to execute schedule: ${schedule.name}`,
        variant: "destructive"
      });
    }
  }, [isConnected, sendMessage]);

  // Schedule timer setup
  const setupScheduleTimer = useCallback((schedule: Schedule) => {
    if (!schedule.enabled) return;

    const now = new Date();
    const today = now.getDay();

    // Setup start time
    const [startHours, startMinutes] = schedule.startTime.split(':').map(Number);
    const startTime = new Date(now);
    startTime.setHours(startHours, startMinutes, 0, 0);

    // Setup end time
    const [endHours, endMinutes] = schedule.endTime.split(':').map(Number);
    const endTime = new Date(now);
    endTime.setHours(endHours, endMinutes, 0, 0);

    // If times have passed today, schedule for next occurrence
    if (startTime <= now) {
      startTime.setDate(startTime.getDate() + 1);
    }
    if (endTime <= now) {
      endTime.setDate(endTime.getDate() + 1);
    }

    // Calculate delays
    const msUntilStart = startTime.getTime() - now.getTime();
    const msUntilEnd = endTime.getTime() - now.getTime();

    console.log(`Next start of ${schedule.name} in ${msUntilStart / 1000} seconds`);
    console.log(`Next end of ${schedule.name} in ${msUntilEnd / 1000} seconds`);

    // Clear any existing timers
    if (scheduleTimers.current[schedule.id]) {
      clearTimeout(scheduleTimers.current[schedule.id].start);
      clearTimeout(scheduleTimers.current[schedule.id].end);
    }

    // Set start timer
    const startTimer = setTimeout(() => {
      const currentDay = new Date().getDay();
      if (schedule.days.includes(currentDay)) {
        console.log(`Schedule ${schedule.name} start triggered on day ${currentDay}`);
        // Turn system on
        sendMessage({
          type: 'command',
          command: 'setSystemState',
          state: true
        });
        
        // Turn on motor with 2-second timer after system is on
        setTimeout(() => {
          sendMessage({
            type: 'command',
            command: 'setMotorState',
            state: true
          });
        }, 1000);

        toast({
          title: "Jadwal Dimulai",
          description: `Sistem dihidupkan untuk jadwal: ${schedule.name}`
        });
      }
      // Setup next day's timer
      setupScheduleTimer(schedule);
    }, msUntilStart);

    // Set end timer
    const endTimer = setTimeout(() => {
      const currentDay = new Date().getDay();
      if (schedule.days.includes(currentDay)) {
        console.log(`Schedule ${schedule.name} end triggered on day ${currentDay}`);
        // Turn system off
        sendMessage({
          type: 'command',
          command: 'setSystemState',
          state: false
        });

        toast({
          title: "Jadwal Selesai",
          description: `Sistem dimatikan untuk jadwal: ${schedule.name}`
        });
      }
      // Setup next day's timer
      setupScheduleTimer(schedule);
    }, msUntilEnd);

    // Store both timers
    scheduleTimers.current[schedule.id] = {
      start: startTimer,
      end: endTimer
    };
  }, [sendMessage]);

  // Cleanup function for schedule timers
  const cleanupScheduleTimers = useCallback(() => {
    Object.values(scheduleTimers.current).forEach(timers => {
      if (timers.start) clearTimeout(timers.start);
      if (timers.end) clearTimeout(timers.end);
    });
    scheduleTimers.current = {};
  }, []);

  // Setup schedule timers when connected
  useEffect(() => {
    if (isConnected) {
      console.log('Setting up schedule timers...');
      schedules.forEach(schedule => {
        if (schedule.enabled) {
          console.log(`Setting up timer for schedule: ${schedule.name}`);
          setupScheduleTimer(schedule);
        }
      });
    } else {
      console.log('Cleaning up schedule timers...');
      cleanupScheduleTimers();
    }

    return () => {
      cleanupScheduleTimers();
    };
  }, [isConnected, schedules, setupScheduleTimer, cleanupScheduleTimers]);

  // WebSocket connection
  const connectToDevice = useCallback((ip: string) => {
    if (!ip) {
      console.error('No IP address provided');
      return;
    }

    console.log('Attempting to connect to ESP32:', ip);

    // Close existing connection if any
    if (ws.current) {
      console.log('Closing existing connection...');
      ws.current.close();
      ws.current = null;
      setIsConnected(false);
      setSystemOn(false);
      setMotorRunning(false);
    }

    try {
      // Format URL properly for WebSocket connection
      const cleanIp = ip.trim()
        .replace(/^https?:\/\//, '')  // Remove http:// or https://
        .replace(/\/$/, '')           // Remove trailing slash
        .replace(/:\d+$/, '')         // Remove any port number
        .replace(/[^\d.]/g, '');      // Only allow numbers and dots

      const wsUrl = `ws://${cleanIp}:81`;
      console.log('Creating WebSocket connection to:', wsUrl);
      
      const newWs = new WebSocket(wsUrl);
      
      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (newWs.readyState !== WebSocket.OPEN) {
          console.log('Connection timeout');
          newWs.close();
          toast({
            title: "Connection Failed",
            description: "Connection timeout. Please check IP and try again.",
            variant: "destructive"
          });
        }
      }, 5000);

      newWs.onopen = () => {
        console.log('WebSocket connected successfully');
        clearTimeout(connectionTimeout);
        setIsConnected(true);
        localStorage.setItem('esp32_ip', cleanIp);
        
        toast({
          title: "Connected",
          description: "Successfully connected to ESP32"
        });

        // Request initial status
        sendMessage({ type: 'command', command: 'getStatus' });
      };

      newWs.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setSystemOn(false);
        setMotorRunning(false);
        ws.current = null;

        toast({
          title: "Disconnected",
          description: "Lost connection to ESP32",
          variant: "destructive"
        });
      };

      newWs.onerror = (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(connectionTimeout);
        
        toast({
          title: "Connection Error",
          description: "Failed to connect to ESP32. Please check IP and try again.",
          variant: "destructive"
        });
      };

      newWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received WebSocket message:', data);

          if (data.type === 'status') {
            if (data.system !== undefined) setSystemOn(data.system);
            if (data.motor !== undefined) setMotorRunning(data.motor);
            if (data.moisture !== undefined) {
              setRemoteMoisture(data.moisture);
              const now = Date.now();
              setMoistureHistory(prev => {
                const newHistory = [...prev, { timestamp: now, value: data.moisture }];
                const cutoff = now - 60 * 60 * 1000; // 1 hour ago
                return newHistory.filter(point => point.timestamp > cutoff);
              });
            }
            setLastRemoteUpdate(Date.now());
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current = newWs;
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to ESP32",
        variant: "destructive"
      });
    }
  }, [sendMessage]);

  // Auto-connect on mount and request status updates periodically
  useEffect(() => {
    const lastIp = localStorage.getItem('esp32_ip');
    if (lastIp && !isConnected && !ws.current) {
      connectToDevice(lastIp);
    }

    // Request status update every 2 seconds if connected
    const statusInterval = setInterval(() => {
      if (isConnected && ws.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: 'command', command: 'getStatus' });
      }
    }, 2000);

    return () => {
      clearInterval(statusInterval);
    };
  }, [isConnected, connectToDevice, sendMessage]);

  return (
    <PumpContext.Provider
      value={{
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
        schedules,
        addSchedule,
        updateSchedule,
        deleteSchedule,
      }}
    >
      {children}
    </PumpContext.Provider>
  );
};
