import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PumpProvider } from "@/context/PumpContext";
import Dashboard from "./pages/Dashboard";
import Scheduler from "./pages/Scheduler";
import Settings from "./pages/Settings";
import Logs from "./pages/Logs";
import NotFound from "./pages/NotFound";
import { Toaster } from "@/components/ui/toaster";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PumpProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scheduler" element={<Scheduler />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </PumpProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
