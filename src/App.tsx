import React from 'react';
import { PumpProvider } from '@/context/PumpContext';
import { Toaster } from '@/components/ui/toaster';
import Dashboard from '@/pages/Dashboard';
import '@/styles/theme.css';

const App = () => {
  return (
    <PumpProvider>
      <div className="min-h-screen bg-background font-sans antialiased">
        <Dashboard />
        <Toaster />
      </div>
    </PumpProvider>
  );
};

export default App;
