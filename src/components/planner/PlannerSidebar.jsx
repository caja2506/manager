import React, { useState } from 'react';
import { Clock, Briefcase, Plus, GripVertical, MousePointerClick, Move, ArrowDownUp, HelpCircle, X, ChevronDown, ChevronUp, Pencil, User } from 'lucide-react';

/**
 * Unscheduled tasks panel for the Weekly Planner sidebar.
 * Supports:
 *  - HTML5 drag onto the grid
 *  - "+" button enters placement mode — user clicks on the grid to place the task
 */
export default function PlannerSidebar({
    unscheduledTasks,
    onDragStart,
    onStartPlacement,
    onTaskEdit,
    placingTask,
    onCancelPlacement,
}) {
    const [showHelp, setShowHelp] = useState(false);

    const priorityColors = {
        critical: 'bg-red-500/15 border-red-500/30 text-red-400',
        high: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
        medium: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
        low: 'bg-slate-800 border-slate-700 text-slate-400',
    };

    const filtered = unscheduledTasks;

    return (
        <aside className="w-72 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <h2 className="font-black text-slate-400 text-sm uppercase tracking-wider">Sin Planificar</h2>
                <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{filtered.length}</span>
            </div>

            {/* ── Usage instructions toggle ── */}
            <button
                onClick={() => setShowHelp(h => !h)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500/10 border-b border-indigo-500/20 text-[11px] text-indigo-400 font-bold hover:bg-indigo-500/15 transition-colors w-full text-left"
            >
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1">¿Cómo planificar tareas?</span>
                {showHelp
                    ? <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                    : <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                }
            </button>

            {showHelp && (
                <div className="px-4 py-3 bg-indigo-500/8 border-b border-indigo-500/20 space-y-2.5 text-[10px] text-indigo-300">
                    <div className="flex items-start gap-2">
                        <GripVertical className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                        <span><b className="text-indigo-200">Arrastrar:</b> Arrastra una tarjeta desde aquí y suéltala en el horario deseado de la grilla.</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <MousePointerClick className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                        <span><b className="text-indigo-200">Botón +:</b> Presiona <span className="bg-indigo-500/25 px-1 rounded font-black">+</span> en una tarjeta, luego haz clic en la grilla donde quieras colocarla.</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <Move className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                        <span><b className="text-indigo-200">Mover:</b> Arrastra un bloque ya colocado en la grilla para cambiar su día/hora.</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <ArrowDownUp className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                        <span><b className="text-indigo-200">Redimensionar:</b> Arrastra el borde inferior de un bloque para cambiar su duración.</span>
                    </div>
                </div>
            )}

            {/* ── Placement mode banner ── */}
            {placingTask && (
                <div className="px-4 py-3 bg-emerald-500/15 border-b border-emerald-500/30 flex items-center gap-2 animate-pulse">
                    <MousePointerClick className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-emerald-300 leading-tight">Modo colocación activo</p>
                        <p className="text-[10px] text-emerald-400/80 font-medium truncate">
                            Haz clic en la grilla para colocar: <b>{placingTask.title}</b>
                        </p>
                    </div>
                    <button
                        onClick={onCancelPlacement}
                        className="shrink-0 p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                        title="Cancelar colocación"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            <ul className="flex-1 overflow-y-auto p-3 space-y-2">
                {filtered.length === 0 && (
                    <li className="text-center py-10 text-slate-400 text-xs font-bold uppercase">
                        Todas las tareas están planificadas ✓
                    </li>
                )}
                {filtered.map(task => {
                    const prioClass = priorityColors[task.priority] || priorityColors.low;
                    const remainingHours = (task.estimatedHours || 0) - (task.plannedHours || 0);
                    const isBeingPlaced = placingTask?.id === task.id;

                    return (
                        <li
                            key={task.id}
                            draggable
                            onDragStart={e => {
                                e.dataTransfer.setData('text/plain', task.id);
                                e.dataTransfer.effectAllowed = 'move';
                                onDragStart && onDragStart(task);
                            }}
                            className={`group relative p-3 rounded-2xl border-2 ${prioClass} select-none transition-all hover:shadow-md cursor-grab active:cursor-grabbing
                                ${isBeingPlaced ? 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/20' : ''}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <p className="font-bold text-sm leading-tight line-clamp-2 flex-1">{task.title}</p>

                                <div className="flex items-center gap-1 shrink-0">
                                    {/* Edit button */}
                                    {onTaskEdit && (
                                        <button
                                            onClick={e => {
                                                e.stopPropagation();
                                                onTaskEdit(task);
                                            }}
                                            className="opacity-60 hover:opacity-100 bg-slate-800/50 hover:bg-slate-700 p-1.5 rounded-lg transition-all"
                                            title="Editar tarea"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                    )}

                                    {/* Placement "+" button */}
                                    {onStartPlacement && (
                                        <button
                                            onClick={e => {
                                                e.stopPropagation();
                                                if (isBeingPlaced) {
                                                    onCancelPlacement && onCancelPlacement();
                                                } else {
                                                    onStartPlacement(task);
                                                }
                                            }}
                                            className={`transition-all p-1.5 rounded-lg
                                                ${isBeingPlaced
                                                    ? 'bg-emerald-500/30 text-emerald-300 opacity-100 ring-1 ring-emerald-400'
                                                    : 'opacity-60 hover:opacity-100 bg-slate-800/50 hover:bg-slate-700'
                                                }`}
                                            title={isBeingPlaced ? 'Cancelar colocación' : 'Colocar en la grilla — haz clic en el horario deseado'}
                                        >
                                            {isBeingPlaced
                                                ? <X className="w-3.5 h-3.5" />
                                                : <Plus className="w-3.5 h-3.5" />
                                            }
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-2 text-[10px] font-black uppercase opacity-80">
                                <span className="flex items-center gap-1">
                                    <Briefcase className="w-3 h-3" />
                                    <span className="truncate max-w-[100px]">{task.projectName || '—'}</span>
                                </span>
                                {(task.estimatedHours > 0) && (
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {remainingHours > 0 ? `${remainingHours}h pend.` : `${task.estimatedHours}h est.`}
                                    </span>
                                )}
                            </div>
                            {task.assigneeName && (
                                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-indigo-300/80 font-semibold">
                                    <User className="w-3 h-3" />
                                    <span className="truncate">{task.assigneeName}</span>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            <div className="p-3 border-t border-slate-800 bg-slate-800 text-[10px] font-bold text-slate-400 uppercase text-center">
                {filtered.length} tareas sin planificar
            </div>
        </aside>
    );
}
