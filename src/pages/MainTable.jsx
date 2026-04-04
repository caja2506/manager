import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { useEngineeringData } from '../hooks/useEngineeringData';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import TransitionConfirmModal from '../components/workflow/TransitionConfirmModal';
import TaskModuleBanner from '../components/layout/TaskModuleBanner';
import { useWorkflowTransition } from '../hooks/useWorkflowTransition';
import { updateTask, updateTaskStatus, toggleSubtask, createSubtask } from '../services/taskService';
import {
    TASK_STATUS, TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG
} from '../models/schemas';
import {
    Search, Filter, X, ChevronDown, ChevronRight, User, Calendar,
    Check, Plus, Clock, Maximize2
} from 'lucide-react';

// ============================================================
// STATUS GROUP ORDER
// ============================================================

const STATUS_GROUPS = [
    { status: TASK_STATUS.IN_PROGRESS, label: 'In Progress', color: '#f59e0b' },
    { status: TASK_STATUS.PENDING,     label: 'To Do',       color: '#ef4444' },
    { status: TASK_STATUS.BACKLOG,     label: 'Backlog',     color: '#64748b' },
    { status: TASK_STATUS.VALIDATION,  label: 'Validación',  color: '#8b5cf6' },
    { status: TASK_STATUS.COMPLETED,   label: 'Completado',  color: '#22c55e' },
    { status: TASK_STATUS.BLOCKED,     label: 'Bloqueado',   color: '#ef4444' },
    { status: TASK_STATUS.CANCELLED,   label: 'Cancelado',   color: '#6b7280' },
];

const GRID_COLS = '36px 1fr 50px 120px minmax(100px,140px) minmax(130px,170px) 90px 95px 95px 120px';

// ============================================================
// SAVE FEEDBACK — flash green on successful save
// ============================================================

function useSaveFeedback() {
    const [savedField, setSavedField] = useState(null);
    const show = useCallback((key) => {
        setSavedField(key);
        setTimeout(() => setSavedField(null), 1200);
    }, []);
    return { savedField, show };
}

// ============================================================
// INLINE EDIT: TEXT
// ============================================================

function InlineEditText({ value, onSave, className = '', placeholder = '' }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const inputRef = useRef(null);

    useEffect(() => { setDraft(value); }, [value]);
    useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

    const handleSave = () => {
        setEditing(false);
        if (draft !== value) onSave(draft);
    };

    if (!editing) {
        return (
            <div onClick={(e) => { e.stopPropagation(); setEditing(true); }} className={`cursor-text hover:bg-slate-800/60 rounded px-1 py-0.5 -mx-1 transition-colors ${className}`}>
                {value || <span className="text-slate-600 italic">{placeholder}</span>}
            </div>
        );
    }

    return (
        <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
            onClick={e => e.stopPropagation()}
            className="w-full bg-slate-800 border border-indigo-500/50 rounded px-1.5 py-0.5 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500/50"
            placeholder={placeholder}
        />
    );
}

// ============================================================
// INLINE EDIT: DROPDOWN
// ============================================================

