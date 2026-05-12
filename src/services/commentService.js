/**
 * Comment Service — Proxy
 * ========================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./commentService.supabase.js')
    : await import('./commentService.firebase.js');

export const subscribeToComments = impl.subscribeToComments;
export const addComment = impl.addComment;
export const updateComment = impl.updateComment;
export const deleteComment = impl.deleteComment;
export const fetchComments = impl.fetchComments;
export const fetchYesterdayComments = impl.fetchYesterdayComments;
