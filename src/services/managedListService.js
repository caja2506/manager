/**
 * Managed List Service — Proxy
 * ==============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./managedListService.supabase.js')
    : await import('./managedListService.firebase.js');

export const saveManagedList = impl.saveManagedList;
