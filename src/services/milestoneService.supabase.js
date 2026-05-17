/**
 * Milestone Service — Supabase Version
 * ======================================
 * CRUD + score computation for milestones.
 * Score engine logic stays in core (no change).
 */

import { supabase } from '../supabase';
import { createMilestoneDocument, createScoreSnapshotDocument } from '../models/schemas';
import {
    computeAreaScore as engineComputeAreaScore,
    computeMilestoneScore as engineComputeMilestoneScore,
    explainScore,
} from '../core/scoring/scoreEngine';
import { computeTrend, computeAreaTrends, generateChangeReason } from '../core/scoring/trendCalculator';

export { explainScore } from '../core/scoring/scoreEngine';
export { computeTrend, computeAreaTrends } from '../core/scoring/trendCalculator';

// ── CRUD ──

export async function createMilestone(projectId, data, userId) {
    const milestoneType = data.type || data.milestoneType || '';
    const row = {
        project_id: projectId,
        name: data.name || milestoneType,  // type IS the name
        milestone_type: milestoneType,
        description: data.description || '',
        status: data.status || 'active',
        start_date: data.startDate || null,
        due_date: data.dueDate || null,
        sort_order: data.order || 0,
        parent_milestone_id: data.parentMilestoneId || null,
        created_by: userId, updated_by: userId,
    };
    const { data: d, error } = await supabase.from('milestones').insert(row).select('id').single();
    if (error) throw new Error(`[milestoneService.sb] create: ${error.message}`);
    return d.id;
}

export async function updateMilestone(milestoneId, updates, userId) {
    const u = {};
    if (updates.name !== undefined) u.name = updates.name;
    if (updates.type !== undefined) { u.milestone_type = updates.type; u.name = updates.type; }
    if (updates.description !== undefined) u.description = updates.description;
    if (updates.status !== undefined) u.status = updates.status;
    if (updates.startDate !== undefined) u.start_date = updates.startDate;
    if (updates.dueDate !== undefined) u.due_date = updates.dueDate;
    if (updates.completedDate !== undefined) u.completed_date = updates.completedDate;
    if (updates.trafficLightOverride !== undefined) u.traffic_light_override = updates.trafficLightOverride;
    if (updates.trafficLightOverrideReason !== undefined) u.traffic_light_override_reason = updates.trafficLightOverrideReason;
    if (updates.trafficLightOverrideBy !== undefined) u.traffic_light_override_by = updates.trafficLightOverrideBy;
    if (updates.trafficLightOverrideAt !== undefined) u.traffic_light_override_at = updates.trafficLightOverrideAt;
    if (updates.trafficLightOverrideExpires !== undefined) u.traffic_light_override_expires = updates.trafficLightOverrideExpires;
    if (updates.parentMilestoneId !== undefined) u.parent_milestone_id = updates.parentMilestoneId;
    u.updated_by = userId;

    const { error } = await supabase.from('milestones').update(u).eq('id', milestoneId);
    if (error) throw new Error(`[milestoneService.sb] update: ${error.message}`);
}

export async function deleteMilestone(milestoneId) {
    const { error } = await supabase.from('milestones').delete().eq('id', milestoneId);
    if (error) throw new Error(`[milestoneService.sb] delete: ${error.message}`);
}

export async function getMilestonesByProject(projectId) {
    const { data, error } = await supabase.from('milestones').select('*')
        .eq('project_id', projectId).order('sort_order', { ascending: true });
    if (error) { console.error('[milestoneService.sb]', error.message); return []; }
    return (data || []).map(mapMilestone);
}

/** Load ALL milestones across all projects (for Master Project Plan / Roadmap). */
export async function getAllMilestones() {
    const { data, error } = await supabase.from('milestones').select('*')
        .order('project_id').order('sort_order', { ascending: true });
    if (error) { console.error('[milestoneService.sb] getAllMilestones:', error.message); return []; }
    return (data || []).map(mapMilestone);
}

/** Bulk-create milestones from all milestone types for a new project. */
export async function createProjectMilestones(projectId, milestoneTypeNames, userId) {
    const rows = milestoneTypeNames.map((typeName, i) => ({
        project_id: projectId,
        name: typeName,
        milestone_type: typeName,
        description: '',
        status: 'planning',
        sort_order: i,
        created_by: userId, updated_by: userId,
    }));
    const { data, error } = await supabase.from('milestones').insert(rows).select('id');
    if (error) throw new Error(`[milestoneService.sb] bulk create: ${error.message}`);
    return (data || []).map(d => d.id);
}

// ── Score (delegates to engine — no change) ──

