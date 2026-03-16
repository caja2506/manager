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
 * Flow:
 *   1. requestTransition() → client-side validation (immediate)
 *   2. If warnings/missing fields → show confirmation UI
 *   3. executeTransition() or confirmTransition() → calls CF via taskService
 *   4. CF validates again server-side → writes status + audit event atomically
 */

import { useState, useCallback } from 'react';
import { validateTransition } from '../core/workflow/transitionValidator';
import { getRequiredFields, getWorkflowSequence } from '../core/workflow/workflowModel';
import { updateTaskStatus } from '../services/taskService';

/**
 * @returns Hook for managing validated workflow transitions.
 */
export function useWorkflowTransition() {
    const [pendingTransition, setPendingTransition] = useState(null);
    const [transitionError, setTransitionError] = useState(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    /**
     * Attempt to transition a task to a new status.
     * Performs client-side validation for instant feedback.
     * Returns a result object that indicates if the transition needs confirmation.
     */
    const requestTransition = useCallback((task, targetStatus, userId) => {
        setTransitionError(null);

        // Client-side validation (instant UX — server re-validates)
        const validation = validateTransition(task, targetStatus);

        if (!validation.valid) {
            const errorMsg = validation.errors.map(e => e.message).join('. ') || 'Transición no permitida';
            setTransitionError(errorMsg);
            return {
                allowed: false,
                needsConfirmation: false,
                error: errorMsg,
            };
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
            warnings,
            missingFields,
            transitionData,
            execute: needsConfirmation
                ? null
                : () => executeTransition(transitionData),
        };
    }, []);

    /**
     * Execute a validated transition via Cloud Function.
     * If called after user confirmation (pending), sends force=true
     * to allow the CF to skip required field validation.
     */
    const executeTransition = useCallback(async (transitionData, forceOverride = false) => {
        const data = transitionData || pendingTransition;
        const { task, targetStatus } = data || {};
        if (!task || !targetStatus) return;

        setIsTransitioning(true);
        setTransitionError(null);

        try {
            // force=true when user confirmed despite warnings/missing fields
            const force = forceOverride || (data.missingFields?.length > 0);

            // Calls Cloud Function via taskService.updateTaskStatus()
            // CF handles: validation, status write, audit event, risk recalc
            const result = await updateTaskStatus(task.id, targetStatus, task.projectId, force);

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

    /**
     * Cancel a pending transition.
     */
    const cancelTransition = useCallback(() => {
        setPendingTransition(null);
        setTransitionError(null);
    }, []);

    /**
     * Confirm and execute a pending transition (force=true).
     */
    const confirmTransition = useCallback(async () => {
        if (pendingTransition) {
            return executeTransition(pendingTransition, true);
        }
    }, [pendingTransition, executeTransition]);

    return {
        requestTransition,
        executeTransition,
        confirmTransition,
        cancelTransition,

        pendingTransition,
        transitionError,
        isTransitioning,
    };
}
