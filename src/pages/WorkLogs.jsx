import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { useAppData } from '../contexts/AppDataContext';
import ActiveTimer from '../components/time/ActiveTimer';
import ManualTimeEntry from '../components/time/ManualTimeEntry';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import { deleteTimeLog, formatDuration, setActiveTimer, recalculateTaskHours } from '../services/timeService';
import { db } from '../firebase';
import { updateDoc, doc } from 'firebase/firestore';
import {
    Clock, Plus, Trash2, Zap, Calendar, ListTodo, FolderGit2,
    BarChart3, ChevronLeft, ChevronRight, FileText, AlertTriangle,
    User, MessageCircle, Pencil
} from 'lucide-react';

export default function WorkLogs() {
    const { user } = useAuth();
    const { canEdit, canDelete } = useRole();
    const { engProjects, engTasks, engSubtasks, timeLogs, teamMembers, taskTypes } = useAppData();

    // Get selectedUser from shared ReportsLayout via outlet context
    const outletCtx = useOutletContext() || {};
    const selectedUser = outletCtx.selectedUser || user?.uid || '';

    const [showManual, setShowManual] = useState(false);
    const [editingLog, setEditingLog] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [weekOffset, setWeekOffset] = useState(0);
    const [deletingId, setDeletingId] = useState(null);
    const [deleteError, setDeleteError] = useState('');

    // --- Week Navigation ---
    const weekDates = useMemo(() => {
        const now = new Date();
        now.setDate(now.getDate() + weekOffset * 7);
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        monday.setHours(0, 0, 0, 0);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            days.push(d);
        }
        return days;
    }, [weekOffset]);

    const weekStart = weekDates[0];
    const weekEnd = weekDates[6];

    // --- Logs for selected user + current week ---
    const myWeekLogs = useMemo(() => {
        const uid = selectedUser || user?.uid;
        if (!uid) return [];
        return timeLogs
            .filter(log => {
                if (log.userId !== uid) return false;
                if (!log.startTime) return false;
                const logDate = new Date(log.startTime);
                return logDate >= weekStart && logDate <= new Date(weekEnd.getTime() + 86400000);
            })
            .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    }, [timeLogs, selectedUser, user, weekStart, weekEnd]);

    // --- Aggregations ---
    const weekStats = useMemo(() => {
        let totalHours = 0;
        let overtimeHours = 0;
        const byProject = {};
        const byDay = {};

        myWeekLogs.forEach(log => {
            totalHours += log.totalHours || 0;
            if (log.overtime) overtimeHours += log.overtimeHours || log.totalHours || 0;

            const pId = log.projectId || 'sin_proyecto';
            if (!byProject[pId]) byProject[pId] = 0;
            byProject[pId] += log.totalHours || 0;

            if (log.startTime) {
                const dayKey = new Date(log.startTime).toLocaleDateString('es', { weekday: 'short' });
                if (!byDay[dayKey]) byDay[dayKey] = 0;
                byDay[dayKey] += log.totalHours || 0;
            }
        });

        return { totalHours, overtimeHours, byProject, byDay, logCount: myWeekLogs.length };
    }, [myWeekLogs]);

    // --- Helpers ---
    const getTaskName = (taskId) => engTasks.find(t => t.id === taskId)?.title || '';
    const getProjectName = (projectId) => engProjects.find(p => p.id === projectId)?.name || '';
    const getPersonName = (log) => {
        const member = teamMembers?.find(m => m.uid === log.userId || m.id === log.userId);
        if (member?.name) return member.name;
        if (member?.displayName) return member.displayName;
        if (log.displayName && log.displayName !== "Usuario") return log.displayName;
        if (member?.email) return member.email.split("@")[0];
        return '';
    };

    const formatTime = (isoString) => {
        if (!isoString) return '--:--';
        return new Date(isoString).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (isoString) => {
        if (!isoString) return '';
        return new Date(isoString).toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short' });
    };

    // Duration with seconds (h:mm:ss)
    const formatDurationSec = (hours) => {
        if (!hours || hours <= 0) return '0:00:00';
        const totalSec = Math.round(hours * 3600);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const openTaskPopup = (taskId) => {
        const task = engTasks.find(t => t.id === taskId);
        if (task) {
            setSelectedTask(task);
            setIsTaskModalOpen(true);
        }
    };

    return (
        <div className="space-y-5">
            <ManualTimeEntry
                isOpen={showManual || !!editingLog}
                onClose={() => { setShowManual(false); setEditingLog(null); }}
                tasks={engTasks}
                projects={engProjects}
                userId={user?.uid}
                editLog={editingLog}
            />

            {/* Action bar (smaller, no duplicate banner) */}
            <div className="flex items-center justify-between gap-3">
                {deleteError && (
                    <div className="bg-red-500/15 text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-red-500/30 flex items-center">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {deleteError}
                    </div>
                )}
                <div className="ml-auto flex gap-2">
                    {canEdit && (
                        <button
                            onClick={() => setShowManual(true)}
                            className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-black shadow-lg shadow-emerald-500/20 flex items-center justify-center active:scale-95 transition-transform text-sm border border-emerald-500"
                        >
                            <Plus className="mr-2 w-4 h-4" /> Registro Manual
                        </button>
                    )}
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
                {/* LEFT: Timer + Stats */}
                <div className="space-y-5">
                    {/* Active Timer */}
                    <ActiveTimer
                        tasks={engTasks}
                        projects={engProjects}
                        userId={user?.uid}
                        onTimerStop={() => { }}
                    />

                    {/* Week Stats Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-900/70 rounded-xl border border-slate-800 p-4 shadow-lg">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horas Totales</span>
                            <p className="text-3xl font-black text-indigo-400 mt-1 tabular-nums">
                                {formatDuration(weekStats.totalHours)}
                            </p>
                        </div>
                        <div className="bg-slate-900/70 rounded-xl border border-slate-800 p-4 shadow-lg">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Zap className="w-3 h-3 text-amber-500" /> Extras
                            </span>
                            <p className={`text-3xl font-black mt-1 tabular-nums ${weekStats.overtimeHours > 0 ? 'text-amber-500' : 'text-slate-300'
                                }`}>
                                {formatDuration(weekStats.overtimeHours)}
                            </p>
                        </div>
                    </div>

                    {/* Per-project breakdown */}
                    {Object.keys(weekStats.byProject).length > 0 && (
                        <div className="bg-slate-900/70 rounded-xl border border-slate-800 p-4 shadow-lg">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block flex items-center gap-1">
                                <BarChart3 className="w-3 h-3" /> Por Proyecto
                            </span>
                            <div className="space-y-2">
                                {Object.entries(weekStats.byProject)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([pId, hours]) => (
                                        <div key={pId} className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-300 truncate max-w-[140px]">
                                                {pId === 'sin_proyecto' ? 'Sin proyecto' : getProjectName(pId) || pId.slice(0, 8)}
                                            </span>
                                            <span className="text-xs font-black text-indigo-400 tabular-nums">{formatDuration(hours)}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT: Log History */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Week Navigator */}
                    <div className="flex items-center justify-between bg-slate-900/70 rounded-xl border border-slate-800 p-3 shadow-lg">
                        <button
                            onClick={() => setWeekOffset(w => w - 1)}
                            className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="text-center">
                            <span className="text-xs font-black text-slate-200">
                                {weekStart.toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                                {' — '}
                                {weekEnd.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            {weekOffset === 0 && (
                                <span className="ml-2 text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                    Esta semana
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setWeekOffset(w => w + 1)}
                            className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400"
                            disabled={weekOffset >= 0}
                        >
                            <ChevronRight className={`w-5 h-5 ${weekOffset >= 0 ? 'text-slate-700' : ''}`} />
                        </button>
                    </div>

                    {/* Logs List */}
                    {myWeekLogs.length === 0 ? (
                        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-12 text-center">
                            <Clock className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                            <h3 className="text-sm font-bold text-slate-400 mb-1">Sin registros esta semana</h3>
                            <p className="text-xs text-slate-500">Inicia el timer o crea un registro manual</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {myWeekLogs.map(log => {
                                const isRunning = !log.endTime;
                                return (
                                    <div
                                        key={log.id}
                                        onClick={() => { if (!isRunning) setEditingLog(log); }}
                                        className={`bg-slate-900/60 rounded-xl border p-4 transition-all hover:shadow-lg group ${!isRunning ? 'cursor-pointer hover:border-indigo-500/40' : ''
                                            } ${isRunning ? 'border-green-500/50 ring-1 ring-green-500/20' :
                                                log.overtime ? 'border-amber-500/30' : 'border-slate-800'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                {/* Task + Project */}
                                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                    {isRunning && (
                                                        <span className="text-[9px] font-bold text-green-400 bg-green-500/15 px-2 py-0.5 rounded-full flex items-center gap-1 border border-green-500/30">
                                                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> EN CURSO
                                                        </span>
                                                    )}
                                                    {log.taskId && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openTaskPopup(log.taskId); }}
                                                            className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg flex items-center gap-1 truncate max-w-[200px] hover:bg-indigo-100 hover:ring-1 hover:ring-indigo-300 transition-all cursor-pointer"
                                                            title="Abrir tarea"
                                                        >
                                                            <ListTodo className="w-3 h-3 flex-shrink-0" /> {getTaskName(log.taskId)}
                                                        </button>
                                                    )}
                                                    {!log.taskId && !isRunning && (
                                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-lg">Sin tarea</span>
                                                    )}
                                                    {log.projectId && (
                                                        <span
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="text-[10px] font-bold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-lg flex items-center gap-1 truncate max-w-[150px]"
                                                        >
                                                            <FolderGit2 className="w-3 h-3 flex-shrink-0" /> {getProjectName(log.projectId)}
                                                        </span>
                                                    )}
                                                    {log.overtime && (
                                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                                            <Zap className="w-3 h-3" /> EXTRA
                                                        </span>
                                                    )}
                                                    {log.source === 'telegram' && (
                                                        <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                                            <MessageCircle className="w-3 h-3" /> Telegram
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Person name */}
                                                {getPersonName(log) && (
                                                    <div className="flex items-center gap-1 mb-1">
                                                        <User className="w-3 h-3 text-emerald-400" />
                                                        <span className="text-[11px] font-bold text-emerald-400">
                                                            {getPersonName(log)}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Time range + Date */}
                                                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" /> {formatDate(log.startTime)}
                                                    </span>
                                                    <span>
                                                        {formatTime(log.startTime)} – {isRunning ? <span className="text-green-400 font-bold">En curso...</span> : formatTime(log.endTime)}
                                                    </span>
                                                </div>

                                                {/* Notes */}
                                                {log.notes && (
                                                    <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                                                        <FileText className="w-3 h-3 flex-shrink-0" /> {log.notes}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Hours + Actions */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className={`text-lg font-black tabular-nums ${isRunning ? 'text-green-400' :
                                                    log.overtime ? 'text-amber-500' : 'text-indigo-600'
                                                    }`}>
                                                    {isRunning ? '⏱' : formatDurationSec(log.totalHours)}
                                                </span>

                                                {/* Stop button for running logs */}
                                                {isRunning && (canEdit || log.userId === user?.uid) && (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (deletingId) return;
                                                            setDeletingId(log.id);
                                                            setDeleteError('');
                                                            try {
                                                                const now = new Date();
                                                                const startTime = new Date(log.startTime);
                                                                const totalMs = now - startTime;
                                                                let totalHours = parseFloat((totalMs / 3600000).toFixed(6));
                                                                if (totalHours < 0.016666) totalHours = 0.016666;
                                                                await updateDoc(doc(db, 'timeLogs', log.id), {
                                                                    endTime: now.toISOString(),
                                                                    totalHours,
                                                                    overtimeHours: log.overtime ? totalHours : 0,
                                                                });
                                                                // Clear localStorage timer + notify ActiveTimer component
                                                                setActiveTimer(null);
                                                                window.dispatchEvent(new StorageEvent('storage', { key: 'autobom_active_timer' }));
                                                                // Recalculate task hours if applicable
                                                                if (log.taskId) await recalculateTaskHours(log.taskId);
                                                            } catch (err) {
                                                                console.error("Stop Error:", err);
                                                                setDeleteError(err.message || "Error deteniendo el timer");
                                                            } finally {
                                                                setDeletingId(null);
                                                            }
                                                        }}
                                                        disabled={deletingId === log.id}
                                                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all disabled:bg-slate-500"
                                                        title="Detener timer"
                                                    >
                                                        {deletingId === log.id ? '...' : '⏹ Detener'}
                                                    </button>
                                                )}

                                                {/* Edit button for completed logs */}
                                                {!isRunning && (canEdit || log.userId === user?.uid) && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setEditingLog(log); }}
                                                        className="p-1.5 rounded-lg transition-all text-indigo-400 opacity-0 group-hover:opacity-100 hover:bg-indigo-50"
                                                        title="Editar registro"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                )}

                                                {/* Delete button — always visible for running, hover for others */}
                                                {(canDelete || log.userId === user?.uid) && (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (deletingId) return;
                                                            setDeletingId(log.id);
                                                            setDeleteError('');
                                                            try {
                                                                await deleteTimeLog(log.id, log.taskId, log.projectId);
                                                            } catch (err) {
                                                                console.error("Delete Error:", err);
                                                                setDeleteError(err.message || "Error eliminando el registro");
                                                            } finally {
                                                                setDeletingId(null);
                                                            }
                                                        }}
                                                        disabled={deletingId === log.id}
                                                        className={`p-1.5 rounded-lg transition-all ${deletingId === log.id
                                                            ? 'text-slate-400 cursor-not-allowed bg-slate-100 opacity-100'
                                                            : isRunning
                                                                ? 'text-red-400 opacity-100 hover:bg-red-50'
                                                                : 'text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-50'
                                                            }`}
                                                        title="Eliminar registro"
                                                    >
                                                        {deletingId === log.id ? (
                                                            <Clock className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Task Detail Modal */}
            {isTaskModalOpen && selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    isOpen={isTaskModalOpen}
                    onClose={() => { setIsTaskModalOpen(false); setSelectedTask(null); }}
                    projects={engProjects}
                    subtasks={(engSubtasks || []).filter(s => s.taskId === selectedTask.id)}
                    taskTypes={taskTypes || []}
                    teamMembers={teamMembers || []}
                    userId={user?.uid}
                    canEdit={canEdit}
                    canDelete={canDelete}
                />
            )}
        </div>
    );
}
