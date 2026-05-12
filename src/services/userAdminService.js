/**
 * User Admin Service — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./userAdminService.supabase.js')
    : await import('./userAdminService.firebase.js');

export const subscribeToRbacUsers = impl.subscribeToRbacUsers;
export const subscribeToUserProfiles = impl.subscribeToUserProfiles;
export const updateRbacRole = impl.updateRbacRole;
export const updateUserDisplayName = impl.updateUserDisplayName;
export const removeRbacUser = impl.removeRbacUser;
export const registerOrphanUser = impl.registerOrphanUser;
export const removeOrphanUser = impl.removeOrphanUser;
