/**
 * Gantt Service
 * =============
 * Handles all Firestore reads/writes for the Project Gantt module.
 */

import {
    collection, doc,
    getDocs, getDoc,
    addDoc, updateDoc, deleteDoc,
    query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../models/schemas';

// ---------------------------------------------------------------
// READ
// ---------------------------------------------------------------

/**
 * Get all tasks for the Gantt view.
 * Optionally filter by projectId.
 * @param {string|null} projectId
 * @returns {Promise<Array>}
 */
export async function getTasksForGantt(projectId = null) {
    const tasksRef = collection(db, COLLECTIONS.TASKS);
    let q;
    if (projectId) {
        q = query(tasksRef, where('projectId', '==', projectId));
    } else {
        q = query(tasksRef);
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get all task dependencies for a set of task IDs (or for a project).
 * @param {string|null} projectId
 * @returns {Promise<Array>}
 */
export async function getDependencies(projectId = null) {
    const depsRef = collection(db, COLLECTIONS.TASK_DEPENDENCIES);
    let q;
    if (projectId) {
        q = query(depsRef, where('projectId', '==', projectId));
    } else {
        q = query(depsRef, orderBy('createdAt', 'desc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get all engineering projects.
 * @returns {Promise<Array>}
 */
export async function getProjectsForGantt() {
    const ref = collection(db, COLLECTIONS.PROJECTS);
    const snap = await getDocs(query(ref, orderBy('name', 'asc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get all task types.
 * @returns {Promise<Array>}
 */
export async function getTaskTypesForGantt() {
    const ref = collection(db, COLLECTIONS.TASK_TYPES);
    const snap = await getDocs(ref);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get users for assignee filter.
 * @returns {Promise<Array>}
 */
export async function getUsersForGantt() {
    const ref = collection(db, COLLECTIONS.USERS_ROLES);
    const snap = await getDocs(ref);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---------------------------------------------------------------
// UPDATE — Task Gantt fields
// ---------------------------------------------------------------

/**
 * Update Gantt-specific fields of a task.
 * @param {string} taskId
 * @param {{ plannedStartDate?, plannedEndDate?, percentComplete?, showInGantt?, milestone? }} fields
 */
export async function updateTaskGanttFields(taskId, fields) {
    const ref = doc(db, COLLECTIONS.TASKS, taskId);
    await updateDoc(ref, {
        ...fields,
        updatedAt: new Date().toISOString(),
    });
}

// ---------------------------------------------------------------
// TASK DEPENDENCIES — CRUD
// ---------------------------------------------------------------

/**
 * Create a new task dependency.
 * @param {{ predecessorTaskId, successorTaskId, type, lagHours, projectId, createdBy }} dep
 * @returns {Promise<string>} new document ID
 */
export async function createDependency(dep) {
    const ref = collection(db, COLLECTIONS.TASK_DEPENDENCIES);
    const newDoc = await addDoc(ref, {
        predecessorTaskId: dep.predecessorTaskId,
        successorTaskId: dep.successorTaskId,
        type: dep.type || 'FS',
        lagHours: dep.lagHours || 0,
        projectId: dep.projectId || null,
        createdBy: dep.createdBy || null,
        createdAt: new Date().toISOString(),
    });
    return newDoc.id;
}

/**
 * Delete a task dependency.
 * @param {string} depId
 */
export async function deleteDependency(depId) {
    const ref = doc(db, COLLECTIONS.TASK_DEPENDENCIES, depId);
    await deleteDoc(ref);
}
