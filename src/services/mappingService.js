/**
 * Mapping Service — V5
 * =====================
 * Pure functions for resolving taskTypeId → areaId via milestone work areas.
 *
 * RULE: areaId MUST be persisted on the task document.
 *       This service is called ONLY at task creation/edit time,
 *       NEVER at score computation time.
 *
 * @module services/mappingService
 */

import { getWorkAreasByMilestone } from './workAreaService';

/**
 * Resolve which work area a task belongs to, based on its taskTypeId.
 *
 * @param {string} milestoneId - The milestone to look up
 * @param {string} taskTypeId - The task type to resolve
 * @param {Array} [workAreas] - Optional pre-fetched work areas (avoids refetch)
 * @returns {Promise<string|null>} areaId or null if no mapping found
 */
export async function resolveAreaForTask(milestoneId, taskTypeId, workAreas = null) {
    if (!milestoneId || !taskTypeId) return null;

    const areas = workAreas || await getWorkAreasByMilestone(milestoneId);

    for (const area of areas) {
        const typeIds = area.taskTypeIds || [];
        // Also check legacy taskFilter.typeMatch for backward compat
        const legacyTypes = area.taskFilter?.typeMatch || [];
        const allTypes = [...new Set([...typeIds, ...legacyTypes])];

        if (allTypes.includes(taskTypeId)) {
            return area.id;
        }
    }

    return null;
}

/**
 * Resolve areaId synchronously from a pre-fetched work areas list.
 * Used when work areas are already available (e.g., in UI components).
 *
 * @param {string} taskTypeId - The task type to resolve
 * @param {Array} workAreas - Pre-fetched work areas with taskTypeIds[]
 * @returns {string|null} areaId or null
 */
export function resolveAreaSync(taskTypeId, workAreas) {
    if (!taskTypeId || !workAreas?.length) return null;

    for (const area of workAreas) {
        const typeIds = area.taskTypeIds || [];
        const legacyTypes = area.taskFilter?.typeMatch || [];
        const allTypes = [...new Set([...typeIds, ...legacyTypes])];

        if (allTypes.includes(taskTypeId)) {
            return area.id;
        }
    }

    return null;
}

/**
 * Validate that a task with a milestoneId also has an areaId.
 *
 * @param {Object} taskData - Task document data
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateTaskAreaConsistency(taskData) {
    if (taskData.milestoneId && !taskData.areaId) {
        return {
            valid: false,
            error: 'Task con milestoneId debe tener areaId. Verifique el mapping de tipos de tarea.',
        };
    }
    return { valid: true };
}
