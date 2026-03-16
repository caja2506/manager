/**
 * ganttPlannerSync.js
 * ====================
 * Bidirectional sync between Gantt (tasks) and Weekly Planner (weeklyPlanItems).
 *
 * - syncGanttToPlanner(): Creates planner blocks for each weekday in a Gantt date range
 * - syncPlannerToGantt(): Updates task Gantt dates based on existing planner blocks
 */

import { collection, addDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../models/schemas';
import { updateTaskGanttFields } from './ganttService';

// ── Helpers ──

/** Get Monday of the week for a given date */
function getMondayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Format date as YYYY-MM-DD */
function toDateStr(d) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

/** Get all weekdays (Mon-Fri) between two dates inclusive */
function getWeekdaysInRange(startStr, endStr) {
    const days = [];
    const start = new Date(startStr + 'T12:00:00');
    const end = new Date(endStr + 'T12:00:00');
    const current = new Date(start);

    while (current <= end) {
        const dow = current.getDay();
        if (dow >= 1 && dow <= 5) { // Monday to Friday
            days.push(toDateStr(current));
        }
        current.setDate(current.getDate() + 1);
    }
    return days;
}

/**
 * Sync Gantt → Weekly Planner
 * ===========================
 * Creates 1 planner block per weekday in the task's Gantt date range.
 * Skips days where this exact task already has a block (avoids duplicates).
 *
 * @param {Object} params
 * @param {string} params.taskId
 * @param {string} params.startDate - YYYY-MM-DD
 * @param {string} params.endDate - YYYY-MM-DD
 * @param {Object} params.task - Full task object
 * @param {string} params.userId - Current user UID
 */
export async function syncGanttToPlanner({ taskId, startDate, endDate, task, userId }) {
    if (!startDate || !endDate || !taskId) return;

    const weekdays = getWeekdaysInRange(startDate, endDate);
    if (weekdays.length === 0) return;

    // Full workday blocks: 9 AM to 5 PM (8 hours)
    const hoursPerDay = 8;

    // Get ALL existing plan items for this task
    const itemsRef = collection(db, COLLECTIONS.WEEKLY_PLAN_ITEMS);
    const q = query(itemsRef, where('taskId', '==', taskId));
    const snapshot = await getDocs(q);

    const weekdaySet = new Set(weekdays);
    const existingDates = new Set();
    let created = 0;
    let deleted = 0;

    // Delete blocks that fall OUTSIDE the new Gantt range
    for (const docSnap of snapshot.docs) {
        const itemDate = docSnap.data().date;
        if (itemDate && !weekdaySet.has(itemDate)) {
            try {
                await deleteDoc(doc(db, COLLECTIONS.WEEKLY_PLAN_ITEMS, docSnap.id));
                deleted++;
            } catch (e) {
                console.error('[ganttPlannerSync] Error deleting plan item:', e.message);
            }
        } else {
            existingDates.add(itemDate);
        }
    }

    // Create blocks for days that don't already have this task
    for (const dateStr of weekdays) {
        if (existingDates.has(dateStr)) continue;

        const weekMonday = getMondayOfWeek(new Date(dateStr + 'T12:00:00'));
        const weekStartStr = toDateStr(weekMonday);
        const dayDate = new Date(dateStr + 'T12:00:00');

        const startDt = new Date(dateStr + 'T09:00:00');
        const endDt = new Date(dateStr + 'T17:00:00');

        const planItem = {
            taskId,
            weekStartDate: weekStartStr,
            date: dateStr,
            dayOfWeek: dayDate.getDay(),
            startDateTime: startDt.toISOString(),
            endDateTime: endDt.toISOString(),
            plannedHours: hoursPerDay,
            createdBy: userId || null,
            assignedTo: task?.assignedTo || userId || null,
            projectId: task?.projectId || null,
            notes: '',
            taskTitleSnapshot: task?.title || '',
            projectNameSnapshot: '',
            assignedToName: '',
            statusSnapshot: task?.status || 'pending',
            priority: task?.priority || 'medium',
            colorKey: 'indigo',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        try {
            await addDoc(itemsRef, planItem);
            created++;
        } catch (e) {
            console.error('[ganttPlannerSync] Error creating plan item for', dateStr, ':', e.message);
        }
    }

    if (created > 0 || deleted > 0) {
        console.log(`[ganttPlannerSync] Task "${task?.title}": +${created} bloques, -${deleted} bloques`);
    }
}

/**
 * Sync Weekly Planner → Gantt
 * ===========================
 * Updates the task's plannedStartDate / plannedEndDate based on
 * all existing plan items for that task.
 *
 * @param {string} taskId
 */
export async function syncPlannerToGantt(taskId) {
    if (!taskId) return;

    // Get all plan items for this task
    const itemsRef = collection(db, COLLECTIONS.WEEKLY_PLAN_ITEMS);
    const q = query(itemsRef, where('taskId', '==', taskId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        // No plan items — clear Gantt dates
        await updateTaskGanttFields(taskId, {
            plannedStartDate: null,
            plannedEndDate: null,
        });
        return;
    }

    // Find min and max dates
    const dates = snapshot.docs.map(doc => doc.data().date).filter(Boolean).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    if (minDate && maxDate) {
        await updateTaskGanttFields(taskId, {
            plannedStartDate: minDate,
            plannedEndDate: maxDate,
        });
    }
}
