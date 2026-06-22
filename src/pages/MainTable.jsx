/* eslint-disable */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { useEngineeringData } from '../hooks/useEngineeringData';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import TransitionConfirmModal from '../components/workflow/TransitionConfirmModal';
import TaskModuleBanner from '../components/layout/TaskModuleBanner';
import AiReviewModal from '../components/tasks/AiReviewModal';
import { useWorkflowTransition } from '../hooks/useWorkflowTransition';
import { updateTask, updateTaskStatus, toggleSubtask, createSubtask, createTask } from '../services/taskService';
import { exportMainTableToExcel } from '../utils/excelExport';
import { logActivity, ACTIVITY_TYPES } from '../services/activityLogService';
import { getActiveAssignments } from '../services/resourceAssignmentService';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import {
    TASK_STATUS, TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG, formatStationLabel
} from '../models/schemas';
import { onProjectStations, hasMultipleIndexers } from '../services/stationService';
import {
    Search, Filter, X, ChevronDown, ChevronRight, User, Calendar,
    Check, Plus, Maximize2, Download, Sparkles, Loader2, MessageSquare, CheckSquare
} from 'lucide-react';
import { supabase } from '../supabase';

// ============================================================
// HELPERS
// ============================================================

/** Formats ISO date to "DD-Mes-YY" in Spanish */
function formatCommentDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        const formatter = new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: 'short',
            year: '2-digit'
        });
        const parts = formatter.formatToParts(date);
        const day = parts.find(p => p.type === 'day')?.value || '';
        let month = parts.find(p => p.type === 'month')?.value || '';
        month = month.replace('.', '');
        if (month) {
            month = month.charAt(0).toUpperCase() + month.slice(1);
        }
        const year = parts.find(p => p.type === 'year')?.value || '';
        return `${day}-${month}-${year}`;
    } catch (e) {
        return '';
    }
}

