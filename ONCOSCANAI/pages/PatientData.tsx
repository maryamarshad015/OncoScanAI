
import React from 'react';
import { PatientDataIcon } from '../components/icons';

const PatientData: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300">
        <div className="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-full mb-4">
            <PatientDataIcon className="w-8 h-8 text-gray-500"/>
        </div>
        <h2 className="text-xl font-semibold text-brand-text-primary mb-1">No Patient Data Found</h2>
        <p className="text-brand-text-secondary max-w-md text-center mb-6">This section will contain patient records, history, and management tools. Get started by adding your first patient.</p>
        <button className="bg-brand-pink text-white font-semibold px-6 py-2.5 rounded-lg shadow-subtle hover:bg-brand-pink-dark hover:shadow-lifted transform hover:-translate-y-0.5 transition-all duration-300">
            Add New Patient
        </button>
    </div>
  );
};

export default PatientData;