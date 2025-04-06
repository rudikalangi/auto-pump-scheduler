import React from 'react';
import { useZone } from '@/context/ZoneContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Settings2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ZoneList = () => {
  const { zones, toggleZone, deleteZone } = useZone();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Irrigation Zones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {zones.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            No zones configured. Add a zone to get started.
          </div>
        ) : (
          zones.map(zone => (
            <div
              key={zone.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="space-y-1">
                <h4 className="font-medium">{zone.name}</h4>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Settings2 className="h-4 w-4" />
                  <span>Relay Pin: {zone.relayPin}</span>
                  {zone.moistureSensorPin && (
                    <span>| Sensor Pin: {zone.moistureSensorPin}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Switch
                  checked={zone.enabled}
                  onCheckedChange={() => toggleZone(zone.id)}
                />
                {zone.id !== 'default' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Zone</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this zone? This action cannot be undone.
                          Any schedules using this zone will need to be updated.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteZone(zone.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default ZoneList;
