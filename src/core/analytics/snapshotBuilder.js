/**
 * Snapshot Builder
 * ================
 * 
 * Builds analytics snapshots from the current state of the system.
 * Snapshots capture point-in-time metrics for historical trend analysis.
 */

import { createAnalyticsSnapshotDocument, ANALYTICS_SCOPE } from '../../models/schemas';

// ============================================================
// SNAPSHOT METRICS
// ============================================================

/**
 * Build a complete department-level analytics snapshot.
 * 
 * @param {Object} data - System data
 * @param {Array} data.tasks - All tasks
 * @param {Array} data.projects - All projects
 * @param {Array} data.timeLogs - All time logs
 * @param {Array} data.delays - All delays
 * @param {Array} data.teamMembers - All team members
 * @param {Object} [data.auditScores] - Compliance scores from audit engine
 * @returns {Object} Snapshot document
 */
export function buildDepartmentSnapshot(data) {
    const { tasks = [], projects = [], timeLogs = [], delays = [], teamMembers = [], auditScores = null } = data;

    const now = new Date();
    const activeTasks = tasks.filter(t => !['completed', 'cancelled'].includes(t.status));
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const blockedTasks = tasks.filter(t => t.status === 'blocked');
    const activeProjects = projects.filter(p => !['completed', 'cancelled', 'on_hold'].includes(p.status));
    const activeDelays = delays.filter(d => !d.resolved);

    // Task velocity: completed tasks in last 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentlyCompleted = completedTasks.filter(t => {
        const completedDate = t.completedDate || t.updatedAt;
        return completedDate && new Date(completedDate) >= sevenDaysAgo;
    });

    // Hours logged in last 7 days
    const recentLogs = timeLogs.filter(l => {
        const logDate = l.startTime || l.date;
        return logDate && new Date(logDate) >= sevenDaysAgo;
    });
    const recentHours = recentLogs.reduce((sum, l) => sum + (l.totalHours || l.hours || 0), 0);
    const recentOvertime = recentLogs.reduce((sum, l) => sum + (l.overtimeHours || 0), 0);

    // Estimation accuracy for completed tasks
    const tasksWithEstimates = completedTasks.filter(t => t.estimatedHours > 0 && t.actualHours > 0);
    const avgEstimationRatio = tasksWithEstimates.length > 0
        ? tasksWithEstimates.reduce((sum, t) => sum + (t.actualHours / t.estimatedHours), 0) / tasksWithEstimates.length
        : null;

    // On-time delivery rate
    const tasksWithDueDate = completedTasks.filter(t => t.dueDate);
    const onTimeTasks = tasksWithDueDate.filter(t => {
        const completed = new Date(t.completedDate || t.updatedAt);
        return completed <= new Date(t.dueDate);
    });
    const onTimeRate = tasksWithDueDate.length > 0 ? onTimeTasks.length / tasksWithDueDate.length : null;

    const metrics = {
        // Task metrics
        totalTasks: tasks.length,
        activeTasks: activeTasks.length,
        completedTasks: completedTasks.length,
        blockedTasks: blockedTasks.length,
        tasksByStatus: countByField(tasks, 'status'),
        tasksByPriority: countByField(activeTasks, 'priority'),
        weeklyVelocity: recentlyCompleted.length,

        // Project metrics
        totalProjects: projects.length,
        activeProjects: activeProjects.length,
        projectsByStatus: countByField(projects, 'status'),
        projectsByRisk: countByField(activeProjects, 'riskLevel'),

        // Time metrics
        weeklyHoursLogged: parseFloat(recentHours.toFixed(1)),
        weeklyOvertime: parseFloat(recentOvertime.toFixed(1)),
        avgEstimationRatio: avgEstimationRatio ? parseFloat(avgEstimationRatio.toFixed(2)) : null,
        onTimeDeliveryRate: onTimeRate ? parseFloat((onTimeRate * 100).toFixed(1)) : null,

        // Delay metrics
        activeDelays: activeDelays.length,
        totalDelays: delays.length,
        delaysByType: countByField(activeDelays, 'causeName'),

        // Team metrics
        totalTeamMembers: teamMembers.length,
        teamUtilization: calculateTeamUtilization(teamMembers, activeTasks),

        // Compliance scores (from audit engine)
        complianceScores: auditScores || null,
    };

    return createAnalyticsSnapshotDocument({
        scope: ANALYTICS_SCOPE.DEPARTMENT,
        entityId: 'department',
        snapshotDate: now.toISOString().split('T')[0],
        metrics,
        metadata: {
            generatedBy: 'client',
            version: '1.0',
        },
    });
}

