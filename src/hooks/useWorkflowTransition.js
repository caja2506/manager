/**
 * useWorkflowTransition Hook
 * ==========================
 *
 * Client-side workflow transition orchestrator.
 *
 * ARCHITECTURE:
 *   - Validates transitions client-side for instant UX feedback
 *   - Calls updateTaskStatus() which routes to the transitionTaskStatus
 *     Cloud Function for server-enforced execution
 *   - Audit events are created server-side (no duplicate writes)
 *
 * WIP ENFORCEMENT (v2):
 *   - Before allowing transition to in_progress, checks if user has
 *     another task already in_progress (WIP limit)
 *   - If so, returns { needsWipBlock: true } so the UI can show WipBlockModal
 *   - After user provides block reason + responsible, calls executeWipSwitch()
 *
 * Flow:
 *   1. requestTransition() → client-side validation (immediate)
 *   2. If warnings/missing fields → show confirmation UI
 *   3. If WIP conflict → show WipBlockModal
 *   4. executeTransition() or confirmTransition() → calls CF via taskService
 *   5. CF validates again server-side → writes status + audit event atomically
 */

import { useState, useCallback, useRef } from 'react';
import { validateTransition } from '../core/workflow/transitionValidator';
import { getRequiredFields, getWorkflowSequence } from '../core/workflow/workflowModel';
import { updateTaskStatus } from '../services/taskService';
import { forceStopTaskTimers } from '../services/timeService';

/**
 * @returns Hook for managing validated workflow transitions.
 */
