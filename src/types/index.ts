export interface Schedule {
  id: string;
  name: string;
  startTime: string; // Format: "HH:mm"
  endTime: string;   // Format: "HH:mm"
  days: number[];    // 0-6 (Minggu-Sabtu)
  enabled: boolean;
  createdAt: number;
}

export interface Zone {
  id: string;
  name: string;
  relayPin: number;
  moistureSensorPin?: number;
  enabled: boolean;
}

export interface SystemConfig {
  autoMode: boolean;
  defaultMoistureThreshold: number;
  maxPumpDuration: number; // in seconds
  minMoisture: number;
  maxMoisture: number;
}

export interface ActivityLog {
  id: string;
  timestamp: number;
  type: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  data?: Record<string, any>;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  permissions: string[];
}

export interface Alert {
  id: string;
  type: 'moisture' | 'system' | 'motor' | 'connection';
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface SystemStatus {
  system: boolean;
  motor: boolean;
  moisture: number | MoistureSensorData[];
  lora: boolean;
  wifi: boolean;
  ip: string;
  timestamp: number;
  floodAlert?: boolean;
}

export interface MoistureSensorData {
  id: number;
  value: number;
  location: string;
  dryThreshold: number;
  wetThreshold: number;
}

export interface MoistureData {
  timestamp: number;
  value: number;
  sensorId?: number;
  isAuto?: boolean;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  permissions: string[];
}

export interface Alert {
  id: string;
  type: 'moisture' | 'system' | 'motor' | 'connection';
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export const HARI_INDONESIA = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu'
];
