import React from 'react';
import { AlertTriangle, Info, ChevronRight, X, CheckCircle, AlertOctagon } from 'lucide-react';

/**
 * TransitionConfirmModal
 * ======================
 * 
 * Modal shown when a workflow transition requires confirmation
 * (warnings, missing required fields, backward transitions).
 */

export default function TransitionConfirmModal({
    isOpen,
    pending,
    isTransitioning,
    onConfirm,
    onCancel,
}) {
    if (!isOpen || !pending) return null;

    const { task, targetStatus, warnings, missingFields } = pending;

    const hasBlockers = missingFields?.length > 0;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

            {/* Modal */}
            <div className="relative bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl shadow-black/50 w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {hasBlockers ? (
                            <AlertOctagon className="w-5 h-5 text-rose-400" />
                        ) : (
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                        )}
                        <h3 className="text-lg font-black text-white">
                            {hasBlockers ? 'Campos Requeridos' : 'Confirmar Transición'}
                        </h3>
                    </div>
                    <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Task Info */}
                <div className="px-5 py-3 bg-slate-800/50 border-b border-slate-800">
                    <p className="text-xs font-bold text-slate-300 truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{task.status}</span>
                        <ChevronRight className="w-3 h-3 text-slate-600" />
                        <span className="text-[10px] font-bold text-indigo-400 uppercase">{targetStatus}</span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    {/* Missing Fields */}
                    {hasBlockers && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider">
                                Campos faltantes para esta transición:
                            </h4>
                            {missingFields.map(field => (
                                <div key={field.name} className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                                    <AlertOctagon className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                                    <div>
                                        <span className="text-xs font-bold text-slate-200">{field.label || field.name}</span>
                                        {field.description && (
                                            <p className="text-[10px] text-slate-500 mt-0.5">{field.description}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Warnings */}
                    {warnings?.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                                Advertencias:
                            </h4>
                            {warnings.map((warning, i) => (
                                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                                    <span className="text-xs text-slate-300">{warning}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isTransitioning || hasBlockers}
                        className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors shadow-lg shadow-indigo-900/30 flex items-center gap-2"
                    >
                        {isTransitioning ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-3.5 h-3.5" />
                                Confirmar Transición
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
