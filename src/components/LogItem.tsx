
import React from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export interface LogEntry {
  id: string;
  timestamp: Date;
  action: string;
  details: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

interface LogItemProps {
  log: LogEntry;
  className?: string;
}

const LogItem: React.FC<LogItemProps> = ({ log, className }) => {
  const getTypeClass = () => {
    switch (log.type) {
      case 'success':
        return 'border-l-green-500 bg-green-50';
      case 'warning':
        return 'border-l-amber-500 bg-amber-50';
      case 'error':
        return 'border-l-red-500 bg-red-50';
      case 'info':
      default:
        return 'border-l-blue-500 bg-blue-50';
    }
  };

  return (
    <div className={cn(
      'border-l-4 p-3 rounded-r-lg bg-opacity-60 animate-fade-in',
      getTypeClass(),
      className
    )}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1">
        <span className="font-medium text-gray-800">{log.action}</span>
        <span className="text-xs text-gray-500">
          {format(log.timestamp, 'MMM dd, yyyy HH:mm:ss')}
        </span>
      </div>
      <p className="text-sm text-gray-600">{log.details}</p>
    </div>
  );
};

export default LogItem;
