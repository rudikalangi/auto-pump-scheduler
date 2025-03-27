
import React from 'react';
import { Link } from 'react-router-dom';
import { Droplet, BarChart2, Clock, Settings, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

const Header: React.FC = () => {
  const location = useLocation();
  
  const navigation: NavigationItem[] = [
    { name: 'Dashboard', href: '/', icon: <BarChart2 className="w-5 h-5" /> },
    { name: 'Scheduler', href: '/scheduler', icon: <Clock className="w-5 h-5" /> },
    { name: 'Settings', href: '/settings', icon: <Settings className="w-5 h-5" /> },
    { name: 'Logs', href: '/logs', icon: <List className="w-5 h-5" /> },
  ];

  return (
    <header className="w-full py-4 px-6 glass-panel mb-8 animate-fade-in">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
        <div className="flex items-center mb-4 md:mb-0">
          <Droplet className="h-8 w-8 text-primary mr-2" />
          <h1 className="text-2xl font-semibold text-gray-800">
            Auto Irrigation System
          </h1>
        </div>
        
        <nav className="flex space-x-1 sm:space-x-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "px-3 py-2 rounded-lg transition-all duration-200 flex items-center",
                location.pathname === item.href
                  ? "bg-primary text-white shadow-md"
                  : "hover:bg-secondary text-gray-700 hover:text-gray-900"
              )}
            >
              {item.icon}
              <span className="ml-2 hidden sm:inline">{item.name}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default Header;
