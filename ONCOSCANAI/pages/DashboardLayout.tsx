
import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/dashboard/Header';

const DashboardLayout: React.FC = () => {
  return (
    <div className="flex h-screen bg-brand-background font-sans">
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-brand-background p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
