/**
 * Task Service
 * =============
 * Firestore CRUD operations for tasks, subtasks, and engineering projects.
 */

import {
    collection, doc, setDoc, updateDoc, deleteDoc,
    writeBatch, getDocs, query, where, orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import {
    COLLECTIONS,
    createProjectDocument,
    createTaskDocument,
    createSubtaskDocument,
} from '../models/schemas';
import { calculateProjectRisk } from './riskService';

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
    const taskData = createTaskDocument({ ...data, createdBy: userId });
    const ref = doc(collection(db, COLLECTIONS.TASKS));
    await setDoc(ref, taskData);
    return ref.id;
}

export async function updateTask(taskId, updates) {
    await updateDoc(doc(db, COLLECTIONS.TASKS, taskId), {
        ...updates,
        updatedAt: new Date().toISOString(),
    });
}

export async function updateTaskStatus(taskId, newStatus, projectId) {
    const updates = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
    };
    if (newStatus === 'completed') {
        updates.completedDate = new Date().toISOString();
    }
    await updateDoc(doc(db, COLLECTIONS.TASKS, taskId), updates);

    // Recalculate risk if project is known
    if (projectId) {
        await calculateProjectRisk(projectId);
    }
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
