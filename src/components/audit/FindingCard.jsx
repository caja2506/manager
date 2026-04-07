import React from 'react';
import { AlertOctagon, AlertTriangle, Info, ChevronRight, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ============================================================
// SEVERITY BADGE
// ============================================================

export function FindingSeverityBadge({ severity, className = '' }) {
    const config = {
        critical: {
            icon: AlertOctagon,
            label: 'Crítico',
            classes: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
        },
        warning: {
            icon: AlertTriangle,
            label: 'Advertencia',
            classes: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
        },
        info: {
            icon: Info,
            label: 'Info',
            classes: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
        },
    };

    const cfg = config[severity] || config.info;
    const Icon = cfg.icon;

    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.classes} ${className}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
        </span>
    );
}

// ============================================================
// ENTITY TYPE BADGE
// ============================================================

export function EntityTypeBadge({ entityType }) {
    const config = {
        task: { label: 'Tarea', color: 'text-indigo-400 bg-indigo-500/10' },
        project: { label: 'Proyecto', color: 'text-emerald-400 bg-emerald-500/10' },
        user: { label: 'Usuario', color: 'text-violet-400 bg-violet-500/10' },
        planner: { label: 'Planner', color: 'text-cyan-400 bg-cyan-500/10' },
    };

    const cfg = config[entityType] || config.task;

    return (
        <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${cfg.color}`}>
            {cfg.label}
        </span>
    );
}

// ============================================================
// FINDING CARD
// ============================================================

export function FindingCard({ finding, showEntityLink = true, onOpenTask }) {
    const navigate = useNavigate();

    const getEntityRoute = () => {
        switch (finding.entityType) {
            case 'task': return '/tasks';
            case 'project': return '/projects';
            case 'user': return '/team';
            default: return null;
        }
    };

    const borderColor = {
        critical: 'border-l-rose-500 hover:border-rose-500/40',
        warning: 'border-l-amber-500 hover:border-amber-500/40',
        info: 'border-l-blue-500 hover:border-blue-500/40',
    };

    const isTaskFinding = finding.entityType === 'task' && finding.entityId;

    const handleClick = () => {
        if (isTaskFinding && onOpenTask) {
            onOpenTask(finding.entityId);
        }
    };

    return (
        <div
            className={`p-4 rounded-xl border-l-4 border border-slate-800 bg-slate-800/40 backdrop-blur-sm transition-all hover:bg-slate-800/60 ${borderColor[finding.severity] || borderColor.info} ${isTaskFinding && onOpenTask ? 'cursor-pointer' : ''}`}
            onClick={handleClick}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    {/* Header: severity + entity */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <FindingSeverityBadge severity={finding.severity} />
                        <EntityTypeBadge entityType={finding.entityType} />
                        <span className="text-[9px] font-mono text-slate-600 ml-auto">{finding.ruleId}</span>
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-black text-slate-200 leading-tight">{finding.title}</h4>

                    {/* Message */}
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{finding.message}</p>

                    {/* Entity ID (Firebase) */}
                    {finding.entityId && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-slate-600 uppercase">ID:</span>
                            <code className="text-[9px] font-mono text-indigo-400/80 bg-indigo-500/10 px-1.5 py-0.5 rounded select-all">{finding.entityId}</code>
                        </div>
                    )}

                    {/* Metadata: affected task list */}
                    {finding.metadata?.tasksWithoutLogs?.length > 0 && (
                        <div className="mt-2 space-y-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Tareas afectadas:</span>
                            {finding.metadata.tasksWithoutLogs.map(t => (
                                <div key={t.id} className="flex items-center gap-2 ml-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onOpenTask?.(t.id); }}
                                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold truncate max-w-[200px] hover:underline"
                                        title={t.title}
                                    >
                                        {t.title}
                                    </button>
                                    <code className="text-[8px] font-mono text-slate-600 bg-slate-800 px-1 rounded select-all shrink-0">{t.id}</code>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Metadata: stale tasks list */}
                    {finding.metadata?.staleTasks?.length > 0 && (
                        <div className="mt-2 space-y-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Tareas sin actualizar:</span>
                            {finding.metadata.staleTasks.map(t => (
                                <div key={t.id} className="flex items-center gap-2 ml-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onOpenTask?.(t.id); }}
                                        className="text-[10px] text-amber-400 hover:text-amber-300 font-bold truncate max-w-[200px] hover:underline"
                                        title={t.title}
                                    >
                                        {t.title}
                                    </button>
                                    <code className="text-[8px] font-mono text-slate-600 bg-slate-800 px-1 rounded select-all shrink-0">{t.id}</code>
                                    {t.lastUpdated && (
                                        <span className="text-[9px] text-slate-600">({new Date(t.lastUpdated).toLocaleDateString('es-MX')})</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Recommendation */}
                    {finding.recommendedAction && (
                        <div className="mt-2.5 flex items-start gap-1.5 text-[11px] text-slate-500">
                            <span className="text-[10px] font-black text-indigo-400/60 uppercase shrink-0">Acción:</span>
                            <span>{finding.recommendedAction}</span>
                        </div>
                    )}
                </div>

                {/* Navigate to entity */}
                {showEntityLink && getEntityRoute() && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isTaskFinding && onOpenTask) {
                                onOpenTask(finding.entityId);
                            } else {
                                navigate(getEntityRoute());
                            }
                        }}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0"
                        title={isTaskFinding ? 'Abrir tarea' : 'Ver entidad'}
                    >
                        <ExternalLink className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Score impact */}
            {finding.scoreImpact && (
                <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-600">
                        Impacto en score: <span className="text-rose-400">{finding.scoreImpact}</span>
                    </span>
                </div>
            )}
        </div>
    );
}

// ============================================================
// FINDING CARD LIST (simple wrapper)
// ============================================================

export function FindingCardList({ findings, emptyMessage = 'Sin hallazgos', maxItems = 50, onOpenTask }) {
    if (!findings || findings.length === 0) {
        return (
            <div className="text-center py-8 border border-dashed border-slate-700 rounded-xl">
                <Info className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {findings.slice(0, maxItems).map((finding, index) => (
                <FindingCard key={`${finding.ruleId}-${finding.entityId}-${index}`} finding={finding} onOpenTask={onOpenTask} />
            ))}
            {findings.length > maxItems && (
                <p className="text-center text-xs font-bold text-slate-500 py-2">
                    +{findings.length - maxItems} hallazgos más
                </p>
            )}
        </div>
    );
}
