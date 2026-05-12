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
    const textareaRef = React.useRef(null);
    const totalSubtasks = (subtasks || []).length;
    const hasSubtasks = totalSubtasks > 0;

    // Auto-resize handler for Description
    const handleTextareaResize = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    // Auto-resize on initial content load or updates
    React.useEffect(() => {
        handleTextareaResize();
    }, [form.description]);

    return (
        <div className="w-full p-4 lg:p-5 overflow-y-auto space-y-3 lg:space-y-4">
            {/* Description */}
            <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                    <FileText className="w-3 h-3 text-white" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">
                        Descripción / Instrucciones
                    </span>
                </div>
                <textarea
                    ref={textareaRef}
                    value={form.description}
                    onChange={e => {
                        setForm({ ...form, description: e.target.value });
                        handleTextareaResize();
                    }}
                    placeholder="Detalles, notas, instrucciones..."
                    className="w-full px-4 py-2 border border-slate-700/50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800/30 text-white placeholder-slate-500 min-h-[38px] resize-none overflow-hidden"
                    rows={1}
                    disabled={!canEdit}
                />
            </div>

            {/* Manual progress slider — only when NO subtasks (otherwise SubtaskList handles it) */}
            {!isNew && !hasSubtasks && (
                <div className="border-t border-slate-700 pt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                        <BarChart2 className="w-3 h-3 text-white" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">
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
                    <p className="text-[10px] text-white mt-1">
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
                    <p className="text-xs text-white italic">
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


        </div>
    );
}
