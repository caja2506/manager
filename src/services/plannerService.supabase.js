/**
 * Planner Service — Supabase Implementation
 * ==========================================
 * Drop-in replacement for plannerService.js (Firestore version).
 *
 * VALIDATION CONTRACT (unchanged):
 *   - Blocking validations (B1-B7) THROW — persistence is prevented.
 *   - Contextual warnings (W1-W5) are RETURNED — UI displays them.
 *   - Legacy items are NOT retroactively validated.
 *
 * @module services/plannerService.supabase
 */

import { supabase } from '../supabase';
import { validatePlanItem, validatePlanItemFull } from '../utils/plannerUtils';

export const plannerService = {
    /**
     * Create a new planned time block for a task.
     */
    async createPlanItem(data, context = null) {
        // ── Validation (same as Firestore version) ──
        let validation;
        if (context) {
            validation = validatePlanItemFull(data, context);
        } else {
            validation = validatePlanItem(data);
        }

        if (!validation.valid) {
            const err = new Error(validation.errors.join(' | '));
            err.name = 'PlannerValidationError';
            err.validationErrors = validation.errors;
            err.validationWarnings = validation.warnings || [];
            throw err;
        }

        try {
            const { data: result, error } = await supabase
                .from('weekly_plan_items')
                .insert({
                    task_id: data.taskId || null,
                    assigned_to: data.assignedTo || null,
                    week_start_date: data.weekStartDate,
                    day_of_week: data.dayOfWeek,
                    start_date_time: data.startDateTime || null,
                    end_date_time: data.endDateTime || null,
                    planned_hours: data.plannedHours || 0,
                    notes: data.notes || '',
                    status: data.status || 'planned',
                    project_id: data.projectId || null,
                    task_title: data.taskTitle || '',
                    project_name: data.projectName || '',
                    created_by: data.createdBy || data.assignedTo || null,
                })
                .select('id')
                .single();

            if (error) throw error;
            return { id: result.id, warnings: validation.warnings || [] };
        } catch (error) {
            console.error("[plannerService.sb] Error creating plan item:", error);
            throw error;
        }
    },

    /**
     * Update an existing time block (e.g. after drag/resize).
     */
    async updatePlanItem(itemId, updates) {
        // Validate scheduling fields if present
        if (updates.startDateTime || updates.endDateTime || updates.plannedHours !== undefined) {
            const start = updates.startDateTime ? new Date(updates.startDateTime) : null;
            const end = updates.endDateTime ? new Date(updates.endDateTime) : null;
            if (start && isNaN(start.getTime())) throw new Error('startDateTime no es una fecha válida.');
            if (end && isNaN(end.getTime())) throw new Error('endDateTime no es una fecha válida.');
            if (start && end && end <= start) throw new Error('endDateTime debe ser posterior a startDateTime.');
            if (updates.plannedHours !== undefined && (typeof updates.plannedHours !== 'number' || updates.plannedHours <= 0)) {
                throw new Error('plannedHours debe ser mayor a 0.');
            }
        }

        try {
            const mapped = {};
            if (updates.startDateTime !== undefined) mapped.start_date_time = updates.startDateTime;
            if (updates.endDateTime !== undefined) mapped.end_date_time = updates.endDateTime;
            if (updates.plannedHours !== undefined) mapped.planned_hours = updates.plannedHours;
            if (updates.dayOfWeek !== undefined) mapped.day_of_week = updates.dayOfWeek;
            if (updates.notes !== undefined) mapped.notes = updates.notes;
            if (updates.status !== undefined) mapped.status = updates.status;
            if (updates.taskId !== undefined) mapped.task_id = updates.taskId;
            if (updates.assignedTo !== undefined) mapped.assigned_to = updates.assignedTo;
            if (updates.taskTitle !== undefined) mapped.task_title = updates.taskTitle;
            if (updates.projectName !== undefined) mapped.project_name = updates.projectName;

            const { error } = await supabase
                .from('weekly_plan_items')
                .update(mapped)
                .eq('id', itemId);

            if (error) throw error;
        } catch (error) {
            console.error("[plannerService.sb] Error updating plan item:", error);
            throw error;
        }
    },

    /**
     * Delete a planned time block.
     */
    async deletePlanItem(itemId) {
        try {
            const { error } = await supabase
                .from('weekly_plan_items')
                .delete()
                .eq('id', itemId);

            if (error) throw error;
        } catch (error) {
            console.error("[plannerService.sb] Error deleting plan item:", error);
            throw error;
        }
    },

    /**
     * Get all planner blocks that overlap with a specific week.
     */
    async getWeeklyPlanItems(startYYYYMMDD) {
        try {
            const { data, error } = await supabase
                .from('weekly_plan_items')
                .select('*')
                .eq('week_start_date', startYYYYMMDD);

            if (error) throw error;

            return (data || []).map(mapRow);
        } catch (error) {
            console.error("[plannerService.sb] Error fetching weekly plan items:", error);
            throw error;
        }
    },

    /**
     * Get all plan items assigned to a specific user.
     */
    async getPlanItemsByUser(userId) {
        try {
            const { data, error } = await supabase
                .from('weekly_plan_items')
                .select('*')
                .eq('assigned_to', userId);

            if (error) throw error;

            return (data || []).map(mapRow);
        } catch (error) {
            console.error("[plannerService.sb] Error fetching user plan items:", error);
            throw error;
        }
    }
};

// ── Mapper: snake_case → camelCase ──
function mapRow(row) {
    return {
        id: row.id,
        taskId: row.task_id,
        assignedTo: row.assigned_to,
        weekStartDate: row.week_start_date,
        dayOfWeek: row.day_of_week,
        startDateTime: row.start_date_time,
        endDateTime: row.end_date_time,
        plannedHours: row.planned_hours,
        notes: row.notes,
        status: row.status,
        projectId: row.project_id,
        taskTitle: row.task_title,
        projectName: row.project_name,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
