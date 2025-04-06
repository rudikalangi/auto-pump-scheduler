import React from 'react';
import { usePump } from '@/context/PumpContext';
import { Card } from '@/components/ui/card';
import { Power, Droplet, AlertTriangle } from 'lucide-react';
import StatusCard from '@/components/StatusCard';
import MoistureChart from '@/components/MoistureChart';
import ESP32Connection from '@/components/ESP32Connection';
import NetworkSettings from '@/components/NetworkSettings';
import ControlButton from '@/components/ControlButton';

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
          <ControlButton
            label={systemOn ? "Turn Off System" : "Turn On System"}
            icon={<Power className="h-6 w-6" />}
            onClick={toggleSystem}
            variant="power"
            isActive={systemOn}
            disabled={!isConnected}
          />
          
          <ControlButton
            label={motorRunning ? "Stop Motor" : "Start Motor"}
            icon={<Droplet className="h-6 w-6" />}
            onClick={motorRunning ? stopMotor : startMotor}
            variant="starter"
            isActive={motorRunning}
            disabled={!isConnected || !systemOn}
          />
          
          <ControlButton
            label="Emergency Stop"
            icon={<AlertTriangle className="h-6 w-6" />}
            onClick={stopAll}
            variant="stop"
            disabled={!isConnected}
          />
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
          value={`${(remoteMoisture || 0).toFixed(1)}%`}
          subtitle={getTimeSinceUpdate()}
          icon={<Droplet className="h-6 w-6" />}
          status={(remoteMoisture || 0) < 30 ? "warning" : "normal"}
        />
      </div>
      
      {/* Moisture Chart */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Moisture History</h2>
          <span className="text-sm text-muted-foreground">
            Last updated: {getTimeSinceUpdate()}
          </span>
        </div>
        <MoistureChart />
      </Card>
    </div>
  );
};

export default Dashboard;
