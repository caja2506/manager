import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    User, CalendarDays, ExternalLink, Play, Square, Pause, 
    Check, AlertCircle, ChevronRight, MessageSquare, ChevronDown, Calendar, Plus
} from 'lucide-react';

// Task modals
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import WipBlockModal from '../components/tasks/WipBlockModal';

// Data hook
import { useMyWorkData } from '../hooks/useMyWorkData';

import { createPortal } from 'react-dom';
import { onProjectStations, hasMultipleIndexers } from '../services/stationService';

// Planner service & Supabase
import { plannerService } from '../services/plannerService';
import { supabase } from '../supabase';

// Services
import { updateTask, updateTaskStatus, toggleSubtask, createSubtask, createTask } from '../services/taskService';
import { 
    getActiveTimerFromLogs, formatElapsed, stopTimer, startTimerSafe, clearLegacyTimer 
} from '../services/timeService';

// Configurations
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG, formatStationLabel } from '../models/schemas';

// Greeting helper
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
}

const GRID_COLS = '28px minmax(200px, 1.2fr) minmax(120px, 1fr) 32px 50px 86px 68px 86px 56px minmax(105px, 140px) 76px 85px 60px';
const MOBILE_GRID_COLS = '140px 100px 95px 65px 86px 90px 100px 115px 85px 75px';

const PRIORITY_BADGES = {
    critical: { label: 'CRÍTICA', bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    high:     { label: 'ALTA',    bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
    medium:   { label: 'MEDIA',   bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
    low:      { label: 'BAJA',    bg: 'rgba(71, 85, 105, 0.15)',  text: '#94a3b8' },
};

// ============================================================
// INLINE EDITING COMPONENTS (FROM MAINTABLE)
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
                className={`cursor-text hover:bg-slate-850/60 rounded px-1 py-0.5 -mx-1 transition-colors ${className}`}
            >
                {value || <span className="text-slate-650 italic">{placeholder}</span>}
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
            className="w-full bg-slate-800 border border-indigo-500/50 rounded px-1.5 py-0.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500/50"
            placeholder={placeholder}
            aria-label={ariaLabel || placeholder}
        />
    );
}

function InlineDropdown({ value, options, onSelect, renderValue, className = '', triggerClassName = '' }) {
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
            <button
                ref={triggerRef}
                onClick={handleOpen}
                className={triggerClassName || "w-full h-full hover:bg-slate-850/60 rounded transition-colors flex items-center justify-center"}
            >
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
                className="cursor-text hover:bg-slate-850/60 rounded px-0.5 transition-colors text-slate-500"
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
            className="w-14 bg-slate-850 border border-indigo-500/50 rounded px-1 py-0.5 text-[10px] text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500/50"
        />
    );
}

