/**
 * Planner Service — Supabase Implementation
 * ==========================================
 * Drop-in replacement for plannerService.js (Firestore version).
 *
 * VALIDATION CONTRACT (unchanged):
 *   - Blocking validations (B1-B7) THROW — persistence is prevented.
 *   - Contextual warnings (W1-W5) are RETURNED — UI displays them.
 *   - Legacy items are NOT retroactively validated.
 *
 * @module services/plannerService.supabase
 */

import { supabase } from '../supabase';
import { validatePlanItem, validatePlanItemFull } from '../utils/plannerUtils';
import { auth as firebaseAuth } from '../firebase';

export const plannerService = {
    /**
     * Create a new planned time block for a task.
     */
    async createPlanItem(data, context = null) {
        // ── Validation (same as Firestore version) ──
        let validation;
        if (context) {
            validation = validatePlanItemFull(data, context);
        } else {
            validation = validatePlanItem(data);
        }

        if (!validation.valid) {
            const err = new Error(validation.errors.join(' | '));
            err.name = 'PlannerValidationError';
            err.validationErrors = validation.errors;
            err.validationWarnings = validation.warnings || [];
            throw err;
        }

        const calculatedDate = data.date || (data.startDateTime ? data.startDateTime.split('T')[0] : null);

        try {
            const { data: result, error } = await supabase
                .from('weekly_plan_items')
                .insert({
                    task_id: data.taskId || null,
                    assigned_to: data.assignedTo || null,
                    week_start_date: data.weekStartDate,
                    day_of_week: data.dayOfWeek,
                    start_date_time: data.startDateTime || null,
                    end_date_time: data.endDateTime || null,
                    planned_hours: data.plannedHours || 0,
                    notes: data.notes || '',
                    status: data.status || 'planned',
                    project_id: data.projectId || null,
                    task_title: data.taskTitle || '',
                    project_name: data.projectName || '',
                    created_by: data.createdBy || data.assignedTo || null,
                    date: calculatedDate,
                    task_title_snapshot: data.taskTitleSnapshot || data.taskTitle || 'Planificación libre',
                    project_name_snapshot: data.projectNameSnapshot || data.projectName || '',
                    assigned_to_name: data.assignedToName || '',
                    status_snapshot: data.statusSnapshot || data.status || 'planned',
                    priority: data.priority || 'medium',
                    color_key: data.colorKey || 'indigo',
                })
                .select('id')
                .single();

            if (error) throw error;

            // Sync timer immediately
            const itemId = result.id;
            const fullData = { id: itemId, ...data };
            syncActivePlannerTimer(itemId, fullData);

            return { id: result.id, warnings: validation.warnings || [] };
        } catch (error) {
            console.error("[plannerService.sb] Error creating plan item:", error);
            throw error;
        }
    },

    /**
     * Update an existing time block (e.g. after drag/resize).
     */
    async updatePlanItem(itemId, updates) {
        // Validate scheduling fields if present
        if (updates.startDateTime || updates.endDateTime || updates.plannedHours !== undefined) {
            const start = updates.startDateTime ? new Date(updates.startDateTime) : null;
            const end = updates.endDateTime ? new Date(updates.endDateTime) : null;
            if (start && isNaN(start.getTime())) throw new Error('startDateTime no es una fecha válida.');
            if (end && isNaN(end.getTime())) throw new Error('endDateTime no es una fecha válida.');
            if (start && end && end <= start) throw new Error('endDateTime debe ser posterior a startDateTime.');
            if (updates.plannedHours !== undefined && (typeof updates.plannedHours !== 'number' || updates.plannedHours <= 0)) {
                throw new Error('plannedHours debe ser mayor a 0.');
            }
        }

        try {
            const mapped = {};
            if (updates.startDateTime !== undefined) mapped.start_date_time = updates.startDateTime;
            if (updates.endDateTime !== undefined) mapped.end_date_time = updates.endDateTime;
            if (updates.plannedHours !== undefined) mapped.planned_hours = updates.plannedHours;
            if (updates.dayOfWeek !== undefined) mapped.day_of_week = updates.dayOfWeek;
            if (updates.notes !== undefined) mapped.notes = updates.notes;
            if (updates.status !== undefined) mapped.status = updates.status;
            if (updates.taskId !== undefined) mapped.task_id = updates.taskId;
            if (updates.assignedTo !== undefined) mapped.assigned_to = updates.assignedTo;
            if (updates.taskTitle !== undefined) mapped.task_title = updates.taskTitle;
            if (updates.projectName !== undefined) mapped.project_name = updates.projectName;
            if (updates.date !== undefined) {
                mapped.date = updates.date;
            } else if (updates.startDateTime !== undefined) {
                mapped.date = updates.startDateTime.split('T')[0];
            }
            if (updates.taskTitleSnapshot !== undefined) mapped.task_title_snapshot = updates.taskTitleSnapshot;
            if (updates.projectNameSnapshot !== undefined) mapped.project_name_snapshot = updates.projectNameSnapshot;
            if (updates.assignedToName !== undefined) mapped.assigned_to_name = updates.assignedToName;
            if (updates.statusSnapshot !== undefined) mapped.status_snapshot = updates.statusSnapshot;
            if (updates.priority !== undefined) mapped.priority = updates.priority;
            if (updates.colorKey !== undefined) mapped.color_key = updates.colorKey;

            const { error } = await supabase
                .from('weekly_plan_items')
                .update(mapped)
                .eq('id', itemId);

            if (error) throw error;

            // Sync timer immediately
            syncActivePlannerTimer(itemId, null);
        } catch (error) {
            console.error("[plannerService.sb] Error updating plan item:", error);
            throw error;
        }
    },

    /**
     * Delete a planned time block.
     */
    async deletePlanItem(itemId) {
        try {
            // Stop active timer if any before deleting
            await stopActiveTimerForPlanItem(itemId);

            const { error } = await supabase
                .from('weekly_plan_items')
                .delete()
                .eq('id', itemId);

            if (error) throw error;
        } catch (error) {
            console.error("[plannerService.sb] Error deleting plan item:", error);
            throw error;
        }
    },

    /**
     * Get all planner blocks that overlap with a specific week.
     */
    async getWeeklyPlanItems(startYYYYMMDD) {
        try {
            const { data, error } = await supabase
                .from('weekly_plan_items')
                .select('*')
                .eq('week_start_date', startYYYYMMDD);

            if (error) throw error;

            return (data || []).map(mapRow);
        } catch (error) {
            console.error("[plannerService.sb] Error fetching weekly plan items:", error);
            throw error;
        }
    },

    /**
     * Get all plan items assigned to a specific user.
     */
    async getPlanItemsByUser(userId) {
        try {
            const { data, error } = await supabase
                .from('weekly_plan_items')
                .select('*')
                .eq('assigned_to', userId);

            if (error) throw error;

            return (data || []).map(mapRow);
        } catch (error) {
            console.error("[plannerService.sb] Error fetching user plan items:", error);
            throw error;
        }
    }
};

