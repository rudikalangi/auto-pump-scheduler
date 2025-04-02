import React, { useEffect } from 'react';
import { Power, Play, Square, WifiOff, Droplet, Activity, Gauge } from 'lucide-react';
import Header from '@/components/Header';
import StatusCard from '@/components/StatusCard';
import ControlButton from '@/components/ControlButton';
import { usePump } from '@/context/PumpContext';

const Dashboard: React.FC = () => {
  const { 
    isConnected, 
    systemOn, 
    motorRunning,
    relayOn, 
    toggleSystem, 
    startMotor, 
    stopAll,
    connect
  } = usePump();

  // Auto-connect when the dashboard loads
  useEffect(() => {
    if (!isConnected) {
      const timer = setTimeout(() => {
        connect();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isConnected, connect]);

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header />
      
      <main className="container mx-auto px-4">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">System Status</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatusCard
              title="Connection"
              value={isConnected ? "Connected" : "Disconnected"}
              icon={isConnected ? <Droplet className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
              status={isConnected ? "success" : "error"}
            />
            
            <StatusCard
              title="System Power"
              value={systemOn ? "ON" : "OFF"}
              icon={<Power className="h-5 w-5" />}
              status={systemOn ? "success" : "normal"}
            />
            
            <StatusCard
              title="Motor Status"
              value={motorRunning ? (relayOn ? "Starting" : "Running") : "Stopped"}
              icon={motorRunning ? <Activity className="h-5 w-5" /> : <Gauge className="h-5 w-5" />}
              status={motorRunning ? (relayOn ? "warning" : "success") : "normal"}
            />
          </div>
        </div>
        
        <div className="glass-panel p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Control Panel</h2>
          
          <div className="flex flex-wrap justify-center gap-6">
            <ControlButton
              label="System ON"
              icon={<Power className="h-6 w-6" />}
              onClick={toggleSystem}
              variant="power"
              isActive={systemOn}
              disabled={!isConnected}
            />
            
            <ControlButton
              label="Start Motor"
              icon={<Play className="h-6 w-6" />}
              onClick={startMotor}
              variant="starter"
              isActive={relayOn}
              disabled={!isConnected || !systemOn || motorRunning}
            />
            
            <ControlButton
              label="Stop All"
              icon={<Square className="h-6 w-6" />}
              onClick={stopAll}
              variant="stop"
              disabled={!isConnected || (!systemOn && !motorRunning)}
            />
          </div>
          
          {!isConnected && (
            <div className="mt-6 text-center">
              <p className="text-gray-600 mb-4">Not connected to ESP32</p>
              <button
                onClick={connect}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Connect
              </button>
            </div>
          )}
        </div>

        <div className="glass-panel p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">System Information</h2>
          
          <div className="prose max-w-none">
            <p>
              This control panel allows you to manage your Perkins pump for palm oil seedling irrigation. 
              The system operates similar to a car ignition system:
            </p>
            
            <ol className="list-decimal pl-5 space-y-2 mt-2">
              <li><strong>System ON</strong> - Activates the electrical system (like turning a car key to ON)</li>
              <li><strong>Start Motor</strong> - Engages the starter (like turning a car key to START)</li>
              <li><strong>Stop All</strong> - Emergency stop for both motor and system</li>
            </ol>
            
            <p className="mt-4">
              Use the Scheduler tab to set automatic irrigation times based on days of the week.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
