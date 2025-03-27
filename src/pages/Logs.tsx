
import React from 'react';
import { Trash2 } from 'lucide-react';
import Header from '@/components/Header';
import LogItem from '@/components/LogItem';
import { usePump } from '@/context/PumpContext';

const Logs: React.FC = () => {
  const { logs, clearLogs } = usePump();
  
  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <Header />
      
      <main className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Activity Logs</h2>
          
          <button
            onClick={clearLogs}
            disabled={logs.length === 0}
            className="flex items-center space-x-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-5 w-5" />
            <span>Clear Logs</span>
          </button>
        </div>
        
        {logs.length === 0 ? (
          <div className="glass-panel p-10 text-center">
            <h3 className="text-xl font-medium text-gray-800 mb-2">No Activity Logs</h3>
            <p className="text-gray-600">
              System activity will be recorded here as you use the application.
            </p>
          </div>
        ) : (
          <div className="glass-panel p-6 overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3">
              {logs.map((log) => (
                <LogItem key={log.id} log={log} />
              ))}
            </div>
          </div>
        )}
        
        <div className="glass-panel p-6 mt-8">
          <h3 className="text-lg font-medium text-gray-800 mb-4">About Activity Logs</h3>
          <div className="prose max-w-none">
            <p>
              The activity log provides a chronological record of all actions and events in your irrigation system, including:
            </p>
            
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>System power on/off events</li>
              <li>Motor start/stop events</li>
              <li>Schedule additions, modifications, and deletions</li>
              <li>Connection status changes</li>
              <li>Error conditions and warnings</li>
            </ul>
            
            <p className="mt-4">
              Logs are color-coded by type: information (blue), success (green), warning (yellow), and error (red).
              The system keeps track of the most recent 100 events.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Logs;
