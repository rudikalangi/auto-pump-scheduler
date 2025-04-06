import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { usePump } from '@/context/PumpContext';
import { Schedule, HARI_INDONESIA } from '@/types';
import { Plus, Trash2, Clock } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const ScheduleManager = () => {
  const { schedules, addSchedule, updateSchedule, deleteSchedule } = usePump();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    startTime: '06:00',
    endTime: '18:00',
    days: [] as number[],
    enabled: true
  });

  const handleAddSchedule = () => {
    if (!newSchedule.name) {
      toast({
        title: "Error",
        description: "Nama jadwal harus diisi",
        variant: "destructive"
      });
      return;
    }

    if (!newSchedule.days.length) {
      toast({
        title: "Error",
        description: "Pilih minimal satu hari",
        variant: "destructive"
      });
      return;
    }

    addSchedule(newSchedule);
    setNewSchedule({
      name: '',
      startTime: '06:00',
      endTime: '18:00',
      days: [],
      enabled: true
    });
    setShowNewForm(false);
  };

  const toggleDay = (index: number, schedule: Schedule | typeof newSchedule) => {
    const days = schedule.days.includes(index)
      ? schedule.days.filter(d => d !== index)
      : [...schedule.days, index];

    if (schedule === newSchedule) {
      setNewSchedule({ ...schedule, days });
    } else {
      updateSchedule(schedule.id, { days });
    }
  };

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Jadwal Pompa</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowNewForm(!showNewForm)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Jadwal
        </Button>
      </div>

      {showNewForm && (
        <Card className="p-4 mb-4 border border-dashed">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nama Jadwal:</label>
              <Input
                value={newSchedule.name}
                onChange={e => setNewSchedule({ ...newSchedule, name: e.target.value })}
                placeholder="Contoh: Jadwal Pagi"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Jam Mulai:</label>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  <Input
                    type="time"
                    value={newSchedule.startTime}
                    onChange={e => setNewSchedule({ ...newSchedule, startTime: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Jam Selesai:</label>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  <Input
                    type="time"
                    value={newSchedule.endTime}
                    onChange={e => setNewSchedule({ ...newSchedule, endTime: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Hari:</label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {HARI_INDONESIA.map((day, index) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      checked={newSchedule.days.includes(index)}
                      onCheckedChange={() => toggleDay(index, newSchedule)}
                    />
                    <label className="text-sm">{day}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowNewForm(false)}>
                Batal
              </Button>
              <Button onClick={handleAddSchedule}>
                Simpan
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {schedules.map(schedule => (
          <Card key={schedule.id} className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <Switch
                  checked={schedule.enabled}
                  onCheckedChange={checked => updateSchedule(schedule.id, { enabled: checked })}
                />
                <h3 className="font-medium">{schedule.name}</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteSchedule(schedule.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm text-muted-foreground">Jam Mulai:</label>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  <Input
                    type="time"
                    value={schedule.startTime}
                    onChange={e => updateSchedule(schedule.id, { startTime: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Jam Selesai:</label>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  <Input
                    type="time"
                    value={schedule.endTime}
                    onChange={e => updateSchedule(schedule.id, { endTime: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Hari:</label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {HARI_INDONESIA.map((day, index) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      checked={schedule.days.includes(index)}
                      onCheckedChange={() => toggleDay(index, schedule)}
                    />
                    <label className="text-sm">{day}</label>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
};

export default ScheduleManager;
