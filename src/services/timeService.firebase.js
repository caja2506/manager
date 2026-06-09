/**
 * timeService — Firebase / Pure Functions
 * ========================================
 * Contains pure utility functions (no DB dependency) that are
 * re-exported by the Supabase implementation.
 */

/**
 * Get the active timer from a list of time logs.
 * An "active" timer = a log with no endTime.
 */
export function getActiveTimerFromLogs(timeLogs, userId) {
    if (!timeLogs || !userId) return null;
    return timeLogs.find(log => log.userId === userId && !log.endTime) || null;
}

/**
 * Get all active timers for a specific user.
 */
export function getAllActiveTimersForUser(timeLogs, userId) {
    if (!timeLogs || !userId) return [];
    return timeLogs.filter(log => log.userId === userId && !log.endTime);
}

/**
 * Get the active timer for a specific task.
 */
export function getActiveTimerForTask(timeLogs, taskId) {
    if (!timeLogs || !taskId) return null;
    return timeLogs.find(log => log.taskId === taskId && !log.endTime) || null;
}

/**
 * Check if user can manage other users' timers.
 */
export function canManageOthersTimers(role, teamRole) {
    if (role === 'admin') return true;
    if (teamRole === 'manager' || teamRole === 'team_lead') return true;
    return false;
}

/**
 * Check if userId is a supervisor of targetUserId.
 */
export function isSupervisorOf(userId, targetUserId, teamMembers, resourceAssignments) {
    if (!userId || !targetUserId || userId === targetUserId) return false;
    // Check if target reports to this user
    const target = (teamMembers || []).find(m => (m.uid || m.id) === targetUserId);
    if (target && target.reportsTo === userId) return true;
    // Check resource assignments
    if (resourceAssignments) {
        const assignment = resourceAssignments.find(
            a => a.engineerId === targetUserId && a.supervisorId === userId
        );
        if (assignment) return true;
    }
    return false;
}

/**
 * Clear legacy timer data (no-op for Supabase).
 */
export function clearLegacyTimer() {
    // No-op — legacy timers only exist in Firestore
}

/**
 * Format a duration in hours to a human-readable string.
 */
export function formatDuration(hours) {
    if (!hours || hours <= 0) return '0m';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

/**
 * Format elapsed time from a start time to now.
 */
export function formatElapsed(startTime) {
    if (!startTime) return '0:00';
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now - start;
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}`;
}
