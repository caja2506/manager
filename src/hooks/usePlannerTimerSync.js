import { useMemo } from 'react';

/**
 * usePlannerTimerStatus — Read-only hook that maps planner blocks
 * to their real-time timer status.
 *
 * Returns a Map: blockId → {
 *   status: 'active' | 'idle' | 'overflow',
 *   timerId?: string,
 *   elapsedMin?: number,
 *   source?: string,
 * }
 *
 * @param {Object} params
 * @param {Array} params.timeLogs — all time log documents
 * @param {Array} params.planItems — enriched plan items for the visible day(s)
 */
export function usePlannerTimerStatus({ timeLogs = [], planItems = [] }) {
    return useMemo(() => {
        const statusMap = new Map();
        if (!timeLogs.length || !planItems.length) return statusMap;

        for (const block of planItems) {
            if (!block.taskId || !block.assignedTo) {
                statusMap.set(block.id, { status: 'idle' });
                continue;
            }

            // Find an active (no endTime) timer for this task+user combo
            const timer = timeLogs.find(
                l => l.taskId === block.taskId
                  && l.userId === block.assignedTo
                  && !l.endTime
                  && l.startTime
            );

            if (timer) {
                const now = new Date();
                const blockEnd = block.endDateTime ? new Date(block.endDateTime) : null;
                const isOverflow = blockEnd && now > blockEnd;
                const elapsedMin = Math.round((now - new Date(timer.startTime)) / 60000);

                statusMap.set(block.id, {
                    status: isOverflow ? 'overflow' : 'active',
                    timerId: timer.id,
                    elapsedMin,
                    source: timer.source || 'legacy',
                });
            } else {
                statusMap.set(block.id, { status: 'idle' });
            }
        }

        return statusMap;
    }, [timeLogs, planItems]);
}
