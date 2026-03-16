import React from 'react';
import { Lightbulb, TrendingUp, ChevronRight, Zap } from 'lucide-react';
import { getOpportunityIcon, getOpportunityLabel, formatPercent, getConfidenceColor, getConfidenceLabel } from '../../automation/optimizationService';

export default function OptimizationOpportunitiesCard({ opportunities = [], onSimulate }) {
    if (!opportunities || opportunities.length === 0) {
        return (
            <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-semibold text-slate-200">Oportunidades de Optimización</h3>
                </div>
                <p className="text-xs text-slate-500 text-center py-6">No se detectaron oportunidades. Ejecuta un escaneo para analizar.</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-semibold text-slate-200">Oportunidades de Optimización</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">{opportunities.length}</span>
                </div>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {opportunities.map((opp, i) => (
                    <div key={opp.id || i} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 hover:border-amber-500/30 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-start gap-2 min-w-0">
                                <span className="text-base mt-0.5 flex-shrink-0">{getOpportunityIcon(opp.type)}</span>
                                <div className="min-w-0">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400 font-medium mr-1.5">
                                        {getOpportunityLabel(opp.type)}
                                    </span>
                                    {opp.entityName && (
                                        <span className="text-[10px] text-slate-500">{opp.entityName}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-[10px] font-medium" style={{ color: getConfidenceColor(opp.confidence) }}>
                                    {getConfidenceLabel(opp.confidence)}
                                </span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-300 mb-2 leading-relaxed">{opp.problemDetected}</p>

                        <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-blue-500/10 rounded border border-blue-500/20">
                            <ChevronRight className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            <p className="text-[11px] text-blue-300">{opp.suggestedAction}</p>
                        </div>

                        {opp.impactEstimate && opp.impactEstimate.metric !== 'multiple' && (
                            <div className="flex items-center gap-3 text-[10px] text-slate-500">
                                <TrendingUp className="w-3 h-3" />
                                <span>Actual: {formatPercent(opp.impactEstimate.currentValue)}</span>
                                <span>→</span>
                                <span className="text-emerald-400">Estimado: {formatPercent(opp.impactEstimate.expectedValue)}</span>
                            </div>
                        )}

                        {onSimulate && (
                            <button
                                onClick={() => onSimulate(opp)}
                                className="mt-2 text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                            >
                                <Zap className="w-3 h-3" /> Simular cambio
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
