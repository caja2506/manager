/**
 * Planning Domain Module
 * ======================
 * [Phase M.3] Ownership barrel for planning & scheduling functionality.
 *
 * Surfaces: weekly planner, Gantt, milestones, work areas,
 *           time tracking, and resource assignment.
 */

// --- Data Hooks ---
export { useEngineeringData } from '../../hooks/useEngineeringData';
export { useMilestoneScore } from '../../hooks/useMilestoneScore';
export { useMilestoneHistory } from '../../hooks/useMilestoneHistory';

// --- Services ---
export {
    createPlanItem,
    updatePlanItem,
    deletePlanItem,
    getWeeklyPlanItems,
} from '../../services/plannerService';

export {
    createGanttItem,
    updateGanttItem,
    deleteGanttItem,
    getGanttItems,
} from '../../services/ganttService';

export {
    syncGanttAndPlanner,
} from '../../services/ganttPlannerSync';

export {
    createMilestone,
    updateMilestone,
    deleteMilestone,
    getMilestonesByProject,
} from '../../services/milestoneService';

export {
    createWorkArea,
    updateWorkArea,
    deleteWorkArea,
    getWorkAreasByMilestone,
    getWorkAreasByProject,
    updateWorkAreaTypeMapping,
    updateWorkAreaTaskTypes,
} from '../../services/workAreaService';

export {
    startTimer,
    stopTimer,
    createManualTimeLog,
    updateTimeLog,
    deleteTimeLog,
    formatDuration,
    formatElapsed,
    recalculateTaskHours,
} from '../../services/timeService';

export {
    assignResource,
    unassignResource,
} from '../../services/resourceAssignmentService';

// --- Utils ---
export {
    findConflicts,
    validateDrag,
    buildWeekDays,
} from '../../utils/plannerUtils';
