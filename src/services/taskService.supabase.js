/**
 * Task Service — Supabase Implementation
 * ========================================
 * Drop-in replacement for taskService.js (Firestore version).
 *
 * KEY DIFFERENCES:
 * - updateTaskStatus() calls the PostgreSQL RPC `transition_task_status`
 *   instead of the Firebase Cloud Function `transitionTaskStatus`.
 * - deleteTask() uses PostgreSQL CASCADE or explicit deletes instead of batch writes.
 * - All CRUD uses the Supabase client instead of Firestore SDK.
 *
 * @module services/taskService.supabase
 */

import { supabase } from '../supabase';
import { resolveAreaForTask, validateTaskAreaConsistency } from './mappingService';
import { logActivity, ACTIVITY_TYPES } from './activityLogService';

// ── Fields that ONLY the stored procedure may write ──
const WORKFLOW_PROTECTED_FIELDS = [
    'status', 'completedDate', 'completedAt',
    'reopenedAt', 'reopenedBy', 'updatedBy',
];

// ============================================================
// ENGINEERING PROJECTS
// ============================================================

export async function createProject(data, userId) {
    const { data: result, error } = await supabase
        .from('projects')
        .insert({
            name: data.name || '',
            description: data.description || '',
            status: data.status || 'active',
            priority: data.priority || 'medium',
            owner_id: userId,
            start_date: data.startDate || null,
            due_date: data.dueDate || null,
            completed_date: data.completedDate || null,
            progress: data.progress || 0,
            client: data.client || null,
            team_member_ids: data.teamMemberIds || [],
            bom_project_id: data.bomProjectId || null,
            tags: data.tags || [],
            risk_score: data.riskScore || 0,
            risk_level: data.riskLevel || 'low',
            risk_factors: data.riskFactors || [],
            risk_summary: data.riskSummary || null,
            created_by: userId,
        })
        .select('id')
        .single();

    if (error) throw new Error(`[taskService.sb] createProject: ${error.message}`);

    // Auto-create milestones from all milestone types
    try {
        const { data: mTypes } = await supabase.from('milestone_types').select('name').order('name');
        if (mTypes && mTypes.length > 0) {
            const rows = mTypes.map((mt, i) => ({
                project_id: result.id,
                name: mt.name,
                milestone_type: mt.name,
                description: '',
                status: 'planning',
                sort_order: i,
                created_by: userId, updated_by: userId,
            }));
            await supabase.from('milestones').insert(rows);
            console.log(`[taskService.sb] Auto-created ${rows.length} milestones for project ${result.id}`);
        }
    } catch (e) {
        console.warn('[taskService.sb] Auto-milestone creation failed (non-blocking):', e.message);
    }

    return result.id;
}

export async function updateProject(projectId, updates) {
    const mapped = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.description !== undefined) mapped.description = updates.description;
    if (updates.status !== undefined) mapped.status = updates.status;
    if (updates.priority !== undefined) mapped.priority = updates.priority;
    if (updates.startDate !== undefined) mapped.start_date = updates.startDate;
    if (updates.dueDate !== undefined) mapped.due_date = updates.dueDate;
    if (updates.completedDate !== undefined) mapped.completed_date = updates.completedDate;
    if (updates.progress !== undefined) mapped.progress = updates.progress;
    if (updates.client !== undefined) mapped.client = updates.client;
    if (updates.teamMemberIds !== undefined) mapped.team_member_ids = updates.teamMemberIds;
    if (updates.bomProjectId !== undefined) mapped.bom_project_id = updates.bomProjectId;
    if (updates.tags !== undefined) mapped.tags = updates.tags;
    if (updates.riskScore !== undefined) mapped.risk_score = updates.riskScore;
    if (updates.riskLevel !== undefined) mapped.risk_level = updates.riskLevel;
    if (updates.riskFactors !== undefined) mapped.risk_factors = updates.riskFactors;
    if (updates.riskSummary !== undefined) mapped.risk_summary = updates.riskSummary;
    if (updates.riskUpdatedAt !== undefined) mapped.risk_updated_at = updates.riskUpdatedAt;

    const { error } = await supabase
        .from('projects')
        .update(mapped)
        .eq('id', projectId);

    if (error) throw new Error(`[taskService.sb] updateProject: ${error.message}`);
}

