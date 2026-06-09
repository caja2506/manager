/**
 * ganttService — Direct Supabase export
 */
export {
  getTasksForGantt,
  getDependencies,
  getProjectsForGantt,
  getTaskTypesForGantt,
  getUsersForGantt,
  getMilestonesForGantt,
  updateTaskGanttFields,
  createDependency,
  deleteDependency,
} from './ganttService.supabase.js';
