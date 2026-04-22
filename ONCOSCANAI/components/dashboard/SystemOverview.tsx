
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';

const dataAccuracy = [{ name: 'Accuracy', value: 98.7 }, { name: 'Remaining', value: 1.3 }];
const dataStorage = [{ name: 'Used', value: 450 }, { name: 'Remaining', value: 574 }];

const COLORS_ACCURACY = ['#D973A8', '#E0E7FF'];
const COLORS_STORAGE = ['#4A90E2', '#E0E7FF'];

const SystemOverview: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="font-semibold text-brand-text-primary mb-4">System Overview</h3>
      <div className="flex justify-around items-center">
        <div className="text-center w-1/2">
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={dataAccuracy} cx="50%" cy="50%" innerRadius={40} outerRadius={55} dataKey="value" stroke="none" startAngle={90} endAngle={450}>
                {dataAccuracy.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS_ACCURACY[index % COLORS_ACCURACY.length]} />
                ))}
                <Label value="98.7%" position="center" className="text-2xl font-bold fill-brand-text-primary" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <p className="text-sm font-medium text-brand-text-secondary mt-2">Detection Accuracy</p>
        </div>
        <div className="text-center w-1/2">
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={dataStorage} cx="50%" cy="50%" innerRadius={40} outerRadius={55} dataKey="value" stroke="none" startAngle={90} endAngle={450}>
                {dataStorage.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS_STORAGE[index % COLORS_STORAGE.length]} />
                ))}
                 <Label value="450GB" position="center" className="text-2xl font-bold fill-brand-text-primary" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <p className="text-sm font-medium text-brand-text-secondary mt-2">Live system 15 mins ago</p>
        </div>
      </div>
    </div>
  );
};

export default SystemOverview;