/** Generate a consistent HSL color from a project name */
function generateProjectColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 55%)`;
}

// ============================================================
// CONSTANTS
// ============================================================

const STATUS_GROUPS = [
    { status: TASK_STATUS.IN_PROGRESS, label: 'In Progress', color: '#f59e0b' },
    { status: TASK_STATUS.PENDING,     label: 'To Do',       color: '#ef4444' },
    { status: TASK_STATUS.VALIDATION,  label: 'Revisión',  color: '#8b5cf6' },
    { status: TASK_STATUS.COMPLETED,   label: 'Completado',  color: '#22c55e' },
    { status: TASK_STATUS.BLOCKED,     label: 'Bloqueado',   color: '#ef4444' },
    { status: TASK_STATUS.CANCELLED,   label: 'Cancelado',   color: '#6b7280' },
];

// 13-column grid: ☐ | Task | Comments | Owner | STN | Status | Área | Tipo | Avance | Timeline | Hours | Priority | Asig.
const GRID_COLS = '30px 28px minmax(200px, 1fr) minmax(120px, 200px) 36px 55px 86px 68px 68px 56px minmax(105px,150px) minmax(65px,95px) 76px 36px';
const MOBILE_GRID_COLS = '120px 65px 65px 100px 85px 90px 100px 125px 85px 95px 65px';

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

function InlineEditText({ value, onSave, className = '', placeholder = '', ariaLabel = '' }) {
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
            <div
                onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                role="button"
                tabIndex={0}
                aria-label={ariaLabel || `Editar ${placeholder || 'campo'}`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setEditing(true); } }}
                className={`cursor-text hover:bg-slate-800/60 rounded px-1 py-0.5 -mx-1 transition-colors ${className}`}
            >
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
            aria-label={ariaLabel || placeholder}
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
                {[...subtasks].sort((a, b) => {
                    const ta = (a.title || '').toLowerCase();
                    const tb = (b.title || '').toLowerCase();
                    const partsA = ta.match(/(\d+|\D+)/g) || [];
                    const partsB = tb.match(/(\d+|\D+)/g) || [];
                    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                        if (i >= partsA.length) return -1;
                        if (i >= partsB.length) return 1;
                        const isNumA = /^\d+$/.test(partsA[i]);
                        const isNumB = /^\d+$/.test(partsB[i]);
                        if (isNumA && isNumB) {
                            const diff = parseInt(partsA[i], 10) - parseInt(partsB[i], 10);
                            if (diff !== 0) return diff;
                        } else {
                            const cmp = partsA[i].localeCompare(partsB[i]);
                            if (cmp !== 0) return cmp;
                        }
                    }
                    return 0;
                }).map(sub => (
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
        if (!task.projectId) {
            setStations([]);
            return;
        }

        // If cache already exists, use it immediately but still subscribe for updates
        if (_stationCache[task.projectId]) {
            setStations(_stationCache[task.projectId]);
        }

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

function TaskRow({ isMobile, isSelectionEnabled, task, engProjects, teamMembers, subtasks, canEdit, canEditDates, onOpenModal, groupColor, isLast, savedField, onSaved, taskTypes, workAreaTypes, isSelected, onToggleSelect, commentCount, taskComments }) {
    const { refetch } = useEngineeringData();
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
            refetch?.('tasks');
        } catch (err) {
            console.error(`Failed to save ${field}:`, err);
            if (field === 'status') {
                alert('No se pudo cambiar el estado: ' + (err.message || 'Error desconocido'));
            } else {
                alert('No se pudo guardar el campo: ' + (err.message || 'Error desconocido'));
            }
        }
    }, [task.id, task.assignedTo, task.assignedBy, teamMembers, onSaved, refetch]);

    const project = engProjects.find(p => p.id === task.projectId);
    const isSaved = (field) => savedField === `${task.id}-${field}`;

    // Options
    const statusOptions = Object.entries(TASK_STATUS_CONFIG)
        .filter(([key]) => key !== TASK_STATUS.BACKLOG)
        .map(([key, cfg]) => ({
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
        if (daysLeft < 0 && task.status !== 'completed' && task.status !== 'cancelled') timelineColor = '#ef4444';
        else if (timelinePct > 80) timelineColor = '#f59e0b';
    }

    const isCritical = task.priority === 'critical';
    const isOverdue = daysLeft !== null && daysLeft < 0 && task.status !== 'completed' && task.status !== 'cancelled';


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

    if (isMobile) {
        return (
            <React.Fragment key={task.id}>
                <div
                    onDoubleClick={() => onOpenModal(task)}
                    className={`flex flex-col gap-1.5 py-3 px-0 hover:bg-slate-800/10 transition-colors text-xs cursor-pointer border-b border-slate-800/30 bg-inherit
                        ${isCritical ? 'bg-[var(--bg-table-row-critical)] hover:bg-[var(--bg-table-row-critical-hover)]' : 'bg-[var(--bg-table-row)] hover:bg-[var(--bg-table-row-hover)]'}
                        ${isOverdue ? 'ring-1 ring-inset ring-rose-500/20' : ''}
                    `}
                >
                    {/* Renglón 1: Título de Tarea (Fijo horizontalmente con borde de prioridad) */}
                    <div 
                        className="sticky left-0 w-[calc(100vw-36px)] shrink-0 z-10 flex items-center gap-2 pl-5 pr-3 bg-inherit"
                        style={{ borderLeft: `3px solid ${isCritical ? '#ef4444' : groupColor}` }}
                    >
                        {/* Checkbox / Select */}
                        {isSelectionEnabled && (
                            <div className="shrink-0 flex items-center justify-center p-1" onClick={e => e.stopPropagation()}>
                                <input
                                    type="checkbox"
                                    checked={!!isSelected}
                                    onChange={() => onToggleSelect?.(task.id)}
                                    className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-violet-500 focus:ring-violet-500/30 cursor-pointer"
                                />
                            </div>
                        )}

                        {/* Chevron de Subtareas */}
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

                        {/* Título de la tarea */}
                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                            {canEdit ? (
                                <InlineEditText
                                    value={task.title || ''}
                                    onSave={v => saveField('title', v)}
                                    className={`text-sm font-semibold text-slate-200 whitespace-normal break-words ${isSaved('title') ? 'bg-emerald-500/10' : ''}`}
                                    placeholder="Sin título"
                                />
                            ) : (
                                <p className="text-sm font-semibold text-slate-200 whitespace-normal break-words">{task.title || 'Sin título'}</p>
                            )}

                            {/* Badge Subtareas */}
                            {totalSubs > 0 && (
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                                    subsPct === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/60 text-slate-400'
                                }`}>
                                    {doneSubs}/{totalSubs}
                                </span>
                            )}

                            {/* Badge Overdue */}
                            {isOverdue && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500 text-white animate-pulse shrink-0 flex items-center gap-1">
                                    <Calendar className="w-2.5 h-2.5" />
                                    {Math.abs(daysLeft)}d atraso
                                </span>
                            )}
                        </div>

                        {/* Comentarios Link / Icono */}
                        <div 
                            className="shrink-0 flex items-center justify-center text-slate-500 hover:text-slate-200 cursor-pointer p-1"
                            onClick={(e) => { e.stopPropagation(); onOpenModal(task); }}
                        >
                            <div className="relative">
                                <MessageSquare className="w-3.5 h-3.5" />
                                {commentCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-violet-600 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                                        {commentCount}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Renglón 2: Atributos en Grid (Desplazables horizontalmente de forma unificada) */}
                    <div 
                        className="grid items-center gap-2 text-center text-[10px] pl-6 pr-2 min-w-[1075px]"
                        style={{ gridTemplateColumns: MOBILE_GRID_COLS }}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                    >
                        {/* 1. Comentarios */}
                        <div 
                            className="flex flex-col gap-1 px-2 py-0.5 min-w-0 cursor-pointer hover:bg-slate-500/5 rounded-lg transition-colors text-left"
                            onClick={(e) => { e.stopPropagation(); onOpenModal(task); }}
                        >
                            {taskComments && taskComments.length > 0 ? (
                                <span className="text-[10px] text-[var(--text-secondary)] truncate">
                                    {taskComments[0].text}
                                </span>
                            ) : (
                                <span className="text-[10px] text-slate-600 italic select-none truncate">—</span>
                            )}
                        </div>

                        {/* 2. Resp */}
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

                        {/* 3. STN */}
                        <div className="flex items-center justify-center">
                            <StationCell task={task} canEdit={canEdit} onSave={v => saveField('stationId', v)} />
                        </div>

                        {/* 3. Estado */}
                        <div className="flex items-stretch p-0.5">
                            {canEdit ? (
                                <InlineDropdown
                                    value={task.status}
                                    options={statusOptions}
                                    onSelect={v => saveField('status', v)}
                                    renderValue={(val) => {
                                        const cfg = TASK_STATUS_CONFIG[val] || {};
                                        return (
                                            <div className="w-full h-full flex items-center justify-center rounded text-[9px] font-bold text-white text-center leading-tight min-h-[22px]"
                                                style={{ background: cfg.color || '#64748b' }}>
                                                {cfg.label || val}
                                            </div>
                                        );
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center rounded text-[9px] font-bold text-white text-center leading-tight min-h-[22px]"
                                    style={{ background: statusCfg.color || '#64748b' }}>
                                    {statusCfg.label || task.status}
                                </div>
                            )}
                        </div>

                        {/* 4. Área */}
                        <div className="min-w-0 overflow-hidden flex items-center justify-center">
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
                                        onSelect={v => saveField('workAreaTypeId', v || null)}
                                        renderValue={() => (
                                            <span className="text-[9px] text-slate-400 truncate block text-center">{wa?.name || '—'}</span>
                                        )}
                                    />
                                ) : (
                                    <span className="text-[9px] text-slate-400 truncate block text-center">{wa?.name || '—'}</span>
                                );
                            })()}
                        </div>

                        {/* 5. Tipo */}
                        <div className="min-w-0 overflow-hidden flex items-center justify-center">
                            {(() => {
                                const selectedArea = (workAreaTypes || []).find(a => a.id === task.workAreaTypeId);
                                const allowedValues = selectedArea?.defaultTaskTypes || [];
                                const filteredTypes = allowedValues.length > 0
                                    ? (taskTypes || []).filter(t => 
                                          allowedValues.includes(t.id) || 
                                          allowedValues.includes(t.name) || 
                                          (t.firestoreId && allowedValues.includes(t.firestoreId)) ||
                                          allowedValues.some(val => 
                                              (t.name && val?.toString().toLowerCase() === t.name.toLowerCase()) ||
                                              (t.firestoreId && val?.toString().toLowerCase() === t.firestoreId.toLowerCase())
                                          )
                                      )
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
                                            <span className="text-[9px] text-slate-400 truncate block text-center">{tt?.name || '—'}</span>
                                        )}
                                    />
                                ) : (
                                    <span className="text-[9px] text-slate-400 truncate block text-center">{tt?.name || '—'}</span>
                                );
                            })()}
                        </div>

                        {/* 6. Avance */}
                        <div className="flex items-center justify-center">
                            <div className="flex flex-col items-center gap-0.5 w-full px-1">
                                <span className="text-[9px] font-black" style={{ color: progressColor }}>{progressPct}%</span>
                                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: progressColor }} />
                                </div>
                            </div>
                        </div>

                        {/* 7. Timeline */}
                        <div className="min-w-0 overflow-hidden flex flex-col items-center justify-center gap-0.5">
                            <div className="flex items-center justify-center gap-1.5 text-[9px] min-w-0 w-full">
                                {canEdit ? (
                                    <>
                                        {(canEditDates || !startRaw) ? (
                                            <InlineDatePicker value={startRaw} onSave={v => saveField('plannedStartDate', v)} />
                                        ) : (
                                            <span className="text-slate-400 text-[9px] whitespace-nowrap">{fmtDate(startDate)}</span>
                                        )}
                                        <span className="text-slate-600 shrink-0">→</span>
                                        {(canEditDates || !endRaw) ? (
                                            <InlineDatePicker value={endRaw} onSave={v => saveField('dueDate', v)} />
                                        ) : (
                                            <span className="text-slate-400 text-[9px] whitespace-nowrap">{fmtDate(endDate)}</span>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-slate-400 truncate text-[9px] whitespace-nowrap">{fmtDate(startDate)} → {fmtDate(endDate)}</span>
                                )}
                            </div>
                        </div>

                        {/* 8. Horas */}
                        <div className="min-w-0 overflow-hidden flex flex-col items-center justify-center gap-0.5">
                            {(actual > 0 || estimated > 0) ? (
                                <div className="flex items-center justify-center gap-0.5 text-[9px] min-w-0 w-full">
                                    <span className="text-slate-400 font-bold shrink-0">{actual.toFixed(1)}h</span>
                                    <span className="text-slate-600 shrink-0">/</span>
                                    {canEdit ? (
                                        <InlineEditNumber value={estimated} onSave={v => saveField('estimatedHours', v)} />
                                    ) : (
                                        <span className="text-slate-400 shrink-0">{estimated}h</span>
                                    )}
                                </div>
                            ) : (
                                <span className="text-[9px] text-slate-600">—</span>
                            )}
                        </div>

                        {/* 9. Prioridad */}
                        <div className="flex items-stretch p-0.5">
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
                                            <div className="w-full h-full flex items-center justify-center rounded text-[9px] font-bold text-white text-center leading-tight min-h-[22px]"
                                                style={{ background: c }}>
                                                {cfg.label || val}
                                            </div>
                                        );
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center rounded text-[9px] font-bold text-white text-center leading-tight min-h-[22px]"
                                    style={{ background: { low: '#579bfc', medium: '#a25ddc', high: '#fdab3d', critical: '#e2445c' }[task.priority] || '#579bfc' }}>
                                    {(TASK_PRIORITY_CONFIG[task.priority] || {}).label || '—'}
                                </div>
                            )}
                        </div>

                        {/* 10. Asig. */}
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
                                            <div className="w-6 h-6 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center hover:bg-purple-600/40 transition-colors cursor-pointer" title={`Asignado por: ${assigner.displayName || assigner.email}`}>
                                                <span className="text-[8px] font-bold text-purple-400">{initials}</span>
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
                                    <div className="w-6 h-6 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center" title={`Asignado por: ${assigner.displayName || assigner.email}`}>
                                        <span className="text-[8px] font-bold text-purple-400">{initials}</span>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Subtareas */}
                    {expandedSubs && totalSubs > 0 && (
                        <div className="sticky left-0 w-[calc(100vw-36px)] shrink-0 z-10 pl-6 pr-3 bg-inherit">
                            <SubtaskExpander subtasks={subtasks} taskId={task.id} canEdit={canEdit} />
                        </div>
                    )}
                </div>
            </React.Fragment>
        );
    }

    return (
        <>
            <div
                onDoubleClick={() => onOpenModal(task)}
                className={`grid items-stretch px-2 py-1.5 transition-all duration-150 group/row min-w-[1130px]
                    ${!isLast ? 'border-b border-slate-800/30' : ''} 
                    ${isCritical ? 'bg-[var(--bg-table-row-critical)] hover:bg-[var(--bg-table-row-critical-hover)]' : 'bg-[var(--bg-table-row)] hover:bg-[var(--bg-table-row-hover)]'}
                    ${isOverdue ? 'ring-1 ring-inset ring-rose-500/20' : ''}
                `}
                style={{ 
                    gridTemplateColumns: GRID_COLS
                }}
            >

                {/* Columna de relleno para barra lateral del proyecto */}
                <div className="sticky left-0 z-10 bg-inherit" style={{ borderLeft: `3px solid ${isCritical ? '#ef4444' : groupColor}` }}></div>

                {/* Checkbox / Select */}
                <div className="sticky left-[30px] z-10 bg-inherit flex items-center justify-center" onClick={e => e.stopPropagation()}>
                    {isSelectionEnabled ? (
                        <input
                            type="checkbox"
                            checked={!!isSelected}
                            onChange={() => onToggleSelect?.(task.id)}
                            className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-violet-500 focus:ring-violet-500/30 cursor-pointer"
                        />
                    ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-700/60" />
                    )}
                </div>

                {/* Task Name + subtask chevron + subtask count badge */}
                <div className="sticky left-[58px] z-10 bg-inherit pr-1 min-w-0 flex items-center gap-1">
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
                                className={`text-sm font-semibold text-slate-200 whitespace-normal break-words ${isSaved('title') ? 'bg-emerald-500/10' : ''}`}
                                placeholder="Sin título"
                            />
                        ) : (
                            <p className="text-sm font-semibold text-slate-200 whitespace-normal break-words">{task.title || 'Sin título'}</p>
                        )}
                        {/* Subtask count badge — Monday.com style */}
                        {totalSubs > 0 && (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                                subsPct === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/60 text-slate-400'
                            }`}>
                                {doneSubs}/{totalSubs}
                            </span>
                        )}

                        {/* Overdue Badge */}
                        {isOverdue && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500 text-white animate-pulse shrink-0 flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" />
                                {Math.abs(daysLeft)}d atraso
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

                {/* Comentarios */}
                <div 
                    className="flex flex-col gap-1 px-2 py-1.5 min-w-0 cursor-pointer hover:bg-slate-500/5 dark:hover:bg-slate-700/10 rounded-lg transition-colors"
                    onClick={(e) => { e.stopPropagation(); onOpenModal(task); }}
                    title="Hacer clic para ver o agregar comentarios"
                >
                    {taskComments && taskComments.length > 0 ? (
                        taskComments.map((c, i) => {
                            const dateLabel = formatCommentDate(c.created_at);
                            return (
                                <div key={i} className="text-[11px] text-[var(--text-secondary)] break-words leading-tight">
                                    {dateLabel && <strong className="text-[var(--text-primary)] font-black mr-1">{dateLabel}:</strong>}
                                    <span>{c.text}</span>
                                </div>
                            );
                        })
                    ) : (
                        <span className="text-[11px] text-slate-500/50 italic select-none truncate">—</span>
                    )}
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
                                         const allowedValues = newArea?.defaultTaskTypes || [];
                                         const currentType = (taskTypes || []).find(t => t.id === task.taskTypeId);
                                         if (currentType && allowedValues.length > 0) {
                                             const isAllowed = allowedValues.includes(currentType.id) || 
                                                               allowedValues.includes(currentType.name) ||
                                                               (currentType.firestoreId && allowedValues.includes(currentType.firestoreId)) ||
                                                               allowedValues.some(val => 
                                                                   (currentType.name && val?.toString().toLowerCase() === currentType.name.toLowerCase()) ||
                                                                   (currentType.firestoreId && val?.toString().toLowerCase() === currentType.firestoreId.toLowerCase())
                                                               );
                                             if (!isAllowed) {
                                                 saveField('taskTypeId', null);
                                             }
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
                            ? (taskTypes || []).filter(t => 
                                  allowedValues.includes(t.id) || 
                                  allowedValues.includes(t.name) || 
                                  (t.firestoreId && allowedValues.includes(t.firestoreId)) ||
                                  allowedValues.some(val => 
                                      (t.name && val?.toString().toLowerCase() === t.name.toLowerCase()) ||
                                      (t.firestoreId && val?.toString().toLowerCase() === t.firestoreId.toLowerCase())
                                  )
                              )
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
                        {daysLeft !== null && task.status === 'completed' && (
                            <span className="text-[11px] font-bold shrink-0 px-1 rounded text-slate-500">✓</span>
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

function MobileTaskCard({ task, engProjects, teamMembers, subtasks, canEdit, onOpenModal, groupColor, taskTypes, workAreaTypes }) {
    const [expandedSubs, setExpandedSubs] = useState(false);

    const project = engProjects.find(p => p.id === task.projectId);
    const statusCfg = TASK_STATUS_CONFIG[task.status] || {};
    const priorityCfg = TASK_PRIORITY_CONFIG[task.priority] || {};
    
    const PRIORITY_DOT = {
        critical: 'bg-red-500',
        high:     'bg-amber-400',
        medium:   'bg-blue-400',
        low:      'bg-slate-500',
    };
    const priorityDot = PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium;

    const totalSubs = subtasks.length;
    const doneSubs = subtasks.filter(s => s.completed || s.done).length;

    const startRaw = task.plannedStartDate || task.createdAt;
    const endRaw = task.dueDate || task.plannedEndDate;
    const endDate = endRaw ? new Date(endRaw) : null;
    const now = new Date();

    let daysLeft = null;
    if (endDate) {
        daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    }

    const actual = task.actualHours || 0;
    const estimated = task.estimatedHours || 0;

    const fmtDate = (d) => d ? d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '';

    const owner = teamMembers.find(m => m.uid === task.assignedTo);
    const wa = (workAreaTypes || []).find(a => a.id === task.workAreaTypeId);
    const tt = (taskTypes || []).find(t => t.id === task.taskTypeId);

    return (
        <div
            className="bg-slate-800/40 border border-slate-700/30 hover:bg-slate-800/60 rounded-xl px-4 py-3 flex flex-col gap-1 transition-colors cursor-pointer"
            style={{ borderLeft: `3px solid ${groupColor}` }}
            onClick={() => onOpenModal(task)}
        >
            <div className="flex items-center gap-3">
                {/* Left Side: Priority dot and optional subtask toggle */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className={`w-2 h-2 rounded-full ${priorityDot}`} title={`Prioridad: ${priorityCfg.label || task.priority}`} />
                    {totalSubs > 0 && (
                        <button onClick={e => { e.stopPropagation(); setExpandedSubs(!expandedSubs); }} className="text-slate-500 hover:text-slate-300 shrink-0">
                            {expandedSubs ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                    )}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                    {/* Row 1: Categorization (Status, Project, Area, Classification) */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-450 font-bold mb-1">
                        {/* Status Badge */}
                        <span 
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shrink-0"
                            style={{ 
                                backgroundColor: (statusCfg.color || '#64748b') + '15', 
                                color: statusCfg.color || '#94a3b8', 
                                border: `1px solid ${(statusCfg.color || '#64748b')}25` 
                            }}
                        >
                            {statusCfg.label || task.status}
                        </span>

                        {/* Project Name */}
                        {project && (
                            <span className="text-slate-300 font-extrabold truncate max-w-[120px]" title={project.name}>
                                {project.name}
                            </span>
                        )}

                        {/* Area */}
                        {wa && (
                            <span className="text-teal-400 font-semibold">
                                · {wa.name}
                            </span>
                        )}

                        {/* Task Type */}
                        {tt && (
                            <span className="text-slate-400 font-medium">
                                · {tt.name}
                            </span>
                        )}
                    </div>

                    {/* Row 2: Planning & Status (Due Date, Subtasks, Hours) */}
                    {(endDate || totalSubs > 0 || actual > 0 || estimated > 0) && (
                        <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-slate-500 font-semibold mb-1">
                            {/* Due Date */}
                            {endDate && (
                                <span className={`inline-flex items-center gap-0.5 ${daysLeft !== null && daysLeft < 0 && task.status !== 'completed' ? 'text-red-400 font-bold' : 'text-slate-450'}`}>
                                    📅 {fmtDate(endDate)}
                                </span>
                            )}

                            {/* Subtasks Count */}
                            {totalSubs > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-slate-450">
                                    📋 {doneSubs}/{totalSubs} sub
                                </span>
                            )}

                            {/* Hours */}
                            {(actual > 0 || estimated > 0) && (
                                <span className="inline-flex items-center gap-0.5 text-slate-450">
                                    ⏱️ {actual.toFixed(1)}h/{estimated}h
                                </span>
                            )}
                        </div>
                    )}
                    
                    {/* Task Title */}
                    <p className="font-bold text-slate-100 text-sm break-words whitespace-normal">
                        {task.title || 'Sin título'}
                    </p>
                </div>

                {/* Right Side: Owner Avatar */}
                <div className="shrink-0 flex items-center ml-2">
                    {owner?.photoURL ? (
                        <img src={owner.photoURL} alt={owner.displayName || ''} className="w-6 h-6 rounded-full border border-slate-700" title={owner.displayName} />
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-indigo-600/70 border border-slate-700/50 flex items-center justify-center text-[10px] font-bold text-white uppercase" title={owner?.displayName || 'Sin asignar'}>
                            {(owner?.displayName || task.assignedTo || '?')[0]?.toUpperCase()}
                        </div>
                    )}
                </div>
            </div>

            {/* Subtasks expansion */}
            {expandedSubs && totalSubs > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-700/30" onClick={e => e.stopPropagation()}>
                    <SubtaskExpander subtasks={subtasks} taskId={task.id} canEdit={canEdit} />
                </div>
            )}
        </div>
    );
}

// ============================================================
// TABLE GROUP (responsive: grid on desktop, cards on mobile)
// ============================================================

function TableGroup({ isMobile, isSelectionEnabled, label, color, tasks, engProjects, engSubtasks, teamMembers, canEdit, canEditDates, onOpenModal, isExpanded, onToggle, savedField, onSaved, taskTypes, workAreaTypes, groupStatus, groupProjectId, user, selectedTaskIds, onToggleSelect, onTaskCreated, activeFilterProject, activeFilterAssignee, commentCounts, taskCommentsMap }) {
    const [addingTask, setAddingTask] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const addInputRef = useRef(null);

    const handleAddTask = async () => {
        if (!newTaskTitle.trim()) return;
        try {
            const taskData = { title: newTaskTitle.trim(), status: groupStatus || 'pending' };
            // When grouped by project, auto-assign projectId from the group
            if (groupProjectId) taskData.projectId = groupProjectId;
            else if (activeFilterProject) taskData.projectId = activeFilterProject;
            if (activeFilterAssignee && activeFilterAssignee !== 'my-team' && activeFilterAssignee !== '') {
                taskData.assignedTo = activeFilterAssignee;
            }
            const newId = await createTask(taskData, user?.uid);
            setNewTaskTitle('');
            if (newId && onTaskCreated) onTaskCreated(newId);
            setTimeout(() => addInputRef.current?.focus(), 50);
        } catch (err) {
            console.error('Failed to create task:', err);
            alert('No se pudo crear la tarea: ' + (err.message || 'Error desconocido'));
        }
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
        <div className="animate-in fade-in duration-200">
            {/* Sticky Group Header */}
            <div className="sticky top-[34px] left-0 z-10 w-full bg-slate-900/95 backdrop-blur-md border-b border-slate-800/40 py-1.5 pl-3 md:pl-[39px] pr-3 flex items-center justify-between">
                <button onClick={onToggle} className="flex items-center gap-2 text-left transition-colors group py-1">
                    {isExpanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
                        : <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
                    }
                    <span className="font-bold text-sm" style={{ color }}>{label}</span>
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700/50">
                        {tasks.length}
                    </span>
                </button>
            </div>

            {isExpanded && (
                <div className="divide-y divide-slate-800/20 relative">
                    {!isMobile && (
                        <div 
                            className="absolute left-0 top-0 bottom-0 w-[30px] z-15 flex flex-col items-center select-none pointer-events-none"
                            style={{ 
                                borderLeft: `3px solid ${color}`,
                                backgroundColor: `${color}0d`, // 5% opacity
                                borderRight: '1px solid rgba(148, 163, 184, 0.08)'
                            }}
                        >
                            <div className="sticky top-[68px] flex items-center justify-center h-[calc(100vh-140px)] w-full">
                                <span 
                                    className="whitespace-nowrap font-black text-[9px] tracking-[0.25em] uppercase"
                                    style={{ 
                                        writingMode: 'vertical-lr', 
                                        transform: 'rotate(180deg)',
                                        color: color
                                    }}
                                >
                                    {label}
                                </span>
                            </div>
                        </div>
                    )}
                    {/* Inline Add Task Row */}
                    {canEdit && (
                        isMobile ? (
                            <div
                                className="flex flex-col gap-1.5 py-3 px-0 border-b border-slate-800/30 bg-[var(--bg-table-row)] min-w-[1075px]"
                            >
                                <div 
                                    className="sticky left-0 w-[calc(100vw-36px)] shrink-0 z-10 flex items-center gap-2 pl-5 pr-3 bg-inherit"
                                    style={{ borderLeft: `3px solid ${color}` }}
                                >
                                    {addingTask ? (
                                        <div className="flex items-center gap-1 w-full animate-in fade-in duration-200">
                                            <input
                                                ref={addInputRef}
                                                value={newTaskTitle}
                                                onChange={e => setNewTaskTitle(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); if (e.key === 'Escape') { setAddingTask(false); setNewTaskTitle(''); } }}
                                                placeholder="Nombre de la nueva tarea..."
                                                className="flex-1 bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none"
                                                autoFocus
                                            />
                                            <button onClick={() => { setAddingTask(false); setNewTaskTitle(''); }} className="text-slate-600 hover:text-slate-400 shrink-0">
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
                        ) : (
                            <div
                                className="grid items-center px-2 py-1.5 border-b border-slate-800/30 bg-[var(--bg-table-row)] min-w-[1130px]"
                                style={{ gridTemplateColumns: GRID_COLS }}
                            >
                                <div className="sticky left-0 z-10 bg-[var(--bg-table-row)] h-full" style={{ borderLeft: `3px solid ${color}` }}></div>
                                <div className="sticky left-[30px] z-10 bg-[var(--bg-table-row)] h-full flex items-center justify-center"></div>
                                <div className="sticky left-[58px] z-10 bg-[var(--bg-table-row)] pr-1 min-w-0 flex items-center h-full">
                                    {addingTask ? (
                                        <div className="flex items-center gap-1 w-full">
                                            <input
                                                ref={addInputRef}
                                                value={newTaskTitle}
                                                onChange={e => setNewTaskTitle(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); if (e.key === 'Escape') { setAddingTask(false); setNewTaskTitle(''); } }}
                                                placeholder="Nombre de la nueva tarea..."
                                                className="flex-1 bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none"
                                                autoFocus
                                            />
                                            <button onClick={() => { setAddingTask(false); setNewTaskTitle(''); }} className="text-slate-600 hover:text-slate-400 shrink-0">
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
                                <div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>
                            </div>
                        )
                    )}

                    {/* Task Rows List */}
                    <div className={isMobile ? "divide-y divide-slate-800/20 min-w-[1075px]" : "min-w-[1100px] divide-y divide-slate-800/30"}>
                        {tasks.length === 0 ? (
                            <div className="px-4 py-5 text-center text-sm text-slate-600" style={{ borderLeft: `3px solid ${color}` }}>
                                Sin tareas
                            </div>
                        ) : (
                            tasks.map((task, idx) => (
                                <TaskRow
                                    key={task.id}
                                    isMobile={isMobile}
                                    isSelectionEnabled={isSelectionEnabled}
                                    task={task}
                                    engProjects={engProjects}
                                    teamMembers={teamMembers}
                                    subtasks={engSubtasks.filter(s => s.taskId === task.id)}
                                    canEdit={canEdit}
                                    canEditDates={canEditDates}
                                    onOpenModal={onOpenModal}
                                    groupColor={color}
                                    isLast={idx === tasks.length - 1}
                                    savedField={savedField}
                                    onSaved={onSaved}
                                    taskTypes={taskTypes}
                                    workAreaTypes={workAreaTypes}
                                    isSelected={selectedTaskIds?.has(task.id)}
                                    onToggleSelect={onToggleSelect}
                                    commentCount={commentCounts?.[task.id] || 0}
                                    taskComments={taskCommentsMap?.[task.id] || []}
                                />
                            ))
                        )}
                    </div>

                    {/* Group Summary Row — Monday.com style */}
                    {tasks.length > 0 && !isMobile && (
                        <div
                            className="grid items-center px-2 py-2 border-t border-slate-700/40 bg-[var(--bg-table-row-summary)] min-w-[1130px]"
                            style={{ gridTemplateColumns: GRID_COLS }}
                        >
                            <div className="sticky left-0 z-10 bg-[var(--bg-table-row-summary)] h-full flex items-center justify-center" style={{ borderLeft: `3px solid ${color}` }}></div> {/* 1. Relleno Proyecto */}
                            <div className="sticky left-[30px] z-10 bg-[var(--bg-table-row-summary)] h-full"></div> {/* 2. Checkbox */}
                            <div className="sticky left-[58px] z-10 bg-[var(--bg-table-row-summary)] h-full"></div> {/* 3. Task */}
                            <div></div> {/* 3. Comentarios placeholder */}
                            <div></div> {/* 4. Owner */}
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
            )}
        </div>
    );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function MainTable({ forceProjectId = null }) {
    const isEmbedded = !!forceProjectId;
    const { user } = useAuth();
    const { canEdit, canEditDates, canDelete } = useRole();
    const { 
        engProjects, engTasks, engSubtasks, teamMembers, taskTypes, workAreaTypes, delayCauses, refetch,
        taskSearch, setTaskSearch,
        taskFilterProject, setTaskFilterProject,
        taskFilterAssignee, setTaskFilterAssignee,
        taskFilterPriority, setTaskFilterPriority,
        taskFilterArea, setTaskFilterArea
    } = useEngineeringData();

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [isSelectionEnabled, setIsSelectionEnabled] = useState(false);

    // --- Comment counts and all comments per task (global query, single fetch with realtime subscription) ---
    const [commentCounts, setCommentCounts] = useState({});
    const [taskCommentsMap, setTaskCommentsMap] = useState({});
    useEffect(() => {
        const fetchAllComments = () => {
            supabase
                .from('task_comments')
                .select('task_id, text, user_name, created_at')
                .order('created_at', { ascending: true })
                .then(({ data }) => {
                    if (!data) return;
                    const counts = {};
                    const commentsMap = {};
                    data.forEach(row => {
                        counts[row.task_id] = (counts[row.task_id] || 0) + 1;
                        if (!commentsMap[row.task_id]) {
                            commentsMap[row.task_id] = [];
                        }
                        commentsMap[row.task_id].push({
                            text: row.text,
                            user_name: row.user_name,
                            created_at: row.created_at
                        });
                    });
                    setCommentCounts(counts);
                    setTaskCommentsMap(commentsMap);
                });
        };

        fetchAllComments();

        // Subscribe to real-time updates for task_comments
        const channel = supabase
            .channel('task_comments_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, () => {
                fetchAllComments();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [engTasks.length]);

    // --- Resource Assignments (team relationships) ---
    const [resourceAssignments, setResourceAssignments] = useState([]);
    useEffect(() => {
        getActiveAssignments().then(setResourceAssignments).catch(console.error);
    }, []);

    // Build the set of UIDs that belong to "my team"
    // Bidirectional: supervisor sees technicians, technician sees supervisor + fellow technicians
    const myTeamUids = useMemo(() => {
        const uid = user?.uid;
        if (!uid) return new Set();

        const uids = new Set([uid]); // always include myself

        // --- 1. HR Hierarchy (reportsTo) ---
        teamMembers.forEach(member => {
            const memberId = member.uid || member.id;
            // People reporting to me
            if (member.reportsTo === uid) uids.add(memberId);
            // The person I report to
            if (uid && memberId === uid && member.reportsTo) uids.add(member.reportsTo);
            // Also if I report to X, I want to see tasks of fellow people reporting to X
            const myInfo = teamMembers.find(m => (m.uid || m.id) === uid);
            if (myInfo && myInfo.reportsTo && member.reportsTo === myInfo.reportsTo) {
                uids.add(memberId);
            }
        });

        // --- 2. Operational Hierarchy (resourceAssignments) ---
        // A. I'm a supervisor → add all my technicians
        const myTechs = resourceAssignments.filter(a => a.engineerId === uid);
        myTechs.forEach(a => uids.add(a.technicianId));

        // B. I'm a technician → add my supervisor + fellow technicians under same supervisor
        const myAssignment = resourceAssignments.find(a => a.technicianId === uid);
        if (myAssignment) {
            uids.add(myAssignment.engineerId); // my supervisor
            // fellow technicians under the same supervisor
            resourceAssignments
                .filter(a => a.engineerId === myAssignment.engineerId)
                .forEach(a => uids.add(a.technicianId));
        }

        return uids;
    }, [user, resourceAssignments, teamMembers]);
    const { savedField, show: showSaved } = useSaveFeedback();

    const openNew = () => { setSelectedTask(null); setIsModalOpen(true); };
    const openTask = (task) => { setSelectedTask(task); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setSelectedTask(null); };

    const { pendingTransition, transitionError, isTransitioning, confirmTransition, cancelTransition } = useWorkflowTransition();

    // Recently created tasks bypass filters and sorting for 3 minutes (180000 ms)
    const [recentlyCreatedIds, setRecentlyCreatedIds] = useState(new Set());

    const handleTaskCreated = useCallback((newTaskId) => {
        if (!newTaskId) return;
        setRecentlyCreatedIds(prev => new Set(prev).add(newTaskId));
        // Remove grace after 3 minutes
        setTimeout(() => {
            setRecentlyCreatedIds(prev => {
                const next = new Set(prev);
                next.delete(newTaskId);
                return next;
            });
        }, 180000);
    }, []);

    const filteredTasks = useMemo(() => {
        return engTasks.filter(task => {
            // Grace period: always show recently created tasks
            if (recentlyCreatedIds.has(task.id)) return true;

            const s = taskSearch.toLowerCase();
            const matchSearch = !s || (task.title || '').toLowerCase().includes(s) || (task.description || '').toLowerCase().includes(s);
            const effectiveProjectFilter = forceProjectId || taskFilterProject;
            const matchProject = !effectiveProjectFilter || task.projectId === effectiveProjectFilter;

            let matchAssignee = true;
            if (taskFilterAssignee === 'my-team') {
                // Include tasks assigned to my team OR where I'm the assigned peer reviewer
                const isMyTeamTask = myTeamUids.has(task.assignedTo);
                const isMyPeerReview = task.peerReviewReviewerId === user?.uid
                    && ['requested', 'in_review', 'changes_requested'].includes(task.peerReviewStatus);
                matchAssignee = isMyTeamTask || isMyPeerReview;
            } else if (taskFilterAssignee !== '') {
                matchAssignee = task.assignedTo === taskFilterAssignee;
            }

            const matchPriority = !taskFilterPriority || task.priority === taskFilterPriority;
            const matchArea = !taskFilterArea || task.areaId === taskFilterArea || task.workAreaTypeId === taskFilterArea;
            return matchSearch && matchProject && matchAssignee && matchPriority && matchArea;
        });
    }, [engTasks, taskSearch, taskFilterProject, taskFilterAssignee, taskFilterPriority, taskFilterArea, myTeamUids, user, recentlyCreatedIds, forceProjectId]);

    // ── Group tasks by project ──
    const projectGroups = useMemo(() => {
        const map = {}; // projectId -> tasks[]
        filteredTasks.forEach(t => {
            const pid = t.projectId || '__none__';
            if (!map[pid]) map[pid] = [];
            map[pid].push(t);
        });
        // Sort tasks: recently created first (grace period), then by status (active first), then by priority
        const statusOrder = { in_progress: 0, pending: 1, backlog: 2, validation: 3, blocked: 4, completed: 5, cancelled: 6 };
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        Object.keys(map).forEach(key => {
            map[key].sort((a, b) => {
                const aRecent = recentlyCreatedIds.has(a.id);
                const bRecent = recentlyCreatedIds.has(b.id);
                if (aRecent && !bRecent) return -1;
                if (!aRecent && bRecent) return 1;

                const sa = statusOrder[a.status] ?? 3;
                const sb = statusOrder[b.status] ?? 3;
                if (sa !== sb) return sa - sb;
                return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
            });
        });
        // Build ordered array of groups, sorted by project name ("Sin Proyecto" last)
        const groups = Object.keys(map).map(pid => {
            const project = engProjects.find(p => p.id === pid);
            return {
                projectId: pid,
                label: project?.name || 'Sin Proyecto',
                color: pid === '__none__' ? '#64748b' : (project?.color || generateProjectColor(project?.name || '')),
                tasks: map[pid],
            };
        });
        groups.sort((a, b) => {
            if (a.projectId === '__none__') return 1;
            if (b.projectId === '__none__') return -1;
            return a.label.localeCompare(b.label);
        });
        return groups;
    }, [filteredTasks, engProjects, recentlyCreatedIds]);

    // Auto-expand groups with tasks, collapse empty ones
    const dataLoadedRef = useRef(false);
    useEffect(() => {
        if (engTasks.length === 0) return;
        dataLoadedRef.current = true;
        const ns = {};
        projectGroups.forEach(g => {
            ns[g.projectId] = g.tasks.length === 0; // collapsed=true only if empty
        });
        const timer = setTimeout(() => setCollapsedGroups(ns), 0);
        return () => clearTimeout(timer);
    }, [projectGroups]);  

    const toggleGroup = (key) => setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
    const activeFilterCount = [taskSearch, taskFilterProject, taskFilterAssignee, taskFilterPriority, taskFilterArea].filter(Boolean).length;
    const activeDropdownFilterCount = [taskFilterProject, taskFilterAssignee, taskFilterPriority, taskFilterArea].filter(Boolean).length;

    const [isExporting, setIsExporting] = useState(false);
    const handleExport = useCallback(() => {
        setIsExporting(true);
        setTimeout(() => {
            try {
                exportMainTableToExcel({
                    tasks: filteredTasks,
                    engProjects,
                    teamMembers,
                    taskTypes,
                    workAreaTypes,
                    engSubtasks,
                });
            } catch (err) {
                console.error('Export failed:', err);
            } finally {
                setIsExporting(false);
            }
        }, 80);
    }, [filteredTasks, engProjects, teamMembers, taskTypes, workAreaTypes, engSubtasks]);

    // ── Task Selection + AI Improvement ──
    const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiModalOpen, setAiModalOpen] = useState(false);

    const toggleSelectTask = useCallback((taskId) => {
        setSelectedTaskIds(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    }, []);

    const handleImproveWithAI = useCallback(async () => {
        const selected = filteredTasks.filter(t => selectedTaskIds.has(t.id));
        if (selected.length === 0) return;
        setAiModalOpen(true);
        setAiLoading(true);
        setAiSuggestions([]);
        try {
            const fn = httpsCallable(functions, 'improveTaskDescriptions');
            const tasksPayload = selected.map(t => {
                const area = (workAreaTypes || []).find(a => a.id === t.workAreaTypeId);
                const tipo = (taskTypes || []).find(tt => tt.id === t.taskTypeId);
                const proj = (engProjects || []).find(p => p.id === t.projectId);
                return {
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    area: area?.name || '',
                    taskType: tipo?.name || '',
                    project: proj?.name || '',
                };
            });
            const result = await fn({ tasks: tasksPayload });
            setAiSuggestions(result.data.suggestions || []);
        } catch (err) {
            console.error('AI improvement failed:', err);
        } finally {
            setAiLoading(false);
        }
    }, [filteredTasks, selectedTaskIds, workAreaTypes, taskTypes, engProjects]);

    const handleApplyAiSuggestions = useCallback(async (updates) => {
        for (const u of updates) {
            await updateTask(u.id, { title: u.title, description: u.description });
        }
        refetch?.('tasks');
        setSelectedTaskIds(new Set());
    }, [refetch]);

    return (
        <div 
            className={isEmbedded ? 'flex flex-col flex-1 min-h-0 h-full' : '-m-4 md:-m-8 flex flex-col'} 
            style={{ 
                background: isEmbedded ? 'var(--bg-card)' : 'var(--bg-app)', 
                color: 'var(--text-primary)', 
                minHeight: isEmbedded ? 'auto' : '100vh',
                height: isEmbedded ? '100%' : 'auto'
            }}
        >
            <TaskDetailModal isOpen={isModalOpen} onClose={closeModal} task={selectedTask} projects={engProjects} teamMembers={teamMembers}
                subtasks={selectedTask ? engSubtasks.filter(s => s.taskId === selectedTask.id) : []} taskTypes={taskTypes} userId={user?.uid} canEdit={canEdit} canDelete={canDelete} />
            <TransitionConfirmModal isOpen={!!pendingTransition} pending={pendingTransition} isTransitioning={isTransitioning} onConfirm={confirmTransition} onCancel={cancelTransition} delayCauses={delayCauses} teamMembers={teamMembers} />
            <AiReviewModal
                isOpen={aiModalOpen}
                onClose={() => { setAiModalOpen(false); setAiSuggestions([]); }}
                suggestions={aiSuggestions}
                isLoading={aiLoading}
                onApply={handleApplyAiSuggestions}
            />

            {transitionError && (
                <div className="fixed bottom-24 md:bottom-4 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-4">
                    {transitionError}
                </div>
            )}

            {!isEmbedded && <TaskModuleBanner onNewTask={canEdit ? openNew : null} canEdit={canEdit} />}


            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row md:items-center gap-2 px-6 py-2 border-b border-slate-800/40 bg-slate-900/20 backdrop-blur-sm">
                {/* Always Visible Row (Search, Toggle button, Export button on mobile) */}
                <div className="flex items-center gap-2 w-full md:w-auto md:flex-1">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="Buscar..."
                            className="pl-8 pr-3 py-1.5 w-full border border-slate-700/60 rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500/50 bg-slate-800/60 placeholder:text-slate-600" />
                    </div>

                    {/* Selection Mode Toggle Button */}
                    <button
                        onClick={() => {
                            setIsSelectionEnabled(!isSelectionEnabled);
                            if (isSelectionEnabled) {
                                setSelectedTaskIds(new Set());
                            }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all shrink-0 ${
                            isSelectionEnabled
                                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 font-bold'
                                : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-700/60'
                        }`}
                        title="Activar/Desactivar selección de tareas"
                    >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Seleccionar</span>
                    </button>

                    {/* Mobile Filter Toggle Button */}
                    <button
                        onClick={() => setShowMobileFilters(!showMobileFilters)}
                        className="flex md:hidden items-center gap-1.5 px-3 py-1.5 border border-slate-700/60 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800/60 hover:bg-slate-700/60 transition-colors"
                    >
                        <Filter className="w-3.5 h-3.5" />
                        <span>Filtros</span>
                        {activeDropdownFilterCount > 0 && (
                            <span className="flex items-center justify-center bg-indigo-500 text-white text-[9px] font-bold rounded-full h-4 min-w-4 px-1">
                                {activeDropdownFilterCount}
                            </span>
                        )}
                    </button>

                    {/* Mobile-only Export Button */}
                    <button
                        onClick={handleExport}
                        disabled={isExporting || filteredTasks.length === 0}
                        className="flex md:hidden items-center gap-1.5 px-3 py-1.5 border border-slate-700/60 rounded-lg text-xs font-semibold transition-all hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-400 bg-slate-800/60 ml-auto"
                        title={`Exportar ${filteredTasks.length} tareas a Excel`}
                    >
                        <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
                        <span>{isExporting ? '...' : 'Exportar'}</span>
                    </button>
                </div>

                {/* Dropdowns Container (collapsible on mobile, always flex on desktop) */}
                <div className={`${showMobileFilters ? 'flex animate-in slide-in-from-top-2 duration-200' : 'hidden'} md:flex flex-col md:flex-row flex-wrap items-stretch md:items-center gap-2 w-full md:w-auto`}>
                    {!isEmbedded && (
                        <select value={taskFilterProject} onChange={e => setTaskFilterProject(e.target.value)}
                            className="px-3 py-1.5 border border-slate-700/60 rounded-lg text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500/50 bg-slate-800/60 cursor-pointer w-full md:w-auto">
                            <option value="">Todos los proyectos</option>
                            {engProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    )}
                    <select value={taskFilterAssignee} onChange={e => setTaskFilterAssignee(e.target.value)}
                        className="px-3 py-1.5 border border-slate-700/60 rounded-lg text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500/50 bg-slate-800/60 cursor-pointer w-full md:w-auto">
                        <option value="my-team">Mis tareas y equipo</option>
                        <option value="">Todos los miembros</option>
                        {teamMembers.map(u => <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>)}
                    </select>
                    <select value={taskFilterArea} onChange={e => setTaskFilterArea(e.target.value)}
                        className="px-3 py-1.5 border border-slate-700/60 rounded-lg text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500/50 bg-slate-800/60 cursor-pointer w-full md:w-auto">
                        <option value="">Todas las áreas</option>
                        {workAreaTypes.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
                    </select>
                    <select value={taskFilterPriority} onChange={e => setTaskFilterPriority(e.target.value)}
                        className="px-3 py-1.5 border border-slate-700/60 rounded-lg text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500/50 bg-slate-800/60 cursor-pointer w-full md:w-auto">
                        <option value="">Todas las prioridades</option>
                        {Object.entries(TASK_PRIORITY_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                    </select>
                    {activeFilterCount > 0 && (
                        <button onClick={() => { setTaskSearch(''); setTaskFilterProject(''); setTaskFilterAssignee(''); setTaskFilterPriority(''); setTaskFilterArea(''); }}
                            className="text-[11px] text-rose-400 hover:text-rose-300 px-2 py-1.5 rounded hover:bg-rose-500/10 transition-colors w-full md:w-auto text-center border border-dashed border-rose-500/20 md:border-none">
                            Limpiar Filtros
                        </button>
                    )}
                </div>

                {/* Desktop-only Export Button */}
                <button
                    onClick={handleExport}
                    disabled={isExporting || filteredTasks.length === 0}
                    className="hidden md:flex items-center gap-1.5 px-3 py-1.5 border border-slate-700/60 rounded-lg text-xs font-semibold transition-all hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-400 bg-slate-800/60 ml-auto"
                    title={`Exportar ${filteredTasks.length} tareas a Excel`}
                >
                    <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
                    <span>{isExporting ? 'Exportando...' : 'Exportar'}</span>
                </button>
            </div>



            <div className="flex-1 overflow-y-auto pb-4 px-6 pt-1">

                {/* Floating selection action bar */}
                {selectedTaskIds.size > 0 && (
                    <div
                        className="sticky top-0 z-30 flex items-center gap-3 rounded-xl px-4 py-2.5 mb-3 backdrop-blur-md shadow-lg border"
                        style={{
                            background: 'var(--bg-card, rgba(30,41,59,0.95))',
                            borderColor: 'var(--border-color, rgba(139,92,246,0.3))',
                            boxShadow: '0 4px 20px rgba(139,92,246,0.15)',
                        }}
                    >
                        <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                            <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                        </div>
                        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                            {selectedTaskIds.size} tarea{selectedTaskIds.size !== 1 ? 's' : ''} seleccionada{selectedTaskIds.size !== 1 ? 's' : ''}
                        </span>
                        <div className="flex-1" />
                        <button
                            onClick={handleImproveWithAI}
                            disabled={selectedTaskIds.size > 20}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-40"
                        >
                            <Sparkles className="w-3.5 h-3.5" /> Mejorar Descripción
                        </button>
                        <button
                            onClick={() => setSelectedTaskIds(new Set())}
                            className="text-[11px] px-2 py-1 rounded transition-colors"
                            style={{ color: 'var(--text-secondary, #94a3b8)' }}
                            onMouseEnter={e => { e.target.style.color = '#f87171'; e.target.style.background = 'rgba(239,68,68,0.1)'; }}
                            onMouseLeave={e => { e.target.style.color = 'var(--text-secondary, #94a3b8)'; e.target.style.background = 'transparent'; }}
                        >
                            Deseleccionar
                        </button>
                    </div>
                )}

                {/* Scrollable Table Container */}
                <div className="flex-1 overflow-auto max-h-[75vh] border border-slate-800/50 bg-slate-800/5 rounded-xl">
                    {/* Global columns header */}
                    {isMobile ? (
                        <div
                            className="grid items-center gap-2 text-center text-[9px] font-black text-slate-500 uppercase tracking-[0.12em] border-b border-slate-800/50 bg-[var(--bg-table-header-solid)] h-[34px] py-0 pl-6 pr-2 min-w-[1075px] sticky top-0 z-20"
                            style={{ gridTemplateColumns: MOBILE_GRID_COLS }}
                        >
                            <div className="text-left">Comentarios</div>
                            <div>Resp</div>
                            <div>STN</div>
                            <div>Estado</div>
                            <div>Área</div>
                            <div>Tipo</div>
                            <div>Avance</div>
                            <div>Timeline</div>
                            <div>Horas</div>
                            <div>Prioridad</div>
                            <div className="text-right pr-2">Asig.</div>
                        </div>
                    ) : (
                        <div
                            className="grid items-center px-2 text-[9px] font-black text-slate-500 uppercase tracking-[0.12em] border-b border-slate-800/50 bg-[var(--bg-table-header-solid)] text-center sticky top-0 z-20 min-w-[1130px] h-[34px] py-0"
                            style={{ gridTemplateColumns: GRID_COLS }}
                        >
                            <div className="sticky left-0 z-20 bg-[var(--bg-table-header-solid)] border-b border-slate-800/50 h-full w-full"></div>
                            <div className="sticky left-[30px] z-20 bg-[var(--bg-table-header-solid)] flex items-center justify-center h-full">
                                {isSelectionEnabled && (
                                    <input
                                        type="checkbox"
                                        checked={filteredTasks.length > 0 && filteredTasks.every(t => selectedTaskIds?.has(t.id))}
                                        onChange={() => {
                                            const allSelected = filteredTasks.every(t => selectedTaskIds?.has(t.id));
                                            const next = new Set(selectedTaskIds);
                                            filteredTasks.forEach(t => {
                                                if (allSelected) next.delete(t.id);
                                                else next.add(t.id);
                                            });
                                            setSelectedTaskIds(next);
                                        }}
                                        className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-violet-500 focus:ring-violet-500/30 cursor-pointer"
                                        title="Seleccionar todas las tareas"
                                    />
                                )}
                            </div>
                            <div className="sticky left-[58px] z-20 text-left bg-[var(--bg-table-header-solid)] h-full flex items-center">Tarea</div>
                            <div className="text-left px-1 flex items-center gap-1" title="Comentarios">💬 Comentarios</div>
                            <div>Resp</div>
                            <div>STN</div>
                            <div>Estado</div>
                            <div>Área</div>
                            <div>Tipo</div>
                            <div>Avance</div>
                            <div>Timeline</div>
                            <div>Horas</div>
                            <div>Prioridad</div>
                            <div>Asig.</div>
                        </div>
                    )}

                    <div className="divide-y divide-slate-800/30">
                        {projectGroups.map(group => {
                            return (
                                <TableGroup
                                    key={group.projectId}
                                    isMobile={isMobile}
                                    isSelectionEnabled={isSelectionEnabled}
                                    label={group.label}
                                    color={group.color}
                                    tasks={group.tasks}
                                    engProjects={engProjects}
                                    engSubtasks={engSubtasks}
                                    teamMembers={teamMembers}
                                    canEdit={canEdit}
                                    canEditDates={canEditDates}
                                    onOpenModal={openTask}
                                    isExpanded={!collapsedGroups[group.projectId]}
                                    onToggle={() => toggleGroup(group.projectId)}
                                    savedField={savedField}
                                    onSaved={showSaved}
                                    taskTypes={taskTypes}
                                    workAreaTypes={workAreaTypes}
                                    groupStatus={'pending'}
                                    groupProjectId={group.projectId !== '__none__' ? group.projectId : null}
                                    user={user}
                                    selectedTaskIds={selectedTaskIds}
                                    onToggleSelect={toggleSelectTask}
                                    onTaskCreated={handleTaskCreated}
                                    activeFilterProject={taskFilterProject}
                                    activeFilterAssignee={taskFilterAssignee}
                                    commentCounts={commentCounts}
                                    taskCommentsMap={taskCommentsMap}
                                />
                            );
                        })}
                    </div>
                </div>

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
