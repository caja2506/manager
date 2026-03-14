/**
 * Delay Service
 * =============
 * Firestore CRUD operations for delays and configurable delay causes.
 */

import {
    collection, doc, setDoc, updateDoc, deleteDoc,
    writeBatch, getDocs, query, where, orderBy, getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import {
    COLLECTIONS,
    createDelayDocument,
    createDelayCauseDocument
} from '../models/schemas';
import { calculateProjectRisk } from './riskService';

// ============================================================
// DELAY CAUSES (Configurable by admin)
// ============================================================

export async function createDelayCause(data) {
    const docData = createDelayCauseDocument(data);
    const ref = doc(collection(db, COLLECTIONS.DELAY_CAUSES));
    await setDoc(ref, docData);
    return ref.id;
}

export async function updateDelayCause(causeId, updates) {
    await updateDoc(doc(db, COLLECTIONS.DELAY_CAUSES, causeId), {
        ...updates
    });
}

export async function deleteDelayCause(causeId) {
    await deleteDoc(doc(db, COLLECTIONS.DELAY_CAUSES, causeId));
}

// ============================================================
// DELAYS
// ============================================================

export async function createDelay(data, userId) {
    const docData = createDelayDocument({ ...data, createdBy: userId });
    const ref = doc(collection(db, COLLECTIONS.DELAYS));
    await setDoc(ref, docData);

    // Automatically flag task as blocked if a delay is registered and it's a task.
    if (data.taskId) {
        await updateDoc(doc(db, COLLECTIONS.TASKS, data.taskId), {
            status: 'blocked',
            blockedReason: docData.causeName || 'Retraso reportado',
            updatedAt: new Date().toISOString()
        });
    }

    // Creating a delay triggers risk recalculation for the project
    if (data.projectId) {
        await calculateProjectRisk(data.projectId);
    }

    return ref.id;
}

export async function resolveDelay(delayId, projectId) {
    const ref = doc(db, COLLECTIONS.DELAYS, delayId);
    await updateDoc(ref, {
        resolved: true,
        resolvedAt: new Date().toISOString()
    });
    if (projectId) {
        await calculateProjectRisk(projectId);
    }
}

export async function updateDelay(delayId, updates) {
    await updateDoc(doc(db, COLLECTIONS.DELAYS, delayId), {
        ...updates
    });
}

export async function deleteDelay(delayId) {
    await deleteDoc(doc(db, COLLECTIONS.DELAYS, delayId));
}
