/**
 * Notification Service — Proxy
 * =============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./notificationService.supabase.js')
    : await import('./notificationService.firebase.js');

export const subscribeToNotifications = impl.subscribeToNotifications;
export const markNotificationRead = impl.markNotificationRead;
export const markAllNotificationsRead = impl.markAllNotificationsRead;
