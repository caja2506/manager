import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useRole } from '../../contexts/RoleContext';
import { COLLECTIONS, TEAM_ROLES } from '../../models/schemas';
import { updateUserProfile } from '../../services/userProfileService';
import { Shield, Trash2, X, Search, Users, ShieldCheck, Pencil, Check } from 'lucide-react';

// ── RBAC roles (admin/editor/viewer) — controls Firestore write permissions ──
const ROLE_CONFIG = {
    admin: { label: 'Admin', color: 'emerald', desc: 'Control total' },
    editor: { label: 'Editor', color: 'amber', desc: 'Editar, no borrar' },
    viewer: { label: 'Viewer', color: 'slate', desc: 'Solo lectura' },
};

// ── Team roles (operational) — controls team function in dashboards/analytics ──
const TEAM_ROLE_CONFIG = {
    [TEAM_ROLES.MANAGER]: { label: 'Manager', color: 'indigo' },
    [TEAM_ROLES.TEAM_LEAD]: { label: 'Team Lead', color: 'violet' },
    [TEAM_ROLES.ENGINEER]: { label: 'Engineer', color: 'sky' },
    [TEAM_ROLES.TECHNICIAN]: { label: 'Technician', color: 'teal' },
};

export default function UserAdminPanel({ onClose }) {
    const { user: currentUser } = useAuth();
    const { isSuperAdmin: currentIsSuperAdmin } = useRole();

    // ── State: RBAC users from users_roles ──
    const [rbacUsers, setRbacUsers] = useState([]);
    // ── State: Operational profiles from users ──
    const [profiles, setProfiles] = useState({});
    const [search, setSearch] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);
    const [editingNameUid, setEditingNameUid] = useState(null);
    const [editingNameValue, setEditingNameValue] = useState('');

    // Subscribe to users_roles (RBAC)
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'users_roles'), (snap) => {
            setRbacUsers(
                snap.docs
                    .map((d) => ({ uid: d.id, ...d.data() }))
                    .sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''))
            );
        });
        return () => unsub();
    }, []);

    // Subscribe to users (operational profiles) — indexed by uid
    useEffect(() => {
        const unsub = onSnapshot(collection(db, COLLECTIONS.USERS), (snap) => {
            const profileMap = {};
            snap.docs.forEach(d => { profileMap[d.id] = d.data(); });
            setProfiles(profileMap);
        });
        return () => unsub();
    }, []);

    // ── V5: Auto-sync REMOVED (O4) ──
    // displayName sync is now handled exclusively by:
    //   - userProfileService.ensureUserProfile() on login
    //   - handleNameSave() on explicit admin edit
    // This eliminates the hidden write side-effect during read operations.

    // Check if a user email is in the super admin list
    const isUserSuperAdmin = (email) => {
        const SUPER_ADMIN_EMAILS = ['caja2506@gmail.com'];
        return email && SUPER_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase());
    };

    // ── RBAC role change → writes to users_roles/{uid} ──
    const handleRoleChange = async (uid, newRole) => {
        const targetUser = rbacUsers.find(u => u.uid === uid);
        if (targetUser && isUserSuperAdmin(targetUser.email)) {
            setConfirmAction({
                title: '🔒 Super Admin Protegido',
                message: 'Este usuario es un Super Admin y su rol no puede ser modificado desde la interfaz.',
                onConfirm: () => setConfirmAction(null),
            });
            return;
        }
        if (uid === currentUser.uid && newRole !== 'admin') {
            setConfirmAction({
                title: '¿Cambiar tu propio rol?',
                message: `Si cambias tu rol a "${newRole}", perderás acceso a este panel de administración.`,
                onConfirm: async () => {
                    await updateDoc(doc(db, 'users_roles', uid), { role: newRole });
                    setConfirmAction(null);
                },
            });
            return;
        }
        await updateDoc(doc(db, 'users_roles', uid), { role: newRole });
    };

    // ── Team role change → writes to users/{uid} ──
    const handleTeamRoleChange = async (uid, newTeamRole) => {
        try {
            await updateUserProfile(uid, { teamRole: newTeamRole || null });
        } catch (err) {
            console.error('Error updating team role:', err);
        }
    };

    // ── Weekly capacity change → writes to users/{uid} ──
    const handleCapacityChange = async (uid, newCapacity) => {
        try {
            await updateUserProfile(uid, { weeklyCapacityHours: Number(newCapacity) || 40 });
        } catch (err) {
            console.error('Error updating capacity:', err);
        }
    };

    // ── Display name change → writes to both users/{uid} AND users_roles/{uid} ──
    const handleNameSave = async (uid) => {
        const trimmed = editingNameValue.trim();
        if (!trimmed) { setEditingNameUid(null); return; }
        try {
            // Use setDoc with merge to handle docs that may not exist
            const usersRef = doc(db, COLLECTIONS.USERS, uid);
            await setDoc(usersRef, { displayName: trimmed, updatedAt: new Date().toISOString() }, { merge: true });
            await updateDoc(doc(db, 'users_roles', uid), { displayName: trimmed });
        } catch (err) {
            console.error('Error updating display name:', err);
        }
        setEditingNameUid(null);
    };

    const handleRemoveUser = (u) => {
        setConfirmAction({
            title: `¿Eliminar a ${u.displayName || u.email}?`,
            message: 'El usuario deberá volver a iniciar sesión para recuperar acceso.',
            onConfirm: async () => {
                await deleteDoc(doc(db, 'users_roles', u.uid));
                setConfirmAction(null);
            },
        });
    };

    const filtered = rbacUsers.filter((u) => {
        const s = search.toLowerCase();
        const profile = profiles[u.uid];
        return (
            !s ||
            (u.displayName || '').toLowerCase().includes(s) ||
            (u.email || '').toLowerCase().includes(s) ||
            (u.role || '').toLowerCase().includes(s) ||
            (profile?.teamRole || '').toLowerCase().includes(s)
        );
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Confirm Dialog */}
            {confirmAction && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-6 max-w-sm w-full">
                        <h3 className="font-black text-lg text-white mb-2">{confirmAction.title}</h3>
                        <p className="text-sm text-slate-500 mb-6">{confirmAction.message}</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setConfirmAction(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-800">
                                Cancelar
                            </button>
                            <button onClick={confirmAction.onConfirm} className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600">
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center">
                        <Users className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="font-black text-2xl text-white tracking-tight">Usuarios</h2>
                        <p className="text-xs text-slate-400 font-bold">{rbacUsers.length} usuarios registrados</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar usuario..."
                            className="w-full pl-9 pr-4 py-3 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        />
                    </div>
                </div>
            </div>

            {/* Role Legend */}
            <div className="flex flex-wrap gap-3 px-1">
                <span className="text-[10px] font-black text-slate-500 uppercase mr-1">RBAC:</span>
                {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                        <span className={`w-2.5 h-2.5 rounded-full bg-${config.color}-500`} />
                        <span className="font-bold text-slate-600">{config.label}</span>
                    </div>
                ))}
                <span className="mx-2 text-slate-700">|</span>
                <span className="text-[10px] font-black text-slate-500 uppercase mr-1">EQUIPO:</span>
                {Object.entries(TEAM_ROLE_CONFIG).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                        <span className={`w-2.5 h-2.5 rounded-full bg-${config.color}-500`} />
                        <span className="font-bold text-slate-600">{config.label}</span>
                    </div>
                ))}
            </div>

            {/* Users Table */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-800 shadow-lg overflow-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0">
                        <tr>
                            <th className="p-5">Usuario</th>
                            <th className="p-5 w-44">Rol RBAC</th>
                            <th className="p-5 w-36">Rol Equipo</th>
                            <th className="p-5 w-24 text-center">Hrs/Sem</th>
                            <th className="p-5 w-20 text-center">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filtered.map((u) => {
                            const isSelf = u.uid === currentUser.uid;
                            const userIsSuperAdmin = isUserSuperAdmin(u.email);
                            const profile = profiles[u.uid] || {};
                            return (
                                <tr key={u.uid} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 text-sm font-bold flex-shrink-0">
                                                {(u.displayName || u.email || '?')[0].toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                {editingNameUid === u.uid ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            value={editingNameValue}
                                                            onChange={(e) => setEditingNameValue(e.target.value)}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') handleNameSave(u.uid); if (e.key === 'Escape') setEditingNameUid(null); }}
                                                            onBlur={() => handleNameSave(u.uid)}
                                                            className="bg-slate-800 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white w-full focus:ring-2 focus:ring-indigo-500/40 focus:outline-none"
                                                            placeholder="Nombre completo"
                                                        />
                                                        <button onClick={() => handleNameSave(u.uid)} className="p-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40">
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 group/name">
                                                        <div className="font-bold text-white text-sm truncate">
                                                            {u.displayName || <span className="text-amber-400 italic">Sin nombre</span>}
                                                            {isSelf && <span className="ml-2 text-[10px] bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded-full font-black">TÚ</span>}
                                                            {userIsSuperAdmin && (
                                                                <span className="ml-2 text-[10px] bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded-full font-black inline-flex items-center gap-0.5">
                                                                    <ShieldCheck className="w-3 h-3" /> SUPER
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => { setEditingNameUid(u.uid); setEditingNameValue(u.displayName || ''); }}
                                                            className="p-1 rounded-lg text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-all"
                                                            title="Editar nombre"
                                                        >
                                                            <Pencil className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    {/* RBAC Role */}
                                    <td className="p-5">
                                        {userIsSuperAdmin ? (
                                            <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black">
                                                <ShieldCheck className="w-4 h-4" />
                                                Admin Protegido
                                            </div>
                                        ) : (
                                            <div className="flex gap-1">
                                                {Object.entries(ROLE_CONFIG).map(([roleKey, config]) => (
                                                    <button
                                                        key={roleKey}
                                                        onClick={() => handleRoleChange(u.uid, roleKey)}
                                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${u.role === roleKey
                                                            ? `bg-${config.color}-100 text-${config.color}-700 border-2 border-${config.color}-300 shadow-sm`
                                                            : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-800'
                                                            }`}
                                                    >
                                                        {config.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    {/* Team Role — writes to users/{uid} */}
                                    <td className="p-5">
                                        <select
                                            value={profile.teamRole || ''}
                                            onChange={(e) => handleTeamRoleChange(u.uid, e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 appearance-none"
                                        >
                                            <option value="">— Sin asignar —</option>
                                            {Object.entries(TEAM_ROLE_CONFIG).map(([key, config]) => (
                                                <option key={key} value={key}>{config.label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    {/* Weekly Capacity — writes to users/{uid} */}
                                    <td className="p-5 text-center">
                                        <input
                                            type="number"
                                            min="0"
                                            max="168"
                                            value={profile.weeklyCapacityHours ?? 40}
                                            onChange={(e) => handleCapacityChange(u.uid, e.target.value)}
                                            className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                                        />
                                    </td>
                                    {/* Delete */}
                                    <td className="p-5 text-center">
                                        {!isSelf && !userIsSuperAdmin && (
                                            <button
                                                onClick={() => handleRemoveUser(u)}
                                                className="p-2 text-red-500 bg-red-500/15 rounded-lg hover:bg-red-100 transition-all active:scale-90"
                                                title="Eliminar usuario"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-slate-400 text-sm">
                                    No se encontraron usuarios
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
