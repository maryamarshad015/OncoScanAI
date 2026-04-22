
import React from 'react';
import { UploadIcon, FileTextIcon, PatientDataIcon } from '../icons';

const activities = [
    { text: 'Uploaded scan for Patient ID: BC-2023-087', time: '1m ago', icon: <UploadIcon className="w-4 h-4 text-brand-pink"/> },
    { text: 'NLP report generated for Patient ID: BC-2022-001', time: '5m ago', icon: <FileTextIcon className="w-4 h-4 text-brand-blue"/> },
    { text: 'New patient record created: Jane Doe', time: '30m ago', icon: <PatientDataIcon className="w-4 h-4 text-green-500"/> },
]

const RecentActivity: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-subtle border border-gray-200">
      <h3 className="font-semibold text-brand-text-primary mb-4">Recent Activity Feed</h3>
      <ul className="space-y-4">
        {activities.map((activity, index) => (
            <li key={index} className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full mr-3">
                    {activity.icon}
                </div>
                <div className="flex-grow">
                    <p className="text-sm text-brand-text-primary">{activity.text}</p>
                    <p className="text-xs text-brand-text-secondary mt-0.5">{activity.time}</p>
                </div>
            </li>
        ))}
      </ul>
    </div>
  );
};

export default RecentActivity;
