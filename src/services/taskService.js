/**
 * taskService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './taskService.supabase.js';
import * as firebaseImpl from './taskService.firebase.js';

export const createProject = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).createProject(...args);
export const updateProject = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateProject(...args);
export const deleteProject = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).deleteProject(...args);
export const createTask = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).createTask(...args);
export const updateTask = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateTask(...args);
export const updateTaskStatus = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateTaskStatus(...args);
export const deleteTask = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).deleteTask(...args);
export const createSubtask = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).createSubtask(...args);
export const toggleSubtask = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).toggleSubtask(...args);
export const deleteSubtask = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).deleteSubtask(...args);
export const updateSubtask = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateSubtask(...args);
export const reorderSubtasks = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).reorderSubtasks(...args);
