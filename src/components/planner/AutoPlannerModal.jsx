import React, { useMemo, useState } from 'react';
import { X, Zap, Calendar, Clock, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { autoScheduleTask, autoScheduleAll } from '../../services/autoPlannerService';

/**
 * AutoPlannerModal
 * ================
 * Preview and confirmation modal for auto-scheduling tasks.
 * Shows distribution preview, strategy messages, warnings,
 * and mode selection before committing to Firestore.
 *
 * Props:
 *   isOpen          — boolean
 *   onClose         — () => void
 *   tasks           — task(s) to auto-schedule (array, even for single)
 *   existingPlanItems — current weeklyPlanItems
 *   onConfirm       — (blocks[]) => Promise<void>
 *   options         — { createdBy, breakBands, projectColorMap, projects, teamMembers }
 */
export default function AutoPlannerModal({
    isOpen,
    onClose,
    tasks = [],
    existingPlanItems = [],
    onConfirm,
    options = {},
}) {
    const [mode, setMode] = useState('front-loaded');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedTask, setExpandedTask] = useState(null);
    const [includeOvertime, setIncludeOvertime] = useState(false);

    // ── Compute schedule preview ──
    const preview = useMemo(() => {
        if (!tasks.length) return null;

        if (tasks.length === 1) {
            const result = autoScheduleTask(tasks[0], existingPlanItems, { ...options, mode });
            return {
                results: [{ task: tasks[0], ...result }],
                globalWarnings: [],
                totalBlocks: result.blocks.length,
                totalHours: result.blocks.reduce((s, b) => s + b.plannedHours, 0),
                totalOvertimeBlocks: (result.overtime || []).length,
                totalOvertimeHours: (result.overtime || []).reduce((s, b) => s + b.plannedHours, 0),
            };
        }

        const batch = autoScheduleAll(tasks, existingPlanItems, { ...options, mode });
        return {
            ...batch,
            totalBlocks: batch.results.reduce((s, r) => s + r.blocks.length, 0),
            totalHours: batch.results.reduce((s, r) =>
                s + r.blocks.reduce((bs, b) => bs + b.plannedHours, 0), 0),
            totalOvertimeBlocks: batch.results.reduce((s, r) => s + (r.overtime || []).length, 0),
            totalOvertimeHours: batch.results.reduce((s, r) =>
                s + (r.overtime || []).reduce((bs, b) => bs + b.plannedHours, 0), 0),
        };
    }, [tasks, existingPlanItems, options, mode]);

    // ── Handlers ──
    const handleConfirm = async () => {
        if (!preview || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const allBlocks = preview.results.flatMap(r => r.blocks);
            // Add overtime blocks if checkbox is checked
            if (includeOvertime) {
                const overtimeBlocks = preview.results.flatMap(r => r.overtime || []);
                allBlocks.push(...overtimeBlocks);
            }
            await onConfirm(allBlocks);
            onClose();
        } catch (err) {
            console.error('[AutoPlannerModal] Error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const isSingle = tasks.length === 1;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">

                {/* ── Header ── */}
                <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/15">
                        <Zap className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-black text-white">
                            {isSingle ? 'Auto-Planificar Tarea' : `Auto-Planificar ${tasks.length} Tareas`}
                        </h2>
                        {isSingle && (
                            <p className="text-sm text-slate-400 truncate">{tasks[0]?.title}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Mode selector ── */}
                <div className="px-6 py-3 border-b border-slate-800/50 flex items-center gap-4">
                    <span className="text-xs font-bold text-slate-500 uppercase">Modo:</span>
                    <button
                        onClick={() => setMode('front-loaded')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            mode === 'front-loaded'
                                ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        ⚡ Carga Temprana
                    </button>
                    <button
                        onClick={() => setMode('uniform')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            mode === 'uniform'
                                ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        📊 Uniforme
                    </button>
                </div>

                {/* ── Content ── */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

                    {/* Summary bar */}
                    {preview && (
                        <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-400" />
                                <span className="text-sm font-bold text-white">{preview.totalBlocks} bloques</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-emerald-400" />
                                <span className="text-sm font-bold text-white">{preview.totalHours.toFixed(1)}h total</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                                <span className="text-sm font-bold text-white">
                                    {preview.results.filter(r => r.blocks.length > 0).length} de {tasks.length} tareas
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Global warnings */}
                    {preview?.globalWarnings?.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{w}</span>
                        </div>
                    ))}

                    {/* Per-task results */}
                    {preview?.results?.map((result, idx) => (
                        <div key={result.task.id || idx} className="rounded-xl border border-slate-700/50 overflow-hidden">
                            {/* Task header */}
                            <button
                                onClick={() => setExpandedTask(expandedTask === idx ? null : idx)}
                                className="w-full px-4 py-3 flex items-center gap-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors text-left"
                            >
                                <div className={`w-2 h-2 rounded-full shrink-0 ${
                                    result.blocks.length > 0 ? 'bg-emerald-400' :
                                    result.strategy.strategy === 'not_plannable' ? 'bg-red-400' : 'bg-amber-400'
                                }`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{result.task.title}</p>
                                    <p className="text-[10px] text-slate-500 font-medium">
                                        {result.task.priority} · {result.blocks.length} bloques · {result.blocks.reduce((s, b) => s + b.plannedHours, 0).toFixed(1)}h
                                    </p>
                                </div>
                                {(isSingle || expandedTask === idx)
                                    ? <ChevronUp className="w-4 h-4 text-slate-500" />
                                    : <ChevronDown className="w-4 h-4 text-slate-500" />
                                }
                            </button>

                            {/* Blocks detail */}
                            {(isSingle || expandedTask === idx) && (
                                <div className="px-4 py-3 space-y-2 bg-slate-900/50">

                                    {/* Strategy message */}
                                    {result.warnings?.map((w, wi) => (
                                        <div key={wi} className={`flex items-start gap-2 text-[11px] font-medium ${
                                            w.startsWith('⚠') ? 'text-amber-400' :
                                            w.startsWith('✅') ? 'text-emerald-400' : 'text-slate-400'
                                        }`}>
                                            <Info className="w-3 h-3 shrink-0 mt-0.5" />
                                            <span>{w}</span>
                                        </div>
                                    ))}

                                    {/* Blocks table */}
                                    {result.blocks.length > 0 && (
                                        <table className="w-full text-xs mt-2">
                                            <thead>
                                                <tr className="text-slate-500 font-bold uppercase text-[10px]">
                                                    <th className="text-left pb-1.5">Día</th>
                                                    <th className="text-left pb-1.5">Horario</th>
                                                    <th className="text-right pb-1.5">Horas</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.blocks.map((block, bi) => {
                                                    const start = new Date(block.startDateTime);
                                                    const end = new Date(block.endDateTime);
                                                    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                                                    return (
                                                        <tr key={bi} className="border-t border-slate-800/50 text-slate-300">
                                                            <td className="py-1.5 font-bold">
                                                                {dayNames[start.getDay()]} {start.getDate()}/{start.getMonth() + 1}
                                                            </td>
                                                            <td className="py-1.5">
                                                                {_fmtTime(start)} — {_fmtTime(end)}
                                                            </td>
                                                            <td className="py-1.5 text-right font-bold text-indigo-400">
                                                                {block.plannedHours.toFixed(1)}h
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Overtime section */}
                    {preview && preview.totalOvertimeBlocks > 0 && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
                            <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-amber-500/10 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={includeOvertime}
                                    onChange={e => setIncludeOvertime(e.target.checked)}
                                    className="rounded border-amber-500/50 text-amber-500 focus:ring-amber-500/30"
                                />
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-amber-300">
                                        ⏱ Incluir {preview.totalOvertimeHours.toFixed(1)}h de horas extras
                                    </p>
                                    <p className="text-[10px] text-amber-400/70 font-medium">
                                        {preview.totalOvertimeBlocks} bloques de overtime (17:00–19:00)
                                    </p>
                                </div>
                            </label>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-400 font-bold text-sm hover:bg-slate-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting || !preview?.totalBlocks}
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                    >
                        {isSubmitting ? (
                            <span className="animate-pulse">Creando bloques...</span>
                        ) : (
                            <>
                                <Zap className="w-4 h-4" />
                                Confirmar {preview?.totalBlocks || 0} bloques
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

function _fmtTime(d) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
