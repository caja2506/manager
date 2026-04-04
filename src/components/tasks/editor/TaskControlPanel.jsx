import React, { useState } from 'react';
import {
    Clock, BarChart2, AlertTriangle,
    ChevronDown, ChevronRight, Settings2, User,
    Link2, ShieldAlert, CalendarRange, CalendarDays, Target, MapPin
} from 'lucide-react';
import {
    TASK_STATUS, TASK_STATUS_CONFIG,
} from '../../../models/schemas';

/**
 * TaskControlPanel — right column of the task editor.
 * Contains:
 *  - Quick actions (Bloqueado / Cancelado)
 *  - Time section (estimated hours, actual hours, due date)
 *  - Progress (auto from subtasks or manual)
 *  - Details (task type, assigned by)
 *  - Dependencies and blockers (if any)
 */

/** Collapsible section wrapper */
function Section({ title, icon: Icon, defaultOpen = true, children, badge }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border-t border-slate-700/60 pt-3">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between w-full mb-2 group"
            >
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    {Icon && <Icon className="w-3 h-3" />}
                    {title}
                    {badge !== undefined && badge !== null && (
                        <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/15 px-1.5 py-0.5 rounded-full normal-case tracking-normal">
                            {badge}
                        </span>
                    )}
                </span>
                {open
                    ? <ChevronDown className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
                    : <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
                }
            </button>
            {open && <div className="space-y-2 animate-in fade-in duration-150">{children}</div>}
        </div>
    );
}

