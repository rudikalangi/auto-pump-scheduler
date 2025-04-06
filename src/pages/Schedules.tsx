import React from 'react';
import AuthGuard from '@/components/auth/AuthGuard';
import ScheduleList from '@/components/scheduling/ScheduleList';
import ScheduleForm from '@/components/scheduling/ScheduleForm';

const SchedulesPage = () => {
  return (
    <AuthGuard requiredPermissions={['schedules.manage']}>
      <div className="container mx-auto p-4 space-y-6">
        <h1 className="text-3xl font-bold">Schedules</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ScheduleForm />
          <ScheduleList />
        </div>
      </div>
    </AuthGuard>
  );
};

export default SchedulesPage;
