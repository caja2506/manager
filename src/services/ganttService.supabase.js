/**
 * Gantt Service — Supabase Implementation
 * =========================================
 * Drop-in replacement for ganttService.js (Firestore version).
 *
 * @module services/ganttService.supabase
 */

import { supabase } from '../supabase';

// ---------------------------------------------------------------
// READ
// ---------------------------------------------------------------

/**
 * Get all tasks for the Gantt view.
 * Optionally filter by projectId.
 */
export async function getTasksForGantt(projectId = null) {
    let query = supabase.from('tasks').select('*');
    if (projectId) {
        query = query.eq('project_id', projectId);
    }
    const { data, error } = await query;
    if (error) throw new Error(`[ganttService.sb] getTasksForGantt: ${error.message}`);

    // Map snake_case → camelCase for frontend compatibility
    return (data || []).map(mapTaskRow);
}

/**
 * Get milestones for the Gantt grouping.
 * Optionally filter by projectId.
 */
export async function getMilestonesForGantt(projectId = null) {
    let query = supabase.from('milestones').select('*');
    if (projectId) {
        query = query.eq('project_id', projectId);
    }
    query = query.order('sort_order', { ascending: true });
    const { data, error } = await query;
    if (error) throw new Error(`[ganttService.sb] getMilestonesForGantt: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        projectId: row.project_id,
        milestoneType: row.milestone_type,
        status: row.status,
        startDate: row.start_date,
        dueDate: row.due_date,
        sortOrder: row.sort_order,
        parentMilestoneId: row.parent_milestone_id,
    }));
}

/**
 * Get all task dependencies for a project.
 */
export async function getDependencies(projectId = null) {
    let query = supabase.from('task_dependencies').select('*');
    if (projectId) {
        query = query.eq('project_id', projectId);
    } else {
        query = query.order('created_at', { ascending: false });
    }
    const { data, error } = await query;
    if (error) throw new Error(`[ganttService.sb] getDependencies: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        predecessorTaskId: row.predecessor_task_id,
        successorTaskId: row.successor_task_id,
        type: row.type,
        lagHours: row.lag_hours,
        projectId: row.project_id,
        createdBy: row.created_by,
        createdAt: row.created_at,
    }));
}

/**
 * Get all engineering projects.
 */
export async function getProjectsForGantt() {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('name', { ascending: true });

    if (error) throw new Error(`[ganttService.sb] getProjectsForGantt: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        priority: row.priority,
        ownerId: row.owner_id,
        startDate: row.start_date,
        dueDate: row.due_date,
        progress: row.progress,
    }));
}

/**
 * Get all task types.
 */
export async function getTaskTypesForGantt() {
    const { data, error } = await supabase
        .from('task_types')
        .select('*');

    if (error) throw new Error(`[ganttService.sb] getTaskTypesForGantt: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        icon: row.icon,
        color: row.color,
    }));
}

/**
 * Get users for assignee filter.
 */
export async function getUsersForGantt() {
    const { data, error } = await supabase
        .from('users')
        .select('*');

    if (error) throw new Error(`[ganttService.sb] getUsersForGantt: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        displayName: row.display_name,
        email: row.email,
        teamRole: row.team_role,
        rbacRole: row.rbac_role,
    }));
}

// ---------------------------------------------------------------
// UPDATE — Task Gantt fields
// ---------------------------------------------------------------

export async function updateTaskGanttFields(taskId, fields) {
    const mapped = {};
    if (fields.plannedStartDate !== undefined) mapped.planned_start_date = fields.plannedStartDate;
    if (fields.plannedEndDate !== undefined) mapped.planned_end_date = fields.plannedEndDate;
    if (fields.percentComplete !== undefined) mapped.percent_complete = fields.percentComplete;
    if (fields.showInGantt !== undefined) mapped.show_in_gantt = fields.showInGantt;
    if (fields.milestone !== undefined) mapped.milestone = fields.milestone;

    const { error } = await supabase
        .from('tasks')
        .update(mapped)
        .eq('id', taskId);

    if (error) throw new Error(`[ganttService.sb] updateTaskGanttFields: ${error.message}`);
}

// ---------------------------------------------------------------
// TASK DEPENDENCIES — CRUD
// ---------------------------------------------------------------

export async function createDependency(dep) {
    const { data, error } = await supabase
        .from('task_dependencies')
        .insert({
            predecessor_task_id: dep.predecessorTaskId,
            successor_task_id: dep.successorTaskId,
            type: dep.type || 'FS',
            lag_hours: dep.lagHours || 0,
            project_id: dep.projectId || null,
            created_by: dep.createdBy || null,
        })
        .select('id')
        .single();

    if (error) throw new Error(`[ganttService.sb] createDependency: ${error.message}`);
    return data.id;
}

export async function deleteDependency(depId) {
    const { error } = await supabase
        .from('task_dependencies')
        .delete()
        .eq('id', depId);

    if (error) throw new Error(`[ganttService.sb] deleteDependency: ${error.message}`);
}

// ---------------------------------------------------------------
// HELPERS — snake_case → camelCase mappers
// ---------------------------------------------------------------

function mapTaskRow(row) {
    return {
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        taskType: row.task_type_id,
        assignedTo: row.assigned_to,
        assignedBy: row.assigned_by,
        estimatedHours: row.estimated_hours,
        actualHours: row.actual_hours,
        dueDate: row.due_date,
        completedDate: row.completed_date,
        tags: row.tags,
        showInGantt: row.show_in_gantt,
        plannedStartDate: row.planned_start_date,
        plannedEndDate: row.planned_end_date,
        plannedDurationHours: row.planned_duration_hours,
        percentComplete: row.percent_complete,
        milestone: row.milestone,
        summaryTask: row.summary_task,
        parentTaskId: row.parent_task_id,
        stationId: row.station_id,
        milestoneId: row.milestone_id,
        blockedReason: row.blocked_reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
