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
  setMoistureThresholds: (dry: number, wet: number) => Promise<void>;
  moistureThresholds: { dry: number; wet: number };
  autoMode: boolean;
  toggleAutoMode: () => Promise<void>;
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
  const [moistureThresholds, setMoistureThresholds] = useState(() => {
    const saved = localStorage.getItem('moisture_thresholds');
    return saved ? JSON.parse(saved) : { dry: 30, wet: 70 };
  });
  const [autoMode, setAutoMode] = useState(true);

  const ws = useRef<WebSocket | null>(null);
  const scheduleTimers = useRef<{ [key: string]: { start: NodeJS.Timeout; end: NodeJS.Timeout } }>({});

  // Save schedules to localStorage
  useEffect(() => {
    localStorage.setItem('schedules', JSON.stringify(schedules));
  }, [schedules]);

  // Save moisture thresholds to localStorage
  useEffect(() => {
    localStorage.setItem('moisture_thresholds', JSON.stringify(moistureThresholds));
  }, [moistureThresholds]);

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
    return new Promise<void>((resolve, reject) => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        console.error('WebSocket not connected');
        toast({
          title: "Connection Error",
          description: "Not connected to ESP32",
          variant: "destructive"
        });
        return reject(new Error('WebSocket not connected'));
      }

      try {
        console.log('Sending message:', message);
        ws.current.send(JSON.stringify(message));
        resolve();
      } catch (error) {
        console.error('Failed to send message:', error);
        reject(error);
      }
    });
  }, []);

  // Control functions with Promise return
  const toggleSystem = useCallback(async () => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to ESP32",
        variant: "destructive"
      });
      return Promise.reject(new Error('Not connected'));
    }

    try {
      await sendMessage({ type: 'command', command: 'toggleSystem' });
      
      // Wait for confirmation with shorter timeout
      return new Promise<void>((resolve, reject) => {
        const expectedState = !systemOn;
        let attempts = 0;
        const maxAttempts = 10; // Dari 20 ke 10
        
        const checkInterval = setInterval(async () => {
          attempts++;
          try {
            await sendMessage({ type: 'command', command: 'getStatus' });
            
            if (systemOn === expectedState) {
              clearInterval(checkInterval);
              resolve();
            } else if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
              reject(new Error(`System failed to turn ${expectedState ? 'ON' : 'OFF'}`));
            }
          } catch (error) {
            clearInterval(checkInterval);
            reject(error);
          }
        }, 50); // Dari 100ms ke 50ms
      });
    } catch (error) {
      console.error('Toggle system failed:', error);
      throw error;
    }
  }, [isConnected, systemOn, sendMessage]);

  const startMotor = useCallback(async () => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to ESP32",
        variant: "destructive"
      });
      return Promise.reject(new Error('Not connected'));
    }

    if (!systemOn) {
      const error = new Error('System is off');
      toast({
        title: "Error",
        description: "Cannot start motor: System is off",
        variant: "destructive"
      });
      return Promise.reject(error);
    }

    try {
      await sendMessage({ type: 'command', command: 'startMotor' });
      
      // Wait for confirmation with shorter timeout
      return new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 10; // Dari 20 ke 10
        
        const checkInterval = setInterval(async () => {
          attempts++;
          try {
            await sendMessage({ type: 'command', command: 'getStatus' });
            
            if (motorRunning) {
              clearInterval(checkInterval);
              resolve();
            } else if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
              reject(new Error('Motor failed to start'));
            }
          } catch (error) {
            clearInterval(checkInterval);
            reject(error);
          }
        }, 50); // Dari 100ms ke 50ms
      });
    } catch (error) {
      console.error('Start motor failed:', error);
      throw error;
    }
  }, [isConnected, systemOn, motorRunning, sendMessage]);

  const stopMotor = useCallback(async () => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to ESP32",
        variant: "destructive"
      });
      return Promise.reject(new Error('Not connected'));
    }

    try {
      await sendMessage({ type: 'command', command: 'stopMotor' });
      
      // Wait for confirmation with shorter timeout
      return new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 10; // Dari 20 ke 10
        
        const checkInterval = setInterval(async () => {
          attempts++;
          try {
            await sendMessage({ type: 'command', command: 'getStatus' });
            
            if (!motorRunning) {
              clearInterval(checkInterval);
              resolve();
            } else if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
              reject(new Error('Motor failed to stop'));
            }
          } catch (error) {
            clearInterval(checkInterval);
            reject(error);
          }
        }, 50); // Dari 100ms ke 50ms
      });
    } catch (error) {
      console.error('Stop motor failed:', error);
      throw error;
    }
  }, [isConnected, motorRunning, sendMessage]);

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
    if (!isConnected || !schedule.enabled) {
      console.log('Schedule skipped - not connected or disabled');
      return;
    }

    try {
      // Get current time
      const now = new Date();
      const currentTime = now.toTimeString().substring(0, 5); // HH:mm
      console.log(`Checking schedule ${schedule.name} - Current: ${currentTime}, Start: ${schedule.startTime}, End: ${schedule.endTime}`);
      
      if (currentTime === schedule.startTime) {
        console.log(`Starting schedule: ${schedule.name}`);
        try {
          // Kirim command scheduleStart ke ESP32
          console.log('Sending scheduleStart command...');
          await sendMessage({ type: 'command', command: 'scheduleStart' });
          
          // Wait for system ON confirmation
          await new Promise<void>((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 10;
            
            const checkInterval = setInterval(async () => {
              attempts++;
              console.log(`Checking system status... Attempt ${attempts}/${maxAttempts}`);
              try {
                await sendMessage({ type: 'command', command: 'getStatus' });
                
                if (systemOn) {
                  console.log('System ON confirmed');
                  clearInterval(checkInterval);
                  resolve();
                } else if (attempts >= maxAttempts) {
                  console.error('System failed to turn ON');
                  clearInterval(checkInterval);
                  reject(new Error('System failed to turn ON'));
                }
              } catch (error) {
                console.error('Error checking status:', error);
                clearInterval(checkInterval);
                reject(error);
              }
            }, 500); // Check every 500ms
          });

          toast({
            title: "Schedule Started",
            description: `System and motor started for schedule: ${schedule.name}`
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Schedule start error:', errorMessage);
          toast({
            title: "Schedule Failed",
            description: `Failed to start schedule: ${errorMessage}`,
            variant: "destructive"
          });
          throw error;
        }
      } else if (currentTime === schedule.endTime) {
        console.log(`Ending schedule: ${schedule.name}`);
        try {
          // Kirim command scheduleEnd ke ESP32
          console.log('Sending scheduleEnd command...');
          await sendMessage({ type: 'command', command: 'scheduleEnd' });
          toast({
            title: "Schedule Ended",
            description: `System stopped for schedule: ${schedule.name}`
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Schedule end error:', errorMessage);
          toast({
            title: "Schedule Failed",
            description: `Failed to end schedule: ${errorMessage}`,
            variant: "destructive"
          });
          throw error;
        }
      }
    } catch (error) {
      console.error('Error executing schedule:', error);
    }
  }, [isConnected, sendMessage, systemOn]);

  // Schedule timer setup
  const setupScheduleTimer = useCallback((schedule: Schedule) => {
    let isStarting = false; // Flag untuk mencegah multiple start
    let hasStarted = false; // Flag untuk track apakah jadwal sudah start hari ini
    
    const timer = setInterval(async () => {
      if (!isConnected || !schedule.enabled) return;

      try {
        const now = new Date();
        const currentTime = now.toTimeString().substring(0, 5); // HH:mm
        
        // Reset hasStarted flag di tengah malam
        if (currentTime === "00:00") {
          hasStarted = false;
        }
        
        if (currentTime === schedule.startTime && !hasStarted && !isStarting) {
          console.log(`Schedule ${schedule.name} start time matched: ${currentTime}`);
          try {
            isStarting = true; // Set flag bahwa kita sedang dalam proses start
            hasStarted = true; // Set flag bahwa jadwal sudah start hari ini
            
            // Kirim command scheduleStart ke ESP32
            console.log('Sending scheduleStart command...');
            await sendMessage({ type: 'command', command: 'scheduleStart' });
            
            // Wait for system ON confirmation
            await new Promise<void>((resolve, reject) => {
              let attempts = 0;
              const maxAttempts = 10;
              
              const checkInterval = setInterval(async () => {
                attempts++;
                console.log(`Checking system status... Attempt ${attempts}/${maxAttempts}`);
                try {
                  await sendMessage({ type: 'command', command: 'getStatus' });
                  
                  if (systemOn) {
                    console.log('System ON confirmed');
                    clearInterval(checkInterval);
                    resolve();
                  } else if (attempts >= maxAttempts) {
                    console.error('System failed to turn ON');
                    clearInterval(checkInterval);
                    reject(new Error('System failed to turn ON'));
                  }
                } catch (error) {
                  console.error('Error checking status:', error);
                  clearInterval(checkInterval);
                  reject(error);
                }
              }, 500);
            });

            toast({
              title: "Schedule Started",
              description: `System and motor started for schedule: ${schedule.name}`
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Schedule start error:', errorMessage);
            toast({
              title: "Schedule Failed",
              description: `Failed to start schedule: ${errorMessage}`,
              variant: "destructive"
            });
          } finally {
            isStarting = false; // Reset flag setelah proses selesai
          }
        } else if (currentTime === schedule.endTime) {
          console.log(`Schedule ${schedule.name} end time matched: ${currentTime}`);
          try {
            // Kirim command scheduleEnd ke ESP32
            console.log('Sending scheduleEnd command...');
            await sendMessage({ type: 'command', command: 'scheduleEnd' });
            toast({
              title: "Schedule Ended",
              description: `System stopped for schedule: ${schedule.name}`
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Schedule end error:', errorMessage);
            toast({
              title: "Schedule Failed",
              description: `Failed to end schedule: ${errorMessage}`,
              variant: "destructive"
            });
          }
        }
      } catch (error) {
        console.error('Error in schedule timer:', error);
      }
    }, 1000); // Check every second

    return () => clearInterval(timer);
  }, [isConnected, sendMessage, systemOn]);

  // Setup schedule timers
  useEffect(() => {
    console.log('Setting up schedule timers...');
    const timers = schedules
      .filter(schedule => schedule.enabled)
      .map(schedule => {
        console.log(`Setting up timer for schedule: ${schedule.name}`);
        return setupScheduleTimer(schedule);
      });

    return () => {
      console.log('Cleaning up schedule timers...');
      timers.forEach(cleanup => cleanup());
    };
  }, [schedules, setupScheduleTimer]);

  // Update moisture thresholds
  const updateMoistureThresholds = useCallback(async (dry: number, wet: number) => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to ESP32",
        variant: "destructive"
      });
      return Promise.reject(new Error('Not connected'));
    }

    try {
      await sendMessage({ type: 'command', command: 'setMoistureThresholds', dry, wet });
      setMoistureThresholds({ dry, wet });
      localStorage.setItem('moisture_thresholds', JSON.stringify({ dry, wet }));
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to update thresholds:', error);
      return Promise.reject(error);
    }
  }, [isConnected, sendMessage]);

  // Toggle auto mode
  const toggleAutoMode = useCallback(async () => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to ESP32",
        variant: "destructive"
      });
      return Promise.reject(new Error('Not connected'));
    }
    try {
      await sendMessage({ type: 'command', command: 'toggleAutoMode' });
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to toggle auto mode:', error);
      return Promise.reject(error);
    }
  }, [isConnected, sendMessage]);

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
        handleWebSocketMessage(event);
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

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Received WebSocket message:', data);

      if (data.type === 'status') {
        // Update system status
        if (data.system !== undefined) {
          console.log('System status:', data.system ? 'ON' : 'OFF');
          setSystemOn(data.system);
        }
        
        // Update motor status with starting state
        if (data.motor !== undefined || data.starting !== undefined) {
          const isRunning = data.motor || false;
          const isStarting = data.starting || false;
          console.log('Motor status:', isRunning ? 'RUNNING' : (isStarting ? 'STARTING' : 'OFF'));
          setMotorRunning(isRunning);
        }
        
        // Update moisture data
        if (data.moisture !== undefined) {
          setRemoteMoisture(data.moisture);
          const now = Date.now();
          setMoistureHistory(prev => {
            const newHistory = [...prev, { timestamp: now, value: data.moisture, isAuto: data.autoMode }];
            const cutoff = now - 60 * 60 * 1000; // 1 hour ago
            return newHistory.filter(point => point.timestamp > cutoff);
          });
        }
        
        // Update auto mode
        if (data.autoMode !== undefined) {
          console.log('Auto mode:', data.autoMode ? 'ON' : 'OFF');
          setAutoMode(data.autoMode);
        }
        
        // Update last remote update timestamp
        setLastRemoteUpdate(Date.now());
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, []);

  // Auto-connect on mount and request status updates periodically
  useEffect(() => {
    const lastIp = localStorage.getItem('esp32_ip');
    if (lastIp && !isConnected && !ws.current) {
      connectToDevice(lastIp);
    }

    // Request status update every 500ms if connected
    const statusInterval = setInterval(() => {
      if (isConnected && ws.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: 'command', command: 'getStatus' });
      }
    }, 500);

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
        setMoistureThresholds: updateMoistureThresholds,
        moistureThresholds,
        autoMode,
        toggleAutoMode,
      }}
    >
      {children}
    </PumpContext.Provider>
  );
};
