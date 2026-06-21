import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { ensureUserProfile } from '../services/userProfileService';
import { supabase } from '../supabase';

const RoleContext = createContext(null);

// ══════════════════════════════════════════════════════════════
// SUPER ADMIN — emails that ALWAYS have admin role.
// If the database says otherwise, the role is auto-repaired.
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

        // ── Supabase path ──
        let cancelled = false;

        (async () => {
            try {
                const { data: userData, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', user.uid)
                    .single();

                if (cancelled) return;

                let resolvedRole = null;

                if (!error && userData?.rbac_role) {
                    resolvedRole = userData.rbac_role;
                }

                // Default for new users
                if (!resolvedRole) {
                    resolvedRole = isSuperAdmin ? 'admin' : 'viewer';

                    // Auto-register
                    try {
                        const createPayload = {
                            id: user.uid,
                            email: user.email || '',
                            display_name: user.displayName || '',
                            created_at: new Date().toISOString(),
                        };
                        if (isSuperAdmin) {
                            createPayload.rbac_role = 'admin';
                        }
                        await supabase.from('users').upsert(createPayload, { onConflict: 'id' });
                        console.log(`[RoleContext] Auto-registered ${user.email} (rbacRole=${isSuperAdmin ? 'admin' : 'not set — viewer default'})`);
                    } catch (err) {
                        console.warn('[RoleContext] Failed to auto-register:', err);
                    }
                }

                // Super Admin Auto-Recovery
                if (isSuperAdmin && resolvedRole !== 'admin') {
                    console.warn(`🔒 Super Admin auto-recovery: role was "${resolvedRole}", restoring to "admin" for ${user.email}`);
                    resolvedRole = 'admin';
                    await supabase.from('users').update({ rbac_role: 'admin' }).eq('id', user.uid);
                }

                setRole(resolvedRole);

                // Bootstrap user profile
                try {
                    const profile = await ensureUserProfile(user);
                    setUserProfile(profile);
                } catch (err) {
                    console.error('[RoleContext] Failed to bootstrap user profile:', err);
                }

                setRoleLoading(false);
            } catch (err) {
                console.error('[RoleContext] Supabase error:', err);
                setRole(isSuperAdmin ? 'admin' : 'viewer');
                setRoleLoading(false);
            }
        })();

        // Supabase Realtime subscription for role changes
        const channel = supabase
            .channel(`role-${user.uid}-${Date.now()}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.uid}` },
                (payload) => {
                    const newRole = payload.new?.rbac_role;
                    if (newRole && newRole !== role) {
                        console.log(`[RoleContext] Role updated via Realtime: ${newRole}`);
                        setRole(isSuperAdmin && newRole !== 'admin' ? 'admin' : newRole);
                    }
                }
            )
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }, [user, isSuperAdmin]);

    const isAdmin = role === 'admin';
    const isEditor = role === 'editor';
    const isViewer = role === 'viewer';
    const canEdit = role === 'admin' || role === 'editor';
    const canDelete = role === 'admin' || role === 'editor';
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
