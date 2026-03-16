import React, { useState, useEffect } from 'react';
import { Clock, Check, X, AlertTriangle, Brain, Mic, MessageSquare } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

/**
 * AIExecutionLogCard
 * 
 * Displays a chronological list of recent AI executions
 * with feature type, confidence badge, status, and latency.
 */
export default function AIExecutionLogCard() {
    const [executions, setExecutions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadRecentExecutions();
    }, []);

    async function loadRecentExecutions() {
        try {
            const q = query(
                collection(db, 'aiExecutions'),
                orderBy('createdAt', 'desc'),
                limit(20)
            );
            const snap = await getDocs(q);
            setExecutions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.warn('[AIExecutionLog] Error:', err);
        } finally {
            setLoading(false);
        }
    }

    const FEATURE_LABELS = {
        report_extraction: { label: 'Extracción', icon: MessageSquare, color: 'text-blue-400' },
        audio_transcription: { label: 'Audio', icon: Mic, color: 'text-purple-400' },
        briefing_generation: { label: 'Briefing', icon: Brain, color: 'text-indigo-400' },
        incident_classification: { label: 'Clasificación', icon: AlertTriangle, color: 'text-amber-400' },
    };

    const STATUS_BADGE = {
        success: { label: 'OK', bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: Check },
        failure: { label: 'Error', bg: 'bg-red-500/20', text: 'text-red-400', icon: X },
        fallback: { label: 'Fallback', bg: 'bg-amber-500/20', text: 'text-amber-400', icon: AlertTriangle },
    };

    function formatTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    }

    function getConfidenceBadge(score) {
        if (score === null || score === undefined) return null;
        const pct = Math.round(score * 100);
        let color = 'text-red-400 bg-red-500/10';
        if (score >= 0.8) color = 'text-emerald-400 bg-emerald-500/10';
        else if (score >= 0.5) color = 'text-amber-400 bg-amber-500/10';
        return (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${color}`}>
                {pct}%
            </span>
        );
    }

    return (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-5">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Últimas Ejecuciones de IA
            </h4>

            {loading ? (
                <div className="text-center text-slate-400 text-sm py-8">Cargando...</div>
            ) : executions.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-8">
                    Sin ejecuciones de IA registradas
                </div>
            ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {executions.map(exec => {
                        const feature = FEATURE_LABELS[exec.featureType] || {
                            label: exec.featureType, icon: Brain, color: 'text-slate-400'
                        };
                        const status = STATUS_BADGE[exec.status] || STATUS_BADGE.success;
                        const FeatureIcon = feature.icon;
                        const StatusIcon = status.icon;

                        return (
                            <div key={exec.id}
                                className="bg-slate-900/40 rounded-xl px-3 py-2.5 flex items-center gap-3 hover:bg-slate-900/60 transition-colors"
                            >
                                {/* Feature icon */}
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-slate-700/50 ${feature.color}`}>
                                    <FeatureIcon className="w-4 h-4" />
                                </div>

                                {/* Details */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-white">{feature.label}</span>
                                        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${status.bg} ${status.text}`}>
                                            <StatusIcon className="w-2.5 h-2.5" />
                                            {status.label}
                                        </span>
                                        {getConfidenceBadge(exec.confidenceScore)}
                                    </div>
                                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                        {exec.outputSummary || exec.inputSummary || exec.errorSummary || '—'}
                                    </p>
                                </div>

                                {/* Time + Latency */}
                                <div className="text-right flex-shrink-0">
                                    <div className="text-[10px] text-slate-500">{formatTime(exec.createdAt)}</div>
                                    {exec.latencyMs && (
                                        <div className="text-[10px] text-slate-600">{exec.latencyMs}ms</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
