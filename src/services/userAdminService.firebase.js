/**
 * userAdminService.js
 * ===================
 * [Phase V5] Firestore operations for user admin panel.
 * 
 * UNIFIED MODEL: users/{uid} is the single source of truth for RBAC.
 * The `users_roles` collection is frozen (read-only, no new writes).
 * 
 * All RBAC mutations go to users/{uid}.rbacRole.
 */

import {
    collection, onSnapshot, doc, setDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../models/schemas';

/**
 * Subscribe to user profiles (unified RBAC + operational data).
 * This replaces the old subscribeToRbacUsers which read from users_roles.
 * @param {function} onData - callback(users[])
 * @returns {function} unsubscribe
 */
export function subscribeToRbacUsers(onData) {
    return onSnapshot(collection(db, COLLECTIONS.USERS), (snap) => {
        onData(
            snap.docs
                .map(d => ({
                    uid: d.id,
                    role: d.data().rbacRole || 'viewer', // map rbacRole → role for backward compat
                    ...d.data(),
                }))
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
 * Single write to users/{uid}.rbacRole — the only source of truth.
 * @param {string} uid
 * @param {string} newRole
 */
export async function updateRbacRole(uid, newRole) {
    await setDoc(
        doc(db, COLLECTIONS.USERS, uid),
        { rbacRole: newRole, updatedAt: new Date().toISOString() },
        { merge: true }
    );
}

/**
 * Update a user's display name.
 * @param {string} uid
 * @param {string} displayName
 */
export async function updateUserDisplayName(uid, displayName) {
    await setDoc(
        doc(db, COLLECTIONS.USERS, uid),
        { displayName, updatedAt: new Date().toISOString() },
        { merge: true }
    );
}

/**
 * Remove a user from the system.
 * @param {string} uid
 */
export async function removeRbacUser(uid) {
    await deleteDoc(doc(db, COLLECTIONS.USERS, uid));
}

/**
 * Register an orphan user (ensure they have rbacRole in users/{uid}).
 * @param {string} uid
 * @param {Object} profileData - { email, displayName }
 * @param {string} [role='viewer'] - initial RBAC role
 */
export async function registerOrphanUser(uid, profileData, role = 'viewer') {
    await setDoc(doc(db, COLLECTIONS.USERS, uid), {
        rbacRole: role,
        email: profileData.email || '',
        displayName: profileData.displayName || '',
        createdAt: new Date().toISOString(),
    }, { merge: true });
}

/**
 * Fully remove an orphan user from the system.
 * @param {string} uid
 */
export async function removeOrphanUser(uid) {
    await deleteDoc(doc(db, COLLECTIONS.USERS, uid));
}
