/**
 * Time Tracking Service — Supabase Implementation
 * ================================================
 * Drop-in replacement for timeService.js (Firestore version).
 *
 * ARCHITECTURE (unchanged): Timer state lives in the database.
 * An "active timer" = a time_logs row with end_time IS NULL.
 *
 * PURE FUNCTIONS (no DB dependency) are re-exported from the original:
 *   getActiveTimerFromLogs, getAllActiveTimersForUser, getActiveTimerForTask,
 *   canManageOthersTimers, isSupervisorOf, formatDuration, formatElapsed,
 *   clearLegacyTimer
 *
 * @module services/timeService.supabase
 */

import { supabase } from '../supabase';
import { calculateProjectRisk } from './riskService';
import { logActivity, ACTIVITY_TYPES } from './activityLogService';
import { getEffectiveHours, getBreakHoursInRange } from '../utils/breakTimeUtils';

// Re-export pure functions (no DB dependency — identical in both backends)
export {
    getActiveTimerFromLogs,
    getAllActiveTimersForUser,
    getActiveTimerForTask,
    canManageOthersTimers,
    isSupervisorOf,
    clearLegacyTimer,
    formatDuration,
    formatElapsed,
} from './timeService.firebase';

// ============================================================
// ACTIVE TIMER — same as original but for Supabase query fallback
// ============================================================

/**
 * Force-stop ALL active timers for a given task.
 * Queries Supabase directly — no local state dependency.
 */
export async function forceStopTaskTimers(taskId, reason = 'auto') {
    if (!taskId) return 0;
    try {
        const { data: openLogs, error } = await supabase
            .from('time_logs')
            .select('id')
            .eq('task_id', taskId)
            .is('end_time', null);

        if (error || !openLogs?.length) return 0;

        let stopped = 0;
        for (const log of openLogs) {
            try {
                await stopTimer(log.id, { notes: `Auto-detenido: ${reason}` });
                stopped++;
            } catch (err) {
                console.warn(`[timeService.sb] forceStop failed for ${log.id}:`, err.message);
            }
        }
        return stopped;
    } catch (err) {
        console.error('[timeService.sb] forceStopTaskTimers failed:', err);
        return 0;
    }
}

// ============================================================
// START / STOP TIMER
// ============================================================

export async function startTimer({
    taskId, projectId, userId, notes = '', overtime = false,
    taskTitle = '', projectName = '', displayName = '', source = 'manual'
}) {
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('time_logs')
        .insert({
            task_id: taskId,
            project_id: projectId,
            user_id: userId,
            start_time: now,
            end_time: null,
            total_hours: 0,
            overtime,
            notes,
            task_title: taskTitle,
            project_name: projectName,
            display_name: displayName,
            source,
        })
        .select('id')
        .single();

    if (error) throw new Error(`[timeService.sb] startTimer: ${error.message}`);

    if (taskId) {
        logActivity(taskId, {
            type: ACTIVITY_TYPES.TIMER_STARTED,
            description: 'Timer iniciado',
            userId,
            meta: { logId: data.id, notes, source },
        });
    }

    return { logId: data.id, taskId, projectId, startTime: now, userId };
}

export async function startTimerSafe({
    taskId, projectId, userId, notes = '', overtime = false,
    taskTitle = '', projectName = '', displayName = '', source = 'manual', onConfirm
}) {
    // 1. Check for active timers
    const { data: activeLogs, error } = await supabase
        .from('time_logs')
        .select('id, task_id, task_title, start_time')
        .eq('user_id', userId)
        .is('end_time', null);

    if (error) console.warn('[timeService.sb] active timer check failed:', error.message);

    // 2. If active → ask confirmation
    if (activeLogs?.length) {
        let activeTaskTitle = activeLogs[0].task_title;

        if (!activeTaskTitle && activeLogs[0].task_id) {
            const { data: taskRow } = await supabase
                .from('tasks')
                .select('title')
                .eq('id', activeLogs[0].task_id)
                .single();
            activeTaskTitle = taskRow?.title || activeLogs[0].task_id;
        }
        activeTaskTitle = activeTaskTitle || 'tarea actual';

        if (onConfirm) {
            const confirmed = await onConfirm({
                activeTaskTitle,
                newTaskTitle: taskTitle || taskId || 'nueva tarea',
            });
            if (!confirmed) return null;
        }

        // Auto-stop all active timers
        for (const activeLog of activeLogs) {
            try {
                await stopTimer(activeLog.id, { notes: '[Auto-detenido al iniciar nuevo timer]' });
            } catch (err) {
                console.warn('[timeService.sb] Error auto-stopping:', activeLog.id, err.message);
            }
        }
    }

    // 3. Start new timer
    return await startTimer({ taskId, projectId, userId, notes, overtime, taskTitle, projectName, displayName, source });
}

