import React from 'react';
import NetworkSettings from '@/components/NetworkSettings';
import ESP32Connection from '@/components/ESP32Connection';
import RemoteSensorCard from '@/components/RemoteSensorCard';
import MoistureChart from '@/components/MoistureChart';
import ScheduleManager from '@/components/ScheduleManager';
import ManualControl from '@/components/ManualControl';
import DHT22Card from '@/components/DHT22Card';
import ThemeToggle from '@/components/ThemeToggle';
import MultiSensorCard from '@/components/MultiSensorCard';
import { usePump } from '@/context/PumpContext';
import { Droplet, WifiOff } from 'lucide-react';

const Dashboard = () => {
  const { isConnected } = usePump();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="header-gradient py-4 mb-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Droplet className="w-8 h-8" />
              Pompa Bibitan PT.DLJ1
            </h1>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <span className={`status-badge ${isConnected ? 'status-badge-online' : 'status-badge-offline'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pb-8">
        {!isConnected && (
          <div className="animate-fade-in bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg">
            <div className="flex items-center gap-3">
              <WifiOff className="w-5 h-5 text-yellow-400" />
              <p className="text-sm text-yellow-700">
                Not connected to ESP32. Please check your connection settings.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            <NetworkSettings />
            <ESP32Connection />
            <ManualControl />
            <MultiSensorCard />
            <DHT22Card />
            <RemoteSensorCard />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <ScheduleManager />
            <MoistureChart />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t py-4 mt-8">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Pompa Bibitan PT.DLJ1 &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
