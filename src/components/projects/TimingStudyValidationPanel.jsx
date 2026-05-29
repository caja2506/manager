import React, { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';

export default function TimingStudyValidationPanel({ validationResults, onSelectStep = null }) {
    const { isValid, errorCount, warningCount, infoCount, issues = [] } = validationResults || {};
    const [isExpanded, setIsExpanded] = useState(issues.length <= 5);
    const [severityFilter, setSeverityFilter] = useState('all'); // 'all', 'error', 'warning', 'info'

    const filteredIssues = useMemo(() => {
        if (severityFilter === 'all') return issues;
        return issues.filter(issue => issue.severity === severityFilter);
    }, [issues, severityFilter]);

    if (issues.length === 0) {
        return (
            <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-850 flex items-center gap-3 shadow-lg">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Validación del Estudio</h4>
                    <p className="text-xs text-slate-400 mt-0.5">El estudio no presenta observaciones críticas.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/70 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            {/* Header / Resumen */}
            <div className="px-6 py-4 bg-slate-950/20 flex items-center justify-between border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-4 h-4 ${errorCount > 0 ? 'text-red-400 animate-pulse' : warningCount > 0 ? 'text-amber-400' : 'text-blue-450'}`} />
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Validación del Estudio</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold">
                        {errorCount > 0 && (
                            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md">
                                {errorCount} Error{errorCount > 1 ? 'es' : ''}
                            </span>
                        )}
                        {warningCount > 0 && (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">
                                {warningCount} Advertencia{warningCount > 1 ? 's' : ''}
                            </span>
                        )}
                        {infoCount > 0 && (
                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
                                {infoCount} Info
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                    >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="p-6 space-y-4 bg-slate-950/5">
                    {/* Filtros de severidad */}
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-850">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-2">Filtrar por:</span>
                        <button
                            onClick={() => setSeverityFilter('all')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition border cursor-pointer ${
                                severityFilter === 'all'
                                    ? 'bg-slate-800 text-white border-slate-700'
                                    : 'bg-transparent text-slate-450 border-transparent hover:text-slate-200'
                            }`}
                        >
                            Todos ({issues.length})
                        </button>
                        {errorCount > 0 && (
                            <button
                                onClick={() => setSeverityFilter('error')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition border cursor-pointer ${
                                    severityFilter === 'error'
                                        ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                        : 'bg-transparent text-slate-450 border-transparent hover:text-red-400'
                                }`}
                            >
                                Errores ({errorCount})
                            </button>
                        )}
                        {warningCount > 0 && (
                            <button
                                onClick={() => setSeverityFilter('warning')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition border cursor-pointer ${
                                    severityFilter === 'warning'
                                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                        : 'bg-transparent text-slate-450 border-transparent hover:text-amber-400'
                                }`}
                            >
                                Advertencias ({warningCount})
                            </button>
                        )}
                        {infoCount > 0 && (
                            <button
                                onClick={() => setSeverityFilter('info')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition border cursor-pointer ${
                                    severityFilter === 'info'
                                        ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                        : 'bg-transparent text-slate-450 border-transparent hover:text-blue-400'
                                }`}
                            >
                                Información ({infoCount})
                            </button>
                        )}
                    </div>

                    {/* Lista de Issues */}
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {filteredIssues.map((issue) => {
                            const isError = issue.severity === 'error';
                            const isWarning = issue.severity === 'warning';
                            
                            let severityBg = 'bg-blue-500/5 border-blue-550/15 text-blue-400';
                            let severityIcon = <Info className="w-4 h-4 text-blue-450 shrink-0 mt-0.5" />;
                            if (isError) {
                                severityBg = 'bg-red-500/5 border-red-500/15 text-red-400';
                                severityIcon = <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />;
                            } else if (isWarning) {
                                severityBg = 'bg-amber-500/5 border-amber-500/15 text-amber-400';
                                severityIcon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
                            }

                            return (
                                <div
                                    key={issue.id}
                                    className={`flex items-start gap-3 p-3 rounded-xl border ${severityBg} text-xs transition hover:bg-slate-850/5`}
                                >
                                    {severityIcon}
                                    <div className="flex-1 space-y-1">
                                        <p className="font-semibold text-slate-250 leading-relaxed">{issue.message}</p>
                                        {issue.recommendation && (
                                            <p className="text-[11px] text-slate-400">
                                                <strong className="text-slate-350">Recomendación:</strong> {issue.recommendation}
                                            </p>
                                        )}
                                    </div>
                                    {issue.stepId && onSelectStep && (
                                        <button
                                            onClick={() => onSelectStep(issue.stepId)}
                                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded border border-slate-700 transition cursor-pointer text-[10px] font-bold shrink-0 self-center"
                                        >
                                            Ver Paso
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                        {filteredIssues.length === 0 && (
                            <p className="text-xs text-slate-500 text-center py-4 italic">No hay observaciones con este filtro.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
