import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, User, Activity, Map } from 'lucide-react';

const MAIN_TABS = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/my-work', label: 'Mi Trabajo', icon: User },
    { to: '/daily-briefing', label: 'Daily Briefing', icon: Activity },
    { to: '/overview', label: 'Cómo Funciona', icon: Map },
];

export default function MainLayout() {
    const location = useLocation();

    return (
        <div className="-m-4 md:-m-8 flex flex-col bg-slate-950 text-white animate-in fade-in duration-300" style={{ minHeight: '100vh' }}>
            {/* ── Tab Navigation — same style as ReportsLayout / TaskModuleBanner ── */}
            <div className="shrink-0">
                <div className="flex items-center px-3 md:px-6 bg-slate-900/70 border-b border-slate-800/50">
                    <div className="flex items-center gap-0 overflow-x-auto scrollbar-none flex-1">
                        {MAIN_TABS.map(tab => {
                            const Icon = tab.icon;
                            const isActive = tab.exact
                                ? location.pathname === tab.to
                                : location.pathname === tab.to || location.pathname.startsWith(tab.to + '/');
                            return (
                                <NavLink
                                    key={tab.to}
                                    to={tab.to}
                                    end={tab.exact}
                                    className={`relative flex items-center gap-1.5 px-2.5 md:px-4 py-2.5 md:py-3 text-[11px] md:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${isActive
                                        ? 'text-white'
                                        : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {tab.label}
                                    {isActive && (
                                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full" />
                                    )}
                                </NavLink>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Page Content — rendered by child route via Outlet */}
            <div className="flex-1 overflow-y-auto p-3 md:p-5">
                <Outlet />
            </div>
        </div>
    );
}
