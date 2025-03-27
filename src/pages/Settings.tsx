
import React, { useState, FormEvent } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import { usePump } from '@/context/PumpContext';
import { toast } from 'sonner';

const Settings: React.FC = () => {
  const { ipAddress, setIpAddress, isConnected, disconnect, connect } = usePump();
  const [inputIp, setInputIp] = useState(ipAddress);
  
  const handleSaveIp = (e: FormEvent) => {
    e.preventDefault();
    
    // Simple IP validation
    const ipRegex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
    if (!ipRegex.test(inputIp)) {
      toast.error('Please enter a valid IP address');
      return;
    }
    
    // Disconnect before changing IP
    if (isConnected) {
      disconnect();
    }
    
    setIpAddress(inputIp);
    toast.success('IP address saved');
    
    // Reconnect after a short delay
    setTimeout(() => {
      connect();
    }, 1000);
  };
  
  const handleReconnect = () => {
    if (isConnected) {
      disconnect();
    }
    setTimeout(() => {
      connect();
    }, 500);
  };
  
  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header />
      
      <main className="container mx-auto px-4">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">System Settings</h2>
        
        <div className="glass-panel p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-800 mb-4">ESP32 Connection Settings</h3>
          
          <form onSubmit={handleSaveIp} className="space-y-4">
            <div>
              <label htmlFor="ipAddress" className="block text-sm font-medium text-gray-700 mb-1">
                ESP32 IP Address
              </label>
              <div className="flex">
                <input
                  id="ipAddress"
                  type="text"
                  value={inputIp}
                  onChange={(e) => setInputIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="glass-input px-4 py-2 flex-1"
                />
                <button
                  type="submit"
                  className="ml-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Save className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Current IP: {ipAddress} - Status: {isConnected ? 'Connected' : 'Disconnected'}
              </p>
            </div>
            
            <div>
              <button
                type="button"
                onClick={handleReconnect}
                className="px-4 py-2 flex items-center space-x-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reconnect</span>
              </button>
            </div>
          </form>
        </div>
        
        <div className="glass-panel p-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4">System Information</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-700">ESP32 Integration</h4>
              <p className="text-sm text-gray-600">
                This web application communicates with an ESP32 microcontroller that controls the relays connected to your Perkins pump system. 
                Make sure the ESP32 is programmed with the corresponding firmware and is on the same network as this device.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700">Relay Configuration</h4>
              <p className="text-sm text-gray-600">
                The ESP32 controls two relay channels connected to your Perkins pump:
              </p>
              <ul className="list-disc pl-5 text-sm text-gray-600 mt-1">
                <li>Relay 1: System power (equivalent to turning the key to ON position)</li>
                <li>Relay 2: Starter motor (equivalent to turning the key to START position)</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700">About This Application</h4>
              <p className="text-sm text-gray-600">
                Version 1.0.0 - Palm Oil Seedling Irrigation Control System
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
