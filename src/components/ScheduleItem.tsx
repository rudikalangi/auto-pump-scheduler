
import React, { useState } from 'react';
import { Clock, Trash2, Edit, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import TimeSelector from './TimeSelector';
import DaySelector from './DaySelector';

export interface Schedule {
  id: string;
  startTime: string;
  endTime: string;
  days: string[];
  isActive: boolean;
}

interface ScheduleItemProps {
  schedule: Schedule;
  onUpdate: (updatedSchedule: Schedule) => void;
  onDelete: (id: string) => void;
  className?: string;
}

const ScheduleItem: React.FC<ScheduleItemProps> = ({
  schedule,
  onUpdate,
  onDelete,
  className,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSchedule, setEditedSchedule] = useState<Schedule>(schedule);

  const handleToggleActive = () => {
    onUpdate({
      ...schedule,
      isActive: !schedule.isActive,
    });
  };

  const handleStartTimeChange = (value: string) => {
    setEditedSchedule({
      ...editedSchedule,
      startTime: value,
    });
  };

  const handleEndTimeChange = (value: string) => {
    setEditedSchedule({
      ...editedSchedule,
      endTime: value,
    });
  };

  const handleDaysChange = (days: string[]) => {
    setEditedSchedule({
      ...editedSchedule,
      days,
    });
  };

  const handleSaveChanges = () => {
    onUpdate(editedSchedule);
    setIsEditing(false);
  };

  const handleCancelChanges = () => {
    setEditedSchedule(schedule);
    setIsEditing(false);
  };

  const formatDays = (days: string[]) => {
    if (days.length === 7) return 'Every day';
    if (days.length === 0) return 'No days selected';
    
    return days
      .map(day => day.charAt(0).toUpperCase() + day.slice(1, 3))
      .join(', ');
  };

  return (
    <div className={cn(
      'glass-panel p-4 transition-all duration-300',
      !schedule.isActive && 'opacity-70',
      className
    )}>
      {isEditing ? (
        // Edit mode
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-800">Edit Schedule</h3>
            <div className="flex space-x-2">
              <button
                onClick={handleSaveChanges}
                className="p-2 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancelChanges}
                className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <TimeSelector
                value={editedSchedule.startTime}
                onChange={handleStartTimeChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <TimeSelector
                value={editedSchedule.endTime}
                onChange={handleEndTimeChange}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Days</label>
            <DaySelector
              selectedDays={editedSchedule.days}
              onChange={handleDaysChange}
            />
          </div>
        </div>
      ) : (
        // View mode
        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
          <div className="flex items-center mb-3 sm:mb-0">
            <div className={cn(
              "p-2 rounded-full mr-3",
              schedule.isActive ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-600"
            )}>
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-gray-800">
                {schedule.startTime} - {schedule.endTime}
              </h3>
              <p className="text-sm text-gray-600">{formatDays(schedule.days)}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(schedule.id)}
              className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleToggleActive}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                schedule.isActive
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              {schedule.isActive ? 'Active' : 'Inactive'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleItem;
