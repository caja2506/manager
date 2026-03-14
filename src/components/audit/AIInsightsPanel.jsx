import React, { useState } from 'react';
import {
    BrainCircuit, Sparkles, AlertTriangle, Target, Users, Loader2,
    ChevronDown, ChevronUp, Zap, TrendingUp, Shield, FileText
} from 'lucide-react';

// ============================================================
// AI INSIGHTS PANEL
// ============================================================

export default function AIInsightsPanel({
    insights,
    teamAnalysis,
    weeklyBrief,
    isGenerating,
    error,
    onGenerateAudit,
    onGenerateTeam,
    onGenerateBrief,
}) {
    const [expandedSection, setExpandedSection] = useState('audit');

    const toggleSection = (section) => {
        setExpandedSection(prev => prev === section ? null : section);
    };

    return (
        <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-800">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-violet-400" />
                        Gemini Copilot
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">AI</span>
                    </h3>
                    {isGenerating && (
                        <div className="flex items-center gap-2 text-violet-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-xs font-bold">Analizando...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="px-6 py-3 bg-rose-500/10 border-b border-rose-500/20">
                    <p className="text-xs text-rose-400 font-bold">⚠️ {error}</p>
                </div>
            )}

            {/* Action Buttons */}
            <div className="p-4 grid grid-cols-3 gap-2 border-b border-slate-800">
                <button
                    onClick={onGenerateAudit}
                    disabled={isGenerating}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-violet-500/30 transition-all disabled:opacity-50"
                >
                    <Shield className="w-5 h-5 text-violet-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase">Análisis Auditoría</span>
                </button>
                <button
                    onClick={onGenerateTeam}
                    disabled={isGenerating}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-cyan-500/30 transition-all disabled:opacity-50"
                >
                    <Users className="w-5 h-5 text-cyan-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase">Análisis Equipo</span>
                </button>
                <button
                    onClick={onGenerateBrief}
                    disabled={isGenerating}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-emerald-500/30 transition-all disabled:opacity-50"
                >
                    <FileText className="w-5 h-5 text-emerald-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase">Brief Semanal</span>
                </button>
            </div>

            {/* Audit Analysis Section */}
            {insights?.data && (
                <CollapsibleSection
                    title="Análisis de Auditoría"
                    icon={Shield}
                    color="violet"
                    isExpanded={expandedSection === 'audit'}
                    onToggle={() => toggleSection('audit')}
                >
                    {/* Overall Assessment */}
                    <div className="p-3 bg-violet-500/5 rounded-xl border border-violet-500/10 mb-3">
                        <p className="text-sm text-slate-300 leading-relaxed">{insights.data.overallAssessment}</p>
                    </div>

                    {/* Top Risks */}
                    {insights.data.topRisks?.length > 0 && (
                        <div className="mb-3">
                            <h5 className="text-[10px] font-black text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Riesgos principales
                            </h5>
                            <div className="space-y-2">
                                {insights.data.topRisks.map((risk, i) => (
                                    <div key={i} className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-xs font-bold text-slate-300">{risk.risk}</p>
                                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                                risk.impact === 'alto' ? 'text-rose-400 bg-rose-500/15' :
                                                risk.impact === 'medio' ? 'text-amber-400 bg-amber-500/15' :
                                                'text-blue-400 bg-blue-500/15'
                                            }`}>{risk.impact}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1">{risk.recommendation}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quick Wins */}
                    {insights.data.quickWins?.length > 0 && (
                        <div className="mb-3">
                            <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Zap className="w-3 h-3" /> Quick wins
                            </h5>
                            <div className="space-y-1.5">
                                {insights.data.quickWins.map((win, i) => (
                                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                        <Sparkles className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-xs font-bold text-slate-300">{win.action}</p>
                                            <p className="text-[10px] text-slate-500">{win.expectedImpact}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Weekly Focus */}
                    {insights.data.weeklyFocus && (
                        <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                            <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Target className="w-3 h-3" /> Foco de la semana
                            </h5>
                            <p className="text-xs text-slate-300">{insights.data.weeklyFocus}</p>
                        </div>
                    )}
                </CollapsibleSection>
            )}

            {/* Team Analysis Section */}
            {teamAnalysis?.data && (
                <CollapsibleSection
                    title="Análisis de Equipo"
                    icon={Users}
                    color="cyan"
                    isExpanded={expandedSection === 'team'}
                    onToggle={() => toggleSection('team')}
                >
                    <div className="p-3 bg-cyan-500/5 rounded-xl border border-cyan-500/10 mb-3">
                        <p className="text-sm text-slate-300 leading-relaxed">{teamAnalysis.data.teamHealthSummary}</p>
                    </div>

                    {teamAnalysis.data.balancingActions?.length > 0 && (
                        <div className="mb-3">
                            <h5 className="text-[10px] font-black text-cyan-400 uppercase mb-2">Balanceo sugerido</h5>
                            <div className="space-y-1.5">
                                {teamAnalysis.data.balancingActions.map((action, i) => (
                                    <div key={i} className="p-2 rounded-lg bg-slate-800/50 text-xs text-slate-300">
                                        <span className="font-bold">{action.from}</span> → <span className="font-bold">{action.to}</span>: {action.suggestion}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {teamAnalysis.data.recommendation && (
                        <div className="p-3 bg-cyan-500/5 rounded-xl border border-cyan-500/10">
                            <p className="text-xs text-slate-300"><strong>Recomendación:</strong> {teamAnalysis.data.recommendation}</p>
                        </div>
                    )}
                </CollapsibleSection>
            )}

            {/* Weekly Brief Section */}
            {weeklyBrief?.data && (
                <CollapsibleSection
                    title="Brief Semanal"
                    icon={FileText}
                    color="emerald"
                    isExpanded={expandedSection === 'brief'}
                    onToggle={() => toggleSection('brief')}
                >
                    <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 mb-3">
                        <p className="text-sm text-slate-300 leading-relaxed">{weeklyBrief.data.executiveSummary}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                        {weeklyBrief.data.highlights?.length > 0 && (
                            <div>
                                <h5 className="text-[10px] font-black text-emerald-400 uppercase mb-1.5">✅ Logros</h5>
                                <ul className="space-y-1">
                                    {weeklyBrief.data.highlights.map((h, i) => (
                                        <li key={i} className="text-[11px] text-slate-400">• {h}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {weeklyBrief.data.concerns?.length > 0 && (
                            <div>
                                <h5 className="text-[10px] font-black text-amber-400 uppercase mb-1.5">⚠️ Preocupaciones</h5>
                                <ul className="space-y-1">
                                    {weeklyBrief.data.concerns.map((c, i) => (
                                        <li key={i} className="text-[11px] text-slate-400">• {c}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {weeklyBrief.data.nextWeekPriorities?.length > 0 && (
                        <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                            <h5 className="text-[10px] font-black text-indigo-400 uppercase mb-1.5">🎯 Prioridades próxima semana</h5>
                            <ol className="space-y-1">
                                {weeklyBrief.data.nextWeekPriorities.map((p, i) => (
                                    <li key={i} className="text-[11px] text-slate-300">{i + 1}. {p}</li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {/* KPI Status Badge */}
                    <div className="mt-3 flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                            weeklyBrief.data.kpiStatus === 'mejorando' ? 'text-emerald-400 bg-emerald-500/15' :
                            weeklyBrief.data.kpiStatus === 'deteriorando' ? 'text-rose-400 bg-rose-500/15' :
                            'text-slate-400 bg-slate-500/15'
                        }`}>
                            KPIs: {weeklyBrief.data.kpiStatus}
                        </span>
                        <span className="text-[9px] font-mono text-slate-600">
                            {weeklyBrief.generatedAt ? new Date(weeklyBrief.generatedAt).toLocaleString('es-MX') : ''}
                        </span>
                    </div>
                </CollapsibleSection>
            )}

            {/* Empty State */}
            {!insights && !teamAnalysis && !weeklyBrief && !isGenerating && !error && (
                <div className="p-8 text-center">
                    <BrainCircuit className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-400 mb-1">Gemini Copilot listo</p>
                    <p className="text-xs text-slate-500">Selecciona un tipo de análisis para generar insights con IA</p>
                </div>
            )}
        </div>
    );
}

// ============================================================
// COLLAPSIBLE SECTION
// ============================================================

function CollapsibleSection({ title, icon: Icon, color, isExpanded, onToggle, children }) {
    const colorMap = {
        violet: 'text-violet-400 border-violet-500/20',
        cyan: 'text-cyan-400 border-cyan-500/20',
        emerald: 'text-emerald-400 border-emerald-500/20',
    };

    return (
        <div className={`border-b ${colorMap[color]?.split(' ')[1] || 'border-slate-800'}`}>
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${colorMap[color]?.split(' ')[0] || 'text-slate-400'}`} />
                    <span className="text-sm font-bold text-white">{title}</span>
                </div>
                {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-slate-500" />
                    : <ChevronDown className="w-4 h-4 text-slate-500" />
                }
            </button>
            {isExpanded && (
                <div className="px-4 pb-4 animate-in fade-in duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}