export default function TaskControlPanel({
    form, setForm, isNew, task,
    canEdit, canEditDates, subtasks, teamMembers, taskTypes,
    timeLogs = [], allTasks = [], delays = [], dependencies = [], plannerItems = [],
    projectMilestones = [], milestoneWorkAreas = [],
    onStatusChange, onOpenDelayReport, onOpenListManager,
}) {
    // ── Subtask-based auto progress ──
    const totalSubtasks = subtasks.length;
    const completedSubtasks = subtasks.filter(s => s.completed).length;
    const autoProgress = totalSubtasks > 0
        ? Math.round((completedSubtasks / totalSubtasks) * 100)
        : null;
    const displayProgress = autoProgress !== null ? autoProgress : (form.percentComplete || 0);

    // ── Actual hours from timeLogs ──
    const taskId = task?.id;
    const actualHours = taskId
        ? timeLogs
            .filter(log => log.taskId === taskId && log.totalHours)
            .reduce((sum, log) => sum + (log.totalHours || 0), 0)
        : 0;

    // ── Dependencies ──
    const predecessors = taskId
        ? dependencies.filter(d => d.successorTaskId === taskId)
        : [];
    const successors = taskId
        ? dependencies.filter(d => d.predecessorTaskId === taskId)
        : [];

    const getTaskTitle = (id) => {
        const t = allTasks.find(task => task.id === id);
        return t ? t.title : id?.slice(0, 8) + '...';
    };

    // ── Blockers (delays linked to this task) ──
    const taskDelays = taskId
        ? delays.filter(d => d.taskId === taskId && !d.resolved)
        : [];

    // ── Planner slots ──
    const taskPlannerItems = taskId
        ? plannerItems.filter(p => p.taskId === taskId)
        : [];
    const totalPlannedHours = taskPlannerItems.reduce((sum, p) => sum + (p.plannedHours || 0), 0);

    return (
        <div className="w-full lg:w-1/2 flex flex-col bg-slate-850 lg:bg-transparent overflow-y-auto">
            <div className="p-4 lg:p-5 space-y-3">

                {/* ─── QUICK ACTIONS ─── */}
                {!isNew && (
                    <div className="space-y-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                            Acciones Rápidas
                        </span>
                        <div className="flex gap-2">
                            {[TASK_STATUS.BLOCKED, TASK_STATUS.CANCELLED].map(s => {
                                const cfg = TASK_STATUS_CONFIG[s];
                                const isActive = form.status === s;

                                return (
                                    <button
                                        key={s}
                                        onClick={() => {
                                            if (!canEdit) return;
                                            if (s === TASK_STATUS.BLOCKED) {
                                                onOpenDelayReport();
                                            } else {
                                                onStatusChange(s);
                                            }
                                        }}
                                        disabled={!canEdit}
                                        className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-black tracking-wide uppercase transition-all border ${isActive
                                            ? s === TASK_STATUS.BLOCKED
                                                ? 'bg-red-500 text-white shadow-md border-transparent'
                                                : 'bg-gray-500 text-white shadow-md border-transparent'
                                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-300 hover:border-slate-600'
                                            }`}
                                    >
                                        {cfg.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Blocked reason */}
                        {form.status === 'blocked' && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2.5 animate-in fade-in duration-200 mt-1">
                                <span className="text-[9px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
                                    <AlertTriangle className="w-3 h-3" /> Motivo bloqueo
                                </span>
                                <textarea
                                    value={form.blockedReason}
                                    onChange={e => setForm({ ...form, blockedReason: e.target.value })}
                                    placeholder="Razón del bloqueo..."
                                    className="w-full px-2 py-1.5 border border-red-500/30 rounded-lg text-[11px] bg-slate-800 outline-none focus:ring-1 focus:ring-red-400 text-red-300 placeholder-red-400/40 resize-none"
                                    rows={2}
                                    disabled={!canEdit}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* ─── V5: MILESTONE / AREA ─── */}
                <Section title="Milestone / Área" icon={Target} defaultOpen={true}>
                    {/* Milestone selector */}
                    <div>
                        <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1 mb-0.5">
                            <Target className="w-2.5 h-2.5" /> Milestone
                        </span>
                        <select
                            value={form.milestoneId}
                            onChange={e => setForm({ ...form, milestoneId: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-200"
                            disabled={!canEdit || !form.projectId}
                        >
                            <option value="">Sin milestone</option>
                            {projectMilestones.map(ms => (
                                <option key={ms.id} value={ms.id}>{ms.name || ms.title || ms.id}</option>
                            ))}
                        </select>
                        {!form.projectId && (
                            <p className="text-[9px] text-amber-400/70 mt-0.5 italic">Selecciona un proyecto primero</p>
                        )}
                    </div>

                    {/* Area — read-only auto-resolved */}
                    {form.milestoneId && (
                        <div>
                            <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1 mb-0.5">
                                <MapPin className="w-2.5 h-2.5" /> Área (auto-asignada)
                            </span>
                            {(() => {
                                // Find resolved area from milestoneWorkAreas by taskTypeId
                                const resolvedArea = milestoneWorkAreas.find(area => {
                                    const types = [...(area.taskTypeIds || []), ...(area.taskFilter?.typeMatch || [])];
                                    return types.includes(form.taskTypeId);
                                });
                                return resolvedArea ? (
                                    <div className="px-2.5 py-1.5 border border-teal-500/30 rounded-lg text-xs bg-teal-500/10 text-teal-300 font-bold flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
                                        {resolvedArea.name}
                                    </div>
                                ) : (
                                    <div className="px-2.5 py-1.5 border border-amber-500/30 rounded-lg text-xs bg-amber-500/10 text-amber-300 font-medium">
                                        ⚠ Sin área mapeada para este tipo de tarea
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Critical task warning */}
                    {!form.milestoneId && form.priority === 'critical' && (
                        <div className="px-2.5 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] text-amber-300 leading-snug">
                                Esta tarea es <strong>crítica</strong>. Considere asignarla a un milestone para seguimiento de score.
                            </p>
                        </div>
                    )}
                </Section>

                {/* ─── TIME ─── */}
                <Section title="Tiempo" icon={Clock} defaultOpen={true}>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <span className="text-[9px] font-bold text-slate-500 block mb-0.5">Horas est.</span>
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={form.estimatedHours}
                                onChange={e => setForm({ ...form, estimatedHours: e.target.value })}
                                placeholder="0"
                                className="w-full px-2.5 py-1.5 border border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-200"
                                disabled={!canEdit}
                            />
                        </div>
                        <div>
                            <span className="text-[9px] font-bold text-slate-500 block mb-0.5">Horas reales</span>
                            <div className="px-2.5 py-1.5 border border-slate-700/50 rounded-lg text-xs bg-slate-800/50 text-slate-300 font-bold">
                                {actualHours.toFixed(1)}h
                                {form.estimatedHours > 0 && (
                                    <span className={`ml-1 text-[9px] ${actualHours > Number(form.estimatedHours) ? 'text-red-400' : 'text-emerald-400'}`}>
                                        ({Math.round((actualHours / Number(form.estimatedHours)) * 100)}%)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div>
                        <span className="text-[9px] font-bold text-slate-500 block mb-0.5">Fecha límite</span>
                        <input
                            type="date"
                            value={form.dueDate}
                            onChange={e => setForm({ ...form, dueDate: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-200"
                            disabled={!canEditDates && !!form.dueDate}
                        />
                    </div>
                    {/* Planned Start / End Dates */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                            <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1 mb-0.5">
                                <CalendarDays className="w-2.5 h-2.5" /> Inicio plan
                            </span>
                            <input
                                type="date"
                                value={form.plannedStartDate}
                                onChange={e => setForm({ ...form, plannedStartDate: e.target.value })}
                                className="w-full px-2.5 py-1.5 border border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-200"
                                disabled={!canEditDates && !!form.plannedStartDate}
                            />
                        </div>
                        <div>
                            <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1 mb-0.5">
                                <CalendarDays className="w-2.5 h-2.5" /> Fin plan
                            </span>
                            <input
                                type="date"
                                value={form.plannedEndDate}
                                onChange={e => setForm({ ...form, plannedEndDate: e.target.value })}
                                className="w-full px-2.5 py-1.5 border border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-200"
                                disabled={!canEditDates && !!form.plannedEndDate}
                            />
                        </div>
                    </div>
                </Section>

                {/* ─── PLANIFICACIÓN ─── */}
                {!isNew && taskPlannerItems.length > 0 && (
                    <Section title="Planificación" icon={CalendarRange} defaultOpen={false} badge={`${taskPlannerItems.length} slots`}>
                        <div className="space-y-1">
                            {taskPlannerItems.map((item, i) => (
                                <div key={item.id || i} className="flex items-center justify-between px-2 py-1.5 bg-slate-800/60 rounded-lg text-[10px]">
                                    <span className="text-slate-300 font-medium">
                                        {item.date || 'Sin fecha'}
                                    </span>
                                    <span className="text-indigo-400 font-bold">
                                        {item.plannedHours || 0}h
                                    </span>
                                </div>
                            ))}
                            <div className="flex items-center justify-between px-2 py-1 border-t border-slate-700/50 mt-1">
                                <span className="text-[9px] font-bold text-slate-500">Total planificado</span>
                                <span className="text-[10px] font-black text-indigo-400">{totalPlannedHours.toFixed(1)}h</span>
                            </div>
                        </div>
                    </Section>
                )}



                {/* ─── DEPENDENCIAS ─── */}
                {!isNew && (predecessors.length > 0 || successors.length > 0) && (
                    <Section title="Dependencias" icon={Link2} defaultOpen={false} badge={predecessors.length + successors.length}>
                        {predecessors.length > 0 && (
                            <div className="space-y-1">
                                <span className="text-[9px] font-bold text-slate-500">Depende de:</span>
                                {predecessors.map(dep => (
                                    <div key={dep.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/60 rounded-lg">
                                        <Link2 className="w-3 h-3 text-amber-400 flex-shrink-0" />
                                        <span className="text-[10px] text-slate-300 truncate flex-1">
                                            {getTaskTitle(dep.predecessorTaskId)}
                                        </span>
                                        <span className="text-[8px] font-bold text-slate-500 bg-slate-700 px-1 py-0.5 rounded">
                                            {dep.type || 'FS'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {successors.length > 0 && (
                            <div className="space-y-1 mt-1">
                                <span className="text-[9px] font-bold text-slate-500">Bloquea a:</span>
                                {successors.map(dep => (
                                    <div key={dep.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/60 rounded-lg">
                                        <Link2 className="w-3 h-3 text-red-400 flex-shrink-0" />
                                        <span className="text-[10px] text-slate-300 truncate flex-1">
                                            {getTaskTitle(dep.successorTaskId)}
                                        </span>
                                        <span className="text-[8px] font-bold text-slate-500 bg-slate-700 px-1 py-0.5 rounded">
                                            {dep.type || 'FS'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>
                )}

                {/* ─── BLOQUEOS (active delays) ─── */}
                {!isNew && taskDelays.length > 0 && (
                    <Section title="Bloqueos Activos" icon={ShieldAlert} defaultOpen={true} badge={taskDelays.length}>
                        <div className="space-y-1.5">
                            {taskDelays.map(delay => (
                                <div key={delay.id} className="px-2.5 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    <div className="flex items-center gap-1.5">
                                        <ShieldAlert className="w-3 h-3 text-red-400 flex-shrink-0" />
                                        <span className="text-[10px] font-bold text-red-300">
                                            {delay.causeName || 'Causa desconocida'}
                                        </span>
                                    </div>
                                    {delay.comment && (
                                        <p className="text-[10px] text-red-300/70 mt-1 ml-4.5 leading-tight">
                                            {delay.comment}
                                        </p>
                                    )}
                                    <span className="text-[8px] text-red-400/50 mt-1 block ml-4.5">
                                        {delay.createdAt ? new Date(delay.createdAt).toLocaleDateString() : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* ─── METADATA ─── */}
                <Section title="Detalles" icon={Settings2} defaultOpen={false}>
                    {/* Assigned By */}
                    <div>
                        <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1 mb-0.5">
                            <User className="w-2.5 h-2.5" /> Asignado por
                        </span>
                        <select
                            value={form.assignedBy}
                            onChange={e => setForm({ ...form, assignedBy: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-200"
                            disabled={!canEdit}
                        >
                            <option value="">Desconocido</option>
                            {teamMembers.map(u => (
                                <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>
                            ))}
                        </select>
                    </div>
                </Section>

            </div>
        </div>
    );
}
