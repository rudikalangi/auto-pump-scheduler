import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { usePump } from '@/context/PumpContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const MoistureChart: React.FC = () => {
  const { moistureHistory } = usePump();
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Soil Moisture History',
        font: {
          size: 16,
          weight: 'bold' as 'bold'
        }
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        title: {
          display: true,
          text: 'Moisture (%)'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Time'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      }
    },
    animation: {
      duration: 0 // Disable animation for real-time updates
    },
    interaction: {
      intersect: false,
      mode: 'index' as const
    }
  };

  // Ensure we have data before rendering
  if (!moistureHistory || moistureHistory.length === 0) {
    return (
      <div className="w-full h-[400px] bg-white rounded-lg shadow p-4 flex items-center justify-center">
        <p className="text-gray-500">No moisture data available</p>
      </div>
    );
  }

  const data = {
    labels: moistureHistory.map(point => 
      new Date(point.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    ),
    datasets: [
      {
        label: 'Soil Moisture',
        data: moistureHistory.map(point => Number(point.value.toFixed(1))),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: true
      }
    ]
  };

  return (
    <div className="w-full h-[400px] bg-white rounded-lg shadow p-4">
      <Line options={options} data={data} />
    </div>
  );
};

export default MoistureChart;
