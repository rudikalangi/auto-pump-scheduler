import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { usePump } from '@/context/PumpContext';
import { Card } from '@/components/ui/card';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const MoistureChart: React.FC = () => {
  const { moistureHistory = [], remoteMoisture = 0 } = usePump();

  // If no data, show placeholder
  if (moistureHistory.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No moisture data available
      </div>
    );
  }
  
  const data = {
    labels: moistureHistory.map(h => new Date(h.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Moisture Level',
        data: moistureHistory.map(h => h.value),
        fill: true,
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: 'rgba(75, 192, 192, 1)',
        tension: 0.4
      }
    ]
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0 // Disable animation for better real-time performance
    },
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: `Current Moisture Level: ${remoteMoisture.toFixed(1)}%`,
        padding: {
          top: 10,
          bottom: 30
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => `Moisture: ${context.parsed.y.toFixed(1)}%`
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxTicksLimit: 8,
          maxRotation: 0
        }
      },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 20,
          callback: (value: number) => `${value}%`
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const
    }
  };

  return (
    <Card className="p-4">
      <div className="h-[400px]">
        <Line data={data} options={options} />
      </div>
    </Card>
  );
};

export default MoistureChart;
