import React, { useState, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEngineeringData } from '../../hooks/useEngineeringData';
import { Clock, FileText, BarChart3, LineChart, Activity, ArrowLeft } from 'lucide-react';

const REPORT_TABS = [
    { to: '/work-logs', label: 'Registro Horas', icon: Clock },
    { to: '/reports/daily', label: 'Reporte Diario', icon: FileText },
    { to: '/reports/weekly', label: 'Reporte Semanal', icon: BarChart3 },
    { to: '/analytics', label: 'Analítica', icon: LineChart },
    { to: '/reports/activity', label: 'Actividad', icon: Activity },
];

export default function ReportsLayout() {
    const { user } = useAuth();
    const { teamMembers } = useEngineeringData();
    const location = useLocation();
    const navigate = useNavigate();

    const [selectedUser, setSelectedUser] = useState(user?.uid || '');

    const engineersAndTechs = useMemo(() =>
        teamMembers.filter(u => ['engineer', 'technician', 'team_lead', 'manager'].includes(u.teamRole) || !u.teamRole),
        [teamMembers]
    );

    const selectedMember = teamMembers.find(m => m.uid === selectedUser);

    // Get initials for avatar
    const initials = (() => {
        const name = user?.displayName || user?.email || '?';
        const parts = name.trim().split(/\s+/);
        return parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : name[0].toUpperCase();
    })();

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* ── Main Banner Row — same style as TaskModuleBanner ── */}
            <div className="shrink-0">
                <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/60">
                    {/* Left: Back + Icon + Title + Stats */}
                    <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all shrink-0"
                            title="Volver"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                            <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="font-black text-base md:text-lg text-white tracking-tight leading-none truncate">
                                Reportes y Analítica
                            </h1>
                            <p className="text-[10px] md:text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                                <span className="truncate">
                                    {selectedMember?.displayName || selectedMember?.name || selectedMember?.email || 'Seleccionar usuario'}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Right: User filter + Avatar */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* User Filter — only on pages that don't have their own filters */}
                        {!['/analytics', '/reports/activity'].includes(location.pathname) && (
                            <div className="bg-slate-800 border border-slate-700 rounded-xl flex items-center p-1 w-full sm:w-auto">
                                <select
                                    value={selectedUser}
                                    onChange={e => setSelectedUser(e.target.value)}
                                    className="bg-transparent border-none text-xs md:text-sm font-bold text-slate-200 py-1 px-2 focus:ring-0 cursor-pointer outline-none w-full"
                                >
                                    {engineersAndTechs.map(m => (
                                        <option key={m.uid} value={m.uid}>{m.displayName || m.name || m.email}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* User avatar */}
                        <div
                            className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-[10px] md:text-[11px] font-bold ring-2 ring-emerald-500/40 cursor-pointer hover:ring-emerald-400/60 transition-all shrink-0 hidden sm:flex"
                            style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', color: '#065f46' }}
                            title={user?.displayName || user?.email}
                        >
                            {initials}
                        </div>
                    </div>
                </div>

                {/* ── Tab Navigation — same style as TaskModuleBanner ── */}
                <div className="flex items-center gap-0 px-3 md:px-6 bg-slate-900/70 border-b border-slate-800/50 overflow-x-auto scrollbar-none">
                    {REPORT_TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = location.pathname === tab.to || location.pathname.startsWith(tab.to + '/');
                        return (
                            <NavLink
                                key={tab.to}
                                to={tab.to}
                                className={`relative flex items-center gap-1.5 px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${isActive
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

            {/* Page Content — rendered by child route via Outlet */}
            <div className="flex-1 overflow-y-auto p-3 md:p-5">
                <Outlet context={{ selectedUser, selectedMember }} />
            </div>
        </div>
    );
}
