/**
 * engineeringDataService.js
 * =========================
 * [Phase M.2] Firestore operations for engineering data.
 * Used by TaskDetailModal and other components for on-demand queries.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../models/schemas';

/**
 * Fetch milestones for a project.
 * @param {string} projectId
 * @returns {Promise<Array>}
 */
export async function fetchProjectMilestones(projectId) {
    const q = query(collection(db, COLLECTIONS.MILESTONES), where('projectId', '==', projectId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch work areas for a milestone.
 * @param {string} milestoneId
 * @returns {Promise<Array>}
 */
export async function fetchMilestoneWorkAreas(milestoneId) {
    const q = query(collection(db, COLLECTIONS.WORK_AREAS), where('milestoneId', '==', milestoneId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch dependencies for a task (both predecessor and successor).
 * @param {string} taskId
 * @returns {Promise<Array>}
 */
export async function fetchTaskDependencies(taskId) {
    const depsRef = collection(db, COLLECTIONS.TASK_DEPENDENCIES);
    const [predSnap, succSnap] = await Promise.all([
        getDocs(query(depsRef, where('successorTaskId', '==', taskId))),
        getDocs(query(depsRef, where('predecessorTaskId', '==', taskId))),
    ]);
    const all = [
        ...predSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        ...succSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    ];
    return Array.from(new Map(all.map(d => [d.id, d])).values());
}

/**
 * Fetch weekly planner items for a task.
 * @param {string} taskId
 * @returns {Promise<Array>}
 */
export async function fetchTaskPlannerItems(taskId) {
    const planRef = collection(db, COLLECTIONS.WEEKLY_PLAN_ITEMS || 'weeklyPlanItems');
    const snap = await getDocs(query(planRef, where('taskId', '==', taskId)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Add a new work area type.
 * @param {string} name
 * @returns {Promise<DocumentReference>}
 */
export async function addWorkAreaType(name) {
    const { addDoc } = await import('firebase/firestore');
    return addDoc(collection(db, COLLECTIONS.WORK_AREA_TYPES), { name });
}
