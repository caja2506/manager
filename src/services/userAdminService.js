/**
 * userAdminService.js
 * ===================
 * [Phase M.2] Firestore operations for user admin panel.
 * Extracted from UserAdminPanel.jsx to remove direct Firestore access.
 */

import {
    collection, onSnapshot, doc, updateDoc, deleteDoc, setDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../models/schemas';

/**
 * Subscribe to RBAC users (users_roles collection).
 * @param {function} onData - callback(users[])
 * @returns {function} unsubscribe
 */
export function subscribeToRbacUsers(onData) {
    return onSnapshot(collection(db, 'users_roles'), (snap) => {
        onData(
            snap.docs
                .map(d => ({ uid: d.id, ...d.data() }))
                .sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''))
        );
    });
}

/**
 * Subscribe to operational user profiles.
 * @param {function} onData - callback(profileMap: {uid: profile})
 * @returns {function} unsubscribe
 */
export function subscribeToUserProfiles(onData) {
    return onSnapshot(collection(db, COLLECTIONS.USERS), (snap) => {
        const profileMap = {};
        snap.docs.forEach(d => { profileMap[d.id] = d.data(); });
        onData(profileMap);
    });
}

/**
 * Update a user's RBAC role.
 * @param {string} uid
 * @param {string} newRole
 */
export async function updateRbacRole(uid, newRole) {
    // Write to legacy RBAC collection (used by Firestore security rules)
    await updateDoc(doc(db, 'users_roles', uid), { role: newRole });

    // Sync to users/{uid}.rbacRole (V5 primary source read by RoleContext)
    // Without this, RoleContext reads the stale rbacRole from users/{uid}
    // and never falls through to the updated users_roles value.
    try {
        await setDoc(
            doc(db, COLLECTIONS.USERS, uid),
            { rbacRole: newRole, updatedAt: new Date().toISOString() },
            { merge: true }
        );
    } catch (err) {
        console.warn('[userAdminService] Failed to sync rbacRole to users/ profile:', err);
    }
}

/**
 * Update a user's display name (in both users and users_roles).
 * @param {string} uid
 * @param {string} displayName
 */
export async function updateUserDisplayName(uid, displayName) {
    const usersRef = doc(db, COLLECTIONS.USERS, uid);
    await setDoc(usersRef, { displayName, updatedAt: new Date().toISOString() }, { merge: true });
    await updateDoc(doc(db, 'users_roles', uid), { displayName });
}

/**
 * Remove a user from RBAC (users_roles collection).
 * @param {string} uid
 */
export async function removeRbacUser(uid) {
    await deleteDoc(doc(db, 'users_roles', uid));
}

/**
 * Register an orphan user (exists in `users` but not in `users_roles`).
 * Creates the `users_roles/{uid}` document so the user appears in the admin panel.
 * @param {string} uid
 * @param {Object} profileData - { email, displayName } from the users collection
 * @param {string} [role='viewer'] - initial RBAC role
 */
export async function registerOrphanUser(uid, profileData, role = 'viewer') {
    await setDoc(doc(db, 'users_roles', uid), {
        role,
        email: profileData.email || '',
        displayName: profileData.displayName || '',
        createdAt: new Date().toISOString(),
    });
}

/**
 * Fully remove an orphan user from the system.
 * Deletes from both `users` and `users_roles` collections.
 * @param {string} uid
 */
export async function removeOrphanUser(uid) {
    // Delete from users collection (profile)
    await deleteDoc(doc(db, COLLECTIONS.USERS, uid));
    // Also delete from users_roles if it exists (safety cleanup)
    try {
        await deleteDoc(doc(db, 'users_roles', uid));
    } catch { /* may not exist */ }
}
