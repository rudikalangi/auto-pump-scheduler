import React from 'react';
import { Droplet, Clock } from 'lucide-react';
import { usePump } from '@/context/PumpContext';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow } from 'date-fns';

const RemoteSensorCard: React.FC = () => {
  const { remoteMoisture, lastRemoteUpdate, setMoistureThresholds } = usePump();
  
  // State untuk threshold sliders
  const [dryThreshold, setDryThreshold] = React.useState(30);
  const [wetThreshold, setWetThreshold] = React.useState(70);
  const [isUpdating, setIsUpdating] = React.useState(false);
  
  // Handler untuk update threshold
  const handleUpdateThresholds = async () => {
    if (dryThreshold >= wetThreshold) {
      // toast({
      //   variant: "destructive",
      //   title: "Invalid Thresholds",
      //   description: "Dry threshold must be lower than wet threshold"
      // });
      return;
    }
    
    setIsUpdating(true);
    try {
      await setMoistureThresholds(dryThreshold, wetThreshold);
      // toast({
      //   title: "Success",
      //   description: "Thresholds updated successfully"
      // });
    } catch (error) {
      // toast({
      //   variant: "destructive",
      //   title: "Error",
      //   description: "Failed to update thresholds"
      // });
      // console.error('Update threshold error:', error);
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Calculate moisture level status
  const getMoistureStatus = (value: number) => {
    if (value < 30) return { color: 'bg-red-500', text: 'Dry' };
    if (value < 70) return { color: 'bg-green-500', text: 'Good' };
    return { color: 'bg-blue-500', text: 'Wet' };
  };
  
  const status = getMoistureStatus(remoteMoisture);
  
  // Calculate time since last update
  const getTimeSinceUpdate = () => {
    if (!lastRemoteUpdate) return 'No data';
    return formatDistanceToNow(lastRemoteUpdate) + ' ago';
  };
  
  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Droplet className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Soil Moisture</h3>
        </div>
        <div className="flex items-center space-x-1 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          <span>{getTimeSinceUpdate()}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-3xl font-bold">{remoteMoisture}%</span>
          <span className={`px-2 py-1 rounded-full text-white text-sm ${status.color}`}>
            {status.text}
          </span>
        </div>
        
        <Progress
          value={remoteMoisture}
          className="h-2"
          indicatorClassName={status.color}
        />
        
        <div className="flex justify-between text-sm text-gray-500">
          <span>Dry</span>
          <span>Optimal</span>
          <span>Wet</span>
        </div>
      </div>
      
      <div className="text-sm text-gray-500">
        <p>Optimal Range: {dryThreshold}% - {wetThreshold}%</p>
      </div>
      
      <div className="space-y-4">
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
    </Card>
  );
};

export default RemoteSensorCard;