// ── Mapper: snake_case → camelCase ──
function mapRow(row) {
    return {
        id: row.id,
        taskId: row.task_id,
        assignedTo: row.assigned_to,
        weekStartDate: row.week_start_date,
        dayOfWeek: row.day_of_week,
        startDateTime: row.start_date_time,
        endDateTime: row.end_date_time,
        plannedHours: row.planned_hours,
        notes: row.notes,
        status: row.status,
        projectId: row.project_id,
        taskTitle: row.task_title,
        projectName: row.project_name,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        date: row.date || (row.start_date_time ? row.start_date_time.split('T')[0] : null),
        taskTitleSnapshot: row.task_title_snapshot,
        projectNameSnapshot: row.project_name_snapshot,
        assignedToName: row.assigned_to_name,
        statusSnapshot: row.status_snapshot,
        priority: row.priority,
        colorKey: row.color_key,
    };
}

// ── Helpers for immediate planner-timer synchronization ──

function isBlockActiveNow(startStr, endStr) {
    if (!startStr || !endStr) return false;
    const now = new Date();
    const start = new Date(startStr);
    const end = new Date(endStr);
    return now >= start && now <= end;
}

async function stopActiveTimerForPlanItem(planItemId) {
    try {
        const { data: activeLogs, error } = await supabase
            .from('time_logs')
            .select('id')
            .eq('plan_item_id', planItemId)
            .is('end_time', null);

        if (error) {
            console.error('[plannerService.sb] Error checking active timer for plan item:', error.message);
            return;
        }

        if (activeLogs && activeLogs.length > 0) {
            const { stopTimer } = await import('./timeService.supabase');
            for (const log of activeLogs) {
                await stopTimer(log.id, { notes: '[Auto-detenido por cambio/eliminación en el planificador]' });
                console.log(`[plannerService.sb] Stopped active timer ${log.id} for plan item ${planItemId}`);
            }
        }
    } catch (err) {
        console.error('[plannerService.sb] Error in stopActiveTimerForPlanItem:', err);
    }
}

