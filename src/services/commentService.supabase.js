/**
 * Comment Service — Supabase Version
 * ====================================
 * CRUD for task comments.
 * Replaces Firestore sub-collection tasks/{id}/comments with flat table `task_comments`.
 */

import { supabase } from '../supabase';

/**
 * Subscribe to comments for a task (real-time).
 */
export function subscribeToComments(taskId, onData) {
    if (!taskId) return () => {};

    // Initial fetch (gracefully handle missing table)
    fetchComments(taskId).then(onData).catch(() => onData([]));

    // Realtime — wrapped in try/catch to avoid crashing on missing table or channel issues
    let channel;
    try {
        channel = supabase
            .channel(`comments-${taskId}-${Date.now()}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` },
                () => { fetchComments(taskId).then(onData).catch(() => {}); }
            )
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.warn('[commentService] Realtime channel error for task:', taskId);
                }
            });
    } catch (err) {
        console.warn('[commentService] Failed to subscribe to comments:', err.message);
    }

    return () => { if (channel) supabase.removeChannel(channel); };
}

/**
 * Add a comment to a task.
 */
export async function addComment(taskId, text, userId, userName) {
    if (!taskId || !text?.trim()) return null;
    const { data, error } = await supabase
        .from('task_comments')
        .insert({
            task_id: taskId,
            text: text.trim(),
            user_id: userId,
            user_name: userName || null,
        })
        .select('id')
        .single();
    if (error) throw new Error(`[commentService.sb] addComment: ${error.message}`);
    return data.id;
}

/**
 * Update comment text.
 */
export async function updateComment(taskId, commentId, newText) {
    const { error } = await supabase
        .from('task_comments')
        .update({ text: newText.trim(), edited: true, updated_at: new Date().toISOString() })
        .eq('id', commentId);
    if (error) throw new Error(`[commentService.sb] updateComment: ${error.message}`);
}

/**
 * Delete a comment.
 */
export async function deleteComment(taskId, commentId) {
    const { error } = await supabase
        .from('task_comments').delete().eq('id', commentId);
    if (error) throw new Error(`[commentService.sb] deleteComment: ${error.message}`);
}

/**
 * Fetch all comments for a task (one-time).
 */
export async function fetchComments(taskId) {
    if (!taskId) return [];
    const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
    if (error) { console.warn('[commentService.sb] fetchComments:', error.message); return []; }
    // Map snake_case → camelCase for component compatibility
    return (data || []).map(c => ({
        id: c.id,
        taskId: c.task_id,
        text: c.text,
        userId: c.user_id,
        userName: c.user_name,
        edited: c.edited,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
    }));
}

/**
 * Fetch all comments from yesterday across all tasks.
 */
export async function fetchYesterdayComments(yesterdayStr) {
    const start = `${yesterdayStr}T00:00:00`;
    const end = `${yesterdayStr}T23:59:59`;
    const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end);
    if (error) { console.warn('[commentService.sb] fetchYesterdayComments:', error.message); return []; }
    return (data || []).map(d => ({ ...d, taskId: d.task_id }));
}
