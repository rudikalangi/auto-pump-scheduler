
/**
 * ESP32 communication utility
 * This module provides functions to communicate with the ESP32 controller via HTTP
 */

// Base URL for the ESP32 controller
let baseUrl = '';

/**
 * Set the ESP32 controller IP address
 * @param ip - IP address of the ESP32
 */
export const setEsp32Ip = (ip: string) => {
  baseUrl = `http://${ip}/esp32_controller.php`;
};

/**
 * Send a command to the ESP32
 * @param command - Command to send
 * @param params - Additional parameters
 * @returns Promise with the response
 */
export const sendCommand = async (command: string, params: Record<string, any> = {}) => {
  try {
    if (!baseUrl) {
      throw new Error('ESP32 IP not set');
    }
    
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command,
        ...params,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error communicating with ESP32:', error);
    throw error;
  }
};

/**
 * Get the current status of the ESP32 and pumping system
 * @returns Promise with the status data
 */
export const getStatus = async () => {
  return sendCommand('status');
};

/**
 * Turn on the system power
 * @returns Promise with the response
 */
export const systemOn = async () => {
  return sendCommand('system_on');
};

/**
 * Start the motor
 * @returns Promise with the response
 */
export const startMotor = async () => {
  return sendCommand('start_motor');
};

/**
 * Stop all systems (emergency stop)
 * @returns Promise with the response
 */
export const stopAll = async () => {
  return sendCommand('stop_all');
};

/**
 * Update the schedule on the ESP32
 * @param schedules - Array of schedule objects
 * @returns Promise with the response
 */
export const updateSchedule = async (schedules: any[]) => {
  return sendCommand('schedule', { schedules });
};
