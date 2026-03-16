import React from 'react';
import { BarChart3, CheckCircle2, XCircle, MinusCircle, Clock } from 'lucide-react';
import { getImpactStatusColor, getImpactStatusLabel, formatPercent, formatDelta } from '../../automation/optimizationService';

export default function ImpactTrackingCard({ applied = [] }) {
    if (!applied || applied.length === 0) {
        return (
            <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-5 h-5 text-teal-400" />
                    <h3 className="text-sm font-semibold text-slate-200">Seguimiento de Impacto</h3>
                </div>
                <p className="text-xs text-slate-500 text-center py-6">Sin recomendaciones aplicadas. Aplica una para comenzar a medir impacto.</p>
            </div>
        );
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'improved': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
            case 'worsened': return <XCircle className="w-3.5 h-3.5 text-red-400" />;
            case 'no_change': return <MinusCircle className="w-3.5 h-3.5 text-slate-400" />;
            case 'pending': return <Clock className="w-3.5 h-3.5 text-amber-400" />;
            default: return <BarChart3 className="w-3.5 h-3.5 text-blue-400" />;
        }
    };

    return (
        <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-teal-400" />
                    <h3 className="text-sm font-semibold text-slate-200">Seguimiento de Impacto</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-medium">{applied.length}</span>
                </div>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {applied.map((item, i) => (
                    <div key={item.id || i} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                {getStatusIcon(item.impactStatus)}
                                <span className="text-xs font-medium" style={{ color: getImpactStatusColor(item.impactStatus) }}>
                                    {getImpactStatusLabel(item.impactStatus)}
                                </span>
                            </div>
                            <span className="text-[10px] text-slate-600">
                                {item.appliedAt ? new Date(item.appliedAt).toLocaleDateString('es-MX') : '—'}
                            </span>
                        </div>

                        {/* Before/After metrics */}
                        {item.evaluation?.details && item.evaluation.details.length > 0 && (
                            <div className="space-y-1 mt-2">
                                {item.evaluation.details.slice(0, 4).map((d, j) => (
                                    <div key={j} className="flex items-center justify-between text-[10px]">
                                        <span className="text-slate-500">{d.metric}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-600">{formatPercent(d.before)}</span>
                                            <span className="text-slate-700">→</span>
                                            <span className={d.improved ? 'text-emerald-400' : d.worsened ? 'text-red-400' : 'text-slate-400'}>
                                                {formatPercent(d.after)}
                                            </span>
                                            <span className={`${d.improved ? 'text-emerald-500' : d.worsened ? 'text-red-500' : 'text-slate-600'}`}>
                                                ({formatDelta(d.delta)})
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {item.evaluation?.summary && (
                            <p className="text-[10px] text-slate-500 mt-2">{item.evaluation.summary}</p>
                        )}

                        {item.impactStatus === 'pending' && (
                            <p className="text-[10px] text-amber-500/60 mt-2">⏳ Impacto se medirá automáticamente en 7 días</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
