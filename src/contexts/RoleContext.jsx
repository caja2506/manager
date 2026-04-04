import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
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

        // ── Role resolution: users_roles is authoritative (Firestore rules use it) ──
        // Read users_roles FIRST, then users/{uid}.rbacRole as fallback.
        // This guarantees the frontend permission checks match security rules.
        const userDocRef = doc(db, 'users', user.uid);
        const legacyRoleRef = doc(db, 'users_roles', user.uid);

        const unsubscribe = onSnapshot(legacyRoleRef, async (legacySnap) => {
            let resolvedRole = null;

            // 1. Primary source: users_roles/{uid}.role (used by Firestore security rules)
            if (legacySnap.exists() && legacySnap.data().role) {
                resolvedRole = legacySnap.data().role;
            }

            // 2. Fallback: users/{uid}.rbacRole (V5 profile)
            if (!resolvedRole) {
                try {
                    const { getDoc: getDocFn } = await import('firebase/firestore');
                    const userSnap = await getDocFn(userDocRef);
                    if (userSnap.exists() && userSnap.data().rbacRole) {
                        resolvedRole = userSnap.data().rbacRole;
                    }
                } catch (err) {
                    console.warn('[RoleContext] V5 profile fallback failed:', err);
                }
            }

            // 3. Default for new users — AND auto-create users_roles doc
            if (!resolvedRole) {
                resolvedRole = isSuperAdmin ? 'admin' : 'viewer';

                // ── Auto-register: create users_roles/{uid} so the user
                //    appears in Settings → Admin Panel for role assignment ──
                try {
                    await setDoc(legacyRoleRef, {
                        role: resolvedRole,
                        email: user.email || '',
                        displayName: user.displayName || '',
                        createdAt: new Date().toISOString(),
                    });
                    console.log(`[RoleContext] Auto-registered ${user.email} in users_roles with role=${resolvedRole}`);
                } catch (err) {
                    console.warn('[RoleContext] Failed to auto-register in users_roles:', err);
                }
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
    // Technicians can edit tasks but NOT modify dates that already have values
    const canEditDates = canEdit && (userProfile?.teamRole !== 'technician');

    const value = {
        // --- RBAC (unchanged API) ---
        role,
        roleLoading,
        isAdmin,
        isEditor,
        isViewer,
        canEdit,
        canEditDates,
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

