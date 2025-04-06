import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Schedule } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { toast } from '@/components/ui/use-toast';
import { usePump } from './PumpContext';

interface ScheduleContextType {
  schedules: Schedule[];
  addSchedule: (schedule: Omit<Schedule, 'id'>) => void;
  updateSchedule: (id: string, schedule: Partial<Schedule>) => void;
  deleteSchedule: (id: string) => void;
  toggleSchedule: (id: string) => void;
  getActiveSchedules: () => Schedule[];
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);

export const useSchedule = () => {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
};

export const ScheduleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [schedules, setSchedules] = useState<Schedule[]>(() => {
    const saved = localStorage.getItem('pump_schedules');
    return saved ? JSON.parse(saved) : [];
  });
  const { systemOn, toggleSystem, startMotor, stopMotor } = usePump();

  // Save schedules to localStorage
  useEffect(() => {
    localStorage.setItem('pump_schedules', JSON.stringify(schedules));
  }, [schedules]);

  // Check and execute schedules every minute
  useEffect(() => {
    const checkSchedules = () => {
      const now = new Date();
      const day = now.getDay();
      const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

      schedules.forEach(schedule => {
        if (schedule.enabled && 
            schedule.days.includes(day) && 
            schedule.startTime === time) {
          executeSchedule(schedule);
        }
      });
    };

    const interval = setInterval(checkSchedules, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [schedules, systemOn]);

  const executeSchedule = async (schedule: Schedule) => {
    try {
      if (!systemOn) {
        await toggleSystem();
      }
      
      await startMotor();
      
      // Stop motor after duration
      setTimeout(async () => {
        await stopMotor();
        
        toast({
          title: "Schedule Executed",
          description: `Completed schedule: ${schedule.name}`,
        });
      }, schedule.duration * 1000);
    } catch (error) {
      toast({
        title: "Schedule Error",
        description: `Failed to execute schedule: ${schedule.name}`,
        variant: "destructive"
      });
    }
  };

  const addSchedule = useCallback((schedule: Omit<Schedule, 'id'>) => {
    const newSchedule = {
      ...schedule,
      id: uuidv4()
    };
    
    setSchedules(prev => [...prev, newSchedule]);
    toast({
      title: "Schedule Added",
      description: `New schedule created: ${schedule.name}`,
    });
  }, []);

  const updateSchedule = useCallback((id: string, updates: Partial<Schedule>) => {
    setSchedules(prev => prev.map(schedule => 
      schedule.id === id ? { ...schedule, ...updates } : schedule
    ));
    
    toast({
      title: "Schedule Updated",
      description: "Schedule has been updated",
    });
  }, []);

  const deleteSchedule = useCallback((id: string) => {
    setSchedules(prev => prev.filter(schedule => schedule.id !== id));
    
    toast({
      title: "Schedule Deleted",
      description: "Schedule has been removed",
    });
  }, []);

  const toggleSchedule = useCallback((id: string) => {
    setSchedules(prev => prev.map(schedule =>
      schedule.id === id ? { ...schedule, enabled: !schedule.enabled } : schedule
    ));
  }, []);

  const getActiveSchedules = useCallback(() => {
    return schedules.filter(schedule => schedule.enabled);
  }, [schedules]);

  const value = {
    schedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
    getActiveSchedules,
  };

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
};
