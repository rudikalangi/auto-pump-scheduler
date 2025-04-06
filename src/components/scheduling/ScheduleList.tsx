import React from 'react';
import { useSchedule } from '@/context/ScheduleContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Clock, Calendar, Trash2 } from 'lucide-react';
import { formatDuration } from '@/lib/utils';

const ScheduleList = () => {
  const { schedules, toggleSchedule, deleteSchedule } = useSchedule();

  const getDayNames = (days: number[]) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(day => dayNames[day]).join(', ');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled Tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {schedules.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            No schedules found. Create one to get started.
          </div>
        ) : (
          schedules.map(schedule => (
            <div
              key={schedule.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="space-y-1">
                <h4 className="font-medium">{schedule.name}</h4>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{getDayNames(schedule.days)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{schedule.startTime} ({formatDuration(schedule.duration)})</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Switch
                  checked={schedule.enabled}
                  onCheckedChange={() => toggleSchedule(schedule.id)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteSchedule(schedule.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default ScheduleList;
