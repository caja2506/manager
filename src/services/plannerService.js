/**
 * Planner Service — Proxy
 * =======================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./plannerService.supabase.js')
    : await import('./plannerService.firebase.js');

export const plannerService = impl.plannerService;
