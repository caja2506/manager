/**
 * managedListService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './managedListService.supabase.js';
import * as firebaseImpl from './managedListService.firebase.js';

export const saveManagedList = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).saveManagedList(...args);
