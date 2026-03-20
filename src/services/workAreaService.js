/**
 * Work Area Service — V5 Phase 3
 * =================================
 * CRUD + task filtering for configurable work areas within milestones.
 * Score computation delegates to scoreEngine.
 *
 * @module services/workAreaService
 */

import {
    collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
    query, where, orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import {
    COLLECTIONS,
    createWorkAreaDocument,
} from '../models/schemas';
import {
    computeAreaScore as engineComputeAreaScore,
    explainScore,
} from '../core/scoring/scoreEngine';

// ── CRUD ──

/**
 * Create a new work area for a milestone.
 */
export async function createWorkArea(milestoneId, projectId, data, userId) {
    const areaData = createWorkAreaDocument({
        ...data,
        milestoneId,
        projectId,
        createdBy: userId,
        updatedBy: userId,
    });
    const ref = await addDoc(collection(db, COLLECTIONS.WORK_AREAS), areaData);
    return ref.id;
}

/**
 * Update a work area.
 */
export async function updateWorkArea(areaId, updates, userId) {
    const ref = doc(db, COLLECTIONS.WORK_AREAS, areaId);
    await updateDoc(ref, {
        ...updates,
        updatedBy: userId || null,
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Get all work areas for a milestone.
 */
export async function getWorkAreasByMilestone(milestoneId) {
    const q = query(
        collection(db, COLLECTIONS.WORK_AREAS),
        where('milestoneId', '==', milestoneId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Get all work areas for a project (across all milestones).
 */
export async function getWorkAreasByProject(projectId) {
    const q = query(
        collection(db, COLLECTIONS.WORK_AREAS),
        where('projectId', '==', projectId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
}

// ── Task Filtering (Pure Functions) ──

/**
 * Filter tasks that belong to a specific work area based on its taskFilter.
 */
export function getFilteredTasks(area, allTasks) {
    if (!area?.taskFilter) return allTasks;

    return allTasks.filter(task => {
        if (area.taskFilter.tagMatch?.length > 0) {
            const taskTags = task.tags || [];
            const hasTag = area.taskFilter.tagMatch.some(t => taskTags.includes(t));
            if (!hasTag) return false;
        }

        if (area.taskFilter.typeMatch?.length > 0) {
            if (!area.taskFilter.typeMatch.includes(task.taskType)) return false;
        }

        return true;
    });
}

// ── Score Computation (delegate to scoreEngine) ──

/**
 * Compute score for a work area.
 * Uses the full 6-factor model from scoreEngine.
 *
 * @param {Array} tasks - Filtered tasks for this area
 * @param {Object} options - { milestoneDueDate, delays, risks, override }
 * @returns {AreaScoreResult} Full score result with factors, penalties, locks, traffic light
 */
export function computeAreaScore(tasks, options = {}) {
    return engineComputeAreaScore(tasks, options);
}

/**
 * Compute score + explanation for a work area.
 */
export function computeAreaScoreWithExplanation(tasks, options = {}) {
    const result = engineComputeAreaScore(tasks, options);
    return {
        ...result,
        explanation: explainScore(result),
    };
}

/**
 * Apply a traffic light override to a work area.
 */
export async function applyAreaOverride(areaId, override, userId) {
    await updateWorkArea(areaId, {
        trafficLightOverride: override.value,
        trafficLightOverrideReason: override.reason,
        trafficLightOverrideBy: userId,
        trafficLightOverrideAt: new Date().toISOString(),
        trafficLightOverrideExpires: override.expiresAt,
    }, userId);
}

/**
 * Delete a work area.
 * [Phase M.2] Extracted from AreaScoreCard.
 */
export async function deleteWorkArea(areaId) {
    await deleteDoc(doc(db, COLLECTIONS.WORK_AREAS, areaId));
}

/**
 * Update a work area type's default task types (global relation mapping).
 * [Phase M.2] Extracted from AreaTaskTypeRelationModal.
 */
export async function updateWorkAreaTypeMapping(workAreaTypeId, taskTypeIds) {
    await updateDoc(doc(db, COLLECTIONS.WORK_AREA_TYPES, workAreaTypeId), {
        defaultTaskTypes: taskTypeIds,
    });
}

/**
 * Update a work area's task type IDs (per-milestone mapping).
 * [Phase M.2] Extracted from AreaTaskTypeRelationModal.
 */
export async function updateWorkAreaTaskTypes(workAreaId, taskTypeIds) {
    await updateDoc(doc(db, COLLECTIONS.WORK_AREAS, workAreaId), {
        taskTypeIds,
        'taskFilter.typeMatch': taskTypeIds.length > 0 ? taskTypeIds : null,
    });
}
