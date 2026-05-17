/**
 * ganttService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './ganttService.supabase.js';
import * as firebaseImpl from './ganttService.firebase.js';

export const getTasksForGantt = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getTasksForGantt(...args);
export const getDependencies = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getDependencies(...args);
export const getProjectsForGantt = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getProjectsForGantt(...args);
export const getTaskTypesForGantt = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getTaskTypesForGantt(...args);
export const getUsersForGantt = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getUsersForGantt(...args);
export const getMilestonesForGantt = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getMilestonesForGantt(...args);
export const updateTaskGanttFields = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateTaskGanttFields(...args);
export const createDependency = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).createDependency(...args);
export const deleteDependency = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).deleteDependency(...args);
