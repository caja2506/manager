/**
 * riskService — Proxy
 * =====================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./riskService.supabase.js')
    : await import('./riskService.firebase.js');

export const calculateProjectRisk = impl.calculateProjectRisk;
