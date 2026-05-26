/**
 * engineeringDataService.supabase.js
 * ====================================
 * Supabase implementation for engineering data queries.
 * Used by TaskDetailModal and other components.
 */

import { supabase } from '../supabase';

/**
 * Fetch milestones for a project.
 */
export async function fetchProjectMilestones(projectId) {
    const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .eq('project_id', projectId);
    if (error) { console.error('[engineeringData] fetchProjectMilestones:', error.message); return []; }
    return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        description: row.description,
        startDate: row.start_date,
        endDate: row.end_date,
        status: row.status,
        order: row.order,
        ...row,
    }));
}

/**
 * Fetch work areas for a milestone.
 */
export async function fetchMilestoneWorkAreas(milestoneId) {
    const { data, error } = await supabase
        .from('work_areas')
        .select('*')
        .eq('milestone_id', milestoneId);
    if (error) { console.error('[engineeringData] fetchMilestoneWorkAreas:', error.message); return []; }
    return (data || []).map(row => ({
        id: row.id,
        milestoneId: row.milestone_id,
        name: row.name,
        description: row.description,
        status: row.status,
        taskTypeIds: row.task_type_ids || [],
        ...row,
    }));
}

/**
 * Fetch dependencies for a task (both predecessor and successor).
 */
export async function fetchTaskDependencies(taskId) {
    const [predResult, succResult] = await Promise.all([
        supabase.from('task_dependencies').select('*').eq('successor_task_id', taskId),
        supabase.from('task_dependencies').select('*').eq('predecessor_task_id', taskId),
    ]);

    const predData = predResult.data || [];
    const succData = succResult.data || [];
    const all = [...predData, ...succData].map(row => ({
        id: row.id,
        predecessorTaskId: row.predecessor_task_id,
        successorTaskId: row.successor_task_id,
        type: row.type,
        ...row,
    }));

    return Array.from(new Map(all.map(d => [d.id, d])).values());
}

/**
 * Fetch weekly planner items for a task.
 */
export async function fetchTaskPlannerItems(taskId) {
    const { data, error } = await supabase
        .from('weekly_plan_items')
        .select('*')
        .eq('task_id', taskId);
    if (error) { console.error('[engineeringData] fetchTaskPlannerItems:', error.message); return []; }
    return (data || []).map(row => ({
        id: row.id,
        taskId: row.task_id,
        weekStartDate: row.week_start_date,
        date: row.date,
        dayOfWeek: row.day_of_week,
        startDateTime: row.start_date_time,
        endDateTime: row.end_date_time,
        plannedHours: row.planned_hours,
        ...row,
    }));
}

/**
 * Add a new work area type.
 */
export async function addWorkAreaType(name) {
    const { data, error } = await supabase
        .from('work_area_types')
        .insert({ name })
        .select()
        .single();
    if (error) throw error;
    return data;
}
