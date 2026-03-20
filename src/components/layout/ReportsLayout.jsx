import React, { useState, useMemo } from 'react';
import PageHeader from './PageHeader';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEngineeringData } from '../../hooks/useEngineeringData';
import { Clock, FileText, BarChart3, LineChart } from 'lucide-react';

const REPORT_TABS = [
    { to: '/work-logs', label: 'Registro Horas', icon: Clock },
    { to: '/reports/daily', label: 'Reporte Diario', icon: FileText },
    { to: '/reports/weekly', label: 'Reporte Semanal', icon: BarChart3 },
    { to: '/analytics', label: 'Analítica', icon: LineChart },
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
        <div className="space-y-5 animate-in fade-in duration-300">
            <PageHeader title="" showBack={true} />
            {/* Shared Banner */}
            <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
                {/* Top row: Title + User Filter */}
                <div className="flex flex-col md:flex-row justify-between gap-4 p-6 pb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center">
                            <BarChart3 className="w-7 h-7 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="font-black text-2xl text-white tracking-tight">Reportes y Analítica</h2>
                            <p className="text-sm text-slate-400 font-bold mt-1">
                                {selectedMember?.displayName || selectedMember?.name || selectedMember?.email || 'Seleccionar usuario'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-end md:items-center">
                        {/* User Filter */}
                        <div className="bg-slate-800 border border-slate-700 rounded-xl flex items-center p-1.5 w-full sm:w-auto">
                            <select
                                value={selectedUser}
                                onChange={e => setSelectedUser(e.target.value)}
                                className="bg-transparent border-none text-sm font-bold text-slate-200 py-1.5 px-3 focus:ring-0 cursor-pointer outline-none w-full"
                            >
                                {engineersAndTechs.map(m => (
                                    <option key={m.uid} value={m.uid}>{m.displayName || m.name || m.email}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-t border-slate-800 px-2">
                    {REPORT_TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = location.pathname === tab.to || location.pathname.startsWith(tab.to + '/');
                        return (
                            <NavLink
                                key={tab.to}
                                to={tab.to}
                                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${isActive
                                        ? 'border-indigo-500 text-indigo-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </NavLink>
                        );
                    })}
                </div>
            </div>

            {/* Page Content — rendered by child route via Outlet */}
            <Outlet context={{ selectedUser, selectedMember }} />
        </div>
    );
}
