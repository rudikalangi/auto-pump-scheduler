import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User } from '@/types';
import { toast } from '@/components/ui/use-toast';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('pump_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Save user to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('pump_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('pump_user');
    }
  }, [user]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      // In a real app, this would be an API call
      // For now, we'll simulate authentication
      if (username === 'admin' && password === 'admin') {
        const user: User = {
          id: '1',
          username: 'admin',
          role: 'admin',
          permissions: ['system.control', 'schedules.manage', 'zones.manage', 'logs.view']
        };
        setUser(user);
        toast({
          title: "Welcome",
          description: `Logged in as ${username}`,
        });
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      toast({
        title: "Login Failed",
        description: error instanceof Error ? error.message : 'Authentication failed',
        variant: "destructive"
      });
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully",
    });
  }, []);

  const hasPermission = useCallback((permission: string) => {
    if (!user) return false;
    return user.permissions.includes(permission);
  }, [user]);

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    hasPermission
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
