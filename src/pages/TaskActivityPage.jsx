import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { fetchAllActivityLogs, updateActivityLog, deleteActivityLog } from '../services/activityLogService';
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
    Activity, TrendingUp, CheckSquare, RefreshCw, Timer, AlertTriangle,
    Calendar as CalendarIcon, X, ChevronDown, Check, FolderGit2, User,
    Pencil, Trash2, Save
} from 'lucide-react';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

const EVENT_COLORS = {
    subtask_completed: '#22c55e',
    subtask_unchecked: '#64748b',
    status_changed: '#6366f1',
    timer_started: '#f59e0b',
    timer_stopped: '#f59e0b',
    delay_reported: '#ef4444',
};

const EVENT_ICONS = {
    subtask_completed: '✅',
    subtask_unchecked: '⬜',
    status_changed: '🔄',
    timer_started: '▶️',
    timer_stopped: '⏹️',
    delay_reported: '⚠️',
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
    const { engProjects, engTasks, teamMembers } = useEngineeringData();

    // Filter state
    const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedPersons, setSelectedPersons] = useState([]);
    const [selectedProjects, setSelectedProjects] = useState([]);

    // Data
    const [activityLogs, setActivityLogs] = useState([]);
    const [loading, setLoading] = useState(false);

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

    // Fetch activity logs when date range changes
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const logs = await fetchAllActivityLogs(dateFrom, dateTo);
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
    }, [dateFrom, dateTo]);

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

    const hasActiveFilters = selectedPersons.length > 0 || selectedProjects.length > 0;

    // Analytics computed from logs
    const analytics = useMemo(() => {
        if (!activityLogs || !engTasks) return null;

        // Build a task lookup for project filtering
        const taskProjectMap = {};
        engTasks.forEach(t => { taskProjectMap[t.id] = t.projectId; });

        // Filter logs
        const filtered = activityLogs.filter(log => {
            if (selectedPersons.length > 0 && !selectedPersons.includes(log.userId)) return false;
            if (selectedProjects.length > 0) {
                const projId = taskProjectMap[log.taskId];
                if (!projId || !selectedProjects.includes(projId)) return false;
            }
            return true;
        });

        // KPIs
        const kpis = {
            subtasksCompleted: filtered.filter(l => l.type === 'subtask_completed').length,
            statusChanges: filtered.filter(l => l.type === 'status_changed').length,
            timerSessions: filtered.filter(l => l.type === 'timer_started').length,
            delaysReported: filtered.filter(l => l.type === 'delay_reported').length,
        };

        // Trend data (events per day)
        const startDate = new Date(dateFrom + 'T00:00:00');
        const endDate = new Date(dateTo + 'T00:00:00');
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const trendMap = new Map();
        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            trendMap.set(dateStr, {
                name: format(day, 'dd MMM', { locale: es }),
                subtareas: 0,
                timers: 0,
                status: 0,
            });
        });

        filtered.forEach(log => {
            const dateStr = log.date;
            if (trendMap.has(dateStr)) {
                const d = trendMap.get(dateStr);
                if (log.type === 'subtask_completed') d.subtareas++;
                if (log.type === 'timer_started' || log.type === 'timer_stopped') d.timers++;
                if (log.type === 'status_changed') d.status++;
            }
        });

        const trendData = Array.from(trendMap.values()).map((d, i, arr) => {
            const showLabel = arr.length <= 14 || i % Math.ceil(arr.length / 14) === 0;
            return { ...d, displayName: showLabel ? d.name : '' };
        });

        // Top tasks by activity
        const taskCountMap = new Map();
        filtered.forEach(log => {
            if (!log.taskId) return;
            taskCountMap.set(log.taskId, (taskCountMap.get(log.taskId) || 0) + 1);
        });
        const topTasks = Array.from(taskCountMap.entries())
            .map(([taskId, count]) => {
                const task = engTasks.find(t => t.id === taskId);
                return {
                    name: task ? (task.title.length > 30 ? task.title.substring(0, 30) + '...' : task.title) : taskId.slice(0, 8),
                    eventos: count,
                };
            })
            .sort((a, b) => b.eventos - a.eventos)
            .slice(0, 8);

        // Timeline (grouped by day)
        const timelineByDay = {};
        filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        filtered.forEach(log => {
            const dateStr = log.date;
            if (!timelineByDay[dateStr]) timelineByDay[dateStr] = [];
            timelineByDay[dateStr].push(log);
        });

        return { kpis, trendData, topTasks, timelineByDay, totalEvents: filtered.length };
    }, [activityLogs, selectedPersons, selectedProjects, engTasks, dateFrom, dateTo]);

    // Helpers
    const clearFilters = () => {
        setDateFrom(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
        setDateTo(format(new Date(), 'yyyy-MM-dd'));
        setSelectedPersons([]);
        setSelectedProjects([]);
    };

    const applyPreset = (days) => {
        setDateTo(format(new Date(), 'yyyy-MM-dd'));
        setDateFrom(format(subDays(new Date(), days), 'yyyy-MM-dd'));
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
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
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

            {/* --- FILTER BAR --- */}
            <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg relative z-20">
                <div className="flex items-center justify-between p-4 pb-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-600/20 border border-emerald-500/30 rounded-xl flex items-center justify-center">
                            <Activity className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="font-black text-xl text-white tracking-tight">Actividad de Tareas</h2>
                            <p className="text-[11px] text-slate-500 font-bold">Timeline de eventos · Datos en tiempo real</p>
                        </div>
                    </div>
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                        >
                            <X className="w-3.5 h-3.5" /> Limpiar filtros
                        </button>
                    )}
                </div>

                <div className="p-4 flex flex-wrap items-center gap-3">
                    {/* Date Range */}
                    <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl p-1 pl-3">
                        <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-slate-200 py-1 px-1 focus:ring-0 outline-none w-[120px]" />
                        <span className="text-slate-500 text-xs font-bold">→</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            max={format(new Date(), 'yyyy-MM-dd')}
                            className="bg-transparent border-none text-sm font-bold text-slate-200 py-1 px-1 focus:ring-0 outline-none w-[120px]" />
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

                    <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
                        <span className="text-[10px] font-black tracking-wider text-amber-400 uppercase">Sesiones de Timer</span>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0">
                                <Timer className="w-6 h-6" />
                            </div>
                            <span className="text-3xl font-black text-white">{analytics.kpis.timerSessions}</span>
                        </div>
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

            {/* --- CHARTS --- */}
            {analytics && (
                <div className="grid lg:grid-cols-2 gap-5">

                    {/* Trend AreaChart (full width) */}
                    <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg lg:col-span-2">
                        <div className="flex items-center gap-2 mb-5">
                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                            <h3 className="font-bold text-lg text-white">Tendencia de Actividad</h3>
                        </div>
                        {analytics.totalEvents === 0 ? (
                            <div className="h-[280px] flex items-center justify-center text-slate-400 font-bold">
                                No hay eventos registrados en este período. Completa subtareas o inicia timers para ver actividad.
                            </div>
                        ) : (
                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={analytics.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorSubtareas" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorTimers" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorStatus" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                        <XAxis dataKey="displayName" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
                                            contentStyle={{ borderRadius: '16px', border: '1px solid #334155', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', backgroundColor: '#1e293b', color: '#e2e8f0' }}
                                            cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                                        <Area type="monotone" name="Subtareas" dataKey="subtareas" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorSubtareas)" />
                                        <Area type="monotone" name="Timers" dataKey="timers" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorTimers)" />
                                        <Area type="monotone" name="Status" dataKey="status" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorStatus)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

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
                                    <BarChart data={analytics.topTasks} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} width={160} />
                                        <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ borderRadius: '12px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0' }} />
                                        <Bar dataKey="eventos" name="Eventos" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={20} />
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
                                                    className="flex items-start gap-2 py-1.5 group hover:bg-slate-800/50 rounded-lg px-2 -ml-2 transition-colors"
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
                                                    {!isEditing && (
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

        </div>
    );
}
