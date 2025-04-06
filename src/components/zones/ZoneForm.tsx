import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useZone } from '@/context/ZoneContext';
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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const zoneSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  relayPin: z.number().min(0).max(40, 'Pin must be between 0 and 40'),
  moistureSensorPin: z.number().min(0).max(40, 'Pin must be between 0 and 40').optional(),
});

type ZoneFormData = z.infer<typeof zoneSchema>;

const ZoneForm = () => {
  const { addZone } = useZone();
  
  const form = useForm<ZoneFormData>({
    resolver: zodResolver(zoneSchema),
    defaultValues: {
      name: '',
      relayPin: 26,
      moistureSensorPin: 34,
    },
  });

  const onSubmit = (data: ZoneFormData) => {
    addZone({
      ...data,
      enabled: true,
      name: data.name,
      relayPin: data.relayPin,
      moistureSensorPin: data.moistureSensorPin,
    });
    form.reset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Irrigation Zone</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zone Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Garden Zone" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="relayPin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relay Pin</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        max={40}
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      ESP32 GPIO pin for relay control
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="moistureSensorPin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moisture Sensor Pin (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        max={40}
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      ESP32 GPIO pin for moisture sensor
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full">
              Add Zone
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ZoneForm;
