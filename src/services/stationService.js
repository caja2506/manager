/**
 * stationService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './stationService.supabase.js';
import * as firebaseImpl from './stationService.firebase.js';

export const hasMultipleIndexers = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).hasMultipleIndexers(...args);
export const getProjectStations = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getProjectStations(...args);
export const onProjectStations = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).onProjectStations(...args);
export const addStation = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).addStation(...args);
export const updateStation = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateStation(...args);
export const deleteStation = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).deleteStation(...args);
export const bulkImportStations = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).bulkImportStations(...args);
export const getStationOptions = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getStationOptions(...args);
