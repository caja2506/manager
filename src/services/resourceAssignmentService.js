/**
 * resourceAssignmentService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './resourceAssignmentService.supabase.js';
import * as firebaseImpl from './resourceAssignmentService.firebase.js';

export const getActiveAssignments = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getActiveAssignments(...args);
export const getAssignmentHistory = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getAssignmentHistory(...args);
export const createInitialAssignment = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).createInitialAssignment(...args);
export const reassignTechnician = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).reassignTechnician(...args);
