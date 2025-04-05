import React from 'react';
import { usePump } from '@/context/PumpContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Power, Droplet, AlertTriangle } from 'lucide-react';
import StatusCard from '@/components/StatusCard';
import MoistureChart from '@/components/MoistureChart';
import ESP32Connection from '@/components/ESP32Connection';
import NetworkSettings from '@/components/NetworkSettings';

const Dashboard = () => {
  const {
    systemOn,
    motorRunning,
    remoteMoisture,
    lastRemoteUpdate,
    toggleSystem,
    startMotor,
    stopMotor,
    stopAll,
    isConnected,
  } = usePump();

  const getTimeSinceUpdate = () => {
    if (!lastRemoteUpdate) return 'No data';
    const seconds = Math.floor((Date.now() - lastRemoteUpdate) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      {/* Connection Status */}
      <ESP32Connection />
      
      {/* Network Settings */}
      <NetworkSettings />
      
      {/* System Controls */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">System Controls</h2>
        <div className="flex flex-wrap gap-4">
          <Button
            variant={systemOn ? "default" : "outline"}
            onClick={toggleSystem}
            disabled={!isConnected}
          >
            <Power className="mr-2 h-4 w-4" />
            {systemOn ? "Turn Off System" : "Turn On System"}
          </Button>
          
          <Button
            variant={motorRunning ? "default" : "outline"}
            onClick={motorRunning ? stopMotor : startMotor}
            disabled={!isConnected || !systemOn}
          >
            <Droplet className="mr-2 h-4 w-4" />
            {motorRunning ? "Stop Motor" : "Start Motor"}
          </Button>
          
          <Button
            variant="destructive"
            onClick={stopAll}
            disabled={!isConnected}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Emergency Stop
          </Button>
        </div>
      </Card>
      
      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard
          title="System Power"
          value={systemOn ? "ON" : "OFF"}
          icon={<Power className="h-6 w-6" />}
          status={systemOn ? "success" : "normal"}
        />
        
        <StatusCard
          title="Motor Status"
          value={motorRunning ? "RUNNING" : "STOPPED"}
          icon={<Droplet className="h-6 w-6" />}
          status={motorRunning ? "success" : "normal"}
        />
        
        <StatusCard
          title="Moisture Level"
          value={`${remoteMoisture.toFixed(1)}%`}
          icon={<Droplet className="h-6 w-6" />}
          status={remoteMoisture < 30 ? "warning" : "normal"}
        />
      </div>
      
      {/* Moisture Chart */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Moisture History</h2>
          <span className="text-sm text-gray-500">
            Last update: {getTimeSinceUpdate()}
          </span>
        </div>
        <MoistureChart />
      </Card>
    </div>
  );
};

export default Dashboard;
