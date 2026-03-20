/**
 * DailyScrumPage — Equipo Hoy
 * ============================
 * Operational daily view of the engineering team.
 * 
 * Shows per-person: status, tasks today/yesterday, blockers, responsible engineer.
 * Quick action: reassign operational responsibility.
 * 
 * Does NOT modify tasks. Does NOT act as a planner.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Users, AlertTriangle, CheckCircle2, Clock, Shield,
    Repeat2, ChevronDown, ChevronUp, X, ArrowRightLeft,
    ListTodo, CalendarCheck, UserCheck, RefreshCw, Activity,
    Briefcase, Eye
} from 'lucide-react';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useAuth } from '../contexts/AuthContext';
import {
    getActiveAssignments,
    reassignTechnician,
} from '../services/resourceAssignmentService';
import {
    buildDailyScrumData,
    buildSummary,
    STATUS_CONFIG,
    PERSON_STATUS,
} from '../core/dailyScrum/dailyScrumEngine';

// ─── Role config (match Team page) ───
const ROLE_CONFIG = {
    manager: { label: 'Manager', gradient: 'from-violet-500 to-purple-600', badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
    team_lead: { label: 'Team Lead', gradient: 'from-indigo-500 to-blue-600', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
    engineer: { label: 'Ingeniero', gradient: 'from-cyan-500 to-teal-600', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    technician: { label: 'Técnico', gradient: 'from-emerald-500 to-green-600', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    admin: { label: 'Admin', gradient: 'from-rose-500 to-pink-600', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    editor: { label: 'Editor', gradient: 'from-amber-500 to-orange-600', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
};
const DEFAULT_ROLE = { label: 'Sin rol', gradient: 'from-slate-500 to-slate-600', badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };

// ─── Summary Card ───
function SummaryCard({ icon: Icon, label, value, color, alert }) {
    return (
        <div className={`bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 ${alert ? 'border-rose-500/40 bg-rose-500/5' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 text-${color}-400`} />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</span>
            </div>
            <p className={`text-2xl font-black ${alert ? 'text-rose-400' : 'text-white'}`}>{value}</p>
        </div>
    );
}

// ─── Task Pill ───
function TaskPill({ task }) {
    const statusColors = {
        in_progress: 'bg-blue-500', backlog: 'bg-slate-500',
        blocked: 'bg-red-500', review: 'bg-purple-500', completed: 'bg-emerald-500',
    };
    const dotClass = statusColors[task.status] || 'bg-slate-500';

    return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/80 border border-slate-700/40 rounded-md text-[10px] text-slate-300">
            <div className={`w-1.5 h-1.5 rounded-full ${dotClass} flex-shrink-0`} />
            <span className="truncate max-w-[160px]">{task.title || 'Sin título'}</span>
        </div>
    );
}

// ─── Reassignment Modal ───
function ReassignModal({ person, engineers, onConfirm, onClose }) {
    const [selectedEngineer, setSelectedEngineer] = useState('');
    const [reason, setReason] = useState('default');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!selectedEngineer) return;
        setSaving(true);
        await onConfirm(person.uid, selectedEngineer, reason);
        setSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div onClick={e => e.stopPropagation()} className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 w-[420px] max-w-[92vw] shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                            <ArrowRightLeft size={18} className="text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">Reasignar Responsable</h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">{person.displayName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1"><X size={18} /></button>
                </div>

                {/* Engineer */}
                <div className="mb-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nuevo ingeniero responsable</label>
                    <select value={selectedEngineer} onChange={e => setSelectedEngineer(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Seleccionar...</option>
                        {engineers.map(eng => (
                            <option key={eng.uid || eng.id} value={eng.uid || eng.id}>
                                {eng.displayName || eng.email}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Reason */}
                <div className="mb-5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Razón</label>
                    <select value={reason} onChange={e => setReason(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="default">Asignación regular</option>
                        <option value="préstamo">Préstamo temporal</option>
                        <option value="soporte">Soporte a otro equipo</option>
                        <option value="temporal">Cobertura temporal</option>
                    </select>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-400 hover:text-slate-200 font-medium">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={!selectedEngineer || saving}
                        className={`px-5 py-2 rounded-lg text-sm font-bold text-white transition-all ${
                            selectedEngineer ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/30' : 'bg-slate-700 cursor-not-allowed'
                        } ${saving ? 'opacity-60' : ''}`}>
                        {saving ? 'Guardando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Person Card ───
function PersonCard({ person, teamMembers, onReassign }) {
    const cfg = person.statusConfig;
    const roleConfig = ROLE_CONFIG[person.role] || DEFAULT_ROLE;

    const engineerName = useMemo(() => {
        if (!person.engineerId) return null;
        const eng = teamMembers.find(m => (m.uid || m.id) === person.engineerId);
        return eng ? (eng.displayName || eng.email) : null;
    }, [person.engineerId, teamMembers]);

    const initials = (person.displayName || '?')
        .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    // Status border left accent
    const statusBorder = {
        [PERSON_STATUS.OK]: 'border-l-emerald-500',
        [PERSON_STATUS.NO_TASKS]: 'border-l-amber-500',
        [PERSON_STATUS.NO_REPORT]: 'border-l-red-500',
        [PERSON_STATUS.BLOCKED]: 'border-l-red-500',
        [PERSON_STATUS.NO_PLAN]: 'border-l-orange-500',
    };

    return (
        <div className={`bg-slate-800/70 border border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-600/60 transition-all group border-l-[3px] ${statusBorder[person.status] || 'border-l-slate-600'}`}>
            {/* Header */}
            <div className="p-4 flex items-center gap-3">
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleConfig.gradient} flex items-center justify-center text-white font-black text-sm shadow-lg flex-shrink-0`}>
                    {initials}
                </div>

                {/* Name + role + engineer */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">{person.displayName}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${roleConfig.badge}`}>
                            {roleConfig.label}
                        </span>
                    </div>
                    {engineerName && (
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <UserCheck className="w-2.5 h-2.5" /> Resp: {engineerName}
                        </div>
                    )}
                </div>

                {/* Status pill */}
                <div className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center gap-1"
                    style={{ background: cfg.bgColor, border: `1px solid ${cfg.borderColor}`, color: cfg.color }}>
                    <span>{cfg.emoji}</span>
                    <span className="hidden sm:inline">{cfg.label}</span>
                </div>

                {/* Tasks count */}
                <div className="flex items-center gap-1 text-slate-500 text-xs">
                    <ListTodo className="w-3.5 h-3.5" />
                    <span className="font-bold">{person.todayTasks.length}</span>
                </div>

            </div>

            {/* Detail */}
                <div className="border-t border-slate-700/40 px-4 pb-4 pt-3 space-y-3">
                    {/* Yesterday */}
                    <div>
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            <CalendarCheck className="w-3 h-3" /> Ayer
                            {person.yesterdayEvidence.hasEvidence && (
                                <span className="text-emerald-400 normal-case tracking-normal font-bold ml-1">
                                    {person.yesterdayEvidence.totalHours.toFixed(1)}h
                                </span>
                            )}
                        </div>
                        {person.yesterdayEvidence.hasEvidence ? (
                            <div className="flex flex-wrap gap-1">
                                {person.yesterdayEvidence.tasks.slice(0, 4).map(t => (
                                    <TaskPill key={t.id} task={t} />
                                ))}
                                {person.yesterdayEvidence.tasks.length > 4 && (
                                    <span className="text-[10px] text-slate-600 px-2 py-1">
                                        +{person.yesterdayEvidence.tasks.length - 4} más
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="px-2.5 py-1.5 bg-red-500/8 border border-red-500/20 rounded-lg text-[11px] text-red-400 font-medium">
                                ⚠ Sin evidencia de trabajo ayer
                            </div>
                        )}
                    </div>

                    {/* Today */}
                    <div>
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            <ListTodo className="w-3 h-3" /> Hoy
                            <span className="text-slate-400 normal-case tracking-normal font-bold">
                                ({person.todayTasks.length} tarea{person.todayTasks.length !== 1 ? 's' : ''})
                            </span>
                        </div>
                        {person.todayTasks.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                                {person.todayTasks.slice(0, 6).map(t => (
                                    <TaskPill key={t.id} task={t} />
                                ))}
                                {person.todayTasks.length > 6 && (
                                    <span className="text-[10px] text-slate-600 px-2 py-1">
                                        +{person.todayTasks.length - 6} más
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="px-2.5 py-1.5 bg-amber-500/8 border border-amber-500/20 rounded-lg text-[11px] text-amber-400 font-medium">
                                🟡 Sin tareas activas para hoy
                            </div>
                        )}
                    </div>

                    {/* Blockers */}
                    {person.blockers.length > 0 && (
                        <div>
                            <div className="flex items-center gap-1.5 text-[9px] font-black text-red-400 uppercase tracking-widest mb-2">
                                <Shield className="w-3 h-3" /> Bloqueos ({person.blockers.length})
                            </div>
                            <div className="space-y-1">
                                {person.blockers.map(b => (
                                    <div key={b.id} className="px-2.5 py-1.5 bg-red-500/8 border border-red-500/15 rounded-lg text-[10px] text-red-300">
                                        {b.causeName || b.comment || 'Bloqueo sin detalle'}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reassign action — solo técnicos */}
                    {person.role === 'technician' && (
                    <div className="flex justify-end pt-1">
                        <button
                            onClick={() => onReassign(person)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold hover:bg-indigo-500/20 transition-colors"
                        >
                            <Repeat2 className="w-3 h-3" />
                            Reasignar →
                        </button>
                    </div>
                    )}
                </div>
        </div>
    );
}

// ─── Main Page ───
export default function DailyScrumPage() {
    const { engTasks, teamMembers, timeLogs, delays } = useEngineeringData();
    const { user } = useAuth();
    const userId = user?.uid;

    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reassigning, setReassigning] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Load assignments
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await getActiveAssignments();
                if (!cancelled) setAssignments(data);
            } catch (err) {
                console.error('DailyScrum: error loading assignments:', err);
            }
            if (!cancelled) setLoading(false);
        };
        load();
        return () => { cancelled = true; };
    }, [refreshKey]);

    // Build scrum data
    const scrumData = useMemo(() => {
        if (loading) return [];
        return buildDailyScrumData(teamMembers, engTasks, timeLogs, delays, assignments);
    }, [teamMembers, engTasks, timeLogs, delays, assignments, loading]);

    const summary = useMemo(() => buildSummary(scrumData), [scrumData]);

    // Engineers for reassignment
    const engineers = useMemo(() =>
        teamMembers.filter(m =>
            ['manager', 'teamLead', 'team_lead', 'engineer', 'admin', 'editor'].includes(m.teamRole || m.role)
        ), [teamMembers]);

    // Handle reassignment
    const handleReassign = useCallback(async (technicianId, newEngineerId, reason) => {
        try {
            await reassignTechnician(technicianId, newEngineerId, reason, userId);
            setRefreshKey(k => k + 1);
        } catch (err) {
            console.error('DailyScrum: error reassigning:', err);
        }
    }, [userId]);

    const today = new Date();
    const dateStr = today.toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="space-y-6">
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Eye className="w-5 h-5 text-white" />
                        </div>
                        Equipo Hoy <span className="text-base font-medium text-slate-500">(Daily Scrum Digital Dashboard)</span>
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 capitalize">{dateStr}</p>
                </div>
                <button
                    onClick={() => setRefreshKey(k => k + 1)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-sm text-slate-400 hover:text-white hover:border-slate-600 transition-all font-medium"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Actualizar
                </button>
            </div>

            {/* ─── Summary Cards ─── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <SummaryCard icon={Users} label="Total" value={summary.total} color="indigo" />
                <SummaryCard icon={CheckCircle2} label="OK" value={summary.ok} color="emerald" />
                <SummaryCard icon={Activity} label="Sin tareas" value={summary.sin_tareas} color="amber" alert={summary.sin_tareas > 0} />
                <SummaryCard icon={AlertTriangle} label="Sin reporte" value={summary.sin_reporte} color="rose" alert={summary.sin_reporte > 0} />
                <SummaryCard icon={Shield} label="Bloqueados" value={summary.bloqueado} color="rose" alert={summary.bloqueado > 0} />
            </div>

            {/* ─── Loading ─── */}
            {loading && (
                <div className="text-center py-16 text-slate-500 text-sm font-medium">
                    Cargando equipo...
                </div>
            )}

            {/* ─── Person Cards Grid ─── */}
            {!loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {scrumData.map(person => (
                        <PersonCard
                            key={person.uid}
                            person={person}
                            teamMembers={teamMembers}
                            onReassign={setReassigning}
                        />
                    ))}
                </div>
            )}

            {!loading && scrumData.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="font-bold">No hay miembros del equipo</p>
                    <p className="text-sm mt-1">Agrega miembros desde la administración de usuarios.</p>
                </div>
            )}

            {/* ─── Reassignment Modal ─── */}
            {reassigning && (
                <ReassignModal
                    person={reassigning}
                    engineers={engineers}
                    onConfirm={handleReassign}
                    onClose={() => setReassigning(null)}
                />
            )}
        </div>
    );
}
