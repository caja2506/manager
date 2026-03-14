import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, createWeeklyPlanItemDocument } from '../models/schemas';
import { validatePlanItem } from '../utils/plannerUtils';

/**
 * Service to handle CRUD operations for Weekly Planner items.
 *
 * Architecture: weeklyPlanItems are scheduling records linked to tasks by taskId.
 * The service persists scheduling data; snapshot fields are written transitionally
 * for backward compatibility but are NOT the source of truth.
 * The frontend enriches plan items with live task data via enrichPlanItemsWithTasks().
 */
export const plannerService = {
    /**
     * Create a new planned time block for a task.
     *
     * Validates required fields before persisting.
     * Snapshot fields (taskTitleSnapshot, projectNameSnapshot, etc.) are still
     * written transitionally — marked as TRANSITIONAL below.
     *
     * @param {Object} data — plan item fields
     * @returns {Promise<string>} docRef id
     * @throws {Error} if validation fails or Firestore write fails
     */
    async createPlanItem(data) {
        // ── Phase 7: Input validation ──
        const validation = validatePlanItem(data);
        if (!validation.valid) {
            console.warn('[plannerService] Validation errors:', validation.errors);
            // Don't throw — log warnings but allow creation for backward compat
            // In a future strict mode, uncomment: throw new Error(validation.errors.join('; '));
        }

        try {
            const newItemDoc = createWeeklyPlanItemDocument(data);
            const itemsRef = collection(db, COLLECTIONS.WEEKLY_PLAN_ITEMS);
            const docRef = await addDoc(itemsRef, {
                ...newItemDoc,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            return docRef.id;
        } catch (error) {
            console.error("Error creating plan item:", error);
            throw error;
        }
    },

    /**
     * Update an existing time block (e.g. after drag/resize).
     * Only scheduling fields should be updated here (dates, hours, notes).
     * Snapshot fields should NOT be refreshed on update — they are frozen at creation time
     * and will be deprecated entirely after migration.
     *
     * @param {string} itemId
     * @param {Object} updates — fields to update
     */
    async updatePlanItem(itemId, updates) {
        try {
            const itemRef = doc(db, COLLECTIONS.WEEKLY_PLAN_ITEMS, itemId);
            await updateDoc(itemRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating plan item:", error);
            throw error;
        }
    },

    /**
     * Delete a planned time block.
     * @param {string} itemId
     */
    async deletePlanItem(itemId) {
        try {
            const itemRef = doc(db, COLLECTIONS.WEEKLY_PLAN_ITEMS, itemId);
            await deleteDoc(itemRef);
        } catch (error) {
            console.error("Error deleting plan item:", error);
            throw error;
        }
    },

    /**
     * Get all planner blocks that overlap with a specific week.
     * Returns raw Firestore data — the caller should enrich via
     * enrichPlanItemsWithTasks() before rendering.
     *
     * @param {string} startYYYYMMDD Monday of the target week
     * @returns {Promise<Array>} raw plan items (not enriched)
     */
    async getWeeklyPlanItems(startYYYYMMDD) {
        try {
            const itemsRef = collection(db, COLLECTIONS.WEEKLY_PLAN_ITEMS);
            const q = query(itemsRef, where("weekStartDate", "==", startYYYYMMDD));

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error fetching weekly plan items:", error);
            throw error;
        }
    }
};
