
import React, { useState } from 'react';
import { Plus, Clock } from 'lucide-react';
import Header from '@/components/Header';
import ScheduleItem from '@/components/ScheduleItem';
import TimeSelector from '@/components/TimeSelector';
import DaySelector from '@/components/DaySelector';
import { usePump } from '@/context/PumpContext';

const Scheduler: React.FC = () => {
  const { schedules, addSchedule, updateSchedule, deleteSchedule } = usePump();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStartTime, setNewStartTime] = useState('06:00');
  const [newEndTime, setNewEndTime] = useState('06:30');
  const [newDays, setNewDays] = useState<string[]>(['monday', 'wednesday', 'friday']);
  
  const handleAddSchedule = () => {
    addSchedule({
      startTime: newStartTime,
      endTime: newEndTime,
      days: newDays,
      isActive: true,
    });
    
    // Reset form
    setNewStartTime('06:00');
    setNewEndTime('06:30');
    setNewDays(['monday', 'wednesday', 'friday']);
    setShowAddForm(false);
  };
  
  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header />
      
      <main className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Irrigation Schedule</h2>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center space-x-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Add Schedule</span>
          </button>
        </div>
        
        {showAddForm && (
          <div className="glass-panel p-6 mb-6 animate-scale-in">
            <h3 className="text-lg font-medium text-gray-800 mb-4">New Schedule</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <TimeSelector
                  value={newStartTime}
                  onChange={setNewStartTime}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <TimeSelector
                  value={newEndTime}
                  onChange={setNewEndTime}
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Days</label>
              <DaySelector
                selectedDays={newDays}
                onChange={setNewDays}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSchedule}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Save Schedule
              </button>
            </div>
          </div>
        )}
        
        {schedules.length === 0 ? (
          <div className="glass-panel p-10 text-center">
            <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-800 mb-2">No Schedules</h3>
            <p className="text-gray-600 mb-4">Add your first irrigation schedule to automate your pump system.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Add Schedule
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {schedules.map((schedule) => (
              <ScheduleItem
                key={schedule.id}
                schedule={schedule}
                onUpdate={updateSchedule}
                onDelete={deleteSchedule}
              />
            ))}
          </div>
        )}
        
        <div className="glass-panel p-6 mt-8">
          <h3 className="text-lg font-medium text-gray-800 mb-4">How Scheduling Works</h3>
          <div className="prose max-w-none">
            <p>
              The scheduling system allows you to program your palm oil seedling irrigation system to operate automatically at specific times on selected days.
            </p>
            
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Select the <strong>start time</strong> when the system should power on and start the motor</li>
              <li>Select the <strong>end time</strong> when the system should shut down</li>
              <li>Choose the <strong>days of the week</strong> when this schedule should be active</li>
              <li>Toggle each schedule <strong>active or inactive</strong> without deleting it</li>
            </ul>
            
            <p className="mt-4">
              During scheduled times, the system will automatically turn on the power and start the motor. At the end time, the system will stop the motor and shut down.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Scheduler;
