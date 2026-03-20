/**
 * useAuditData Hook
 * =================
 * 
 * React hook that provides access to the audit engine.
 * Runs client-side evaluation against data from AppDataContext.
 * 
 * REAL CONTEXT: fetches planner data on-demand for accurate scoring.
 * 
 * Usage:
 *   const { auditResult, scores, isAuditing, runClientAudit } = useAuditData();
 */

import { useState, useCallback, useMemo } from 'react';
import { useEngineeringData } from './useEngineeringData';
import { useAuth } from '../contexts/AuthContext';
import { runAudit } from '../core/audit/auditEngine';
import { persistAuditResults } from '../services/auditPersistence';
import { plannerService } from '../services/plannerService';
import { format, startOfWeek } from 'date-fns';

/**
 * Hook to manage audit execution and state.
 * Does NOT auto-run on mount — call `runClientAudit()` to trigger.
 */
export function useAuditData() {
    const {
        engTasks,
        engProjects,
        engSubtasks,
        timeLogs,
        delays,
        teamMembers,
    } = useEngineeringData();

    const { user } = useAuth();

    const [auditResult, setAuditResult] = useState(null);
    const [isAuditing, setIsAuditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastAuditTime, setLastAuditTime] = useState(null);

    /**
     * Run a client-side audit using current AppDataContext data.
     * Fetches planner data on-demand for accurate planning scores.
     * Returns the audit result and caches it in state.
     */
    const runClientAudit = useCallback(async () => {
        setIsAuditing(true);

        try {
            // Fetch current week's planner data for accurate scoring
            const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
            const weekStartStr = format(weekStart, 'yyyy-MM-dd');
            let plannerSlots = [];
            try {
                plannerSlots = await plannerService.getWeeklyPlanItems(weekStartStr);
            } catch (err) {
                console.warn('[useAuditData] Could not fetch planner data:', err.message);
                // Continue with empty — planner rules will skip gracefully
            }

            const result = runAudit({
                engTasks,
                engProjects,
                engSubtasks,
                timeLogs,
                delays,
                teamMembers,
                plannerSlots,
                existingFindings: [],
                dependencies: [],
                auditEvents: [],
            });

            setAuditResult(result);
            setLastAuditTime(new Date().toISOString());
            return result;
        } catch (error) {
            console.error('Audit execution failed:', error);
            return null;
        } finally {
            setIsAuditing(false);
        }
    }, [engTasks, engProjects, engSubtasks, timeLogs, delays, teamMembers]);

    /**
     * Derived: compliance scores from the last audit.
     */
    const scores = useMemo(() => {
        return auditResult?.scores || null;
    }, [auditResult]);

    /**
     * Derived: findings summary from the last audit.
     */
    const summary = useMemo(() => {
        return auditResult?.summary || null;
    }, [auditResult]);

    /**
     * Derived: open findings grouped by severity.
     */
    const findingsBySeverity = useMemo(() => {
        if (!auditResult?.findings) return { critical: [], warning: [], info: [] };

        return {
            critical: auditResult.findings.filter(f => f.severity === 'critical'),
            warning: auditResult.findings.filter(f => f.severity === 'warning'),
            info: auditResult.findings.filter(f => f.severity === 'info'),
        };
    }, [auditResult]);

    /**
     * Derived: findings grouped by entity type.
     */
    const findingsByEntity = useMemo(() => {
        if (!auditResult?.findings) return { task: [], project: [], user: [] };

        return {
            task: auditResult.findings.filter(f => f.entityType === 'task'),
            project: auditResult.findings.filter(f => f.entityType === 'project'),
            user: auditResult.findings.filter(f => f.entityType === 'user'),
        };
    }, [auditResult]);

    /**
     * Save the latest audit results to Firestore.
     */
    const saveToFirestore = useCallback(async () => {
        if (!auditResult) return null;
        setIsSaving(true);
        try {
            const result = await persistAuditResults(auditResult, user?.uid || 'system');
            return result;
        } catch (err) {
            console.error('Failed to persist audit results:', err);
            return null;
        } finally {
            setIsSaving(false);
        }
    }, [auditResult, user]);

    return {
        // Actions
        runClientAudit,
        saveToFirestore,

        // State
        auditResult,
        isAuditing,
        isSaving,
        lastAuditTime,

        // Derived
        scores,
        summary,
        findingsBySeverity,
        findingsByEntity,
    };
}
