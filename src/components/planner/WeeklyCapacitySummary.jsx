import React from 'react';
import { Clock, Zap, AlertTriangle, Users } from 'lucide-react';

/**
 * Shows aggregated planned hours per person and per day for the visible week.
 *
 * Data source: enriched plan items via enrichPlanItemsWithTasks().
 * Uses `item.assigneeDisplayName` (live data with snapshot fallback)
 * instead of directly reading `item.assignedToName`.
 */
export default function WeeklyCapacitySummary({ planItems, teamMembers, weekDays }) {
    const DAILY_CAPACITY = 8; // hours

    // Build: { uid: { name, days: { YYYY-MM-DD: number } } }
    const perPerson = {};

    planItems.forEach(item => {
        const uid  = item.assignedTo;
        const date = item.date;
        const hrs  = item.plannedHours || 0;
        if (!uid || !date) return;

        if (!perPerson[uid]) {
            const member = teamMembers.find(m => m.uid === uid);
            // Prefer enriched name, then teamMember lookup, then UID prefix
            perPerson[uid] = {
                name: item.assigneeDisplayName || member?.displayName || item.assignedToName || uid.slice(0, 6),
                total: 0,
                days: {},
            };
        }

        perPerson[uid].total                     += hrs;
        perPerson[uid].days[date]                = (perPerson[uid].days[date] || 0) + hrs;
    });

    const entries = Object.values(perPerson).sort((a, b) => b.total - a.total);

    if (entries.length === 0) return null;

    return (
        <div className="bg-slate-900 border-t border-slate-800 p-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                Resumen de Carga Semanal
            </h3>

            <div className="space-y-3">
                {entries.map(p => {
                    const weeklyLoad = p.total;
                    const weeklyCapacity = DAILY_CAPACITY * weekDays.length;
                    const pct   = Math.min(100, (weeklyLoad / weeklyCapacity) * 100);
                    const isOvr = weeklyLoad > weeklyCapacity;
                    const isHvy = !isOvr && weeklyLoad > weeklyCapacity * 0.85;

                    return (
                        <div key={p.name} className="flex items-center gap-3">
                            <div className="w-32 shrink-0 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 font-black text-[10px] flex items-center justify-center shrink-0">
                                    {p.name[0].toUpperCase()}
                                </div>
                                <span className="text-xs font-bold text-slate-600 truncate">{p.name}</span>
                            </div>
                            <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${
                                        isOvr ? 'bg-rose-500' : isHvy ? 'bg-amber-500' : 'bg-indigo-500'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <div className="w-20 text-right flex items-center justify-end gap-1 shrink-0">
                                {isOvr && <Zap className="w-3 h-3 text-rose-500 shrink-0" />}
                                <span className={`text-xs font-black ${isOvr ? 'text-rose-600' : isHvy ? 'text-amber-400' : 'text-slate-600'}`}>
                                    {weeklyLoad.toFixed(1)}h
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
