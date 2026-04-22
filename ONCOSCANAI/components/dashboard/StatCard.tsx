
import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  change: string;
  changeType: 'increase' | 'decrease';
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, change, changeType }) => {
  const isIncrease = changeType === 'increase';
  const changeColor = isIncrease ? 'text-green-500' : 'text-red-500';
  const changeIcon = isIncrease ? '▲' : '▼';

  return (
    <div className="bg-white p-6 rounded-lg shadow-subtle border border-gray-200 flex items-center space-x-4">
      <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-brand-text-secondary">{title}</p>
        <div className="flex items-baseline mt-1">
          <p className="text-2xl font-bold text-brand-text-primary">{value}</p>
          <div className={`ml-2 flex items-center text-xs font-semibold ${changeColor}`}>
            <span>{changeIcon}</span>
            <span>{change}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatCard;