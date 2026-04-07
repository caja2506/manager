/**
 * Team Utilization
 * ================
 * 
 * Calculates detailed team capacity and utilization metrics.
 */

// ============================================================
// UTILIZATION LEVELS
// ============================================================

export const UTILIZATION_LEVEL = {
    IDLE: 'idle',           // 0%
    UNDERLOADED: 'underloaded', // <40%
    LIGHT: 'light',         // 40-60%
    OPTIMAL: 'optimal',     // 60-85%
    HEAVY: 'heavy',         // 85-100%
    OVERLOADED: 'overloaded', // >100%
};

const UTILIZATION_CONFIG = {
    [UTILIZATION_LEVEL.IDLE]: { label: 'Inactivo', color: 'slate', min: 0, max: 0 },
    [UTILIZATION_LEVEL.UNDERLOADED]: { label: 'Baja carga', color: 'blue', min: 1, max: 40 },
    [UTILIZATION_LEVEL.LIGHT]: { label: 'Carga ligera', color: 'emerald', min: 40, max: 60 },
    [UTILIZATION_LEVEL.OPTIMAL]: { label: 'Óptimo', color: 'green', min: 60, max: 85 },
    [UTILIZATION_LEVEL.HEAVY]: { label: 'Alta carga', color: 'amber', min: 85, max: 100 },
    [UTILIZATION_LEVEL.OVERLOADED]: { label: 'Sobrecarga', color: 'rose', min: 100, max: Infinity },
};

// ============================================================
// CALCULATORS
// ============================================================

/**
 * Calculate utilization for a single team member.
 */
export function calculateMemberUtilization(userId, tasks, timeLogs, profile = {}) {
    const capacity = Number(profile.weeklyCapacityHours) || 40;
    const userTasks = tasks.filter(t => t.assignedTo === userId);
    const activeTasks = userTasks.filter(t => !['completed', 'cancelled'].includes(t.status));
    const inProgressTasks = activeTasks.filter(t => t.status === 'in_progress');

    // Hours from time logs in last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const userLogs = timeLogs.filter(l =>
        l.userId === userId && new Date(l.startTime || l.date) >= sevenDaysAgo
    );
    const weeklyHours = userLogs.reduce((sum, l) => sum + Number(l.totalHours || l.hours || 0), 0);
    const weeklyOvertime = userLogs.reduce((sum, l) => sum + Number(l.overtimeHours || 0), 0);

    // Planned hours from active task estimates
    const plannedHours = activeTasks.reduce((sum, t) => sum + Number(t.estimatedHours || 0), 0);

    // Utilization %
    const utilizationPercent = capacity > 0 ? (weeklyHours / capacity) * 100 : 0;

    // Level
    const level = getUtilizationLevel(utilizationPercent);

    return {
        userId,
        displayName: profile.displayName || profile.email || userId,
        teamRole: profile.teamRole || 'engineer',
        capacity,
        weeklyHours: parseFloat(weeklyHours.toFixed(1)),
        weeklyOvertime: parseFloat(weeklyOvertime.toFixed(1)),
        plannedHours: parseFloat(plannedHours.toFixed(1)),
        utilizationPercent: parseFloat(utilizationPercent.toFixed(1)),
        level,
        levelConfig: UTILIZATION_CONFIG[level],
        activeTasks: activeTasks.length,
        inProgressTasks: inProgressTasks.length,
        blockedTasks: activeTasks.filter(t => t.status === 'blocked').length,
        completedTotal: userTasks.filter(t => t.status === 'completed').length,
    };
}

/**
 * Calculate utilization for the entire team.
 */
export function calculateTeamUtilization(teamMembers, tasks, timeLogs) {
    const members = teamMembers.map(m => {
        const userId = m.uid || m.id;
        return calculateMemberUtilization(userId, tasks, timeLogs, m);
    });

    // Sort by utilization descending
    members.sort((a, b) => b.utilizationPercent - a.utilizationPercent);

    // Team aggregates
    const totalCapacity = members.reduce((s, m) => s + m.capacity, 0);
    const totalHours = members.reduce((s, m) => s + m.weeklyHours, 0);
    const totalOvertime = members.reduce((s, m) => s + m.weeklyOvertime, 0);
    const avgUtilization = members.length > 0
        ? members.reduce((s, m) => s + m.utilizationPercent, 0) / members.length
        : 0;

    const byLevel = {};
    for (const level of Object.values(UTILIZATION_LEVEL)) {
        byLevel[level] = members.filter(m => m.level === level).length;
    }

    return {
        members,
        teamSize: members.length,
        totalCapacity: parseFloat(totalCapacity.toFixed(1)),
        totalHoursLogged: parseFloat(totalHours.toFixed(1)),
        totalOvertime: parseFloat(totalOvertime.toFixed(1)),
        avgUtilization: parseFloat(avgUtilization.toFixed(1)),
        teamLevel: getUtilizationLevel(avgUtilization),
        byLevel,
    };
}

// ============================================================
// HELPERS
// ============================================================

function getUtilizationLevel(percent) {
    if (percent === 0) return UTILIZATION_LEVEL.IDLE;
    if (percent < 40) return UTILIZATION_LEVEL.UNDERLOADED;
    if (percent < 60) return UTILIZATION_LEVEL.LIGHT;
    if (percent < 85) return UTILIZATION_LEVEL.OPTIMAL;
    if (percent <= 100) return UTILIZATION_LEVEL.HEAVY;
    return UTILIZATION_LEVEL.OVERLOADED;
}

export { UTILIZATION_CONFIG, getUtilizationLevel };
