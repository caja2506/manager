/**
 * User Profile Service — Proxy
 * ==============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./userProfileService.supabase.js')
    : await import('./userProfileService.firebase.js');

export const ensureUserProfile = impl.ensureUserProfile;
export const updateUserProfile = impl.updateUserProfile;
