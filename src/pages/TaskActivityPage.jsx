import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useRole } from '../contexts/RoleContext';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import { fetchAllActivityLogs, fetchTaskActivityLog, updateActivityLog, deleteActivityLog } from '../services/activityLogService';
import {
    AreaChart, Area, BarChart, Bar, LineChart, Line, Cell,
    ComposedChart,
    PieChart, Pie, ReferenceLine,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    Activity, TrendingUp, CheckSquare, RefreshCw, Timer, AlertTriangle,
    Calendar as CalendarIcon, CalendarDays, X, ChevronDown, Check, FolderGit2, User,
    Pencil, Trash2, Save, ExternalLink, ListTodo
} from 'lucide-react';
import { format, subDays, addDays, eachDayOfInterval, isToday, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

// Timer events from activityLogs are unreliable — we use timeLogs as source of truth
const TIMER_EVENT_TYPES = ['timer_started', 'timer_stopped'];

const EVENT_COLORS = {
    subtask_completed: '#22c55e',
    subtask_unchecked: '#64748b',
    subtask_created: '#06b6d4',
    subtask_deleted: '#ef4444',
    status_changed: '#6366f1',
    timer_started: '#f59e0b',
    timer_stopped: '#f59e0b',
    work_session: '#f59e0b',
    delay_reported: '#ef4444',
    task_created: '#3b82f6',
    task_completed: '#22c55e',
    priority_changed: '#f97316',
    assignee_changed: '#8b5cf6',
    due_date_changed: '#ec4899',
    title_changed: '#64748b',
    description_changed: '#64748b',
};

const EVENT_ICONS = {
    subtask_completed: '✅',
    subtask_unchecked: '⬜',
    subtask_created: '➕',
    subtask_deleted: '🗑️',
    status_changed: '🔄',
    timer_started: '▶️',
    timer_stopped: '⏹️',
    work_session: '⏱️',
    delay_reported: '⚠️',
    task_created: '🆕',
    task_completed: '🏁',
    priority_changed: '🔺',
    assignee_changed: '👤',
    due_date_changed: '📅',
    title_changed: '✏️',
    description_changed: '📝',
};

const EVENT_LABELS = {
    subtask_completed: 'Subtarea completada',
    subtask_unchecked: 'Subtarea desmarcada',
    subtask_created: 'Subtarea creada',
    subtask_deleted: 'Subtarea eliminada',
    status_changed: 'Cambio de estado',
    timer_started: 'Timer iniciado',
    timer_stopped: 'Timer detenido',
    work_session: 'Sesión de trabajo',
    delay_reported: 'Retraso',
    task_created: 'Tarea creada',
    task_completed: 'Tarea completada',
    priority_changed: 'Prioridad',
    assignee_changed: 'Reasignación',
    due_date_changed: 'Fecha cambiada',
    title_changed: 'Título editado',
    description_changed: 'Descripción editada',
};

// --- Multi-select Dropdown (same pattern as EngineeringAnalytics) ---
function MultiSelect({ icon: Icon, options, selected, onChange, allLabel = 'Todos' }) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isAll = selected.length === 0;
    const displayText = isAll ? allLabel : selected.length === 1
        ? options.find(o => o.value === selected[0])?.label || '1 seleccionado'
        : `${selected.length} seleccionados`;

    const toggle = (val) => {
        if (selected.includes(val)) onChange(selected.filter(v => v !== val));
        else onChange([...selected, val]);
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${!isAll ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'}`}
            >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate max-w-[120px]">{displayText}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-1 left-0 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden min-w-[200px] max-h-[280px] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                    <button
                        onClick={() => onChange([])}
                        className={`w-full text-left px-3 py-2 text-sm font-bold flex items-center gap-2 border-b border-slate-700 transition-colors ${isAll ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:bg-slate-700'}`}
                    >
                        {isAll && <Check className="w-3.5 h-3.5" />}
                        {allLabel}
                    </button>
                    {options.map(opt => {
                        const active = selected.includes(opt.value);
                        return (
                            <button
                                key={opt.value}
                                onClick={() => toggle(opt.value)}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${active ? 'text-indigo-300 bg-indigo-500/10 font-bold' : 'text-slate-300 hover:bg-slate-700 font-medium'}`}
                            >
                                {active && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                                <span className="truncate">{opt.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function TaskActivityPage() {
    const { engProjects, engTasks, engSubtasks, teamMembers, timeLogs, taskTypes } = useEngineeringData();
    const { canEdit, canDelete, isAdmin } = useRole();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTaskId = searchParams.get('taskId');

    // Interactive selection (Power BI style)
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const activeTaskId = urlTaskId || selectedTaskId;

    // Find the task name for the header
    const focusedTask = activeTaskId ? engTasks?.find(t => t.id === activeTaskId) : null;

    // Actual hours from timeLogs (same source as TaskControlPanel — source of truth)
    const taskTimeLogs = activeTaskId && timeLogs
        ? timeLogs.filter(log => log.taskId === activeTaskId && log.totalHours).sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0))
        : [];
    const actualHoursFromTimeLogs = Math.round(taskTimeLogs.reduce((sum, log) => sum + (log.totalHours || 0), 0) * 10) / 10;

    const [showHoursDetail, setShowHoursDetail] = useState(false);

    // Task modal state
    const [selectedTaskForModal, setSelectedTaskForModal] = useState(null);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

    const openTaskModal = () => {
        if (focusedTask) {
            setSelectedTaskForModal(focusedTask);
            setIsTaskModalOpen(true);
        }
    };

    // Filter state
    const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [autoDateRange, setAutoDateRange] = useState(true);
    const [selectedPersons, setSelectedPersons] = useState([]);
    const [selectedProjects, setSelectedProjects] = useState([]);

    // Data
    const [activityLogs, setActivityLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    // Power BI style cross-filter state (from chart clicks)
    const [selectedEventType, setSelectedEventType] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);

    // Edit state
    const [editingLog, setEditingLog] = useState(null); // { id, taskId, description, userName }

    const startEditing = (log) => {
        setEditingLog({ id: log.id, taskId: log.taskId, description: log.description || '', userName: log.userName || '', userId: log.userId || '' });
    };

    const cancelEditing = () => setEditingLog(null);

    const saveEdit = async () => {
        if (!editingLog) return;
        try {
            await updateActivityLog(editingLog.taskId, editingLog.id, {
                description: editingLog.description,
                userName: editingLog.userName,
                userId: editingLog.userId,
            });
            // Update local state
            setActivityLogs(prev => prev.map(l =>
                l.id === editingLog.id ? { ...l, description: editingLog.description, userName: editingLog.userName, userId: editingLog.userId } : l
            ));
            setEditingLog(null);
        } catch (err) {
            console.error('[ActivityPage] Failed to save edit:', err);
            alert('Error al guardar: ' + err.message);
        }
    };

    const handleDelete = async (log) => {
        // Protect work_session pseudo-events (they come from timeLogs, not activityLogs)
        if (log.isFromTimeLogs) {
            alert('Este registro proviene de Registro de Horas.\nEdítalo desde la sección de Registro de Horas.');
            return;
        }
        if (!window.confirm(`¿Eliminar este evento?\n"${log.description}"`)) return;
        console.log('[ActivityPage] Deleting log:', { taskId: log.taskId, logId: log.id, log });
        try {
            await deleteActivityLog(log.taskId, log.id);
            setActivityLogs(prev => prev.filter(l => l.id !== log.id));
        } catch (err) {
            console.error('[ActivityPage] Failed to delete:', err);
            alert('Error al eliminar: ' + err.message);
        }
    };

    // Fetch activity logs when date range or taskId changes
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                let logs;
                if (urlTaskId) {
                    // Single task mode
                    logs = await fetchTaskActivityLog(urlTaskId, 500);
                } else {
                    logs = await fetchAllActivityLogs(dateFrom, dateTo);
                }
                if (!cancelled) {
                    setActivityLogs(logs);
                }
            } catch {
                // ignore
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [dateFrom, dateTo, urlTaskId]);

    // Filter options
    const personOptions = useMemo(() => {
        if (!teamMembers) return [];
        return teamMembers.map(m => ({
            value: m.uid || m.id,
            label: m.displayName || m.name || m.email?.split('@')[0] || 'Sin nombre'
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [teamMembers]);

    const projectOptions = useMemo(() => {
        if (!engProjects) return [];
        return engProjects.map(p => ({
            value: p.id,
            label: p.name || 'Sin nombre'
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [engProjects]);


    // Analytics computed from logs
    const analytics = useMemo(() => {
        if (!activityLogs || !engTasks) return null;

        // Build a task lookup for project filtering
        const taskProjectMap = {};
        engTasks.forEach(t => { taskProjectMap[t.id] = t.projectId; });

        // Filter logs (including Power BI chart filters)
        // baseFiltered: without chart-click filters (for keeping all bars/slices visible)
        const baseFiltered = activityLogs.filter(log => {
            if (selectedPersons.length > 0 && !selectedPersons.includes(log.userId)) return false;
            if (selectedProjects.length > 0) {
                const projId = taskProjectMap[log.taskId];
                if (!projId || !selectedProjects.includes(projId)) return false;
            }
            return true;
        });

        // Full filtered: includes chart-click filters (for KPIs, trend, timeline)
        const filtered = baseFiltered.filter(log => {
            if (selectedTaskId && log.taskId !== selectedTaskId) return false;
            if (selectedEventType && log.type !== selectedEventType) return false;
            if (selectedDate && log.date !== selectedDate) return false;
            return true;
        });

        // KPIs — timerSessions now counted from timeLogs (source of truth)
        const kpiTimeLogs = timeLogs ? timeLogs.filter(tl => {
            if (!tl.totalHours || !tl.startTime) return false;
            if (selectedPersons.length > 0 && !selectedPersons.includes(tl.userId)) return false;
            if (selectedProjects.length > 0 && !selectedProjects.includes(tl.projectId)) return false;
            if (activeTaskId && tl.taskId !== activeTaskId) return false;
            if (selectedTaskId && tl.taskId !== selectedTaskId) return false;
            return true;
        }) : [];
        const kpis = {
            subtasksCompleted: filtered.filter(l => l.type === 'subtask_completed').length,
            statusChanges: filtered.filter(l => l.type === 'status_changed').length,
            timerSessions: kpiTimeLogs.length,
            delaysReported: filtered.filter(l => l.type === 'delay_reported').length,
        };

        // Trend data — date range for chart
        const today = startOfDay(new Date());

        let chartStart, chartEnd;

        let taskCompletedDate = null;

        if (autoDateRange) {
            // AUTO: adjust to event range
            const eventDates = filtered.map(l => l.date).filter(Boolean).sort();
            const firstEventDay = eventDates.length > 0 ? new Date(eventDates[0] + 'T00:00:00') : today;
            const lastEventDay = eventDates.length > 0 ? new Date(eventDates[eventDates.length - 1] + 'T00:00:00') : today;

            taskCompletedDate = (() => {
                const completedLog = filtered.find(l => l.type === 'task_completed');
                if (completedLog?.date) return new Date(completedLog.date + 'T00:00:00');
                const currentTask = activeTaskId ? engTasks.find(t => t.id === activeTaskId) : null;
                if (currentTask?.status === 'completed' || currentTask?.status === 'closed') return lastEventDay;
                return null;
            })();

            chartStart = addDays(firstEventDay, -2);
            chartEnd = taskCompletedDate
                ? addDays(taskCompletedDate, 1)
                : addDays(isBefore(lastEventDay, today) ? today : lastEventDay, 3);
        } else {
            // MANUAL: respect dateFrom / dateTo
            chartStart = new Date(dateFrom + 'T00:00:00');
            chartEnd = new Date(dateTo + 'T00:00:00');
        }

        const days = eachDayOfInterval({ start: chartStart, end: chartEnd });
        const trendMap = new Map();
        let todayLabel = '';
        const isTaskCompleted = !!taskCompletedDate;
        const completedLabel = taskCompletedDate ? format(taskCompletedDate, 'dd MMM', { locale: es }) : null;

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const label = format(day, 'dd MMM', { locale: es });
            const isFutureDay = isBefore(today, day) && !isToday(day);
            // For completed tasks, treat days after completion as "no data"
            const isAfterCompleted = isTaskCompleted && taskCompletedDate && isBefore(taskCompletedDate, day);
            const noData = isFutureDay || isAfterCompleted;
            if (isToday(day)) todayLabel = label;
            trendMap.set(dateStr, {
                name: label,
                subtareas: noData ? null : 0,
                horas: noData ? null : 0,
                status: noData ? null : 0,
                isFuture: noData,
                isToday: isToday(day),
            });
        });

        filtered.forEach(log => {
            const dateStr = log.date;
            if (trendMap.has(dateStr)) {
                const d = trendMap.get(dateStr);
                if (d.isFuture) return;
                if (log.type === 'subtask_completed') d.subtareas++;
                if (log.type === 'status_changed') d.status++;
            }
        });

        // Hours from timeLogs (source of truth) — grouped by day, with same filters
        if (timeLogs) {
            const filteredTimeLogs = timeLogs.filter(tl => {
                if (!tl.totalHours || !tl.startTime) return false;
                if (selectedPersons.length > 0 && !selectedPersons.includes(tl.userId)) return false;
                if (selectedProjects.length > 0 && !selectedProjects.includes(tl.projectId)) return false;
                if (activeTaskId && tl.taskId !== activeTaskId) return false;
                if (selectedTaskId && tl.taskId !== selectedTaskId) return false;
                // Date range filter (always applied — timeLogs respect chosen range)
                const tlDate = tl.startTime.substring(0, 10);
                if (tlDate < format(chartStart, 'yyyy-MM-dd') || tlDate > format(chartEnd, 'yyyy-MM-dd')) return false;
                return true;
            });
            filteredTimeLogs.forEach(tl => {
                const dateStr = tl.startTime.substring(0, 10);
                if (trendMap.has(dateStr)) {
                    const d = trendMap.get(dateStr);
                    if (!d.isFuture) {
                        d.horas = Math.round(((d.horas || 0) + tl.totalHours) * 10) / 10;
                    }
                }
            });
        }

        const trendData = Array.from(trendMap.values()).map((d, i, arr) => {
            // Always show today's label for the reference line
            const showLabel = d.isToday || arr.length <= 14 || i % Math.ceil(arr.length / 14) === 0;
            return { ...d, displayName: showLabel ? d.name : '' };
        });

        // Store today label for reference line
        const todayRefLabel = todayLabel;

        // ------- snip: the rest of analytics stays the same -------

        // Top tasks by activity — EXCLUDE timer events (unreliable from activityLogs)
        const baseFilteredNoTimer = baseFiltered.filter(l => !TIMER_EVENT_TYPES.includes(l.type));
        const taskCountMap = new Map();
        baseFilteredNoTimer.forEach(log => {
            if (!log.taskId) return;
            taskCountMap.set(log.taskId, (taskCountMap.get(log.taskId) || 0) + 1);
        });
        const topTasks = Array.from(taskCountMap.entries())
            .map(([taskId, count]) => {
                const task = engTasks.find(t => t.id === taskId);
                return {
                    taskId,
                    name: task ? (task.title.length > 30 ? task.title.substring(0, 30) + '...' : task.title) : taskId.slice(0, 8),
                    eventos: count,
                };
            })
            .sort((a, b) => b.eventos - a.eventos)
            .slice(0, 8);

        // Timeline (grouped by day) — EXCLUDE timer events, INJECT work sessions from timeLogs
        const filteredNoTimer = filtered.filter(l => !TIMER_EVENT_TYPES.includes(l.type));

        // Create pseudo-events from timeLogs (real work sessions)
        const workSessionEvents = kpiTimeLogs.map(tl => {
            const member = teamMembers?.find(m => (m.uid || m.id) === tl.userId);
            const taskName = engTasks?.find(t => t.id === tl.taskId)?.title || '';
            const hours = Math.round((tl.totalHours || 0) * 10) / 10;
            return {
                id: `tl_${tl.id}`,
                type: 'work_session',
                taskId: tl.taskId,
                userId: tl.userId,
                userName: tl.displayName || member?.displayName || member?.name || '',
                timestamp: tl.startTime,
                date: tl.startTime.substring(0, 10),
                description: `${hours}h — ${taskName}${tl.isManual ? ' (manual)' : ''}`,
                meta: { totalHours: tl.totalHours, isManual: tl.isManual },
                isFromTimeLogs: true,
            };
        });

        // Combine and sort
        const allTimelineEvents = [...filteredNoTimer, ...workSessionEvents]
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        const timelineByDay = {};
        allTimelineEvents.forEach(log => {
            const dateStr = log.date;
            if (!timelineByDay[dateStr]) timelineByDay[dateStr] = [];
            timelineByDay[dateStr].push(log);
        });

        // Event type distribution — EXCLUDE timer events, ADD work_session count
        const typeCountMap = {};
        baseFilteredNoTimer.forEach(log => {
            const t = log.type || 'unknown';
            typeCountMap[t] = (typeCountMap[t] || 0) + 1;
        });
        // Add work sessions from timeLogs
        if (kpiTimeLogs.length > 0) {
            typeCountMap['work_session'] = kpiTimeLogs.length;
        }
        const eventTypeDistribution = Object.entries(typeCountMap)
            .map(([type, count]) => ({
                name: EVENT_LABELS[type] || type,
                value: count,
                type,
                color: EVENT_COLORS[type] || '#64748b',
            }))
            .sort((a, b) => b.value - a.value);

        // Task lifeline (created → completed dates)
        const taskCreatedLog = filtered.find(l => l.type === 'task_created');
        const taskCompletedLog = filtered.find(l => l.type === 'task_completed');

        return { kpis, trendData, todayRefLabel, topTasks, timelineByDay, totalEvents: filtered.length, eventTypeDistribution, taskCreatedLog, taskCompletedLog, completedLabel, isTaskCompleted };
    }, [activityLogs, selectedPersons, selectedProjects, selectedTaskId, selectedEventType, selectedDate, engTasks, activeTaskId, dateFrom, dateTo, timeLogs, autoDateRange, teamMembers]);

    // Progress chart data (built from logs with percentComplete in meta)
    const progressChartData = useMemo(() => {
        if (!activeTaskId || !activityLogs.length) return { points: [], todayLabel: '' };
        // Get all subtask events for the active task that have percentComplete
        const progressEvents = activityLogs
            .filter(l => l.taskId === activeTaskId && l.meta?.percentComplete != null)
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        if (progressEvents.length === 0) return { points: [], todayLabel: '' };

        const formatPoint = (d) =>
            `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;

        const formatDay = (d) =>
            `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`;

        // Always start from 0% (use task creation or 1 day before first event)
        const firstEventDate = new Date(progressEvents[0].timestamp);
        const originDate = new Date(firstEventDate.getTime() - 24 * 60 * 60 * 1000);

        const points = [
            { name: formatPoint(originDate), progreso: 0, totalSubtasks: null, completedSubtasks: null, description: 'Inicio' },
            ...progressEvents.map(log => ({
                name: formatPoint(new Date(log.timestamp)),
                progreso: log.meta.percentComplete,
                totalSubtasks: log.meta.totalSubtasks ?? null,
                completedSubtasks: log.meta.completedSubtasks ?? null,
                description: log.description,
            })),
        ];

        // Add TODAY marker and future extension
        const today = startOfDay(new Date());
        const todayLabel = formatDay(today) + ' (HOY)';

        // Find the task to get dueDate for future extension
        const task = engTasks.find(t => t.id === activeTaskId);
        const dueDate = task?.dueDate ? new Date(task.dueDate) : null;

        // Determine chart end: dueDate or today+3, whichever is later
        const futureEnd = dueDate && isBefore(addDays(today, 3), dueDate)
            ? dueDate
            : addDays(today, 3);

        // Last known progress value
        const lastProgress = points[points.length - 1]?.progreso ?? 0;
        const lastEventDate = new Date(progressEvents[progressEvents.length - 1].timestamp);

        // Add today point if last event is before today
        if (isBefore(startOfDay(lastEventDate), today)) {
            points.push({
                name: todayLabel,
                progreso: lastProgress,
                description: 'Hoy',
                isToday: true,
            });
        } else {
            // Mark last point as today-ish for reference
            points[points.length - 1].isToday = true;
        }

        // Add future empty points (null progreso so line doesn't extend)
        const futureDays = eachDayOfInterval({ start: addDays(today, 1), end: futureEnd });
        futureDays.forEach(day => {
            const label = formatDay(day);
            const isDue = dueDate && format(day, 'yyyy-MM-dd') === format(dueDate, 'yyyy-MM-dd');
            points.push({
                name: isDue ? label + ' (META)' : label,
                progreso: null,
                isFuture: true,
                isDueDate: isDue,
            });
        });

        return { points, todayLabel };
    }, [activeTaskId, activityLogs, engTasks]);

    // Projection chart: daily hours, accumulated, and projected hours
    const projectionChartData = useMemo(() => {
        if (!activeTaskId || !timeLogs) return null;
        const task = engTasks?.find(t => t.id === activeTaskId);
        if (!task) return null;

        const estimatedHours = Number(task.estimatedHours) || 0;
        const plannedStart = task.plannedStartDate ? new Date(task.plannedStartDate + 'T00:00:00') : null;
        const plannedEnd = task.plannedEndDate ? new Date(task.plannedEndDate + 'T00:00:00') : null;

        // Get all timeLogs for this task
        const taskTLs = timeLogs
            .filter(tl => tl.taskId === activeTaskId && tl.totalHours && tl.startTime)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

        if (taskTLs.length === 0 && !plannedStart) return null;

        // Group hours by day
        const hoursByDay = {};
        taskTLs.forEach(tl => {
            const day = tl.startTime.substring(0, 10);
            hoursByDay[day] = (hoursByDay[day] || 0) + tl.totalHours;
        });

        // Determine chart range
        const workDays = Object.keys(hoursByDay).sort();
        const today = startOfDay(new Date());
        const isCompleted = task.status === 'completed' || task.status === 'closed';

        const rangeStart = plannedStart
            ? (workDays.length > 0 && new Date(workDays[0] + 'T00:00:00') < plannedStart
                ? new Date(workDays[0] + 'T00:00:00')
                : addDays(plannedStart, -1))
            : (workDays.length > 0 ? addDays(new Date(workDays[0] + 'T00:00:00'), -1) : addDays(today, -7));

        // For completed tasks, end at last work day + 1
        const lastWorkDay = workDays.length > 0 ? new Date(workDays[workDays.length - 1] + 'T00:00:00') : today;
        const rangeEnd = isCompleted
            ? addDays(lastWorkDay, 1)
            : (plannedEnd && isBefore(today, plannedEnd) ? addDays(plannedEnd, 1) : addDays(today, 3));
        // effectiveToday: for completed tasks, treat last work day as "today" so future days don't appear
        const effectiveToday = isCompleted ? lastWorkDay : today;

        const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

        // Build data points
        let accumulated = 0;
        const points = days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const label = format(day, 'dd MMM', { locale: es });
            const isFutureDay = isBefore(effectiveToday, day) && !isToday(day);
            const dailyH = hoursByDay[dateStr] || 0;

            if (!isFutureDay) {
                accumulated += dailyH;
            }

            // Projection: linear from 0 at plannedStart to estimatedHours at plannedEnd
            let proyeccion = null;
            if (estimatedHours > 0 && plannedStart && plannedEnd) {
                const totalSpan = eachDayOfInterval({ start: plannedStart, end: plannedEnd }).length - 1; // 0-based
                if (isBefore(day, plannedStart)) {
                    // Before start — no projection
                    proyeccion = null;
                } else if (isBefore(plannedEnd, day)) {
                    // After end — cap at estimated
                    proyeccion = estimatedHours;
                } else {
                    // Between start and end (inclusive)
                    const dayIndex = eachDayOfInterval({ start: plannedStart, end: day }).length - 1; // 0-based
                    proyeccion = totalSpan > 0
                        ? Math.round(Math.min(estimatedHours * (dayIndex / totalSpan), estimatedHours) * 10) / 10
                        : estimatedHours; // single day plan
                }
            }

            return {
                name: label,
                dateStr,
                horasDia: isFutureDay ? null : Math.round(dailyH * 10) / 10,
                acumuladas: isFutureDay ? null : Math.round(accumulated * 10) / 10,
                proyeccion,
                isFuture: isFutureDay,
                isToday: isToday(day),
                isStartPlan: plannedStart && format(day, 'yyyy-MM-dd') === format(plannedStart, 'yyyy-MM-dd'),
                isEndPlan: plannedEnd && format(day, 'yyyy-MM-dd') === format(plannedEnd, 'yyyy-MM-dd'),
            };
        });

        // Calculate tracking status
        let trackingStatus = 'none';
        if (isCompleted && estimatedHours > 0) {
            // For completed tasks, compare final accumulated vs estimated
            const ratio = accumulated / estimatedHours;
            if (ratio >= 0.9) trackingStatus = 'on-track';
            else if (ratio >= 0.7) trackingStatus = 'at-risk';
            else trackingStatus = 'behind';
        } else {
            const todayProjection = points.find(p => p.isToday)?.proyeccion;
            const todayAccumulated = points.find(p => p.isToday)?.acumuladas ?? accumulated;
            if (todayProjection && todayProjection > 0) {
                const ratio = todayAccumulated / todayProjection;
                if (ratio >= 0.9) trackingStatus = 'on-track';
                else if (ratio >= 0.7) trackingStatus = 'at-risk';
                else trackingStatus = 'behind';
            }
        }

        // Today label for reference line (only for non-completed tasks)
        const todayLabel = isCompleted ? null : format(today, 'dd MMM', { locale: es });
        // Completed date label for reference line
        const completedLabel = isCompleted && workDays.length > 0
            ? format(lastWorkDay, 'dd MMM', { locale: es })
            : null;

        return {
            points,
            estimatedHours,
            accumulated: Math.round(accumulated * 10) / 10,
            trackingStatus,
            todayLabel,
            hasPlannedDates: !!plannedStart && !!plannedEnd,
            isCompleted,
            completedLabel,
        };
    }, [activeTaskId, timeLogs, engTasks]);

    // Helpers
    const hasActiveFilters = selectedPersons.length > 0 || selectedProjects.length > 0 || selectedTaskId || selectedEventType || selectedDate;

    const clearFilters = () => {
        setDateFrom(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
        setDateTo(format(new Date(), 'yyyy-MM-dd'));
        setAutoDateRange(true);
        setSelectedPersons([]);
        setSelectedProjects([]);
        setSelectedTaskId(null);
        setSelectedEventType(null);
        setSelectedDate(null);
        if (urlTaskId) {
            setSearchParams({});
        }
    };

    const handleTaskClick = (taskId) => {
        if (selectedTaskId === taskId) {
            setSelectedTaskId(null);
        } else {
            setSelectedTaskId(taskId);
        }
    };


    // Power BI: click on donut slice → filter by event type
    const handleDonutClick = (entry) => {
        if (!entry?.type) return;
        setSelectedEventType(prev => prev === entry.type ? null : entry.type);
    };

    const applyPreset = (days) => {
        setDateTo(format(new Date(), 'yyyy-MM-dd'));
        setDateFrom(format(subDays(new Date(), days), 'yyyy-MM-dd'));
        setAutoDateRange(false);
    };

    const handleDateFromChange = (e) => {
        setDateFrom(e.target.value);
        setAutoDateRange(false);
    };
    const handleDateToChange = (e) => {
        setDateTo(e.target.value);
        setAutoDateRange(false);
    };

    const formatDayLabel = (dateStr) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        if (dateStr === today) return 'Hoy';
        if (dateStr === yesterday) return 'Ayer';
        return format(new Date(dateStr + 'T12:00:00'), 'dd MMM yyyy', { locale: es });
    };

    const formatTime = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        const dd = d.getDate().toString().padStart(2, '0');
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const hh = d.getHours().toString().padStart(2, '0');
        const min = d.getMinutes().toString().padStart(2, '0');
        return `${dd}/${mm} ${hh}:${min}`;
    };

    const getUserName = (uid) => {
        const m = teamMembers?.find(u => u.uid === uid);
        return m?.displayName || m?.name || m?.email?.split('@')[0] || '';
    };

    if (loading && activityLogs.length === 0) {
        return <div className="p-8 text-center text-slate-400 font-bold animate-pulse">Cargando actividad...</div>;
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-300">

            {/* --- FILTER BAR (compact toolbar) --- */}
            <div className="flex flex-wrap items-center gap-3 relative z-20">
                {/* Focused task label */}
                {focusedTask && (
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={openTaskModal}
                            className="text-sm font-black text-white bg-indigo-600/20 border border-indigo-500/30 px-3 py-1.5 rounded-xl truncate max-w-[200px] hover:bg-indigo-600/30 hover:border-indigo-400/50 transition-all cursor-pointer flex items-center gap-1.5"
                            title="Editar tarea"
                        >
                            <ListTodo className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            {focusedTask.title}
                        </button>
                        <button
                            onClick={() => navigate('/tasks')}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all"
                            title="Ir a Tareas"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Active filter pills */}
                <div className="flex items-center gap-2">
                    {selectedTaskId && !urlTaskId && (
                        <button
                            onClick={() => setSelectedTaskId(null)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
                        >
                            <X className="w-3 h-3" /> {focusedTask?.title?.substring(0, 20) || 'Tarea'}
                        </button>
                    )}
                    {selectedEventType && (
                        <button
                            onClick={() => setSelectedEventType(null)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-violet-300 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 transition-all"
                        >
                            <X className="w-3 h-3" /> {EVENT_LABELS[selectedEventType] || selectedEventType}
                        </button>
                    )}
                    {selectedDate && (
                        <button
                            onClick={() => setSelectedDate(null)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                        >
                            <X className="w-3 h-3" /> {format(new Date(selectedDate + 'T12:00:00'), 'dd MMM yyyy', { locale: es })}
                        </button>
                    )}
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                        >
                            <X className="w-3.5 h-3.5" /> Limpiar filtros
                        </button>
                    )}
                </div>

                {/* Date Range */}
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl p-1 pl-3">
                    <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
                    <input type="date" value={dateFrom} onChange={handleDateFromChange}
                        className="bg-transparent border-none text-sm font-bold text-slate-200 py-1 px-1 focus:ring-0 outline-none w-[120px]" />
                    <span className="text-slate-500 text-xs font-bold">→</span>
                    <input type="date" value={dateTo} onChange={handleDateToChange}
                        max={format(new Date(), 'yyyy-MM-dd')}
                        className="bg-transparent border-none text-sm font-bold text-slate-200 py-1 px-1 focus:ring-0 outline-none w-[120px]" />
                    <button
                        onClick={() => setAutoDateRange(!autoDateRange)}
                        className={`ml-1 px-2 py-1 rounded-lg text-[10px] font-black tracking-wider transition-all border ${
                            autoDateRange
                                ? 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30 hover:bg-cyan-500/25'
                                : 'text-amber-300 bg-amber-500/15 border-amber-500/30 hover:bg-amber-500/25'
                        }`}
                        title={autoDateRange ? 'Rango automático: ajusta al rango de eventos' : 'Rango manual: usa las fechas seleccionadas'}
                    >
                        {autoDateRange ? 'AUTO' : 'MANUAL'}
                    </button>
                </div>

                {/* Quick presets */}
                <div className="flex gap-1">
                    {[{ label: '7d', days: 7 }, { label: '15d', days: 15 }, { label: '30d', days: 30 }, { label: '90d', days: 90 }].map(p => (
                        <button key={p.days} onClick={() => applyPreset(p.days)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-black text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all">
                            {p.label}
                        </button>
                    ))}
                </div>

                <div className="w-px h-6 bg-slate-700" />

                <MultiSelect icon={User} options={personOptions} selected={selectedPersons} onChange={setSelectedPersons} allLabel="Todas las personas" />
                <MultiSelect icon={FolderGit2} options={projectOptions} selected={selectedProjects} onChange={setSelectedProjects} allLabel="Todos los proyectos" />

                <div className="ml-auto text-[11px] text-slate-500 font-bold">
                    {analytics?.totalEvents || 0} eventos
                </div>
            </div>

            {/* --- KPI CARDS --- */}
            {analytics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
                        <span className="text-[10px] font-black tracking-wider text-emerald-400 uppercase">Subtareas Completadas</span>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                                <CheckSquare className="w-6 h-6" />
                            </div>
                            <span className="text-3xl font-black text-white">{analytics.kpis.subtasksCompleted}</span>
                        </div>
                    </div>

                    <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
                        <span className="text-[10px] font-black tracking-wider text-indigo-400 uppercase">Cambios de Status</span>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="w-12 h-12 rounded-full bg-indigo-500/15 flex items-center justify-center text-indigo-400 shrink-0">
                                <RefreshCw className="w-6 h-6" />
                            </div>
                            <span className="text-3xl font-black text-white">{analytics.kpis.statusChanges}</span>
                        </div>
                    </div>

                    <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg cursor-pointer transition-all hover:border-amber-500/30"
                        onClick={() => setShowHoursDetail(!showHoursDetail)}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black tracking-wider text-amber-400 uppercase">Horas Plan vs Real</span>
                            {taskTimeLogs.length > 0 && (
                                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${showHoursDetail ? 'rotate-180' : ''}`} />
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                                focusedTask?.estimatedHours && actualHoursFromTimeLogs > Number(focusedTask.estimatedHours)
                                    ? 'bg-rose-500/15 text-rose-400'
                                    : 'bg-amber-500/15 text-amber-400'
                            }`}>
                                <Timer className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-2xl font-black text-white">
                                    {actualHoursFromTimeLogs}h
                                    {focusedTask?.estimatedHours ? (
                                        <span className="text-sm font-bold text-slate-400"> / {focusedTask.estimatedHours}h</span>
                                    ) : null}
                                </span>
                                {focusedTask?.estimatedHours ? (
                                    <span className={`text-[10px] font-bold ${
                                        actualHoursFromTimeLogs > Number(focusedTask.estimatedHours) ? 'text-rose-400' : 'text-emerald-400'
                                    }`}>
                                        {Math.round((actualHoursFromTimeLogs / Number(focusedTask.estimatedHours)) * 100)}% utilizado
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold text-slate-500">Sin estimación</span>
                                )}
                            </div>
                        </div>

                        {/* Expandable detail */}
                        {showHoursDetail && taskTimeLogs.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-700/50">
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Detalle de {taskTimeLogs.length} registros</div>
                                <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1">
                                    {taskTimeLogs.map((log, i) => {
                                        const d = log.startTime ? new Date(log.startTime) : null;
                                        const dateLabel = d ? format(d, 'dd/MM/yy HH:mm', { locale: es }) : '—';
                                        const userName = log.userName || (log.userId ? (teamMembers?.find(m => m.uid === log.userId)?.displayName || log.userId.substring(0, 8)) : '—');
                                        return (
                                            <div key={log.id || i} className="flex items-center justify-between py-1 px-2 rounded bg-slate-800/50 text-[10px]">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-slate-400 font-mono shrink-0">{dateLabel}</span>
                                                    <span className="text-slate-300 truncate">{userName}</span>
                                                </div>
                                                <span className="font-black text-amber-300 shrink-0 ml-2">{Math.round((log.totalHours || 0) * 100) / 100}h</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex justify-between mt-2 pt-2 border-t border-slate-700/30 text-[10px] font-black">
                                    <span className="text-slate-400">TOTAL</span>
                                    <span className="text-amber-300">{actualHoursFromTimeLogs}h</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
                        <span className="text-[10px] font-black tracking-wider text-rose-400 uppercase">Retrasos Reportados</span>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="w-12 h-12 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-400 shrink-0">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <span className="text-3xl font-black text-white">{analytics.kpis.delaysReported}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* === VISUAL TASK LIFE TIMELINE (infographic) === */}
            {activeTaskId && focusedTask && (
                <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg">
                    <div className="flex items-center gap-2 mb-5">
                        <CalendarDays className="w-5 h-5 text-cyan-400" />
                        <h3 className="font-bold text-lg text-white">Línea de Vida de la Tarea</h3>
                        <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/15 px-2 py-0.5 rounded-full">
                            {focusedTask.status}
                        </span>
                    </div>
                    {(() => {
                        const milestones = [];
                        const fmtDate = (iso) => {
                            if (!iso) return null;
                            const d = new Date(iso.length > 10 ? iso : iso + 'T12:00:00');
                            return { date: d, label: format(d, 'dd/MM/yy', { locale: es }) };
                        };
                        if (focusedTask.plannedStartDate) {
                            const p = fmtDate(focusedTask.plannedStartDate);
                            milestones.push({ date: p.date, label: p.label, title: 'Inicio Plan', color: '#06b6d4', icon: '🏁', type: 'plan' });
                        }
                        if (focusedTask.plannedEndDate) {
                            const p = fmtDate(focusedTask.plannedEndDate);
                            milestones.push({ date: p.date, label: p.label, title: 'Fin Plan', color: '#d946ef', icon: '🎯', type: 'plan' });
                        }
                        if (focusedTask.dueDate) {
                            const p = fmtDate(focusedTask.dueDate);
                            milestones.push({ date: p.date, label: p.label, title: 'Fecha Límite', color: '#f59e0b', icon: '⏰', type: 'plan' });
                        }
                        const taskLogs = activityLogs.filter(l => l.taskId === activeTaskId).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
                        const firstLog = taskLogs.find(l => l.type === 'task_created');
                        if (firstLog) {
                            const p = fmtDate(firstLog.timestamp);
                            milestones.push({ date: p.date, label: p.label, title: 'Creada', color: '#64748b', icon: '📋', type: 'event' });
                        }
                        taskLogs.filter(l => l.type === 'status_changed').forEach(log => {
                            const p = fmtDate(log.timestamp);
                            const to = log.meta?.to || log.description?.split('→')[1]?.trim() || '';
                            milestones.push({ date: p.date, label: p.label, title: to, color: '#6366f1', icon: '🔄', type: 'event' });
                        });
                        const subtaskLogs = taskLogs.filter(l => l.type === 'subtask_completed');
                        if (subtaskLogs.length > 0) {
                            const first = subtaskLogs[0];
                            const last = subtaskLogs[subtaskLogs.length - 1];
                            const p1 = fmtDate(first.timestamp);
                            milestones.push({ date: p1.date, label: p1.label, title: `1ª Subtarea`, color: '#22c55e', icon: '✅', type: 'event' });
                            if (subtaskLogs.length > 1) {
                                const p2 = fmtDate(last.timestamp);
                                milestones.push({ date: p2.date, label: p2.label, title: `Última (#${subtaskLogs.length})`, color: '#22c55e', icon: '✅', type: 'event' });
                            }
                        }
                        // Timer hours from timeLogs (source of truth) — show each day individually
                        if (taskTimeLogs.length > 0) {
                            // Group by day
                            const hoursByDay = {};
                            taskTimeLogs.forEach(tl => {
                                if (!tl.startTime) return;
                                const day = tl.startTime.substring(0, 10);
                                hoursByDay[day] = (hoursByDay[day] || 0) + (tl.totalHours || 0);
                            });
                            // Add a milestone for each work day
                            Object.entries(hoursByDay)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .forEach(([day, hours]) => {
                                    const p = fmtDate(day);
                                    if (p) {
                                        milestones.push({
                                            date: p.date,
                                            label: p.label,
                                            title: `${Math.round(hours * 10) / 10}h`,
                                            color: '#f59e0b',
                                            icon: '⏱️',
                                            type: 'event',
                                        });
                                    }
                                });
                        }
                        const completedLog = taskLogs.find(l => l.type === 'task_completed');
                        if (completedLog) {
                            const p = fmtDate(completedLog.timestamp);
                            milestones.push({ date: p.date, label: p.label, title: 'Completada', color: '#22c55e', icon: '🏆', type: 'event' });
                        }
                        const now = new Date();
                        const isCompleted = focusedTask.status === 'completed' || focusedTask.status === 'closed';
                        if (!isCompleted) {
                            milestones.push({ date: now, label: format(now, 'dd/MM/yy'), title: 'HOY', color: '#f43f5e', icon: '📍', type: 'today' });
                        }
                        milestones.sort((a, b) => a.date - b.date);
                        if (milestones.length === 0) return <div className="text-slate-400 font-bold text-center py-8">Sin fechas configuradas</div>;

                        // Total hours summary
                        const totalHoursSummary = actualHoursFromTimeLogs > 0 ? `${actualHoursFromTimeLogs}h total` : null;

                        return (
                            <div className="relative">
                                {/* Legend */}
                                <div className="flex gap-4 mb-3 flex-wrap items-center">
                                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> Fechas Plan
                                    </span>
                                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" /> Eventos
                                    </span>
                                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Horas
                                    </span>
                                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" /> Hoy
                                    </span>
                                    {totalHoursSummary && (
                                        <span className="ml-auto text-[10px] font-black text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                                            ⏱️ {totalHoursSummary}
                                        </span>
                                    )}
                                </div>
                                {/* Timeline Container */}
                                <div className="overflow-x-auto pb-2">
                                    <div className="relative" style={{ minWidth: Math.max(milestones.length * 130, 600) + 'px', paddingTop: '90px', paddingBottom: '90px' }}>
                                        {/* Horizontal line */}
                                        <div className="absolute left-4 right-4 h-[3px] bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded-full" style={{ top: '50%', transform: 'translateY(-50%)' }} />
                                        {/* Plan range bar */}
                                        {focusedTask.plannedStartDate && focusedTask.plannedEndDate && (() => {
                                            const startIdx = milestones.findIndex(m => m.title === 'Inicio Plan');
                                            const endIdx = milestones.findIndex(m => m.title === 'Fin Plan');
                                            if (startIdx >= 0 && endIdx >= 0) {
                                                const leftPct = (startIdx / (milestones.length - 1)) * 100;
                                                const widthPct = ((endIdx - startIdx) / (milestones.length - 1)) * 100;
                                                return <div className="absolute h-[5px] bg-cyan-500/30 rounded-full" style={{ left: `${leftPct}%`, width: `${widthPct}%`, top: '50%', transform: 'translateY(-50%)' }} />;
                                            }
                                            return null;
                                        })()}
                                        {/* Nodes */}
                                        <div className="flex justify-between w-full relative" style={{ height: '0px' }}>
                                            {milestones.map((ms, i) => {
                                                const isAbove = i % 2 === 0;
                                                return (
                                                    <div key={i} className="flex flex-col items-center relative" style={{ flex: '1 1 0', maxWidth: '150px' }}>
                                                        {/* Above content */}
                                                        <div className="absolute flex flex-col items-center" style={{ bottom: isAbove ? '20px' : 'auto', top: isAbove ? 'auto' : '20px', width: '130px', left: '50%', transform: 'translateX(-50%)' }}>
                                                            {/* Connector line */}
                                                            <div className={`w-[2px] ${isAbove ? 'order-last' : 'order-first'}`} style={{ height: '20px', backgroundColor: ms.color + '60' }} />
                                                            {/* Content card */}
                                                            <div className={`flex flex-col items-center text-center ${isAbove ? '' : 'mt-0'}`} style={{ order: isAbove ? 0 : 1 }}>
                                                                <span className="text-[11px] font-black leading-tight" style={{ color: ms.color }}>
                                                                    {ms.title}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                                                                    {ms.label}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {/* Node circle */}
                                                        <div
                                                            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shadow-lg border-2 transition-all z-10 ${
                                                                ms.type === 'today'
                                                                    ? 'animate-pulse border-rose-400 bg-rose-500/20'
                                                                    : 'bg-slate-800'
                                                            }`}
                                                            style={{ borderColor: ms.color + '80', boxShadow: `0 0 12px ${ms.color}30` }}
                                                            title={`${ms.title} — ${ms.label}`}
                                                        >
                                                            {ms.icon}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* --- PROGRESS CHART (when a task is selected) --- */}
            {activeTaskId && progressChartData.points.length > 0 && (
                <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg">
                    <div className="flex items-center gap-2 mb-5">
                        <TrendingUp className="w-5 h-5 text-indigo-400" />
                        <h3 className="font-bold text-lg text-white">Avance en el Tiempo</h3>
                        <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/15 px-2 py-0.5 rounded-full">
                            {progressChartData.points.filter(p => p.progreso != null).slice(-1)[0]?.progreso ?? 0}% actual
                        </span>
                    </div>
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={progressChartData.points} margin={{ top: 10, right: 40, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                <YAxis yAxisId="left" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} unit="%" />
                                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#06b6d4', fontSize: 10, fontWeight: 700 }} allowDecimals={false} label={{ value: 'Subtareas', angle: 90, position: 'insideRight', fill: '#06b6d4', fontSize: 10, fontWeight: 700, dx: 20 }} />
                                <Tooltip
                                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12, fontWeight: 700 }}
                                    formatter={(val, name) => {
                                        if (val === null) return ['—', ''];
                                        if (name === 'Progreso') return [`${val}%`, name];
                                        return [val, name];
                                    }}
                                />
                                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />

                                {/* TODAY marker line */}
                                {progressChartData.todayLabel && (
                                    <ReferenceLine
                                        x={progressChartData.todayLabel}
                                        yAxisId="left"
                                        stroke="#f43f5e"
                                        strokeWidth={2}
                                        strokeDasharray="6 3"
                                        label={{
                                            value: 'HOY',
                                            position: 'top',
                                            fill: '#f43f5e',
                                            fontSize: 11,
                                            fontWeight: 'bold',
                                        }}
                                    />
                                )}

                                {/* 100% target line */}
                                <ReferenceLine
                                    y={100}
                                    yAxisId="left"
                                    stroke="#22c55e"
                                    strokeWidth={1}
                                    strokeDasharray="4 4"
                                    label={{
                                        value: '100%',
                                        position: 'right',
                                        fill: '#22c55e',
                                        fontSize: 10,
                                        fontWeight: 'bold',
                                    }}
                                />

                                {/* Subtask count bars on right axis */}
                                <Bar yAxisId="right" name="Total Subtareas" dataKey="totalSubtasks" fill="#06b6d4" opacity={0.3} barSize={16} radius={[4, 4, 0, 0]} />

                                {/* Progress line on left axis */}
                                <Line yAxisId="left" type="stepAfter" name="Progreso" dataKey="progreso" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 5 }} activeDot={{ r: 7 }} connectNulls={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* --- PROJECTION CHART: Daily Hours + Accumulated + Projection --- */}
            {activeTaskId && projectionChartData && projectionChartData.points.length > 0 && (
                <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg">
                    <div className="flex items-center gap-2 mb-5 flex-wrap">
                        <CalendarDays className="w-5 h-5 text-amber-400" />
                        <h3 className="font-bold text-lg text-white">Proyección de Horas</h3>
                        {projectionChartData.estimatedHours > 0 && (
                            <span className="text-[9px] font-bold text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded-full">
                                Meta: {projectionChartData.estimatedHours}h
                            </span>
                        )}
                        <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            Real: {projectionChartData.accumulated}h
                        </span>
                        {projectionChartData.trackingStatus !== 'none' && (
                            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full border ${
                                projectionChartData.trackingStatus === 'on-track'
                                    ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
                                    : projectionChartData.trackingStatus === 'at-risk'
                                        ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
                                        : 'text-rose-300 bg-rose-500/15 border-rose-500/30'
                            }`}>
                                {projectionChartData.trackingStatus === 'on-track' ? '🟢 En camino'
                                    : projectionChartData.trackingStatus === 'at-risk' ? '🟡 En riesgo'
                                    : '🔴 Atrasado'}
                            </span>
                        )}
                        {!projectionChartData.hasPlannedDates && (
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                                Sin fechas plan — sin proyección
                            </span>
                        )}
                        {projectionChartData.isCompleted && (
                            <span className="text-[9px] font-black text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                ✅ Completada
                            </span>
                        )}
                    </div>
                    <div className="h-[340px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={projectionChartData.points} margin={{ top: 15, right: 50, left: 5, bottom: 25 }}>
                                <defs>
                                    <linearGradient id="colorDailyH" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.7} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                                    </linearGradient>
                                    <linearGradient id="colorAccum" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 700 }}
                                    axisLine={false} tickLine={false} dy={8}
                                    angle={-30} textAnchor="end" height={50}
                                />
                                <YAxis
                                    yAxisId="left"
                                    tick={{ fontSize: 11, fill: '#10b981', fontWeight: 700 }}
                                    axisLine={false} tickLine={false}
                                    unit="h"
                                    label={{ value: 'Acumuladas', angle: -90, position: 'insideLeft', fill: '#10b981', fontSize: 10, fontWeight: 700, dx: 5 }}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    tick={{ fontSize: 11, fill: '#f59e0b', fontWeight: 700 }}
                                    axisLine={false} tickLine={false}
                                    unit="h"
                                    label={{ value: 'Por día', angle: 90, position: 'insideRight', fill: '#f59e0b', fontSize: 10, fontWeight: 700, dx: -5 }}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: '1px solid #334155', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', backgroundColor: '#1e293b', color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}
                                    formatter={(value, name) => {
                                        if (value === null) return ['—', ''];
                                        return [`${value}h`, name];
                                    }}
                                />
                                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />

                                {/* TODAY marker line */}
                                {projectionChartData.todayLabel && (
                                    <ReferenceLine
                                        x={projectionChartData.todayLabel}
                                        yAxisId="left"
                                        stroke="#f43f5e"
                                        strokeWidth={2}
                                        strokeDasharray="6 3"
                                        label={{ value: 'HOY', position: 'top', fill: '#f43f5e', fontSize: 11, fontWeight: 'bold' }}
                                    />
                                )}

                                {/* Estimated hours target line */}
                                {projectionChartData.estimatedHours > 0 && (
                                    <ReferenceLine
                                        y={projectionChartData.estimatedHours}
                                        yAxisId="left"
                                        stroke="#64748b"
                                        strokeWidth={1}
                                        strokeDasharray="4 4"
                                        label={{ value: `Meta ${projectionChartData.estimatedHours}h`, position: 'right', fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                                    />
                                )}

                                {/* Start Plan marker */}
                                {projectionChartData.points.find(p => p.isStartPlan) && (
                                    <ReferenceLine
                                        x={projectionChartData.points.find(p => p.isStartPlan).name}
                                        yAxisId="left"
                                        stroke="#06b6d4"
                                        strokeWidth={1.5}
                                        strokeDasharray="4 4"
                                        label={{ value: 'INICIO', position: 'insideTopLeft', fill: '#06b6d4', fontSize: 9, fontWeight: 'bold' }}
                                    />
                                )}

                                {/* End Plan marker — dashed thin, label at top */}
                                {projectionChartData.points.find(p => p.isEndPlan) && (
                                    <ReferenceLine
                                        x={projectionChartData.points.find(p => p.isEndPlan).name}
                                        yAxisId="left"
                                        stroke="#d946ef"
                                        strokeWidth={1.5}
                                        strokeDasharray="4 3"
                                        label={{ value: 'FIN PLAN', position: 'top', fill: '#d946ef', fontSize: 9, fontWeight: 'bold' }}
                                    />
                                )}

                                {/* COMPLETED marker line — solid thick, label at bottom */}
                                {projectionChartData.completedLabel && (
                                    <ReferenceLine
                                        x={projectionChartData.completedLabel}
                                        yAxisId="left"
                                        stroke="#22c55e"
                                        strokeWidth={3}
                                        label={{ value: '✅ COMPLETADA', position: 'insideBottomRight', fill: '#22c55e', fontSize: 10, fontWeight: 'bold', dy: -8 }}
                                    />
                                )}

                                {/* Daily hours bars (right axis) */}
                                <Bar yAxisId="right" name="Horas/Día" dataKey="horasDia" fill="url(#colorDailyH)" barSize={18} radius={[4, 4, 0, 0]} />

                                {/* Accumulated hours area+line (left axis) */}
                                <Area yAxisId="left" name="Acumuladas" dataKey="acumuladas" type="monotone" stroke="#10b981" strokeWidth={3} fill="url(#colorAccum)" dot={{ fill: '#10b981', r: 3 }} activeDot={{ r: 6 }} connectNulls={false} />

                                {/* Projection line (left axis) */}
                                <Line yAxisId="left" name="Proyección" dataKey="proyeccion" type="monotone" stroke="#06b6d4" strokeWidth={2} strokeDasharray="8 4" dot={false} connectNulls={true} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* --- CHARTS --- */}
            {analytics && (
                <div className="grid lg:grid-cols-2 gap-5">

                    {/* Trend / Correlation Chart (full width) */}
                    <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg lg:col-span-2">
                        <div className="flex items-center gap-2 mb-5">
                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                            <h3 className="font-bold text-lg text-white">Correlación: Horas vs Avance</h3>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">
                                ¿Muchas horas, pocas subtareas?
                            </span>
                        </div>
                        {analytics.totalEvents === 0 ? (
                            <div className="h-[280px] flex items-center justify-center text-slate-400 font-bold">
                                No hay eventos registrados en este período. Completa subtareas o inicia timers para ver actividad.
                            </div>
                        ) : (
                            <div className="h-[340px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={analytics.trendData} margin={{ top: 15, right: 50, left: 5, bottom: 25 }} style={{ cursor: 'pointer' }}>
                                        <defs>
                                            <linearGradient id="colorHoras" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                        <XAxis dataKey="displayName" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} dy={8} angle={-30} textAnchor="end" height={50} />
                                        <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: '#22c55e', fontWeight: 700 }} axisLine={false} tickLine={false} label={{ value: 'Subtareas', angle: -90, position: 'insideLeft', fill: '#22c55e', fontSize: 11, fontWeight: 700, dx: 5 }} />
                                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#f59e0b', fontWeight: 700 }} axisLine={false} tickLine={false} unit="h" label={{ value: 'Horas', angle: 90, position: 'insideRight', fill: '#f59e0b', fontSize: 11, fontWeight: 700, dx: -5 }} />
                                        <Tooltip
                                            labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
                                            contentStyle={{ borderRadius: '16px', border: '1px solid #334155', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', backgroundColor: '#1e293b', color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}
                                            cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }}
                                            formatter={(value, name) => {
                                                if (value === null) return ['—', ''];
                                                if (name === 'Horas Trabajadas') return [`${value}h`, name];
                                                return [value, name];
                                            }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />

                                        {/* TODAY marker line (only for active tasks) */}
                                        {analytics.todayRefLabel && !analytics.isTaskCompleted && (
                                            <ReferenceLine
                                                x={analytics.todayRefLabel}
                                                yAxisId="left"
                                                stroke="#f43f5e"
                                                strokeWidth={2}
                                                strokeDasharray="6 3"
                                                label={{
                                                    value: 'HOY',
                                                    position: 'top',
                                                    fill: '#f43f5e',
                                                    fontSize: 11,
                                                    fontWeight: 'bold',
                                                }}
                                            />
                                        )}

                                        {/* COMPLETED marker line — solid thick, label at bottom */}
                                        {analytics.completedLabel && (
                                            <ReferenceLine
                                                x={analytics.completedLabel}
                                                yAxisId="left"
                                                stroke="#22c55e"
                                                strokeWidth={3}
                                                label={{
                                                    value: '✅ COMPLETADA',
                                                    position: 'insideBottomRight',
                                                    fill: '#22c55e',
                                                    fontSize: 10,
                                                    fontWeight: 'bold',
                                                    dy: -8,
                                                }}
                                            />
                                        )}

                                        {/* Hours worked - bars (right axis) */}
                                        <Bar yAxisId="right" name="Horas Trabajadas" dataKey="horas" fill="url(#colorHoras)" barSize={20} radius={[4, 4, 0, 0]}
                                            onClick={(data) => {
                                                if (data && !data.isFuture && data.name) {
                                                    // Find the actual YYYY-MM-DD date from the display label
                                                    const dateStr = activityLogs.find(l => {
                                                        const logLabel = format(new Date(l.timestamp), 'dd MMM', { locale: es });
                                                        return logLabel === data.name;
                                                    })?.date;
                                                    if (dateStr) setSelectedDate(prev => prev === dateStr ? null : dateStr);
                                                }
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        />

                                        {/* Subtasks completed - line (left axis) */}
                                        <Line yAxisId="left" type="monotone" name="Subtareas Completadas" dataKey="subtareas" stroke="#22c55e" strokeWidth={3} dot={{ fill: '#22c55e', r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: '#22c55e' }} connectNulls={false} />

                                        {/* Status changes - subtle line (left axis) */}
                                        <Line yAxisId="left" type="monotone" name="Cambios Status" dataKey="status" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 2" dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }} connectNulls={false} />

                                        {/* PLANNED START DATE marker line */}
                                        {focusedTask?.plannedStartDate && (() => {
                                            const label = format(new Date(focusedTask.plannedStartDate.substring(0, 10) + 'T12:00:00'), 'dd MMM', { locale: es });
                                            return (
                                                <ReferenceLine
                                                    x={label}
                                                    yAxisId="left"
                                                    stroke="#06b6d4"
                                                    strokeWidth={2}
                                                    strokeDasharray="6 3"
                                                    label={{
                                                        value: `INICIO ${format(new Date(focusedTask.plannedStartDate.substring(0, 10) + 'T12:00:00'), 'dd/MM', { locale: es })}`,
                                                        position: 'top',
                                                        fill: '#06b6d4',
                                                        fontSize: 10,
                                                        fontWeight: 'bold',
                                                    }}
                                                />
                                            );
                                        })()}

                                        {/* PLANNED END DATE marker line */}
                                        {focusedTask?.plannedEndDate && (() => {
                                            const label = format(new Date(focusedTask.plannedEndDate.substring(0, 10) + 'T12:00:00'), 'dd MMM', { locale: es });
                                            return (
                                                <ReferenceLine
                                                    x={label}
                                                    yAxisId="left"
                                                    stroke="#d946ef"
                                                    strokeWidth={1.5}
                                                    strokeDasharray="4 3"
                                                    label={{
                                                        value: `FIN PLAN ${format(new Date(focusedTask.plannedEndDate.substring(0, 10) + 'T12:00:00'), 'dd/MM', { locale: es })}`,
                                                        position: 'top',
                                                        fill: '#d946ef',
                                                        fontSize: 9,
                                                        fontWeight: 'bold',
                                                    }}
                                                />
                                            );
                                        })()}

                                        {/* DUE DATE marker line */}
                                        {focusedTask?.dueDate && (() => {
                                            const dueDateLabel = format(new Date(focusedTask.dueDate.substring(0, 10) + 'T12:00:00'), 'dd MMM', { locale: es });
                                            return (
                                                <ReferenceLine
                                                    x={dueDateLabel}
                                                    yAxisId="left"
                                                    stroke="#f59e0b"
                                                    strokeWidth={2}
                                                    strokeDasharray="8 4"
                                                    label={{
                                                        value: `LÍMITE ${format(new Date(focusedTask.dueDate.substring(0, 10) + 'T12:00:00'), 'dd/MM', { locale: es })}`,
                                                        position: 'top',
                                                        fill: '#f59e0b',
                                                        fontSize: 10,
                                                        fontWeight: 'bold',
                                                    }}
                                                />
                                            );
                                        })()}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Donut: Event Type Distribution (general mode) */}
                    {!activeTaskId && analytics.eventTypeDistribution.length > 0 && (
                        <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg">
                            <div className="flex items-center gap-2 mb-5">
                                <Activity className="w-5 h-5 text-violet-400" />
                                <h3 className="font-bold text-lg text-white">Distribución por Tipo</h3>
                            </div>
                            <div className="flex flex-col lg:flex-row items-center gap-6">
                                <div className="h-[220px] w-[220px] shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={analytics.eventTypeDistribution}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={55}
                                                outerRadius={90}
                                                paddingAngle={3}
                                                dataKey="value"
                                                stroke="none"
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {analytics.eventTypeDistribution.map((entry, idx) => (
                                                    <Cell
                                                        key={idx}
                                                        fill={entry.color}
                                                        opacity={selectedEventType && selectedEventType !== entry.type ? 0.3 : 1}
                                                        onClick={() => handleDonutClick(entry)}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0', fontSize: '12px' }}
                                                formatter={(value, name) => [`${value} eventos`, name]}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {analytics.eventTypeDistribution.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleDonutClick(item)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                                selectedEventType === item.type
                                                    ? 'bg-violet-500/20 border-violet-500/50 ring-1 ring-violet-500/30'
                                                    : selectedEventType
                                                        ? 'bg-slate-800/30 border-slate-700/30 opacity-50'
                                                        : 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-700/60'
                                            }`}
                                        >
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                            <span className="text-xs font-bold text-slate-300">{item.name}</span>
                                            <span className="text-xs font-mono text-slate-500">{item.value}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Task Lifeline (task-specific mode) */}
                    {activeTaskId && (analytics.taskCreatedLog || analytics.taskCompletedLog) && (
                        <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg">
                            <div className="flex items-center gap-2 mb-5">
                                <CalendarIcon className="w-5 h-5 text-blue-400" />
                                <h3 className="font-bold text-lg text-white">Ciclo de Vida</h3>
                            </div>
                            <div className="relative">
                                {/* Gantt-like horizontal bar */}
                                <div className="flex items-center gap-4">
                                    {/* Start marker */}
                                    <div className="flex flex-col items-center shrink-0">
                                        <span className="text-lg">🆕</span>
                                        <span className="text-[10px] font-bold text-blue-400 mt-1">
                                            {analytics.taskCreatedLog
                                                ? format(new Date(analytics.taskCreatedLog.timestamp), 'dd MMM yyyy', { locale: es })
                                                : '—'}
                                        </span>
                                        <span className="text-[9px] text-slate-500 font-bold">Creada</span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="flex-1 relative h-8">
                                        <div className="absolute inset-0 bg-slate-800 rounded-full border border-slate-700" />
                                        <div
                                            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                                            style={{
                                                width: analytics.taskCompletedLog ? '100%' : '60%',
                                                background: analytics.taskCompletedLog
                                                    ? 'linear-gradient(90deg, #3b82f6, #22c55e)'
                                                    : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                                            }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-[11px] font-black text-white drop-shadow-lg">
                                                {analytics.taskCreatedLog && analytics.taskCompletedLog
                                                    ? (() => {
                                                        const start = new Date(analytics.taskCreatedLog.timestamp);
                                                        const end = new Date(analytics.taskCompletedLog.timestamp);
                                                        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                                                        return `${days} día${days !== 1 ? 's' : ''}`;
                                                    })()
                                                    : analytics.taskCreatedLog
                                                        ? (() => {
                                                            const start = new Date(analytics.taskCreatedLog.timestamp);
                                                            const days = Math.ceil((new Date() - start) / (1000 * 60 * 60 * 24));
                                                            return `${days} día${days !== 1 ? 's' : ''} (en curso)`;
                                                        })()
                                                        : '—'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* End marker */}
                                    <div className="flex flex-col items-center shrink-0">
                                        <span className="text-lg">{analytics.taskCompletedLog ? '🏁' : '⏳'}</span>
                                        <span className={`text-[10px] font-bold mt-1 ${analytics.taskCompletedLog ? 'text-emerald-400' : 'text-amber-400'}`}>
                                            {analytics.taskCompletedLog
                                                ? format(new Date(analytics.taskCompletedLog.timestamp), 'dd MMM yyyy', { locale: es })
                                                : 'En progreso'}
                                        </span>
                                        <span className="text-[9px] text-slate-500 font-bold">
                                            {analytics.taskCompletedLog ? 'Completada' : 'Pendiente'}
                                        </span>
                                    </div>
                                </div>

                                {/* Priority change badges */}
                                {(() => {
                                    const priorityLogs = (activityLogs || []).filter(
                                        l => l.taskId === activeTaskId && l.type === 'priority_changed'
                                    );
                                    if (priorityLogs.length === 0) return null;
                                    return (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <span className="text-[10px] font-bold text-slate-500 self-center">Prioridad:</span>
                                            {priorityLogs.map((pl, i) => (
                                                <span key={i} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-orange-500/10 border border-orange-500/20 text-orange-300">
                                                    🔺 {pl.meta?.from} → {pl.meta?.to}
                                                    <span className="text-slate-500 ml-1">
                                                        ({format(new Date(pl.timestamp), 'dd MMM', { locale: es })})
                                                    </span>
                                                </span>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Top Tasks BarChart */}
                    <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg">
                        <div className="flex items-center gap-2 mb-5">
                            <Activity className="w-5 h-5 text-indigo-400" />
                            <h3 className="font-bold text-lg text-white">Tareas Más Activas</h3>
                        </div>
                        {analytics.topTasks.length === 0 ? (
                            <div className="h-[250px] flex items-center justify-center text-slate-400 font-bold">Sin datos</div>
                        ) : (
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.topTasks} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} width={160} />
                                        <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ borderRadius: '12px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0' }} />
                                        <Bar dataKey="eventos" name="Eventos" radius={[0, 6, 6, 0]} barSize={20}
                                            onClick={(data) => {
                                                if (data?.taskId) handleTaskClick(data.taskId);
                                            }}
                                        >
                                            {analytics.topTasks.map((entry, index) => (
                                                <Cell key={index}
                                                    fill={entry.taskId === selectedTaskId ? '#22c55e' : '#6366f1'}
                                                    fillOpacity={selectedTaskId && entry.taskId !== selectedTaskId ? 0.3 : 1}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                    {/* Timeline (detailed events) */}
                    <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg">
                        <div className="flex items-center gap-2 mb-5">
                            <Activity className="w-5 h-5 text-emerald-400" />
                            <h3 className="font-bold text-lg text-white">Timeline Detallado</h3>
                        </div>
                        {analytics.totalEvents === 0 ? (
                            <div className="h-[300px] flex items-center justify-center text-slate-400 font-bold">Sin eventos registrados</div>
                        ) : (
                            <div className="max-h-[400px] overflow-y-auto pr-2 space-y-4">
                                {Object.entries(analytics.timelineByDay).slice(0, 10).map(([dateStr, logs]) => (
                                    <div key={dateStr}>
                                        <div className="sticky top-0 bg-slate-900/90 backdrop-blur-sm py-1 mb-2 z-10">
                                            <span className="text-[11px] font-black text-indigo-400 uppercase tracking-wider">
                                                {formatDayLabel(dateStr)}
                                            </span>
                                        </div>
                                        <div className="space-y-1 ml-2 border-l-2 border-slate-700 pl-4">
                                            {logs.slice(0, 20).map((log) => {
                                                const isEditing = editingLog?.id === log.id;
                                                return (
                                                <div key={log.id}
                                                    className={`flex items-start gap-2 py-1.5 group rounded-lg px-2 -ml-2 transition-all cursor-pointer ${
                                                        selectedTaskId && log.taskId !== selectedTaskId
                                                            ? 'opacity-30'
                                                            : 'hover:bg-slate-800/50'
                                                    } ${log.taskId === selectedTaskId ? 'bg-indigo-900/20 border border-indigo-500/20' : ''}`}
                                                    onClick={() => !isEditing && handleTaskClick(log.taskId)}
                                                >
                                                    <span className="text-base shrink-0 mt-0.5">
                                                        {EVENT_ICONS[log.type] || '📋'}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        {isEditing ? (
                                                            <div className="space-y-1">
                                                                <input
                                                                    value={editingLog.description}
                                                                    onChange={e => setEditingLog(prev => ({ ...prev, description: e.target.value }))}
                                                                    className="w-full px-2 py-1 bg-slate-800 border border-indigo-500 rounded text-sm text-slate-200 outline-none"
                                                                    placeholder="Descripción"
                                                                />
                                                                <select
                                                                    value={editingLog.userId}
                                                                    onChange={e => {
                                                                        const uid = e.target.value;
                                                                        const member = teamMembers?.find(m => (m.uid || m.id) === uid);
                                                                        setEditingLog(prev => ({
                                                                            ...prev,
                                                                            userId: uid,
                                                                            userName: member?.displayName || member?.name || ''
                                                                        }));
                                                                    }}
                                                                    className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 outline-none cursor-pointer"
                                                                >
                                                                    <option value="">— Seleccionar persona —</option>
                                                                    {(teamMembers || []).map(m => (
                                                                        <option key={m.uid || m.id} value={m.uid || m.id}>
                                                                            {m.displayName || m.name || m.email?.split('@')[0] || 'Sin nombre'}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <div className="flex gap-1">
                                                                    <button onClick={saveEdit}
                                                                        className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded hover:bg-emerald-500 flex items-center gap-1">
                                                                        <Save className="w-3 h-3" /> Guardar
                                                                    </button>
                                                                    <button onClick={cancelEditing}
                                                                        className="px-2 py-0.5 bg-slate-700 text-slate-300 text-[10px] font-bold rounded hover:bg-slate-600">
                                                                        Cancelar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <p className="text-sm text-slate-200 font-medium leading-snug">
                                                                    {log.description}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className="text-[10px] font-bold text-slate-500">
                                                                        {formatTime(log.timestamp)}
                                                                    </span>
                                                                    {log.userId && (
                                                                        <span className="text-[10px] font-bold text-slate-500">
                                                                            · {log.userName || getUserName(log.userId)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    {!isEditing && isAdmin && (
                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                            <button onClick={() => startEditing(log)}
                                                                className="p-1 text-slate-500 hover:text-indigo-400 transition-colors" title="Editar">
                                                                <Pencil className="w-3 h-3" />
                                                            </button>
                                                            <button onClick={() => handleDelete(log)}
                                                                className="p-1 text-slate-500 hover:text-red-400 transition-colors" title="Eliminar">
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div
                                                        className="w-2 h-2 rounded-full shrink-0 mt-2"
                                                        style={{ backgroundColor: EVENT_COLORS[log.type] || '#64748b' }}
                                                    />
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>


                </div>
            )}

            {/* Task Detail Modal */}
            {isTaskModalOpen && selectedTaskForModal && (
                <TaskDetailModal
                    task={selectedTaskForModal}
                    isOpen={isTaskModalOpen}
                    onClose={() => { setIsTaskModalOpen(false); setSelectedTaskForModal(null); }}
                    projects={engProjects}
                    subtasks={(engSubtasks || []).filter(s => s.taskId === selectedTaskForModal.id)}
                    taskTypes={taskTypes || []}
                    teamMembers={teamMembers || []}
                    canEdit={canEdit}
                    canDelete={canDelete}
                />
            )}

        </div>
    );
}
