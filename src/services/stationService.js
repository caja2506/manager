/**
 * Station Service — Proxy
 * ========================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./stationService.supabase.js')
    : await import('./stationService.firebase.js');

export const hasMultipleIndexers = impl.hasMultipleIndexers;
export const getProjectStations = impl.getProjectStations;
export const onProjectStations = impl.onProjectStations;
export const addStation = impl.addStation;
export const updateStation = impl.updateStation;
export const deleteStation = impl.deleteStation;
export const bulkImportStations = impl.bulkImportStations;
export const getStationOptions = impl.getStationOptions;
