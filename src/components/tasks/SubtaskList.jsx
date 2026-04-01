import React, { useState, useRef, useEffect } from 'react';
import {
    Plus, CheckCircle2, Circle, X, GripVertical, Pencil, Check
} from 'lucide-react';
import {
    createSubtask, toggleSubtask, deleteSubtask,
    updateSubtask, reorderSubtasks
} from '../../services/taskService';
import { logActivity, ACTIVITY_TYPES } from '../../services/activityLogService';

/**
 * SubtaskList — enhanced with:
 * - Always-visible quick-add input (Enter to create)
 * - Inline editing (click pencil or double-click to edit)
 * - Drag-and-drop reordering
 * - onProgressChange callback for parent notification
 * - Dark theme color fixes
 */
export default function SubtaskList({ subtasks = [], taskId, readOnly = false, onProgressChange, userId = null, userName = null }) {
    const [newTitle, setNewTitle] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [dragId, setDragId] = useState(null);
    const [dragOverId, setDragOverId] = useState(null);
    const inputRef = useRef(null);
    const editInputRef = useRef(null);

    // Sort by order field
    const sorted = [...subtasks].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    const completed = subtasks.filter(s => s.completed).length;
    const total = subtasks.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Notify parent when subtask progress changes
    useEffect(() => {
        if (onProgressChange) {
            onProgressChange({ completed, total, pct });
        }
    }, [completed, total]);

    // Focus edit input when editing starts
    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingId]);

    // ── Quick Add ──
    const handleAdd = async (e) => {
        if (e) e.preventDefault();
        if (!newTitle.trim()) return;
        const trimmed = newTitle.trim();
        await createSubtask(taskId, trimmed);
        setNewTitle('');
        inputRef.current?.focus();

        // Calculate new percentComplete after adding (new subtask is uncompleted)
        const newTotal = subtasks.length + 1;
        const newPercent = newTotal > 0 ? Math.round((completed / newTotal) * 100) : 0;

        // Log subtask creation with progress info
        logActivity(taskId, {
            type: ACTIVITY_TYPES.SUBTASK_CREATED,
            description: `Subtarea creada: ${trimmed}`,
            userId,
            userName,
            meta: { subtaskTitle: trimmed, percentComplete: newPercent, totalSubtasks: newTotal, completedSubtasks: completed },
        });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    // ── Toggle ──
    const handleToggle = async (subtask) => {
        // Calculate what the new percentComplete will be after this toggle
        const newCompleted = !subtask.completed;
        const currentTotal = subtasks.length;
        const completedCount = subtasks.filter(s => s.completed).length + (newCompleted ? 1 : -1);
        const newPercent = currentTotal > 0 ? Math.round((completedCount / currentTotal) * 100) : 0;

        await toggleSubtask(subtask.id, newCompleted, {
            taskId,
            subtaskTitle: subtask.title,
            userId,
            userName,
            percentComplete: newPercent,
            totalSubtasks: currentTotal,
            completedSubtasks: completedCount,
        });
    };

    // ── Delete ──
    const handleDelete = async (subtaskId) => {
        const st = subtasks.find(s => s.id === subtaskId);
        await deleteSubtask(subtaskId);

        // Calculate new percentComplete after deletion
        const wasCompleted = st?.completed;
        const newTotal = subtasks.length - 1;
        const newCompletedCount = completed - (wasCompleted ? 1 : 0);
        const newPercent = newTotal > 0 ? Math.round((newCompletedCount / newTotal) * 100) : 0;

        // Log subtask deletion with progress info
        logActivity(taskId, {
            type: ACTIVITY_TYPES.SUBTASK_DELETED,
            description: `Subtarea eliminada: ${st?.title || ''}`,
            userId,
            userName,
            meta: { subtaskTitle: st?.title || '', percentComplete: newPercent, totalSubtasks: newTotal, completedSubtasks: newCompletedCount },
        });
    };

    // ── Inline Edit ──
    const startEditing = (st) => {
        setEditingId(st.id);
        setEditTitle(st.title);
    };

    const saveEdit = async () => {
        if (!editingId) return;
        const trimmed = editTitle.trim();
        if (trimmed && trimmed !== subtasks.find(s => s.id === editingId)?.title) {
            await updateSubtask(editingId, { title: trimmed });
        }
        setEditingId(null);
        setEditTitle('');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditTitle('');
    };

    const handleEditKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    };

    // ── Drag & Drop Reorder ──
    const handleDragStart = (e, id) => {
        setDragId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, id) => {
        e.preventDefault();
        if (id !== dragId) setDragOverId(id);
    };

    const handleDragEnd = async () => {
        if (dragId && dragOverId && dragId !== dragOverId) {
            const ids = sorted.map(s => s.id);
            const fromIdx = ids.indexOf(dragId);
            const toIdx = ids.indexOf(dragOverId);
            if (fromIdx !== -1 && toIdx !== -1) {
                ids.splice(fromIdx, 1);
                ids.splice(toIdx, 0, dragId);
                await reorderSubtasks(ids);
            }
        }
        setDragId(null);
        setDragOverId(null);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Subtareas {total > 0 && `(${completed}/${total})`}
                </h4>
                {total > 0 && (
                    <span className={`text-[10px] font-bold ${pct === 100 ? 'text-emerald-400' : 'text-indigo-400'}`}>
                        {pct}%
                    </span>
                )}
            </div>

            {/* Progress bar */}
            {total > 0 && (
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}

            {/* Subtask items */}
            <div className="space-y-0.5">
                {sorted.map((st) => {
                    const isEditing = editingId === st.id;
                    const isDragging = dragId === st.id;
                    const isDragOver = dragOverId === st.id;

                    return (
                        <div
                            key={st.id}
                            draggable={!readOnly && !isEditing}
                            onDragStart={(e) => handleDragStart(e, st.id)}
                            onDragOver={(e) => handleDragOver(e, st.id)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg group transition-all
                                ${st.completed ? 'bg-emerald-500/5' : 'hover:bg-slate-700/50'}
                                ${isDragging ? 'opacity-40' : ''}
                                ${isDragOver ? 'border-t-2 border-indigo-500' : 'border-t-2 border-transparent'}
                            `}
                        >
                            {/* Drag handle */}
                            {!readOnly && !isEditing && (
                                <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing flex-shrink-0" />
                            )}

                            {/* Toggle checkbox */}
                            <button
                                onClick={() => !readOnly && handleToggle(st)}
                                disabled={readOnly}
                                className="flex-shrink-0 transition-transform active:scale-90"
                            >
                                {st.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                ) : (
                                    <Circle className="w-4 h-4 text-slate-500 hover:text-indigo-400" />
                                )}
                            </button>

                            {/* Title — editable or static */}
                            {isEditing ? (
                                <div className="flex-1 flex items-center gap-1">
                                    <input
                                        ref={editInputRef}
                                        value={editTitle}
                                        onChange={e => setEditTitle(e.target.value)}
                                        onKeyDown={handleEditKeyDown}
                                        onBlur={saveEdit}
                                        className="flex-1 px-1.5 py-0.5 border border-indigo-500 rounded text-sm bg-slate-800 text-slate-200 outline-none"
                                    />
                                    <button onClick={saveEdit} className="p-0.5 text-emerald-400 hover:text-emerald-300">
                                        <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={cancelEdit} className="p-0.5 text-slate-500 hover:text-slate-300">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <span
                                    onDoubleClick={() => !readOnly && startEditing(st)}
                                    className={`text-sm flex-1 cursor-default ${st.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}
                                >
                                    {st.title}
                                </span>
                            )}

                            {/* Action buttons */}
                            {!readOnly && !isEditing && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => startEditing(st)}
                                        className="p-0.5 text-slate-500 hover:text-indigo-400 transition-all"
                                        title="Editar"
                                    >
                                        <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(st.id)}
                                        className="p-0.5 text-slate-500 hover:text-red-400 transition-all"
                                        title="Eliminar"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Always-visible quick-add input */}
            {!readOnly && (
                <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 relative">
                        <input
                            ref={inputRef}
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="+ Agregar subtarea (Enter para crear)"
                            className="w-full px-3 py-2 border border-slate-700 border-dashed rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-800/50 text-slate-200 placeholder-slate-500"
                        />
                    </div>
                    {newTitle.trim() && (
                        <button
                            onClick={handleAdd}
                            className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:scale-90 transition-all flex-shrink-0"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
