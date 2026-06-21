/**
 * userAdminService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import * as supabaseImpl from './userAdminService.supabase.js';

export const subscribeToRbacUsers = (...args) => supabaseImpl.subscribeToRbacUsers(...args);
export const subscribeToUserProfiles = (...args) => supabaseImpl.subscribeToUserProfiles(...args);
export const updateRbacRole = (...args) => supabaseImpl.updateRbacRole(...args);
export const updateUserDisplayName = (...args) => supabaseImpl.updateUserDisplayName(...args);
export const removeRbacUser = (...args) => supabaseImpl.removeRbacUser(...args);
export const registerOrphanUser = (...args) => supabaseImpl.registerOrphanUser(...args);
export const removeOrphanUser = (...args) => supabaseImpl.removeOrphanUser(...args);