export async function deleteProject(projectId) {
    // CASCADE: delete tasks → subtasks, time_logs, plan_items
    // First delete children that reference tasks
    const { data: tasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', projectId);

    if (tasks && tasks.length > 0) {
        const taskIds = tasks.map(t => t.id);

        // Delete subtasks
        await supabase.from('subtasks').delete().in('task_id', taskIds);
        // Delete time logs
        await supabase.from('time_logs').delete().in('task_id', taskIds);
        // Delete weekly plan items
        await supabase.from('weekly_plan_items').delete().in('task_id', taskIds);
        // Delete activity logs
        await supabase.from('task_activity_log').delete().in('task_id', taskIds);
        // Delete block history
        await supabase.from('task_block_history').delete().in('task_id', taskIds);
        // Delete tasks themselves
        await supabase.from('tasks').delete().eq('project_id', projectId);
    }

    // Delete the project
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw new Error(`[taskService.sb] deleteProject: ${error.message}`);
}

// ============================================================
// TASKS
// ============================================================

export async function createTask(data, userId) {
    // V5: Auto-resolve areaId via milestone mapping
    let resolvedAreaId = data.areaId || null;
    let countsForScore = data.countsForScore || false;

    if (data.milestoneId && data.taskTypeId && !resolvedAreaId) {
        resolvedAreaId = await resolveAreaForTask(data.milestoneId, data.taskTypeId);
        countsForScore = true;
    } else if (data.milestoneId) {
        countsForScore = true;
    }

    // ── Peer Review: auto-resolve from taskType config ──
    let prRequired = data.peerReviewRequired || false;
    let prDiscipline = data.peerReviewDiscipline || null;
    if (data.taskTypeId && !prRequired) {
        try {
            const { resolvePeerReviewFromTaskType } = await import('./peerReviewService');
            const prConfig = await resolvePeerReviewFromTaskType(data.taskTypeId);
            if (prConfig) {
                prRequired = prConfig.peerReviewRequired;
                prDiscipline = prConfig.peerReviewDiscipline || null;
            }
        } catch (err) {
            console.warn('[taskService.sb] PR auto-resolve failed:', err.message);
        }
    }

    const { data: result, error } = await supabase
        .from('tasks')
        .insert({
            project_id: data.projectId || null,
            title: data.title || '',
            description: data.description || '',
            status: data.status || 'backlog',
            priority: data.priority || 'medium',
            task_type_id: data.taskTypeId || null,
            assigned_to: data.assignedTo || null,
            assigned_by: data.assignedBy || userId,
            estimated_hours: data.estimatedHours || null,
            actual_hours: 0,
            due_date: data.dueDate || null,
            tags: data.tags || [],
            station_id: data.stationId || null,
            milestone_id: data.milestoneId || null,
            area_id: resolvedAreaId,
            counts_for_score: countsForScore,
            peer_review_required: prRequired,
            peer_review_discipline: prDiscipline,
            peer_review_cycles: data.peerReviewCycles || 0,
            sort_order: data.sortOrder || 0,
            gantt_view_mode_default: data.ganttViewModeDefault || null,
            network_path: data.networkPath || null,
            blocked_at: data.blockedAt || null,
            unblocked_at: data.unblockedAt || null,
            total_blocked_hours: data.totalBlockedHours || 0,
            created_by: userId,
        })
        .select('id')
        .single();

    if (error) throw new Error(`[taskService.sb] createTask: ${error.message}`);

    // Log creation event
    logActivity(result.id, {
        type: ACTIVITY_TYPES.TASK_CREATED,
        description: `Tarea creada: ${data.title}`,
        userId,
        userName: null,
        meta: { title: data.title, projectId: data.projectId },
    });

    return result.id;
}

/**
 * Update non-workflow fields on a task.
 * SECURITY: Workflow-controlled fields are stripped before writing.
 * To change status, use updateTaskStatus() which calls the stored procedure.
 */
export async function updateTask(taskId, updates) {
    // Strip protected fields
    const safeUpdates = { ...updates };
    for (const field of WORKFLOW_PROTECTED_FIELDS) {
        delete safeUpdates[field];
    }

    // V5: Recalculate areaId when taskTypeId or milestoneId changes
    const milestoneId = safeUpdates.milestoneId;
    const taskTypeId = safeUpdates.taskTypeId;
    if ((taskTypeId || milestoneId) && milestoneId !== undefined) {
        if (milestoneId && taskTypeId) {
            const resolvedAreaId = await resolveAreaForTask(milestoneId, taskTypeId);
            safeUpdates.areaId = resolvedAreaId;
            safeUpdates.countsForScore = true;
        } else if (!milestoneId) {
            safeUpdates.milestoneId = null;
            safeUpdates.areaId = null;
            safeUpdates.countsForScore = false;
        }
    }

    // Map camelCase → snake_case
    const mapped = {};
    const fieldMap = {
        title: 'title', description: 'description',
        priority: 'priority', taskTypeId: 'task_type_id',
        assignedTo: 'assigned_to', assignedBy: 'assigned_by',
        estimatedHours: 'estimated_hours', actualHours: 'actual_hours',
        dueDate: 'due_date', tags: 'tags',
        stationId: 'station_id', milestoneId: 'milestone_id',
        areaId: 'area_id', countsForScore: 'counts_for_score',
        workAreaTypeId: 'area_id', // legacy alias used by MainTable
        projectId: 'project_id', blockedReason: 'blocked_reason',
        blockedByUserId: 'blocked_by_user_id', blockedByName: 'blocked_by_name',
        peerReviewRequired: 'peer_review_required',
        peerReviewDiscipline: 'peer_review_discipline',
        peerReviewStatus: 'peer_review_status',
        peerReviewCycles: 'peer_review_cycles',
        currentPeerReviewId: 'current_peer_review_id',
        lastPeerReviewerId: 'last_peer_reviewer_id',
        lastPeerReviewAt: 'last_peer_review_at',
        showInGantt: 'show_in_gantt',
        plannedStartDate: 'planned_start_date',
        plannedEndDate: 'planned_end_date',
        plannedDurationHours: 'planned_duration_hours',
        percentComplete: 'percent_complete',
        parentTaskId: 'parent_task_id',
        ganttViewModeDefault: 'gantt_view_mode_default',
        networkPath: 'network_path',
        blockedAt: 'blocked_at',
        unblockedAt: 'unblocked_at',
        totalBlockedHours: 'total_blocked_hours',
        sortOrder: 'sort_order',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
        if (safeUpdates[camel] !== undefined) {
            mapped[snake] = safeUpdates[camel];
        }
    }

    if (Object.keys(mapped).length === 0) return;

    const { error } = await supabase
        .from('tasks')
        .update(mapped)
        .eq('id', taskId);

    if (error) throw new Error(`[taskService.sb] updateTask: ${error.message}`);

    // Cascade projectId changes to time logs
    if ('project_id' in mapped) {
        const { error: syncErr } = await supabase
            .from('time_logs')
            .update({ project_id: mapped.project_id })
            .eq('task_id', taskId);

        if (syncErr) console.warn('[taskService.sb] Failed to sync projectId on time logs:', syncErr.message);
    }
}

/**
 * Transition task status via PostgreSQL stored procedure (server-enforced).
 * Replaces the Cloud Function `transitionTaskStatus`.
 *
 * @param {string} taskId — task UUID
 * @param {string} newStatus — target status
 * @param {string} [projectId] — not used (procedure reads from task row)
 * @param {boolean} [force=false] — skip validation (admin override)
 * @param {Object} [extraData={}] — { blockedReason, blockedByUserId, etc. }
 * @returns {Object} — { success, previousStatus, newStatus, taskId }
 */
export async function updateTaskStatus(taskId, newStatus, projectId, force = false, extraData = {}) {
    // Get current user info for audit trail
    const userId = extraData.userId || null;
    const userName = extraData.userName || '';

    const { data, error } = await supabase.rpc('transition_task_status', {
        p_task_id: taskId,
        p_new_status: newStatus,
        p_user_id: userId || 'system',
        p_user_name: userName,
        p_force: force,
        p_blocked_reason: extraData.blockedReason || null,
    });

    if (error) throw new Error(`[taskService.sb] updateTaskStatus RPC: ${error.message}`);

    // The stored procedure returns a JSONB object
    if (data && !data.success) {
        throw new Error(data.error || `Invalid transition to ${newStatus}`);
    }

    return data;
}

export async function deleteTask(taskId) {
    // Cascade deletes
    await supabase.from('subtasks').delete().eq('task_id', taskId);

    const { data: planItems } = await supabase
        .from('weekly_plan_items')
        .select('id')
        .eq('task_id', taskId);
    if (planItems?.length) {
        await supabase.from('weekly_plan_items').delete().eq('task_id', taskId);
        console.log(`[taskService.sb] Cascade-deleted ${planItems.length} planner items for task ${taskId}`);
    }

    const { data: logs } = await supabase
        .from('time_logs')
        .select('id')
        .eq('task_id', taskId);
    if (logs?.length) {
        await supabase.from('time_logs').delete().eq('task_id', taskId);
        console.log(`[taskService.sb] Cascade-deleted ${logs.length} time logs for task ${taskId}`);
    }

    await supabase.from('task_activity_log').delete().eq('task_id', taskId);
    await supabase.from('task_block_history').delete().eq('task_id', taskId);

    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) throw new Error(`[taskService.sb] deleteTask: ${error.message}`);
}

