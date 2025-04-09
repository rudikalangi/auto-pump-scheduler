import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { usePump } from '@/context/PumpContext';

const DHT22Card = () => {
  const { sensorData } = usePump();
  const { temperature, humidity } = sensorData || { temperature: 0, humidity: 0 };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Suhu</CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{temperature.toFixed(1)}°C</div>
          <Progress
            value={((temperature + 20) / 60) * 100}
            className="mt-2"
            indicatorClassName={temperature > 30 ? 'bg-red-500' : 'bg-blue-500'}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Kelembaban Udara</CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{humidity.toFixed(1)}%</div>
          <Progress
            value={humidity}
            className="mt-2"
            indicatorClassName={humidity > 70 ? 'bg-blue-500' : 'bg-yellow-500'}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default DHT22Card;
