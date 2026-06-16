import React, { useState, useEffect, useMemo } from 'react';
import { Shield, TrendingUp, Clock, Database, Activity, X, AlertTriangle, AlertOctagon, Info, ChevronDown } from 'lucide-react';

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
// SCORE GAUGE COMPONENT (now clickable)
// ============================================================

function ScoreGauge({ label, score, icon: Icon, color, size = 'default', className = '', onClick, isActive }) {
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
        <div
            onClick={onClick}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border ${colors.bg} ${colors.border} transition-all hover:scale-[1.02] ${onClick ? 'cursor-pointer' : ''} ${isActive ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900' : ''} ${className}`}
        >
            <div className="relative">
                <svg width={svgSize} height={svgSize} className="-rotate-90">
                    <circle cx={radius + stroke} cy={radius + stroke} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-800" />
                    <circle cx={radius + stroke} cy={radius + stroke} r={radius} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - progress} className={colors.ring} />
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
// SEVERITY ICON
// ============================================================

function SeverityIcon({ severity }) {
    if (severity === 'critical') return <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    if (severity === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    return <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
}

function SeverityBadge({ severity }) {
    const cfg = {
        critical: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        info: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    };
    return (
        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${cfg[severity] || cfg.info}`}>
            {severity === 'critical' ? 'Crítico' : severity === 'warning' ? 'Advertencia' : 'Info'}
        </span>
    );
}

// ============================================================
// CATEGORY CONFIG — maps gauge keys to finding filters
// ============================================================

const CATEGORY_CONFIG = {
    methodology: {
        label: 'Metodología',
        description: 'Tareas que incumplen reglas metodológicas',
        icon: Shield,
        filter: (f) => f.entityType === 'task',
    },
    planning: {
        label: 'Planificación',
        description: 'Usuarios con problemas de planificación semanal',
        icon: TrendingUp,
        ruleIds: ['USER_OVER_CAPACITY', 'USER_UNDERUTILIZED', 'CRITICAL_TASK_NOT_PLANNED', 'PLANNER_INCOMPLETE_WEEK'],
        filter: (f) => f.entityType === 'user' && ['USER_OVER_CAPACITY', 'USER_UNDERUTILIZED', 'CRITICAL_TASK_NOT_PLANNED', 'PLANNER_INCOMPLETE_WEEK'].includes(f.ruleId),
    },
    estimation: {
        label: 'Estimación',
        description: 'Tareas completadas donde las horas reales difieren significativamente de las estimadas',
        icon: Clock,
        filter: (f) => f.ruleId?.includes('ESTIMATION') || f.ruleId?.includes('ESTIMATE'),
    },
    discipline: {
        label: 'Disciplina',
        description: 'Usuarios con problemas de disciplina de datos',
        icon: Database,
        ruleIds: ['USER_MISSING_TIMELOGS', 'USER_LOW_UPDATE_DISCIPLINE', 'TASK_REOPENED_TOO_MANY_TIMES'],
        filter: (f) => ['USER_MISSING_TIMELOGS', 'USER_LOW_UPDATE_DISCIPLINE', 'TASK_REOPENED_TOO_MANY_TIMES'].includes(f.ruleId),
    },
    projectHealth: {
        label: 'Salud de Proyectos',
        description: 'Proyectos con hallazgos de riesgo, retrasos o tareas vencidas',
        icon: Activity,
        filter: (f) => f.entityType === 'project',
    },
};

// ============================================================
// FINDINGS DRILL-DOWN PANEL
// ============================================================

function FindingsDrillDown({ category, findings, onClose, tasks = [], projects = [], teamMembers = [] }) {
    const [expandedEntity, setExpandedEntity] = useState(null);
    const config = CATEGORY_CONFIG[category];
    if (!config) return null;

    const filtered = findings.filter(config.filter);

    // Helper: look up enriched name for an entity
    const getEntityInfo = (entityId, entityType) => {
        if (entityType === 'task') {
            const task = tasks.find(t => t.id === entityId);
            if (task) {
                const project = projects.find(p => p.id === task.projectId);
                const assignee = teamMembers.find(u => u.uid === task.assignedTo);
                return {
                    name: task.title || entityId,
                    assigneeName: assignee?.displayName || assignee?.email || 'Sin asignar',
                    projectName: project?.name || '',
                };
            }
        }
        if (entityType === 'project') {
            const project = projects.find(p => p.id === entityId);
            return { name: project?.name || entityId, assigneeName: null, projectName: null };
        }
        if (entityType === 'user') {
            const user = teamMembers.find(u => u.uid === entityId);
            return { name: user?.displayName || user?.email || entityId, assigneeName: null, projectName: null };
        }
        return { name: entityId, assigneeName: null, projectName: null };
    };

    // Group by entity
    const grouped = {};
    filtered.forEach(f => {
        const key = f.entityId || 'unknown';
        if (!grouped[key]) {
            const info = getEntityInfo(key, f.entityType);
            grouped[key] = {
                entityId: key,
                entityType: f.entityType,
                entityName: info.name,
                assigneeName: info.assigneeName,
                projectName: info.projectName,
                findings: [],
            };
        }
        grouped[key].findings.push(f);
    });

    const entities = Object.values(grouped).sort((a, b) => {
        const aCrit = a.findings.filter(f => f.severity === 'critical').length;
        const bCrit = b.findings.filter(f => f.severity === 'critical').length;
        return bCrit - aCrit || b.findings.length - a.findings.length;
    });

    const Icon = config.icon;
    const entityLabel = category === 'methodology' ? 'tareas' : category === 'projectHealth' ? 'proyectos' : 'elementos';

    return (
        <div className="mt-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden animate-in slide-in-from-top-2 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-sm font-black text-white">{config.label}</h4>
                    <span className="text-[10px] font-bold text-slate-500">— {filtered.length} hallazgos en {entities.length} {entityLabel}</span>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-slate-400" />
                </button>
            </div>

            {/* Description */}
            <div className="px-4 py-2 bg-slate-800/30">
                <p className="text-[11px] text-slate-400">{config.description}</p>
            </div>

            {/* Entity list */}
            <div className="max-h-[400px] overflow-y-auto">
                {entities.length === 0 ? (
                    <div className="p-6 text-center">
                        <p className="text-sm text-slate-500">No se encontraron hallazgos en esta categoría.</p>
                    </div>
                ) : (
                    entities.map(entity => {
                        const isExpanded = expandedEntity === entity.entityId;
                        const critCount = entity.findings.filter(f => f.severity === 'critical').length;
                        const warnCount = entity.findings.filter(f => f.severity === 'warning').length;

                        return (
                            <div key={entity.entityId} className="border-b border-slate-700/30 last:border-0">
                                <button
                                    onClick={() => setExpandedEntity(isExpanded ? null : entity.entityId)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors text-left"
                                >
                                    <SeverityIcon severity={critCount > 0 ? 'critical' : warnCount > 0 ? 'warning' : 'info'} />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[12px] font-bold text-slate-200 truncate block">{entity.entityName}</span>
                                        {(entity.assigneeName || entity.projectName) && (
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {entity.assigneeName && (
                                                    <span className="text-[10px] text-violet-400 flex items-center gap-1">
                                                        <span className="opacity-60">👤</span> {entity.assigneeName}
                                                    </span>
                                                )}
                                                {entity.projectName && (
                                                    <span className="text-[10px] text-blue-400 flex items-center gap-1">
                                                        <span className="opacity-60">📂</span> {entity.projectName}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {critCount > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">{critCount}</span>}
                                        {warnCount > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">{warnCount}</span>}
                                        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="px-4 pb-3 space-y-2 animate-in slide-in-from-top-1 duration-200">
                                        {entity.findings.map((f, idx) => (
                                            <div key={idx} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/30">
                                                <SeverityIcon severity={f.severity} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="text-[11px] font-bold text-slate-300">{f.title}</span>
                                                        <SeverityBadge severity={f.severity} />
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 leading-relaxed">{f.message}</p>
                                                    {f.recommendedAction && (
                                                        <p className="text-[10px] text-indigo-400 mt-1">💡 {f.recommendedAction}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ============================================================
// MAIN PANEL
// ============================================================

export default function ComplianceScoresPanel({ scores, summary, isAuditing, onRunAudit, compact = false, findings = [], tasks = [], projects = [], teamMembers = [] }) {
    const [activeCategory, setActiveCategory] = useState(null);

    const handleGaugeClick = (category) => {
        setActiveCategory(prev => prev === category ? null : category);
    };

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

            {/* Hint */}
            {findings.length > 0 && !activeCategory && (
                <p className="text-[10px] text-slate-500 mb-3 text-center">Toca un indicador para ver los hallazgos detallados</p>
            )}

            {/* Score Gauges */}
            <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3`}>
                <ScoreGauge
                    label="Metodología"
                    score={scores.methodologyCompliance}
                    icon={Shield}
                    size={compact ? 'compact' : 'default'}
                    onClick={findings.length > 0 ? () => handleGaugeClick('methodology') : undefined}
                    isActive={activeCategory === 'methodology'}
                />
                <ScoreGauge
                    label="Planificación"
                    score={scores.planningReliability}
                    icon={TrendingUp}
                    size={compact ? 'compact' : 'default'}
                    onClick={findings.length > 0 ? () => handleGaugeClick('planning') : undefined}
                    isActive={activeCategory === 'planning'}
                />
                <ScoreGauge
                    label="Estimación"
                    score={scores.estimationAccuracy}
                    icon={Clock}
                    size={compact ? 'compact' : 'default'}
                    onClick={findings.length > 0 ? () => handleGaugeClick('estimation') : undefined}
                    isActive={activeCategory === 'estimation'}
                />
                <ScoreGauge
                    label="Disciplina"
                    score={scores.dataDiscipline}
                    icon={Database}
                    size={compact ? 'compact' : 'default'}
                    onClick={findings.length > 0 ? () => handleGaugeClick('discipline') : undefined}
                    isActive={activeCategory === 'discipline'}
                />
                <ScoreGauge
                    label="Salud Proy."
                    score={scores.projectHealth}
                    icon={Activity}
                    size={compact ? 'compact' : 'default'}
                    className="col-span-2 sm:col-span-1 mx-auto w-full max-w-[180px] sm:max-w-none"
                    onClick={findings.length > 0 ? () => handleGaugeClick('projectHealth') : undefined}
                    isActive={activeCategory === 'projectHealth'}
                />
            </div>

            {/* Drill-Down Panel */}
            {activeCategory && findings.length > 0 && (
                <FindingsDrillDown
                    category={activeCategory}
                    findings={findings}
                    onClose={() => setActiveCategory(null)}
                    tasks={tasks}
                    projects={projects}
                    teamMembers={teamMembers}
                />
            )}

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
