import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ActivityLog } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface LogContextType {
  logs: ActivityLog[];
  addLog: (type: ActivityLog['type'], message: string, data?: Record<string, any>) => void;
  clearLogs: () => void;
  getRecentLogs: (count: number) => ActivityLog[];
  getLogsByType: (type: ActivityLog['type']) => ActivityLog[];
  exportLogs: () => void;
}

const LogContext = createContext<LogContextType | null>(null);

export const useLog = () => {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error('useLog must be used within a LogProvider');
  }
  return context;
};

export const LogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem('pump_logs');
    return saved ? JSON.parse(saved) : [];
  });

  // Save logs to localStorage
  useEffect(() => {
    localStorage.setItem('pump_logs', JSON.stringify(logs));
  }, [logs]);

  // Clean up old logs (keep last 7 days)
  useEffect(() => {
    const cleanup = () => {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      setLogs(prev => prev.filter(log => log.timestamp > sevenDaysAgo));
    };

    // Run cleanup daily
    const interval = setInterval(cleanup, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const addLog = useCallback((type: ActivityLog['type'], message: string, data?: Record<string, any>) => {
    const newLog: ActivityLog = {
      id: uuidv4(),
      timestamp: Date.now(),
      type,
      message,
      data
    };

    setLogs(prev => [newLog, ...prev]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const getRecentLogs = useCallback((count: number) => {
    return logs.slice(0, count);
  }, [logs]);

  const getLogsByType = useCallback((type: ActivityLog['type']) => {
    return logs.filter(log => log.type === type);
  }, [logs]);

  const exportLogs = useCallback(() => {
    const exportData = {
      logs,
      exportDate: new Date().toISOString(),
      totalLogs: logs.length
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pump-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [logs]);

  const value = {
    logs,
    addLog,
    clearLogs,
    getRecentLogs,
    getLogsByType,
    exportLogs
  };

  return (
    <LogContext.Provider value={value}>
      {children}
    </LogContext.Provider>
  );
};