async function syncActivePlannerTimer(itemId, knownData) {
    try {
        const currentUser = firebaseAuth.currentUser;
        const currentUserId = currentUser?.uid;
        if (!currentUserId) return;
        const displayName = currentUser?.displayName || currentUser?.email || 'Sistema';
        const email = currentUser?.email || '';

        let item = knownData;
        if (!item || !item.assignedTo || !item.startDateTime || !item.endDateTime) {
            const { data, error } = await supabase
                .from('weekly_plan_items')
                .select('*')
                .eq('id', itemId)
                .single();
            if (error || !data) {
                console.warn('[plannerService.sb] Could not fetch weekly plan item for sync:', error?.message);
                return;
            }
            item = mapRow(data);
        }

        if (item.assignedTo !== currentUserId) {
            return;
        }

        const activeNow = isBlockActiveNow(item.startDateTime, item.endDateTime);

        if (activeNow) {
            const { data: activeLogs, error } = await supabase
                .from('time_logs')
                .select('id, task_id, source, plan_item_id')
                .eq('user_id', currentUserId)
                .is('end_time', null);

            if (error) {
                console.error('[plannerService.sb] Error checking active timers:', error.message);
                return;
            }

            const activeTimer = activeLogs && activeLogs.length > 0 ? activeLogs[0] : null;

            if (!activeTimer) {
                const { startTimer } = await import('./timeService.supabase');
                const { updateTaskStatus } = await import('./taskService.supabase');

                const result = await startTimer({
                    taskId: item.taskId,
                    projectId: item.projectId,
                    userId: currentUserId,
                    notes: `Auto-iniciado desde el planificador web`,
                    source: 'planner_auto',
                    taskTitle: item.taskTitle,
                    projectName: item.projectName,
                    displayName: displayName,
                });

                if (result?.logId) {
                    await supabase
                        .from('time_logs')
                        .update({ plan_item_id: itemId })
                        .eq('id', result.logId);
                }

                console.log(`[plannerService.sb] Started planner timer for plan item ${itemId}`);

                if (item.taskId) {
                    try {
                        const { data: taskRow } = await supabase
                            .from('tasks')
                            .select('status')
                            .eq('id', item.taskId)
                            .single();
                        if (taskRow && ['backlog', 'pending', 'blocked'].includes(taskRow.status)) {
                            await updateTaskStatus(item.taskId, 'in_progress', null, false, {
                                userId: currentUserId,
                                userName: displayName,
                            });
                        }
                    } catch (e) {
                        console.warn('[plannerService.sb] Failed to transition task to in_progress:', e.message);
                    }
                }
            } else {
                if (activeTimer.taskId !== item.taskId) {
                    if (activeTimer.source === 'planner_auto') {
                        const { stopTimer, startTimer } = await import('./timeService.supabase');
                        const { updateTaskStatus } = await import('./taskService.supabase');

                        await stopTimer(activeTimer.id, { notes: '[Auto-detenido por cambio de bloque en el planificador]' });

                        const result = await startTimer({
                            taskId: item.taskId,
                            projectId: item.projectId,
                            userId: currentUserId,
                            notes: `Auto-iniciado desde el planificador web`,
                            source: 'planner_auto',
                            taskTitle: item.taskTitle,
                            projectName: item.projectName,
                            displayName: displayName,
                        });

                        if (result?.logId) {
                            await supabase
                                .from('time_logs')
                                .update({ plan_item_id: itemId })
                                .eq('id', result.logId);
                        }

                        console.log(`[plannerService.sb] Switched planner timer for plan item ${itemId}`);

                        if (item.taskId) {
                            try {
                                const { data: taskRow } = await supabase
                                    .from('tasks')
                                    .select('status')
                                    .eq('id', item.taskId)
                                    .single();
                                if (taskRow && ['backlog', 'pending', 'blocked'].includes(taskRow.status)) {
                                    await updateTaskStatus(item.taskId, 'in_progress', null, false, {
                                        userId: currentUserId,
                                        userName: displayName,
                                    });
                                }
                            } catch (e) {
                                console.warn('[plannerService.sb] Failed to transition task to in_progress:', e.message);
                            }
                        }
                    } else {
                        console.log(`[plannerService.sb] User has active manual timer, not overriding.`);
                    }
                } else {
                    if (activeTimer.plan_item_id !== itemId) {
                        await supabase
                            .from('time_logs')
                            .update({ plan_item_id: itemId })
                            .eq('id', activeTimer.id);
                    }
                }
            }
        } else {
            await stopActiveTimerForPlanItem(itemId);
        }
    } catch (err) {
        console.error('[plannerService.sb] Error in syncActivePlannerTimer:', err);
    }
}
