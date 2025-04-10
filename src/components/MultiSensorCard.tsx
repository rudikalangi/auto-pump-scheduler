import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { usePump } from '@/context/PumpContext';
import { AlertTriangle } from 'lucide-react';

const MultiSensorCard = () => {
  const { moistureSensors, floodAlert } = usePump();

  const getMoistureColor = (value: number, dryThreshold: number, wetThreshold: number) => {
    if (value <= dryThreshold) return "bg-red-500"; // Very dry - red
    if (value < (dryThreshold + wetThreshold) / 2) return "bg-yellow-500"; // Medium dry - yellow
    if (value <= wetThreshold) return "bg-green-500"; // Good moisture - green
    return "bg-blue-500"; // Wet - blue
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Soil Moisture Sensors</span>
          {floodAlert && (
            <div className="flex items-center gap-2 text-red-500 animate-pulse">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-bold">FLOOD ALERT!</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {moistureSensors.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No sensor data available</p>
            <p className="text-sm">Connect to ESP32 to view sensor readings</p>
          </div>
        ) : (
          <div className="space-y-4">
            {moistureSensors.map((sensor) => (
              <div key={sensor.id} className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">{sensor.location}</span>
                  <span className="text-sm font-medium">{sensor.value.toFixed(1)}%</span>
                </div>
                <Progress 
                  value={sensor.value} 
                  max={100}
                  className="h-2"
                  indicatorClassName={getMoistureColor(sensor.value, sensor.dryThreshold, sensor.wetThreshold)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Dry: {sensor.dryThreshold}%</span>
                  <span>Wet: {sensor.wetThreshold}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 pt-4 border-t">
          <div className="text-xs text-muted-foreground">Moisture Level:</div>
          <div className="flex justify-between mt-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-xs">Dry</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-xs">Medium</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-xs">Good</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-xs">Wet</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MultiSensorCard;
