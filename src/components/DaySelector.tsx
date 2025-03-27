
import React from 'react';
import { cn } from '@/lib/utils';

interface DaySelectorProps {
  selectedDays: string[];
  onChange: (selectedDays: string[]) => void;
  className?: string;
}

const DaySelector: React.FC<DaySelectorProps> = ({
  selectedDays,
  onChange,
  className,
}) => {
  const days = [
    { value: 'sunday', label: 'S' },
    { value: 'monday', label: 'M' },
    { value: 'tuesday', label: 'T' },
    { value: 'wednesday', label: 'W' },
    { value: 'thursday', label: 'T' },
    { value: 'friday', label: 'F' },
    { value: 'saturday', label: 'S' },
  ];

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      onChange(selectedDays.filter((d) => d !== day));
    } else {
      onChange([...selectedDays, day]);
    }
  };

  return (
    <div className={cn("flex space-x-2", className)}>
      {days.map((day) => (
        <button
          key={day.value}
          type="button"
          onClick={() => toggleDay(day.value)}
          className={cn(
            "w-8 h-8 rounded-full transition-all flex items-center justify-center text-sm font-medium",
            selectedDays.includes(day.value)
              ? "bg-primary text-white shadow-md"
              : "bg-white bg-opacity-70 text-gray-700 hover:bg-opacity-100"
          )}
        >
          {day.label}
        </button>
      ))}
    </div>
  );
};

export default DaySelector;
