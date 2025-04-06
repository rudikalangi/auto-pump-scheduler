import React from 'react';
import { cn } from '@/lib/utils';

interface StatusCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  status?: 'normal' | 'warning' | 'error' | 'success';
  subtitle?: string;
  className?: string;
}

const StatusCard: React.FC<StatusCardProps> = ({
  title,
  value,
  icon,
  status = 'normal',
  subtitle,
  className,
}) => {
  const getStatusClass = () => {
    switch (status) {
      case 'success':
        return 'border-green-200 bg-green-50 bg-opacity-50';
      case 'warning':
        return 'border-amber-200 bg-amber-50 bg-opacity-50';
      case 'error':
        return 'border-red-200 bg-red-50 bg-opacity-50';
      default:
        return 'border-blue-200 bg-blue-50 bg-opacity-50';
    }
  };

  const getStatusIconClass = () => {
    switch (status) {
      case 'success':
        return 'text-green-500 bg-green-100';
      case 'warning':
        return 'text-amber-500 bg-amber-100';
      case 'error':
        return 'text-red-500 bg-red-100';
      default:
        return 'text-blue-500 bg-blue-100';
    }
  };

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl p-4 border backdrop-blur-sm shadow-sm transition-all duration-300 animate-scale-in',
      getStatusClass(),
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-gray-700">{title}</h3>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={cn(
          'p-2 rounded-full',
          getStatusIconClass()
        )}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export type { StatusCardProps };
export default StatusCard;
