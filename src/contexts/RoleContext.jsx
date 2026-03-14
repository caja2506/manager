import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

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
    const [role, setRole] = useState(null);
    const [roleLoading, setRoleLoading] = useState(true);

    // Check if the current user is a super admin by email
    const isSuperAdmin = user?.email && SUPER_ADMIN_EMAILS
        .map(e => e.toLowerCase())
        .includes(user.email.toLowerCase());

    useEffect(() => {
        if (!user) {
            setRole(null);
            setRoleLoading(false);
            return;
        }

        setRoleLoading(true);
        const userRoleRef = doc(db, 'users_roles', user.uid);

        const unsubscribe = onSnapshot(userRoleRef, async (snap) => {
            if (snap.exists()) {
                const storedRole = snap.data().role || 'viewer';

                // ── Super Admin Auto-Recovery ──
                // If a super admin has been downgraded, auto-repair to 'admin'
                if (isSuperAdmin && storedRole !== 'admin') {
                    console.warn(
                        `🔒 Super Admin auto-recovery: role was "${storedRole}", restoring to "admin" for ${user.email}`
                    );
                    await updateDoc(userRoleRef, { role: 'admin' });
                    setRole('admin');
                } else {
                    setRole(storedRole);
                }
            } else {
                // New user — super admins get 'admin', others get 'viewer'
                const defaultRole = isSuperAdmin ? 'admin' : 'viewer';
                await setDoc(userRoleRef, {
                    email: user.email,
                    displayName: user.displayName || '',
                    photoURL: user.photoURL || '',
                    role: defaultRole,
                    createdAt: new Date().toISOString(),
                });
                setRole(defaultRole);
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
        role,
        roleLoading,
        isAdmin,
        isEditor,
        isViewer,
        canEdit,
        canDelete,
        isSuperAdmin: !!isSuperAdmin,
    };

    return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

