import React from 'react';
import { ListTodo, AlertTriangle, Ban, Clock } from 'lucide-react';

export default function TodaySummaryCard({ todayTasksCount, urgentCount, blockedCount, todayHours, todayOvertimeHours }) {
    const stats = [
        {
            icon: <ListTodo className="w-4 h-4" />,
            label: 'Hoy',
            value: todayTasksCount,
            color: 'text-indigo-400',
            bg: 'bg-indigo-500/10 border border-indigo-500/20',
        },
        {
            icon: <AlertTriangle className="w-4 h-4" />,
            label: 'Urgentes',
            value: urgentCount,
            color: urgentCount > 0 ? 'text-amber-400' : 'text-slate-400',
            bg: urgentCount > 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-slate-900/70 border border-slate-800',
            pulse: urgentCount > 0,
        },
        {
            icon: <Ban className="w-4 h-4" />,
            label: 'Bloqueadas',
            value: blockedCount,
            color: blockedCount > 0 ? 'text-red-400' : 'text-slate-400',
            bg: blockedCount > 0 ? 'bg-red-500/10 border border-red-500/20' : 'bg-slate-900/70 border border-slate-800',
            pulse: blockedCount > 0,
        },
        {
            icon: <Clock className="w-4 h-4" />,
            label: 'Horas',
            value: `${todayHours.toFixed(1)}h`,
            color: todayOvertimeHours > 0 ? 'text-amber-400' : 'text-emerald-400',
            bg: todayOvertimeHours > 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-emerald-500/10 border border-emerald-500/20',
        },
    ];

    return (
        <div className="grid grid-cols-4 gap-3">
            {stats.map((s, i) => (
                <div
                    key={i}
                    className={`${s.bg} rounded-2xl px-4 py-3 flex items-center gap-3 ${s.pulse ? 'animate-pulse' : ''}`}
                >
                    <span className={`${s.color} shrink-0`}>{s.icon}</span>
                    <div>
                        <div className={`text-xl font-black ${s.color} leading-none`}>{s.value}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">{s.label}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
