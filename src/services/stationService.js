/**
 * stationService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import * as supabaseImpl from './stationService.supabase.js';

export const hasMultipleIndexers = (...args) => supabaseImpl.hasMultipleIndexers(...args);
export const getProjectStations = (...args) => supabaseImpl.getProjectStations(...args);
export const onProjectStations = (...args) => supabaseImpl.onProjectStations(...args);
export const addStation = (...args) => supabaseImpl.addStation(...args);
export const updateStation = (...args) => supabaseImpl.updateStation(...args);
export const deleteStation = (...args) => supabaseImpl.deleteStation(...args);
export const bulkImportStations = (...args) => supabaseImpl.bulkImportStations(...args);
export const getStationOptions = (...args) => supabaseImpl.getStationOptions(...args);
