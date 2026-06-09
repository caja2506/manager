/**
 * taskService — Direct Supabase export
 */
export {
  createProject,
  updateProject,
  deleteProject,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  createSubtask,
  toggleSubtask,
  deleteSubtask,
  updateSubtask,
  reorderSubtasks,
} from './taskService.supabase.js';
