import React, { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Signal, Power } from 'lucide-react';
import { usePump } from '@/context/PumpContext';
import StatusCard from './StatusCard';

const ESP32Connection: React.FC = () => {
  const { 
    isConnected,
    systemOn,
    motorRunning,
    ipAddress
  } = usePump();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StatusCard
        title="Connection Status"
        value={isConnected ? 'Connected' : 'Disconnected'}
        icon={<Signal className="h-6 w-6" />}
        status={isConnected ? 'success' : 'error'}
      />

      <StatusCard
        title="System Power"
        value={systemOn ? 'ON' : 'OFF'}
        icon={<Power className="h-6 w-6" />}
        status={systemOn ? 'success' : 'normal'}
      />

      <StatusCard
        title="Motor Status"
        value={motorRunning ? 'Running' : 'Stopped'}
        icon={<Power className="h-6 w-6" />}
        status={motorRunning ? 'success' : 'normal'}
      />

      <Card className="col-span-full p-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">IP: {ipAddress}</Badge>
          <Badge variant="outline">
            WebSocket: {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <Badge variant="outline">
            System: {systemOn ? 'ON' : 'OFF'}
          </Badge>
          <Badge variant="outline">
            Motor: {motorRunning ? 'Running' : 'Stopped'}
          </Badge>
        </div>
      </Card>
    </div>
  );
};

export default ESP32Connection;
