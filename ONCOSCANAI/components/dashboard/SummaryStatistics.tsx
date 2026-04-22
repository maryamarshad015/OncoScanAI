
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Jan', Detections: 40, Scans: 24 },
  { name: 'Feb', Detections: 30, Scans: 13 },
  { name: 'Mar', Detections: 20, Scans: 98 },
  { name: 'Apr', Detections: 27, Scans: 39 },
  { name: 'May', Detections: 18, Scans: 48 },
  { name: 'Jun', Detections: 23, Scans: 38 },
  { name: 'Jul', Detections: 34, Scans: 43 },
];

const SummaryStatistics: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="font-semibold text-brand-text-primary mb-4">Summary Statistics</h3>
      <div style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
                contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem'
                }}
            />
            <Bar dataKey="Scans" fill="#D973A8" name="Scans" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Detections" fill="#F4B4D4" name="Detections" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SummaryStatistics;
