/**
 * Resource Assignment Service — Proxy
 * ====================================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./resourceAssignmentService.supabase.js')
    : await import('./resourceAssignmentService.firebase.js');

export const getActiveAssignments = impl.getActiveAssignments;
export const getAssignmentHistory = impl.getAssignmentHistory;
export const createInitialAssignment = impl.createInitialAssignment;
export const reassignTechnician = impl.reassignTechnician;
