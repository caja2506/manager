/**
 * milestoneService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './milestoneService.supabase.js';
import * as firebaseImpl from './milestoneService.firebase.js';

export const createMilestone = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).createMilestone(...args);
export const updateMilestone = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateMilestone(...args);
export const deleteMilestone = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).deleteMilestone(...args);
export const getMilestonesByProject = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getMilestonesByProject(...args);
export const getAllMilestones = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getAllMilestones(...args);
export const createProjectMilestones = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).createProjectMilestones(...args);
export const computeFullScore = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).computeFullScore(...args);
export const applyTrafficLightOverride = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).applyTrafficLightOverride(...args);
export const captureScoreSnapshot = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).captureScoreSnapshot(...args);
export const getScoreSnapshots = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getScoreSnapshots(...args);
