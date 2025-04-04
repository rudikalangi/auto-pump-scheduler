import React, { useState } from 'react';
import { WifiIcon } from 'lucide-react';
import { usePump } from '@/context/PumpContext';
import StatusCard from './StatusCard';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";

const RemoteSensorCard: React.FC = () => {
  const { toast } = useToast();
  const { remoteMoisture, lastRemoteUpdate, setMoistureThresholds } = usePump();
  
  // State untuk threshold sliders
  const [dryThreshold, setDryThreshold] = useState(30);
  const [wetThreshold, setWetThreshold] = useState(70);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Handler untuk update threshold
  const handleUpdateThresholds = async () => {
    if (dryThreshold >= wetThreshold) {
      toast({
        variant: "destructive",
        title: "Invalid Thresholds",
        description: "Dry threshold must be lower than wet threshold"
      });
      return;
    }
    
    setIsUpdating(true);
    try {
      await setMoistureThresholds(dryThreshold, wetThreshold);
      toast({
        title: "Success",
        description: "Thresholds updated successfully"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update thresholds"
      });
      console.error('Update threshold error:', error);
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Calculate time since last update
  const getTimeSinceUpdate = () => {
    if (!lastRemoteUpdate) return 'No data';
    return formatDistanceToNow(lastRemoteUpdate) + ' ago';
  };
  
  // Get status color based on update time
  const getStatus = () => {
    if (!lastRemoteUpdate) return 'error';
    const timeDiff = Date.now() - lastRemoteUpdate;
    if (timeDiff > 60000) return 'error'; // > 1 minute
    if (timeDiff > 30000) return 'warning'; // > 30 seconds
    return 'success';
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium mb-4">Remote Moisture Sensor</h3>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700">
              Current Moisture: {remoteMoisture.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-500">
              Last Update: {getTimeSinceUpdate()}
            </p>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700">
              Dry Threshold (Start Pump)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={dryThreshold}
              onChange={(e) => setDryThreshold(Number(e.target.value))}
              className="w-full"
              disabled={isUpdating}
            />
            <p className="text-sm text-gray-500">{dryThreshold}%</p>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700">
              Wet Threshold (Stop Pump)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={wetThreshold}
              onChange={(e) => setWetThreshold(Number(e.target.value))}
              className="w-full"
              disabled={isUpdating}
            />
            <p className="text-sm text-gray-500">{wetThreshold}%</p>
          </div>
          
          <button
            onClick={handleUpdateThresholds}
            disabled={dryThreshold >= wetThreshold || isUpdating}
            className={`w-full py-2 px-4 rounded-md text-white font-medium ${
              dryThreshold >= wetThreshold || isUpdating
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isUpdating ? 'Updating...' : 'Update Thresholds'}
          </button>
          
          {dryThreshold >= wetThreshold && (
            <p className="text-sm text-red-600">
              Dry threshold must be lower than wet threshold
            </p>
          )}
        </div>
      </div>

      <StatusCard
        title="Remote Sensor Status"
        value={`${remoteMoisture.toFixed(1)}% | ${getTimeSinceUpdate()}`}
        icon={<WifiIcon className="h-4 w-4" />}
        status={getStatus()}
      />
    </div>
  );
};

export default RemoteSensorCard;
