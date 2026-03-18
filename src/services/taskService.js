/**
 * Task Service
 * =============
 * Firestore CRUD operations for tasks, subtasks, and engineering projects.
 *
 * IMPORTANT — WORKFLOW ENFORCEMENT:
 * Status transitions MUST go through updateTaskStatus() which calls the
 * transitionTaskStatus Cloud Function. Direct Firestore writes to `status`
 * are blocked by security rules. See functions/index.js for server logic.
 */

import {
    collection, doc, setDoc, updateDoc, deleteDoc,
    writeBatch, getDocs, query, where
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import {
    COLLECTIONS,
    createProjectDocument,
    createTaskDocument,
    createSubtaskDocument,
} from '../models/schemas';
import { resolveAreaForTask, validateTaskAreaConsistency } from './mappingService';

// ── Cloud Function reference for workflow transitions ──
const transitionTaskStatusFn = httpsCallable(functions, 'transitionTaskStatus');

// ── Fields that ONLY the Cloud Function may write ──
// Defense-in-depth: strip these from any client-side updateTask() call
const WORKFLOW_PROTECTED_FIELDS = [
    'status', 'completedDate', 'completedAt',
    'reopenedAt', 'reopenedBy', 'updatedBy',
];

// ============================================================
// ENGINEERING PROJECTS
// ============================================================

export async function createProject(data, userId) {
    const projectData = createProjectDocument({ ...data, createdBy: userId });
    const ref = doc(collection(db, COLLECTIONS.PROJECTS));
    await setDoc(ref, projectData);
    return ref.id;
}

export async function updateProject(projectId, updates) {
    await updateDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
        ...updates,
        updatedAt: new Date().toISOString(),
    });
}

export async function deleteProject(projectId) {
    // Delete project and all its tasks + subtasks
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.PROJECTS, projectId));

    const tasksSnap = await getDocs(
        query(collection(db, COLLECTIONS.TASKS), where('projectId', '==', projectId))
    );
    for (const taskDoc of tasksSnap.docs) {
        const subtasksSnap = await getDocs(
            query(collection(db, COLLECTIONS.SUBTASKS), where('taskId', '==', taskDoc.id))
        );
        subtasksSnap.docs.forEach(s => batch.delete(s.ref));
        batch.delete(taskDoc.ref);
    }

    await batch.commit();
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

    const taskData = createTaskDocument({
        ...data,
        areaId: resolvedAreaId,
        countsForScore,
        createdBy: userId,
    });

    // Validate consistency (warn, don't block)
    const validation = validateTaskAreaConsistency(taskData);
    if (!validation.valid) {
        console.warn('[taskService] Area consistency warning:', validation.error);
    }

    const ref = doc(collection(db, COLLECTIONS.TASKS));
    await setDoc(ref, taskData);
    return ref.id;
}

/**
 * Update non-workflow fields on a task.
 * SECURITY: Workflow-controlled fields are stripped before writing.
 * To change status, use updateTaskStatus() which calls the Cloud Function.
 */
export async function updateTask(taskId, updates) {
    // Strip protected fields — they can only be set by the Cloud Function
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
            // Removing milestone → clear area linkage
            safeUpdates.milestoneId = null;
            safeUpdates.areaId = null;
            safeUpdates.countsForScore = false;
        }
    }

    await updateDoc(doc(db, COLLECTIONS.TASKS, taskId), {
        ...safeUpdates,
        updatedAt: new Date().toISOString(),
    });

    // Cascade projectId changes to time logs
    if ('projectId' in safeUpdates) {
        try {
            const logsSnap = await getDocs(
                query(collection(db, COLLECTIONS.TIME_LOGS), where('taskId', '==', taskId))
            );
            if (!logsSnap.empty) {
                const batch = writeBatch(db);
                logsSnap.docs.forEach(logDoc => {
                    batch.update(logDoc.ref, { projectId: safeUpdates.projectId || null });
                });
                await batch.commit();
                console.log(`[taskService] Synced projectId on ${logsSnap.size} time logs for task ${taskId}`);
            }
        } catch (err) {
            console.warn('[taskService] Failed to sync projectId on time logs:', err.message);
        }
    }
}

/**
 * Transition task status via Cloud Function (server-enforced).
 *
 * @param {string} taskId — task document ID
 * @param {string} newStatus — target status (must be valid transition)
 * @param {string} [projectId] — not used directly (CF reads from task doc)
 * @param {boolean} [force=false] — skip required field validation (admin override)
 * @returns {Object} — { success, previousStatus, newStatus, warnings[] }
 * @throws {Error} — if transition is invalid or fields are missing
 */
export async function updateTaskStatus(taskId, newStatus, projectId, force = false) {
    const result = await transitionTaskStatusFn({
        taskId,
        newStatus,
        force,
    });
    return result.data;
}

export async function deleteTask(taskId) {
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.TASKS, taskId));

    const subtasksSnap = await getDocs(
        query(collection(db, COLLECTIONS.SUBTASKS), where('taskId', '==', taskId))
    );
    subtasksSnap.docs.forEach(s => batch.delete(s.ref));

    await batch.commit();
}

// ============================================================
// SUBTASKS
// ============================================================

export async function createSubtask(taskId, title) {
    const data = createSubtaskDocument({ taskId, title });
    const ref = doc(collection(db, COLLECTIONS.SUBTASKS));
    await setDoc(ref, data);
    return ref.id;
}

export async function toggleSubtask(subtaskId, completed) {
    await updateDoc(doc(db, COLLECTIONS.SUBTASKS, subtaskId), { completed });
}

export async function deleteSubtask(subtaskId) {
    await deleteDoc(doc(db, COLLECTIONS.SUBTASKS, subtaskId));
}

export async function updateSubtask(subtaskId, updates) {
    await updateDoc(doc(db, COLLECTIONS.SUBTASKS, subtaskId), updates);
}

export async function reorderSubtasks(orderedIds) {
    const batch = writeBatch(db);
    orderedIds.forEach((id, index) => {
        batch.update(doc(db, COLLECTIONS.SUBTASKS, id), { order: index });
    });
    await batch.commit();
}
