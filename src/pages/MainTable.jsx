import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { useEngineeringData } from '../hooks/useEngineeringData';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import TransitionConfirmModal from '../components/workflow/TransitionConfirmModal';
import TaskModuleBanner from '../components/layout/TaskModuleBanner';
import { useWorkflowTransition } from '../hooks/useWorkflowTransition';
import { updateTask, updateTaskStatus, toggleSubtask, createSubtask, createTask } from '../services/taskService';
import { logActivity, ACTIVITY_TYPES } from '../services/activityLogService';
import {
    TASK_STATUS, TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG, formatStationLabel
} from '../models/schemas';
import { onProjectStations, hasMultipleIndexers } from '../services/stationService';
import {
    Search, Filter, X, ChevronDown, ChevronRight, User, Calendar,
    Check, Plus, Maximize2
} from 'lucide-react';

// ============================================================
// CONSTANTS
// ============================================================

const STATUS_GROUPS = [
    { status: TASK_STATUS.IN_PROGRESS, label: 'In Progress', color: '#f59e0b' },
    { status: TASK_STATUS.PENDING,     label: 'To Do',       color: '#ef4444' },
    { status: TASK_STATUS.BACKLOG,     label: 'Backlog',     color: '#64748b' },
    { status: TASK_STATUS.VALIDATION,  label: 'Revisión',  color: '#8b5cf6' },
    { status: TASK_STATUS.COMPLETED,   label: 'Completado',  color: '#22c55e' },
    { status: TASK_STATUS.BLOCKED,     label: 'Bloqueado',   color: '#ef4444' },
    { status: TASK_STATUS.CANCELLED,   label: 'Cancelado',   color: '#6b7280' },
];

// 15-column grid: ☐ | Task | Owner | Project | STN | Status | Área | Tipo | Avance | Health | Score | Timeline | Hours | Priority | Asig.
const GRID_COLS = '28px minmax(200px, 1fr) 36px 68px 55px 86px 68px 68px 56px 48px 48px minmax(105px,150px) minmax(65px,95px) 76px 36px';

// ============================================================
// SAVE FEEDBACK HOOK
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
            className="w-full bg-slate-800 border border-indigo-500/50 rounded px-1.5 py-0.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500/50"
            placeholder={placeholder}
        />
    );
}

// ============================================================
// INLINE EDIT: DROPDOWN
// ============================================================

