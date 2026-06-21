import React, { useState, useEffect, useCallback } from 'react';
import {
    Users, Link2, Unlink, Copy, Check, Loader2,
    RefreshCw, Shield, UserPlus, MessageSquare,
    ChevronDown, Clock, Smartphone, ArrowRight, AlertTriangle
} from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { subscribeToRbacUsers } from '../../services/userAdminService';
import {
    getActiveAssignments,
    createInitialAssignment,
    reassignTechnician,
} from '../../services/resourceAssignmentService';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabase';

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
        <div className="space-y-6">
            {/* Header with stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-2xl font-black text-indigo-600 leading-none">{members.length}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Miembros Totales</span>
                    </div>
                    <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
                    <div className="flex flex-col">
                        <span className="text-2xl font-black text-emerald-500 leading-none">{linked}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Telegram Activo</span>
                    </div>
                    <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
                    <div className="flex flex-col">
                        <span className="text-2xl font-black text-amber-500 leading-none">{participants}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Automatizados</span>
                    </div>
                </div>
                <button
                    onClick={loadTeam}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition-colors w-full sm:w-auto"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar
                </button>
            </div>

            {/* Messages */}
            {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 shadow-sm">
                    <Shield className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{error}</span>
                </div>
            )}
            {successMsg && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-600 shadow-sm">
                    <Check className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{successMsg}</span>
                </div>
            )}

            {/* Instructions */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5 shadow-sm">
                <h4 className="text-sm font-black text-indigo-800 mb-3 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-indigo-500" />
                    Vincular cuenta de Telegram
                </h4>
                <div className="flex flex-col md:flex-row md:items-center gap-4 text-xs text-indigo-900/80">
                    <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold">1</span>
                        Genera un código de enlace para el usuario
                    </div>
                    <ChevronDown className="w-4 h-4 text-indigo-300 hidden md:block -rotate-90" />
                    <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold">2</span>
                        El usuario abre el bot y escribe <code className="bg-white/60 px-1.5 py-0.5 rounded-md font-bold text-indigo-600">/link CÓDIGO</code>
                    </div>
                    <ChevronDown className="w-4 h-4 text-indigo-300 hidden md:block -rotate-90" />
                    <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center font-bold">3</span>
                        <span className="text-emerald-700 font-bold">¡Vinculado automáticamente!</span>
                    </div>
                </div>
            </div>

            {/* Members Cards List */}
            <div className="space-y-3">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2 px-1">Directorio del Equipo</h3>
                
                {members.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500 shadow-sm">
                        No hay miembros en el equipo
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {members.map(member => {
                            const pending = pendingCodes[member.id];
                            const isLoading = actionLoading === member.id;
                            const name = resolveName(member);
                            const initial = name ? name.charAt(0).toUpperCase() : '?';

                            return (
                                <div key={member.id} className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md rounded-2xl p-4 transition-all duration-200 flex flex-col gap-4 relative overflow-hidden group">
                                    {/* Loading Overlay */}
                                    {isLoading && (
                                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                                            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                                        </div>
                                    )}

                                    {/* Card Header: Avatar & Info */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-black text-lg shadow-inner">
                                                {initial}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                                    {name}
                                                    {member.isAutomationParticipant && (
                                                        <Shield className="w-3.5 h-3.5 text-emerald-500" title="Participante de Automatización" />
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 truncate max-w-[180px]">{member.email}</div>
                                            </div>
                                        </div>
                                        
                                        {/* Status Badge */}
                                        <div>
                                            {member.telegramLinked ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100 shadow-sm">
                                                    <MessageSquare className="w-3 h-3" /> Vinculado
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200 shadow-sm">
                                                    Sin vincular
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Controls */}
                                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100 mt-auto">
                                        {/* Role Selector */}
                                        <select
                                            value={member.operationalRole || ''}
                                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 flex-1 hover:bg-slate-100 cursor-pointer transition-colors"
                                        >
                                            {ROLE_OPTIONS.map(r => (
                                                <option key={r.value} value={r.value}>{r.label}</option>
                                            ))}
                                        </select>

                                        {/* Action Buttons */}
                                        <div className="flex gap-1.5 shrink-0">
                                            {member.telegramLinked ? (
                                                <button
                                                    onClick={() => handleUnlinkClick(member.id)}
                                                    className={`p-1.5 rounded-lg transition-colors border ${confirmUnlink === member.id
                                                        ? 'bg-red-500 text-white border-red-600 shadow-inner'
                                                        : 'bg-white hover:bg-red-50 text-red-500 border-red-200 hover:border-red-300'
                                                        }`}
                                                    title={confirmUnlink === member.id ? 'Clic para confirmar desvinculación' : 'Desvincular Telegram'}
                                                >
                                                    <Unlink className="w-4 h-4" />
                                                </button>
                                            ) : pending ? (
                                                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg p-1 pr-2">
                                                    <button
                                                        onClick={() => handleCopyCode(pending.code)}
                                                        className="p-1 hover:bg-amber-100 rounded text-amber-700 transition-colors"
                                                        title="Copiar código"
                                                    >
                                                        {copiedCode === pending.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                    </button>
                                                    <span className="font-mono text-xs font-bold text-amber-700">{pending.code}</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleGenerateCode(member.id)}
                                                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold transition-colors border border-indigo-200"
                                                    title="Generar código de enlace"
                                                >
                                                    <Link2 className="w-3.5 h-3.5" /> Generar
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleToggleParticipation(member.id, member.isAutomationParticipant)}
                                                className={`p-1.5 rounded-lg transition-colors border ${member.isAutomationParticipant
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                                    : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                                                    }`}
                                                title={member.isAutomationParticipant ? 'Desactivar de Automatización' : 'Activar en Automatización'}
                                            >
                                                <Shield className={`w-4 h-4 ${member.isAutomationParticipant ? 'fill-emerald-100' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Engineer → Technician Assignments ── */}
            <EngineerTechAssignments members={members} nameMap={nameMap} showSuccess={showSuccess} setError={setError} />
        </div>
    );
}

// ============================================================
// Supervisor → Technician Assignment Sub-Component
// ============================================================

const SUPERVISOR_ROLES = ['engineer', 'team_lead', 'manager'];
const SUPERVISOR_BADGE = {
    engineer: { label: 'Ingeniero', color: 'cyan' },
    team_lead: { label: 'Team Lead', color: 'blue' },
    manager: { label: 'Manager', color: 'purple' },
};

function EngineerTechAssignments({ members, nameMap, showSuccess, setError }) {
    const { user } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedTech, setSelectedTech] = useState('');
    const [selectedEng, setSelectedEng] = useState('');
    const [reason, setReason] = useState('default');

    const supervisors = members.filter(m => SUPERVISOR_ROLES.includes(m.operationalRole));
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
            // Sync reportsTo on the technician's user document
            try {
                await supabase.from('users').update({ reports_to: selectedEng }).eq('id', selectedTech);
            } catch (syncErr) {
                console.warn('Could not sync reportsTo on user doc:', syncErr);
            }
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

    // Group assignments by supervisor
    const assignmentsBySupervisor = {};
    for (const sup of supervisors) {
        assignmentsBySupervisor[sup.id] = assignments.filter(a => a.engineerId === sup.id);
    }
    const unassigned = technicians.filter(t => !assignments.find(a => a.technicianId === t.id));

    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm mt-8">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    Jerarquía Operativa (Ingenieros & Técnicos)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                    Define qué técnicos reportan a cada supervisor. Esta estructura afecta los análisis de carga y liderazgo.
                </p>
            </div>

            {/* Assignment form */}
            <div className="px-5 py-4 bg-white border-b border-slate-100 shadow-[inset_0_-2px_10px_rgba(0,0,0,0.01)]">
                <div className="flex flex-col md:flex-row items-end gap-3">
                    <div className="flex-1 w-full">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Técnico Asignado</label>
                        <select
                            value={selectedTech}
                            onChange={(e) => setSelectedTech(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors"
                        >
                            <option value="">Seleccionar técnico...</option>
                            {technicians.map(t => (
                                <option key={t.id} value={t.id}>{nameMap[t.id] || t.displayName || t.email}</option>
                            ))}
                        </select>
                    </div>

                    <div className="shrink-0 flex items-center justify-center py-2 hidden md:block">
                        <ArrowRight className="w-5 h-5 text-indigo-300" />
                    </div>

                    <div className="flex-1 w-full">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Reporta a (Supervisor)</label>
                        <select
                            value={selectedEng}
                            onChange={(e) => setSelectedEng(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors"
                        >
                            <option value="">Seleccionar líder...</option>
                            {supervisors.map(s => (
                                <option key={s.id} value={s.id}>{nameMap[s.id] || s.displayName || s.email} ({SUPERVISOR_BADGE[s.operationalRole]?.label})</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-full md:w-40">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Motivo</label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors"
                        >
                            {REASON_OPTIONS.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleAssign}
                        disabled={!selectedTech || !selectedEng || saving}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        Vincular
                    </button>
                </div>
            </div>

            {/* Current assignments visualization */}
            <div className="p-5 bg-slate-50/50">
                {loading ? (
                    <div className="text-center py-8 text-slate-500 text-sm font-medium flex flex-col items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                        Cargando estructura...
                    </div>
                ) : supervisors.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">
                        <div className="bg-amber-50 text-amber-700 inline-block px-4 py-2 rounded-xl font-medium border border-amber-200 shadow-sm">
                            ⚠️ No hay líderes configurados en el directorio. Asigna roles (Ingeniero, Team Lead o Manager) arriba.
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {supervisors.map(sup => {
                            const badge = SUPERVISOR_BADGE[sup.operationalRole] || { label: sup.operationalRole, color: 'slate' };
                            const techAssignments = assignmentsBySupervisor[sup.id] || [];
                            
                            // Transform color string for tailwind classes since dynamic concatenation doesn't work well with JIT
                            let bgClass = "bg-slate-50", borderClass = "border-slate-200", badgeBg = "bg-slate-100", badgeText = "text-slate-700";
                            if (badge.color === 'cyan') { bgClass = 'bg-cyan-50/30'; borderClass = 'border-cyan-200'; badgeBg = 'bg-cyan-100'; badgeText = 'text-cyan-800'; }
                            else if (badge.color === 'blue') { bgClass = 'bg-blue-50/30'; borderClass = 'border-blue-200'; badgeBg = 'bg-blue-100'; badgeText = 'text-blue-800'; }
                            else if (badge.color === 'purple') { bgClass = 'bg-purple-50/30'; borderClass = 'border-purple-200'; badgeBg = 'bg-purple-100'; badgeText = 'text-purple-800'; }

                            return (
                                <div key={sup.id} className={`rounded-2xl border ${borderClass} ${bgClass} p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden`}>
                                    {/* Leader info */}
                                    <div className="flex items-start gap-3 mb-4">
                                        <div className={`w-10 h-10 rounded-full ${badgeBg} flex items-center justify-center font-black ${badgeText}`}>
                                            {resolveName(sup.id).charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-black text-slate-800 truncate">{resolveName(sup.id)}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-md ${badgeBg} ${badgeText} font-bold`}>
                                                    {badge.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Subordinates list */}
                                    <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between">
                                            <span>Equipo a Cargo</span>
                                            <span className="text-slate-500">{techAssignments.length}</span>
                                        </div>
                                        
                                        {techAssignments.length === 0 ? (
                                            <div className="text-xs text-slate-400 italic py-2 text-center">Sin asignaciones</div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {techAssignments.map(a => (
                                                    <div key={a.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors group">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                                            <span className="text-xs font-semibold text-slate-700 truncate">{resolveName(a.technicianId)}</span>
                                                        </div>
                                                        {a.reason && a.reason !== 'default' && (
                                                            <span className="text-[9px] text-indigo-500 font-medium bg-indigo-50 px-1.5 py-0.5 rounded shrink-0 hidden group-hover:block truncate max-w-[80px]">
                                                                {a.reason}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Unassigned technicians */}
                {unassigned.length > 0 && (
                    <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <h4 className="text-xs font-black text-red-700 uppercase tracking-wider">Técnicos sin líder asignado</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {unassigned.map(t => (
                                <span key={t.id} className="text-xs font-bold text-red-700 px-3 py-1.5 rounded-lg bg-white border border-red-200 shadow-sm flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                    {resolveName(t.id)}
                                </span>
                            ))}
                        </div>
                    </div>
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
