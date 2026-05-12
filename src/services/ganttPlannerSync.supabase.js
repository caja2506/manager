/**
 * ganttPlannerSync.supabase.js
 * =============================
 * Supabase implementation: Bidirectional sync between Gantt and Weekly Planner.
 */

import { supabase } from '../supabase';
import { updateTaskGanttFields } from './ganttService';

// ── Helpers ──

function getMondayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function toDateStr(d) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

function getWeekdaysInRange(startStr, endStr) {
    const days = [];
    const start = new Date(startStr + 'T12:00:00');
    const end = new Date(endStr + 'T12:00:00');
    const current = new Date(start);
    while (current <= end) {
        const dow = current.getDay();
        if (dow >= 1 && dow <= 5) days.push(toDateStr(current));
        current.setDate(current.getDate() + 1);
    }
    return days;
}

/**
 * Sync Gantt → Weekly Planner
 */
export async function syncGanttToPlanner({ taskId, startDate, endDate, task, userId }) {
    if (!startDate || !endDate || !taskId) return;

    const weekdays = getWeekdaysInRange(startDate, endDate);
    if (weekdays.length === 0) return;

    const hoursPerDay = 8;

    // Get existing plan items for this task
    const { data: existingItems, error } = await supabase
        .from('weekly_plan_items')
        .select('id, date')
        .eq('task_id', taskId);

    if (error) { console.error('[ganttPlannerSync] Error fetching items:', error.message); return; }

    const weekdaySet = new Set(weekdays);
    const existingDates = new Set();
    let created = 0;
    let deleted = 0;

    // Delete blocks outside the new Gantt range
    for (const item of (existingItems || [])) {
        if (item.date && !weekdaySet.has(item.date)) {
            const { error: delErr } = await supabase
                .from('weekly_plan_items')
                .delete()
                .eq('id', item.id);
            if (!delErr) deleted++;
        } else {
            existingDates.add(item.date);
        }
    }

    // Create blocks for days that don't already have this task
    const newItems = [];
    for (const dateStr of weekdays) {
        if (existingDates.has(dateStr)) continue;

        const weekMonday = getMondayOfWeek(new Date(dateStr + 'T12:00:00'));
        const weekStartStr = toDateStr(weekMonday);
        const dayDate = new Date(dateStr + 'T12:00:00');

        newItems.push({
            task_id: taskId,
            week_start_date: weekStartStr,
            date: dateStr,
            day_of_week: dayDate.getDay(),
            start_date_time: new Date(dateStr + 'T09:00:00').toISOString(),
            end_date_time: new Date(dateStr + 'T17:00:00').toISOString(),
            planned_hours: hoursPerDay,
            created_by: userId || null,
            assigned_to: task?.assignedTo || userId || null,
            project_id: task?.projectId || null,
            notes: '',
            task_title_snapshot: task?.title || '',
            project_name_snapshot: '',
            assigned_to_name: '',
            status_snapshot: task?.status || 'pending',
            priority: task?.priority || 'medium',
            color_key: 'indigo',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
    }

    if (newItems.length > 0) {
        const { error: insertErr } = await supabase
            .from('weekly_plan_items')
            .insert(newItems);
        if (insertErr) {
            console.error('[ganttPlannerSync] Error inserting items:', insertErr.message);
        } else {
            created = newItems.length;
        }
    }

    if (created > 0 || deleted > 0) {
        console.log(`[ganttPlannerSync] Task "${task?.title}": +${created} bloques, -${deleted} bloques`);
    }
}

/**
 * Sync Weekly Planner → Gantt
 */
export async function syncPlannerToGantt(taskId) {
    if (!taskId) return;

    const { data: items, error } = await supabase
        .from('weekly_plan_items')
        .select('date')
        .eq('task_id', taskId);

    if (error) { console.error('[ganttPlannerSync] syncPlannerToGantt error:', error.message); return; }

    if (!items || items.length === 0) {
        await updateTaskGanttFields(taskId, { plannedStartDate: null, plannedEndDate: null });
        return;
    }

    const dates = items.map(i => i.date).filter(Boolean).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    if (minDate && maxDate) {
        await updateTaskGanttFields(taskId, { plannedStartDate: minDate, plannedEndDate: maxDate });
    }
}