function InlineDropdown({ value, options, onSelect, renderValue, className = '' }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={ref} className={`relative ${className}`} onClick={e => e.stopPropagation()}>
            <button onClick={() => setOpen(!open)} className="w-full hover:bg-slate-800/60 rounded transition-colors">
                {renderValue(value)}
            </button>
            {open && (
                <div className="absolute z-50 top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 min-w-[140px] max-h-[200px] overflow-auto animate-in fade-in zoom-in-95 duration-150">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { onSelect(opt.value); setOpen(false); }}
                            className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-700/80 flex items-center gap-2 transition-colors ${opt.value === value ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-300'}`}
                        >
                            {opt.icon && <span>{opt.icon}</span>}
                            {opt.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: opt.color }} />}
                            {opt.label}
                            {opt.value === value && <Check className="w-3 h-3 ml-auto text-indigo-400" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================
// INLINE EDIT: DATE
// ============================================================

function InlineDatePicker({ value, onSave, className = '' }) {
    const inputRef = useRef(null);
    const display = value ? new Date(value).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '—';

    return (
        <div className={`relative ${className}`} onClick={e => e.stopPropagation()}>
            <button onClick={() => inputRef.current?.showPicker?.()} className="text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 rounded px-1 py-0.5 transition-colors flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-600" />
                {display}
            </button>
            <input
                ref={inputRef}
                type="date"
                value={value?.split('T')[0] || ''}
                onChange={e => { if (e.target.value) onSave(e.target.value); }}
                className="absolute opacity-0 w-0 h-0 pointer-events-none"
            />
        </div>
    );
}

// ============================================================
// INLINE EDIT: NUMBER
// ============================================================

function InlineEditNumber({ value, onSave, suffix = 'h', className = '' }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value || 0);
    const inputRef = useRef(null);

    useEffect(() => { setDraft(value || 0); }, [value]);
    useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

    const handleSave = () => {
        setEditing(false);
        const num = parseFloat(draft) || 0;
        if (num !== value) onSave(num);
    };

    if (!editing) {
        return (
            <span onClick={e => { e.stopPropagation(); setEditing(true); }} className={`cursor-text hover:bg-slate-800/60 rounded px-1 py-0.5 transition-colors ${className}`}>
                {value ? `${value}${suffix}` : <span className="text-slate-600">—</span>}
            </span>
        );
    }

    return (
        <input
            ref={inputRef}
            type="number"
            step="0.5"
            min="0"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setDraft(value || 0); setEditing(false); } }}
            onClick={e => e.stopPropagation()}
            className="w-16 bg-slate-800 border border-indigo-500/50 rounded px-1.5 py-0.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500/50"
        />
    );
}

// ============================================================
// PROGRESS BAR COMPONENT
// ============================================================

function ProgressBar({ subtasks, onClick }) {
    const total = subtasks?.length || 0;
    const done = subtasks?.filter(s => s.completed || s.done).length || 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const barColor = pct === 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : pct > 0 ? '#3b82f6' : '#334155';

    return (
        <button onClick={onClick} className="flex items-center gap-2 w-full hover:bg-slate-800/60 rounded px-1 py-1 transition-colors group" title={`${done}/${total} subtareas`}>
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden min-w-[40px]">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
            </div>
            <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-300 whitespace-nowrap transition-colors">
                {total > 0 ? `${done}/${total}` : '—'}
            </span>
        </button>
    );
}

// ============================================================
// GANTT TIMELINE BAR
// ============================================================

