/**
 * Task Service — Proxy
 * ====================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * All existing imports from components continue to work unchanged.
 */

import { USE_SUPABASE } from './_backend';

// Conditional re-export: Supabase or Firebase
const impl = USE_SUPABASE
    ? await import('./taskService.supabase.js')
    : await import('./taskService.firebase.js');

// ── Projects ──
export const createProject = impl.createProject;
export const updateProject = impl.updateProject;
export const deleteProject = impl.deleteProject;

// ── Tasks ──
export const createTask = impl.createTask;
export const updateTask = impl.updateTask;
export const updateTaskStatus = impl.updateTaskStatus;
export const deleteTask = impl.deleteTask;

// ── Subtasks ──
export const createSubtask = impl.createSubtask;
export const toggleSubtask = impl.toggleSubtask;
export const deleteSubtask = impl.deleteSubtask;
export const updateSubtask = impl.updateSubtask;
export const reorderSubtasks = impl.reorderSubtasks;
