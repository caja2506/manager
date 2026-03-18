/**
 * Auth Guard — V5 Centralized Admin/Role Check (O1)
 * ====================================================
 * 
 * Replaces 14+ copy-paste admin checks in Cloud Functions with a
 * single helper that:
 *   1. Reads `users.rbacRole` (V5 source of truth)
 *   2. Falls back to `users_roles.role` during migration
 *   3. Returns the resolved role
 *   4. Throws HttpsError for auth/permission failures
 * 
 * MIGRATION PLAN:
 *   M7: Client RoleContext reads from users.rbacRole
 *   M8: This helper reads from users first (current phase)
 *   Post-M8: Remove fallback, freeze users_roles
 */

const { HttpsError } = require("firebase-functions/v2/https");

/**
 * Get the RBAC role for a user from Firestore.
 * Reads from `users.rbacRole` first (V5), falls back to `users_roles.role`.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} uid - Firebase Auth UID
 * @returns {Promise<string>} The role: 'admin', 'editor', or 'viewer'
 */
async function getUserRbacRole(adminDb, uid) {
    // V5: Try users/{uid}.rbacRole first
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (userDoc.exists) {
        const rbacRole = userDoc.data().rbacRole;
        if (rbacRole) return rbacRole;
        // Fallback: some users migrated before rbacRole was added
        const legacyRole = userDoc.data().role;
        if (legacyRole) return legacyRole;
    }

    // Migration fallback: read from users_roles (legacy)
    const roleDoc = await adminDb.collection("users_roles").doc(uid).get();
    if (roleDoc.exists) {
        return roleDoc.data().role || "viewer";
    }

    return "viewer"; // Default for unknown users
}

/**
 * Require that the caller is authenticated.
 * Throws HttpsError if not.
 *
 * @param {Object} request - Cloud Function request object
 */
function requireAuth(request) {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated.");
    }
}

/**
 * Require that the caller has admin role.
 * Checks users.rbacRole (V5) with fallback to users_roles.role.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {Object} request - Cloud Function request object
 * @returns {Promise<string>} The user's UID (for convenience)
 */
async function requireAdmin(adminDb, request) {
    requireAuth(request);
    const role = await getUserRbacRole(adminDb, request.auth.uid);
    if (role !== "admin") {
        throw new HttpsError("permission-denied", "Admin access required.");
    }
    return request.auth.uid;
}

/**
 * Require that the caller has editor or admin role.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {Object} request - Cloud Function request object
 * @returns {Promise<string>} The user's UID (for convenience)
 */
async function requireEditor(adminDb, request) {
    requireAuth(request);
    const role = await getUserRbacRole(adminDb, request.auth.uid);
    if (role !== "admin" && role !== "editor") {
        throw new HttpsError("permission-denied", "Editor access required.");
    }
    return request.auth.uid;
}

module.exports = {
    getUserRbacRole,
    requireAuth,
    requireAdmin,
    requireEditor,
};