export function computeFullScore(milestone, workAreas, tasksByArea, options = {}) {
    const { delaysByArea = {}, risksByArea = {}, snapshots = [] } = options;
    const areaResults = {};
    const areaResultsArray = [];
    for (const area of workAreas) {
        const override = area.trafficLightOverride ? {
            value: area.trafficLightOverride, reason: area.trafficLightOverrideReason,
            expiresAt: area.trafficLightOverrideExpires,
        } : null;
        const result = engineComputeAreaScore(tasksByArea[area.id] || [], {
            milestoneDueDate: milestone.dueDate,
            delays: delaysByArea[area.id] || [], risks: risksByArea[area.id] || [], override,
        });
        areaResults[area.id] = { ...result, areaId: area.id, areaName: area.name, explanation: explainScore(result) };
        areaResultsArray.push(result);
    }
    const mOverride = milestone.trafficLightOverride ? {
        value: milestone.trafficLightOverride, reason: milestone.trafficLightOverrideReason,
        expiresAt: milestone.trafficLightOverrideExpires,
    } : null;
    const milestoneResult = engineComputeMilestoneScore(areaResultsArray, { override: mOverride });
    const milestoneTrend = computeTrend(milestoneResult.score, snapshots);
    const currentAreaScores = Object.entries(areaResults).map(([areaId, r]) => ({ areaId, score: r.score }));
    const areaTrends = computeAreaTrends(currentAreaScores, snapshots);
    return {
        milestone: { ...milestoneResult, trend: milestoneTrend },
        areas: Object.fromEntries(Object.entries(areaResults).map(([id, r]) => [id, { ...r, trend: areaTrends[id] || 'stable' }])),
    };
}

export async function applyTrafficLightOverride(milestoneId, override, userId) {
    await updateMilestone(milestoneId, {
        trafficLightOverride: override.value, trafficLightOverrideReason: override.reason,
        trafficLightOverrideBy: userId, trafficLightOverrideAt: new Date().toISOString(),
        trafficLightOverrideExpires: override.expiresAt,
    }, userId);
}

export async function captureScoreSnapshot(milestoneId, projectId, fullScoreResult, options = {}) {
    const { triggeredBy = 'system', snapshotType = 'scheduled', previousSnapshots = [], comment = null } = options;
    const prevScore = previousSnapshots.length > 0 ? previousSnapshots[0].milestoneScore : null;
    const changeReason = prevScore !== null
        ? generateChangeReason(prevScore, fullScoreResult.milestone.score, fullScoreResult.milestone.locks, [])
        : 'Snapshot inicial';
    const row = {
        milestone_id: milestoneId, project_id: projectId, snapshot_type: snapshotType,
        milestone_score: fullScoreResult.milestone.score,
        milestone_traffic_light: fullScoreResult.milestone.trafficLight.value,
        milestone_status: 'active',
        area_scores: Object.entries(fullScoreResult.areas).map(([areaId, r]) => ({
            areaId, name: r.areaName || '', score: r.score, trafficLight: r.trafficLight.value, trend: r.trend,
        })),
        active_locks: fullScoreResult.milestone.locks, active_penalties: {},
        triggered_by: triggeredBy, change_reason: changeReason,
        trend: fullScoreResult.milestone.trend, comment,
    };
    const { error } = await supabase.from('score_snapshots').insert(row);
    if (error) throw new Error(`[milestoneService.sb] snapshot: ${error.message}`);
}

export async function getScoreSnapshots(milestoneId, limit = 100) {
    const { data, error } = await supabase.from('score_snapshots').select('*')
        .eq('milestone_id', milestoneId).order('captured_at', { ascending: false }).limit(limit);
    if (error) { console.error('[milestoneService.sb] snapshots:', error.message); return []; }
    return data || [];
}

function mapMilestone(m) {
    return {
        id: m.id, projectId: m.project_id,
        name: m.name, type: m.milestone_type || m.name,
        description: m.description,
        status: m.status, startDate: m.start_date, dueDate: m.due_date,
        completedDate: m.completed_date, score: m.score, trafficLight: m.traffic_light,
        trafficLightOverride: m.traffic_light_override,
        trafficLightOverrideReason: m.traffic_light_override_reason,
        trafficLightOverrideBy: m.traffic_light_override_by,
        trafficLightOverrideAt: m.traffic_light_override_at,
        trafficLightOverrideExpires: m.traffic_light_override_expires,
        parentMilestoneId: m.parent_milestone_id,
        order: m.sort_order, createdBy: m.created_by, updatedBy: m.updated_by,
        createdAt: m.created_at, updatedAt: m.updated_at,
    };
}
