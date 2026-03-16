import React from 'react';
import { Bell, AlertCircle } from 'lucide-react';
import { getUrgencyColor, getUrgencyLabel } from '../../automation/optimizationService';

export default function InterventionAlertsCard({ interventions = [] }) {
    if (!interventions || interventions.length === 0) {
        return (
            <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                    <Bell className="w-5 h-5 text-rose-400" />
                    <h3 className="text-sm font-semibold text-slate-200">Intervenciones Sugeridas</h3>
                </div>
                <p className="text-xs text-slate-500 text-center py-6">Sin intervenciones pendientes. La operación está estable.</p>
            </div>
        );
    }

    // Group by urgency
    const grouped = {};
    for (const i of interventions) {
        const key = i.urgency || 'watch';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(i);
    }

    const urgencyOrder = ['act_now', 'act_soon', 'watch'];

    return (
        <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-rose-400" />
                    <h3 className="text-sm font-semibold text-slate-200">Intervenciones Sugeridas</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-medium">{interventions.length}</span>
                </div>
            </div>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                {urgencyOrder.map(urgency => {
                    const items = grouped[urgency];
                    if (!items || items.length === 0) return null;
                    return (
                        <div key={urgency}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: getUrgencyColor(urgency) }}>
                                {getUrgencyLabel(urgency)}
                            </p>
                            <div className="space-y-2">
                                {items.map((item, i) => (
                                    <div key={item.id || i} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30" style={{ borderLeftColor: getUrgencyColor(item.urgency), borderLeftWidth: 3 }}>
                                        <div className="flex items-start gap-2">
                                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: getUrgencyColor(item.urgency) }} />
                                            <div className="min-w-0">
                                                <p className="text-xs text-slate-200 font-medium mb-1">{item.action}</p>
                                                <p className="text-[10px] text-slate-500 leading-relaxed">{item.reason}</p>
                                                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-600">
                                                    {item.target?.name && <span>👤 {item.target.name}</span>}
                                                    {item.deadline && <span>📅 {item.deadline}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
