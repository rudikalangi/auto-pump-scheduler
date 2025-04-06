import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Power, Droplet, AlertTriangle, Loader2 } from 'lucide-react';
import { usePump } from '@/context/PumpContext';
import { cn } from '@/lib/utils';

const StatusIndicator = ({ active, isMotor = false }: { active: boolean; isMotor?: boolean }) => (
  <div className="flex items-center gap-2">
    <div
      className={cn(
        "w-2 h-2 rounded-full transition-all duration-150",
        active ? "bg-green-500" : "bg-gray-300",
        isMotor && active && "animate-spin"
      )}
    />
    <span className={cn(
      "text-sm transition-colors duration-150",
      active ? "text-green-600" : "text-gray-500"
    )}>
      {active ? (isMotor ? "Berjalan" : "Aktif") : "Tidak Aktif"}
    </span>
  </div>
);

const ManualControl = () => {
  const { isConnected, systemOn, motorRunning, toggleSystem, startMotor, stopMotor, stopAll } = usePump();
  const [loading, setLoading] = useState<'system' | 'motor' | 'stop' | null>(null);

  // Debounced control functions with shorter timeouts
  const handleToggleSystem = async () => {
    if (loading) return;
    setLoading('system');
    try {
      await toggleSystem();
    } finally {
      setTimeout(() => setLoading(null), 300); // Reduced from 500ms to 300ms
    }
  };

  const handleToggleMotor = async () => {
    if (loading) return;
    setLoading('motor');
    try {
      if (motorRunning) {
        await stopMotor();
      } else {
        await startMotor();
      }
    } finally {
      setTimeout(() => setLoading(null), 300);
    }
  };

  const handleStopAll = async () => {
    if (loading) return;
    setLoading('stop');
    try {
      await stopAll();
    } finally {
      setTimeout(() => setLoading(null), 300);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="bg-primary p-4">
        <h2 className="text-xl font-bold text-white">Kontrol Manual</h2>
      </div>
      
      <div className="p-4 space-y-6">
        {/* Status Indicators */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Status Sistem</p>
            <StatusIndicator active={systemOn} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Status Motor</p>
            <StatusIndicator active={motorRunning} isMotor={true} />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant={systemOn ? "destructive" : "default"}
              onClick={handleToggleSystem}
              disabled={!isConnected || loading !== null}
              className={cn(
                "w-full flex items-center justify-center gap-2 transition-all duration-150",
                systemOn && "bg-red-600 hover:bg-red-700"
              )}
            >
              {loading === 'system' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Power className="w-4 h-4" />
              )}
              <span>{systemOn ? "Matikan Sistem" : "Hidupkan Sistem"}</span>
            </Button>

            <Button
              variant={motorRunning ? "destructive" : "default"}
              onClick={handleToggleMotor}
              disabled={!isConnected || !systemOn || loading !== null}
              className={cn(
                "w-full flex items-center justify-center gap-2 transition-all duration-150",
                motorRunning && "bg-red-600 hover:bg-red-700"
              )}
            >
              {loading === 'motor' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Droplet className={cn(
                  "w-4 h-4 transition-transform duration-150",
                  motorRunning && "animate-bounce"
                )} />
              )}
              <span>{motorRunning ? "Matikan Motor" : "Hidupkan Motor"}</span>
            </Button>
          </div>

          <Button
            variant="destructive"
            onClick={handleStopAll}
            disabled={!isConnected || loading !== null}
            className="w-full flex items-center justify-center gap-2 transition-all duration-150"
          >
            {loading === 'stop' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span>Stop Darurat</span>
          </Button>
        </div>

        {/* Connection Warning */}
        {!isConnected && (
          <p className="text-sm text-yellow-600 dark:text-yellow-500 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Tidak terhubung ke ESP32
          </p>
        )}
      </div>
    </Card>
  );
};

export default ManualControl;