export function useWorkflowTransition() {
    const [pendingTransition, setPendingTransition] = useState(null);
    const [transitionError, setTransitionError] = useState(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // WIP-specific state
    const [wipConflict, setWipConflict] = useState(null);
    // { currentInProgressTask, newTask, targetStatus, userId }

    // Ref to break circular dependency between requestTransition and executeTransition
    const executeTransitionRef = useRef(null);

    /**
     * Attempt to transition a task to a new status.
     * Performs client-side validation for instant feedback.
     * Returns a result object that indicates if the transition needs confirmation.
     *
     * @param {Object} task - the task to transition
     * @param {string} targetStatus - the desired target status
     * @param {string} userId - the current user
     * @param {Object} [context] - extra context
     * @param {Array} [context.allTasks] - all tasks (for WIP check)
     * @param {number} [context.wipLimit] - WIP limit (default 1)
     */
    const requestTransition = useCallback((task, targetStatus, userId, context = {}) => {
        setTransitionError(null);
        setWipConflict(null);

        // Client-side validation (instant UX — server re-validates)
        const validation = validateTransition(task, targetStatus);

        if (!validation.valid) {
            const errorMsg = validation.errors.map(e => e.message).join('. ') || 'Transición no permitida';
            setTransitionError(errorMsg);
            return {
                allowed: false,
                needsConfirmation: false,
                needsWipBlock: false,
                error: errorMsg,
            };
        }

        // ★ WIP LIMIT CHECK (client-side, fast UX feedback)
        if (targetStatus === 'in_progress' && context.allTasks) {
            const wipLimit = context.wipLimit || 1;
            const assignedTo = task.assignedTo;
            if (assignedTo) {
                const inProgressTasks = context.allTasks.filter(
                    t => t.assignedTo === assignedTo && t.status === 'in_progress' && t.id !== task.id
                );
                if (inProgressTasks.length >= wipLimit) {
                    // WIP conflict — need to show WipBlockModal
                    const conflictData = {
                        currentInProgressTask: inProgressTasks[0], // first one
                        allInProgressTasks: inProgressTasks,
                        newTask: task,
                        targetStatus,
                        userId,
                    };
                    setWipConflict(conflictData);
                    return {
                        allowed: true,
                        needsConfirmation: false,
                        needsWipBlock: true,
                        wipConflict: conflictData,
                    };
                }
            }
        }

        // Check required fields for the target status
        const requiredFields = getRequiredFields(targetStatus);
        const missingFields = [];
        for (const field of requiredFields) {
            if (!field.validate(task)) {
                missingFields.push({
                    name: field.field,
                    label: field.label,
                });
            }
        }

        // Gather warnings from validation
        const warnings = validation.warnings.map(w => w.message);

        // Additional warning: moving backward
        const statusOrder = getWorkflowSequence();
        const currentIdx = statusOrder.indexOf(task.status);
        const targetIdx = statusOrder.indexOf(targetStatus);
        if (targetIdx >= 0 && currentIdx >= 0 && targetIdx < currentIdx) {
            warnings.push(`Se está moviendo la tarea hacia atrás (${task.status} → ${targetStatus}). Esto puede afectar métricas de re-trabajo.`);
        }

        const needsConfirmation = missingFields.length > 0 || warnings.length > 0;

        const transitionData = {
            task,
            targetStatus,
            userId,
            missingFields,
            warnings,
        };

        if (needsConfirmation) {
            setPendingTransition(transitionData);
        }

        return {
            allowed: true,
            needsConfirmation,
            needsWipBlock: false,
            warnings,
            missingFields,
            transitionData,
            execute: needsConfirmation
                ? null
                : () => executeTransitionRef.current?.(transitionData),
        };
    }, []);

    /**
     * Execute a validated transition via Cloud Function.
     * If called after user confirmation (pending), sends force=true
     * to allow the CF to skip required field validation.
     */
    const executeTransition = useCallback(async (transitionData, forceOverride = false, extraData = {}) => {
        const data = transitionData || pendingTransition;
        const { task, targetStatus } = data || {};
        if (!task || !targetStatus) return;

        setIsTransitioning(true);
        setTransitionError(null);

        try {
            // ★ FORCE STOP TIMER — if leaving in_progress, ensure the timer actually stops
            if (task.status === 'in_progress' && targetStatus !== 'in_progress') {
                try {
                    await forceStopTaskTimers(task.id, `kanban → ${targetStatus}`);
                } catch (err) {
                    console.error('[useWorkflowTransition] error stopping timer:', err);
                }
            }

            // force=true when user confirmed despite warnings/missing fields
            const force = forceOverride || (data.missingFields?.length > 0);

            // Calls Cloud Function via taskService.updateTaskStatus()
            // CF handles: validation, status write, audit event, risk recalc
            const result = await updateTaskStatus(task.id, targetStatus, task.projectId, force, extraData);

            setPendingTransition(null);
            return { success: true, ...result };
        } catch (err) {
            // Extract CF error message if available
            const cfMessage = err?.message || err?.details || 'Error desconocido';
            const error = `Error al actualizar: ${cfMessage}`;
            setTransitionError(error);
            return { success: false, error };
        } finally {
            setIsTransitioning(false);
        }
    }, [pendingTransition]);

    // Keep ref in sync
    executeTransitionRef.current = executeTransition;

    /**
     * Execute a WIP switch: block the current task, then start the new one.
     *
     * @param {Object} blockData - { blockedReason, blockedByUserId, blockedByName }
     */
    const executeWipSwitch = useCallback(async () => {
        if (!wipConflict) return;

        const { allInProgressTasks, newTask, targetStatus } = wipConflict;
        setIsTransitioning(true);
        setTransitionError(null);

        try {
            // Step 1: Pause ALL in-progress tasks → pending (NOT blocked)
            for (const inProgressTask of allInProgressTasks) {
                await updateTaskStatus(
                    inProgressTask.id,
                    'pending',
                    inProgressTask.projectId,
                    true, // force
                    {}
                );
            }

            // Step 2: Move new task to in_progress (WIP slot now free)
            const result = await updateTaskStatus(
                newTask.id,
                targetStatus,
                newTask.projectId,
                true // force — skip field checks since we just freed the WIP slot
            );

            setWipConflict(null);
            return { success: true, ...result };
        } catch (err) {
            const cfMessage = err?.message || err?.details || 'Error desconocido';
            const error = `Error en cambio WIP: ${cfMessage}`;
            setTransitionError(error);
            return { success: false, error };
        } finally {
            setIsTransitioning(false);
        }
    }, [wipConflict]);

    /**
     * Cancel a pending transition.
     */
    const cancelTransition = useCallback(() => {
        setPendingTransition(null);
        setTransitionError(null);
        setWipConflict(null);
    }, []);

    /**
     * Confirm and execute a pending transition (force=true).
     */
    const confirmTransition = useCallback(async (reasonData = {}) => {
        if (pendingTransition) {
            const data = pendingTransition;

            // If reason data routes to a different status
            if (reasonData.targetStatus && reasonData.targetStatus !== data.targetStatus) {
                const redirected = { ...data, targetStatus: reasonData.targetStatus };
                return executeTransition(redirected, true, {
                    blockedReason: reasonData.reason || null,
                    blockedByUserId: reasonData.responsibleUserId || null,
                    blockedByName: reasonData.responsibleName || null,
                    pauseCategory: reasonData.pauseCategory || null,
                    logType: reasonData.logType || null,
                    preemptedReason: reasonData.reason || null,
                    preemptedByUserId: reasonData.responsibleUserId || null,
                    preemptedByName: reasonData.responsibleName || null,
                });
            }

            return executeTransition(data, true, {
                pauseCategory: reasonData.pauseCategory || null,
                logType: reasonData.logType || null,
                preemptedReason: reasonData.reason || null,
                preemptedByUserId: reasonData.responsibleUserId || null,
                preemptedByName: reasonData.responsibleName || null,
            });
        }
    }, [pendingTransition, executeTransition]);

    return {
        requestTransition,
        executeTransition,
        confirmTransition,
        cancelTransition,

        // WIP-specific
        executeWipSwitch,
        wipConflict,

        pendingTransition,
        transitionError,
        isTransitioning,
    };
}
