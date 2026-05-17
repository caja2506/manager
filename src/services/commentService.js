/**
 * commentService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './commentService.supabase.js';
import * as firebaseImpl from './commentService.firebase.js';

export const subscribeToComments = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).subscribeToComments(...args);
export const addComment = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).addComment(...args);
export const updateComment = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateComment(...args);
export const deleteComment = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).deleteComment(...args);
export const fetchComments = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).fetchComments(...args);
export const fetchYesterdayComments = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).fetchYesterdayComments(...args);
