/**
 * useAnalyticsData Hook
 * =====================
 * 
 * React hook for analytics engine.
 * Provides snapshot generation, trend calculation, and team utilization.
 */

import { useState, useCallback, useMemo } from 'react';
import { useEngineeringData } from './useEngineeringData';
import { useAuditData } from './useAuditData';
import { buildDepartmentSnapshot, buildProjectSnapshot, buildUserSnapshot } from '../core/analytics/snapshotBuilder';
import { calculateTeamUtilization } from '../core/analytics/teamUtilization';

export function useAnalyticsData() {
    const {
        engTasks,
        engProjects,
        timeLogs,
        delays,
        teamMembers,
    } = useEngineeringData();

    const { scores: auditScores } = useAuditData();

    const [snapshot, setSnapshot] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);

    /**
     * Generate a department-level snapshot from current data.
     */
    const generateSnapshot = useCallback(() => {
        setIsGenerating(true);
        try {
            const snap = buildDepartmentSnapshot({
                tasks: engTasks,
                projects: engProjects,
                timeLogs,
                delays,
                teamMembers,
                auditScores,
            });
            setSnapshot(snap);
            return snap;
        } finally {
            setIsGenerating(false);
        }
    }, [engTasks, engProjects, timeLogs, delays, teamMembers, auditScores]);

    /**
     * Generate project-level snapshot.
     */
    const generateProjectSnapshot = useCallback((project) => {
        return buildProjectSnapshot(project, engTasks, timeLogs, delays);
    }, [engTasks, timeLogs, delays]);

    /**
     * Generate user-level snapshot.
     */
    const generateUserSnapshot = useCallback((userId) => {
        return buildUserSnapshot(userId, engTasks, timeLogs, teamMembers);
    }, [engTasks, timeLogs, teamMembers]);

    /**
     * Derived: team utilization metrics.
     */
    const teamUtilization = useMemo(() => {
        return calculateTeamUtilization(teamMembers, engTasks, timeLogs);
    }, [teamMembers, engTasks, timeLogs]);

    /**
     * Derived: quick KPIs from current data.
     */
    const liveKPIs = useMemo(() => {
        const activeTasks = engTasks.filter(t => !['completed', 'cancelled'].includes(t.status));
        const blockedTasks = activeTasks.filter(t => t.status === 'blocked');
        const activeProjects = engProjects.filter(p => !['completed', 'cancelled', 'on_hold'].includes(p.status));
        const activeDelays = delays.filter(d => !d.resolved);

        // Week velocity
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const completedThisWeek = engTasks.filter(t =>
            t.status === 'completed' &&
            new Date(t.completedDate || t.updatedAt) >= sevenDaysAgo
        ).length;

        // Overdue
        const overdueTasks = activeTasks.filter(t =>
            t.dueDate && new Date(t.dueDate) < now
        ).length;

        return {
            activeTasks: activeTasks.length,
            blockedTasks: blockedTasks.length,
            activeProjects: activeProjects.length,
            activeDelays: activeDelays.length,
            overdueTasks,
            completedThisWeek,
            teamSize: teamMembers.length,
            avgUtilization: teamUtilization.avgUtilization,
        };
    }, [engTasks, engProjects, delays, teamMembers, teamUtilization]);

    return {
        // Actions
        generateSnapshot,
        generateProjectSnapshot,
        generateUserSnapshot,

        // State
        snapshot,
        isGenerating,

        // Derived
        teamUtilization,
        liveKPIs,
    };
}
