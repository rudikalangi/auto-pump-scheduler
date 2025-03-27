
import React from 'react';
import { cn } from '@/lib/utils';

interface ControlButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant: 'power' | 'starter' | 'stop';
  isActive?: boolean;
  disabled?: boolean;
  className?: string;
}

const ControlButton: React.FC<ControlButtonProps> = ({
  label,
  icon,
  onClick,
  variant,
  isActive = false,
  disabled = false,
  className,
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'power':
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'starter':
        return 'bg-green-500 hover:bg-green-600 text-white';
      case 'stop':
        return 'bg-red-500 hover:bg-red-600 text-white';
      default:
        return 'bg-gray-500 hover:bg-gray-600 text-white';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'control-button space-y-2 min-w-[120px]',
        getVariantClass(),
        isActive && 'ring-4 ring-opacity-50',
        isActive && variant === 'power' && 'ring-blue-300',
        isActive && variant === 'starter' && 'ring-green-300',
        isActive && variant === 'stop' && 'ring-red-300',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className={cn(
        'p-3 rounded-full bg-white bg-opacity-20 transition-transform duration-500',
        isActive && 'animate-pulse-gentle'
      )}>
        {icon}
      </div>
      <span className="font-medium">{label}</span>
    </button>
  );
};

export default ControlButton;