// ============================================================
// SUBTASKS
// ============================================================

export async function createSubtask(taskId, title) {
    const { data, error } = await supabase
        .from('subtasks')
        .insert({
            task_id: taskId,
            title,
            completed: false,
            sort_order: 999, // will be reordered
        })
        .select('id')
        .single();

    if (error) throw new Error(`[taskService.sb] createSubtask: ${error.message}`);
    return data.id;
}

export async function toggleSubtask(subtaskId, completed, {
    taskId = null, subtaskTitle = '', userId = null, userName = null,
    percentComplete = null, totalSubtasks = null, completedSubtasks = null
} = {}) {
    const updates = {
        completed,
        completed_at: completed ? new Date().toISOString() : null,
    };

    const { error } = await supabase
        .from('subtasks')
        .update(updates)
        .eq('id', subtaskId);

    if (error) throw new Error(`[taskService.sb] toggleSubtask: ${error.message}`);

    // Log activity
    if (taskId) {
        logActivity(taskId, {
            type: completed ? ACTIVITY_TYPES.SUBTASK_COMPLETED : ACTIVITY_TYPES.SUBTASK_UNCHECKED,
            description: completed
                ? `Subtarea completada: ${subtaskTitle}`
                : `Subtarea desmarcada: ${subtaskTitle}`,
            userId,
            userName,
            meta: { subtaskId, subtaskTitle, percentComplete, totalSubtasks, completedSubtasks },
        });
    }
}

export async function deleteSubtask(subtaskId) {
    const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', subtaskId);

    if (error) throw new Error(`[taskService.sb] deleteSubtask: ${error.message}`);
}

export async function updateSubtask(subtaskId, updates) {
    const mapped = {};
    if (updates.title !== undefined) mapped.title = updates.title;
    if (updates.completed !== undefined) mapped.completed = updates.completed;
    if (updates.order !== undefined) mapped.sort_order = updates.order;
    if (updates.sort_order !== undefined) mapped.sort_order = updates.sort_order;

    const { error } = await supabase
        .from('subtasks')
        .update(mapped)
        .eq('id', subtaskId);

    if (error) throw new Error(`[taskService.sb] updateSubtask: ${error.message}`);
}

export async function reorderSubtasks(orderedIds) {
    // Supabase doesn't have batch writes, so we do individual updates
    // This is acceptable since reorder is infrequent
    for (let i = 0; i < orderedIds.length; i++) {
        await supabase
            .from('subtasks')
            .update({ sort_order: i })
            .eq('id', orderedIds[i]);
    }
}
