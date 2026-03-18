/**
 * AI Monitoring Page — V5 Phase 6
 * =================================
 * UI for AI monitoring results: risk detection, follow-ups,
 * escalations, executive summary, and AI trace log.
 */

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    BrainCircuit, ArrowLeft, AlertTriangle, Shield, Target, TrendingUp,
    TrendingDown, Minus, Bell, Clock, Activity, Loader2, Lock,
    CheckCircle2, XCircle, Send, Eye, RefreshCw
} from 'lucide-react';
import useMilestoneScore from '../hooks/useMilestoneScore';
import { runMonitoringCycle, AI_SCHEDULE, AI_ACTION_TYPE } from '../core/ai-monitoring/aiMonitoringEngine';
import { RISK_SEVERITY } from '../core/ai-monitoring/riskDetector';

const SEVERITY_STYLES = {
    critical: { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400', icon: '🔴', label: 'Crítico' },
    high:     { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', icon: '🟠', label: 'Alto' },
    medium:   { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', icon: '🔸', label: 'Medio' },
    low:      { bg: 'bg-slate-500/15', border: 'border-slate-500/30', text: 'text-slate-400', icon: '🔹', label: 'Bajo' },
};

const ESCALATION_LABELS = {
    notify_responsible: { label: 'Responsable', icon: '👤', color: 'text-blue-400' },
    notify_team_lead:   { label: 'Team Lead', icon: '👥', color: 'text-amber-400' },
    notify_manager:     { label: 'Manager', icon: '📋', color: 'text-orange-400' },
    escalate_admin:     { label: 'Administrador', icon: '🛡️', color: 'text-red-400' },
};

export default function AIMonitoringPage() {
    const { milestoneId } = useParams();
    const navigate = useNavigate();
    const { milestone, workAreas, scoreResult, loading, error } = useMilestoneScore(milestoneId);
    const [monitoringResult, setMonitoringResult] = useState(null);
    const [running, setRunning] = useState(false);

    // Run monitoring cycle
    const handleRunCycle = () => {
        if (!scoreResult || !milestone) return;
        setRunning(true);

        setTimeout(() => {
            const result = runMonitoringCycle({
                milestoneResult: scoreResult,
                milestone,
                workAreas,
                snapshots: [], // Would come from Firestore in production
                governanceConfig: {
                    maxEscalationLevel: 'notify_manager',
                    enabledChannels: ['in_app', 'telegram'],
                    enabledActions: Object.values(AI_ACTION_TYPE),
                },
                triggerSource: 'manual',
            });
            setMonitoringResult(result);
            setRunning(false);
        }, 800);
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                    <p className="text-slate-400 mt-3 text-sm">Cargando datos del milestone...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-10 text-center">
                <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <p className="text-red-300 text-sm">{error}</p>
                <button onClick={() => navigate(-1)}
                    className="mt-4 px-5 py-2 bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 rounded-lg text-sm cursor-pointer">
                    Volver
                </button>
            </div>
        );
    }

    const ms = scoreResult?.milestone;

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* ── HEADER ── */}
            <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg">
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="text-indigo-400 hover:text-indigo-300 transition">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="w-10 h-10 bg-purple-600/20 border border-purple-500/30 rounded-xl flex items-center justify-center">
                            <BrainCircuit className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="font-black text-xl text-white tracking-tight">AI Monitoring</h2>
                            <p className="text-[11px] text-slate-500 font-bold">
                                {milestone?.name || 'Milestone'} · Motor de detección y seguimiento
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Schedule indicators */}
                        <div className="hidden md:flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                            {Object.values(AI_SCHEDULE).filter(s => s.cron).map(s => (
                                <span key={s.label} className="px-2 py-1 bg-slate-800 rounded-lg border border-slate-700">
                                    🕐 {s.label}
                                </span>
                            ))}
                        </div>

                        <button
                            onClick={handleRunCycle}
                            disabled={running || !scoreResult}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                running
                                    ? 'bg-purple-600/20 text-purple-300 cursor-wait'
                                    : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-900/30 cursor-pointer'
                            }`}
                        >
                            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            {running ? 'Ejecutando...' : 'Ejecutar Ciclo'}
                        </button>
                    </div>
                </div>

                {/* Current state compact */}
                {ms && (
                    <div className="px-4 pb-4 flex items-center gap-6 text-xs">
                        <span className="text-slate-400">
                            Score: <strong className="text-white">{ms.score}/100</strong>
                        </span>
                        <span className="text-slate-400">
                            Semáforo: <strong className={
                                ms.trafficLight?.value === 'green' ? 'text-green-400' :
                                ms.trafficLight?.value === 'red' ? 'text-red-400' : 'text-amber-400'
                            }>{ms.trafficLight?.value?.toUpperCase()}</strong>
                        </span>
                        <span className="text-slate-400">
                            Tendencia: <strong className="text-white">{ms.trend || 'stable'}</strong>
                        </span>
                    </div>
                )}
            </div>

            {/* ── NO RESULTS YET ── */}
            {!monitoringResult && (
                <div className="bg-slate-900/70 p-12 rounded-2xl border border-slate-800 text-center">
                    <BrainCircuit className="w-12 h-12 text-purple-400/30 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-400 mb-2">Motor de AI Monitoring</h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto">
                        Presiona "Ejecutar Ciclo" para analizar riesgos, generar seguimiento y evaluar escalaciones sobre este milestone.
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3 text-[10px] text-slate-500 font-bold">
                        <span className="px-3 py-1.5 bg-slate-800 rounded-lg">7 tipos de riesgo</span>
                        <span className="px-3 py-1.5 bg-slate-800 rounded-lg">4 niveles de escalación</span>
                        <span className="px-3 py-1.5 bg-slate-800 rounded-lg">Trazabilidad completa</span>
                    </div>
                </div>
            )}

            {/* ── MONITORING RESULTS ── */}
            {monitoringResult && (
                <>
                    {/* Risk Summary KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KpiCard label="Señales Detectadas" value={monitoringResult.risks.length}
                            color={monitoringResult.risks.length > 0 ? 'rose' : 'emerald'}
                            icon={<AlertTriangle className="w-6 h-6" />} />
                        <KpiCard label="Seguimientos" value={monitoringResult.followUps.length}
                            color="amber" icon={<Send className="w-6 h-6" />} />
                        <KpiCard label="Escalaciones" value={monitoringResult.escalations.length}
                            color="purple" icon={<Bell className="w-6 h-6" />} />
                        <KpiCard label="Acciones AI" value={monitoringResult.actions.length}
                            color="indigo" icon={<Activity className="w-6 h-6" />} />
                    </div>

                    {/* Risk Signals */}
                    {monitoringResult.risks.length > 0 && (
                        <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle className="w-5 h-5 text-red-400" />
                                <h3 className="font-bold text-lg text-white">Señales de Riesgo</h3>
                            </div>
                            <div className="space-y-2">
                                {monitoringResult.risks.map((risk, i) => {
                                    const style = SEVERITY_STYLES[risk.severity] || SEVERITY_STYLES.low;
                                    return (
                                        <div key={i} className={`p-3 rounded-lg border ${style.bg} ${style.border}`}>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{style.icon}</span>
                                                <span className={`text-[10px] font-black uppercase ${style.text}`}>{style.label}</span>
                                                <span className="text-xs text-slate-300 font-bold flex-1">{risk.message}</span>
                                            </div>
                                            <div className="mt-1 text-[10px] text-slate-500">
                                                {risk.signal.replace(/_/g, ' ')} · {risk.entityType}:{risk.entityId}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Follow-ups */}
                    {monitoringResult.followUps.length > 0 && (
                        <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg">
                            <div className="flex items-center gap-2 mb-4">
                                <Send className="w-5 h-5 text-amber-400" />
                                <h3 className="font-bold text-lg text-white">Seguimiento Propuesto</h3>
                            </div>
                            <div className="space-y-2">
                                {monitoringResult.followUps.map((fu, i) => (
                                    <div key={i} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/40 flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                                            <Send className="w-3 h-3 text-amber-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-black text-amber-400 uppercase">{fu.type.replace(/_/g, ' ')}</span>
                                                <span className="text-[10px] text-slate-500">→ {fu.target}</span>
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                                    fu.priority === 'critical' ? 'bg-red-500/10 text-red-300' :
                                                    fu.priority === 'high' ? 'bg-orange-500/10 text-orange-300' :
                                                    'bg-slate-700 text-slate-400'
                                                }`}>{fu.priority}</span>
                                            </div>
                                            <p className="text-xs text-slate-300">{fu.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Escalations */}
                    {monitoringResult.escalations.length > 0 && (
                        <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg">
                            <div className="flex items-center gap-2 mb-4">
                                <Bell className="w-5 h-5 text-purple-400" />
                                <h3 className="font-bold text-lg text-white">Escalaciones</h3>
                            </div>
                            <div className="space-y-2">
                                {monitoringResult.escalations.map((esc, i) => {
                                    const info = ESCALATION_LABELS[esc.level] || { label: esc.level, icon: '📌', color: 'text-slate-400' };
                                    return (
                                        <div key={i} className="p-3 bg-purple-500/5 rounded-lg border border-purple-500/20 flex items-start gap-3">
                                            <span className="text-lg">{info.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-bold ${info.color}`}>{info.label}</span>
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                                        esc.urgency === 'critical' ? 'bg-red-500/10 text-red-300' :
                                                        esc.urgency === 'high' ? 'bg-orange-500/10 text-orange-300' :
                                                        'bg-slate-700 text-slate-400'
                                                    }`}>{esc.urgency}</span>
                                                    <span className="text-[10px] text-slate-500">cooldown: {esc.cooldownHours}h</span>
                                                </div>
                                                <p className="text-xs text-slate-300">{esc.reason}</p>
                                                <div className="flex gap-1 mt-1">
                                                    {esc.channels.map(ch => (
                                                        <span key={ch} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-bold">{ch}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Executive Summary */}
                    {monitoringResult.executiveSummary && (
                        <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg">
                            <div className="flex items-center gap-2 mb-4">
                                <Eye className="w-5 h-5 text-indigo-400" />
                                <h3 className="font-bold text-lg text-white">Resumen Ejecutivo AI</h3>
                            </div>
                            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                                {monitoringResult.executiveSummary.text}
                            </pre>
                        </div>
                    )}

                    {/* Capability Matrix */}
                    <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <Shield className="w-5 h-5 text-emerald-400" />
                            <h3 className="font-bold text-lg text-white">Matriz de Capacidades AI</h3>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                            {/* Can Execute */}
                            <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                                <h4 className="text-xs font-black text-emerald-400 uppercase mb-3 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Puede Ejecutar
                                </h4>
                                <ul className="space-y-1.5 text-xs text-slate-300">
                                    <li>✅ Recalcular score</li>
                                    <li>✅ Guardar snapshots</li>
                                    <li>✅ Crear alertas</li>
                                    <li>✅ Pedir actualización</li>
                                    <li>✅ Enviar seguimiento</li>
                                    <li>✅ Registrar observaciones</li>
                                </ul>
                            </div>

                            {/* Can Recommend */}
                            <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
                                <h4 className="text-xs font-black text-amber-400 uppercase mb-3 flex items-center gap-1">
                                    <Activity className="w-3.5 h-3.5" /> Puede Recomendar
                                </h4>
                                <ul className="space-y-1.5 text-xs text-slate-300">
                                    <li>💡 Escalación por severidad</li>
                                    <li>💡 Resumen ejecutivo</li>
                                    <li>💡 Evaluación de riesgo</li>
                                    <li>💡 Notificar manager</li>
                                    <li>💡 Resumen semanal</li>
                                </ul>
                            </div>

                            {/* Prohibited */}
                            <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/20">
                                <h4 className="text-xs font-black text-red-400 uppercase mb-3 flex items-center gap-1">
                                    <XCircle className="w-3.5 h-3.5" /> Prohibido
                                </h4>
                                <ul className="space-y-1.5 text-xs text-slate-300">
                                    <li>🚫 Cambiar fechas compromiso</li>
                                    <li>🚫 Cambiar owner principal</li>
                                    <li>🚫 Cerrar tareas/milestones</li>
                                    <li>🚫 Aprobar peer review</li>
                                    <li>🚫 Cambiar permisos/roles</li>
                                    <li>🚫 Operaciones financieras</li>
                                    <li>🚫 Eliminar datos</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Traceability */}
                    <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="w-5 h-5 text-slate-400" />
                            <h3 className="font-bold text-lg text-white">Trazabilidad</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <TraceField label="correlationId" value={monitoringResult.correlationId} />
                            <TraceField label="triggerSource" value={monitoringResult.triggerSource} />
                            <TraceField label="timestamp" value={monitoringResult.timestamp} />
                            <TraceField label="milestoneId" value={monitoringResult.milestoneId || '—'} />
                            <TraceField label="riskLevel" value={monitoringResult.riskSummary.level} />
                            <TraceField label="signalsDetected" value={String(monitoringResult.risks.length)} />
                            <TraceField label="actionsProposed" value={String(monitoringResult.actions.length)} />
                            <TraceField label="score" value={`${monitoringResult.traceRecord.milestoneScore}/100`} />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ── Helper Components ──

function KpiCard({ label, value, color, icon }) {
    const colorClasses = {
        indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', label: 'text-indigo-400' },
        emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'text-emerald-400' },
        rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', label: 'text-rose-400' },
        amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'text-amber-400' },
        purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'text-purple-400' },
        slate: { bg: 'bg-slate-500/15', text: 'text-slate-400', label: 'text-slate-400' },
    };
    const c = colorClasses[color] || colorClasses.slate;
    return (
        <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
            <span className={`text-[10px] font-black tracking-wider uppercase ${c.label}`}>{label}</span>
            <div className="flex items-center gap-3 mt-2">
                <div className={`w-12 h-12 rounded-full ${c.bg} flex items-center justify-center ${c.text} shrink-0`}>
                    {icon}
                </div>
                <span className="text-3xl font-black text-white">{value}</span>
            </div>
        </div>
    );
}

function TraceField({ label, value }) {
    return (
        <div className="p-2 bg-slate-800/40 rounded-lg">
            <div className="text-[9px] text-slate-500 font-bold uppercase mb-0.5">{label}</div>
            <div className="text-[11px] text-slate-300 font-mono truncate">{value}</div>
        </div>
    );
}
