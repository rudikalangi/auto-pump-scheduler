import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Wifi } from 'lucide-react';
import { usePump } from '@/context/PumpContext';
import { useToast } from '@/components/ui/use-toast';

const NetworkSettings = () => {
  const { connectToDevice, isConnected } = usePump();
  const { toast } = useToast();
  const [newIp, setNewIp] = useState(() => localStorage.getItem('esp32_ip') || '');

  const handleSave = async () => {
    // Validate IP address format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newIp)) {
      toast({
        title: "Invalid IP",
        description: "Please enter a valid IP address",
        variant: "destructive"
      });
      return;
    }

    try {
      // Try to connect with new IP
      connectToDevice(newIp);
      
      toast({
        title: "Connecting",
        description: "Attempting to connect to ESP32..."
      });
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Failed to connect to ESP32",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Wifi className={isConnected ? "text-green-500" : "text-gray-500"} />
        <h2 className="text-xl font-semibold">Network Settings</h2>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ip-address">ESP32 IP Address</Label>
          <div className="flex gap-2">
            <Input
              id="ip-address"
              placeholder="Enter ESP32 IP address"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
            />
            <Button 
              onClick={handleSave}
              disabled={!newIp}
            >
              Connect
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {isConnected ? (
              <span className="text-green-600">Connected to {newIp}</span>
            ) : (
              <span className="text-amber-600">Not connected</span>
            )}
          </p>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Connection Tips:</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Make sure ESP32 and your device are on the same network</li>
            <li>• Check if the ESP32 is powered on and running</li>
            <li>• Look for the IP address in ESP32's Serial Monitor</li>
            <li>• Try pinging the IP address to verify connectivity</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};

export default NetworkSettings;
