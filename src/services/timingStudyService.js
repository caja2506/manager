/**
 * Timing Study Service — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import * as supabaseImpl from './timingStudyService.supabase.js';

export const getTimingStudiesByProject = (...args) => supabaseImpl.getTimingStudiesByProject(...args);
export const onProjectTimingStudies = (...args) => supabaseImpl.onProjectTimingStudies(...args);
export const getTimingStudy = (...args) => supabaseImpl.getTimingStudy(...args);
export const createTimingStudy = (...args) => supabaseImpl.createTimingStudy(...args);
export const updateTimingStudy = (...args) => supabaseImpl.updateTimingStudy(...args);
export const deleteTimingStudy = (...args) => supabaseImpl.deleteTimingStudy(...args);
export const getTimingStudySteps = (...args) => supabaseImpl.getTimingStudySteps(...args);
export const onTimingStudySteps = (...args) => supabaseImpl.onTimingStudySteps(...args);
export const addTimingStep = (...args) => supabaseImpl.addTimingStep(...args);
export const updateTimingStep = (...args) => supabaseImpl.updateTimingStep(...args);
export const deleteTimingStep = (...args) => supabaseImpl.deleteTimingStep(...args);
export const bulkCreateTimingSteps = (...args) => supabaseImpl.bulkCreateTimingSteps(...args);
export const recalculateTimingStudy = (...args) => supabaseImpl.recalculateTimingStudy(...args);
export const getGlobalMotionStandards = (...args) => supabaseImpl.getGlobalMotionStandards(...args);
export const updateGlobalMotionStandards = (...args) => supabaseImpl.updateGlobalMotionStandards(...args);
export const getActuatorGroups = (...args) => supabaseImpl.getActuatorGroups(...args);
export const updateActuatorGroups = (...args) => supabaseImpl.updateActuatorGroups(...args);
