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
 * Behavior:
 *   - If doc exists → returns existing data (no overwrites)
 *   - If doc missing → creates from Firebase Auth + users_roles data
 * 
 * @param {Object} authUser — Firebase Auth user object (uid, email, displayName, photoURL)
 * @param {string} rbacRole — current RBAC role from users_roles (admin/editor/viewer)
 * @returns {Object} — the user profile document data
 */
export async function ensureUserProfile(authUser, rbacRole) {
    if (!authUser?.uid) return null;

    const profileRef = doc(db, COLLECTIONS.USERS, authUser.uid);
    const profileSnap = await getDoc(profileRef);

    // Also read users_roles to get the canonical displayName
    const rbacRef = doc(db, 'users_roles', authUser.uid);
    const rbacSnap = await getDoc(rbacRef);
    const rbacName = rbacSnap.exists() ? (rbacSnap.data().displayName || '') : '';

    // Determine best available name: users_roles > authUser > existing profile
    const bestName = rbacName || authUser.displayName || '';

    if (profileSnap.exists()) {
        const existing = profileSnap.data();
        // Sync displayName if users_roles has a better name
        if (bestName && bestName !== (existing.displayName || '')) {
            await updateDoc(profileRef, {
                displayName: bestName,
                updatedAt: new Date().toISOString(),
            });
            console.log(`[userProfileService] Synced displayName for ${authUser.email}: "${bestName}"`);
            return { uid: authUser.uid, ...existing, displayName: bestName };
        }
        return { uid: authUser.uid, ...existing };
    }

    // Profile missing — bootstrap from auth + RBAC data
    const newProfile = {
        displayName: bestName,
        email: authUser.email || '',
        photoURL: authUser.photoURL || '',
        teamRole: null,             // Admin sets this manually
        department: 'Engineering',
        weeklyCapacityHours: 40,    // Default: standard 40h week
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    await setDoc(profileRef, newProfile);
    console.log(`[userProfileService] Created profile for ${authUser.email}`);

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
