/**
 * auditTrailService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import * as supabaseImpl from './auditTrailService.supabase.js';

export const recordEvent = (...args) => supabaseImpl.recordEvent(...args);
export const recordOverride = (...args) => supabaseImpl.recordOverride(...args);
export const recordAiAction = (...args) => supabaseImpl.recordAiAction(...args);
export const recordEntityChange = (...args) => supabaseImpl.recordEntityChange(...args);
export const getAuditTrailForEntity = (...args) => supabaseImpl.getAuditTrailForEntity(...args);
