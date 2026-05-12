/**
 * User Profile Service — Supabase Version
 * =========================================
 * Bootstrap & sync for `users` table.
 */

import { supabase } from '../supabase';
import { TEAM_ROLES } from '../models/schemas';

const VALID_TEAM_ROLES = Object.values(TEAM_ROLES);

export async function ensureUserProfile(authUser) {
    if (!authUser?.uid) return null;
    const { data: existing, error } = await supabase
        .from('users').select('*').eq('id', authUser.uid).single();
    const bestName = authUser.displayName || '';

    if (existing && !error) {
        if (bestName && bestName !== (existing.display_name || '')) {
            await supabase.from('users').update({ display_name: bestName }).eq('id', authUser.uid);
            return { uid: authUser.uid, ...mapUser({ ...existing, display_name: bestName }) };
        }
        return { uid: authUser.uid, ...mapUser(existing) };
    }

    const row = {
        id: authUser.uid, display_name: bestName, email: authUser.email || '',
        photo_url: authUser.photoURL || '', team_role: null, department: 'Engineering',
        weekly_capacity_hours: 40, active: true, created_by: authUser.uid,
    };
    const { error: ie } = await supabase.from('users').insert(row);
    if (ie) { console.error('[userProfileService.sb]', ie.message); return null; }
    return { uid: authUser.uid, ...mapUser(row) };
}

export async function updateUserProfile(uid, data) {
    if (!uid) throw new Error('uid is required');
    if (data.teamRole && !VALID_TEAM_ROLES.includes(data.teamRole))
        throw new Error(`Invalid teamRole: "${data.teamRole}"`);

    const u = {};
    if (data.teamRole !== undefined) u.team_role = data.teamRole;
    if (data.weeklyCapacityHours !== undefined) u.weekly_capacity_hours = Number(data.weeklyCapacityHours);
    if (data.department !== undefined) u.department = data.department;
    if (data.displayName !== undefined) u.display_name = data.displayName;
    if (data.reportsTo !== undefined) u.reports_to = data.reportsTo;
    if (data.active !== undefined) u.active = data.active;

    const { error } = await supabase.from('users').update(u).eq('id', uid);
    if (error) throw new Error(`[userProfileService.sb] ${error.message}`);
}

function mapUser(u) {
    return {
        displayName: u.display_name, email: u.email, photoURL: u.photo_url,
        rbacRole: u.rbac_role, teamRole: u.team_role, department: u.department,
        weeklyCapacityHours: u.weekly_capacity_hours, reportsTo: u.reports_to,
        active: u.active, createdAt: u.created_at, updatedAt: u.updated_at,
    };
}
