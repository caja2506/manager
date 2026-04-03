import React, { useState, useEffect } from 'react';
import { Shield, TrendingUp, Clock, Database, Activity } from 'lucide-react';

// ============================================================
// ANIMATED COUNT UP HOOK
// ============================================================

function useCountUp(end, duration = 1400) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        const numEnd = typeof end === 'number' ? end : parseFloat(end) || 0;
        if (numEnd === 0) return;
        let cancelled = false;
        let startTs = null;
        const step = (ts) => {
            if (cancelled) return;
            if (!startTs) startTs = ts;
            const p = Math.min((ts - startTs) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(eased * numEnd));
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        return () => { cancelled = true; };
    }, [end, duration]);
    return val;
}

// ============================================================
// SCORE GAUGE COMPONENT
// ============================================================

function ScoreGauge({ label, score, icon: Icon, color, size = 'default', className = '' }) {
    const radius = size === 'compact' ? 28 : 36;
    const stroke = size === 'compact' ? 4 : 5;
    const circumference = 2 * Math.PI * radius;
    const animatedScore = useCountUp(score, 1400);
    const progress = (animatedScore / 100) * circumference;
    const svgSize = (radius + stroke) * 2;

    const getColor = (s) => {
        if (s >= 80) return { ring: 'stroke-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
        if (s >= 60) return { ring: 'stroke-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
        return { ring: 'stroke-rose-500', text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
    };

    const colors = color || getColor(score);

    return (
        <div className={`flex flex-col items-center gap-2 p-4 rounded-2xl border ${colors.bg} ${colors.border} transition-all hover:scale-[1.02] ${className}`}>
            <div className="relative">
                <svg width={svgSize} height={svgSize} className="-rotate-90">
                    {/* Background track */}
                    <circle
                        cx={radius + stroke}
                        cy={radius + stroke}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={stroke}
                        className="text-slate-800"
                    />
                    {/* Progress arc */}
                    <circle
                        cx={radius + stroke}
                        cy={radius + stroke}
                        r={radius}
                        fill="none"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - progress}
                        className={colors.ring}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-lg font-black ${colors.text}`}>{animatedScore}</span>
                </div>
            </div>
            <div className="flex items-center gap-1.5 justify-center">
                {Icon && <Icon className={`w-3.5 h-3.5 ${colors.text} hidden sm:block`} />}
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-center leading-tight">{label}</span>
            </div>
        </div>
    );
}

// ============================================================
// SEVERITY PILL
// ============================================================

function SeveritySummaryPill({ count, severity, className = '' }) {
    const config = {
        critical: { label: 'Críticos', color: 'text-rose-400 bg-rose-500/15 border-rose-500/30' },
        warning: { label: 'Advertencias', color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
        info: { label: 'Info', color: 'text-blue-400 bg-blue-500/15 border-blue-500/30' },
    };
    const cfg = config[severity] || config.info;

    return (
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${cfg.color} ${className}`}>
            <span className="text-sm font-black">{count}</span>
            {cfg.label}
        </span>
    );
}

// ============================================================
// MAIN PANEL
// ============================================================

export default function ComplianceScoresPanel({ scores, summary, isAuditing, onRunAudit, compact = false }) {
    if (!scores && !isAuditing) {
        return (
            <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-400" /> Salud Metodológica
                    </h3>
                </div>
                <div className="text-center py-8 border border-dashed border-slate-700 rounded-xl">
                    <Shield className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-400 mb-4">Ejecuta una auditoría para ver los scores de cumplimiento</p>
                    <button
                        onClick={onRunAudit}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-indigo-900/30"
                    >
                        Ejecutar Auditoría
                    </button>
                </div>
            </div>
        );
    }

    if (isAuditing) {
        return (
            <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6">
                <div className="flex items-center gap-3 justify-center py-8">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-bold text-slate-400">Ejecutando auditoría...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-400" /> Salud Metodológica
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                    {summary && (
                        <>
                            <SeveritySummaryPill count={summary.bySeverity.critical} severity="critical" />
                            <SeveritySummaryPill count={summary.bySeverity.warning} severity="warning" />
                            <SeveritySummaryPill count={summary.bySeverity.info} severity="info" />
                        </>
                    )}
                    <button
                        onClick={onRunAudit}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-lg transition-colors border border-slate-700"
                    >
                        Actualizar
                    </button>
                </div>
            </div>

            {/* Score Gauges */}
            <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3`}>
                <ScoreGauge
                    label="Metodología"
                    score={scores.methodologyCompliance}
                    icon={Shield}
                    size={compact ? 'compact' : 'default'}
                />
                <ScoreGauge
                    label="Planificación"
                    score={scores.planningReliability}
                    icon={TrendingUp}
                    size={compact ? 'compact' : 'default'}
                />
                <ScoreGauge
                    label="Estimación"
                    score={scores.estimationAccuracy}
                    icon={Clock}
                    size={compact ? 'compact' : 'default'}
                />
                <ScoreGauge
                    label="Disciplina"
                    score={scores.dataDiscipline}
                    icon={Database}
                    size={compact ? 'compact' : 'default'}
                />
                <ScoreGauge
                    label="Salud Proy."
                    score={scores.projectHealth}
                    icon={Activity}
                    size={compact ? 'compact' : 'default'}
                    className="col-span-2 sm:col-span-1 mx-auto w-full max-w-[180px] sm:max-w-none"
                />
            </div>

            {/* Total findings summary */}
            {summary && (
                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                        {summary.totalFindings} hallazgo(s) detectados • Score Impact: {summary.totalScoreImpact}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600">
                        {scores.calculatedAt ? new Date(scores.calculatedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                </div>
            )}
        </div>
    );
}

export { ScoreGauge, SeveritySummaryPill };
