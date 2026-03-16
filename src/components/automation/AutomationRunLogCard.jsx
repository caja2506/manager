import React from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, Loader2, Play } from 'lucide-react';
import { RUN_STATUS, RUN_STATUS_CONFIG } from '../../automation/constants.js';

const STATUS_ICONS = {
    [RUN_STATUS.RUNNING]: Loader2,
    [RUN_STATUS.SUCCESS]: CheckCircle,
    [RUN_STATUS.PARTIAL]: AlertTriangle,
    [RUN_STATUS.FAILED]: XCircle,
    [RUN_STATUS.CANCELLED]: XCircle,
};

const STATUS_COLORS = {
    [RUN_STATUS.RUNNING]: 'text-blue-400',
    [RUN_STATUS.SUCCESS]: 'text-emerald-400',
    [RUN_STATUS.PARTIAL]: 'text-amber-400',
    [RUN_STATUS.FAILED]: 'text-red-400',
    [RUN_STATUS.CANCELLED]: 'text-slate-400',
};

/**
 * AutomationRunLogCard
 * 
 * Displays recent automation run history with status, timing, and delivery counts.
 */
export default function AutomationRunLogCard({ runs = [] }) {
    return (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">
                Actividad Reciente
            </h3>

            {runs.length === 0 ? (
                <div className="text-center py-8">
                    <Play className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No hay ejecuciones registradas</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
                    {runs.map(run => {
                        const Icon = STATUS_ICONS[run.status] || Clock;
                        const color = STATUS_COLORS[run.status] || 'text-slate-400';
                        const config = RUN_STATUS_CONFIG[run.status];
                        const startedAt = run.startedAt ? new Date(run.startedAt) : null;
                        const duration = run.finishedAt && run.startedAt
                            ? Math.round((new Date(run.finishedAt) - new Date(run.startedAt)) / 1000)
                            : null;

                        return (
                            <div
                                key={run.id}
                                className="flex items-start gap-3 p-3 bg-slate-900/40 rounded-xl border border-slate-700/20"
                            >
                                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${color} ${run.status === RUN_STATUS.RUNNING ? 'animate-spin' : ''
                                    }`} />

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-white truncate">
                                            {run.routineKey}
                                        </span>
                                        {run.dryRun && (
                                            <span className="text-[9px] font-bold text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded">
                                                DRY-RUN
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                                        <span>{config?.label || run.status}</span>
                                        <span>·</span>
                                        <span>{run.triggerType}</span>
                                        {duration != null && (
                                            <>
                                                <span>·</span>
                                                <span>{duration}s</span>
                                            </>
                                        )}
                                    </div>

                                    {/* Counters */}
                                    <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                                        <span className="text-slate-500">
                                            Objetivos: <span className="text-slate-300 font-bold">{run.targetsCount || 0}</span>
                                        </span>
                                        <span className="text-slate-500">
                                            Enviados: <span className="text-blue-400 font-bold">{run.sentCount || 0}</span>
                                        </span>
                                        <span className="text-slate-500">
                                            Respuestas: <span className="text-emerald-400 font-bold">{run.respondedCount || 0}</span>
                                        </span>
                                        {(run.escalatedCount || 0) > 0 && (
                                            <span className="text-slate-500">
                                                Escalaciones: <span className="text-red-400 font-bold">{run.escalatedCount}</span>
                                            </span>
                                        )}
                                    </div>

                                    {run.errorSummary && (
                                        <p className="text-[10px] text-red-400/70 mt-1 truncate">
                                            {run.errorSummary}
                                        </p>
                                    )}

                                    {startedAt && (
                                        <p className="text-[10px] text-slate-600 mt-1">
                                            {startedAt.toLocaleString('es-MX', {
                                                dateStyle: 'short',
                                                timeStyle: 'short',
                                            })}
                                        </p>
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
