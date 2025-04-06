import React from 'react';
import AuthGuard from '@/components/auth/AuthGuard';
import ActivityLogViewer from '@/components/monitoring/ActivityLogViewer';

const Logs: React.FC = () => {
  return (
    <AuthGuard requiredPermissions={['logs.view']}>
      <div className="container mx-auto p-4 space-y-6">
        <h1 className="text-3xl font-bold">System Logs</h1>
        <ActivityLogViewer />
      </div>
    </AuthGuard>
  );
};

export default Logs;