export async function handleTaskStatusTimerSync({
    taskId, projectId, newStatus, userId, timeLogs,
    taskTitle = '', projectName = '', displayName = '', onConfirm,
}) {
    if (newStatus === 'in_progress') {
        const { getActiveTimerForTask } = await import('./timeService.firebase');
        const existing = getActiveTimerForTask(timeLogs, taskId);
        if (existing) return null;

        return await startTimerSafe({
            taskId, projectId, userId,
            taskTitle, projectName, displayName,
            source: 'kanban_auto', onConfirm,
        });
    }

    if (['completed', 'cancelled', 'blocked', 'pending', 'backlog'].includes(newStatus)) {
        const { getActiveTimerForTask } = await import('./timeService.firebase');
        let activeLog = getActiveTimerForTask(timeLogs, taskId);

        // Fallback: query DB directly
        if (!activeLog && taskId) {
            try {
                const { data } = await supabase
                    .from('time_logs')
                    .select('*')
                    .eq('task_id', taskId)
                    .is('end_time', null)
                    .limit(1);

                if (data?.length) {
                    activeLog = { id: data[0].id, ...mapTimeLogRow(data[0]) };
                }
            } catch (err) {
                console.warn('[timeService.sb] Fallback timer lookup failed:', err.message);
            }
        }

        if (activeLog) {
            return await stopTimer(activeLog.id, { notes: `Auto-detenido: tarea → ${newStatus}` });
        }
    }
    return null;
}

export async function stopTimer(logId, { notes = '', overtime = false } = {}) {
    if (!logId) return null;

    const now = new Date();

    // Read the log
    const { data: logRow, error: readErr } = await supabase
        .from('time_logs')
        .select('*')
        .eq('id', logId)
        .single();

    if (readErr || !logRow) {
        console.warn(`[timeService.sb] Time log ${logId} not found`);
        return null;
    }

    const startTime = new Date(logRow.start_time);
    const totalMs = now - startTime;
    const totalHoursGross = parseFloat((totalMs / 3600000).toFixed(6));
    let totalHours = getEffectiveHours(startTime, now);

    if (totalHours < 0.016666) totalHours = 0.016666;

    const breakHoursDeducted = parseFloat((totalHoursGross - totalHours).toFixed(4));
    const overtimeHours = overtime ? totalHours : 0;

    try {
        await supabase
            .from('time_logs')
            .update({
                end_time: now.toISOString(),
                total_hours: totalHours,
                total_hours_gross: totalHoursGross,
                break_hours_deducted: breakHoursDeducted,
                overtime,
                overtime_hours: overtimeHours,
                notes: notes || logRow.notes || '',
            })
            .eq('id', logId);

        if (logRow.task_id) {
            await recalculateTaskHours(logRow.task_id);
        }

        if (logRow.project_id && (overtime || overtimeHours > 0)) {
            await calculateProjectRisk(logRow.project_id);
        }
    } catch (err) {
        console.error('[timeService.sb] Error stopping timer:', err);
    }

    if (logRow.task_id) {
        logActivity(logRow.task_id, {
            type: ACTIVITY_TYPES.TIMER_STOPPED,
            description: `Timer detenido (${totalHours.toFixed(1)}h)`,
            userId: logRow.user_id,
            meta: { logId, totalHours, overtimeHours },
        });
    }

    return { totalHours, overtimeHours, taskId: logRow.task_id };
}

// ============================================================
// DAY CLOSE / DAY OPEN
// ============================================================

export async function closeDay(timeLogs) {
    const runningTimers = (timeLogs || []).filter(log => !log.endTime && log.startTime);
    if (runningTimers.length === 0) return 0;

    const now = new Date();
    let stopped = 0;

    for (const log of runningTimers) {
        const startTime = new Date(log.startTime);
        const totalMs = now - startTime;
        const totalHoursGross = parseFloat((totalMs / 3600000).toFixed(6));
        let totalHours = getEffectiveHours(startTime, now);
        if (totalHours < 0.016666) totalHours = 0.016666;
        const breakHoursDeducted = parseFloat((totalHoursGross - totalHours).toFixed(4));

        try {
            await supabase
                .from('time_logs')
                .update({
                    end_time: now.toISOString(),
                    total_hours: totalHours,
                    total_hours_gross: totalHoursGross,
                    break_hours_deducted: breakHoursDeducted,
                    auto_stopped: true,
                    notes: (log.notes || '') + ' [Auto-cerrado al cierre de día]',
                })
                .eq('id', log.id);

            if (log.taskId) await recalculateTaskHours(log.taskId);
            stopped++;
        } catch (err) {
            console.error(`[closeDay.sb] Error stopping timer ${log.id}:`, err);
        }
    }
    return stopped;
}

