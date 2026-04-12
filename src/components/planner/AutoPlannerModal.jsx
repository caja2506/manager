import React, { useMemo, useState, useEffect } from 'react';
import { X, Zap, Calendar, Clock, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, Users, User, Pencil } from 'lucide-react';
import { autoScheduleTask, autoScheduleAll } from '../../services/autoPlannerService';
import AvailabilityCalendar from './AvailabilityCalendar';

/**
 * AutoPlannerModal
 * ================
 * Preview and confirmation modal for auto-scheduling tasks.
 * Shows distribution preview, strategy messages, warnings,
 * person filter, and mode selection before committing to Firestore.
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
    onEditTask,
    options = {},
}) {
    const [mode, setMode] = useState('front-loaded');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedTask, setExpandedTask] = useState(null);
    const [includeOvertime, setIncludeOvertime] = useState(false);
    const [selectedAssignees, setSelectedAssignees] = useState(new Set());
    const [overrideEndDate, setOverrideEndDate] = useState('');

    // ── Extract unique assignees from tasks ──
    const assigneeOptions = useMemo(() => {
        const members = options.teamMembers || [];
        const uniqueIds = [...new Set(tasks.map(t => t.assignedTo).filter(Boolean))];
        return uniqueIds.map(uid => {
            const m = members.find(mm => mm.uid === uid);
            return {
                uid,
                name: m?.displayName || m?.email || uid,
                teamRole: m?.teamRole || '?',
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [tasks, options.teamMembers]);

    // Auto-select all assignees when modal opens or tasks change
    useEffect(() => {
        if (isOpen && assigneeOptions.length > 0) {
            setSelectedAssignees(new Set(assigneeOptions.map(a => a.uid)));
        }
    }, [isOpen, assigneeOptions]);

    // ── Filter tasks by selected assignees + inject overrideEndDate ──
    const filteredTasks = useMemo(() => {
        if (selectedAssignees.size === 0) return [];
        return tasks.filter(t => selectedAssignees.has(t.assignedTo)).map(t => ({
            ...t,
            plannedEndDate: t.plannedEndDate || overrideEndDate || null,
        }));
    }, [tasks, selectedAssignees, overrideEndDate]);

    // ── Compute schedule preview ──
    const preview = useMemo(() => {
        if (!filteredTasks.length) return null;

        if (filteredTasks.length === 1) {
            const result = autoScheduleTask(filteredTasks[0], existingPlanItems, { ...options, mode });
            return {
                results: [{ task: filteredTasks[0], ...result }],
                globalWarnings: [],
                totalBlocks: result.blocks.length,
                totalHours: result.blocks.reduce((s, b) => s + b.plannedHours, 0),
                totalOvertimeBlocks: (result.overtime || []).length,
                totalOvertimeHours: (result.overtime || []).reduce((s, b) => s + b.plannedHours, 0),
            };
        }

        const batch = autoScheduleAll(filteredTasks, existingPlanItems, { ...options, mode });
        return {
            ...batch,
            totalBlocks: batch.results.reduce((s, r) => s + r.blocks.length, 0),
            totalHours: batch.results.reduce((s, r) =>
                s + r.blocks.reduce((bs, b) => bs + b.plannedHours, 0), 0),
            totalOvertimeBlocks: batch.results.reduce((s, r) => s + (r.overtime || []).length, 0),
            totalOvertimeHours: batch.results.reduce((s, r) =>
                s + (r.overtime || []).reduce((bs, b) => bs + b.plannedHours, 0), 0),
        };
    }, [filteredTasks, existingPlanItems, options, mode]);

    // ── Handlers ──
    const handleConfirm = async () => {
        if (!preview || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const allBlocks = preview.results.flatMap(r => r.blocks);
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

    const toggleAssignee = (uid) => {
        setSelectedAssignees(prev => {
            const next = new Set(prev);
            if (next.has(uid)) next.delete(uid);
            else next.add(uid);
            return next;
        });
    };

    const selectAll = () => setSelectedAssignees(new Set(assigneeOptions.map(a => a.uid)));
    const selectNone = () => setSelectedAssignees(new Set());

    if (!isOpen) return null;

    const isSingle = tasks.length === 1 && assigneeOptions.length <= 1;
    const roleColors = {
        engineer: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        technician: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
        team_lead: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        manager: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        '?': 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    };
    const roleLabels = {
        engineer: 'Ing',
        technician: 'Téc',
        team_lead: 'TL',
        manager: 'Mgr',
        '?': '?',
    };

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
                            {isSingle ? 'Auto-Planificar Tarea' : `Auto-Planificar ${filteredTasks.length} Tareas`}
                        </h2>
                        {isSingle && filteredTasks[0] && (
                            <p className="text-sm text-slate-400 truncate">{filteredTasks[0]?.title}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Controls bar: Mode + Person filter ── */}
                <div className="px-6 py-3 border-b border-slate-800/50 space-y-3">

                    {/* Date range display */}
                    {isSingle && filteredTasks[0] && (
                        <div className="flex items-center gap-3 text-xs">
                            <span className="font-bold text-slate-500 uppercase w-12">Rango:</span>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-1 rounded-md bg-slate-800 text-slate-300 font-mono">
                                    📅 {filteredTasks[0].plannedStartDate || '—'}
                                </span>
                                <span className="text-slate-600">→</span>
                                {tasks[0]?.plannedEndDate ? (
                                    <span className="px-2 py-1 rounded-md bg-slate-800 text-slate-300 font-mono">
                                        📅 {tasks[0].plannedEndDate}
                                    </span>
                                ) : (
                                    <AvailabilityCalendar
                                        value={overrideEndDate}
                                        onChange={(date) => setOverrideEndDate(date)}
                                        planItems={existingPlanItems}
                                        assignedTo={filteredTasks[0].assignedTo}
                                        minDate={filteredTasks[0].plannedStartDate ? new Date(filteredTasks[0].plannedStartDate + 'T00:00:00') : undefined}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Mode selector */}
                    {(() => {
                        const hasEndDate = filteredTasks.every(t => !!t.plannedEndDate);
                        return (
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-bold text-slate-500 uppercase w-12">Modo:</span>
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
                                <div className="relative group">
                                    <button
                                        onClick={() => hasEndDate ? setMode('uniform') : null}
                                        disabled={!hasEndDate}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            !hasEndDate
                                                ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                                : mode === 'uniform'
                                                    ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50'
                                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                        }`}
                                    >
                                        📊 Uniforme
                                    </button>
                                    {!hasEndDate && (
                                        <div className="absolute left-0 top-full mt-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-[10px] text-amber-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                            Requiere fecha de fin para distribuir uniformemente
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Person filter — only show if multiple assignees */}
                    {assigneeOptions.length > 1 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-500 uppercase w-12 flex items-center gap-1">
                                    <Users className="w-3 h-3" /> Para:
                                </span>
                                <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                                    {assigneeOptions.map(a => {
                                        const isSelected = selectedAssignees.has(a.uid);
                                        const taskCount = tasks.filter(t => t.assignedTo === a.uid).length;
                                        return (
                                            <button
                                                key={a.uid}
                                                onClick={() => toggleAssignee(a.uid)}
                                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                                    isSelected
                                                        ? `${roleColors[a.teamRole] || roleColors['?']} ring-1 ring-current/30`
                                                        : 'bg-slate-800/50 text-slate-500 border-slate-700/50 hover:bg-slate-800'
                                                }`}
                                                title={`${a.name} (${a.teamRole}) — ${taskCount} tareas`}
                                            >
                                                <span className={`text-[9px] font-black uppercase px-1 py-0.5 rounded ${
                                                    isSelected
                                                        ? roleColors[a.teamRole] || roleColors['?']
                                                        : 'bg-slate-700/50 text-slate-500'
                                                }`}>
                                                    {roleLabels[a.teamRole] || '?'}
                                                </span>
                                                <span className="truncate max-w-[100px]">{a.name.split(' ')[0]}</span>
                                                <span className={`text-[9px] ${isSelected ? 'opacity-70' : 'opacity-40'}`}>
                                                    {taskCount}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* Select all / none */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={selectAll}
                                        className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 uppercase px-1.5 py-1 rounded hover:bg-indigo-500/10 transition-colors"
                                        title="Seleccionar todos"
                                    >
                                        Todos
                                    </button>
                                    <span className="text-slate-700">|</span>
                                    <button
                                        onClick={selectNone}
                                        className="text-[9px] font-bold text-slate-500 hover:text-slate-400 uppercase px-1.5 py-1 rounded hover:bg-slate-500/10 transition-colors"
                                        title="Deseleccionar todos"
                                    >
                                        Ninguno
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Content ── */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

                    {/* Empty state */}
                    {selectedAssignees.size === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                            <Users className="w-10 h-10 mb-3 opacity-40" />
                            <p className="text-sm font-bold">Selecciona al menos una persona</p>
                            <p className="text-xs mt-1 opacity-70">Usa los filtros arriba para elegir a quién planificar</p>
                        </div>
                    )}

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
                                    {preview.results.filter(r => r.blocks.length > 0).length} de {filteredTasks.length} tareas
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-cyan-400" />
                                <span className="text-sm font-bold text-white">
                                    {selectedAssignees.size} persona{selectedAssignees.size !== 1 ? 's' : ''}
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
                                        {/* Show assignee name */}
                                        {assigneeOptions.length > 1 && (() => {
                                            const a = assigneeOptions.find(ao => ao.uid === result.task.assignedTo);
                                            return a ? ` · ${a.name.split(' ')[0]}` : '';
                                        })()}
                                    </p>
                                </div>
                                {/* Edit task button */}
                                {onEditTask && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEditTask(result.task);
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-indigo-500/20 text-slate-500 hover:text-indigo-400 transition-colors shrink-0"
                                        title="Editar tarea"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                )}
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
                                            w.startsWith('✅') ? 'text-emerald-400' :
                                            w.startsWith('⏱') ? 'text-orange-400' : 'text-slate-400'
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
