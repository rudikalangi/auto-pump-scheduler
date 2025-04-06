import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Zone } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { toast } from '@/components/ui/use-toast';

interface ZoneContextType {
  zones: Zone[];
  addZone: (zone: Omit<Zone, 'id'>) => void;
  updateZone: (id: string, zone: Partial<Zone>) => void;
  deleteZone: (id: string) => void;
  toggleZone: (id: string) => void;
  getActiveZones: () => Zone[];
}

const ZoneContext = createContext<ZoneContextType | null>(null);

export const useZone = () => {
  const context = useContext(ZoneContext);
  if (!context) {
    throw new Error('useZone must be used within a ZoneProvider');
  }
  return context;
};

export const ZoneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [zones, setZones] = useState<Zone[]>(() => {
    const saved = localStorage.getItem('pump_zones');
    return saved ? JSON.parse(saved) : [
      // Default zone for backward compatibility
      {
        id: 'default',
        name: 'Main Zone',
        relayPin: 26, // Default motor relay pin
        moistureSensorPin: 34, // Default moisture sensor pin
        enabled: true
      }
    ];
  });

  // Save zones to localStorage
  useEffect(() => {
    localStorage.setItem('pump_zones', JSON.stringify(zones));
  }, [zones]);

  const addZone = useCallback((zone: Omit<Zone, 'id'>) => {
    const newZone = {
      ...zone,
      id: uuidv4()
    };
    
    setZones(prev => [...prev, newZone]);
    toast({
      title: "Zone Added",
      description: `New zone created: ${zone.name}`,
    });
  }, []);

  const updateZone = useCallback((id: string, updates: Partial<Zone>) => {
    setZones(prev => prev.map(zone => 
      zone.id === id ? { ...zone, ...updates } : zone
    ));
    
    toast({
      title: "Zone Updated",
      description: "Zone has been updated",
    });
  }, []);

  const deleteZone = useCallback((id: string) => {
    // Prevent deleting the default zone
    if (id === 'default') {
      toast({
        title: "Cannot Delete",
        description: "The default zone cannot be deleted",
        variant: "destructive"
      });
      return;
    }

    setZones(prev => prev.filter(zone => zone.id !== id));
    toast({
      title: "Zone Deleted",
      description: "Zone has been removed",
    });
  }, []);

  const toggleZone = useCallback((id: string) => {
    setZones(prev => prev.map(zone =>
      zone.id === id ? { ...zone, enabled: !zone.enabled } : zone
    ));
  }, []);

  const getActiveZones = useCallback(() => {
    return zones.filter(zone => zone.enabled);
  }, [zones]);

  const value = {
    zones,
    addZone,
    updateZone,
    deleteZone,
    toggleZone,
    getActiveZones,
  };

  return (
    <ZoneContext.Provider value={value}>
      {children}
    </ZoneContext.Provider>
  );
};