export async function openDay(timeLogs, tasks) {
    const yesterday = new Date(Date.now() - 24 * 3600000);

    const autoStoppedTimers = (timeLogs || []).filter(log => {
        if (!log.autoStopped) return false;
        if (!log.endTime) return false;
        return new Date(log.endTime) >= yesterday;
    });

    if (autoStoppedTimers.length === 0) return 0;

    const seen = new Set();
    const uniqueTimers = [];
    for (const log of autoStoppedTimers) {
        const key = `${log.taskId || ''}_${log.userId}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueTimers.push(log);
        }
    }

    let restarted = 0;
    for (const log of uniqueTimers) {
        const alreadyRunning = (timeLogs || []).find(
            l => l.taskId === log.taskId && l.userId === log.userId && !l.endTime
        );
        if (alreadyRunning) continue;

        if (log.taskId) {
            const task = (tasks || []).find(t => t.id === log.taskId);
            if (task && task.status !== 'in_progress') continue;
        }

        try {
            await startTimer({
                taskId: log.taskId,
                projectId: log.projectId,
                userId: log.userId,
                notes: 'Auto-iniciado al abrir el día',
                overtime: false,
                source: 'open_day',
            });

            await supabase
                .from('time_logs')
                .update({ auto_stopped: false })
                .eq('id', log.id);

            restarted++;
        } catch (err) {
            console.error(`[openDay.sb] Error restarting timer:`, err);
        }
    }
    return restarted;
}

// ============================================================
// TASK HOURS AGGREGATION
// ============================================================

export async function recalculateTaskHours(taskId) {
    if (!taskId) return;
    try {
        const { data: logs, error } = await supabase
            .from('time_logs')
            .select('total_hours, end_time')
            .eq('task_id', taskId);

        if (error) throw error;

        let totalHours = 0;
        (logs || []).forEach(row => {
            if (row.total_hours && row.end_time) {
                totalHours += row.total_hours;
            }
        });

        totalHours = parseFloat(totalHours.toFixed(4));

        await supabase
            .from('tasks')
            .update({ actual_hours: totalHours })
            .eq('id', taskId);
    } catch (err) {
        console.error('[timeService.sb] Error recalculating task hours:', err);
    }
}

// ============================================================
// MANUAL ENTRY CRUD
// ============================================================

export async function createManualTimeLog({
    taskId, projectId, userId, startTime, endTime, notes, overtime, planItemId,
}) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const totalMs = end - start;
    const totalHoursGross = parseFloat((totalMs / 3600000).toFixed(6));
    let totalHours = getEffectiveHours(start, end);

    if (totalHours > 0 && totalHours < 0.016666) totalHours = 0.016666;
    else if (totalHours < 0) totalHours = 0;

    const breakHoursDeducted = parseFloat((totalHoursGross - totalHours).toFixed(4));
    const overtimeHours = overtime ? totalHours : 0;

    const { data, error } = await supabase
        .from('time_logs')
        .insert({
            task_id: taskId,
            project_id: projectId,
            user_id: userId,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            total_hours: totalHours,
            total_hours_gross: totalHoursGross,
            break_hours_deducted: breakHoursDeducted,
            overtime: !!overtime,
            overtime_hours: overtimeHours,
            notes,
            plan_item_id: planItemId || null,
        })
        .select('id')
        .single();

    if (error) throw new Error(`[timeService.sb] createManualTimeLog: ${error.message}`);

    if (taskId) await recalculateTaskHours(taskId);
    if (projectId && (overtime || overtimeHours > 0)) await calculateProjectRisk(projectId);

    return data.id;
}

export async function addSimpleManualTimeLog({
    taskId, projectId, userId, dateIso, hours, notes, overtime
}) {
    const hrs = parseFloat(hours);
    if (!hrs || hrs <= 0) return null;

    const baseDate = dateIso ? new Date(dateIso) : new Date();
    baseDate.setHours(13, 0, 0, 0);

    const startIso = baseDate.toISOString();
    const endIso = new Date(baseDate.getTime() + (hrs * 3600000)).toISOString();

    const { data, error } = await supabase
        .from('time_logs')
        .insert({
            task_id: taskId,
            project_id: projectId,
            user_id: userId,
            start_time: startIso,
            end_time: endIso,
            total_hours: hrs,
            total_hours_gross: hrs,
            break_hours_deducted: 0,
            overtime: !!overtime,
            overtime_hours: overtime ? hrs : 0,
            notes: notes || 'Registro manual',
        })
        .select('id')
        .single();

    if (error) throw new Error(`[timeService.sb] addSimpleManualTimeLog: ${error.message}`);

    if (taskId) {
        await recalculateTaskHours(taskId);
        logActivity(taskId, {
            type: ACTIVITY_TYPES.TASK_UPDATED,
            description: `Se agregaron ${hrs}h manualmente`,
            userId,
            meta: { logId: data.id, hours: hrs },
        });
    }

    if (projectId && overtime) await calculateProjectRisk(projectId);

    return data.id;
}

export async function updateTimeLog(logId, updates) {
    const mapped = {};
    if (updates.startTime !== undefined) mapped.start_time = updates.startTime;
    if (updates.endTime !== undefined) mapped.end_time = updates.endTime;
    if (updates.notes !== undefined) mapped.notes = updates.notes;
    if (updates.overtime !== undefined) mapped.overtime = updates.overtime;

    // Recalculate hours if both times are provided
    if (updates.startTime && updates.endTime) {
        const start = new Date(updates.startTime);
        const end = new Date(updates.endTime);
        const totalMs = end - start;
        mapped.total_hours_gross = parseFloat((totalMs / 3600000).toFixed(6));
        mapped.total_hours = getEffectiveHours(start, end);
        mapped.break_hours_deducted = parseFloat((mapped.total_hours_gross - mapped.total_hours).toFixed(4));
        if (updates.overtime) mapped.overtime_hours = mapped.total_hours;
    }

    await supabase.from('time_logs').update(mapped).eq('id', logId);

    if (updates.overtime !== undefined) {
        const { data: logRow } = await supabase
            .from('time_logs')
            .select('project_id')
            .eq('id', logId)
            .single();
        if (logRow?.project_id) await calculateProjectRisk(logRow.project_id);
    }
}

export async function deleteTimeLog(logId, taskId = null, projectId = null) {
    try {
        const { error } = await supabase.from('time_logs').delete().eq('id', logId);
        if (error) throw error;
        if (taskId) await recalculateTaskHours(taskId);
        if (projectId) await calculateProjectRisk(projectId);
    } catch (err) {
        console.error('CRITICAL: Error deleting time log:', err);
        throw err;
    }
}

// ── Mapper: snake_case → camelCase ──
function mapTimeLogRow(row) {
    return {
        id: row.id,
        taskId: row.task_id,
        projectId: row.project_id,
        userId: row.user_id,
        startTime: row.start_time,
        endTime: row.end_time,
        totalHours: row.total_hours,
        totalHoursGross: row.total_hours_gross,
        breakHoursDeducted: row.break_hours_deducted,
        overtime: row.overtime,
        overtimeHours: row.overtime_hours,
        notes: row.notes,
        taskTitle: row.task_title,
        projectName: row.project_name,
        displayName: row.display_name,
        source: row.source,
        autoStopped: row.auto_stopped,
        createdAt: row.created_at,
        status: row.status,
        planItemId: row.plan_item_id,
    };
}

// ── SUGGESTED LOGS AND HYBRID ASSISTED CONFIRMATION ──

/**
 * Obtiene los registros sugeridos basados en el planificador semanal
 * directamente de la base de datos Supabase en estado 'draft'.
 */
export async function getSuggestedLogsForDay(userId, dateIso) {
    if (!userId || !dateIso) return [];
    try {
        const dayStart = `${dateIso}T00:00:00.000Z`;
        const dayEnd = `${dateIso}T23:59:59.999Z`;
        const { data, error } = await supabase
            .from('time_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'draft')
            .gte('start_time', dayStart)
            .lte('start_time', dayEnd);

        if (error) throw error;

        return (data || []).map(row => ({
            ...mapTimeLogRow(row),
            isDraft: true,
        }));
    } catch (err) {
        console.error('[timeService.sb] Error in getSuggestedLogsForDay:', err);
        return [];
    }
}

/**
 * Confirma un conjunto de borradores de registro guardándolos físicamente
 * en Supabase (cambiando su estado a 'confirmed') y recalculando las horas acumuladas.
 */
export async function confirmDraftLogs(logs) {
    if (!logs || !logs.length) return { count: 0 };
    
    let confirmedCount = 0;
    for (const log of logs) {
        try {
            const { error } = await supabase
                .from('time_logs')
                .update({ status: 'confirmed' })
                .eq('id', log.id);
                
            if (error) throw error;
            
            if (log.taskId) {
                await recalculateTaskHours(log.taskId);
            }
            confirmedCount++;
        } catch (err) {
            console.error(`[timeService.sb] Failed to confirm draft log ${log.id}:`, err);
        }
    }
    return { count: confirmedCount };
}
