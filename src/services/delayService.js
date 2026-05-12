/**
 * Delay Service — Proxy
 * =====================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./delayService.supabase.js')
    : await import('./delayService.firebase.js');

export const createDelayCause = impl.createDelayCause;
export const updateDelayCause = impl.updateDelayCause;
export const deleteDelayCause = impl.deleteDelayCause;
export const createDelay = impl.createDelay;
export const resolveDelay = impl.resolveDelay;
export const updateDelay = impl.updateDelay;
export const deleteDelay = impl.deleteDelay;
