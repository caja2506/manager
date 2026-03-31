import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDuration, getActiveTimerForTask, formatElapsed } from '../../services/timeService';
import {
    AlertTriangle, CheckCheck, User, Calendar, Clock,
    GripVertical
} from 'lucide-react';
import {
    TASK_STATUS_CONFIG,
    TASK_PRIORITY_CONFIG,
} from '../../models/schemas';

// ── Priority pill colors ──
const PRIORITY_COLORS = {
    low: {
        bg: 'rgba(5, 150, 105, 0.15)',
        border: 'rgba(16, 185, 129, 0.35)',
        text: '#34d399',
        dot: '#34d399',
    },
    medium: {
        bg: 'rgba(217, 119, 6, 0.15)',
        border: 'rgba(245, 158, 11, 0.35)',
        text: '#fbbf24',
        dot: '#fbbf24',
    },
    high: {
        bg: 'rgba(234, 88, 12, 0.15)',
        border: 'rgba(249, 115, 22, 0.35)',
        text: '#fb923c',
        dot: '#fb923c',
    },
    critical: {
        bg: 'rgba(239, 68, 68, 0.15)',
        border: 'rgba(239, 68, 68, 0.4)',
        text: '#f87171',
        dot: '#ef4444',
    },
};

// ── Shared pill class for all tags ──
const PILL = 'h-6 inline-flex items-center gap-1 px-2.5 rounded-full text-[10px] font-semibold border';
const ICON = 'w-3 h-3 flex-shrink-0';

export default function TaskCard({ task, project, teamMembers, subtasks = [], onClick, isDragOverlay = false, timeLogs = [] }) {
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging,
    } = useSortable({
        id: task.id,
        data: { type: 'task', task },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    const priorityConfig = TASK_PRIORITY_CONFIG[task.priority] || {};
    const pColor = PRIORITY_COLORS[task.priority?.toLowerCase()] || PRIORITY_COLORS.medium;

    const assignee = teamMembers.find(u => u.uid === task.assignedTo);

    const completedSubtasks = subtasks.filter(s => s.completed).length;
    const totalSubtasks = subtasks.length;
    const subtaskProgress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : null;

    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed' && task.status !== 'cancelled';

    // Live Timer — detect from Firestore timeLogs
    const [liveElapsed, setLiveElapsed] = useState(null);

    useEffect(() => {
        let interval;
        const activeLog = getActiveTimerForTask(timeLogs, task.id);
        if (activeLog && activeLog.startTime) {
            const tick = () => setLiveElapsed(formatElapsed(activeLog.startTime));
            tick();
            interval = setInterval(tick, 1000);
        } else {
            setLiveElapsed(null);
        }
        return () => clearInterval(interval);
    }, [task.id, timeLogs]);

    // ── Card class ──
    let cardCls = 'rounded-xl border p-3.5 transition-all duration-200 group cursor-grab active:cursor-grabbing relative';
    cardCls += ' bg-slate-900/80 backdrop-blur-md border-slate-700/50 shadow-lg shadow-black/10';
    cardCls += ' hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5 hover:border-slate-600/60';

    if (isDragging) cardCls += ' shadow-2xl ring-2 ring-indigo-400 scale-[1.03] z-50';
    else if (isDragOverlay) cardCls += ' shadow-2xl ring-2 ring-indigo-400 rotate-[2deg]';
    if (isOverdue) cardCls += ' border-red-500/40 shadow-red-500/10';

    // ── Initials helper ──
    const getInitials = (member) => {
        const name = member.displayName || member.email || '?';
        const parts = name.trim().split(/\s+/);
        return parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : name[0].toUpperCase();
    };

    return (
        <div ref={setNodeRef} style={style} className={cardCls}>

            {/* ── Row 1: Drag + Priority + Project ── */}
            <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                    <button
                        {...attributes}
                        {...listeners}
                        className="p-0.5 text-slate-600 hover:text-indigo-400 cursor-grab active:cursor-grabbing touch-none transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical className={ICON} />
                    </button>

                    {/* Priority pill */}
                    <span
                        className={PILL}
                        style={{
                            backgroundColor: pColor.bg,
                            borderColor: pColor.border,
                            color: pColor.text,
                        }}
                    >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: pColor.dot }} />
                        {(priorityConfig.label || 'Media').toUpperCase()}
                    </span>
                </div>

                {/* Project pill */}
                {project && (
                    <span className={`${PILL} bg-slate-800/80 text-slate-400 border-slate-700/50 truncate max-w-[110px]`}>
                        {project.name}
                    </span>
                )}
            </div>

            {/* ── Title ── */}
            <h4
                className="font-bold text-sm text-slate-100 leading-snug mb-2.5 line-clamp-2 group-hover:text-indigo-300 transition-colors cursor-pointer"
                onClick={onClick}
            >
                {task.title}
            </h4>

            {/* ── Subtask Progress ── */}
            {subtaskProgress != null && (
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                            <CheckCheck className={`${ICON} text-indigo-400`} />
                            {completedSubtasks} / {totalSubtasks}
                        </span>
                        <span className="text-[10px] font-semibold text-indigo-400">{subtaskProgress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${subtaskProgress === 100
                                ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                                : 'bg-gradient-to-r from-indigo-500 to-blue-500'
                                }`}
                            style={{ width: `${subtaskProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* ── Row 3: Avatar + Tags ── */}
            <div className="flex items-center justify-between pt-2.5 border-t border-slate-700/40">
                {/* Avatar */}
                {assignee ? (
                    <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-amber-500/30 flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#b45309' }}
                        title={assignee.displayName || assignee.email}
                    >
                        {getInitials(assignee)}
                    </div>
                ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center ring-2 ring-slate-700 flex-shrink-0">
                        <User className="w-3 h-3 text-slate-500" />
                    </div>
                )}

                {/* Tags */}
                <div className="flex items-center gap-1.5">
                    {/* Timer / Hours */}
                    {liveElapsed ? (
                        <span className={`${PILL} bg-indigo-500/15 text-indigo-400 border-indigo-500/30 animate-pulse`}>
                            <Clock className={ICON} />
                            <span className="tabular-nums">{liveElapsed}</span>
                        </span>
                    ) : (task.actualHours > 0 || task.estimatedHours > 0) ? (
                        <span className={`${PILL} ${task.actualHours > 0 && task.estimatedHours > 0 && task.actualHours > task.estimatedHours
                            ? 'bg-red-500/10 text-red-400 border-red-500/30'
                            : task.actualHours > 0
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-slate-800/60 text-slate-400 border-slate-700/50'
                            }`}>
                            <Clock className={ICON} />
                            {task.actualHours > 0 && task.estimatedHours > 0
                                ? <>{formatDuration(task.actualHours)}<span className="opacity-50"> / {task.estimatedHours}h</span></>
                                : task.actualHours > 0
                                    ? formatDuration(task.actualHours)
                                    : `${task.estimatedHours}h est.`
                            }
                        </span>
                    ) : null}

                    {/* Date */}
                    {task.dueDate && (
                        <span className={`${PILL} ${isOverdue
                            ? 'bg-red-500/10 text-red-400 border-red-500/30'
                            : 'bg-slate-800/60 text-slate-400 border-slate-700/50'
                            }`}>
                            <Calendar className={ICON} />
                            {new Date(task.dueDate).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                        </span>
                    )}
                </div>
            </div>

            {/* ── Blocked ── */}
            {task.status === 'blocked' && task.blockedReason && (
                <div className="mt-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-[10px] text-red-300 font-semibold leading-tight">{task.blockedReason}</span>
                </div>
            )}
        </div>
    );
}
