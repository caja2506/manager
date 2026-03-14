import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useRole } from '../../contexts/RoleContext';
import { Shield, Trash2, X, Search, Users, ShieldCheck } from 'lucide-react';

const ROLE_CONFIG = {
    admin: { label: 'Admin', color: 'emerald', desc: 'Control total' },
    editor: { label: 'Editor', color: 'amber', desc: 'Editar, no borrar' },
    viewer: { label: 'Viewer', color: 'slate', desc: 'Solo lectura' },
};

export default function UserAdminPanel({ onClose }) {
    const { user: currentUser } = useAuth();
    const { isSuperAdmin: currentIsSuperAdmin } = useRole();
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'users_roles'), (snap) => {
            setUsers(
                snap.docs
                    .map((d) => ({ uid: d.id, ...d.data() }))
                    .sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''))
            );
        });
        return () => unsub();
    }, []);

    // Check if a user email is in the super admin list
    const isUserSuperAdmin = (email) => {
        const SUPER_ADMIN_EMAILS = ['caja2506@gmail.com'];
        return email && SUPER_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase());
    };

    const handleRoleChange = async (uid, newRole) => {
        // Prevent changing super admin's role
        const targetUser = users.find(u => u.uid === uid);
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

    const filtered = users.filter((u) => {
        const s = search.toLowerCase();
        return (
            !s ||
            (u.displayName || '').toLowerCase().includes(s) ||
            (u.email || '').toLowerCase().includes(s) ||
            (u.role || '').toLowerCase().includes(s)
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
                        <p className="text-xs text-slate-400 font-bold">{users.length} usuarios registrados</p>
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
                {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                        <span className={`w-2.5 h-2.5 rounded-full bg-${config.color}-500`} />
                        <span className="font-bold text-slate-600">{config.label}</span>
                        <span className="text-slate-400">— {config.desc}</span>
                    </div>
                ))}
            </div>

            {/* Users Table */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-800 shadow-lg overflow-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0">
                        <tr>
                            <th className="p-5">Usuario</th>
                            <th className="p-5 w-48">Rol</th>
                            <th className="p-5 w-36 text-center">Registrado</th>
                            <th className="p-5 w-20 text-center">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filtered.map((u) => {
                            const isSelf = u.uid === currentUser.uid;
                            const userIsSuperAdmin = isUserSuperAdmin(u.email);
                            const roleConfig = ROLE_CONFIG[u.role] || ROLE_CONFIG.viewer;
                            return (
                                <tr key={u.uid} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 text-sm font-bold flex-shrink-0">
                                                {(u.displayName || u.email || '?')[0].toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-white text-sm truncate">
                                                    {u.displayName || 'Sin nombre'}
                                                    {isSelf && <span className="ml-2 text-[10px] bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded-full font-black">TÚ</span>}
                                                    {userIsSuperAdmin && (
                                                        <span className="ml-2 text-[10px] bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded-full font-black inline-flex items-center gap-0.5">
                                                            <ShieldCheck className="w-3 h-3" /> SUPER
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
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
                                    <td className="p-5 text-center">
                                        <span className="text-[11px] text-slate-400 font-bold">
                                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                                        </span>
                                    </td>
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
                                <td colSpan={4} className="p-12 text-center text-slate-400 text-sm">
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
