/**
 * useWorkflowTransition Hook
 * ==========================
 * 
 * Validates task status transitions against the workflow model,
 * logs audit events, and wraps updateTaskStatus with enforcement.
 */

import { useState, useCallback } from 'react';
import { validateTransition } from '../core/workflow/transitionValidator';
import { WORKFLOW_STATUS, getRequiredFields, getWorkflowSequence } from '../core/workflow/workflowModel';
import { updateTaskStatus } from '../services/taskService';
import { doc, setDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { createAuditEventDocument, COLLECTIONS } from '../models/schemas';

/**
 * @returns Hook for managing validated workflow transitions.
 */
export function useWorkflowTransition() {
    const [pendingTransition, setPendingTransition] = useState(null);
    const [transitionError, setTransitionError] = useState(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    /**
     * Attempt to transition a task to a new status.
     * Returns a result object that indicates if the transition needs confirmation.
     */
    const requestTransition = useCallback((task, targetStatus, userId) => {
        setTransitionError(null);

        // Validate transition using the transitionValidator
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

        // Gather warnings from validation + our own
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
     * Execute a validated transition (writes to Firestore).
     */
    const executeTransition = useCallback(async (transitionData) => {
        const { task, targetStatus, userId } = transitionData || pendingTransition || {};
        if (!task || !targetStatus) return;

        setIsTransitioning(true);
        setTransitionError(null);

        try {
            // Execute the actual status update
            await updateTaskStatus(task.id, targetStatus, task.projectId);

            // Log audit event
            try {
                const auditEvent = createAuditEventDocument({
                    eventType: 'task_transition',
                    entityType: 'task',
                    entityId: task.id,
                    userId: userId,
                    details: {
                        previousStatus: task.status,
                        newStatus: targetStatus,
                        taskTitle: task.title,
                        projectId: task.projectId,
                    },
                });

                const auditRef = doc(collection(db, COLLECTIONS.AUDIT_EVENTS));
                await setDoc(auditRef, auditEvent);
            } catch (auditErr) {
                // Audit logging should not block the transition
                console.warn('Failed to log audit event:', auditErr);
            }

            setPendingTransition(null);
            return { success: true };
        } catch (err) {
            const error = `Error al actualizar: ${err.message}`;
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
     * Confirm and execute a pending transition.
     */
    const confirmTransition = useCallback(async () => {
        if (pendingTransition) {
            return executeTransition(pendingTransition);
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
