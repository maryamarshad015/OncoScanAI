
import React from 'react';
import { useLocation } from 'react-router-dom';
import { SearchIcon, BellIcon } from '../icons';

const Header: React.FC = () => {
    const location = useLocation();
    
    const getTitle = () => {
        const path = location.pathname.replace('/dashboard', '').replace(/^\/+/, '');
        if (path === '') return 'Dashboard';

        const overrides: Record<string, string> = {
            'vision-workbench': 'HistoAnalysis',
        };

        if (overrides[path]) return overrides[path];

        return path.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    return (
        <header className="h-20 bg-brand-surface border-b border-gray-200 flex-shrink-0 flex items-center justify-between px-6 md:px-8">
            <h1 className="text-2xl font-bold text-brand-text-primary">{getTitle()}</h1>
            <div className="flex items-center space-x-6">
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>
                    <input 
                        type="text" 
                        placeholder="Search patients, reports..."
                        className="pl-10 pr-4 py-2 w-64 bg-gray-100 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-pink-light focus:border-transparent transition"
                    />
                </div>
                <button className="relative text-gray-500 hover:text-brand-text-primary transition-colors">
                    <BellIcon className="w-6 h-6"/>
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-pink opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-pink"></span>
                    </span>
                </button>
                <div className="w-px h-8 bg-gray-200"></div>
                <div className="flex items-center space-x-3 cursor-pointer group">
                    <img src="https://picsum.photos/seed/doctor/40/40" alt="Doctor" className="w-10 h-10 rounded-full" />
                    <div>
                        <p className="font-semibold text-sm text-brand-text-primary group-hover:text-brand-pink transition-colors">Doctor</p>
                        <p className="text-xs text-brand-text-secondary">Oncologist</p>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
