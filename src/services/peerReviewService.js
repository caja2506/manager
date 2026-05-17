/**
 * peerReviewService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './peerReviewService.supabase.js';
import * as firebaseImpl from './peerReviewService.firebase.js';

export const requestPeerReview = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).requestPeerReview(...args);
export const submitPeerReview = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).submitPeerReview(...args);
export const waivePeerReview = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).waivePeerReview(...args);
export const getChecklistForTaskType = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getChecklistForTaskType(...args);
export const getTemplateForTaskType = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getTemplateForTaskType(...args);
export const subscribeToPendingReviews = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).subscribeToPendingReviews(...args);
export const subscribeToPeerReviews = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).subscribeToPeerReviews(...args);
export const generatePRChecklist = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).generatePRChecklist(...args);
export const saveTaskTypeChecklist = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).saveTaskTypeChecklist(...args);
export const resolvePeerReviewFromTaskType = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).resolvePeerReviewFromTaskType(...args);
export const updateTaskTypePeerReview = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateTaskTypePeerReview(...args);
export const PR_STATUS_CONFIG = USE_SUPABASE ? supabaseImpl.PR_STATUS_CONFIG : firebaseImpl.PR_STATUS_CONFIG;
