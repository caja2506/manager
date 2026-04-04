import React, { useState, useEffect, useCallback } from 'react';
import {
    Users, Link2, Unlink, Copy, Check, Loader2,
    RefreshCw, Shield, UserPlus, MessageSquare,
    ChevronDown, Clock, Smartphone, ArrowRight
} from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { subscribeToRbacUsers } from '../../services/userAdminService';
import {
    getActiveAssignments,
    createInitialAssignment,
    reassignTechnician,
} from '../../services/resourceAssignmentService';
import { useAuth } from '../../hooks/useAuth';

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

const REASON_OPTIONS = [
    { value: 'default', label: 'Asignación normal' },
    { value: 'préstamo', label: 'Préstamo temporal' },
    { value: 'soporte', label: 'Soporte especializado' },
    { value: 'temporal', label: 'Cobertura temporal' },
];

/**
 * TeamManagementPanel — Admin panel for managing team members,
 * Telegram onboarding, and engineer→technician assignments.
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

    useEffect(() => {
        const unsub = subscribeToRbacUsers((users) => {
            const map = {};
            users.forEach(u => {
                if (u.displayName) map[u.uid] = u.displayName;
            });
            setNameMap(map);
        });
        return () => unsub();
    }, []);

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

    const resolveName = (member) => nameMap[member.id] || member.displayName || member.name || member.email;

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

    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const showSuccess = (msg) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    };

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

            {/* ── Engineer → Technician Assignments ── */}
            <EngineerTechAssignments members={members} nameMap={nameMap} showSuccess={showSuccess} setError={setError} />
        </div>
    );
}

// ============================================================
// Engineer → Technician Assignment Sub-Component
// ============================================================

function EngineerTechAssignments({ members, nameMap, showSuccess, setError }) {
    const { user } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedTech, setSelectedTech] = useState('');
    const [selectedEng, setSelectedEng] = useState('');
    const [reason, setReason] = useState('default');

    const engineers = members.filter(m => m.operationalRole === 'engineer');
    const technicians = members.filter(m => m.operationalRole === 'technician');

    const resolveName = (id) => {
        const found = members.find(m => m.id === id);
        return nameMap[id] || found?.displayName || found?.name || found?.email || id?.slice(0, 8);
    };

    const loadAssignments = useCallback(async () => {
        try {
            setLoading(true);
            const active = await getActiveAssignments();
            setAssignments(active);
        } catch (err) {
            console.error('Error loading assignments:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadAssignments(); }, [loadAssignments]);

    const handleAssign = async () => {
        if (!selectedTech || !selectedEng) return;
        setSaving(true);
        try {
            const existing = assignments.find(a => a.technicianId === selectedTech);
            if (existing) {
                await reassignTechnician(selectedTech, selectedEng, reason, user?.uid);
            } else {
                await createInitialAssignment(selectedTech, selectedEng, user?.uid);
            }
            showSuccess(`${resolveName(selectedTech)} asignado a ${resolveName(selectedEng)}`);
            setSelectedTech('');
            setSelectedEng('');
            setReason('default');
            await loadAssignments();
        } catch (err) {
            setError(`Error en asignación: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    // Group assignments by engineer
    const assignmentsByEngineer = {};
    for (const eng of engineers) {
        assignmentsByEngineer[eng.id] = assignments.filter(a => a.engineerId === eng.id);
    }
    const unassigned = technicians.filter(t => !assignments.find(a => a.technicianId === t.id));

    return (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700/40">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    Asignaciones Ingeniero → Técnico
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                    Define qué técnicos reportan a cada ingeniero. Esto afecta el score de Liderazgo del ingeniero.
                </p>
            </div>

            {/* Assignment form */}
            <div className="px-4 py-3 bg-slate-900/30 border-b border-slate-700/30">
                <div className="flex items-end gap-2 flex-wrap">
                    <div className="flex-1 min-w-[140px]">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Técnico</label>
                        <select
                            value={selectedTech}
                            onChange={(e) => setSelectedTech(e.target.value)}
                            className="w-full bg-slate-900/60 border border-slate-600/30 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                        >
                            <option value="">Seleccionar técnico...</option>
                            {technicians.map(t => (
                                <option key={t.id} value={t.id}>{nameMap[t.id] || t.displayName || t.email}</option>
                            ))}
                        </select>
                    </div>

                    <div className="shrink-0 flex items-center justify-center py-1.5">
                        <ArrowRight className="w-4 h-4 text-cyan-400" />
                    </div>

                    <div className="flex-1 min-w-[140px]">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Ingeniero</label>
                        <select
                            value={selectedEng}
                            onChange={(e) => setSelectedEng(e.target.value)}
                            className="w-full bg-slate-900/60 border border-slate-600/30 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                        >
                            <option value="">Seleccionar ingeniero...</option>
                            {engineers.map(e => (
                                <option key={e.id} value={e.id}>{nameMap[e.id] || e.displayName || e.email}</option>
                            ))}
                        </select>
                    </div>

                    <div className="min-w-[120px]">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Motivo</label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full bg-slate-900/60 border border-slate-600/30 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                        >
                            {REASON_OPTIONS.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleAssign}
                        disabled={!selectedTech || !selectedEng || saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg text-xs font-bold transition-colors border border-cyan-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                        Asignar
                    </button>
                </div>
            </div>

            {/* Current assignments visualization */}
            <div className="p-4 space-y-3">
                {loading ? (
                    <div className="text-center py-4 text-slate-500 text-xs flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Cargando asignaciones...
                    </div>
                ) : engineers.length === 0 ? (
                    <div className="text-center py-4 text-amber-400/60 text-xs">
                        ⚠️ No hay ingenieros configurados. Asigna el rol &quot;Ingeniero&quot; a los miembros del equipo primero.
                    </div>
                ) : (
                    <>
                        {engineers.map(eng => {
                            const techAssignments = assignmentsByEngineer[eng.id] || [];
                            return (
                                <div key={eng.id} className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                                            Ingeniero
                                        </span>
                                        <span className="text-sm font-semibold text-white">{resolveName(eng.id)}</span>
                                        <span className="text-[10px] text-slate-500 ml-auto">
                                            {techAssignments.length} técnico{techAssignments.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    {techAssignments.length === 0 ? (
                                        <div className="text-[10px] text-slate-500 italic pl-4">Sin técnicos asignados</div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2 pl-4">
                                            {techAssignments.map(a => (
                                                <div key={a.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                    <span className="text-xs text-amber-200 font-medium">{resolveName(a.technicianId)}</span>
                                                    {a.reason && a.reason !== 'default' && (
                                                        <span className="text-[9px] text-slate-500 italic">({a.reason})</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Unassigned technicians */}
                        {unassigned.length > 0 && (
                            <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-3">
                                <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1.5">
                                    ⚠ Técnicos sin asignar
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {unassigned.map(t => (
                                        <span key={t.id} className="text-xs text-red-300 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
                                            {resolveName(t.id)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
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
