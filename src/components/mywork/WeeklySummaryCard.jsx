import React from 'react';
import { CalendarDays, TrendingUp, CheckCircle2, AlertTriangle, Ban, Clock, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function BarStat({ label, value, max, color, textColor }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500">{label}</span>
                <span className={textColor}>{value.toFixed(1)}h</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} rounded-full transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function StatPill({ icon, label, value, color }) {
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${color}`}>
            <span className="shrink-0">{icon}</span>
            <div>
                <div className="text-base font-black leading-none">{value}</div>
                <div className="text-[10px] font-bold opacity-70 mt-0.5">{label}</div>
            </div>
        </div>
    );
}

export default function WeeklySummaryCard({ weeklyStats, weekStart, weekEnd }) {
    const { plannedHours, actualHours, estimatedHours, completedCount, overdueCount, blockedCount, utilizationPct } = weeklyStats;

    const weekLabel = weekStart && weekEnd
        ? `${format(weekStart, 'd MMM', { locale: es })} — ${format(weekEnd, 'd MMM', { locale: es })}`
        : '';

    const weekStatus = (() => {
        if (blockedCount > 0 || overdueCount > 2) return { label: 'En Riesgo', color: 'text-red-400 bg-red-500/15', dot: 'bg-red-500' };
        if (utilizationPct >= 80) return { label: 'Bien encaminado', color: 'text-emerald-400 bg-emerald-500/15', dot: 'bg-emerald-500' };
        if (utilizationPct >= 40) return { label: 'En progreso', color: 'text-indigo-400 bg-indigo-500/15', dot: 'bg-indigo-500' };
        return { label: 'Semana suave', color: 'text-slate-500 bg-slate-800', dot: 'bg-slate-400' };
    })();

    return (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-indigo-500" />
                    <h3 className="font-black text-slate-200 text-sm">Esta Semana</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">{weekLabel}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${weekStatus.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${weekStatus.dot}`} />
                        {weekStatus.label}
                    </span>
                </div>
            </div>

            <div className="p-5 space-y-5">
                {/* Utilization bar */}
                <div>
                    <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Utilización</span>
                        <span className={`text-sm font-black ${utilizationPct >= 80 ? 'text-emerald-400' : utilizationPct >= 40 ? 'text-indigo-400' : 'text-slate-400'}`}>
                            {utilizationPct}%
                        </span>
                    </div>
                    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${
                                utilizationPct >= 80 ? 'bg-gradient-to-r from-emerald-400 to-green-500' :
                                utilizationPct >= 40 ? 'bg-gradient-to-r from-indigo-400 to-purple-500' :
                                'bg-slate-600'
                            }`}
                            style={{ width: `${utilizationPct}%` }}
                        />
                    </div>
                </div>

                {/* Hours breakdown */}
                <div className="space-y-2.5">
                    <BarStat
                        label="Planificadas"
                        value={plannedHours}
                        max={Math.max(estimatedHours, plannedHours, actualHours, 40)}
                        color="bg-indigo-400"
                        textColor="text-indigo-400"
                    />
                    <BarStat
                        label="Ejecutadas"
                        value={actualHours}
                        max={Math.max(estimatedHours, plannedHours, actualHours, 40)}
                        color="bg-emerald-400"
                        textColor="text-emerald-400"
                    />
                    <BarStat
                        label="Estimadas total"
                        value={estimatedHours}
                        max={Math.max(estimatedHours, plannedHours, actualHours, 40)}
                        color="bg-slate-600"
                        textColor="text-slate-500"
                    />
                </div>

                {/* Stats pills */}
                <div className="grid grid-cols-3 gap-2">
                    <StatPill
                        icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        label="Completadas"
                        value={completedCount}
                        color="bg-emerald-500/15 text-emerald-400"
                    />
                    <StatPill
                        icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                        label="Vencidas"
                        value={overdueCount}
                        color={overdueCount > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-800 text-slate-500'}
                    />
                    <StatPill
                        icon={<Ban className="w-3.5 h-3.5 text-red-500" />}
                        label="Bloqueadas"
                        value={blockedCount}
                        color={blockedCount > 0 ? 'bg-red-500/15 text-red-400' : 'bg-slate-800 text-slate-500'}
                    />
                </div>
            </div>
        </div>
    );
}
