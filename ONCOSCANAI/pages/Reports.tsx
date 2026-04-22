
import React from 'react';
import { ReportsIcon } from '../components/icons';

const Reports: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300">
        <div className="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-full mb-4">
            <ReportsIcon className="w-8 h-8 text-gray-500"/>
        </div>
        <h2 className="text-xl font-semibold text-brand-text-primary mb-1">Diagnostic Reports</h2>
        <p className="text-brand-text-secondary max-w-md text-center mb-6">View, manage, and generate comprehensive diagnostic reports based on the AI analysis of uploaded scans.</p>
        <button className="bg-brand-pink text-white font-semibold px-6 py-2.5 rounded-lg shadow-subtle hover:bg-brand-pink-dark hover:shadow-lifted transform hover:-translate-y-0.5 transition-all duration-300">
            Generate First Report
        </button>
    </div>
  );
};

export default Reports;