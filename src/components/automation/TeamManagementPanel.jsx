import React, { useState, useEffect, useCallback } from 'react';
import {
    Users, Link2, Unlink, Copy, Check, Loader2,
    RefreshCw, Shield, UserPlus, MessageSquare,
    ChevronDown, Clock, Smartphone
} from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

const functions = getFunctions();

const ROLE_OPTIONS = [
    { value: '', label: 'Sin rol' },
    { value: 'manager', label: 'Manager' },
    { value: 'team_lead', label: 'Team Lead' },
    { value: 'engineer', label: 'Ingeniero' },
    { value: 'technician', label: 'Técnico' },
];

const ROLE_COLORS = {
    manager: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    team_lead: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    engineer: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    technician: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

const ROLE_LABELS = {
    manager: 'Manager',
    team_lead: 'Team Lead',
    engineer: 'Ingeniero',
    technician: 'Técnico',
};

/**
 * TeamManagementPanel — Admin panel for managing team members
 * and Telegram onboarding with link codes.
 */
export default function TeamManagementPanel() {
    const [members, setMembers] = useState([]);
    const [pendingCodes, setPendingCodes] = useState({});
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [copiedCode, setCopiedCode] = useState(null);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [confirmUnlink, setConfirmUnlink] = useState(null);
    const [nameMap, setNameMap] = useState({});

    // Subscribe to users_roles for correct display names (client-side source of truth)
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'users_roles'), (snap) => {
            const map = {};
            snap.docs.forEach(d => {
                const data = d.data();
                if (data.displayName) map[d.id] = data.displayName;
            });
            setNameMap(map);
        });
        return () => unsub();
    }, []);

    // Load team data from Cloud Function
    const loadTeam = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const fn = httpsCallable(functions, 'getTeamMembers');
            const result = await fn();
            setMembers(result.data.members || []);
            setPendingCodes(result.data.pendingCodes || {});
        } catch (err) {
            setError(`Error cargando equipo: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadTeam(); }, [loadTeam]);

    // Resolve name: users_roles displayName > CF displayName > CF name > email
    const resolveName = (member) => nameMap[member.id] || member.displayName || member.name || member.email;

    // Generate link code
    const handleGenerateCode = async (userId) => {
        setActionLoading(userId);
        setError(null);
        try {
            const fn = httpsCallable(functions, 'generateTelegramLinkCode');
            const result = await fn({ userId });
            setPendingCodes(prev => ({
                ...prev,
                [userId]: { code: result.data.code, expiresAt: result.data.expiresAt }
            }));
            showSuccess(`Código generado: ${result.data.code}`);
        } catch (err) {
            setError(`Error: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    // Unlink user — step 1: show confirm, step 2: execute
    const handleUnlinkClick = (userId) => {
        if (confirmUnlink === userId) {
            handleUnlinkConfirmed(userId);
        } else {
            setConfirmUnlink(userId);
            setTimeout(() => setConfirmUnlink(prev => prev === userId ? null : prev), 3000);
        }
    };

    const handleUnlinkConfirmed = async (userId) => {
        setConfirmUnlink(null);
        setActionLoading(userId);
        setError(null);
        try {
            const fn = httpsCallable(functions, 'unlinkTelegramMember');
            await fn({ userId });
            await loadTeam();
            showSuccess('Usuario desvinculado');
        } catch (err) {
            setError(`Error: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    // Update role
    const handleRoleChange = async (userId, newRole) => {
        setActionLoading(userId);
        try {
            const fn = httpsCallable(functions, 'updateTeamMember');
            await fn({ userId, fields: { operationalRole: newRole || null } });
            setMembers(prev => prev.map(m =>
                m.id === userId ? { ...m, operationalRole: newRole || null } : m
            ));
        } catch (err) {
            setError(`Error: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    // Toggle automation participation
    const handleToggleParticipation = async (userId, current) => {
        setActionLoading(userId);
        try {
            const fn = httpsCallable(functions, 'updateTeamMember');
            await fn({ userId, fields: { isAutomationParticipant: !current } });
            setMembers(prev => prev.map(m =>
                m.id === userId ? { ...m, isAutomationParticipant: !current } : m
            ));
        } catch (err) {
            setError(`Error: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    // Copy code to clipboard
    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const showSuccess = (msg) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    };

    // Stats
    const linked = members.filter(m => m.telegramLinked).length;
    const participants = members.filter(m => m.isAutomationParticipant).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                <span className="ml-3 text-sm text-slate-400">Cargando equipo...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header with stats */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2 text-center">
                        <div className="text-lg font-bold text-indigo-300">{members.length}</div>
                        <div className="text-[10px] text-slate-500">Miembros</div>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-center">
                        <div className="text-lg font-bold text-emerald-300">{linked}</div>
                        <div className="text-[10px] text-slate-500">Telegram</div>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-center">
                        <div className="text-lg font-bold text-amber-300">{participants}</div>
                        <div className="text-[10px] text-slate-500">Activos</div>
                    </div>
                </div>
                <button
                    onClick={loadTeam}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar
                </button>
            </div>

            {/* Messages */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 text-xs text-red-400">
                    ❌ {error}
                </div>
            )}
            {successMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 text-xs text-emerald-400">
                    ✅ {successMsg}
                </div>
            )}

            {/* Instructions */}
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
                <h4 className="text-xs font-bold text-indigo-300 mb-2 flex items-center gap-2">
                    <Smartphone className="w-3.5 h-3.5" />
                    Cómo vincular Telegram
                </h4>
                <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
                    <li>Genera un <strong className="text-white">código de enlace</strong> para el usuario</li>
                    <li>Comparte el código con el miembro del equipo</li>
                    <li>El usuario busca el bot en Telegram y escribe <code className="bg-slate-700/60 px-1.5 py-0.5 rounded text-indigo-300">/link CÓDIGO</code></li>
                    <li>El sistema vincula automáticamente ✅</li>
                </ol>
            </div>

            {/* Members table */}
            <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[1fr_120px_100px_160px] gap-2 px-4 py-2 border-b border-slate-700/40 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <div>Miembro</div>
                    <div className="text-center">Rol</div>
                    <div className="text-center">Telegram</div>
                    <div className="text-center">Acciones</div>
                </div>

                {members.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                        No hay miembros en el equipo
                    </div>
                ) : (
                    members.map(member => {
                        const pending = pendingCodes[member.id];
                        const isLoading = actionLoading === member.id;

                        return (
                            <div
                                key={member.id}
                                className="grid grid-cols-[1fr_120px_100px_160px] gap-2 px-4 py-3 border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors items-center"
                            >
                                {/* Name & email */}
                                <div>
                                    <div className="text-sm font-medium text-white flex items-center gap-2">
                                        {resolveName(member)}
                                        {member.isAutomationParticipant && (
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" title="Participant" />
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-500">{member.email}</div>
                                </div>

                                {/* Role dropdown */}
                                <div className="text-center">
                                    <select
                                        value={member.operationalRole || ''}
                                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                        disabled={isLoading}
                                        className="bg-slate-900/60 border border-slate-600/30 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500/50 w-full"
                                    >
                                        {ROLE_OPTIONS.map(r => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Telegram status */}
                                <div className="text-center">
                                    {member.telegramLinked ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                                            <MessageSquare className="w-3 h-3" />
                                            Vinculado
                                        </span>
                                    ) : pending ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-center gap-1">
                                                <span className="font-mono text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5">
                                                    {pending.code}
                                                </span>
                                                <button
                                                    onClick={() => handleCopyCode(pending.code)}
                                                    className="p-1 hover:bg-slate-600/50 rounded transition-colors"
                                                    title="Copiar código"
                                                >
                                                    {copiedCode === pending.code
                                                        ? <Check className="w-3 h-3 text-emerald-400" />
                                                        : <Copy className="w-3 h-3 text-slate-400" />
                                                    }
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-center gap-1 text-[9px] text-slate-500">
                                                <Clock className="w-2.5 h-2.5" />
                                                {formatExpiry(pending.expiresAt)}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-600/30 text-slate-400 text-[10px]">
                                            Sin vincular
                                        </span>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-center gap-1">
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                                    ) : member.telegramLinked ? (
                                        <button
                                            onClick={() => handleUnlinkClick(member.id)}
                                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors border ${confirmUnlink === member.id
                                                ? 'bg-red-500/30 hover:bg-red-500/40 text-white border-red-500/50 animate-pulse'
                                                : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                                                }`}
                                            title={confirmUnlink === member.id ? 'Clic para confirmar' : 'Desvincular Telegram'}
                                        >
                                            <Unlink className="w-3 h-3" />
                                            {confirmUnlink === member.id ? '¿Seguro?' : 'Desvincular'}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleGenerateCode(member.id)}
                                            className="flex items-center gap-1 px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-lg text-[10px] font-medium transition-colors border border-indigo-500/20"
                                            title="Generar código de enlace"
                                        >
                                            <Link2 className="w-3 h-3" />
                                            Generar Código
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleToggleParticipation(member.id, member.isAutomationParticipant)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors border ${member.isAutomationParticipant
                                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                                            : 'bg-slate-600/20 hover:bg-slate-600/40 text-slate-400 border-slate-600/30'
                                            }`}
                                        title={member.isAutomationParticipant ? 'Desactivar participación' : 'Activar participación'}
                                    >
                                        <Shield className="w-3 h-3" />
                                        {member.isAutomationParticipant ? 'Activo' : 'Inactivo'}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ── Helpers ──
function formatExpiry(dateStr) {
    const exp = new Date(dateStr);
    const now = new Date();
    const diff = exp.getTime() - now.getTime();
    if (diff <= 0) return 'Expirado';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m restantes`;
    return `${mins}m restantes`;
}