function InlineDropdown({ value, options, onSelect, renderValue, className = '' }) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const [pos, setPos] = useState({ top: 0, left: 0, openUp: false });

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (triggerRef.current?.contains(e.target)) return;
            if (menuRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleOpen = () => {
        if (open) { setOpen(false); return; }
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUp = spaceBelow < 220;
            const shiftLeft = (window.innerWidth - rect.left) < 240;
            
            setPos({
                top: openUp ? undefined : Math.min(rect.bottom + 4, window.innerHeight - 220),
                bottom: openUp ? Math.max(8, window.innerHeight - rect.top + 4) : undefined,
                left: shiftLeft ? undefined : Math.max(8, rect.left),
                right: shiftLeft ? Math.max(8, window.innerWidth - rect.right) : undefined,
                openUp,
            });
        }
        setOpen(true);
    };

    return (
        <div className={`relative w-full h-full ${className}`} onClick={e => e.stopPropagation()}>
            <button ref={triggerRef} onClick={handleOpen} className="w-full h-full hover:bg-slate-800/60 rounded transition-colors flex items-center justify-center">
                {renderValue(value)}
            </button>
            {open && createPortal(
                <div
                    ref={menuRef}
                    className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 min-w-[160px] max-h-[220px] overflow-auto animate-in fade-in zoom-in-95 duration-150"
                    style={{
                        zIndex: 9999,
                        left: pos.left !== undefined ? pos.left : undefined,
                        right: pos.right !== undefined ? pos.right : undefined,
                        top: pos.top !== undefined ? pos.top : undefined,
                        bottom: pos.bottom !== undefined ? pos.bottom : undefined,
                    }}
                >
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { onSelect(opt.value); setOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-700/80 flex items-center gap-2 transition-colors ${opt.value === value ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-300'}`}
                        >
                            {opt.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: opt.color }} />}
                            {opt.label}
                            {opt.value === value && <Check className="w-3 h-3 ml-auto text-indigo-400" />}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}

// ============================================================
// INLINE EDIT: NUMBER
// ============================================================

function InlineEditNumber({ value, onSave, suffix = 'h' }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value || 0);
    const inputRef = useRef(null);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    const handleSave = () => {
        setEditing(false);
        const num = parseFloat(draft) || 0;
        if (num !== value) onSave(num);
    };

    if (!editing) {
        return (
            <span
                onClick={e => { e.stopPropagation(); setDraft(value || 0); setEditing(true); }}
                className="cursor-text hover:bg-slate-800/60 rounded px-0.5 transition-colors text-slate-500"
            >
                {value ? `${value}${suffix}` : '—'}
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
            className="w-14 bg-slate-800 border border-indigo-500/50 rounded px-1 py-0.5 text-[10px] text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500/50"
        />
    );
}

// ============================================================
// INLINE DATE PICKER
// ============================================================

function InlineDatePicker({ value, onSave }) {
    const inputRef = useRef(null);
    const display = value ? new Date(value).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '—';

    return (
        <span className="relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => inputRef.current?.showPicker?.()} className="text-[10px] text-slate-400 hover:text-white hover:bg-slate-800/60 rounded px-0.5 transition-colors whitespace-nowrap">
                {display}
            </button>
            <input
                ref={inputRef}
                type="date"
                value={value?.split('T')[0] || ''}
                onChange={e => { if (e.target.value) onSave(e.target.value); }}
                className="absolute opacity-0 w-0 h-0 pointer-events-none"
            />
        </span>
    );
}

// ============================================================
// SCORE POPOVER — click-to-see breakdown
// ============================================================

function ScorePopover({ type, score, color, items, anchorRef, onClose }) {
    const [pos, setPos] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (!anchorRef?.current) return;
        const rect = anchorRef.current.getBoundingClientRect();
        const popW = 260, popH = 220;
        let left = rect.left + rect.width / 2 - popW / 2;
        let top = rect.bottom + 6;
        if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
        if (left < 8) left = 8;
        if (top + popH > window.innerHeight - 8) top = rect.top - popH - 6;
        const timer = setTimeout(() => setPos({ top, left }), 0);
        return () => clearTimeout(timer);
    }, [anchorRef]);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        const clickHandler = (e) => { if (!e.target.closest('.score-popover')) onClose(); };
        window.addEventListener('keydown', handler);
        setTimeout(() => window.addEventListener('click', clickHandler), 0);
        return () => { window.removeEventListener('keydown', handler); window.removeEventListener('click', clickHandler); };
    }, [onClose]);

    const label = type === 'health' ? 'Health — Metodología' : 'Score — Operativo';
    const themeColor = score >= 80 ? 'emerald' : score >= 60 ? 'amber' : score >= 40 ? 'orange' : 'red';
    const qualityLabels = { emerald: 'Excelente', amber: 'Bueno', orange: 'Regular', red: 'Necesita mejoras' };

    return createPortal(
        <div
            className="score-popover fixed z-[9999] animate-in fade-in zoom-in-95 duration-150"
            style={{ top: pos.top, left: pos.left, width: 260 }}
        >
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
                {/* Header */}
                <div className={`flex items-center gap-2.5 px-3 py-2.5 bg-${themeColor}-500/10 border-b border-slate-700/50`}>
                    <div className="relative w-9 h-9 shrink-0">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                            <circle cx="18" cy="18" r="14" fill="none" stroke="#1e293b" strokeWidth="3" />
                            <circle cx="18" cy="18" r="14" fill="none" stroke={color} strokeWidth="3"
                                strokeDasharray={`${(score / 100) * 87.96} 87.96`} strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black" style={{ color }}>{score}</span>
                    </div>
                    <div className="min-w-0">
                        <div className="text-[10px] font-black text-slate-300 uppercase tracking-wide">{label}</div>
                        <div className="text-[9px] font-bold" style={{ color }}>{qualityLabels[themeColor]}</div>
                    </div>
                </div>
                {/* Checklist */}
                <div className="px-2.5 py-2 space-y-0.5 max-h-48 overflow-y-auto">
                    {items.map((item, i) => (
                        <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${item.passed ? 'opacity-50' : 'bg-slate-800/40'}`}>
                            {item.passed ? (
                                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                </div>
                            ) : (
                                <div className="w-3.5 h-3.5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                                    <X className="w-2.5 h-2.5 text-red-400" />
                                </div>
                            )}
                            <span className={`text-[10px] flex-1 ${item.passed ? 'text-slate-500 line-through' : 'text-slate-300 font-medium'}`}>
                                {item.label}
                            </span>
                            <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${item.passed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                                {type === 'health' ? `${item.pts}pts` : item.penalty}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body
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
        const name = member.displayName || member.email || '??';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        const clean = parts[0].replace(/[^a-zA-Z]/g, '');
        return (clean.slice(0, 2) || '??').toUpperCase();
    })();

    // Solo usar foto si es una imagen personalizada real (no el avatar automático de Google)
    const isRealPhoto = member.photoURL &&
        !member.photoURL.includes('googleusercontent.com/a/') &&
        !member.photoURL.match(/=s\d+-c$/);

    // Color consistente por usuario
    const hue = (member.uid || member.email || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    const bg = isRealPhoto
        ? `url(${member.photoURL}) center/cover`
        : `hsl(${hue}, 65%, 45%)`;

    return (
        <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ring-2 ring-slate-700 shrink-0"
            style={{
                background: bg,
                color: isRealPhoto ? 'transparent' : '#fff',
                letterSpacing: '-0.03em',
            }}
            title={member.displayName || member.email}
        >
            {!isRealPhoto && initials}
        </div>
    );
}

// ============================================================
// SUBTASK EXPANDER
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
        <div className="pl-10 pr-4 py-2.5 bg-slate-900/50 border-t border-slate-700/30 animate-in fade-in slide-in-from-top-1 duration-200" onClick={e => e.stopPropagation()}>
            <div className="space-y-1 max-w-md">
                {subtasks.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 py-0.5 group/sub">
                        <button
                            onClick={() => handleToggle(sub)}
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                sub.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-slate-400'
                            }`}
                        >
                            {sub.completed && <Check className="w-2 h-2 text-white" />}
                        </button>
                        <span className={`text-xs ${sub.completed ? 'line-through text-slate-600' : 'text-slate-300'}`}>
                            {sub.title}
                        </span>
                    </div>
                ))}
                {canEdit && (
                    <div className="flex items-center gap-2 pt-1">
                        <Plus className="w-3 h-3 text-slate-600 shrink-0" />
                        <input
                            ref={inputRef}
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                            placeholder="Agregar subtarea..."
                            className="flex-1 bg-transparent text-xs text-slate-400 placeholder:text-slate-700 outline-none"
                        />
                        {newTitle.trim() && (
                            <button onClick={handleAdd} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300">+</button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================
// STATION CELL — shows station label for a task
// ============================================================

// Module-level cache to avoid refetching stations per row
const _stationCache = {};

function StationCell({ task, canEdit, onSave }) {
    const [stations, setStations] = useState(() => _stationCache[task.projectId] || []);

    useEffect(() => {
        if (!task.projectId || _stationCache[task.projectId]) return;

        const unsub = onProjectStations(task.projectId, (data) => {
            _stationCache[task.projectId] = data;
            setStations(data);
        });
        return unsub;
    }, [task.projectId]);

    const multiIdx = useMemo(() => hasMultipleIndexers(stations), [stations]);

    const label = useMemo(() => {
        if (!task.stationId || stations.length === 0) return '';
        const stn = stations.find(s => s.id === task.stationId);
        if (!stn) return '';
        return formatStationLabel(stn, multiIdx);
    }, [task.stationId, stations, multiIdx]);

    const stationOptions = useMemo(() => [
        { value: '', label: 'Sin estación' },
        ...stations.filter(s => s.active !== false).map(s => {
            const base = formatStationLabel(s, multiIdx);
            let text = base;
            if (s.description) text = `${base} — ${s.description}`;
            else if (s.abbreviation) text = `${base} — ${s.abbreviation}`;
            return { value: s.id, label: text };
        }),
    ], [stations, multiIdx]);

    if (!task.projectId || stations.length === 0) {
        return (
            <div className="flex items-center justify-center min-w-0">
                <span className="text-[10px] text-slate-700">—</span>
            </div>
        );
    }

    if (canEdit) {
        return (
            <div className="flex items-center justify-center min-w-0">
                <InlineDropdown
                    value={task.stationId || ''}
                    options={stationOptions}
                    onSelect={v => onSave(v || null)}
                    renderValue={() => (
                        <span className={`text-[10px] font-bold truncate ${label ? 'text-cyan-400' : 'text-slate-700'}`}>
                            {label || '—'}
                        </span>
                    )}
                />
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-w-0">
            <span className={`text-[10px] font-bold truncate ${label ? 'text-cyan-400' : 'text-slate-700'}`}>
                {label || '—'}
            </span>
        </div>
    );
}

// ============================================================
// TASK ROW
// ============================================================

function TaskRow({ task, engProjects, teamMembers, subtasks, canEdit, canEditDates, onOpenModal, groupColor, isLast, savedField, onSaved, taskTypes, workAreaTypes }) {
    const [popover, setPopover] = useState(null); // 'health' | 'score' | null
    const healthRef = useRef(null);
    const scoreRef = useRef(null);
    const [expandedSubs, setExpandedSubs] = useState(false);

    const saveField = useCallback(async (field, value) => {
        try {
            if (field === 'status') {
                await updateTaskStatus(task.id, value);
            } else {
                await updateTask(task.id, { [field]: value });
            }
            // Log assignment changes with assigner info
            if (field === 'assignedTo') {
                const assigneeName = teamMembers.find(m => m.uid === value)?.displayName || 'Sin asignar';
                logActivity(task.id, {
                    type: ACTIVITY_TYPES.ASSIGNEE_CHANGED,
                    description: `Tarea reasignada a ${assigneeName}`,
                    userId: task.assignedBy || null,
                    meta: { previousAssignee: task.assignedTo, newAssignee: value, assigneeName },
                });
            }
            onSaved(`${task.id}-${field}`);
        } catch (err) {
            console.error(`Failed to save ${field}:`, err);
        }
    }, [task.id, task.assignedTo, task.assignedBy, teamMembers, onSaved]);

    const project = engProjects.find(p => p.id === task.projectId);
    const isSaved = (field) => savedField === `${task.id}-${field}`;

    // Options
    const statusOptions = Object.entries(TASK_STATUS_CONFIG).map(([key, cfg]) => ({
        value: key, label: cfg.label, color: cfg.color,
    }));
    const priorityOptions = Object.entries(TASK_PRIORITY_CONFIG).map(([key, cfg]) => ({
        value: key, label: cfg.label, color: cfg.color || '#64748b',
    }));
    const ownerOptions = [
        { value: '', label: 'Sin asignar' },
        ...teamMembers.map(m => ({ value: m.uid, label: m.displayName || m.email })),
    ];
    const projectOptions = [
        { value: '', label: 'Sin proyecto' },
        ...engProjects.map(p => ({ value: p.id, label: p.name })),
    ];

    const statusCfg = TASK_STATUS_CONFIG[task.status] || {};

    // Subtask progress
    const totalSubs = subtasks.length;
    const doneSubs = subtasks.filter(s => s.completed || s.done).length;
    const subsPct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;

    // Timeline
    const startRaw = task.plannedStartDate || task.createdAt;
    const endRaw = task.dueDate || task.plannedEndDate;
    const startDate = startRaw ? new Date(startRaw) : null;
    const endDate = endRaw ? new Date(endRaw) : null;
    const now = new Date();

    let timelinePct = 0;
    let timelineColor = '#6366f1';
    let daysLeft = null;
    if (startDate && endDate) {
        const total = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));
        const elapsed = Math.max(0, (now - startDate) / (1000 * 60 * 60 * 24));
        timelinePct = Math.min(100, Math.max(0, (elapsed / total) * 100));
        daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0 && task.status !== 'completed') timelineColor = '#ef4444';
        else if (timelinePct > 80) timelineColor = '#f59e0b';
    }

    // Hours
    const actual = task.actualHours || 0;
    const estimated = task.estimatedHours || 0;
    const hoursPct = estimated > 0 ? Math.round((actual / estimated) * 100) : 0;

    const fmtDate = (d) => d ? d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '—';

    // ──── % Avance ────
    // Usa progressPct del task si existe, si no lo calcula de subtareas
    const progressPct = task.progressPct != null
        ? Math.round(task.progressPct)
        : (task.status === 'completed' ? 100 : subsPct);
    const progressColor = progressPct === 100 ? '#22c55e' : progressPct >= 60 ? '#6366f1' : progressPct >= 30 ? '#f59e0b' : '#ef4444';

    // ──── Health Score (operativo — mide atrasos) → ahora se llama "Score" ────
    const calcHealth = () => {
        if (task.status === 'completed') return 100;
        if (task.status === 'cancelled') return null;
        let score = 100;
        if (daysLeft !== null && daysLeft < 0) score -= Math.min(40, Math.abs(daysLeft) * 4);
        else if (daysLeft !== null && daysLeft <= 2) score -= 15;
        if (hoursPct > 120) score -= 25;
        else if (hoursPct > 100) score -= 15;
        else if (hoursPct > 85) score -= 5;
        if (timelinePct > 70 && progressPct < 30) score -= 20;
        else if (timelinePct > 50 && progressPct < 20) score -= 10;
        return Math.max(0, Math.min(100, Math.round(score)));
    };
    const opScore = calcHealth();
    const opScoreColor = opScore === null ? '#475569' : opScore >= 80 ? '#22c55e' : opScore >= 60 ? '#f59e0b' : '#ef4444';

    // ──── Health (metodología — calidad de definición) ────
    const calcMethodHealth = () => {
        let score = 0;
        if (totalSubs > 0) score += 15;
        if (estimated > 0) score += 20;
        if (task.assignedTo) score += 20;
        if (task.dueDate || task.plannedEndDate) score += 15;
        if (task.taskTypeId) score += 10;
        if ((task.description || '').trim().length >= 10) score += 10;
        if (task.priority !== 'critical' || task.milestoneId) score += 10;
        return score;
    };
    const methHealth = calcMethodHealth();
    const methColor = methHealth >= 80 ? '#22c55e' : methHealth >= 60 ? '#f59e0b' : methHealth >= 40 ? '#fb923c' : '#ef4444';

    // ──── Popover breakdown items ────
    const healthItems = [
        { label: 'Subtareas definidas', pts: 15, passed: totalSubs > 0 },
        { label: 'Estimación de horas', pts: 20, passed: estimated > 0 },
        { label: 'Responsable asignado', pts: 20, passed: !!task.assignedTo },
        { label: 'Fecha límite', pts: 15, passed: !!(task.dueDate || task.plannedEndDate) },
        { label: 'Tipo de tarea', pts: 10, passed: !!task.taskTypeId },
        { label: 'Descripción (≥10 chars)', pts: 10, passed: (task.description || '').trim().length >= 10 },
        { label: task.priority === 'critical' ? 'Milestone (crítica)' : 'Milestone', pts: 10, passed: task.priority !== 'critical' || !!task.milestoneId },
    ];

    const scoreItems = opScore !== null ? [
        { label: 'Timeline (atrasos)', penalty: daysLeft !== null && daysLeft < 0 ? `-${Math.min(40, Math.abs(daysLeft) * 4)}` : daysLeft !== null && daysLeft <= 2 ? '-15' : '0', passed: !(daysLeft !== null && daysLeft < 0) && !(daysLeft !== null && daysLeft <= 2) },
        { label: 'Budget de horas', penalty: hoursPct > 120 ? '-25' : hoursPct > 100 ? '-15' : hoursPct > 85 ? '-5' : '0', passed: hoursPct <= 85 },
        { label: 'Avance vs timeline', penalty: (timelinePct > 70 && progressPct < 30) ? '-20' : (timelinePct > 50 && progressPct < 20) ? '-10' : '0', passed: !((timelinePct > 70 && progressPct < 30) || (timelinePct > 50 && progressPct < 20)) },
    ] : [];

    return (
        <>
            <div
                onDoubleClick={() => onOpenModal(task)}
                className={`grid items-stretch px-2 py-1.5 transition-all duration-150 hover:bg-indigo-500/6 group/row ${!isLast ? 'border-b border-slate-800/30' : ''}`}
                style={{ gridTemplateColumns: GRID_COLS, borderLeft: `3px solid ${groupColor}` }}
            >
                {/* Checkbox / Open */}
                <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                    <button onClick={(e) => { e.stopPropagation(); onOpenModal(task); }} className="text-slate-700 hover:text-indigo-400 transition-colors shrink-0" title="Abrir detalle">
                        <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Task Name + subtask chevron + subtask count badge */}
                <div className="pr-1 min-w-0 flex items-center gap-1">
                    {/* Chevron — solo si tiene subtareas */}
                    {totalSubs > 0 ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); setExpandedSubs(!expandedSubs); }}
                            className="shrink-0 text-slate-500 hover:text-slate-200 transition-colors"
                            title={expandedSubs ? 'Ocultar subtareas' : 'Ver subtareas'}
                        >
                            {expandedSubs
                                ? <ChevronDown className="w-3.5 h-3.5" />
                                : <ChevronRight className="w-3.5 h-3.5" />
                            }
                        </button>
                    ) : (
                        <span className="w-3.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1 flex items-center gap-1.5">
                        {canEdit ? (
                            <InlineEditText
                                value={task.title || ''}
                                onSave={v => saveField('title', v)}
                                className={`text-sm font-semibold text-slate-200 truncate ${isSaved('title') ? 'bg-emerald-500/10' : ''}`}
                                placeholder="Sin título"
                            />
                        ) : (
                            <p className="text-sm font-semibold text-slate-200 truncate">{task.title || 'Sin título'}</p>
                        )}
                        {/* Subtask count badge — Monday.com style */}
                        {totalSubs > 0 && (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                                subsPct === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/60 text-slate-400'
                            }`}>
                                {doneSubs}/{totalSubs}
                            </span>
                        )}
                    </div>
                    {/* Quick action icons on hover */}
                    <div className="hidden group-hover/row:flex items-center gap-0.5 shrink-0">
                        <button onClick={e => { e.stopPropagation(); onOpenModal(task); }} className="p-0.5 text-slate-600 hover:text-indigo-400 transition-colors" title="Agregar subtarea">
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                {/* Owner */}
                <div className="flex items-center justify-center">
                    {canEdit ? (
                        <InlineDropdown
                            value={task.assignedTo || ''}
                            options={ownerOptions}
                            onSelect={v => saveField('assignedTo', v || null)}
                            renderValue={() => <OwnerAvatar task={task} teamMembers={teamMembers} />}
                            className="h-auto!"
                        />
                    ) : (
                        <OwnerAvatar task={task} teamMembers={teamMembers} />
                    )}
                </div>

                {/* Project */}
                <div className="flex items-center justify-center min-w-0">
                    {canEdit ? (
                        <InlineDropdown
                            value={task.projectId || ''}
                            options={projectOptions}
                            onSelect={v => saveField('projectId', v || null)}
                            renderValue={(val) => {
                                const p = engProjects.find(pr => pr.id === val);
                                return <span className="text-[11px] truncate block max-w-[100px] text-slate-400 italic text-center">{p?.name || '—'}</span>;
                            }}
                        />
                    ) : (
                        <span className="text-[11px] text-slate-400 italic truncate block text-center">{project?.name || '—'}</span>
                    )}
                </div>

                {/* Station (STN) */}
                <StationCell task={task} canEdit={canEdit} onSave={v => saveField('stationId', v)} />

                {/* Status — Monday.com full-width colored cell */}
                <div className="flex items-stretch p-0.5" onClick={e => e.stopPropagation()}>
                    {canEdit ? (
                        <InlineDropdown
                            value={task.status}
                            options={statusOptions}
                            onSelect={v => saveField('status', v)}
                            renderValue={(val) => {
                                const cfg = TASK_STATUS_CONFIG[val] || {};
                                return (
                                    <div className="w-full h-full flex items-center justify-center rounded text-[10px] font-bold text-white text-center leading-tight min-h-[26px]"
                                        style={{ background: cfg.color || '#64748b' }}>
                                        {cfg.label || val}
                                    </div>
                                );
                            }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center rounded text-[10px] font-bold text-white text-center leading-tight min-h-[26px]"
                            style={{ background: statusCfg.color || '#64748b' }}>
                            {statusCfg.label || task.status}
                        </div>
                    )}
                </div>

                {/* Área */}
                <div className="min-w-0 overflow-hidden flex items-center justify-center" onClick={e => e.stopPropagation()}>
                    {(() => {
                        const wa = (workAreaTypes || []).find(a => a.id === task.workAreaTypeId);
                        const areaOptions = [
                            { value: '', label: 'Sin área' },
                            ...(workAreaTypes || []).map(a => ({ value: a.id, label: a.name })),
                        ];
                        return canEdit ? (
                            <InlineDropdown
                                value={task.workAreaTypeId || ''}
                                options={areaOptions}
                                onSelect={v => {
                                    saveField('workAreaTypeId', v || null);
                                    if (v && task.taskTypeId) {
                                        const newArea = (workAreaTypes || []).find(a => a.id === v);
                                        const allowedNames = newArea?.defaultTaskTypes || [];
                                        const currentType = (taskTypes || []).find(t => t.id === task.taskTypeId);
                                        if (currentType && allowedNames.length > 0 && !allowedNames.includes(currentType.name)) {
                                            saveField('taskTypeId', null);
                                        }
                                    }
                                }}
                                renderValue={() => (
                                    <span className="text-[10px] text-slate-400 truncate block text-center">{wa?.name || '—'}</span>
                                )}
                            />
                        ) : (
                            <span className="text-[10px] text-slate-400 truncate block text-center">{wa?.name || '—'}</span>
                        );
                    })()}
                </div>

                {/* Tipo (filtered by area) */}
                <div className="min-w-0 overflow-hidden flex items-center justify-center" onClick={e => e.stopPropagation()}>
                    {(() => {
                        const selectedArea = (workAreaTypes || []).find(a => a.id === task.workAreaTypeId);
                        const allowedValues = selectedArea?.defaultTaskTypes || [];
                        const filteredTypes = allowedValues.length > 0
                            ? (taskTypes || []).filter(t => allowedValues.includes(t.id) || allowedValues.includes(t.name))
                            : (taskTypes || []);
                        const tt = (taskTypes || []).find(t => t.id === task.taskTypeId);
                        const typeOptions = [
                            { value: '', label: 'Sin tipo' },
                            ...filteredTypes.map(t => ({ value: t.id, label: t.name })),
                        ];
                        return canEdit ? (
                            <InlineDropdown
                                value={task.taskTypeId || ''}
                                options={typeOptions}
                                onSelect={v => saveField('taskTypeId', v || null)}
                                renderValue={() => (
                                    <span className="text-[10px] text-slate-400 truncate block text-center">{tt?.name || '—'}</span>
                                )}
                            />
                        ) : (
                            <span className="text-[10px] text-slate-400 truncate block text-center">{tt?.name || '—'}</span>
                        );
                    })()}
                </div>

                {/* ── Avance %% ── */}
                <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                    <div className="flex flex-col items-center gap-0.5 w-full px-1">
                        <span className="text-[11px] font-black" style={{ color: progressColor }}>{progressPct}%</span>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: progressColor }} />
                        </div>
                    </div>
                </div>

                {/* ── Health (metodología) ── */}
                <div className="flex items-center justify-center relative" onClick={e => e.stopPropagation()}>
                    <div
                        ref={healthRef}
                        className="relative flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                        title={`Metodología ${methHealth}/100`}
                        onClick={() => setPopover(popover === 'health' ? null : 'health')}
                    >
                        <svg width="30" height="30" viewBox="0 0 36 36" className="-rotate-90">
                            <circle cx="18" cy="18" r="14" fill="none" stroke="#1e293b" strokeWidth="4" />
                            <circle cx="18" cy="18" r="14" fill="none" stroke={methColor} strokeWidth="4"
                                strokeDasharray={`${(methHealth / 100) * 87.96} 87.96`}
                                strokeLinecap="round" className="transition-all duration-700" />
                        </svg>
                        <span className="absolute text-[8px] font-black" style={{ color: methColor }}>{methHealth}</span>
                    </div>
                    {popover === 'health' && (
                        <ScorePopover
                            type="health" score={methHealth} color={methColor}
                            items={healthItems} anchorRef={healthRef}
                            onClose={() => setPopover(null)}
                        />
                    )}
                </div>

                {/* ── Score (operativo) ── */}
                <div className="flex items-center justify-center relative" onClick={e => e.stopPropagation()}>
                    {opScore !== null ? (
                        <div
                            ref={scoreRef}
                            className="relative flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                            title={`Score operativo ${opScore}/100`}
                            onClick={() => setPopover(popover === 'score' ? null : 'score')}
                        >
                            <svg width="30" height="30" viewBox="0 0 36 36" className="-rotate-90">
                                <circle cx="18" cy="18" r="14" fill="none" stroke="#1e293b" strokeWidth="4" />
                                <circle cx="18" cy="18" r="14" fill="none" stroke={opScoreColor} strokeWidth="4"
                                    strokeDasharray={`${(opScore / 100) * 87.96} 87.96`}
                                    strokeLinecap="round" className="transition-all duration-700" />
                            </svg>
                            <span className="absolute text-[8px] font-black" style={{ color: opScoreColor }}>{opScore}</span>
                        </div>
                    ) : (
                        <span className="text-[11px] text-slate-600">—</span>
                    )}
                    {popover === 'score' && opScore !== null && (
                        <ScorePopover
                            type="score" score={opScore} color={opScoreColor}
                            items={scoreItems} anchorRef={scoreRef}
                            onClose={() => setPopover(null)}
                        />
                    )}
                </div>

                {/* Timeline */}
                <div className="min-w-0 overflow-hidden flex flex-col items-center justify-end gap-1.5 py-1.5 px-1" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5 text-[11px] min-w-0 w-full mt-auto">
                        {canEdit ? (
                            <>
                                {(canEditDates || !startRaw) ? (
                                    <InlineDatePicker value={startRaw} onSave={v => saveField('plannedStartDate', v)} />
                                ) : (
                                    <span className="text-slate-400 text-[11px] whitespace-nowrap">{fmtDate(startDate)}</span>
                                )}
                                <span className="text-slate-600 shrink-0">→</span>
                                {(canEditDates || !endRaw) ? (
                                    <InlineDatePicker value={endRaw} onSave={v => saveField('dueDate', v)} />
                                ) : (
                                    <span className="text-slate-400 text-[11px] whitespace-nowrap">{fmtDate(endDate)}</span>
                                )}
                            </>
                        ) : (
                            <span className="text-slate-400 truncate whitespace-nowrap">{fmtDate(startDate)} → {fmtDate(endDate)}</span>
                        )}
                        {daysLeft !== null && (
                            <span className={`text-[11px] font-bold shrink-0 px-1 rounded ${
                                daysLeft < 0 && task.status !== 'completed' ? 'text-rose-400 bg-rose-500/15' :
                                daysLeft <= 3 ? 'text-amber-400' : 'text-slate-500'
                            }`}>
                                {task.status === 'completed' ? '✓' : daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : `${daysLeft}d`}
                            </span>
                        )}
                    </div>
                    {startDate && endDate && (
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden shrink-0">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${timelinePct}%`, background: timelineColor }} />
                        </div>
                    )}
                </div>

                {/* Hours — own column with bar */}
                <div className="min-w-0 overflow-hidden flex flex-col items-center justify-end gap-1.5 py-1.5 px-1" onClick={e => e.stopPropagation()}>
                    {(actual > 0 || estimated > 0) ? (
                        <>
                            <div className="flex items-center justify-center gap-1 text-[11px] min-w-0 w-full mt-auto">
                                <span className="text-slate-400 font-bold shrink-0">{actual.toFixed(1)}h</span>
                                <span className="text-slate-600 shrink-0">/</span>
                                {canEdit ? (
                                    <InlineEditNumber value={estimated} onSave={v => saveField('estimatedHours', v)} />
                                ) : (
                                    <span className="text-slate-400 shrink-0">{estimated}h</span>
                                )}
                                {estimated > 0 && (
                                    <span className={`text-[11px] font-bold shrink-0 ml-1 ${
                                        hoursPct > 100 ? 'text-rose-400' : hoursPct > 80 ? 'text-amber-400' : 'text-emerald-400'
                                    }`}>
                                        {hoursPct}%
                                    </span>
                                )}
                            </div>
                            {estimated > 0 && (
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500" style={{
                                        width: `${Math.min(hoursPct, 100)}%`,
                                        background: hoursPct > 100 ? '#ef4444' : hoursPct > 80 ? '#f59e0b' : '#22c55e',
                                    }} />
                                </div>
                            )}
                        </>
                    ) : (
                        <span className="text-[11px] text-slate-600">—</span>
                    )}
                </div>

                {/* Priority — Monday.com full-width colored cell */}
                <div className="flex items-stretch p-0.5" onClick={e => e.stopPropagation()}>
                    {canEdit ? (
                        <InlineDropdown
                            value={task.priority || 'medium'}
                            options={priorityOptions}
                            onSelect={v => saveField('priority', v)}
                            renderValue={(val) => {
                                const colors = { low: '#579bfc', medium: '#a25ddc', high: '#fdab3d', critical: '#e2445c' };
                                const c = colors[val] || '#579bfc';
                                const cfg = TASK_PRIORITY_CONFIG[val] || {};
                                return (
                                    <div className="w-full h-full flex items-center justify-center rounded text-[10px] font-bold text-white text-center leading-tight min-h-[26px]"
                                        style={{ background: c }}>
                                        {cfg.label || val}
                                    </div>
                                );
                            }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center rounded text-[10px] font-bold text-white text-center leading-tight min-h-[26px]"
                            style={{ background: { low: '#579bfc', medium: '#a25ddc', high: '#fdab3d', critical: '#e2445c' }[task.priority] || '#579bfc' }}>
                            {(TASK_PRIORITY_CONFIG[task.priority] || {}).label || '—'}
                        </div>
                    )}
                </div>



                {/* Assigned By (who assigned — far right) */}
                <div className="flex items-center justify-center">
                    {canEdit ? (
                        <InlineDropdown
                            value={task.assignedBy || ''}
                            options={ownerOptions}
                            onSelect={v => saveField('assignedBy', v || null)}
                            renderValue={(val) => {
                                const assigner = teamMembers.find(m => m.uid === val);
                                if (!assigner) return <span className="text-[9px] text-slate-700">—</span>;
                                const initials = (assigner.displayName || assigner.email || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                                return (
                                    <div className="w-7 h-7 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center hover:bg-purple-600/40 transition-colors cursor-pointer" title={`Asignado por: ${assigner.displayName || assigner.email}`}>
                                        <span className="text-[9px] font-bold text-purple-400">{initials}</span>
                                    </div>
                                );
                            }}
                            className="h-auto!"
                        />
                    ) : (() => {
                        const assigner = teamMembers.find(m => m.uid === task.assignedBy);
                        if (!assigner) return <span className="text-[9px] text-slate-700">—</span>;
                        const initials = (assigner.displayName || assigner.email || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                        return (
                            <div className="w-7 h-7 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center" title={`Asignado por: ${assigner.displayName || assigner.email}`}>
                                <span className="text-[9px] font-bold text-purple-400">{initials}</span>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Expanded Subtasks */}
            {expandedSubs && totalSubs > 0 && (
                <SubtaskExpander subtasks={subtasks} taskId={task.id} canEdit={canEdit} />
            )}
        </>
    );
}

// ============================================================
// MOBILE TASK CARD (Monday.com style)
// ============================================================

function MobileTaskCard({ task, engProjects, teamMembers, subtasks, canEdit, onOpenModal, groupColor, taskTypes, workAreaTypes }) {
    const [expandedSubs, setExpandedSubs] = useState(false);

    const project = engProjects.find(p => p.id === task.projectId);
    const statusCfg = TASK_STATUS_CONFIG[task.status] || {};
    const priorityCfg = TASK_PRIORITY_CONFIG[task.priority] || {};
    const priorityColors = { low: '#94a3b8', medium: '#60a5fa', high: '#fbbf24', critical: '#f87171' };
    const pColor = priorityColors[task.priority] || '#94a3b8';

    const totalSubs = subtasks.length;
    const doneSubs = subtasks.filter(s => s.completed || s.done).length;
    const subsPct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;
    const subsColor = subsPct === 100 ? '#22c55e' : subsPct >= 50 ? '#f59e0b' : subsPct > 0 ? '#6366f1' : '#334155';

    const startRaw = task.plannedStartDate || task.createdAt;
    const endRaw = task.dueDate || task.plannedEndDate;
    const startDate = startRaw ? new Date(startRaw) : null;
    const endDate = endRaw ? new Date(endRaw) : null;
    const now = new Date();

    let timelinePct = 0, timelineColor = '#6366f1', daysLeft = null;
    if (startDate && endDate) {
        const total = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));
        const elapsed = Math.max(0, (now - startDate) / (1000 * 60 * 60 * 24));
        timelinePct = Math.min(100, Math.max(0, (elapsed / total) * 100));
        daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0 && task.status !== 'completed') timelineColor = '#ef4444';
        else if (timelinePct > 80) timelineColor = '#f59e0b';
    }

    const actual = task.actualHours || 0;
    const estimated = task.estimatedHours || 0;
    const hoursPct = estimated > 0 ? Math.round((actual / estimated) * 100) : 0;
    const hoursBarColor = hoursPct > 100 ? '#ef4444' : hoursPct > 80 ? '#f59e0b' : '#22c55e';

    const fmtDate = (d) => d ? d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '—';

    const owner = teamMembers.find(m => m.uid === task.assignedTo);

    return (
        <div
            className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-3"
            style={{ borderLeft: `4px solid ${groupColor}` }}
            onClick={() => onOpenModal(task)}
        >
            {/* Row 1: Title + Priority badge */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {totalSubs > 0 && (
                        <button onClick={e => { e.stopPropagation(); setExpandedSubs(!expandedSubs); }} className="text-slate-500 shrink-0">
                            {expandedSubs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                    )}
                    <h4 className="text-sm font-bold text-slate-100 truncate">{task.title || 'Sin título'}</h4>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0"
                    style={{ backgroundColor: pColor + '18', color: pColor, border: `1px solid ${pColor}30` }}>
                    {priorityCfg.label || task.priority}
                </span>
            </div>

            {/* Row 2: Owner + Status */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {owner?.photoURL ? (
                        <img src={owner.photoURL} alt="" className="w-7 h-7 rounded-full border border-slate-700" />
                    ) : (
                        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                            {(owner?.displayName || task.assignedTo || '?')[0]?.toUpperCase()}
                        </div>
                    )}
                    <span className="text-xs text-slate-300 truncate">{owner?.displayName || 'Sin asignar'}</span>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap"
                    style={{ backgroundColor: (statusCfg.color || '#64748b') + '20', color: statusCfg.color, border: `1px solid ${(statusCfg.color || '#64748b')}33` }}>
                    {statusCfg.label || task.status}
                </span>
            </div>

            {/* Row 2.5: Area + Task Type */}
            {(() => {
                const wa = (workAreaTypes || []).find(a => a.id === task.workAreaTypeId);
                const tt = (taskTypes || []).find(t => t.id === task.taskTypeId);
                return (wa || tt) ? (
                    <div className="flex items-center gap-3 text-xs">
                        {wa && (
                            <div className="flex items-center gap-1">
                                <span className="text-slate-500">Área</span>
                                <span className="text-teal-400 font-medium">{wa.name}</span>
                            </div>
                        )}
                        {tt && (
                            <div className="flex items-center gap-1">
                                <span className="text-slate-500">Tipo</span>
                                <span className="text-slate-300 font-medium">{tt.name}</span>
                            </div>
                        )}
                    </div>
                ) : null;
            })()}

            {/* Row 3: Progress bar */}
            {totalSubs > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Progreso</span>
                        <span className="font-bold text-slate-300">{doneSubs}/{totalSubs} <span className="text-slate-500">({subsPct}%)</span></span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${subsPct}%`, background: subsColor }} />
                    </div>
                </div>
            )}

            {/* Row 4: Timeline */}
            {startDate && endDate && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Timeline</span>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-300">{fmtDate(startDate)} → {fmtDate(endDate)}</span>
                            {daysLeft !== null && (
                                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                    daysLeft < 0 && task.status !== 'completed' ? 'text-rose-400 bg-rose-500/15' :
                                    daysLeft <= 3 ? 'text-amber-400' : 'text-slate-500'
                                }`}>
                                    {task.status === 'completed' ? '✓' : daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : `${daysLeft}d`}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${timelinePct}%`, background: timelineColor }} />
                    </div>
                </div>
            )}

            {/* Row 5: Hours */}
            {(actual > 0 || estimated > 0) && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Horas</span>
                        <div className="flex items-center gap-2">
                            <span className="text-white font-bold">{actual.toFixed(1)}h</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-slate-400">{estimated}h</span>
                            {estimated > 0 && (
                                <span className={`text-[11px] font-bold ${hoursPct > 100 ? 'text-rose-400' : hoursPct > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {hoursPct}%
                                </span>
                            )}
                        </div>
                    </div>
                    {estimated > 0 && (
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(hoursPct, 100)}%`, background: hoursBarColor }} />
                        </div>
                    )}
                </div>
            )}

            {/* Project tag */}
            {project && (
                <div className="text-[11px] text-slate-500 italic">{project.name}</div>
            )}

            {/* Subtasks expansion */}
            {expandedSubs && totalSubs > 0 && (
                <div onClick={e => e.stopPropagation()}>
                    <SubtaskExpander subtasks={subtasks} taskId={task.id} canEdit={canEdit} />
                </div>
            )}
        </div>
    );
}

// ============================================================
// TABLE GROUP (responsive: grid on desktop, cards on mobile)
// ============================================================

function TableGroup({ label, color, tasks, engProjects, engSubtasks, teamMembers, canEdit, canEditDates, onOpenModal, isExpanded, onToggle, savedField, onSaved, taskTypes, workAreaTypes, groupStatus, user }) {
    const [addingTask, setAddingTask] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const addInputRef = useRef(null);

    const handleAddTask = async () => {
        if (!newTaskTitle.trim()) return;
        try {
            await createTask({ title: newTaskTitle.trim(), status: groupStatus || 'pending' }, user?.uid);
            setNewTaskTitle('');
            setAddingTask(false);
        } catch (err) { console.error('Failed to create task:', err); }
    };

    // Summary calculations
    const statusDist = useMemo(() => {
        const dist = {};
        tasks.forEach(t => {
            const s = t.status || 'pending';
            dist[s] = (dist[s] || 0) + 1;
        });
        return dist;
    }, [tasks]);

    const priorityDist = useMemo(() => {
        const dist = {};
        tasks.forEach(t => {
            const p = t.priority || 'medium';
            dist[p] = (dist[p] || 0) + 1;
        });
        return dist;
    }, [tasks]);

    const dateRange = useMemo(() => {
        const dates = tasks
            .map(t => t.dueDate || t.plannedEndDate)
            .filter(Boolean)
            .map(d => new Date(d));
        if (dates.length === 0) return null;
        const min = new Date(Math.min(...dates));
        const max = new Date(Math.max(...dates));
        const fmt = d => d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
        return `${fmt(min)} - ${fmt(max)}`;
    }, [tasks]);

    return (
        <div className="mb-4 animate-in fade-in duration-200">
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

            {isExpanded && (
                <>
                    {/* Desktop: grid table (hidden on mobile) */}
                    <div className="mt-1 rounded-xl overflow-hidden border border-slate-800/50 bg-slate-800/20 hidden md:block">
                        {/* Header */}
                        <div
                            className="grid items-center px-2 py-2 text-[9px] font-black text-slate-500 uppercase tracking-[0.12em] border-b border-slate-800/50 bg-slate-800/40 text-center"
                            style={{ gridTemplateColumns: GRID_COLS, borderLeft: `3px solid ${color}` }}
                        >
                            <div></div>
                            <div className="text-left">Tarea</div>
                            <div>Resp</div>
                            <div>Proyecto</div>
                            <div>STN</div>
                            <div>Estado</div>
                            <div>Área</div>
                            <div>Tipo</div>
                            <div>Avance</div>
                            <div>Health</div>
                            <div>Score</div>
                            <div>Timeline</div>
                            <div>Horas</div>
                            <div>Prioridad</div>
                            <div>Asig.</div>
                        </div>

                        {tasks.length === 0 ? (
                            <div className="px-4 py-5 text-center text-sm text-slate-600" style={{ borderLeft: `3px solid ${color}` }}>
                                Sin tareas
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
                                    canEditDates={canEditDates}
                                    onOpenModal={onOpenModal}
                                    groupColor={color}
                                    isLast={idx === tasks.length - 1 && !canEdit}
                                    savedField={savedField}
                                    onSaved={onSaved}
                                    taskTypes={taskTypes}
                                    workAreaTypes={workAreaTypes}
                                />
                            ))
                        )}

                        {/* Inline Add Task Row — Monday.com style */}
                        {canEdit && (
                            <div
                                className="grid items-center px-2 py-1.5 border-t border-slate-800/30"
                                style={{ gridTemplateColumns: GRID_COLS, borderLeft: `3px solid ${color}` }}
                            >
                                <div></div>
                                <div className="col-span-13">
                                    {addingTask ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                ref={addInputRef}
                                                value={newTaskTitle}
                                                onChange={e => setNewTaskTitle(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); if (e.key === 'Escape') { setAddingTask(false); setNewTaskTitle(''); } }}
                                                placeholder="Nombre de la nueva tarea..."
                                                className="flex-1 bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none"
                                                autoFocus
                                            />
                                            <button onClick={handleAddTask} className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-500/10 transition-colors">
                                                Crear
                                            </button>
                                            <button onClick={() => { setAddingTask(false); setNewTaskTitle(''); }} className="text-[11px] text-slate-600 hover:text-slate-400">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => { setAddingTask(true); setTimeout(() => addInputRef.current?.focus(), 50); }}
                                            className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-indigo-400 transition-colors py-1"
                                        >
                                            <Plus className="w-3 h-3" /> Agregar tarea
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Group Summary Row — Monday.com style */}
                        {tasks.length > 0 && (
                            <div
                                className="grid items-center px-2 py-2 border-t border-slate-700/40 bg-slate-900/30"
                                style={{ gridTemplateColumns: GRID_COLS, borderLeft: `3px solid ${color}` }}
                            >
                                <div></div> {/* 1. Checkbox */}
                                <div></div> {/* 2. Task */}
                                <div></div> {/* 3. Owner */}
                                <div></div> {/* 4. Project placeholder */}
                                <div></div> {/* 5. STN placeholder */}
                                
                                {/* 6. Status distribution mini bars */}
                                <div className="flex h-5 rounded overflow-hidden mx-1" title="Distribución de estados">
                                    {Object.entries(statusDist).map(([status, count]) => {
                                        const cfg = TASK_STATUS_CONFIG[status] || {};
                                        return (
                                            <div
                                                key={status}
                                                style={{ width: `${(count / tasks.length) * 100}%`, background: cfg.color || '#64748b' }}
                                                className="h-full"
                                                title={`${cfg.label || status}: ${count}`}
                                            />
                                        );
                                    })}
                                </div>
                                
                                <div></div> {/* 7. Área */}
                                <div></div> {/* 8. Tipo */}
                                <div></div> {/* 9. Avance placeholder */}
                                <div></div> {/* 10. Health placeholder */}
                                <div></div> {/* 11. Score placeholder */}
                                
                                {/* 12. Date range (Timeline) */}
                                <div className="flex items-center justify-center">
                                    {dateRange && (
                                        <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-full whitespace-nowrap">
                                            {dateRange}
                                        </span>
                                    )}
                                </div>
                                
                                <div></div> {/* 13. Horas placeholder */}
                                
                                {/* 14. Priority distribution mini bars */}
                                <div className="flex h-5 rounded overflow-hidden mx-1" title="Distribución de prioridades">
                                    {Object.entries(priorityDist).map(([pri, count]) => {
                                        const colors = { low: '#579bfc', medium: '#a25ddc', high: '#fdab3d', critical: '#e2445c' };
                                        return (
                                            <div
                                                key={pri}
                                                style={{ width: `${(count / tasks.length) * 100}%`, background: colors[pri] || '#579bfc' }}
                                                className="h-full"
                                                title={`${pri}: ${count}`}
                                            />
                                        );
                                    })}
                                </div>
                                
                                <div></div> {/* 15. Asig. placeholder */}
                            </div>
                        )}
                    </div>

                    {/* Mobile: card stack (hidden on desktop) */}
                    <div className="mt-2 space-y-3 md:hidden">
                        {tasks.length === 0 ? (
                            <div className="px-4 py-5 text-center text-sm text-slate-600 bg-slate-800/30 rounded-xl border border-slate-700/50">
                                Sin tareas en esta sección
                            </div>
                        ) : (
                            tasks.map(task => (
                                <MobileTaskCard
                                    key={task.id}
                                    task={task}
                                    engProjects={engProjects}
                                    teamMembers={teamMembers}
                                    subtasks={engSubtasks.filter(s => s.taskId === task.id)}
                                    canEdit={canEdit}
                                    onOpenModal={onOpenModal}
                                    groupColor={color}
                                    taskTypes={taskTypes}
                                    workAreaTypes={workAreaTypes}
                                    onSaved={onSaved}
                                />
                            ))
                        )}
                        {/* Mobile add task */}
                        {canEdit && (
                            <button
                                onClick={() => { setAddingTask(true); }}
                                className="w-full py-3 text-sm text-slate-600 hover:text-indigo-400 flex items-center justify-center gap-2 bg-slate-800/20 border border-dashed border-slate-700 rounded-xl transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Agregar tarea
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function MainTable() {
    const { user } = useAuth();
    const { canEdit, canEditDates, canDelete } = useRole();
    const { engProjects, engTasks, engSubtasks, teamMembers, taskTypes, workAreaTypes } = useEngineeringData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [search, setSearch] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterAssignee, setFilterAssignee] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [collapsedGroups, setCollapsedGroups] = useState(() => {
        const init = {};
        STATUS_GROUPS.forEach(g => { init[g.status] = true; });
        return init;
    });
    const { savedField, show: showSaved } = useSaveFeedback();

    const openNew = () => { setSelectedTask(null); setIsModalOpen(true); };
    const openTask = (task) => { setSelectedTask(task); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setSelectedTask(null); };

    const { pendingTransition, transitionError, isTransitioning, confirmTransition, cancelTransition } = useWorkflowTransition();

    const filteredTasks = useMemo(() => {
        return engTasks.filter(task => {
            const s = search.toLowerCase();
            const matchSearch = !s || (task.title || '').toLowerCase().includes(s) || (task.description || '').toLowerCase().includes(s);
            const matchProject = !filterProject || task.projectId === filterProject;
            const matchAssignee = !filterAssignee || task.assignedTo === filterAssignee;
            const matchPriority = !filterPriority || task.priority === filterPriority;
            return matchSearch && matchProject && matchAssignee && matchPriority;
        });
    }, [engTasks, search, filterProject, filterAssignee, filterPriority]);

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

    // Auto-expand groups with tasks, collapse empty ones — reactive to filter changes
    const dataLoadedRef = useRef(false);
    useEffect(() => {
        if (engTasks.length === 0) return;
        dataLoadedRef.current = true;
        const ns = {};
        STATUS_GROUPS.forEach(g => {
            const count = (tasksByStatus[g.status] || []).length;
            ns[g.status] = count === 0; // collapsed=true only if empty
        });
        const timer = setTimeout(() => setCollapsedGroups(ns), 0);
        return () => clearTimeout(timer);
    }, [tasksByStatus]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleGroup = (status) => setCollapsedGroups(prev => ({ ...prev, [status]: !prev[status] }));
    const activeFilterCount = [search, filterProject, filterAssignee, filterPriority].filter(Boolean).length;

    return (
        <div className="-m-4 md:-m-8 flex flex-col" style={{ background: 'var(--bg-app)', color: 'var(--text-primary)', minHeight: '100vh' }}>
            <TaskDetailModal isOpen={isModalOpen} onClose={closeModal} task={selectedTask} projects={engProjects} teamMembers={teamMembers}
                subtasks={selectedTask ? engSubtasks.filter(s => s.taskId === selectedTask.id) : []} taskTypes={taskTypes} userId={user?.uid} canEdit={canEdit} canDelete={canDelete} />
            <TransitionConfirmModal isOpen={!!pendingTransition} pending={pendingTransition} isTransitioning={isTransitioning} onConfirm={confirmTransition} onCancel={cancelTransition} />

            {transitionError && (
                <div className="fixed bottom-24 md:bottom-4 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-4">
                    {transitionError}
                </div>
            )}

            <TaskModuleBanner onNewTask={canEdit ? openNew : null} canEdit={canEdit} />


            {/* Filters — always visible */}
            <div className="flex flex-wrap gap-2 items-center px-6 py-2 border-b border-slate-800/40">
                <div className="relative flex-1 min-w-[160px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                        className="pl-8 pr-3 py-1.5 w-full border border-slate-700/60 rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500/50 bg-slate-800/60 placeholder:text-slate-600" />
                </div>
                <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                    className="px-3 py-1.5 border border-slate-700/60 rounded-lg text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500/50 bg-slate-800/60 cursor-pointer">
                    <option value="">Todos los proyectos</option>
                    {engProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
                    className="px-3 py-1.5 border border-slate-700/60 rounded-lg text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500/50 bg-slate-800/60 cursor-pointer">
                    <option value="">Todos los miembros</option>
                    {teamMembers.map(u => <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>)}
                </select>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                    className="px-3 py-1.5 border border-slate-700/60 rounded-lg text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500/50 bg-slate-800/60 cursor-pointer">
                    <option value="">Todas las prioridades</option>
                    {Object.entries(TASK_PRIORITY_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                </select>
                {activeFilterCount > 0 && (
                    <button onClick={() => { setSearch(''); setFilterProject(''); setFilterAssignee(''); setFilterPriority(''); }}
                        className="text-[11px] text-rose-400 hover:text-rose-300 px-2 py-1 rounded hover:bg-rose-500/10 transition-colors">
                        Limpiar
                    </button>
                )}
            </div>



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
                            canEditDates={canEditDates}
                            onOpenModal={openTask}
                            isExpanded={!collapsedGroups[group.status]}
                            onToggle={() => toggleGroup(group.status)}
                            savedField={savedField}
                            onSaved={showSaved}
                            taskTypes={taskTypes}
                            workAreaTypes={workAreaTypes}
                            groupStatus={group.status}
                            user={user}
                        />
                    );
                })}

                {filteredTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-4">
                            <Search className="w-7 h-7 text-slate-600" />
                        </div>
                        <p className="text-slate-500 font-semibold text-sm">No se encontraron tareas</p>
                    </div>
                )}
            </div>
        </div>
    );
}
