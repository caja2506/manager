/**
 * userAdminService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './userAdminService.supabase.js';
import * as firebaseImpl from './userAdminService.firebase.js';

export const subscribeToRbacUsers = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).subscribeToRbacUsers(...args);
export const subscribeToUserProfiles = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).subscribeToUserProfiles(...args);
export const updateRbacRole = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateRbacRole(...args);
export const updateUserDisplayName = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateUserDisplayName(...args);
export const removeRbacUser = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).removeRbacUser(...args);
export const registerOrphanUser = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).registerOrphanUser(...args);
export const removeOrphanUser = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).removeOrphanUser(...args);
