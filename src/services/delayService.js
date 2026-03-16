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
import { updateTaskStatus, updateTask } from './taskService';
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

    // Automatically flag task as blocked via the official workflow transition.
    // NOTE: Uses Cloud Function — status writes are blocked from client.
    if (data.taskId) {
        // Set blockedReason first (non-protected field, direct write OK)
        await updateTask(data.taskId, {
            blockedReason: docData.causeName || 'Retraso reportado',
        });
        // Then transition status via Cloud Function
        try {
            await updateTaskStatus(data.taskId, 'blocked', data.projectId, true);
        } catch (err) {
            // Transition may fail if task is already blocked or in invalid state
            console.warn('[delayService] Auto-block transition failed:', err.message);
        }
    }

    // Risk recalculation is handled by the CF transition above
    // (transitionTaskStatus calls recalculateProjectRisk server-side)

    return ref.id;
}

export async function resolveDelay(delayId, projectId, taskId) {
    const ref = doc(db, COLLECTIONS.DELAYS, delayId);
    await updateDoc(ref, {
        resolved: true,
        resolvedAt: new Date().toISOString()
    });

    // Auto-transition task out of "blocked" → "in_progress"
    if (taskId) {
        try {
            // Clear the blocked reason
            await updateTask(taskId, { blockedReason: '' });
            // Transition status via Cloud Function
            await updateTaskStatus(taskId, 'in_progress', projectId, true);
        } catch (err) {
            // Task may already be unblocked or in different state
            console.warn('[delayService] Auto-unblock transition failed:', err.message);
        }
    }

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
