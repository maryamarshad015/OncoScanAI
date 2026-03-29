import React from 'react';
import { NavLink } from 'react-router-dom';
import { DashboardIcon, PatientDataIcon, VisionIcon, SettingsIcon } from '../icons';

// Add UltrasoundIcon if needed, or reuse VisionIcon
const UltrasoundIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>
  </svg>
);

const navItems = [
  { path: '/dashboard', label: 'Overview', icon: DashboardIcon, exact: true },
  { path: '/dashboard/patient-data', label: 'Patient Records', icon: PatientDataIcon },
  { path: '/dashboard/histo-analysis', label: 'Histo Analysis', icon: VisionIcon },
  { path: '/dashboard/ultrasound-analysis', label: 'Ultrasound Analysis', icon: UltrasoundIcon },
  { path: '/dashboard/settings', label: 'System Settings', icon: SettingsIcon },
];

const Sidebar: React.FC = () => {
  const baseLinkClasses = "flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 mb-1 mx-2";
  const inactiveClasses = "text-slate-500 hover:bg-slate-100 hover:text-slate-900";
  const activeClasses = "bg-brand-pink text-white shadow-lg shadow-pink-100";

  return (
    <aside className="w-72 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col">
      <div className="h-24 flex items-center px-8">
        <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-brand-pink rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div className="flex flex-col">
                <span className="text-xl font-black text-slate-900 leading-none">OncoDetect</span>
                <span className="text-xs font-bold text-brand-pink tracking-widest uppercase mt-1">Professional</span>
            </div>
        </div>
      </div>
      <nav className="flex-1 px-4 py-6">
        {navItems.map(item => (
          <NavLink
            key={item.label}
            to={item.path}
            end={item.exact}
            className={({ isActive }) => `${baseLinkClasses} ${isActive ? activeClasses : inactiveClasses}`}
          >
            <item.icon className={`w-5 h-5 mr-3 transition-colors ${inactiveClasses}`} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
