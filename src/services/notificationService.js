/**
 * notificationService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './notificationService.supabase.js';
import * as firebaseImpl from './notificationService.firebase.js';

export const subscribeToNotifications = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).subscribeToNotifications(...args);
export const markNotificationRead = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).markNotificationRead(...args);
export const markAllNotificationsRead = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).markAllNotificationsRead(...args);
