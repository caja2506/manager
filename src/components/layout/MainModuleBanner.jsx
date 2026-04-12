import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, User, Activity, Map } from 'lucide-react';

/**
 * MainModuleBanner — Tab navigation bar for the "Principal" section.
 * Same visual style as TaskModuleBanner for consistency.
 */

const TABS = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, exact: true },
    { label: 'Mi Trabajo', path: '/my-work', icon: User },
    { label: 'Daily Briefing', path: '/daily-briefing', icon: Activity },
    { label: 'Cómo Funciona', path: '/overview', icon: Map },
];

export default function MainModuleBanner({ children }) {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="shrink-0 flex items-center gap-0 px-3 md:px-6 bg-slate-100 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800/50 overflow-x-auto scrollbar-none">
            {/* Tab Navigation */}
            {TABS.map(tab => {
                const isActive = tab.exact
                    ? location.pathname === tab.path
                    : location.pathname.startsWith(tab.path);
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.path}
                        onClick={() => navigate(tab.path)}
                        className={`relative flex items-center gap-1.5 px-2.5 md:px-4 py-2.5 md:py-3 text-[11px] md:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${isActive
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        {tab.label}
                        {isActive && (
                            <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-indigo-500 rounded-t-full" />
                        )}
                    </button>
                );
            })}

            {/* Page-specific toolbar (children slot) */}
            {children && (
                <div className="ml-auto flex items-center gap-2">
                    {children}
                </div>
            )}
        </div>
    );
}
