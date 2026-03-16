import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, createWeeklyPlanItemDocument } from '../models/schemas';
import { validatePlanItem, validatePlanItemFull } from '../utils/plannerUtils';

/**
 * Planner Service
 * ===============
 * CRUD operations for Weekly Planner items.
 *
 * VALIDATION CONTRACT:
 *   - Blocking validations (B1-B7) THROW — persistence is prevented.
 *   - Contextual warnings (W1-W5) are RETURNED — UI displays them.
 *   - Legacy items are NOT retroactively validated.
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
     * ENFORCED: Blocking validations throw — invalid items are NOT persisted.
     * Optional context enables contextual warnings (capacity, overlaps, etc.)
     *
     * @param {Object} data — plan item fields
     * @param {Object} [context] — optional context for warnings
     * @param {Array}  [context.existingItems] — plan items for the target week
     * @param {Object} [context.linkedTask] — linked task record
     * @param {number} [context.weeklyCapacityHours] — user's weekly capacity
     * @param {Array}  [context.allItemsForTask] — all plan items for this task
     * @returns {Promise<{ id: string, warnings: string[] }>}
     * @throws {Error} PlannerValidationError if blocking rules are violated
     */
    async createPlanItem(data, context = null) {
        // ── Validation ──
        let validation;

        if (context) {
            // Full validation: blocking + contextual warnings
            validation = validatePlanItemFull(data, context);
        } else {
            // Blocking-only validation (no context available)
            validation = validatePlanItem(data);
        }

        // BLOCKING: throw on errors — persistence is prevented
        if (!validation.valid) {
            const err = new Error(validation.errors.join(' | '));
            err.name = 'PlannerValidationError';
            err.validationErrors = validation.errors;
            err.validationWarnings = validation.warnings || [];
            throw err;
        }

        try {
            const newItemDoc = createWeeklyPlanItemDocument(data);
            const itemsRef = collection(db, COLLECTIONS.WEEKLY_PLAN_ITEMS);
            const docRef = await addDoc(itemsRef, {
                ...newItemDoc,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            return { id: docRef.id, warnings: validation.warnings || [] };
        } catch (error) {
            console.error("[plannerService] Error creating plan item:", error);
            throw error;
        }
    },

    /**
     * Update an existing time block (e.g. after drag/resize).
     * Validates scheduling fields if they are being updated.
     *
     * @param {string} itemId
     * @param {Object} updates — fields to update
     * @throws {Error} if scheduling fields are invalid
     */
    async updatePlanItem(itemId, updates) {
        // Validate scheduling fields if present in the update
        if (updates.startDateTime || updates.endDateTime || updates.plannedHours !== undefined) {
            const start = updates.startDateTime ? new Date(updates.startDateTime) : null;
            const end = updates.endDateTime ? new Date(updates.endDateTime) : null;

            if (start && isNaN(start.getTime())) {
                throw new Error('startDateTime no es una fecha válida.');
            }
            if (end && isNaN(end.getTime())) {
                throw new Error('endDateTime no es una fecha válida.');
            }
            if (start && end && end <= start) {
                throw new Error('endDateTime debe ser posterior a startDateTime.');
            }
            if (updates.plannedHours !== undefined && (typeof updates.plannedHours !== 'number' || updates.plannedHours <= 0)) {
                throw new Error('plannedHours debe ser mayor a 0.');
            }
        }

        try {
            const itemRef = doc(db, COLLECTIONS.WEEKLY_PLAN_ITEMS, itemId);
            await updateDoc(itemRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("[plannerService] Error updating plan item:", error);
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
            console.error("[plannerService] Error deleting plan item:", error);
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
            console.error("[plannerService] Error fetching weekly plan items:", error);
            throw error;
        }
    }
};
