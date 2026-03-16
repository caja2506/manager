import React from 'react';
import { Calendar, AlertTriangle, Users, Target, TrendingDown, TrendingUp } from 'lucide-react';

export default function OperationalPlanCard({ plans = [] }) {
    const plan = plans.length > 0 ? plans[0] : null;

    if (!plan) {
        return (
            <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-slate-200">Plan Operativo</h3>
                </div>
                <p className="text-xs text-slate-500 text-center py-6">Sin plan generado. Ejecuta un escaneo de optimización.</p>
            </div>
        );
    }

    const { focusAreas = [], criticalRoutines = [], riskWatchlist = [], userLoads = [], trendPredictions } = plan;
    const isWeekly = plan.planType === 'weekly';

    return (
        <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-slate-200">
                        {isWeekly ? 'Outlook Semanal' : 'Plan Diario'}
                    </h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                        {plan.date || plan.weekStart}
                    </span>
                </div>
            </div>

            {/* Focus Areas */}
            {focusAreas.length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Target className="w-3.5 h-3.5 text-cyan-400" />
                        <p className="text-[11px] font-medium text-slate-300">Enfoque</p>
                    </div>
                    <div className="space-y-1">
                        {focusAreas.map((area, i) => (
                            <div key={i} className="text-xs text-slate-400 bg-slate-900/40 rounded px-2.5 py-1.5">
                                {area}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Critical Routines */}
            {criticalRoutines.length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <p className="text-[11px] font-medium text-slate-300">Rutinas Críticas ({criticalRoutines.length})</p>
                    </div>
                    <div className="space-y-1">
                        {criticalRoutines.map((r, i) => (
                            <div key={i} className="flex items-center justify-between text-xs bg-amber-500/5 rounded px-2.5 py-1.5 border border-amber-500/10">
                                <span className="text-slate-300">{r.routineName}</span>
                                <span className="text-amber-400 text-[10px]">{r.reason}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* User Loads */}
            {userLoads.length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <p className="text-[11px] font-medium text-slate-300">Carga del Equipo</p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                        {userLoads.slice(0, 6).map((u, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] bg-slate-900/40 rounded px-2 py-1.5">
                                <span className="text-slate-400 truncate mr-2">{u.userName || 'Usuario'}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${u.loadLevel === 'high' ? 'bg-red-500/20 text-red-400' :
                                        u.loadLevel === 'low' ? 'bg-green-500/20 text-green-400' :
                                            'bg-slate-700/50 text-slate-500'
                                    }`}>
                                    {u.loadLevel === 'high' ? 'Alta' : u.loadLevel === 'low' ? 'Baja' : 'Normal'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Trend Predictions (weekly only) */}
            {isWeekly && trendPredictions && trendPredictions.length > 0 && (
                <div>
                    <p className="text-[11px] font-medium text-slate-300 mb-2">Predicciones de Tendencia</p>
                    <div className="space-y-1">
                        {trendPredictions.map((t, i) => (
                            <div key={i} className="flex items-start gap-2 text-[11px] bg-slate-900/40 rounded px-2.5 py-1.5">
                                {t.direction === 'deteriorating'
                                    ? <TrendingDown className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                                    : <TrendingUp className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                                }
                                <span className="text-slate-400">{t.prediction}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Risk Watchlist */}
            {riskWatchlist.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-700/30">
                    <p className="text-[10px] font-medium text-red-400/70 uppercase tracking-wider mb-2">Watchlist de Riesgo</p>
                    {riskWatchlist.map((r, i) => (
                        <div key={i} className="text-[10px] text-slate-500 mb-1">
                            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${r.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                            {r.kpi}: {r.justification}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
