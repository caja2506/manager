/**
 * Timing Study Service — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './timingStudyService.supabase.js';
import * as firebaseImpl from './timingStudyService.firebase.js';

export const getTimingStudiesByProject = (...args) => 
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).getTimingStudiesByProject(...args);

export const onProjectTimingStudies = (...args) => 
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).onProjectTimingStudies(...args);

export const getTimingStudy = (...args) => 
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).getTimingStudy(...args);

export const createTimingStudy = (...args) => 
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).createTimingStudy(...args);

export const updateTimingStudy = (...args) => 
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateTimingStudy(...args);

export const deleteTimingStudy = (...args) => 
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).deleteTimingStudy(...args);

export const getTimingStudySteps = (...args) => 
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).getTimingStudySteps(...args);

export const onTimingStudySteps = (...args) => 
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).onTimingStudySteps(...args);

export const addTimingStep = (...args) => 
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).addTimingStep(...args);

export const updateTimingStep = (...args) => 
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateTimingStep(...args);

export const deleteTimingStep = (...args) => 
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).deleteTimingStep(...args);

export const bulkCreateTimingSteps = (...args) => 
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).bulkCreateTimingSteps(...args);

export const recalculateTimingStudy = (...args) => 
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).recalculateTimingStudy(...args);

export const getGlobalMotionStandards = (...args) => 
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).getGlobalMotionStandards(...args);

export const updateGlobalMotionStandards = (...args) => 
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateGlobalMotionStandards(...args);

export const getActuatorGroups = (...args) =>
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).getActuatorGroups(...args);

export const updateActuatorGroups = (...args) =>
    (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateActuatorGroups(...args);