/**
 * Build a project-level analytics snapshot.
 */
export function buildProjectSnapshot(project, tasks, timeLogs, delays) {
    const projectTasks = tasks.filter(t => t.projectId === project.id);
    const projectLogs = timeLogs.filter(l => l.projectId === project.id);
    const projectDelays = delays.filter(d => d.projectId === project.id);

    const activeTasks = projectTasks.filter(t => !['completed', 'cancelled'].includes(t.status));
    const completedTasks = projectTasks.filter(t => t.status === 'completed');

    const totalEstimated = projectTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const totalActual = projectTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);
    const totalLogged = projectLogs.reduce((sum, l) => sum + (l.totalHours || l.hours || 0), 0);

    const progress = projectTasks.length > 0
        ? Math.round((completedTasks.length / projectTasks.length) * 100)
        : 0;

    return createAnalyticsSnapshotDocument({
        scope: ANALYTICS_SCOPE.PROJECT,
        entityId: project.id,
        snapshotDate: new Date().toISOString().split('T')[0],
        metrics: {
            totalTasks: projectTasks.length,
            activeTasks: activeTasks.length,
            completedTasks: completedTasks.length,
            blockedTasks: projectTasks.filter(t => t.status === 'blocked').length,
            progress,
            totalEstimatedHours: totalEstimated,
            totalActualHours: totalActual,
            totalLoggedHours: parseFloat(totalLogged.toFixed(1)),
            activeDelays: projectDelays.filter(d => !d.resolved).length,
            riskLevel: project.riskLevel || 'low',
        },
    });
}

/**
 * Build a user-level analytics snapshot.
 */
export function buildUserSnapshot(userId, tasks, timeLogs, teamMembers) {
    const userTasks = tasks.filter(t => t.assignedTo === userId);
    const userLogs = timeLogs.filter(l => l.userId === userId);
    const profile = teamMembers.find(m => (m.uid || m.id) === userId);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentLogs = userLogs.filter(l => new Date(l.startTime || l.date) >= sevenDaysAgo);
    const weeklyHours = recentLogs.reduce((sum, l) => sum + (l.totalHours || l.hours || 0), 0);

    const activeTasks = userTasks.filter(t => !['completed', 'cancelled'].includes(t.status));
    const completedRecent = userTasks.filter(t =>
        t.status === 'completed' && new Date(t.completedDate || t.updatedAt) >= sevenDaysAgo
    );

    return createAnalyticsSnapshotDocument({
        scope: ANALYTICS_SCOPE.USER,
        entityId: userId,
        snapshotDate: now.toISOString().split('T')[0],
        metrics: {
            activeTasks: activeTasks.length,
            completedThisWeek: completedRecent.length,
            weeklyHoursLogged: parseFloat(weeklyHours.toFixed(1)),
            blockedTasks: activeTasks.filter(t => t.status === 'blocked').length,
            capacity: profile?.weeklyCapacityHours || 40,
            utilization: profile?.weeklyCapacityHours
                ? parseFloat(((weeklyHours / profile.weeklyCapacityHours) * 100).toFixed(1))
                : null,
            displayName: profile?.displayName || profile?.email || userId,
        },
    });
}

// ============================================================
// HELPERS
// ============================================================

function countByField(items, field) {
    return items.reduce((acc, item) => {
        const value = item[field] || 'unknown';
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {});
}

function calculateTeamUtilization(teamMembers, activeTasks) {
    if (!teamMembers.length) return null;

    const memberMetrics = teamMembers.map(m => {
        const userId = m.uid || m.id;
        const assigned = activeTasks.filter(t => t.assignedTo === userId).length;
        const capacity = m.weeklyCapacityHours || 40;
        return { userId, assigned, capacity };
    });

    const totalAssigned = memberMetrics.reduce((s, m) => s + m.assigned, 0);
    const avgAssigned = totalAssigned / teamMembers.length;
    const maxAssigned = Math.max(...memberMetrics.map(m => m.assigned), 0);
    const underloaded = memberMetrics.filter(m => m.assigned < 2).length;
    const overloaded = memberMetrics.filter(m => m.assigned > 8).length;

    return {
        avgTasksPerMember: parseFloat(avgAssigned.toFixed(1)),
        maxTasksPerMember: maxAssigned,
        underloadedMembers: underloaded,
        overloadedMembers: overloaded,
    };
}
