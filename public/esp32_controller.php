
<?php
// ESP32 Controller Script for Perkins Pump System
// Save this file to your XAMPP htdocs directory

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Process preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Get the request data
$request_body = file_get_contents('php://input');
$data = json_decode($request_body, true);

// Default response
$response = [
    'status' => 'error',
    'message' => 'Invalid request',
    'data' => null
];

// Process the command
if (isset($data['command'])) {
    switch ($data['command']) {
        case 'system_on':
            // Code to turn on system power relay
            // GPIO pin logic would go here in a real implementation
            $response = [
                'status' => 'success',
                'message' => 'System power turned ON',
                'data' => ['systemState' => 'on']
            ];
            break;
            
        case 'start_motor':
            // Code to activate starter motor relay
            // GPIO pin logic would go here in a real implementation
            $response = [
                'status' => 'success',
                'message' => 'Motor started',
                'data' => ['motorState' => 'running']
            ];
            break;
            
        case 'stop_all':
            // Code to turn off all relays
            // GPIO pin logic would go here in a real implementation
            $response = [
                'status' => 'success',
                'message' => 'System and motor stopped',
                'data' => ['systemState' => 'off', 'motorState' => 'stopped']
            ];
            break;
            
        case 'status':
            // Code to check current status
            // In a real implementation, would read GPIO pin states
            $response = [
                'status' => 'success',
                'message' => 'Status retrieved',
                'data' => [
                    'systemState' => rand(0, 1) ? 'on' : 'off',
                    'motorState' => rand(0, 1) ? 'running' : 'stopped',
                    'uptime' => rand(100, 100000),
                    'temperature' => rand(30, 45)
                ]
            ];
            break;
            
        case 'schedule':
            // Code to handle scheduling
            // In a real implementation, would store schedule data in ESP32 memory
            $response = [
                'status' => 'success',
                'message' => 'Schedule updated',
                'data' => ['scheduleId' => uniqid()]
            ];
            break;
            
        default:
            $response = [
                'status' => 'error',
                'message' => 'Unknown command',
                'data' => null
            ];
    }
} else {
    // If no command is provided, return system info
    $response = [
        'status' => 'success',
        'message' => 'ESP32 controller online',
        'data' => [
            'device' => 'ESP32',
            'firmware' => '1.0.0',
            'uptime' => rand(100, 100000),
            'ip' => $_SERVER['SERVER_ADDR'] ?? '192.168.1.100'
        ]
    ];
}

// Output the response
echo json_encode($response);
?>
