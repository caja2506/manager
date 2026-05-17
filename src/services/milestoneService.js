/**
 * Milestone Service — Proxy
 * ===========================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./milestoneService.supabase.js')
    : await import('./milestoneService.firebase.js');

export const createMilestone = impl.createMilestone;
export const updateMilestone = impl.updateMilestone;
export const deleteMilestone = impl.deleteMilestone;
export const getMilestonesByProject = impl.getMilestonesByProject;
export const getAllMilestones = impl.getAllMilestones;
export const createProjectMilestones = impl.createProjectMilestones;
export const computeFullScore = impl.computeFullScore;
export const applyTrafficLightOverride = impl.applyTrafficLightOverride;
export const captureScoreSnapshot = impl.captureScoreSnapshot;
export const getScoreSnapshots = impl.getScoreSnapshots;
export { explainScore } from '../core/scoring/scoreEngine';
export { computeTrend, computeAreaTrends } from '../core/scoring/trendCalculator';
