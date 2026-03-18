import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { ensureUserProfile } from '../services/userProfileService';

const RoleContext = createContext(null);

// ══════════════════════════════════════════════════════════════
// SUPER ADMIN — emails that ALWAYS have admin role.
// If Firestore says otherwise, the role is auto-repaired.
// Add your email(s) here to prevent accidental lockout.
// ══════════════════════════════════════════════════════════════
const SUPER_ADMIN_EMAILS = [
    'caja2506@gmail.com',
];

export function useRole() {
    const context = useContext(RoleContext);
    if (!context) throw new Error('useRole must be used within a RoleProvider');
    return context;
}

export function RoleProvider({ children }) {
    const { user } = useAuth();

    // --- RBAC state (from users_roles) ---
    const [role, setRole] = useState(null);
    const [roleLoading, setRoleLoading] = useState(true);

    // --- Operational profile state (from users/{uid}) ---
    // Bootstrapped on login, null until loaded.
    const [userProfile, setUserProfile] = useState(null);

    // Check if the current user is a super admin by email
    const isSuperAdmin = user?.email && SUPER_ADMIN_EMAILS
        .map(e => e.toLowerCase())
        .includes(user.email.toLowerCase());

    useEffect(() => {
        if (!user) {
            setRole(null);
            setUserProfile(null);
            setRoleLoading(false);
            return;
        }

        setRoleLoading(true);

        // ── V5 (M7): Read rbacRole from users/{uid} as primary source ──
        const userDocRef = doc(db, 'users', user.uid);
        const legacyRoleRef = doc(db, 'users_roles', user.uid);

        const unsubscribe = onSnapshot(userDocRef, async (userSnap) => {
            let resolvedRole = null;

            // 1. Try V5 source: users/{uid}.rbacRole
            if (userSnap.exists() && userSnap.data().rbacRole) {
                resolvedRole = userSnap.data().rbacRole;
            }

            // 2. Fallback: legacy users_roles/{uid}.role
            if (!resolvedRole) {
                try {
                    const { getDoc: getDocFn } = await import('firebase/firestore');
                    const legacySnap = await getDocFn(legacyRoleRef);
                    if (legacySnap.exists()) {
                        resolvedRole = legacySnap.data().role || 'viewer';
                    }
                } catch (err) {
                    console.warn('[RoleContext] Legacy fallback failed:', err);
                }
            }

            // 3. Default for new users
            if (!resolvedRole) {
                resolvedRole = isSuperAdmin ? 'admin' : 'viewer';
            }

            // ── Super Admin Auto-Recovery ──
            if (isSuperAdmin && resolvedRole !== 'admin') {
                console.warn(
                    `🔒 Super Admin auto-recovery: role was "${resolvedRole}", restoring to "admin" for ${user.email}`
                );
                resolvedRole = 'admin';
                // Write to both sources for consistency
                try {
                    await updateDoc(legacyRoleRef, { role: 'admin' });
                } catch { /* legacy doc may not exist */ }
            }

            setRole(resolvedRole);

            // ── Bootstrap users/{uid} operational profile ──
            try {
                const profile = await ensureUserProfile(user, resolvedRole);
                setUserProfile(profile);
            } catch (err) {
                console.error('[RoleContext] Failed to bootstrap user profile:', err);
            }

            setRoleLoading(false);
        });

        return () => unsubscribe();
    }, [user, isSuperAdmin]);

    const isAdmin = role === 'admin';
    const isEditor = role === 'editor';
    const isViewer = role === 'viewer';
    const canEdit = role === 'admin' || role === 'editor';
    const canDelete = role === 'admin';

    const value = {
        // --- RBAC (unchanged API) ---
        role,
        roleLoading,
        isAdmin,
        isEditor,
        isViewer,
        canEdit,
        canDelete,
        isSuperAdmin: !!isSuperAdmin,

        // --- Operational profile (new) ---
        // userProfile: { uid, displayName, email, teamRole, weeklyCapacityHours, ... }
        userProfile,
        teamRole: userProfile?.teamRole || null,
        weeklyCapacityHours: userProfile?.weeklyCapacityHours ?? 40,
    };

    return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

