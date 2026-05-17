/**
 * delayService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './delayService.supabase.js';
import * as firebaseImpl from './delayService.firebase.js';

export const createDelayCause = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).createDelayCause(...args);
export const updateDelayCause = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateDelayCause(...args);
export const deleteDelayCause = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).deleteDelayCause(...args);
export const createDelay = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).createDelay(...args);
export const resolveDelay = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).resolveDelay(...args);
export const updateDelay = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateDelay(...args);
export const deleteDelay = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).deleteDelay(...args);
