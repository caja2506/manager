/**
 * auditTrailService — Proxy
 * ===========================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./auditTrailService.supabase.js')
    : await import('./auditTrailService.firebase.js');

export const recordEvent = impl.recordEvent;
export const recordOverride = impl.recordOverride;
export const recordAiAction = impl.recordAiAction;
export const recordEntityChange = impl.recordEntityChange;
export const getAuditTrailForEntity = impl.getAuditTrailForEntity;
