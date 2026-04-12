import React, { useState, useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEngineeringData } from '../../hooks/useEngineeringData';
import { Clock, FileText, BarChart3, LineChart, Activity, ListTodo } from 'lucide-react';

const REPORT_TABS = [
    { to: '/work-logs', label: 'Registro Horas', icon: Clock },
    { to: '/reports/daily', label: 'Reporte Diario', icon: FileText },
    { to: '/reports/weekly', label: 'Reporte Semanal', icon: BarChart3 },
    { to: '/analytics', label: 'Analítica', icon: LineChart },
    { to: '/reports/activity', label: 'Actividad', icon: Activity },
    { to: '/tasks', label: 'Tareas', icon: ListTodo },
];

export default function ReportsLayout() {
    const { user } = useAuth();
    const { teamMembers } = useEngineeringData();
    const location = useLocation();

    const [selectedUser, setSelectedUser] = useState(user?.uid || '');

    const engineersAndTechs = useMemo(() =>
        teamMembers.filter(u => ['engineer', 'technician', 'team_lead', 'manager'].includes(u.teamRole) || !u.teamRole),
        [teamMembers]
    );

    const selectedMember = teamMembers.find(m => m.uid === selectedUser);

    return (
        <div className="-m-4 md:-m-8 flex flex-col bg-slate-950 text-white animate-in fade-in duration-300" style={{ minHeight: '100vh' }}>
            {/* ── Main Banner Row — same style as TaskModuleBanner ── */}
            <div className="shrink-0">
                {/* ── Tab Navigation + User Filter in same row ── */}
                <div className="flex items-center px-3 md:px-6 bg-slate-900/70 border-b border-slate-800/50">
                    <div className="flex items-center gap-0 overflow-x-auto scrollbar-none flex-1">
                        {REPORT_TABS.map(tab => {
                            const Icon = tab.icon;
                            const isActive = location.pathname === tab.to || location.pathname.startsWith(tab.to + '/');
                            return (
                                <NavLink
                                    key={tab.to}
                                    to={tab.to}
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

                    {/* User filter — inline, right side */}
                    {!['/analytics', '/reports/activity'].includes(location.pathname) && (
                        <select
                            value={selectedUser}
                            onChange={e => setSelectedUser(e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 py-1.5 px-2.5 rounded-lg focus:ring-0 cursor-pointer outline-none shrink-0 ml-2"
                        >
                            {engineersAndTechs.map(m => (
                                <option key={m.uid} value={m.uid}>{m.displayName || m.name || m.email}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Page Content — rendered by child route via Outlet */}
            <div className="flex-1 overflow-y-auto p-3 md:p-5">
                <Outlet context={{ selectedUser, selectedMember }} />
            </div>
        </div>
    );
}
