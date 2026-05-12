/**
 * User Admin Service — Supabase Version
 * =======================================
 * RBAC + user management on `users` table.
 */

import { supabase } from '../supabase';

export function subscribeToRbacUsers(onData) {
    // Initial fetch
    fetchUsers().then(onData);
    const ch = supabase.channel('admin-users')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' },
            () => { fetchUsers().then(onData); })
        .subscribe();
    return () => { supabase.removeChannel(ch); };
}

async function fetchUsers() {
    const { data, error } = await supabase.from('users').select('*').order('display_name');
    if (error) { console.error('[userAdminService.sb]', error.message); return []; }
    return (data || []).map(d => ({
        uid: d.id, role: d.rbac_role || 'viewer', ...mapUser(d),
    }));
}

export function subscribeToUserProfiles(onData) {
    const fetch = async () => {
        const { data } = await supabase.from('users').select('*');
        const map = {};
        (data || []).forEach(d => { map[d.id] = mapUser(d); });
        onData(map);
    };
    fetch();
    const ch = supabase.channel('user-profiles')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetch)
        .subscribe();
    return () => { supabase.removeChannel(ch); };
}

export async function updateRbacRole(uid, newRole) {
    const { error } = await supabase.from('users')
        .update({ rbac_role: newRole }).eq('id', uid);
    if (error) throw new Error(`[userAdminService.sb] ${error.message}`);
}

export async function updateUserDisplayName(uid, displayName) {
    const { error } = await supabase.from('users')
        .update({ display_name: displayName }).eq('id', uid);
    if (error) throw new Error(`[userAdminService.sb] ${error.message}`);
}

export async function removeRbacUser(uid) {
    const { error } = await supabase.from('users').delete().eq('id', uid);
    if (error) throw new Error(`[userAdminService.sb] ${error.message}`);
}

export async function registerOrphanUser(uid, profileData, role = 'viewer') {
    const { error } = await supabase.from('users').upsert({
        id: uid, rbac_role: role,
        email: profileData.email || '', display_name: profileData.displayName || '',
    }, { onConflict: 'id' });
    if (error) throw new Error(`[userAdminService.sb] ${error.message}`);
}

export async function removeOrphanUser(uid) {
    return removeRbacUser(uid);
}

function mapUser(d) {
    return {
        displayName: d.display_name, email: d.email, photoURL: d.photo_url,
        rbacRole: d.rbac_role, teamRole: d.team_role, department: d.department,
        weeklyCapacityHours: d.weekly_capacity_hours, reportsTo: d.reports_to,
        active: d.active, createdAt: d.created_at, updatedAt: d.updated_at,
    };
}
