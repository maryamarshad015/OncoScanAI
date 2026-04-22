
import React from 'react';
import { SettingsIcon } from '../components/icons';

const Settings: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300">
        <div className="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-full mb-4">
            <SettingsIcon className="w-8 h-8 text-gray-500"/>
        </div>
        <h2 className="text-xl font-semibold text-brand-text-primary mb-1">Application Settings</h2>
        <p className="text-brand-text-secondary max-w-md text-center">User preferences, account details, and system configurations will be available for management here.</p>
    </div>
  );
};

export default Settings;