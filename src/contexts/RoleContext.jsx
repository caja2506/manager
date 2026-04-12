import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
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

    // --- RBAC state (from users/{uid}.rbacRole) ---
    const [role, setRole] = useState(null);
    const [roleLoading, setRoleLoading] = useState(true);

    // --- Operational profile state (from users/{uid}) ---
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

        // ── Unified: users/{uid} is the single source of truth ──
        // rbacRole lives in the same document as the operational profile.
        // Firestore security rules also read from users/{uid}.rbacRole.
        const userDocRef = doc(db, 'users', user.uid);

        const unsubscribe = onSnapshot(userDocRef, async (userSnap) => {
            let resolvedRole = null;

            // 1. Primary (and only) source: users/{uid}.rbacRole
            if (userSnap.exists() && userSnap.data().rbacRole) {
                resolvedRole = userSnap.data().rbacRole;
            }

            // 2. Default for new users — auto-create users/{uid} doc
            //    SECURITY: Do NOT write rbacRole here. Only admins can set rbacRole.
            //    New users get 'viewer' by default (resolved in-memory, not stored).
            if (!resolvedRole) {
                resolvedRole = isSuperAdmin ? 'admin' : 'viewer';

                // ── Auto-register: create users/{uid} with NON-privileged fields only ──
                try {
                    const createPayload = {
                        email: user.email || '',
                        displayName: user.displayName || '',
                        createdAt: new Date().toISOString(),
                    };
                    // Only super admins can self-assign admin role via frontend
                    if (isSuperAdmin) {
                        createPayload.rbacRole = 'admin';
                    }
                    await setDoc(userDocRef, createPayload, { merge: true });
                    console.log(`[RoleContext] Auto-registered ${user.email} (rbacRole=${isSuperAdmin ? 'admin' : 'not set — viewer default'})`);
                } catch (err) {
                    console.warn('[RoleContext] Failed to auto-register:', err);
                }
            }

            // ── Super Admin Auto-Recovery ──
            if (isSuperAdmin && resolvedRole !== 'admin') {
                console.warn(
                    `🔒 Super Admin auto-recovery: role was "${resolvedRole}", restoring to "admin" for ${user.email}`
                );
                resolvedRole = 'admin';
                try {
                    await setDoc(userDocRef, { rbacRole: 'admin' }, { merge: true });
                } catch { /* safety */ }
            }

            setRole(resolvedRole);

            // ── Bootstrap users/{uid} operational profile ──
            try {
                const profile = await ensureUserProfile(user);
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

        // --- Operational profile ---
        userProfile,
        teamRole: userProfile?.teamRole || null,
        weeklyCapacityHours: userProfile?.weeklyCapacityHours ?? 40,
    };

    return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}
