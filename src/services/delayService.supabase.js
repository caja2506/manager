/**
 * Delay Service — Supabase Implementation
 * =========================================
 * Drop-in replacement for delayService.js (Firestore version).
 * Uses Supabase PostgreSQL instead of Firestore.
 *
 * @module services/delayService.supabase
 */

import { supabase } from '../supabase';
import { updateTaskStatus, updateTask } from './taskService';
import { calculateProjectRisk } from './riskService';
import { logActivity, ACTIVITY_TYPES } from './activityLogService';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ============================================================
// DELAY CAUSES (Configurable by admin)
// ============================================================

export async function createDelayCause(data) {
    const { data: result, error } = await supabase
        .from('delay_causes')
        .insert({
            name: data.name || '',
            description: data.description || '',
            active: data.active !== false,
            sort_order: data.order || 0,
            created_by: data.createdBy || null,
            updated_by: data.updatedBy || null,
        })
        .select('id')
        .single();

    if (error) throw new Error(`[delayService.sb] createDelayCause: ${error.message}`);
    return result.id;
}

export async function updateDelayCause(causeId, updates) {
    const mapped = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.description !== undefined) mapped.description = updates.description;
    if (updates.active !== undefined) mapped.active = updates.active;
    if (updates.order !== undefined) mapped.sort_order = updates.order;

    const { error } = await supabase
        .from('delay_causes')
        .update(mapped)
        .eq('id', causeId);

    if (error) throw new Error(`[delayService.sb] updateDelayCause: ${error.message}`);
}

export async function deleteDelayCause(causeId) {
    const { error } = await supabase
        .from('delay_causes')
        .delete()
        .eq('id', causeId);

    if (error) throw new Error(`[delayService.sb] deleteDelayCause: ${error.message}`);
}

// ============================================================
// DELAYS
// ============================================================

export async function createDelay(data, userId) {
    const { data: result, error } = await supabase
        .from('delays')
        .insert({
            project_id: data.projectId || null,
            task_id: data.taskId || null,
            cause_id: data.causeId || null,
            cause_name: data.causeName || '',
            comment: data.comment || '',
            impact: data.impact || '',
            resolved: false,
            created_by: userId,
        })
        .select('id')
        .single();

    if (error) throw new Error(`[delayService.sb] createDelay: ${error.message}`);

    // Auto-block task via workflow transition
    if (data.taskId) {
        const blockFields = {
            blockedReason: data.causeName || 'Retraso reportado',
        };
        if (data.blockedByUserId) blockFields.blockedByUserId = data.blockedByUserId;
        if (data.blockedByName) blockFields.blockedByName = data.blockedByName;
        await updateTask(data.taskId, blockFields);

        try {
            await updateTaskStatus(data.taskId, 'blocked', data.projectId, true, {
                blockedReason: blockFields.blockedReason,
                blockedByUserId: data.blockedByUserId || null,
                blockedByName: data.blockedByName || null,
            });
            await logActivity(data.taskId, {
                type: ACTIVITY_TYPES.STATUS_CHANGED,
                description: `Estado: ${data.previousStatus || 'in_progress'} → blocked`,
                userId,
                userName: data.blockedByName || null,
                meta: { from: data.previousStatus || 'in_progress', to: 'blocked' },
            });
        } catch (err) {
            console.warn('[delayService.sb] Auto-block transition failed:', err.message);
        }
    }

    // Trigger Telegram notification via Cloud Function Callable
    try {
        const functions = getFunctions();
        const notifyFn = httpsCallable(functions, 'notifyTelegramDelayCreated');
        await notifyFn({
            projectId: data.projectId || null,
            taskId: data.taskId || null,
            causeName: data.causeName || 'Retraso reportado',
            comment: data.comment || '',
            createdBy: userId,
        });
    } catch (notifyErr) {
        console.warn('[delayService.sb] Telegram notification trigger failed:', notifyErr.message);
    }

    return result.id;
}

export async function resolveDelay(delayId, projectId, taskId) {
    const { error } = await supabase
        .from('delays')
        .update({
            resolved: true,
            resolved_at: new Date().toISOString(),
        })
        .eq('id', delayId);

    if (error) throw new Error(`[delayService.sb] resolveDelay: ${error.message}`);

    if (taskId) {
        try {
            await updateTask(taskId, { blockedReason: '' });
            await updateTaskStatus(taskId, 'in_progress', projectId, true);
        } catch (err) {
            console.warn('[delayService.sb] Auto-unblock transition failed:', err.message);
        }
    }

    if (projectId) {
        await calculateProjectRisk(projectId);
    }
}

export async function updateDelay(delayId, updates) {
    const mapped = {};
    if (updates.comment !== undefined) mapped.comment = updates.comment;
    if (updates.impact !== undefined) mapped.impact = updates.impact;
    if (updates.causeName !== undefined) mapped.cause_name = updates.causeName;
    if (updates.causeId !== undefined) mapped.cause_id = updates.causeId;
    if (updates.resolved !== undefined) mapped.resolved = updates.resolved;

    const { error } = await supabase
        .from('delays')
        .update(mapped)
        .eq('id', delayId);

    if (error) throw new Error(`[delayService.sb] updateDelay: ${error.message}`);
}

export async function deleteDelay(delayId) {
    const { error } = await supabase
        .from('delays')
        .delete()
        .eq('id', delayId);

    if (error) throw new Error(`[delayService.sb] deleteDelay: ${error.message}`);
}
