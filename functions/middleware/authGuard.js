/**
 * Auth Guard — Centralized Middleware for Cloud Functions
 * ========================================================
 * 
 * Unified RBAC check for Cloud Functions.
 * Reads from Supabase `users` table via coreDataReader as the single source of truth.
 * 
 * Usage:
 *   const { requireAdmin, requireEditor } = require("../middleware/authGuard");
 *   await requireAdmin(adminDb, request);
 */
const { HttpsError } = require("firebase-functions/v2/https");
const { loadUser } = require("../db/coreDataReader");

/**
 * Get RBAC role from Supabase users table.
 * Returns "viewer" if no role is found.
 * 
 * @param {FirebaseFirestore.Firestore} _adminDb - Kept for backward compatibility (unused)
 * @param {string} uid
 * @returns {Promise<string>}
 */
async function getUserRbacRole(_adminDb, uid) {
    const user = await loadUser(uid);
    if (user && user.rbacRole) {
        return user.rbacRole;
    }
    return "viewer";
}

/**
 * Require admin role. Throws HttpsError if not admin.
 * 
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {Object} request - Cloud Function request with request.auth
 * @throws {HttpsError}
 */
async function requireAdmin(adminDb, request) {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const role = await getUserRbacRole(adminDb, request.auth.uid);
    if (role !== "admin") {
        throw new HttpsError("permission-denied", "Admin access required.");
    }
}

/**
 * Require editor or admin role.
 * 
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {Object} request
 * @throws {HttpsError}
 */
async function requireEditor(adminDb, request) {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const role = await getUserRbacRole(adminDb, request.auth.uid);
    if (!["admin", "editor"].includes(role)) {
        throw new HttpsError("permission-denied", "Editor access required.");
    }
}

module.exports = { getUserRbacRole, requireAdmin, requireEditor };
