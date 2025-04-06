import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { usePump } from '@/context/PumpContext';
import { toast } from '@/components/ui/use-toast';
import { Wifi } from 'lucide-react';
import { Label } from '@/components/ui/label';

const NetworkSettings = () => {
  const { connectToDevice, isConnected } = usePump();
  const [ipAddress, setIpAddress] = useState('');

  // Load saved IP on mount
  useEffect(() => {
    const savedIp = localStorage.getItem('esp32_ip');
    if (savedIp) {
      setIpAddress(savedIp);
    }
  }, []);

  const handleConnect = () => {
    if (!ipAddress) {
      toast({
        title: "Error",
        description: "Please enter an IP address",
        variant: "destructive"
      });
      return;
    }

    // Clean IP address format
    const cleanIp = ipAddress.trim()
      .replace(/^https?:\/\//, '')  // Remove http:// or https://
      .replace(/\/$/, '')           // Remove trailing slash
      .replace(/:\d+$/, '')         // Remove any port number
      .replace(/[^\d.]/g, '');      // Only allow numbers and dots

    // Validate IP format
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(cleanIp)) {
      toast({
        title: "Error",
        description: "Invalid IP address format",
        variant: "destructive"
      });
      return;
    }

    // Validate IP numbers
    const parts = cleanIp.split('.');
    const isValid = parts.every(part => {
      const num = parseInt(part);
      return num >= 0 && num <= 255;
    });

    if (!isValid) {
      toast({
        title: "Error",
        description: "IP numbers must be between 0 and 255",
        variant: "destructive"
      });
      return;
    }

    console.log('Connecting to:', cleanIp);
    connectToDevice(cleanIp);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConnect();
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Wifi className={isConnected ? "text-green-500" : "text-gray-500"} />
        <CardTitle>Network Settings</CardTitle>
      </div>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ip">ESP32 IP Address</Label>
          <Input
            id="ip"
            type="text"
            placeholder="ESP32 IP Address (e.g., 192.168.1.100)"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            onKeyPress={handleKeyPress}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Button 
            onClick={handleConnect}
            variant={isConnected ? "destructive" : "default"}
          >
            {isConnected ? "Disconnect" : "Connect"}
          </Button>
        </div>

        <div className="text-sm text-gray-500">
          {isConnected ? (
            <p className="text-green-600">✓ Connected to ESP32</p>
          ) : (
            <div className="space-y-1">
              <p>Connection Tips:</p>
              <ul className="list-disc list-inside">
                <li>Make sure ESP32 is powered on</li>
                <li>Check if ESP32 is connected to WiFi</li>
                <li>Enter only the IP address (e.g., 192.168.1.100)</li>
                <li>Verify IP address from ESP32's serial monitor</li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default NetworkSettings;