function InlineDatePicker({ value, onSave, className = '' }) {
    const inputRef = useRef(null);
    const display = value ? new Date(value).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }).replace('.', '') : '—';

    return (
        <span className="relative" onClick={e => e.stopPropagation()}>
            <button
                onClick={() => inputRef.current?.showPicker?.()}
                className={className || "text-[10px] text-slate-450 hover:text-white hover:bg-slate-850/60 rounded px-0.5 transition-colors whitespace-nowrap"}
            >
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

const _stationCache = {};

function StationCell({ task, canEdit, onSave }) {
    const [stations, setStations] = useState(() => _stationCache[task.projectId] || []);

    useEffect(() => {
        let active = true;
        if (!task.projectId) {
            Promise.resolve().then(() => {
                if (active) setStations(prev => prev.length > 0 ? [] : prev);
            });
            return;
        }

        const cached = _stationCache[task.projectId];
        if (cached) {
            Promise.resolve().then(() => {
                if (active) setStations(prev => prev !== cached ? cached : prev);
            });
        }

        const unsub = onProjectStations(task.projectId, (data) => {
            if (active) {
                _stationCache[task.projectId] = data;
                setStations(data);
            }
        });
        return () => {
            active = false;
            unsub();
        };
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

function formatTimelineRange(startVal, endVal) {
    if (!startVal && !endVal) return '—';
    
    const getMonthName = (dStr) => {
        if (!dStr) return '';
        const d = new Date(dStr);
        if (isNaN(d.getTime())) return '';
        const m = d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '').trim();
        return m;
    };
    
    const getDay = (dStr) => {
        if (!dStr) return '';
        const d = new Date(dStr);
        if (isNaN(d.getTime())) return '';
        return d.getDate();
    };

    if (startVal && endVal) {
        const startDay = getDay(startVal);
        const endDay = getDay(endVal);
        const startMonth = getMonthName(startVal);
        const endMonth = getMonthName(endVal);
        
        if (startMonth === endMonth) {
            if (startDay === endDay) {
                return `${startDay} ${startMonth}`;
            }
            return `${startDay} - ${endDay} ${startMonth}`;
        } else {
            return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
        }
    }
    
    const singleDate = startVal || endVal;
    if (singleDate) {
        const day = getDay(singleDate);
        const month = getMonthName(singleDate);
        return `${day} ${month}`;
    }
    return '—';
}

export default function MyWork() {
    const { user } = useAuth();
    const { canEdit, canDelete } = useRole();
    const {
        engTasks, engProjects, engSubtasks,
        taskTypes, teamMembers, timeLogs, delayCauses,
        workAreaTypes,
        refetch: refetchTable,
    } = useEngineeringData();

    // Detectar si es dispositivo móvil
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // ── Weekly plan items ──
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const [weekPlanItems, setWeekPlanItems] = useState([]);

    useEffect(() => {
        plannerService.getWeeklyPlanItems(weekStartStr)
            .then(setWeekPlanItems)
            .catch(console.error);
    }, [weekStartStr]);

    const itemsInCreationRef = useRef(new Set());

    // ── Quick add task states ──
    const [quickTitle, setQuickTitle] = useState('');
    const [quickProjectId, setQuickProjectId] = useState('');
    const [quickStationId, setQuickStationId] = useState('');
    const [quickStatus, setQuickStatus] = useState('pending');
    const [quickTaskTypeId, setQuickTaskTypeId] = useState('');
    const [quickDueDate, setQuickDueDate] = useState('');
    const [quickEstimatedHours, setQuickEstimatedHours] = useState('');
    const [quickPriority, setQuickPriority] = useState('medium');
    const [quickStations, setQuickStations] = useState([]);
    const [quickWorkAreaTypeId, setQuickWorkAreaTypeId] = useState('');

    const filteredQuickTaskTypes = useMemo(() => {
        if (!quickWorkAreaTypeId) return taskTypes || [];
        const selectedArea = (workAreaTypes || []).find(a => a.id === quickWorkAreaTypeId);
        const allowedValues = selectedArea?.defaultTaskTypes || [];
        if (allowedValues.length === 0) return taskTypes || [];
        return (taskTypes || []).filter(t => 
            allowedValues.includes(t.id) || 
            allowedValues.includes(t.name) || 
            (t.firestoreId && allowedValues.includes(t.firestoreId)) ||
            allowedValues.some(val => 
                (t.name && val?.toString().toLowerCase() === t.name.toLowerCase()) ||
                (t.firestoreId && val?.toString().toLowerCase() === t.firestoreId.toLowerCase())
            )
        );
    }, [quickWorkAreaTypeId, taskTypes, workAreaTypes]);

    // Clear quickTaskTypeId if it becomes invalid under new area
    useEffect(() => {
        if (!quickTaskTypeId) return;
        const isValid = filteredQuickTaskTypes.some(t => t.id === quickTaskTypeId);
        if (!isValid) {
            setQuickTaskTypeId('');
        }
    }, [filteredQuickTaskTypes, quickTaskTypeId]);

    // Auto-fetch stations for the selected project in quick task creator
    useEffect(() => {
        if (!quickProjectId) {
            setQuickStations([]);
            setQuickStationId('');
            return;
        }
        const unsub = onProjectStations(quickProjectId, (data) => {
            setQuickStations(data.filter(s => s.active !== false));
        });
        return unsub;
    }, [quickProjectId]);

    const handleQuickAddTask = async () => {
        if (!quickTitle.trim()) return;
        try {
            const taskData = {
                title: quickTitle.trim(),
                projectId: quickProjectId || null,
                stationId: quickStationId || null,
                workAreaTypeId: quickWorkAreaTypeId || null,
                status: quickStatus || 'pending',
                taskTypeId: quickTaskTypeId || null,
                dueDate: quickDueDate || null,
                estimatedHours: quickEstimatedHours ? parseFloat(quickEstimatedHours) : null,
                priority: quickPriority || 'medium',
                assignedTo: user?.uid, // Automatically assigned to current user
            };
            await createTask(taskData, user?.uid);
            
            // Reset fields
            setQuickTitle('');
            setQuickStationId('');
            setQuickWorkAreaTypeId('');
            setQuickTaskTypeId('');
            setQuickDueDate('');
            setQuickEstimatedHours('');
            setQuickPriority('medium');
            setQuickStatus('pending');

            // Refetch
            refetchTable('tasks');
        } catch (err) {
            console.error('Failed to create quick task:', err);
            alert('No se pudo crear la tarea: ' + (err.message || 'Error desconocido'));
        }
    };

    // ── One-time cleanup of legacy localStorage timer ──
    useEffect(() => {
        clearLegacyTimer();
    }, []);

    // ── Autocuración de Borradores de Tiempos Faltantes ──
    useEffect(() => {
        if (!user?.uid || !weekPlanItems.length || !timeLogs || !timeLogs.length) return;

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        
        const todayUserPlanItems = weekPlanItems.filter(pi => 
            pi.date === todayStr && 
            pi.assignedTo === user.uid &&
            pi.startDateTime &&
            pi.endDateTime
        );

        const missingItems = todayUserPlanItems.filter(pi => {
            const hasLog = timeLogs.some(log => log.planItemId === pi.id);
            const isCreating = itemsInCreationRef.current.has(pi.id);
            return !hasLog && !isCreating;
        });

        if (missingItems.length > 0) {
            console.log(`[MyWork] Autocuración: Detectados ${missingItems.length} bloques planificados sin logs. Creándolos...`);
            
            missingItems.forEach(item => itemsInCreationRef.current.add(item.id));

            const createMissingDrafts = async () => {
                const { getEffectiveHours } = await import('../utils/breakTimeUtils');
                
                let createdAny = false;
                for (const item of missingItems) {
                    const start = new Date(item.startDateTime);
                    const end = new Date(item.endDateTime);
                    const totalMs = end - start;
                    const totalHoursGross = parseFloat((totalMs / 3600000).toFixed(6));
                    let totalHours = getEffectiveHours(start, end);
                    if (totalHours < 0.016666) totalHours = 0.016666;
                    const breakHoursDeducted = parseFloat((totalHoursGross - totalHours).toFixed(4));

                    try {
                        const { error } = await supabase
                            .from('time_logs')
                            .insert({
                                task_id: item.taskId || null,
                                project_id: item.projectId || null,
                                user_id: item.assignedTo || null,
                                start_time: item.startDateTime,
                                end_time: item.endDateTime,
                                total_hours: totalHours,
                                total_hours_gross: totalHoursGross,
                                break_hours_deducted: breakHoursDeducted,
                                overtime: false,
                                overtime_hours: 0,
                                notes: item.notes || 'Sugerido desde el planificador',
                                task_title: item.taskTitleSnapshot || item.taskTitle || '',
                                project_name: item.projectNameSnapshot || item.projectName || '',
                                display_name: item.assignedToName || '',
                                source: 'planner_suggestion',
                                plan_item_id: item.id,
                                status: 'draft',
                            });
                        
                        if (!error) {
                            createdAny = true;
                            console.log(`[MyWork] Borrador autocreado para item: ${item.id}`);
                        } else {
                            console.error(`[MyWork] Error al insertar borrador:`, error.message);
                            itemsInCreationRef.current.delete(item.id);
                        }
                    } catch (err) {
                        console.error(`[MyWork] Error en insert de autocuración:`, err);
                        itemsInCreationRef.current.delete(item.id);
                    }
                }

                if (createdAny) {
                    refetchTable('time_logs');
                }
            };

            createMissingDrafts();
        }
    }, [user, weekPlanItems, timeLogs, refetchTable]);

    // ── Derived data hook ──
    const myWorkData = useMyWorkData({
        engTasks,
        engProjects,
        engSubtasks,
        timeLogs,
        weekPlanItems,
        userId: user?.uid,
    });

    const { myTasks } = myWorkData;

    // ── Task Detail Modal state ──
    const [taskModalTask, setTaskModalTask] = useState(undefined); // undefined=closed, null=new, obj=edit
    const handleOpenTask = useCallback((task) => {
        setTaskModalTask(task || null);
    }, []);

    // ── Subtask expansion state ──
    const [expandedTaskIds, setExpandedTaskIds] = useState(new Set());
    const toggleTaskExpanded = useCallback((taskId) => {
        setExpandedTaskIds(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    }, []);

    // ── WIP enforcement state ──
    const [wipModalOpen, setWipModalOpen] = useState(false);
    const [wipPendingTask, setWipPendingTask] = useState(null);
    const [wipPendingStatus, setWipPendingStatus] = useState(null);
    const [wipCurrentTask, setWipCurrentTask] = useState(null);
    const [wipSwitching, setWipSwitching] = useState(false);

    // ── Active Timer & tick ──
    const activeTimer = getActiveTimerFromLogs(timeLogs, user?.uid);
    const [elapsed, setElapsed] = useState('0:00:00');
    const [isStopping, setIsStopping] = useState(false);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (activeTimer?.startTime) {
            const tick = () => setElapsed(formatElapsed(activeTimer.startTime));
            tick();
            intervalRef.current = setInterval(tick, 1000);
            return () => clearInterval(intervalRef.current);
        } else {
            setElapsed('0:00:00');
        }
    }, [activeTimer?.startTime, activeTimer?.id]);

    // ── Timer stop helper ──
    const handleTimerStop = useCallback(async () => {
        if (!activeTimer) return;
        setIsStopping(true);
        try {
            await stopTimer(activeTimer.id);
            plannerService.getWeeklyPlanItems(weekStartStr)
                .then(setWeekPlanItems)
                .catch(console.error);
        } catch (e) {
            console.error('Error stopping timer:', e);
        }
        setIsStopping(false);
    }, [activeTimer, weekStartStr]);

    // ── Status change handler ──
    const handleStatusChange = useCallback(async (task, newStatus) => {
        if (newStatus === 'in_progress') {
            const inProgress = engTasks.filter(
                t => t.assignedTo === user?.uid && t.status === 'in_progress' && t.id !== task.id
            );
            if (inProgress.length > 0) {
                setWipCurrentTask(inProgress[0]);
                setWipPendingTask(task);
                setWipPendingStatus(newStatus);
                setWipModalOpen(true);
                return;
            }
        }
        try {
            await updateTaskStatus(task.id, newStatus, task.projectId);
            refetchTable('tasks');
        } catch (e) {
            console.error('Error updating status:', e);
            alert('No se pudo cambiar el estado: ' + (e.message || 'Error desconocido'));
        }
    }, [engTasks, user?.uid, refetchTable]);

    // ── WIP switch confirm ──
    const handleWipConfirm = useCallback(async (blockData) => {
        if (!wipCurrentTask || !wipPendingTask || !wipPendingStatus) return;
        setWipSwitching(true);
        try {
            await updateTaskStatus(
                wipCurrentTask.id,
                'blocked',
                wipCurrentTask.projectId,
                true,
                {
                    blockedReason: blockData.blockedReason,
                    blockedByUserId: blockData.blockedByUserId,
                    blockedByName: blockData.blockedByName,
                }
            );
            await updateTaskStatus(wipPendingTask.id, wipPendingStatus, wipPendingTask.projectId);

            // Iniciar timer en la nueva tarea si el cambio fue exitoso
            await startTimerSafe({
                taskId: wipPendingTask.id,
                projectId: wipPendingTask.projectId,
                userId: user?.uid,
                onConfirm: () => true
            });

            setWipModalOpen(false);
            setWipCurrentTask(null);
            setWipPendingTask(null);
            setWipPendingStatus(null);
            refetchTable('tasks');
        } catch (err) {
            console.error('WIP switch error:', err);
            alert('Error en cambio WIP: ' + (err.message || 'Error desconocido'));
        }
        setWipSwitching(false);
    }, [wipCurrentTask, wipPendingTask, wipPendingStatus, user?.uid, refetchTable]);

    // ── Timer Start helper ──
    const handleStartTimer = useCallback(async (task) => {
        if (!task) return;
        try {
            await startTimerSafe({
                taskId: task.id,
                projectId: task.projectId,
                userId: user?.uid,
                onConfirm: ({ activeTaskTitle, newTaskTitle }) =>
                    window.confirm(`Ya tienes un timer activo en "${activeTaskTitle}". ¿Detenerlo e iniciar "${newTaskTitle}"?`),
            });
        } catch (e) {
            console.error('Error starting timer:', e);
        }
    }, [user?.uid]);

    // ── Acciones Rápidas directas de la Tarjeta ──
    const handleStartTask = useCallback(async (task) => {
        if (task.status === 'blocked') {
            try {
                await updateTaskStatus(task.id, 'in_progress', task.projectId, false);
                await handleStartTimer(task);
                refetchTable('tasks');
            } catch (e) {
                console.error(e);
            }
        } else {
            await handleStatusChange(task, 'in_progress');
            await handleStartTimer(task);
        }
    }, [handleStatusChange, handleStartTimer, refetchTable]);

    const handlePauseTask = useCallback(async (task) => {
        if (activeTimer && activeTimer.taskId === task.id) {
            await handleTimerStop();
        }
        await handleStatusChange(task, 'pending');
    }, [activeTimer, handleTimerStop, handleStatusChange]);

    const handleCompleteTask = useCallback(async (task) => {
        if (activeTimer && activeTimer.taskId === task.id) {
            await handleTimerStop();
        }
        await handleStatusChange(task, 'completed');
    }, [activeTimer, handleTimerStop, handleStatusChange]);

    // ── Priority update handler ──
    const handlePriorityChange = useCallback(async (task, newPriority) => {
        try {
            await updateTask(task.id, { priority: newPriority });
            refetchTable('tasks');
        } catch (e) {
            console.error('Error updating priority:', e);
            alert('No se pudo cambiar la prioridad: ' + (e.message || 'Error desconocido'));
        }
    }, [refetchTable]);

    // ── Generic field update handler ──
    const saveField = useCallback(async (task, field, value) => {
        try {
            if (field === 'status') {
                await handleStatusChange(task, value);
            } else {
                await updateTask(task.id, { [field]: value });
                refetchTable('tasks');
            }
        } catch (e) {
            console.error(`Error al actualizar ${field}:`, e);
            alert('No se pudo actualizar el campo: ' + (e.message || 'Error desconocido'));
        }
    }, [handleStatusChange, refetchTable]);

    // ── Ordenar tareas por prioridad (Critical -> High -> Medium -> Low) ──
    const sortedTasks = useMemo(() => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return [...myTasks].sort((a, b) => {
            const pa = priorityOrder[a.priority] ?? 2;
            const pb = priorityOrder[b.priority] ?? 2;
            return pa - pb;
        });
    }, [myTasks]);

    // Lookup para render del cronómetro
    const activeTaskName = activeTimer?.taskId
        ? (myTasks.find(t => t.id === activeTimer.taskId)?.title || activeTimer.taskTitle || 'Tarea activa')
        : null;

    const todayLabel = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });
    const userName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'ahí';

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-sm md:text-base font-bold text-slate-200 capitalize leading-tight">
                            {getGreeting()}, {userName}
                        </p>
                        <p className="text-xs font-bold text-slate-450 mt-0.5">
                            {todayLabel}
                        </p>
                    </div>
                </div>

                {/* Cabecera Central: Mini Timer Activo */}
                {activeTimer && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-md border-emerald-500/20">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-ping" />
                        <div className="text-[11px] font-black text-slate-300 truncate max-w-[150px] md:max-w-[280px]">
                            Trabajando en: <span className="text-white font-bold">{activeTaskName}</span>
                        </div>
                        <div className="text-xs font-mono font-black text-emerald-400 shrink-0 border-l border-slate-800 pl-3">
                            {elapsed}
                        </div>
                        <button
                            onClick={handleTimerStop}
                            disabled={isStopping}
                            className="p-1 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded transition-all ml-1 shrink-0"
                            title="Detener Registro"
                        >
                            <Square className="w-3.5 h-3.5 fill-red-400" />
                        </button>
                    </div>
                )}

                <a
                    href="/planner"
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:text-indigo-400 text-slate-400 rounded-xl font-bold text-xs transition-all active:scale-95 self-start"
                >
                    <CalendarDays className="w-4 h-4" />
                    Planificador Semanal
                    <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>
            </div>

            {/* Layout de Columna Única: Tabla con diseño MainTable */}
            <div className="rounded-xl border border-slate-800/50 bg-slate-800/20 max-h-[78vh] overflow-auto">
                {isMobile ? (
                    <div
                        className="grid items-center gap-2 text-center text-[9px] font-black text-slate-500 uppercase tracking-[0.12em] border-b border-slate-800/50 bg-slate-900/90 py-2 pl-6 pr-2 min-w-[930px] sticky top-0 z-20"
                        style={{ gridTemplateColumns: MOBILE_GRID_COLS }}
                    >
                        <div className="text-left">Proyecto</div>
                        <div>Estado</div>
                        <div>Prioridad</div>
                        <div>STN</div>
                        <div>Área</div>
                        <div>Tipo</div>
                        <div>Avance</div>
                        <div>Timeline</div>
                        <div>Horas</div>
                        <div className="text-right pr-2">Timer</div>
                    </div>
                ) : (
                    <div
                        className="grid items-center px-2 py-2 text-[9px] font-black text-slate-500 uppercase tracking-[0.12em] border-b border-slate-800/50 bg-slate-900/90 text-center sticky top-0 z-20 min-w-[1100px]"
                        style={{ gridTemplateColumns: GRID_COLS }}
                    >
                        <div className="sticky left-0 z-10 bg-slate-900 h-full flex items-center justify-center border-l-3 border-l-slate-700"></div>
                        <div className="sticky left-[28px] z-10 text-left bg-slate-900 h-full flex items-center">Tarea</div>
                        <div className="text-left px-2">Proyecto</div>
                        <div className="text-center">💬</div>
                        <div>STN</div>
                        <div>Área</div>
                        <div>Tipo</div>
                        <div>Estado</div>
                        <div>Avance</div>
                        <div>Timeline</div>
                        <div>Horas</div>
                        <div>Prioridad</div>
                        <div className="text-right pr-2">Acciones</div>
                    </div>
                )}

                <div className={isMobile ? "divide-y divide-slate-800/20 min-w-[930px]" : "min-w-[1100px] divide-y divide-slate-800/30"}>
                    {/* Fila de Creación Rápida */}
                    {canEdit && (
                        isMobile ? (
                            <div className="flex flex-col gap-1.5 py-3 px-0 border-b border-slate-850 bg-slate-900/40 text-xs min-w-[930px]">
                                {/* Row 1: Title & Button */}
                                <div className="sticky left-0 w-[calc(100vw-36px)] shrink-0 z-10 flex items-center gap-2 pl-5 pr-3 bg-inherit">
                                    <Plus className="w-4 h-4 text-indigo-400 shrink-0" />
                                    <input
                                        type="text"
                                        placeholder="Nombre de la nueva tarea..."
                                        value={quickTitle}
                                        onChange={e => setQuickTitle(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleQuickAddTask(); }}
                                        className="flex-1 bg-slate-800 border border-slate-700/50 rounded px-2 py-1 text-slate-200 outline-none text-xs"
                                    />
                                    <button
                                        onClick={handleQuickAddTask}
                                        disabled={!quickTitle.trim() || !quickProjectId}
                                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded font-bold text-[11px] transition-all shrink-0"
                                    >
                                        Crear
                                    </button>
                                </div >
                                <div
                                    className="grid items-stretch gap-2 text-center text-[10px] pl-6 pr-2 min-w-[930px] mt-1"
                                    style={{ gridTemplateColumns: MOBILE_GRID_COLS }}
                                >
                                    {/* 1. Proyecto */}
                                    <div className="text-left flex items-center h-full py-1.5">
                                        <InlineDropdown
                                            value={quickProjectId}
                                            options={engProjects.map(p => ({ value: p.id, label: p.name }))}
                                            onSelect={v => setQuickProjectId(v)}
                                            renderValue={(val) => {
                                                const pObj = engProjects.find(p => p.id === val);
                                                return (
                                                    <span className={`text-[9px] font-black px-2 py-0.5 bg-slate-900 border border-slate-800 rounded whitespace-nowrap ${val ? 'text-indigo-400' : 'text-slate-500'}`}>
                                                        {pObj?.name || 'Proyecto...'}
                                                    </span>
                                                );
                                            }}
                                        />
                                    </div>
                                    {/* 2. Estado */}
                                    <div className="w-full h-full flex items-stretch">
                                        <InlineDropdown
                                            value={quickStatus}
                                            options={Object.entries(TASK_STATUS_CONFIG)
                                                .filter(([k]) => k !== 'backlog')
                                                .map(([k, cfg]) => ({ value: k, label: cfg.label, color: cfg.color }))}
                                            onSelect={v => setQuickStatus(v)}
                                            triggerClassName="w-full h-full flex items-center justify-center transition-all hover:brightness-110"
                                            renderValue={(val) => {
                                                const cfg = TASK_STATUS_CONFIG[val] || {};
                                                return (
                                                    <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white text-center leading-tight py-1.5 px-1"
                                                        style={{ background: cfg.color || '#64748b' }}>
                                                        {cfg.label || val}
                                                    </div>
                                                );
                                            }}
                                        />
                                    </div>
                                    {/* 3. Prioridad */}
                                    <div className="w-full h-full flex items-stretch">
                                        <InlineDropdown
                                            value={quickPriority}
                                            options={Object.entries(TASK_PRIORITY_CONFIG).map(([k, cfg]) => ({ value: k, label: cfg.label, color: cfg.color || '#64748b' }))}
                                            onSelect={v => setQuickPriority(v)}
                                            triggerClassName="w-full h-full flex items-center justify-center transition-all hover:brightness-110"
                                            renderValue={(val) => {
                                                const colors = { low: '#579bfc', medium: '#a25ddc', high: '#fdab3d', critical: '#e2445c' };
                                                const c = colors[val] || '#579bfc';
                                                const cfg = TASK_PRIORITY_CONFIG[val] || {};
                                                return (
                                                    <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white text-center leading-tight py-1.5 px-1"
                                                        style={{ background: c }}>
                                                        {cfg.label || val}
                                                    </div>
                                                );
                                            }}
                                        />
                                    </div>
                                    {/* 4. STN */}
                                    <div className="flex items-center justify-center h-full py-1.5 min-w-0">
                                        <InlineDropdown
                                            value={quickStationId}
                                            options={[
                                                { value: '', label: 'Sin estación' },
                                                ...quickStations.map(s => {
                                                    const label = formatStationLabel(s, hasMultipleIndexers(quickStations));
                                                    return { value: s.id, label: s.description ? `${label} — ${s.description}` : label };
                                                })
                                            ]}
                                            onSelect={v => setQuickStationId(v || '')}
                                            renderValue={(val) => {
                                                const sObj = quickStations.find(s => s.id === val);
                                                const label = sObj ? formatStationLabel(sObj, hasMultipleIndexers(quickStations)) : '';
                                                return (
                                                    <span className={`text-[9px] font-black truncate block text-center ${val ? 'text-cyan-400' : 'text-slate-500'}`}>
                                                        {label || 'STN...'}
                                                    </span>
                                                );
                                            }}
                                            className={!quickProjectId ? 'opacity-40 pointer-events-none' : ''}
                                        />
                                    </div>
                                    {/* 5. Área */}
                                    <div className="flex items-center justify-center h-full py-1.5 min-w-0">
                                        <InlineDropdown
                                            value={quickWorkAreaTypeId}
                                            options={[
                                                { value: '', label: 'Sin área' },
                                                ...(workAreaTypes || []).map(a => ({ value: a.id, label: a.name }))
                                            ]}
                                            onSelect={v => setQuickWorkAreaTypeId(v || '')}
                                            renderValue={(val) => {
                                                const aObj = (workAreaTypes || []).find(a => a.id === val);
                                                return (
                                                    <span className={`text-[9px] font-black truncate block text-center ${val ? 'text-slate-300' : 'text-slate-500'}`}>
                                                        {aObj?.name || 'Área...'}
                                                    </span>
                                                );
                                            }}
                                        />
                                    </div>
                                    {/* 6. Tipo */}
                                    <div className="flex items-center justify-center h-full py-1.5 min-w-0">
                                        <InlineDropdown
                                            value={quickTaskTypeId}
                                            options={[
                                                { value: '', label: 'Sin tipo' },
                                                ...filteredQuickTaskTypes.map(t => ({ value: t.id, label: t.name }))
                                            ]}
                                            onSelect={v => setQuickTaskTypeId(v || '')}
                                            renderValue={(val) => {
                                                const tObj = (taskTypes || []).find(t => t.id === val);
                                                return (
                                                    <span className={`text-[9px] font-black truncate block text-center ${val ? 'text-slate-350' : 'text-slate-500'}`}>
                                                        {tObj?.name || 'Tipo...'}
                                                    </span>
                                                );
                                            }}
                                        />
                                    </div>
                                    {/* 7. Avance */}
                                    <div className="text-center text-slate-650 h-full flex items-center justify-center py-1.5">—</div>
                                    {/* 8. Timeline */}
                                    <div className="min-w-0 overflow-hidden flex items-center justify-center h-full py-1.5">
                                        <div className="flex items-center justify-center gap-1 text-[8.5px] font-bold text-slate-400 bg-slate-900/40 px-1 py-0.5 rounded-full min-w-[90px] max-w-fit mx-auto h-fit self-center">
                                            <input
                                                type="date"
                                                value={quickDueDate}
                                                onChange={e => setQuickDueDate(e.target.value)}
                                                className="bg-transparent text-slate-200 focus:outline-none w-full text-center text-[9px] font-bold"
                                            />
                                        </div>
                                    </div>
                                    {/* 9. Horas */}
                                    <div className="flex items-center justify-center gap-0.5 text-[9px] min-w-0 w-full font-bold text-slate-355 h-full py-1.5">
                                        <input
                                            type="number"
                                            placeholder="Est."
                                            value={quickEstimatedHours}
                                            onChange={e => setQuickEstimatedHours(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700/50 rounded px-1 py-0.5 text-[9px] text-slate-300 focus:outline-none text-center"
                                            min="0"
                                            step="0.5"
                                        />
                                    </div>
                                    {/* 10. Acciones/Placeholder */}
                                    <div className="text-[9px] text-slate-500 italic select-none h-full flex items-center justify-center py-1.5">Fija ↑</div>
                                </div>
                            </div>
                        ) : (
                            <div
                                className="grid items-stretch px-2 py-0 border-b border-slate-850 bg-slate-900/40 text-center text-xs min-w-[1100px]"
                                style={{ gridTemplateColumns: GRID_COLS }}
                            >
                                <div className="sticky left-0 z-10 bg-slate-900 h-full flex items-center justify-center border-l-3 border-l-indigo-600">
                                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                                </div>
                                <div className="sticky left-[28px] z-10 bg-slate-900 pr-1 min-w-0 flex items-center h-full py-2">
                                    <input
                                        type="text"
                                        placeholder="Nombre de la nueva tarea..."
                                        value={quickTitle}
                                        onChange={e => setQuickTitle(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleQuickAddTask(); }}
                                        className="w-full bg-slate-850 border border-slate-700/55 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500/50"
                                    />
                                </div>
                                <div className="text-left px-2 flex items-center h-full py-2">
                                    <InlineDropdown
                                        value={quickProjectId}
                                        options={engProjects.map(p => ({ value: p.id, label: p.name }))}
                                        onSelect={v => setQuickProjectId(v)}
                                        renderValue={(val) => {
                                            const pObj = engProjects.find(p => p.id === val);
                                            return (
                                                <span className={`text-[10px] font-bold truncate block text-center ${val ? 'text-indigo-400' : 'text-slate-500'}`}>
                                                    {pObj?.name || 'Proyecto...'}
                                                </span>
                                            );
                                        }}
                                    />
                                </div>
                                <div className="text-center text-slate-600 h-full flex items-center justify-center py-2">—</div>
                                <div className="flex items-center justify-center h-full py-2 min-w-0">
                                    <InlineDropdown
                                        value={quickStationId}
                                        options={[
                                            { value: '', label: 'Sin estación' },
                                            ...quickStations.map(s => {
                                                const label = formatStationLabel(s, hasMultipleIndexers(quickStations));
                                                return { value: s.id, label: s.description ? `${label} — ${s.description}` : label };
                                            })
                                        ]}
                                        onSelect={v => setQuickStationId(v || '')}
                                        renderValue={(val) => {
                                            const sObj = quickStations.find(s => s.id === val);
                                            const label = sObj ? formatStationLabel(sObj, hasMultipleIndexers(quickStations)) : '';
                                            return (
                                                <span className={`text-[10px] font-bold truncate block text-center ${val ? 'text-cyan-400' : 'text-slate-500'}`}>
                                                    {label || 'STN...'}
                                                </span>
                                            );
                                        }}
                                        className={!quickProjectId ? 'opacity-40 pointer-events-none' : ''}
                                    />
                                </div>
                                <div className="flex items-center justify-center h-full py-2 min-w-0">
                                    <InlineDropdown
                                        value={quickWorkAreaTypeId}
                                        options={[
                                            { value: '', label: 'Sin área' },
                                            ...(workAreaTypes || []).map(a => ({ value: a.id, label: a.name }))
                                        ]}
                                        onSelect={v => setQuickWorkAreaTypeId(v || '')}
                                        renderValue={(val) => {
                                            const aObj = (workAreaTypes || []).find(a => a.id === val);
                                            return (
                                                <span className={`text-[10px] font-bold truncate block text-center ${val ? 'text-slate-300' : 'text-slate-500'}`}>
                                                    {aObj?.name || 'Área...'}
                                                </span>
                                            );
                                        }}
                                    />
                                </div>
                                <div className="flex items-center justify-center h-full py-2 min-w-0">
                                    <InlineDropdown
                                        value={quickTaskTypeId}
                                        options={[
                                            { value: '', label: 'Sin tipo' },
                                            ...filteredQuickTaskTypes.map(t => ({ value: t.id, label: t.name }))
                                        ]}
                                        onSelect={v => setQuickTaskTypeId(v || '')}
                                        renderValue={(val) => {
                                            const tObj = (taskTypes || []).find(t => t.id === val);
                                            return (
                                                <span className={`text-[10px] font-bold truncate block text-center ${val ? 'text-slate-350' : 'text-slate-500'}`}>
                                                    {tObj?.name || 'Tipo...'}
                                                </span>
                                            );
                                        }}
                                    />
                                </div>
                                <div className="w-full h-full flex items-stretch">
                                    <InlineDropdown
                                        value={quickStatus}
                                        options={Object.entries(TASK_STATUS_CONFIG)
                                            .filter(([k]) => k !== 'backlog')
                                            .map(([k, cfg]) => ({ value: k, label: cfg.label, color: cfg.color }))}
                                        onSelect={v => setQuickStatus(v)}
                                        triggerClassName="w-full h-full flex items-center justify-center transition-all hover:brightness-110"
                                        renderValue={(val) => {
                                            const cfg = TASK_STATUS_CONFIG[val] || {};
                                            return (
                                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white text-center leading-tight py-2 px-1"
                                                    style={{ background: cfg.color || '#64748b' }}>
                                                    {cfg.label || val}
                                                </div>
                                            );
                                        }}
                                    />
                                </div>
                                <div className="text-center text-slate-655 h-full flex items-center justify-center py-2">—</div>
                                <div className="flex items-center justify-center h-full py-2 min-w-[95px] max-w-fit mx-auto">
                                    <div className="flex items-center justify-center gap-1 text-[9px] font-bold text-slate-400 bg-slate-900/40 px-2 py-0.5 rounded-full">
                                        <input
                                            type="date"
                                            value={quickDueDate}
                                            onChange={e => setQuickDueDate(e.target.value)}
                                            className="bg-transparent text-slate-200 focus:outline-none w-full text-center text-[10px] font-bold"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-center h-full py-2">
                                    <input
                                        type="number"
                                        placeholder="Est."
                                        value={quickEstimatedHours}
                                        onChange={e => setQuickEstimatedHours(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700/50 rounded px-1 py-0.5 text-[10px] text-slate-300 focus:outline-none text-center"
                                        min="0"
                                        step="0.5"
                                    />
                                </div>
                                <div className="w-full h-full flex items-stretch">
                                    <InlineDropdown
                                        value={quickPriority}
                                        options={Object.entries(TASK_PRIORITY_CONFIG).map(([k, cfg]) => ({ value: k, label: cfg.label, color: cfg.color || '#64748b' }))}
                                        onSelect={v => setQuickPriority(v)}
                                        triggerClassName="w-full h-full flex items-center justify-center transition-all hover:brightness-110"
                                        renderValue={(val) => {
                                            const colors = { low: '#579bfc', medium: '#a25ddc', high: '#fdab3d', critical: '#e2445c' };
                                            const c = colors[val] || '#579bfc';
                                            const cfg = TASK_PRIORITY_CONFIG[val] || {};
                                            return (
                                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white text-center leading-tight py-2 px-1"
                                                    style={{ background: c }}>
                                                    {cfg.label || val}
                                                </div>
                                            );
                                        }}
                                    />
                                </div>
                                <div className="flex items-center justify-end h-full py-2 pr-1">
                                    <button
                                        onClick={handleQuickAddTask}
                                        disabled={!quickTitle.trim() || !quickProjectId}
                                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-655 text-white rounded text-[10px] font-bold transition-all"
                                    >
                                        Crear
                                    </button>
                                </div>
                            </div>
                        )
                    )}
                    {sortedTasks.map((task) => {
                        const isTaskActive = activeTimer?.taskId === task.id;
                        const isBlocked = task.status === 'blocked';
                        const isCritical = task.priority === 'critical';
                        const isExpanded = expandedTaskIds.has(task.id);
                        const taskSubtasks = task.subtasks || [];
                        
                        const project = engProjects.find(p => p.id === task.projectId);
                        const projectColor = project?.colorKey || '#6366f1';
                        
                        const statusCfg = TASK_STATUS_CONFIG[task.status] || {};

                        // Subtask progress
                        const totalSubs = task.subtasks?.length || 0;
                        const doneSubs = task.subtasks?.filter(s => s.completed || s.done).length || 0;
                        const subsPct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;

                        // Timeline calculate
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
                        const isOverdue = daysLeft !== null && daysLeft < 0 && task.status !== 'completed' && task.status !== 'cancelled';
                        const formattedDueDate = endDate ? endDate.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '—';

                        // % Avance
                        const progressPct = task.percentComplete != null 
                            ? Math.round(task.percentComplete) 
                            : (task.status === 'completed' ? 100 : subsPct);
                        const progressColor = progressPct === 100 ? '#22c55e' : progressPct >= 60 ? '#6366f1' : progressPct >= 30 ? '#f59e0b' : '#ef4444';

                        // Hours
                        const actual = task.actualHours || 0;
                        const estimated = task.estimatedHours || 0;

                        if (isMobile) {
                            return (
                                <React.Fragment key={task.id}>
                                    <div
                                        onDoubleClick={() => handleOpenTask(task)}
                                        className={`flex flex-col gap-1.5 py-3 px-0 hover:bg-slate-800/10 transition-colors text-xs cursor-pointer border-b border-slate-850 bg-inherit
                                            ${isTaskActive ? 'bg-indigo-500/5 hover:bg-indigo-500/10' : 'bg-slate-900/10'}
                                            ${isOverdue ? 'ring-1 ring-inset ring-rose-500/20' : ''}
                                        `}
                                    >
                                        {/* Renglón 1: Título de Tarea (Fijo horizontalmente con borde de prioridad) */}
                                        <div 
                                            className="sticky left-0 w-[calc(100vw-36px)] shrink-0 z-10 flex items-center gap-2 pl-5 pr-3 bg-inherit"
                                            style={{ borderLeft: `3px solid ${isCritical ? '#ef4444' : projectColor}` }}
                                        >
                                            {/* Chevron de Subtareas */}
                                            {totalSubs > 0 ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleTaskExpanded(task.id); }}
                                                    className="shrink-0 text-slate-500 hover:text-slate-200 transition-colors"
                                                    title={isExpanded ? 'Ocultar subtareas' : 'Ver subtareas'}
                                                >
                                                    {isExpanded
                                                        ? <ChevronDown className="w-3.5 h-3.5" />
                                                        : <ChevronRight className="w-3.5 h-3.5" />
                                                    }
                                                </button>
                                            ) : (
                                                <span className="w-3.5 shrink-0" />
                                            )}
 
                                            {/* Título de la tarea */}
                                            {canEdit ? (
                                                <InlineEditText
                                                    value={task.title || ''}
                                                    onSave={v => saveField(task, 'title', v)}
                                                    className="text-[12.5px] font-semibold text-slate-200 flex-1 whitespace-normal break-words py-1 pr-1"
                                                    placeholder="Sin título"
                                                />
                                            ) : (
                                                <span 
                                                    onClick={(e) => { e.stopPropagation(); handleOpenTask(task); }}
                                                    className="hover:text-indigo-400 font-semibold text-slate-200 flex-1 whitespace-normal break-words py-1 text-[12.5px] pr-1"
                                                >
                                                    {task.title || 'Sin título'}
                                                </span>
                                            )}
 
                                            {/* Badge Subtareas */}
                                            {totalSubs > 0 && (
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                                                    subsPct === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/60 text-slate-400'
                                                }`}>
                                                    {doneSubs}/{totalSubs}
                                                </span>
                                            )}
 
                                            {/* Badge Bloqueada */}
                                            {isBlocked && (
                                                <span className="text-[9px] font-black uppercase px-1 py-0.5 bg-red-600 text-white rounded shrink-0 scale-90">
                                                    Bloqueada
                                                </span>
                                            )}
 
                                            {/* Icono Comentarios */}
                                            <div 
                                                className="flex items-center justify-center text-slate-500 hover:text-slate-200 cursor-pointer p-1 shrink-0"
                                                onClick={(e) => { e.stopPropagation(); handleOpenTask(task); }}
                                                onDoubleClick={(e) => e.stopPropagation()}
                                            >
                                                <MessageSquare className="w-3.5 h-3.5" />
                                            </div>
 
                                            {/* Controles del timer (Acciones) */}
                                            <div className="flex items-center gap-1 shrink-0 ml-1" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                                                {isTaskActive ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleCompleteTask(task)}
                                                            className="p-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded transition-all"
                                                            title="Completar"
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handlePauseTask(task)}
                                                            className="p-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-750 rounded transition-all"
                                                            title="Pausar"
                                                        >
                                                            <Pause className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleStartTask(task)}
                                                        className={`p-1 rounded transition-all active:scale-95 text-white ${
                                                            isBlocked ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'
                                                        }`}
                                                        title={isBlocked ? 'Iniciar' : 'Iniciar'}
                                                    >
                                                        <Play className="w-3.5 h-3.5 fill-white" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Renglón 2: Atributos en Grid (Desplazables horizontalmente de forma unificada) */}
                                        <div 
                                            className="grid items-stretch gap-2 text-center text-[10px] pl-6 pr-2 min-w-[930px]"
                                            style={{ gridTemplateColumns: MOBILE_GRID_COLS }}
                                            onClick={(e) => e.stopPropagation()}
                                            onDoubleClick={(e) => e.stopPropagation()}
                                        >
                                            {/* Proyecto */}
                                            <div className="text-left flex items-center h-full py-1.5">
                                                {canEdit ? (
                                                    <InlineDropdown
                                                        value={task.projectId || ''}
                                                        options={engProjects.map(p => ({ value: p.id, label: p.name }))}
                                                        onSelect={v => saveField(task, 'projectId', v || null)}
                                                        renderValue={() => (
                                                            <span className="text-[9px] font-black px-2 py-0.5 bg-slate-900 border border-slate-800 rounded whitespace-nowrap" style={{ color: projectColor, borderColor: `${projectColor}30` }}>
                                                                {task.projectName}
                                                            </span>
                                                        )}
                                                    />
                                                ) : (
                                                    <span className="text-[9px] font-black px-2 py-0.5 bg-slate-900 border border-slate-800 rounded whitespace-nowrap" style={{ color: projectColor, borderColor: `${projectColor}30` }}>
                                                        {task.projectName}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Estado */}
                                            <div className="w-full h-full flex items-stretch">
                                                {canEdit ? (
                                                    <InlineDropdown
                                                        value={task.status}
                                                        options={Object.entries(TASK_STATUS_CONFIG)
                                                            .filter(([k]) => k !== 'backlog')
                                                            .map(([k, cfg]) => ({ value: k, label: cfg.label, color: cfg.color }))}
                                                        onSelect={v => handleStatusChange(task, v)}
                                                        triggerClassName="w-full h-full flex items-center justify-center transition-all hover:brightness-110"
                                                        renderValue={(val) => {
                                                            const cfg = TASK_STATUS_CONFIG[val] || {};
                                                            return (
                                                                <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white text-center leading-tight py-1.5 px-1"
                                                                    style={{ background: cfg.color || '#64748b' }}>
                                                                    {cfg.label || val}
                                                                </div>
                                                            );
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white text-center leading-tight py-1.5 px-1"
                                                        style={{ background: statusCfg.color || '#64748b' }}>
                                                        {statusCfg.label || task.status}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Prioridad */}
                                            <div className="w-full h-full flex items-stretch text-white">
                                                {canEdit ? (
                                                    <InlineDropdown
                                                        value={task.priority || 'medium'}
                                                        options={Object.entries(TASK_PRIORITY_CONFIG).map(([k, cfg]) => ({ value: k, label: cfg.label, color: cfg.color || '#64748b' }))}
                                                        onSelect={v => handlePriorityChange(task, v)}
                                                        triggerClassName="w-full h-full flex items-center justify-center transition-all hover:brightness-110"
                                                        renderValue={(val) => {
                                                            const colors = { low: '#579bfc', medium: '#a25ddc', high: '#fdab3d', critical: '#e2445c' };
                                                            const c = colors[val] || '#579bfc';
                                                            const cfg = TASK_PRIORITY_CONFIG[val] || {};
                                                            return (
                                                                <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white text-center leading-tight py-1.5 px-1"
                                                                    style={{ background: c }}>
                                                                    {cfg.label || val}
                                                                </div>
                                                            );
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white text-center leading-tight py-1.5 px-1"
                                                        style={{ background: { low: '#579bfc', medium: '#a25ddc', high: '#fdab3d', critical: '#e2445c' }[task.priority] || '#579bfc' }}>
                                                        {(TASK_PRIORITY_CONFIG[task.priority] || {}).label || '—'}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Estación (STN) */}
                                            <div className="flex items-center justify-center h-full py-1.5 min-w-0">
                                                <StationCell task={task} canEdit={canEdit} onSave={v => saveField(task, 'stationId', v)} />
                                            </div>

                                            {/* Área */}
                                            <div className="min-w-0 overflow-hidden flex items-center justify-center h-full py-1.5">
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
                                                                saveField(task, 'workAreaTypeId', v || null);
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
                                                                            saveField(task, 'taskTypeId', null);
                                                                        }
                                                                    }
                                                                }
                                                            }}
                                                            renderValue={() => (
                                                                <span className="text-[9px] text-slate-455 truncate block text-center font-semibold leading-tight">{wa?.name || '—'}</span>
                                                            )}
                                                        />
                                                    ) : (
                                                        <span className="text-[9px] text-slate-455 truncate block text-center">{wa?.name || '—'}</span>
                                                    );
                                                })()}
                                            </div>

                                            {/* Tipo */}
                                            <div className="min-w-0 overflow-hidden flex items-center justify-center h-full py-1.5">
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
                                                            onSelect={v => saveField(task, 'taskTypeId', v || null)}
                                                            renderValue={() => (
                                                                <span className="text-[9px] text-slate-455 truncate block text-center font-semibold leading-tight">{tt?.name || '—'}</span>
                                                            )}
                                                        />
                                                    ) : (
                                                        <span className="text-[9px] text-slate-455 truncate block text-center">{tt?.name || '—'}</span>
                                                    );
                                                })()}
                                            </div>

                                            {/* Avance */}
                                            <div className="flex items-center gap-1 px-1 h-full py-1.5">
                                                <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden shrink-0">
                                                    <div className="h-full rounded-full" style={{ width: `${progressPct}%`, backgroundColor: progressColor }} />
                                                </div>
                                                <span className="text-[8.5px] font-black text-slate-455">{progressPct}%</span>
                                            </div>

                                            {/* Timeline */}
                                            <div className="min-w-0 overflow-hidden flex items-center justify-center h-full py-1.5">
                                                <div className={`flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold shadow-sm transition-all select-none min-w-[90px] max-w-fit mx-auto
                                                    ${task.status === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-200'}`}
                                                >
                                                    {task.status === 'completed' && <Check className="w-2.5 h-2.5 text-white shrink-0 mr-0.5" />}
                                                    {canEdit ? (
                                                        <div className="flex items-center gap-0.5">
                                                            <InlineDatePicker
                                                                value={startRaw}
                                                                onSave={v => saveField(task, 'plannedStartDate', v)}
                                                                className="text-inherit hover:underline px-0.5 font-bold text-[9px]"
                                                            />
                                                            <span className="opacity-60 shrink-0 text-[8px]">-</span>
                                                            <InlineDatePicker
                                                                value={endRaw}
                                                                onSave={v => saveField(task, 'dueDate', v)}
                                                                className="text-inherit hover:underline px-0.5 font-bold text-[9px]"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="whitespace-nowrap">{formatTimelineRange(startRaw, endRaw)}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Horas */}
                                            <div className="flex items-center justify-center gap-0.5 text-[9px] min-w-0 w-full font-bold text-slate-350 h-full py-1.5">
                                                <span className="text-slate-400 shrink-0">{actual.toFixed(1)}h</span>
                                                <span className="text-slate-650 shrink-0">/</span>
                                                {canEdit ? (
                                                    <InlineEditNumber value={estimated} onSave={v => saveField(task, 'estimatedHours', v)} />
                                                ) : (
                                                    <span className="text-slate-400 shrink-0">{estimated}h</span>
                                                )}
                                            </div>

                                            {/* Espacio o Placeholder para acciones */}
                                            <div className="text-[9px] text-slate-500 italic select-none h-full flex items-center justify-center py-1.5">Fija ↑</div>
                                        </div>
 
                                        {/* Subtareas */}
                                        {isExpanded && totalSubs > 0 && (
                                            <div className="sticky left-0 w-[calc(100vw-36px)] shrink-0 z-10 pl-6 pr-3 bg-inherit">
                                                <SubtaskExpander
                                                    subtasks={taskSubtasks}
                                                    taskId={task.id}
                                                    canEdit={canEdit}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </React.Fragment>
                            );
                        }

                        return (
                            <React.Fragment key={task.id}>
                                <div
                                    onDoubleClick={() => handleOpenTask(task)}
                                    className={`grid items-stretch px-2 py-0 hover:bg-slate-800/10 transition-colors text-xs text-center cursor-pointer
                                        ${isTaskActive ? 'bg-indigo-500/5 hover:bg-indigo-500/10' : 'bg-slate-900/10'}
                                        ${isOverdue ? 'ring-1 ring-inset ring-rose-500/20' : ''}
                                    `}
                                    style={{ gridTemplateColumns: GRID_COLS }}
                                >
                                    {/* Borde izquierdo de color */}
                                    <div className="sticky left-0 z-10 bg-slate-950/40 h-full flex items-center justify-center" style={{ borderLeft: `3px solid ${isCritical ? '#ef4444' : projectColor}` }}>
                                    </div>

                                    {/* Tarea */}
                                    <div className="sticky left-[28px] z-10 bg-slate-950/40 text-left px-1 flex items-center gap-1.5 font-semibold text-slate-200 min-w-0 h-full py-2">
                                        {totalSubs > 0 ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleTaskExpanded(task.id); }}
                                                className="shrink-0 text-slate-500 hover:text-slate-200 transition-colors"
                                                title={isExpanded ? 'Ocultar subtareas' : 'Ver subtareas'}
                                            >
                                                {isExpanded
                                                    ? <ChevronDown className="w-3.5 h-3.5" />
                                                    : <ChevronRight className="w-3.5 h-3.5" />
                                                }
                                            </button>
                                        ) : (
                                            <span className="w-3.5 shrink-0" />
                                        )}
                                        {canEdit ? (
                                            <InlineEditText
                                                value={task.title || ''}
                                                onSave={v => saveField(task, 'title', v)}
                                                className="text-xs font-semibold text-slate-200 flex-1 whitespace-normal break-words py-1"
                                                placeholder="Sin título"
                                            />
                                        ) : (
                                            <span 
                                                onClick={(e) => { e.stopPropagation(); handleOpenTask(task); }}
                                                className="hover:text-indigo-400 cursor-pointer transition-colors whitespace-normal break-words py-1 flex-1"
                                            >
                                                {task.title || 'Sin título'}
                                            </span>
                                        )}
                                        {totalSubs > 0 && (
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                                                subsPct === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/60 text-slate-400'
                                            }`}>
                                                {doneSubs}/{totalSubs}
                                            </span>
                                        )}
                                        {isBlocked && (
                                            <span className="text-[9px] font-black uppercase px-1 py-0.5 bg-red-600 text-white rounded shrink-0 scale-90">
                                                Bloqueada
                                            </span>
                                        )}
                                    </div>

                                    {/* Proyecto */}
                                    <div className="text-left px-2 flex items-center h-full py-2">
                                        {canEdit ? (
                                            <InlineDropdown
                                                value={task.projectId || ''}
                                                options={engProjects.map(p => ({ value: p.id, label: p.name }))}
                                                onSelect={v => saveField(task, 'projectId', v || null)}
                                                renderValue={() => (
                                                    <span className="text-[10px] font-black px-2 py-0.5 bg-slate-900 border border-slate-800 rounded whitespace-nowrap" style={{ color: projectColor, borderColor: `${projectColor}30` }}>
                                                        {task.projectName}
                                                    </span>
                                                )}
                                            />
                                        ) : (
                                            <span className="text-[10px] font-black px-2 py-0.5 bg-slate-900 border border-slate-800 rounded whitespace-nowrap" style={{ color: projectColor, borderColor: `${projectColor}30` }}>
                                                {task.projectName}
                                            </span>
                                        )}
                                    </div>

                                    {/* Comentarios Link */}
                                    <div 
                                        className="flex items-center justify-center text-slate-500 hover:text-slate-200 cursor-pointer h-full py-2"
                                        onClick={(e) => { e.stopPropagation(); handleOpenTask(task); }}
                                        onDoubleClick={(e) => e.stopPropagation()}
                                    >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                    </div>

                                    {/* Estación */}
                                    <div className="flex items-center justify-center h-full py-2 min-w-0">
                                        <StationCell task={task} canEdit={canEdit} onSave={v => saveField(task, 'stationId', v)} />
                                    </div>

                                    {/* Área */}
                                    <div className="min-w-0 overflow-hidden flex items-center justify-center h-full py-2">
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
                                                        saveField(task, 'workAreaTypeId', v || null);
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
                                                                    saveField(task, 'taskTypeId', null);
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

                                    {/* Tipo */}
                                    <div className="min-w-0 overflow-hidden flex items-center justify-center h-full py-2">
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
                                                    onSelect={v => saveField(task, 'taskTypeId', v || null)}
                                                    renderValue={() => (
                                                        <span className="text-[10px] text-slate-400 truncate block text-center font-semibold leading-tight">{tt?.name || '—'}</span>
                                                    )}
                                                />
                                            ) : (
                                                <span className="text-[10px] text-slate-400 truncate block text-center">{tt?.name || '—'}</span>
                                            );
                                        })()}
                                    </div>

                                    {/* Estado Dropdown */}
                                    <div className="w-full h-full flex items-stretch" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                                        {canEdit ? (
                                            <InlineDropdown
                                                value={task.status}
                                                options={Object.entries(TASK_STATUS_CONFIG)
                                                    .filter(([k]) => k !== 'backlog')
                                                    .map(([k, cfg]) => ({ value: k, label: cfg.label, color: cfg.color }))}
                                                onSelect={v => handleStatusChange(task, v)}
                                                triggerClassName="w-full h-full flex items-center justify-center transition-all hover:brightness-110"
                                                renderValue={(val) => {
                                                    const cfg = TASK_STATUS_CONFIG[val] || {};
                                                    return (
                                                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white text-center leading-tight py-2 px-1"
                                                            style={{ background: cfg.color || '#64748b' }}>
                                                            {cfg.label || val}
                                                        </div>
                                                    );
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white text-center leading-tight py-2 px-1"
                                                style={{ background: statusCfg.color || '#64748b' }}>
                                                {statusCfg.label || task.status}
                                            </div>
                                        )}
                                    </div>

                                    {/* Avance */}
                                    <div className="flex items-center gap-1.5 px-2 h-full py-2">
                                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden shrink-0">
                                            <div className="h-full rounded-full" style={{ width: `${progressPct}%`, backgroundColor: progressColor }} />
                                        </div>
                                        <span className="text-[9px] font-black text-slate-450">{progressPct}%</span>
                                    </div>

                                    {/* Timeline */}
                                    <div className="min-w-0 overflow-hidden flex items-center justify-center h-full py-2">
                                        <div className={`flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold shadow-sm transition-all select-none min-w-[95px] max-w-fit mx-auto
                                            ${task.status === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-200'}`}
                                        >
                                            {task.status === 'completed' && <Check className="w-3 h-3 text-white shrink-0" />}
                                            {canEdit ? (
                                                <div className="flex items-center gap-0.5">
                                                    <InlineDatePicker
                                                        value={startRaw}
                                                        onSave={v => saveField(task, 'plannedStartDate', v)}
                                                        className="text-inherit hover:underline px-0.5 font-bold text-[10px]"
                                                    />
                                                    <span className="opacity-60 shrink-0 text-[9px]">-</span>
                                                    <InlineDatePicker
                                                        value={endRaw}
                                                        onSave={v => saveField(task, 'dueDate', v)}
                                                        className="text-inherit hover:underline px-0.5 font-bold text-[10px]"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="whitespace-nowrap">{formatTimelineRange(startRaw, endRaw)}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Horas */}
                                    <div className="flex items-center justify-center gap-0.5 text-[10px] min-w-0 w-full font-bold text-slate-350 h-full py-2">
                                        <span className="text-slate-400 shrink-0">{actual.toFixed(1)}h</span>
                                        <span className="text-slate-650 shrink-0">/</span>
                                        {canEdit ? (
                                            <InlineEditNumber value={estimated} onSave={v => saveField(task, 'estimatedHours', v)} />
                                        ) : (
                                            <span className="text-slate-450 shrink-0">{estimated}h</span>
                                        )}
                                    </div>

                                    {/* Prioridad Dropdown */}
                                    <div className="w-full h-full flex items-stretch text-white" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                                        {canEdit ? (
                                            <InlineDropdown
                                                value={task.priority || 'medium'}
                                                options={Object.entries(TASK_PRIORITY_CONFIG).map(([k, cfg]) => ({ value: k, label: cfg.label, color: cfg.color || '#64748b' }))}
                                                onSelect={v => handlePriorityChange(task, v)}
                                                triggerClassName="w-full h-full flex items-center justify-center transition-all hover:brightness-110"
                                                renderValue={(val) => {
                                                    const colors = { low: '#579bfc', medium: '#a25ddc', high: '#fdab3d', critical: '#e2445c' };
                                                    const c = colors[val] || '#579bfc';
                                                    const cfg = TASK_PRIORITY_CONFIG[val] || {};
                                                    return (
                                                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white text-center leading-tight py-2 px-1"
                                                            style={{ background: c }}>
                                                            {cfg.label || val}
                                                        </div>
                                                    );
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white text-center leading-tight py-2 px-1"
                                                style={{ background: { low: '#579bfc', medium: '#a25ddc', high: '#fdab3d', critical: '#e2445c' }[task.priority] || '#579bfc' }}>
                                                {(TASK_PRIORITY_CONFIG[task.priority] || {}).label || '—'}
                                            </div>
                                        )}
                                    </div>

                                    {/* Acciones */}
                                    <div className="flex items-center justify-end gap-1 px-1 h-full py-2" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                                        {isTaskActive ? (
                                            <>
                                                <button
                                                    onClick={() => handleCompleteTask(task)}
                                                    className="p-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded transition-all"
                                                    title="Completar tarea"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handlePauseTask(task)}
                                                    className="p-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-750 rounded transition-all"
                                                    title="Pausar tarea"
                                                >
                                                    <Pause className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleStartTask(task)}
                                                className={`p-1 rounded transition-all active:scale-95 text-white ${
                                                    isBlocked ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'
                                                }`}
                                                title={isBlocked ? 'Desbloquear y empezar' : 'Iniciar tiempo'}
                                            >
                                                <Play className="w-3 h-3 fill-white" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {isExpanded && totalSubs > 0 && (
                                    <SubtaskExpander
                                        subtasks={taskSubtasks}
                                        taskId={task.id}
                                        canEdit={canEdit}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                    {sortedTasks.length === 0 && (
                        <div className="py-8 text-center text-xs text-slate-500 italic">
                            No tienes tareas abiertas asignadas.
                        </div>
                    )}
                </div>
            </div>

            {/* Task Detail Modal */}
            {taskModalTask !== undefined && (
                <TaskDetailModal
                    isOpen={true}
                    onClose={() => setTaskModalTask(undefined)}
                    task={taskModalTask}
                    projects={engProjects}
                    teamMembers={teamMembers}
                    subtasks={taskModalTask
                        ? engSubtasks.filter(s => s.taskId === taskModalTask.id)
                        : []
                    }
                    taskTypes={taskTypes}
                    userId={user?.uid}
                    canEdit={canEdit}
                    canDelete={canDelete}
                />
            )}

            {/* WIP Block Modal */}
            <WipBlockModal
                delayCauses={delayCauses}
                isOpen={wipModalOpen}
                onClose={() => { setWipModalOpen(false); setWipCurrentTask(null); setWipPendingTask(null); setWipPendingStatus(null); }}
                onConfirm={handleWipConfirm}
                currentTask={wipCurrentTask}
                newTask={wipPendingTask}
                teamMembers={teamMembers}
                isLoading={wipSwitching}
            />
        </div>
    );
}

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
                    <div key={sub.id} className="flex items-center gap-2 py-0.5 group/sub" onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => handleToggle(sub)}
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
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
                    <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
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
