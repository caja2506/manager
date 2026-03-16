import React, { useState, useEffect } from 'react';
import { Brain, Mic, MessageSquare, Check, X, AlertTriangle, Zap } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';

/**
 * AutomationAISummaryCard
 * 
 * Displays AI layer status, configuration, and today's AI metrics.
 */
export default function AutomationAISummaryCard({ aiConfig }) {
    const [aiMetrics, setAiMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTodayAIMetrics();
    }, []);

    async function loadTodayAIMetrics() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const startOfDay = new Date(today + 'T00:00:00Z').toISOString();

            const q = query(
                collection(db, 'aiExecutions'),
                where('createdAt', '>=', startOfDay),
                orderBy('createdAt', 'desc'),
                limit(200)
            );

            const snap = await getDocs(q);
            const executions = snap.docs.map(d => d.data());

            const metrics = {
                total: executions.length,
                success: executions.filter(e => e.status === 'success').length,
                failure: executions.filter(e => e.status === 'failure').length,
                fallback: executions.filter(e => e.status === 'fallback').length,
                audioCount: executions.filter(e => e.sourceType === 'audio').length,
                textCount: executions.filter(e => e.sourceType === 'text').length,
                briefingCount: executions.filter(e => e.featureType === 'briefing_generation').length,
                extractionCount: executions.filter(e =>
                    e.featureType === 'report_extraction' || e.featureType === 'audio_transcription'
                ).length,
                confirmationsRequested: executions.filter(e => e.confidenceAction === 'confirm').length,
                avgConfidence: executions.length > 0
                    ? (executions.reduce((s, e) => s + (e.confidenceScore || 0), 0) / executions.length).toFixed(2)
                    : 'N/A',
                avgLatency: executions.length > 0
                    ? Math.round(executions.reduce((s, e) => s + (e.latencyMs || 0), 0) / executions.length)
                    : 0,
            };

            setAiMetrics(metrics);
        } catch (err) {
            console.warn('[AISummary] Error loading metrics:', err);
            setAiMetrics({ total: 0, success: 0, failure: 0 });
        } finally {
            setLoading(false);
        }
    }

    const isEnabled = aiConfig?.enabled;
    const audioEnabled = aiConfig?.allowAudioProcessing;
    const briefingsEnabled = aiConfig?.allowSmartBriefings;

    return (
        <div className="space-y-4">
            {/* AI Status Header */}
            <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isEnabled
                            ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600'
                            : 'bg-slate-700'
                        }`}>
                        <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white">Capa de Inteligencia</h3>
                        <p className="text-xs text-slate-400">
                            {isEnabled ? 'Gemini activo' : 'IA deshabilitada'}
                            {aiConfig?.defaultModel && ` • ${aiConfig.defaultModel}`}
                        </p>
                    </div>
                    <div className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${isEnabled
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}>
                        {isEnabled ? 'Habilitado' : 'Deshabilitado'}
                    </div>
                </div>

                {/* Feature toggles */}
                <div className="grid grid-cols-3 gap-3">
                    <FeaturePill icon={Mic} label="Audio" enabled={audioEnabled} />
                    <FeaturePill icon={Brain} label="Briefings IA" enabled={briefingsEnabled} />
                    <FeaturePill icon={AlertTriangle} label="Clasificación" enabled={isEnabled} />
                </div>
            </div>

            {/* AI Metrics */}
            {!loading && aiMetrics && (
                <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        Métricas de IA — Hoy
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <MetricBox label="Ejecuciones" value={aiMetrics.total} color="text-indigo-400" />
                        <MetricBox label="Exitosas" value={aiMetrics.success} color="text-emerald-400" />
                        <MetricBox label="Fallidas" value={aiMetrics.failure} color="text-red-400" />
                        <MetricBox label="Fallback" value={aiMetrics.fallback} color="text-amber-400" />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        <MetricBox label="Texto" value={aiMetrics.textCount} icon={<MessageSquare className="w-3.5 h-3.5" />} />
                        <MetricBox label="Audio" value={aiMetrics.audioCount} icon={<Mic className="w-3.5 h-3.5" />} />
                        <MetricBox label="Confianza Prom." value={aiMetrics.avgConfidence} />
                        <MetricBox label="Latencia Prom." value={`${aiMetrics.avgLatency}ms`} />
                    </div>

                    {aiMetrics.confirmationsRequested > 0 && (
                        <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-300">
                            ⚠️ {aiMetrics.confirmationsRequested} ejecuciones requirieron confirmación del usuario
                        </div>
                    )}
                </div>
            )}

            {loading && (
                <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-5 text-center text-slate-400 text-sm">
                    Cargando métricas de IA...
                </div>
            )}
        </div>
    );
}

function FeaturePill({ icon: Icon, label, enabled }) {
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${enabled
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-700/50 text-slate-500 border border-slate-600/20'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
            {enabled ? <Check className="w-3 h-3 ml-auto" /> : <X className="w-3 h-3 ml-auto" />}
        </div>
    );
}

function MetricBox({ label, value, color = 'text-white', icon }) {
    return (
        <div className="bg-slate-900/50 rounded-lg px-3 py-2 text-center">
            <div className={`text-lg font-black ${color} flex items-center justify-center gap-1`}>
                {icon}
                {value}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
        </div>
    );
}
