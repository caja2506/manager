/**
 * resourceAssignmentService.js — V5 Daily Scrum
 * ================================================
 * Manages operational responsibility assignments (engineer → technician).
 * 
 * RULES:
 * - One active assignment per technician at a time
 * - Reassignment closes the previous and creates new
 * - Does NOT affect task.assignedTo
 * - Full audit trail via createdAt/updatedAt
 */

import {
    collection, doc, addDoc, updateDoc, getDocs,
    query, where, orderBy, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../models/schemas';

const COL = COLLECTIONS.RESOURCE_ASSIGNMENTS;

/**
 * Create a new resource assignment document
 */
function buildAssignmentDoc(technicianId, engineerId, reason, userId) {
    const now = new Date().toISOString();
    return {
        technicianId,
        engineerId,
        startDate: now,
        endDate: null,
        active: true,
        reason: reason || 'default',
        createdAt: now,
        createdBy: userId,
        updatedAt: now,
        updatedBy: userId,
    };
}

/**
 * Get all active assignments
 * @returns {Promise<Array>}
 */
export async function getActiveAssignments() {
    const q = query(
        collection(db, COL),
        where('active', '==', true)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get assignment history for a specific technician (audit trail)
 * @param {string} technicianId
 * @returns {Promise<Array>}
 */
export async function getAssignmentHistory(technicianId) {
    const q = query(
        collection(db, COL),
        where('technicianId', '==', technicianId)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

/**
 * Create initial assignment (first time a technician is assigned)
 * @param {string} technicianId
 * @param {string} engineerId
 * @param {string} userId - who performed the action
 * @returns {Promise<string>} new document ID
 */
export async function createInitialAssignment(technicianId, engineerId, userId) {
    const docData = buildAssignmentDoc(technicianId, engineerId, 'default', userId);
    const ref = await addDoc(collection(db, COL), docData);
    return ref.id;
}

/**
 * Reassign a technician to a new engineer.
 * Closes the previous active assignment and creates a new one.
 * 
 * @param {string} technicianId
 * @param {string} newEngineerId
 * @param {string} reason - 'préstamo' | 'soporte' | 'temporal' | 'default'
 * @param {string} userId - who performed the action
 * @returns {Promise<{ closedId: string|null, newId: string }>}
 */
export async function reassignTechnician(technicianId, newEngineerId, reason, userId) {
    const now = new Date().toISOString();

    // 1. Find and close the current active assignment
    const activeQ = query(
        collection(db, COL),
        where('technicianId', '==', technicianId),
        where('active', '==', true)
    );
    const activeSnap = await getDocs(activeQ);

    let closedId = null;
    for (const d of activeSnap.docs) {
        await updateDoc(doc(db, COL, d.id), {
            active: false,
            endDate: now,
            updatedAt: now,
            updatedBy: userId,
        });
        closedId = d.id;
    }

    // 2. Create new active assignment
    const newDoc = buildAssignmentDoc(technicianId, newEngineerId, reason, userId);
    const ref = await addDoc(collection(db, COL), newDoc);

    return { closedId, newId: ref.id };
}
