
import React from 'react';
import QuickActionCard from '../components/dashboard/QuickActionCard';
import RecentActivity from '../components/dashboard/RecentActivity';
import { UploadIcon } from '../components/icons';

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8">
        <div className="bg-white p-6 rounded-lg shadow-subtle border border-gray-200">
            <h2 className="text-xl font-semibold text-brand-text-primary">Welcome Back, Doctor</h2>
            <p className="text-brand-text-secondary mt-1">Here's a summary of the system's activity.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                 <div className="bg-white p-6 rounded-lg shadow-subtle border border-gray-200">
                    <h3 className="font-semibold text-brand-text-primary mb-4">Quick Actions</h3>
                    <div className="flex items-center justify-center">
                        <div className="w-full max-w-[160px] text-center">
                            <QuickActionCard title="Upload New" icon={<UploadIcon className="w-6 h-6 mx-auto mb-2 text-brand-pink"/>} />
                        </div>
                    </div>
                </div>
            </div>
            <div className="lg:col-span-2 space-y-6">
                <RecentActivity />
            </div>
        </div>
    </div>
  );
};

export default Dashboard;
