
import React from 'react';
import { cn } from '@/lib/utils';

interface TimeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const TimeSelector: React.FC<TimeSelectorProps> = ({
  value,
  onChange,
  className,
}) => {
  return (
    <div className={cn("glass-input px-3 py-2", className)}>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent focus:outline-none w-full"
      />
    </div>
  );
};

export default TimeSelector;
