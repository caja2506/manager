/**
 * Backend Configuration
 * =====================
 * Central flag that determines which backend to use.
 * All services import this to decide between Firebase and Supabase.
 *
 * Set VITE_DB_BACKEND=supabase in .env.local to switch.
 * Default = 'firebase' (production-safe).
 */

export const DB_BACKEND = import.meta.env.VITE_DB_BACKEND || 'firebase';
export const USE_SUPABASE = DB_BACKEND === 'supabase';

if (USE_SUPABASE) {
    console.log('[backend] 🔌 Using Supabase (PostgreSQL)');
} else {
    console.log('[backend] 🔥 Using Firebase (Firestore)');
}
