import React, { useMemo } from 'react';
import { useEngineeringData } from '../hooks/useEngineeringData';
import {
    Users, Briefcase, Clock, AlertTriangle, TrendingUp,
    Shield, ChevronRight, Activity
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';

// Role display config
const ROLE_CONFIG = {
    manager: { label: 'Manager', color: 'from-violet-500 to-purple-600', badge: 'bg-violet-500/20 text-violet-300' },
    team_lead: { label: 'Team Lead', color: 'from-indigo-500 to-blue-600', badge: 'bg-indigo-500/20 text-indigo-300' },
    engineer: { label: 'Ingeniero', color: 'from-cyan-500 to-teal-600', badge: 'bg-cyan-500/20 text-cyan-300' },
    technician: { label: 'Técnico', color: 'from-emerald-500 to-green-600', badge: 'bg-emerald-500/20 text-emerald-300' },
};

const DEFAULT_ROLE = { label: 'Sin rol', color: 'from-slate-500 to-slate-600', badge: 'bg-slate-500/20 text-slate-400' };

export default function Team() {
    const { engTasks, timeLogs, teamMembers } = useEngineeringData();

    // Build per-member metrics
    const memberMetrics = useMemo(() => {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        return teamMembers.map(member => {
            const uid = member.uid || member.id;
            const userTasks = engTasks.filter(t => t.assignedTo === uid);
            const activeTasks = userTasks.filter(t => !['completed', 'cancelled'].includes(t.status));
            const blockedTasks = activeTasks.filter(t => t.status === 'blocked');

            // Recent time logs (7 days)
            const recentLogs = timeLogs.filter(l =>
                l.userId === uid && new Date(l.startTime || l.date) >= sevenDaysAgo
            );
            const recentHours = recentLogs.reduce((sum, l) => sum + (l.totalHours || l.hours || 0), 0);

            const capacity = member.weeklyCapacityHours || 40;
            const utilization = capacity > 0 ? Math.round((recentHours / capacity) * 100) : 0;

            return {
                ...member,
                uid,
                activeTasks: activeTasks.length,
                blockedTasks: blockedTasks.length,
                totalTasks: userTasks.length,
                recentHours: parseFloat(recentHours.toFixed(1)),
                capacity,
                utilization,
            };
        }).sort((a, b) => b.activeTasks - a.activeTasks);
    }, [teamMembers, engTasks, timeLogs]);

    // Summary stats
    const summary = useMemo(() => ({
        total: memberMetrics.length,
        overloaded: memberMetrics.filter(m => m.utilization > 100).length,
        underutilized: memberMetrics.filter(m => m.utilization < 40 && m.utilization > 0).length,
        totalActive: memberMetrics.reduce((s, m) => s + m.activeTasks, 0),
    }), [memberMetrics]);

    return (
        <div className="space-y-6">
            {/* Back Button */}
            <PageHeader title="" showBack={true} />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        Equipo de Ingeniería
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">{summary.total} miembros · {summary.totalActive} tareas activas</p>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard icon={Users} label="Miembros" value={summary.total} color="indigo" />
                <SummaryCard icon={Activity} label="Tareas activas" value={summary.totalActive} color="cyan" />
                <SummaryCard icon={AlertTriangle} label="Sobrecargados" value={summary.overloaded} color="rose" alert={summary.overloaded > 0} />
                <SummaryCard icon={TrendingUp} label="Subutilizados" value={summary.underutilized} color="amber" />
            </div>

            {/* Team grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {memberMetrics.map(member => (
                    <MemberCard key={member.uid} member={member} />
                ))}
            </div>

            {memberMetrics.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="font-bold">No hay miembros del equipo</p>
                    <p className="text-sm mt-1">Agrega miembros desde la administración de usuarios.</p>
                </div>
            )}
        </div>
    );
}

function SummaryCard({ icon: Icon, label, value, color, alert }) {
    return (
        <div className={`bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 ${alert ? 'border-rose-500/40 bg-rose-500/5' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 text-${color}-400`} />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</span>
            </div>
            <p className={`text-2xl font-black ${alert ? 'text-rose-400' : 'text-white'}`}>{value}</p>
        </div>
    );
}

function MemberCard({ member }) {
    const roleConfig = ROLE_CONFIG[member.teamRole] || DEFAULT_ROLE;

    // Utilization bar color
    let utilColor = 'bg-emerald-500';
    if (member.utilization > 100) utilColor = 'bg-rose-500';
    else if (member.utilization > 80) utilColor = 'bg-amber-500';
    else if (member.utilization < 30) utilColor = 'bg-slate-500';

    const initials = (member.displayName || member.email || '?')
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/60 transition-all group">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${roleConfig.color} flex items-center justify-center text-white font-black text-sm shadow-lg flex-shrink-0`}>
                    {initials}
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-white truncate">{member.displayName || member.email}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleConfig.badge}`}>
                            {roleConfig.label}
                        </span>
                    </div>
                </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
                <MetricItem icon={Briefcase} label="Activas" value={member.activeTasks} highlight={member.activeTasks > 8} />
                <MetricItem icon={AlertTriangle} label="Bloqueadas" value={member.blockedTasks} highlight={member.blockedTasks > 0} />
                <MetricItem icon={Clock} label="Horas (7d)" value={`${member.recentHours}h`} />
                <MetricItem icon={Shield} label="Capacidad" value={`${member.capacity}h`} />
            </div>

            {/* Utilization bar */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Utilización</span>
                    <span className={`text-xs font-black ${member.utilization > 100 ? 'text-rose-400' : member.utilization > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {member.utilization}%
                    </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${utilColor} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(member.utilization, 100)}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

function MetricItem({ icon: Icon, label, value, highlight }) {
    return (
        <div className="flex items-center gap-2">
            <Icon className={`w-3.5 h-3.5 ${highlight ? 'text-rose-400' : 'text-slate-500'}`} />
            <div>
                <p className={`text-xs font-black ${highlight ? 'text-rose-400' : 'text-white'}`}>{value}</p>
                <p className="text-[10px] text-slate-500">{label}</p>
            </div>
        </div>
    );
}
