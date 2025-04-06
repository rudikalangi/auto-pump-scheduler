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
        return isActive 
          ? 'bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-400'
          : 'bg-gray-100 hover:bg-gray-200 text-blue-600 hover:text-blue-700';
      case 'starter':
        return isActive
          ? 'bg-green-600 hover:bg-green-700 ring-2 ring-green-400'
          : 'bg-gray-100 hover:bg-gray-200 text-green-600 hover:text-green-700';
      case 'stop':
        return 'bg-red-600 hover:bg-red-700 text-white hover:ring-2 hover:ring-red-400';
      default:
        return 'bg-gray-500 hover:bg-gray-600 text-white';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center',
        'p-4 rounded-lg transition-all duration-200',
        'min-w-[120px] min-h-[100px]',
        getVariantClass(),
        (variant === 'power' || variant === 'starter') && isActive && 'text-white',
        disabled && 'opacity-50 cursor-not-allowed hover:ring-0',
        className
      )}
    >
      <div className={cn(
        'mb-2 transition-transform duration-200',
        isActive && 'scale-110'
      )}>
        {icon}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
};

export default ControlButton;
