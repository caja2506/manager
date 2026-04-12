/**
 * userProfileService.js
 * =====================
 * 
 * Bootstrap & sync service for the `users/{uid}` collection.
 * 
 * ARCHITECTURAL DECISION:
 * -----------------------
 * The system uses TWO user collections:
 * 
 *   1. `users_roles/{uid}` → RBAC only (admin/editor/viewer)
 *      - Managed by RoleContext.jsx and UserAdminPanel.jsx
 *      - Referenced by Firestore security rules for write permissions
 * 
 *   2. `users/{uid}` → Operational profile (teamRole, capacity, etc.)
 *      - Bootstrapped on first login via ensureUserProfile()
 *      - Loaded by AppDataContext as `teamMembers`
 *      - Managed by admin via UserAdminPanel (team role + capacity)
 * 
 * This service ensures `users/{uid}` always exists when a user logs in,
 * preventing null/undefined data in dashboards, analytics, and planner.
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, TEAM_ROLES } from '../models/schemas';

// ============================================================
// VALID TEAM ROLES — used for validation
// ============================================================
const VALID_TEAM_ROLES = Object.values(TEAM_ROLES);

/**
 * ensureUserProfile
 * -----------------
 * Guarantees that `users/{uid}` exists in Firestore.
 * Called by RoleContext on every login / auth state change.
 * 
 * SECURITY: This function does NOT write rbacRole.
 * rbacRole can ONLY be set by an admin (via Cloud Function or admin panel).
 * 
 * Behavior:
 *   - If doc exists → syncs displayName only (no privilege fields)
 *   - If doc missing → creates from Firebase Auth data (no rbacRole)
 * 
 * @param {Object} authUser — Firebase Auth user object (uid, email, displayName, photoURL)
 * @returns {Object} — the user profile document data
 */
export async function ensureUserProfile(authUser) {
    if (!authUser?.uid) return null;

    const profileRef = doc(db, COLLECTIONS.USERS, authUser.uid);
    const profileSnap = await getDoc(profileRef);

    // Determine best available name from Auth
    const bestName = authUser.displayName || '';

    if (profileSnap.exists()) {
        const existing = profileSnap.data();
        const updates = {};

        // Sync displayName if Auth has a better name (non-privileged field only)
        if (bestName && bestName !== (existing.displayName || '')) {
            updates.displayName = bestName;
        }

        // SECURITY: Do NOT sync rbacRole here. Only admins can modify rbacRole.

        // Only write if there are actual changes
        if (Object.keys(updates).length > 0) {
            updates.updatedAt = new Date().toISOString();
            await updateDoc(profileRef, updates);
            console.log(`[userProfileService] Synced for ${authUser.email}:`, Object.keys(updates).join(', '));
            return { uid: authUser.uid, ...existing, ...updates };
        }
        return { uid: authUser.uid, ...existing };
    }

    // Profile missing — bootstrap from auth data (NO rbacRole — admin assigns it)
    const newProfile = {
        displayName: bestName,
        email: authUser.email || '',
        photoURL: authUser.photoURL || '',
        // SECURITY: rbacRole is NOT set here. Defaults to 'viewer' in rules/context.
        teamRole: null,             // Admin sets this manually
        department: 'Engineering',
        weeklyCapacityHours: 40,    // Default: standard 40h week
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: authUser.uid,
        updatedBy: authUser.uid,
    };

    await setDoc(profileRef, newProfile);
    console.log(`[userProfileService] Created profile for ${authUser.email} (rbacRole not set — viewer default)`);

    return { uid: authUser.uid, ...newProfile };
}

/**
 * updateUserProfile
 * -----------------
 * Updates operational fields on `users/{uid}`.
 * Used by UserAdminPanel to set teamRole, weeklyCapacityHours, etc.
 * 
 * @param {string} uid — user's Firebase Auth UID
 * @param {Object} data — fields to update (teamRole, weeklyCapacityHours, etc.)
 */
export async function updateUserProfile(uid, data) {
    if (!uid) throw new Error('uid is required');

    // Validate teamRole if provided
    if (data.teamRole !== undefined && data.teamRole !== null) {
        if (!VALID_TEAM_ROLES.includes(data.teamRole)) {
            throw new Error(`Invalid teamRole: "${data.teamRole}". Valid: ${VALID_TEAM_ROLES.join(', ')}`);
        }
    }

    // Validate weeklyCapacityHours if provided
    if (data.weeklyCapacityHours !== undefined) {
        const hours = Number(data.weeklyCapacityHours);
        if (isNaN(hours) || hours < 0 || hours > 168) {
            throw new Error(`Invalid weeklyCapacityHours: ${data.weeklyCapacityHours}. Must be 0-168.`);
        }
        data.weeklyCapacityHours = hours;
    }

    const profileRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(profileRef, {
        ...data,
        updatedAt: new Date().toISOString(),
    });
}
