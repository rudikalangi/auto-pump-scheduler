import React from 'react';
import AuthGuard from '@/components/auth/AuthGuard';
import ZoneList from '@/components/zones/ZoneList';
import ZoneForm from '@/components/zones/ZoneForm';

const ZonesPage = () => {
  return (
    <AuthGuard requiredPermissions={['zones.manage']}>
      <div className="container mx-auto p-4 space-y-6">
        <h1 className="text-3xl font-bold">Irrigation Zones</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ZoneForm />
          <ZoneList />
        </div>
      </div>
    </AuthGuard>
  );
};

export default ZonesPage;
