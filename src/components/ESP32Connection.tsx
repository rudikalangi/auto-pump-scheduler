import React, { useEffect, useState } from 'react';
import { connectToEsp32, onStatus, onConnection } from '@/utils/esp32';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { Signal, Power, WifiOff } from 'lucide-react';
import StatusCard from './StatusCard';

const ESP32Connection: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState({
    system_power: false,
    motor: false,
    wifi_connected: false,
    wifi_rssi: 0,
    moisture_low: 0,
    moisture_high: 0,
    ip: ''
  });

  useEffect(() => {
    // Register connection callback
    onConnection((connected) => {
      setIsConnected(connected);
      if (connected) {
        toast({
          title: "Connected",
          description: "Successfully connected to ESP32",
        });
      } else {
        toast({
          title: "Disconnected",
          description: "Lost connection to ESP32. Attempting to reconnect...",
          variant: "destructive"
        });
      }
    });

    // Register status callback
    onStatus((newStatus) => {
      console.log('Status update:', newStatus);
      setStatus(newStatus);
    });

    // Initial connection
    connectToEsp32('10.33.83.130');

    // Cleanup on unmount
    return () => {
      // Cleanup will be handled by the ESP32 utility
    };
  }, []);

  const getRSSIStatus = (rssi: number) => {
    if (rssi >= -50) return 'success';
    if (rssi >= -70) return 'normal';
    return 'warning';
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StatusCard
        title="Connection Status"
        value={isConnected ? 'Connected' : 'Disconnected'}
        icon={isConnected ? <Signal className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
        status={isConnected ? 'success' : 'error'}
      />

      <StatusCard
        title="System Power"
        value={status.system_power ? 'ON' : 'OFF'}
        icon={<Power className="h-6 w-6" />}
        status={status.system_power ? 'success' : 'normal'}
      />

      <StatusCard
        title="WiFi Signal"
        value={`${status.wifi_rssi} dBm`}
        icon={<Signal className="h-6 w-6" />}
        status={getRSSIStatus(status.wifi_rssi)}
      />

      <Card className="col-span-full p-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">IP: {status.ip || 'Not Connected'}</Badge>
          <Badge variant="outline">
            Motor: {status.motor ? 'Running' : 'Stopped'}
          </Badge>
          <Badge variant="outline">
            Moisture Threshold: {status.moisture_low}% - {status.moisture_high}%
          </Badge>
        </div>
      </Card>
    </div>
  );
};

export default ESP32Connection;
