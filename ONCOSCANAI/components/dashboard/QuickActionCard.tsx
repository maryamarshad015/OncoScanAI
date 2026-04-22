
import React from 'react';

interface QuickActionCardProps {
  title: string;
  icon: React.ReactNode;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({ title, icon }) => {
  return (
    <div className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors">
      {icon}
      <p className="text-xs font-medium text-brand-text-secondary">{title}</p>
    </div>
  );
};

export default QuickActionCard;
