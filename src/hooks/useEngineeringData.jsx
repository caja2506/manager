/**
 * useEngineeringData — Proxy
 * ===========================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from '../services/_backend';

let exports;
if (USE_SUPABASE) {
    exports = await import('./useEngineeringData.supabase.jsx');
} else {
    exports = await import('./useEngineeringData.firebase.jsx');
}

export const useEngineeringData = exports.useEngineeringData;
export const EngineeringDataProvider = exports.EngineeringDataProvider;
