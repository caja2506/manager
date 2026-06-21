/**
 * userProfileService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import * as supabaseImpl from './userProfileService.supabase.js';

export const ensureUserProfile = (...args) => supabaseImpl.ensureUserProfile(...args);
export const updateUserProfile = (...args) => supabaseImpl.updateUserProfile(...args);
