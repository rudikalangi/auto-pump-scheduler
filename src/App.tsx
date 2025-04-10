import React from 'react';
import { PumpProvider } from '@/context/PumpContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Toaster } from '@/components/ui/toaster';
import Dashboard from '@/pages/Dashboard';
import '@/styles/theme.css';

const App = () => {
  return (
    <ThemeProvider>
      <PumpProvider>
        <div className="min-h-screen bg-background font-sans antialiased">
          <Dashboard />
          <Toaster />
        </div>
      </PumpProvider>
    </ThemeProvider>
  );
};

export default App;