function GanttTimeline({ task, canEdit, onSave }) {
    const start = task.plannedStartDate || task.createdAt;
    const end = task.dueDate || task.plannedEndDate;
    if (!start && !end) return <span className="text-slate-600 text-xs">—</span>;

    const startDate = start ? new Date(start) : new Date();
    const endDate = end ? new Date(end) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const totalDays = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.max(0, (now - startDate) / (1000 * 60 * 60 * 24));
    const progressPct = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

    const isOverdue = now > endDate && task.status !== 'completed';
    const barBg = isOverdue ? '#ef4444' : progressPct > 80 ? '#f59e0b' : '#6366f1';

    const fmtShort = (d) => d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });

    return (
        <div className="flex flex-col gap-1 w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-1.5">
                {canEdit ? (
                    <>
                        <InlineDatePicker value={start} onSave={v => onSave('plannedStartDate', v)} />
                        <span className="text-slate-600 text-[10px]">→</span>
                        <InlineDatePicker value={end} onSave={v => onSave('dueDate', v)} />
                    </>
                ) : (
                    <span className="text-[10px] text-slate-500">{fmtShort(startDate)} → {fmtShort(endDate)}</span>
                )}
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progressPct}%`, background: barBg }} />
            </div>
        </div>
    );
}

// ============================================================
// HOURS CELL
// ============================================================

function HoursCell({ task, canEdit, onSave }) {
    const actual = task.actualHours || 0;
    const estimated = task.estimatedHours || 0;
    const pct = estimated > 0 ? Math.round((actual / estimated) * 100) : 0;
    const barColor = pct > 100 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22c55e';

    return (
        <div className="flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-0.5 text-[10px]">
                <span className="text-slate-400 font-bold">{actual.toFixed(1)}</span>
                <span className="text-slate-700">/</span>
                {canEdit ? (
                    <InlineEditNumber value={estimated} onSave={v => onSave('estimatedHours', v)} className="text-[10px] text-slate-500" />
                ) : (
                    <span className="text-slate-500">{estimated}h</span>
                )}
            </div>
            {estimated > 0 && (
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                </div>
            )}
        </div>
    );
}

// ============================================================
// DUE DATE BADGE
// ============================================================

function DueDateBadge({ task, canEdit, onSave }) {
    const dueDate = task.dueDate || task.plannedEndDate;
    if (!dueDate) {
        if (canEdit) return <InlineDatePicker value="" onSave={v => onSave('dueDate', v)} className="text-slate-600" />;
        return <span className="text-slate-600 text-xs">—</span>;
    }

    const due = new Date(dueDate);
    const now = new Date();
    const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    const isCompleted = task.status === 'completed';

    let color = 'text-slate-400';
    let bg = '';
    if (!isCompleted) {
        if (daysLeft < 0) { color = 'text-rose-400'; bg = 'bg-rose-500/10'; }
        else if (daysLeft <= 2) { color = 'text-amber-400'; bg = 'bg-amber-500/10'; }
        else if (daysLeft <= 5) { color = 'text-yellow-400'; }
        else { color = 'text-emerald-400'; }
    }

    const label = isCompleted ? '✓' : daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : daysLeft === 0 ? 'Hoy' : `${daysLeft}d`;

    if (canEdit) {
        return (
            <div className="flex flex-col items-center gap-0.5">
                <InlineDatePicker value={dueDate} onSave={v => onSave('dueDate', v)} />
                <span className={`text-[9px] font-bold ${color} ${bg} px-1.5 rounded`}>{label}</span>
            </div>
        );
    }

    return (
        <div className="text-center">
            <span className={`text-xs ${color}`}>{due.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}</span>
            <span className={`block text-[9px] font-bold ${color} ${bg} px-1 rounded mt-0.5`}>{label}</span>
        </div>
    );
}

// ============================================================
// OWNER AVATAR
// ============================================================

function OwnerAvatar({ task, teamMembers }) {
    const member = teamMembers.find(m => m.uid === task.assignedTo);
    if (!member) {
        return (
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                <User className="w-3 h-3 text-slate-600" />
            </div>
        );
    }
    const initials = (() => {
        const name = member.displayName || member.email || '?';
        const parts = name.trim().split(/\s+/);
        return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name[0].toUpperCase();
    })();

    return (
        <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-slate-700"
            style={{
                background: member.photoURL ? `url(${member.photoURL}) center/cover` : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: member.photoURL ? 'transparent' : '#fff',
            }}
            title={member.displayName || member.email}
        >
            {!member.photoURL && initials}
        </div>
    );
}

// ============================================================
// SUBTASK EXPANDER ROW
// ============================================================

function SubtaskExpander({ subtasks, taskId, canEdit }) {
    const [newTitle, setNewTitle] = useState('');
    const inputRef = useRef(null);

    const handleToggle = async (sub) => {
        try {
            const completedCount = subtasks.filter(s => s.id !== sub.id ? (s.completed || s.done) : !sub.completed).length;
            await toggleSubtask(sub.id, !sub.completed, {
                taskId,
                subtaskTitle: sub.title,
                totalSubtasks: subtasks.length,
                completedSubtasks: completedCount,
            });
        } catch (err) { console.error('Toggle subtask failed:', err); }
    };

    const handleAdd = async () => {
        if (!newTitle.trim()) return;
        try {
            await createSubtask(taskId, newTitle.trim());
            setNewTitle('');
            inputRef.current?.focus();
        } catch (err) { console.error('Add subtask failed:', err); }
    };

    return (
        <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800/40 animate-in fade-in slide-in-from-top-1 duration-200" onClick={e => e.stopPropagation()}>
            <div className="space-y-1 max-w-xl">
                {subtasks.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2.5 py-1 group/sub">
                        <button
                            onClick={() => handleToggle(sub)}
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                sub.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-slate-400'
                            }`}
                        >
                            {sub.completed && <Check className="w-2.5 h-2.5 text-white" />}
                        </button>
                        <span className={`text-xs ${sub.completed ? 'line-through text-slate-600' : 'text-slate-300'}`}>
                            {sub.title}
                        </span>
                    </div>
                ))}
                {canEdit && (
                    <div className="flex items-center gap-2 pt-1">
                        <Plus className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <input
                            ref={inputRef}
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                            placeholder="Agregar subtarea..."
                            className="flex-1 bg-transparent text-xs text-slate-400 placeholder:text-slate-700 outline-none"
                        />
                        {newTitle.trim() && (
                            <button onClick={handleAdd} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300">Agregar</button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================
// TABLE ROW
// ============================================================

function TaskRow({ task, engProjects, teamMembers, subtasks, canEdit, onOpenModal, groupColor, isLast, savedField, onSaved }) {
    const [expandedSubs, setExpandedSubs] = useState(false);

    const saveField = useCallback(async (field, value) => {
        try {
            if (field === 'status') {
                await updateTaskStatus(task.id, value);
            } else {
                await updateTask(task.id, { [field]: value });
            }
            onSaved(`${task.id}-${field}`);
        } catch (err) {
            console.error(`Failed to save ${field}:`, err);
        }
    }, [task.id, onSaved]);

    const project = engProjects.find(p => p.id === task.projectId);
    const isSaved = (field) => savedField === `${task.id}-${field}`;

    // Status options
    const statusOptions = Object.entries(TASK_STATUS_CONFIG).map(([key, cfg]) => ({
        value: key, label: cfg.label, color: cfg.color,
    }));

    // Priority options
    const priorityOptions = Object.entries(TASK_PRIORITY_CONFIG).map(([key, cfg]) => ({
        value: key, label: cfg.label, color: cfg.color || '#64748b',
    }));

    // Owner options
    const ownerOptions = [
        { value: '', label: 'Sin asignar', icon: '—' },
        ...teamMembers.map(m => ({ value: m.uid, label: m.displayName || m.email, icon: '👤' })),
    ];

    // Project options
    const projectOptions = [
        { value: '', label: 'Sin proyecto', icon: '—' },
        ...engProjects.map(p => ({ value: p.id, label: p.name, icon: '📁' })),
    ];

    const statusCfg = TASK_STATUS_CONFIG[task.status] || {};

    return (
        <>
            <div
                onDoubleClick={() => onOpenModal(task)}
                className={`grid items-center px-3 py-2.5 transition-all duration-150 hover:bg-indigo-500/[.06] group/row ${!isLast ? 'border-b border-slate-800/40' : ''}`}
                style={{ gridTemplateColumns: GRID_COLS, borderLeft: `3px solid ${groupColor}` }}
            >
                {/* Checkbox */}
                <div className="flex items-center" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 accent-indigo-500 cursor-pointer" />
                </div>

                {/* Task Name — inline editable */}
                <div className="pr-2 flex items-center gap-1.5 min-w-0">
                    <button onClick={(e) => { e.stopPropagation(); onOpenModal(task); }} className="text-slate-600 hover:text-indigo-400 transition-colors shrink-0" title="Abrir detalle">
                        <Maximize2 className="w-3 h-3" />
                    </button>
                    <div className="min-w-0 flex-1">
                        {canEdit ? (
                            <InlineEditText
                                value={task.title || ''}
                                onSave={v => saveField('title', v)}
                                className={`text-sm font-semibold text-slate-200 truncate ${isSaved('title') ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : ''}`}
                                placeholder="Sin título"
                            />
                        ) : (
                            <p className="text-sm font-semibold text-slate-200 truncate">{task.title || 'Sin título'}</p>
                        )}
                    </div>
                </div>

                {/* Owner — inline dropdown */}
                <div className="flex justify-center">
                    {canEdit ? (
                        <InlineDropdown
                            value={task.assignedTo || ''}
                            options={ownerOptions}
                            onSelect={v => saveField('assignedTo', v || null)}
                            renderValue={() => <OwnerAvatar task={task} teamMembers={teamMembers} />}
                        />
                    ) : (
                        <OwnerAvatar task={task} teamMembers={teamMembers} />
                    )}
                </div>

                {/* Status — inline dropdown */}
                <div className="flex justify-center">
                    {canEdit ? (
                        <InlineDropdown
                            value={task.status}
                            options={statusOptions}
                            onSelect={v => saveField('status', v)}
                            renderValue={(val) => {
                                const cfg = TASK_STATUS_CONFIG[val] || {};
                                return (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${isSaved('status') ? 'ring-1 ring-emerald-500/30' : ''}`}
                                        style={{ backgroundColor: (cfg.color || '#64748b') + '22', color: cfg.color, border: `1px solid ${(cfg.color || '#64748b')}44` }}>
                                        {cfg.label || val}
                                    </span>
                                );
                            }}
                        />
                    ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                            style={{ backgroundColor: (statusCfg.color || '#64748b') + '22', color: statusCfg.color }}>
                            {statusCfg.label || task.status}
                        </span>
                    )}
                </div>

                {/* Progress — subtasks bar */}
                <div>
                    <ProgressBar subtasks={subtasks} onClick={(e) => { e.stopPropagation(); setExpandedSubs(!expandedSubs); }} />
                </div>

                {/* Gantt Timeline */}
                <div>
                    <GanttTimeline task={task} canEdit={canEdit} onSave={saveField} />
                </div>

                {/* Hours */}
                <div>
                    <HoursCell task={task} canEdit={canEdit} onSave={saveField} />
                </div>

                {/* Priority — inline dropdown */}
                <div className="flex justify-center">
                    {canEdit ? (
                        <InlineDropdown
                            value={task.priority || 'medium'}
                            options={priorityOptions}
                            onSelect={v => saveField('priority', v)}
                            renderValue={(val) => {
                                const cfg = TASK_PRIORITY_CONFIG[val] || {};
                                const colors = { low: '#94a3b8', medium: '#60a5fa', high: '#fbbf24', critical: '#f87171' };
                                const c = colors[val] || '#94a3b8';
                                return (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isSaved('priority') ? 'ring-1 ring-emerald-500/30' : ''}`}
                                        style={{ backgroundColor: c + '22', color: c, border: `1px solid ${c}44` }}>
                                        {cfg.label || val}
                                    </span>
                                );
                            }}
                        />
                    ) : (
                        <span className="text-xs text-slate-400">{(TASK_PRIORITY_CONFIG[task.priority] || {}).label || '—'}</span>
                    )}
                </div>

                {/* Due Date */}
                <div>
                    <DueDateBadge task={task} canEdit={canEdit} onSave={saveField} />
                </div>

                {/* Project — inline dropdown */}
                <div>
                    {canEdit ? (
                        <InlineDropdown
                            value={task.projectId || ''}
                            options={projectOptions}
                            onSelect={v => saveField('projectId', v || null)}
                            renderValue={(val) => {
                                const p = engProjects.find(pr => pr.id === val);
                                return <span className={`text-xs truncate block max-w-[110px] ${p ? 'text-slate-400 italic' : 'text-slate-600'} ${isSaved('projectId') ? 'text-emerald-400' : ''}`}>{p?.name || '—'}</span>;
                            }}
                        />
                    ) : (
                        <span className="text-xs text-slate-400 italic truncate block">{project?.name || '—'}</span>
                    )}
                </div>
            </div>

            {/* Expanded Subtasks */}
            {expandedSubs && (
                <SubtaskExpander subtasks={subtasks} taskId={task.id} canEdit={canEdit} />
            )}
        </>
    );
}

// ============================================================
// COLLAPSIBLE TABLE GROUP
// ============================================================

function TableGroup({ label, color, tasks, engProjects, engSubtasks, teamMembers, canEdit, onOpenModal, isExpanded, onToggle, savedField, onSaved }) {
    return (
        <div className="mb-4 animate-in fade-in duration-200">
            {/* Group Header */}
            <button onClick={onToggle} className="flex items-center gap-2.5 w-full text-left px-2 py-2 rounded-lg hover:bg-slate-800/50 transition-colors group">
                {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                    : <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                }
                <span className="font-bold text-sm" style={{ color }}>{label}</span>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700/50">
                    {tasks.length}
                </span>
            </button>

            {/* Table */}
            {isExpanded && (
                <div className="mt-1 rounded-xl overflow-hidden border border-slate-800/60 bg-slate-900/40">
                    {/* Column Headers */}
                    <div
                        className="grid items-center px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] border-b border-slate-800/60 bg-slate-900/60"
                        style={{ gridTemplateColumns: GRID_COLS, borderLeft: `3px solid ${color}` }}
                    >
                        <div><input type="checkbox" className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 accent-indigo-500" readOnly /></div>
                        <div>Tarea</div>
                        <div className="text-center">Resp.</div>
                        <div className="text-center">Estado</div>
                        <div className="text-center">Progreso</div>
                        <div>Cronograma</div>
                        <div className="text-center">Horas</div>
                        <div className="text-center">Prior.</div>
                        <div className="text-center">Vence</div>
                        <div>Proyecto</div>
                    </div>

                    {/* Rows */}
                    {tasks.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-slate-600" style={{ borderLeft: `3px solid ${color}` }}>
                            Sin tareas en esta sección
                        </div>
                    ) : (
                        tasks.map((task, idx) => (
                            <TaskRow
                                key={task.id}
                                task={task}
                                engProjects={engProjects}
                                teamMembers={teamMembers}
                                subtasks={engSubtasks.filter(s => s.taskId === task.id)}
                                canEdit={canEdit}
                                onOpenModal={onOpenModal}
                                groupColor={color}
                                isLast={idx === tasks.length - 1}
                                savedField={savedField}
                                onSaved={onSaved}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function MainTable() {
    const { user } = useAuth();
    const { canEdit, canDelete } = useRole();
    const { engProjects, engTasks, engSubtasks, teamMembers, taskTypes } = useEngineeringData();

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);

    // Filters
    const [search, setSearch] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterAssignee, setFilterAssignee] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState({});

    // Save feedback
    const { savedField, show: showSaved } = useSaveFeedback();

    const openNew = () => { setSelectedTask(null); setIsModalOpen(true); };
    const openTask = (task) => { setSelectedTask(task); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setSelectedTask(null); };

    const { pendingTransition, transitionError, isTransitioning, confirmTransition, cancelTransition } = useWorkflowTransition();

    // Filter tasks
    const filteredTasks = useMemo(() => {
        return engTasks.filter(task => {
            const s = search.toLowerCase();
            const matchSearch = !s || (task.title || '').toLowerCase().includes(s) || (task.description || '').toLowerCase().includes(s);
            const matchProject = !filterProject || task.projectId === filterProject;
            const matchAssignee = !filterAssignee || task.assignedBy === filterAssignee || task.assignedTo === filterAssignee;
            const matchPriority = !filterPriority || task.priority === filterPriority;
            return matchSearch && matchProject && matchAssignee && matchPriority;
        });
    }, [engTasks, search, filterProject, filterAssignee, filterPriority]);

    // Group by status
    const tasksByStatus = useMemo(() => {
        const map = {};
        Object.values(TASK_STATUS).forEach(s => { map[s] = []; });
        filteredTasks.forEach(t => {
            if (map[t.status]) map[t.status].push(t);
            else map[TASK_STATUS.BACKLOG].push(t);
        });
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        Object.keys(map).forEach(key => {
            map[key].sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));
        });
        return map;
    }, [filteredTasks]);

    const toggleGroup = (status) => setCollapsedGroups(prev => ({ ...prev, [status]: !prev[status] }));
    const activeFilterCount = [search, filterProject, filterAssignee, filterPriority].filter(Boolean).length;

    return (
        <div className="-m-4 md:-m-8 flex flex-col bg-slate-950 text-white" style={{ minHeight: '100vh' }}>
            <TaskDetailModal isOpen={isModalOpen} onClose={closeModal} task={selectedTask} projects={engProjects} teamMembers={teamMembers}
                subtasks={selectedTask ? engSubtasks.filter(s => s.taskId === selectedTask.id) : []} taskTypes={taskTypes} userId={user?.uid} canEdit={canEdit} canDelete={canDelete} />

            <TransitionConfirmModal isOpen={!!pendingTransition} pending={pendingTransition} isTransitioning={isTransitioning} onConfirm={confirmTransition} onCancel={cancelTransition} />

            {transitionError && (
                <div className="fixed bottom-24 md:bottom-4 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-4">
                    {transitionError}
                </div>
            )}

            {/* Banner */}
            <TaskModuleBanner onNewTask={canEdit ? openNew : null} canEdit={canEdit}>
                <button
                    onClick={() => setShowFilters(f => !f)}
                    className={`relative px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 text-xs border transition-all active:scale-95 ${
                        showFilters ? 'bg-indigo-600/15 text-indigo-400 border-indigo-500/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                    }`}
                >
                    {showFilters ? <X className="w-3.5 h-3.5" /> : <Filter className="w-3.5 h-3.5" />}
                    Filtros
                    {activeFilterCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-indigo-500 text-white text-[8px] font-bold flex items-center justify-center shadow">{activeFilterCount}</span>
                    )}
                </button>
            </TaskModuleBanner>

            {/* Filters */}
            {showFilters && (
                <div className="flex flex-wrap gap-3 items-center animate-in fade-in slide-in-from-top-2 duration-200 px-6 py-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tareas..."
                            className="pl-10 pr-4 py-2.5 w-full border border-slate-700/60 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 bg-slate-900/60 placeholder:text-slate-600 transition-all" />
                    </div>
                    <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                        className="px-4 py-2.5 border border-slate-700/60 rounded-xl text-sm text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 bg-slate-900/60 cursor-pointer">
                        <option value="">Todos los proyectos</option>
                        {engProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
                        className="px-4 py-2.5 border border-slate-700/60 rounded-xl text-sm text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 bg-slate-900/60 cursor-pointer">
                        <option value="">Todos los miembros</option>
                        {teamMembers.map(u => <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>)}
                    </select>
                    <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                        className="px-4 py-2.5 border border-slate-700/60 rounded-xl text-sm text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 bg-slate-900/60 cursor-pointer">
                        <option value="">Todas las prioridades</option>
                        {Object.entries(TASK_PRIORITY_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                    </select>
                </div>
            )}

            {/* Summary Bar */}
            <div className="flex items-center justify-between px-6 py-2">
                <p className="text-xs text-slate-500 font-medium">
                    {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
                    {activeFilterCount > 0 && <span className="text-indigo-400 ml-1.5">({activeFilterCount} filtro{activeFilterCount !== 1 ? 's' : ''})</span>}
                    <span className="text-slate-700 ml-2">• Doble click para abrir detalle • Click simple para editar</span>
                </p>
                <button
                    onClick={() => {
                        const allExpanded = STATUS_GROUPS.every(g => !collapsedGroups[g.status]);
                        const newState = {};
                        STATUS_GROUPS.forEach(g => { newState[g.status] = allExpanded; });
                        setCollapsedGroups(newState);
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-300 font-semibold px-2.5 py-1 rounded-lg hover:bg-slate-800/60 transition-all"
                >
                    {STATUS_GROUPS.every(g => !collapsedGroups[g.status]) ? 'Colapsar todo' : 'Expandir todo'}
                </button>
            </div>

            {/* Table Groups */}
            <div className="flex-1 overflow-y-auto pb-4 px-6 pt-1">
                {STATUS_GROUPS.map(group => {
                    const tasks = tasksByStatus[group.status] || [];
                    if (tasks.length === 0 && (group.status === TASK_STATUS.COMPLETED || group.status === TASK_STATUS.CANCELLED)) return null;
                    return (
                        <TableGroup
                            key={group.status}
                            label={group.label}
                            color={group.color}
                            tasks={tasks}
                            engProjects={engProjects}
                            engSubtasks={engSubtasks}
                            teamMembers={teamMembers}
                            canEdit={canEdit}
                            onOpenModal={openTask}
                            isExpanded={!collapsedGroups[group.status]}
                            onToggle={() => toggleGroup(group.status)}
                            savedField={savedField}
                            onSaved={showSaved}
                        />
                    );
                })}

                {filteredTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-4">
                            <Search className="w-7 h-7 text-slate-600" />
                        </div>
                        <p className="text-slate-500 font-semibold text-sm">No se encontraron tareas</p>
                        <p className="text-slate-600 text-xs mt-1">Intenta ajustar los filtros</p>
                    </div>
                )}
            </div>
        </div>
    );
}
