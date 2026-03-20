/**
 * Tasks Domain Module
 * ===================
 * [Phase M.3] Ownership barrel for task management functionality.
 *
 * Surfaces: task CRUD, subtask management, workflow transitions,
 *           delay reporting, and engineering data subscriptions.
 */

// --- Data Hook ---
export { useEngineeringData } from '../../hooks/useEngineeringData';
export { useWorkflowTransition } from '../../hooks/useWorkflowTransition';

// --- Services ---
export {
    createTask,
    updateTask,
    deleteTask,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    getTaskById,
} from '../../services/taskService';

export {
    createDelay,
    getDelaysByTask,
    getDelaysByProject,
} from '../../services/delayService';

export {
    fetchProjectMilestones,
    fetchMilestoneWorkAreas,
    fetchTaskDependencies,
    fetchTaskPlannerItems,
    addWorkAreaType,
} from '../../services/engineeringDataService';

// --- Core Logic ---
export { computeAreaScore, explainScore } from '../../core/scoring/scoreEngine';

// --- Utils ---
export { normalizeTask, normalizeTaskArray } from '../../utils/taskNormalizer';
