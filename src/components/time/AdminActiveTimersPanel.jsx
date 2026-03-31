import React, { useState, useEffect, useRef } from 'react';
import {
    Users, Clock, Square, Pencil, X, Check,
    ListTodo, FolderGit2, User, AlertTriangle
} from 'lucide-react';
import { stopTimer, formatElapsed } from '../../services/timeService';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { COLLECTIONS } from '../../models/schemas';

/**
 * AdminActiveTimersPanel
 * Shows ALL currently running timers across ALL users.
 * Only visible for admin / manager / team_lead.
 *
 * Features:
 *  - See who is tracking time right now
 *  - Stop any timer
 *  - Edit the start time of a running timer
 */
export default function AdminActiveTimersPanel({
    timeLogs, teamMembers, tasks, projects, canManageOthers
}) {
    if (!canManageOthers) return null;

    // All running timers (endTime is null/empty)
    const runningTimers = (timeLogs || []).filter(log => !log.endTime && log.startTime);

    if (runningTimers.length === 0) return null;

    return (
        <div className="bg-slate-900/70 rounded-2xl border border-emerald-500/30 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Timers Activos del Equipo
                </span>
                <span className="ml-auto bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-500/30">
                    {runningTimers.length} {runningTimers.length === 1 ? 'activo' : 'activos'}
                </span>
            </div>

            {/* Timer rows */}
            <div className="divide-y divide-slate-800/60">
                {runningTimers.map(log => (
                    <ActiveTimerRow
                        key={log.id}
                        log={log}
                        teamMembers={teamMembers}
                        tasks={tasks}
                        projects={projects}
                    />
                ))}
            </div>
        </div>
    );
}

function ActiveTimerRow({ log, teamMembers, tasks, projects }) {
    const [elapsed, setElapsed] = useState('0:00:00');
    const [isStopping, setIsStopping] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editStartTime, setEditStartTime] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const intervalRef = useRef(null);

    // Tick elapsed
    useEffect(() => {
        if (log.startTime) {
            const tick = () => setElapsed(formatElapsed(log.startTime));
            tick();
            intervalRef.current = setInterval(tick, 1000);
            return () => clearInterval(intervalRef.current);
        }
    }, [log.startTime]);

    // Resolve names
    const member = teamMembers?.find(m => m.uid === log.userId || m.id === log.userId);
    const userName = member?.displayName || member?.name || member?.email?.split('@')[0] || 'Usuario';
    const taskName = log.taskId ? tasks?.find(t => t.id === log.taskId)?.title : null;
    const projectName = log.projectId ? projects?.find(p => p.id === log.projectId)?.name : null;

    // Elapsed hours for warning
    const elapsedHours = parseInt(elapsed.split(':')[0] || '0');

    const handleStop = async () => {
        setIsStopping(true);
        try {
            await stopTimer(log.id);
        } catch (e) {
            console.error('Error stopping timer:', e);
        }
        setIsStopping(false);
    };

    const handleEditStart = () => {
        // Convert ISO startTime to local datetime-local format
        const dt = new Date(log.startTime);
        const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
            .toISOString().slice(0, 16);
        setEditStartTime(local);
        setIsEditing(true);
    };

    const handleSaveStartTime = async () => {
        if (!editStartTime) return;
        setIsSaving(true);
        try {
            const newStart = new Date(editStartTime).toISOString();
            await updateDoc(doc(db, COLLECTIONS.TIME_LOGS, log.id), {
                startTime: newStart,
            });
            setIsEditing(false);
        } catch (e) {
            console.error('Error updating start time:', e);
        }
        setIsSaving(false);
    };

    // Initials helper
    const getInitials = () => {
        const name = userName || '?';
        const parts = name.trim().split(/\s+/);
        return parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : name[0].toUpperCase();
    };

    return (
        <div className={`px-5 py-4 transition-all ${elapsedHours >= 8 ? 'bg-red-500/5' : ''}`}>
            <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black ring-2 ring-emerald-500/30 shrink-0"
                    style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', color: '#065f46' }}
                    title={userName}
                >
                    {getInitials()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-black text-white truncate">{userName}</span>
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {taskName && (
                            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/15 px-2 py-0.5 rounded-lg flex items-center gap-1 truncate max-w-[180px]">
                                <ListTodo className="w-3 h-3 shrink-0" /> {taskName}
                            </span>
                        )}
                        {projectName && (
                            <span className="text-[10px] font-bold text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded-lg flex items-center gap-1 truncate max-w-[140px]">
                                <FolderGit2 className="w-3 h-3 shrink-0" /> {projectName}
                            </span>
                        )}
                        {elapsedHours >= 8 && (
                            <span className="text-[9px] font-black text-red-400 bg-red-500/15 px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-500/30">
                                <AlertTriangle className="w-3 h-3" /> +8h
                            </span>
                        )}
                    </div>
                </div>

                {/* Elapsed */}
                <span className={`text-lg font-black tabular-nums shrink-0 ${
                    elapsedHours >= 8 ? 'text-red-400' : 'text-emerald-400'
                }`}>
                    {elapsed}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Edit start time */}
                    <button
                        onClick={handleEditStart}
                        className="p-2 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                        title="Editar hora de inicio"
                    >
                        <Pencil className="w-4 h-4" />
                    </button>

                    {/* Stop */}
                    <button
                        onClick={handleStop}
                        disabled={isStopping}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all disabled:bg-slate-600 flex items-center gap-1.5"
                    >
                        <Square className="w-3 h-3 fill-current" />
                        {isStopping ? '...' : 'Detener'}
                    </button>
                </div>
            </div>

            {/* Edit start time form */}
            {isEditing && (
                <div className="mt-3 flex items-center gap-2 bg-slate-800/60 rounded-xl p-3 border border-slate-700 animate-in fade-in zoom-in-95 duration-150">
                    <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">Inicio:</span>
                    <input
                        type="datetime-local"
                        value={editStartTime}
                        onChange={e => setEditStartTime(e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                        onClick={handleSaveStartTime}
                        disabled={isSaving}
                        className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all disabled:bg-slate-600"
                        title="Guardar"
                    >
                        <Check className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsEditing(false)}
                        className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all"
                        title="Cancelar"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
