/**
 * auditTrailService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './auditTrailService.supabase.js';
import * as firebaseImpl from './auditTrailService.firebase.js';

export const recordEvent = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).recordEvent(...args);
export const recordOverride = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).recordOverride(...args);
export const recordAiAction = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).recordAiAction(...args);
export const recordEntityChange = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).recordEntityChange(...args);
export const getAuditTrailForEntity = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getAuditTrailForEntity(...args);
