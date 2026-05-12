/**
 * Work Area Service — Supabase Version
 * ======================================
 * CRUD + task filtering for work areas.
 * Score computation delegates to scoreEngine (no change).
 */

import { supabase } from '../supabase';
import {
    computeAreaScore as engineComputeAreaScore,
    explainScore,
} from '../core/scoring/scoreEngine';

// ── CRUD ──

export async function createWorkArea(milestoneId, projectId, data, userId) {
    const row = {
        milestone_id: milestoneId, project_id: projectId,
        name: data.name || '', description: data.description || '',
        task_filter: data.taskFilter || {}, task_type_ids: data.taskTypeIds || [],
        sort_order: data.order || 0, created_by: userId, updated_by: userId,
    };
    const { data: d, error } = await supabase.from('work_areas').insert(row).select('id').single();
    if (error) throw new Error(`[workAreaService.sb] create: ${error.message}`);
    return d.id;
}

export async function updateWorkArea(areaId, updates, userId) {
    const u = {};
    if (updates.name !== undefined) u.name = updates.name;
    if (updates.description !== undefined) u.description = updates.description;
    if (updates.taskFilter !== undefined) u.task_filter = updates.taskFilter;
    if (updates.taskTypeIds !== undefined) u.task_type_ids = updates.taskTypeIds;
    if (updates.trafficLightOverride !== undefined) u.traffic_light_override = updates.trafficLightOverride;
    if (updates.trafficLightOverrideReason !== undefined) u.traffic_light_override_reason = updates.trafficLightOverrideReason;
    if (updates.trafficLightOverrideBy !== undefined) u.traffic_light_override_by = updates.trafficLightOverrideBy;
    if (updates.trafficLightOverrideAt !== undefined) u.traffic_light_override_at = updates.trafficLightOverrideAt;
    if (updates.trafficLightOverrideExpires !== undefined) u.traffic_light_override_expires = updates.trafficLightOverrideExpires;
    u.updated_by = userId || null;

    const { error } = await supabase.from('work_areas').update(u).eq('id', areaId);
    if (error) throw new Error(`[workAreaService.sb] update: ${error.message}`);
}

export async function getWorkAreasByMilestone(milestoneId) {
    const { data, error } = await supabase.from('work_areas').select('*')
        .eq('milestone_id', milestoneId).order('sort_order');
    if (error) { console.error('[workAreaService.sb]', error.message); return []; }
    return (data || []).map(mapArea);
}

export async function getWorkAreasByProject(projectId) {
    const { data, error } = await supabase.from('work_areas').select('*')
        .eq('project_id', projectId).order('sort_order');
    if (error) { console.error('[workAreaService.sb]', error.message); return []; }
    return (data || []).map(mapArea);
}

// ── Task Filtering (Pure — no change) ──

export function getFilteredTasks(area, allTasks) {
    if (!area?.taskFilter) return allTasks;
    return allTasks.filter(task => {
        if (area.taskFilter.tagMatch?.length > 0) {
            if (!(task.tags || []).some(t => area.taskFilter.tagMatch.includes(t))) return false;
        }
        if (area.taskFilter.typeMatch?.length > 0) {
            if (!area.taskFilter.typeMatch.includes(task.taskType)) return false;
        }
        return true;
    });
}

// ── Score (delegate to engine — no change) ──

export function computeAreaScore(tasks, options = {}) {
    return engineComputeAreaScore(tasks, options);
}

export function computeAreaScoreWithExplanation(tasks, options = {}) {
    const result = engineComputeAreaScore(tasks, options);
    return { ...result, explanation: explainScore(result) };
}

export async function applyAreaOverride(areaId, override, userId) {
    await updateWorkArea(areaId, {
        trafficLightOverride: override.value, trafficLightOverrideReason: override.reason,
        trafficLightOverrideBy: userId, trafficLightOverrideAt: new Date().toISOString(),
        trafficLightOverrideExpires: override.expiresAt,
    }, userId);
}

export async function deleteWorkArea(areaId) {
    const { error } = await supabase.from('work_areas').delete().eq('id', areaId);
    if (error) throw new Error(`[workAreaService.sb] delete: ${error.message}`);
}

export async function updateWorkAreaTypeMapping(workAreaTypeId, taskTypeIds) {
    const { error } = await supabase.from('work_area_types')
        .update({ default_task_types: taskTypeIds }).eq('id', workAreaTypeId);
    if (error) throw new Error(`[workAreaService.sb] typeMapping: ${error.message}`);
}

export async function updateWorkAreaTaskTypes(workAreaId, taskTypeIds) {
    await updateWorkArea(workAreaId, {
        taskTypeIds,
        taskFilter: taskTypeIds.length > 0 ? { typeMatch: taskTypeIds } : {},
    });
}

function mapArea(a) {
    return {
        id: a.id, milestoneId: a.milestone_id, projectId: a.project_id,
        name: a.name, description: a.description, taskFilter: a.task_filter,
        taskTypeIds: a.task_type_ids, score: a.score, trafficLight: a.traffic_light,
        trafficLightOverride: a.traffic_light_override,
        trafficLightOverrideReason: a.traffic_light_override_reason,
        order: a.sort_order, createdBy: a.created_by,
        createdAt: a.created_at, updatedAt: a.updated_at,
    };
}
