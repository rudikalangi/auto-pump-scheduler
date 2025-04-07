import React from 'react';
import { Droplet, Clock } from 'lucide-react';
import { usePump } from '@/context/PumpContext';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/components/ui/use-toast';

const RemoteSensorCard: React.FC = () => {
  const { 
    remoteMoisture, 
    lastRemoteUpdate, 
    setMoistureThresholds, 
    moistureThresholds,
    autoMode,
    toggleAutoMode 
  } = usePump();
  
  // State untuk threshold sliders dengan nilai dari context
  const [dryThreshold, setDryThreshold] = React.useState(moistureThresholds.dry);
  const [wetThreshold, setWetThreshold] = React.useState(moistureThresholds.wet);
  const [isUpdating, setIsUpdating] = React.useState(false);
  
  // Update local state ketika nilai di context berubah
  React.useEffect(() => {
    setDryThreshold(moistureThresholds.dry);
    setWetThreshold(moistureThresholds.wet);
  }, [moistureThresholds]);
  
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
  
  // Handler untuk toggle auto mode
  const handleToggleAutoMode = async () => {
    try {
      await toggleAutoMode();
      toast({
        title: "Success",
        description: `Auto mode ${autoMode ? 'disabled' : 'enabled'}`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to toggle auto mode"
      });
    }
  };
  
  // Get time since last update
  const getTimeSinceUpdate = () => {
    if (!lastRemoteUpdate) return 'Never';
    return formatDistanceToNow(lastRemoteUpdate, { addSuffix: true });
  };
  
  // Get moisture status
  const status = React.useMemo(() => {
    if (remoteMoisture <= dryThreshold) {
      return { text: 'Dry', color: 'bg-red-500' };
    } else if (remoteMoisture >= wetThreshold) {
      return { text: 'Wet', color: 'bg-green-500' };
    }
    return { text: 'Good', color: 'bg-blue-500' };
  }, [remoteMoisture, dryThreshold, wetThreshold]);
  
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
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded-full text-white text-sm ${status.color}`}>
              {status.text}
            </span>
            <button
              onClick={handleToggleAutoMode}
              className={`px-2 py-1 rounded-full text-white text-sm ${
                autoMode ? 'bg-green-500' : 'bg-gray-500'
              }`}
            >
              Auto: {autoMode ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
        
        <Progress
          value={remoteMoisture}
          className={`h-2.5 ${status.color} transition-all duration-300`}
          style={{
            background: 'rgba(0,0,0,0.1)',
          }}
        />
        
        <div className="flex justify-between text-sm text-gray-500">
          <span>Dry</span>
          <span>Optimal</span>
          <span>Wet</span>
        </div>
      </div>
      
      <div className="text-sm text-gray-500">
        <p>Optimal Range: {dryThreshold}% - {wetThreshold}%</p>
        {autoMode && (
          <p className="mt-1 text-xs">
            System will automatically {remoteMoisture <= dryThreshold ? 'start' : 'stop'} when moisture is {remoteMoisture <= dryThreshold ? 'below' : 'above'} threshold
          </p>
        )}
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
            onChange={(e) => setDryThreshold(parseInt(e.target.value))}
            className="w-full"
          />
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
            onChange={(e) => setWetThreshold(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
        
        <button
          onClick={handleUpdateThresholds}
          disabled={isUpdating}
          className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {isUpdating ? 'Updating...' : 'Update Thresholds'}
        </button>
      </div>
    </Card>
  );
};

export default RemoteSensorCard;
