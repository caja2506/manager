/**
 * Team Filters — Centralized member filtering utilities
 * =====================================================
 * 
 * Provides a single source of truth for filtering team members
 * based on operational role rules.
 * 
 * RULE: Managers are excluded from operational metrics UNLESS
 * they have active tasks assigned or recent timeLogs (last 7 days).
 * This prevents managers from inflating teamSize, utilization,
 * and workload metrics when they are not doing technical work.
 */

/**
 * Get team members who should be included in operational metrics.
 * Filters out managers who have no active tasks and no recent time logs.
 * 
 * @param {Array} teamMembers - All team member profiles
 * @param {Array} [tasks=[]] - All engineering tasks
 * @param {Array} [timeLogs=[]] - All time logs
 * @returns {Array} Filtered team members for operational metrics
 */
export function getActiveTeamMembers(teamMembers, tasks = [], timeLogs = []) {
    return teamMembers.filter(member => {
        // Non-managers always included
        if (member.teamRole !== 'manager') return true;

        // Manager: only include if they have technical activity
        const uid = member.uid || member.id;

        // Check 1: Has at least one active task assigned
        const hasActiveTasks = tasks.some(t =>
            t.assignedTo === uid && !['completed', 'cancelled'].includes(t.status)
        );
        if (hasActiveTasks) return true;

        // Check 2: Has time logs from the last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const hasRecentTimeLogs = timeLogs.some(l =>
            l.userId === uid && l.startTime && new Date(l.startTime) >= sevenDaysAgo
        );
        return hasRecentTimeLogs;
    });
}
