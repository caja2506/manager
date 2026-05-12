/**
 * Peer Review Service — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./peerReviewService.supabase.js')
    : await import('./peerReviewService.firebase.js');

export const requestPeerReview = impl.requestPeerReview;
export const submitPeerReview = impl.submitPeerReview;
export const waivePeerReview = impl.waivePeerReview;
export const getChecklistForTaskType = impl.getChecklistForTaskType;
export const getTemplateForTaskType = impl.getTemplateForTaskType;
export const subscribeToPendingReviews = impl.subscribeToPendingReviews;
export const subscribeToPeerReviews = impl.subscribeToPeerReviews;
export const generatePRChecklist = impl.generatePRChecklist;
export const saveTaskTypeChecklist = impl.saveTaskTypeChecklist;
export const resolvePeerReviewFromTaskType = impl.resolvePeerReviewFromTaskType;
export const updateTaskTypePeerReview = impl.updateTaskTypePeerReview;
export const PR_STATUS_CONFIG = impl.PR_STATUS_CONFIG;
