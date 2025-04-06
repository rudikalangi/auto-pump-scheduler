import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSchedule } from '@/context/ScheduleContext';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const scheduleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  days: z.array(z.number()).min(1, 'Select at least one day'),
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  duration: z.number().min(1).max(3600, 'Duration must be between 1 and 3600 seconds'),
  moistureThreshold: z.number().min(0).max(100).optional(),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

const ScheduleForm = () => {
  const { addSchedule } = useSchedule();
  
  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      name: '',
      days: [],
      startTime: '06:00',
      duration: 60,
      moistureThreshold: 30,
    },
  });

  const onSubmit = (data: ScheduleFormData) => {
    addSchedule({
      ...data,
      enabled: true,
      name: data.name,
      days: data.days,
      startTime: data.startTime,
      duration: data.duration,
      moistureThreshold: data.moistureThreshold,
    });
    form.reset();
  };

  const days = [
    { label: 'Sunday', value: 0 },
    { label: 'Monday', value: 1 },
    { label: 'Tuesday', value: 2 },
    { label: 'Wednesday', value: 3 },
    { label: 'Thursday', value: 4 },
    { label: 'Friday', value: 5 },
    { label: 'Saturday', value: 6 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Schedule</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schedule Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Morning Schedule" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="days"
              render={() => (
                <FormItem>
                  <FormLabel>Days</FormLabel>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {days.map((day) => (
                      <FormField
                        key={day.value}
                        control={form.control}
                        name="days"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(day.value)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  const updated = checked
                                    ? [...current, day.value]
                                    : current.filter((value) => value !== day.value);
                                  field.onChange(updated);
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {day.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (seconds)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        max={3600}
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum 3600 seconds (1 hour)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="moistureThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moisture Threshold (%)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={0} 
                      max={100}
                      {...field}
                      onChange={e => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Only run if moisture is below this level (optional)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              Create Schedule
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ScheduleForm;
