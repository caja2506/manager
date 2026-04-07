import React from 'react';
import { FileText, BarChart2, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SubtaskList from '../SubtaskList';
import TaskComments from '../TaskComments';

/**
 * TaskMainPanel — left column of the task editor.
 * Contains title input, description, progress, subtasks, and activity link.
 */
export default function TaskMainPanel({
    form, setForm, isNew, task,
    subtasks, canEdit, onSubtaskProgressChange,
    userId, userName,
}) {
    const navigate = useNavigate();
    const totalSubtasks = (subtasks || []).length;
    const hasSubtasks = totalSubtasks > 0;

    return (
        <div className="w-full lg:w-1/2 p-4 lg:p-5 overflow-y-auto space-y-4 lg:border-r border-slate-800">
            {/* Title input */}
            <div>
                <input
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="Título de la tarea..."
                    className="w-full text-lg font-black tracking-tight outline-none bg-transparent text-white placeholder-slate-600 border-b border-transparent focus:border-indigo-500 pb-1 transition-colors"
                    disabled={!canEdit}
                    autoFocus={isNew}
                />
            </div>

            {/* Description */}
            <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                    <FileText className="w-3 h-3 text-slate-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Descripción / Instrucciones
                    </span>
                </div>
                <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Detalles, notas, instrucciones..."
                    className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-200 placeholder-slate-500 resize-none"
                    rows={3}
                    disabled={!canEdit}
                />
            </div>

            {/* Manual progress slider — only when NO subtasks (otherwise SubtaskList handles it) */}
            {!isNew && !hasSubtasks && (
                <div className="border-t border-slate-700 pt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                        <BarChart2 className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Progreso
                        </span>
                        <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/15 px-1.5 py-0.5 rounded-full">
                            {form.percentComplete || 0}%
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="range" min={0} max={100} step={5}
                            value={form.percentComplete}
                            onChange={e => setForm(f => ({ ...f, percentComplete: Number(e.target.value) }))}
                            className="flex-1 accent-indigo-500"
                            disabled={!canEdit}
                        />
                        <span className="text-xs font-bold text-indigo-400 w-10 text-right">{form.percentComplete}%</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                        Progreso manual (agrega subtareas para cálculo automático)
                    </p>
                </div>
            )}

            {/* Subtasks — includes its own progress bar when subtasks exist */}
            {!isNew && (
                <div className="border-t border-slate-700 pt-4">
                    <SubtaskList
                        subtasks={subtasks}
                        taskId={task.id}
                        readOnly={!canEdit}
                        onProgressChange={onSubtaskProgressChange}
                        userId={userId}
                        userName={userName}
                    />
                </div>
            )}

            {isNew && (
                <div className="border-t border-slate-700 pt-4">
                    <p className="text-xs text-slate-500 italic">
                        Las subtareas podrán agregarse después de crear la tarea.
                    </p>
                </div>
            )}

            {/* Comments */}
            {!isNew && task?.id && (
                <div className="border-t border-slate-700 pt-4">
                    <TaskComments
                        taskId={task.id}
                        readOnly={!canEdit}
                        userId={userId}
                        userName={userName}
                    />
                </div>
            )}

            {/* Activity Timeline Link */}
            {!isNew && task?.id && (
                <div className="border-t border-slate-700 pt-3">
                    <button
                        onClick={() => navigate(`/reports/activity?taskId=${task.id}`)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-600/20 hover:border-emerald-500/50 transition-all group"
                    >
                        <Activity className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                        Ver Avance y Actividad
                    </button>
                </div>
            )}
        </div>
    );
}
