/**
 * userProfileService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './userProfileService.supabase.js';
import * as firebaseImpl from './userProfileService.firebase.js';

export const ensureUserProfile = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).ensureUserProfile(...args);
export const updateUserProfile = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateUserProfile(...args);
