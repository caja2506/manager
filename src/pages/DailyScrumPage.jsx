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
    Repeat2, X, ArrowRightLeft,
    ListTodo, CalendarCheck, UserCheck, RefreshCw, Activity
} from 'lucide-react';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useAuth } from '../contexts/AuthContext';
import TaskModuleBanner from '../components/layout/TaskModuleBanner';
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
import { getActiveTeamMembers } from '../utils/teamFilters';
import { fetchYesterdayComments } from '../services/commentService';

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
const COLOR_MAP = {
    indigo: { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.6)', shadow: 'rgba(99,102,241,0.1)', text: '#818cf8' },
    emerald: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.6)', shadow: 'rgba(16,185,129,0.1)', text: '#34d399' },
    amber: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.6)', shadow: 'rgba(245,158,11,0.1)', text: '#fbbf24' },
    rose: { bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.6)', shadow: 'rgba(244,63,94,0.1)', text: '#fb7185' },
};

function SummaryCard({ icon: Icon, label, value, color, alert, active, onClick }) {
    const c = COLOR_MAP[color] || COLOR_MAP.indigo;
    return (
        <div
            onClick={onClick}
            className={`rounded-xl p-4 cursor-pointer transition-all duration-200 select-none
                ${active
                    ? 'border-2 scale-[1.02]'
                    : 'bg-slate-800/60 border border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/80'
                }
                ${alert && !active ? 'border-rose-500/40 bg-rose-500/5' : ''}
            `}
            style={active ? {
                backgroundColor: c.bg,
                borderColor: c.border,
                boxShadow: `0 10px 15px -3px ${c.shadow}`,
            } : undefined}
        >
            <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 text-${color}-400`} />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</span>
            </div>
            <p
                className={`text-2xl font-black ${!active && alert ? 'text-rose-400' : !active ? 'text-white' : ''}`}
                style={active ? { color: c.text } : undefined}
            >{value}</p>
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
    const pct = task.percentComplete ?? 0;

    return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/80 border border-slate-700/40 rounded-md text-[10px] text-slate-300 relative overflow-hidden">
            {/* Subtle progress fill */}
            {pct > 0 && (
                <div
                    className="absolute inset-y-0 left-0 opacity-[0.07] rounded-md"
                    style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#22c55e' : '#6366f1' }}
                />
            )}
            <div className={`w-1.5 h-1.5 rounded-full ${dotClass} shrink-0 relative z-10`} />
            <span className="truncate max-w-[140px] relative z-10">{task.title || 'Sin título'}</span>
            <span className={`ml-auto text-[9px] font-bold shrink-0 relative z-10 ${pct === 100 ? 'text-emerald-400' : pct > 0 ? 'text-indigo-400/70' : 'text-slate-600'}`}>
                {pct}%
            </span>
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
    const { engTasks, engSubtasks, engProjects, teamMembers, timeLogs, delays } = useEngineeringData();
    const { user } = useAuth();
    const userId = user?.uid;

    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reassigning, setReassigning] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [statusFilter, setStatusFilter] = useState(null);
    const [ydComments, setYdComments] = useState([]);

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

    // Load yesterday comments
    useEffect(() => {
        const yd = new Date();
        yd.setDate(yd.getDate() - 1);
        if (yd.getDay() === 0) yd.setDate(yd.getDate() - 2);
        if (yd.getDay() === 6) yd.setDate(yd.getDate() - 1);
        const yStr = `${yd.getFullYear()}-${String(yd.getMonth()+1).padStart(2,'0')}-${String(yd.getDate()).padStart(2,'0')}`;
        fetchYesterdayComments(yStr).then(setYdComments).catch(err => {
            console.warn('[DailyScrum] Error loading yesterday comments:', err);
        });
    }, []);

    // Build scrum data
    const scrumData = useMemo(() => {
        if (loading) return [];
        const operationalMembers = getActiveTeamMembers(teamMembers, engTasks, timeLogs);
        return buildDailyScrumData(operationalMembers, engTasks, timeLogs, delays, assignments);
    }, [teamMembers, engTasks, timeLogs, delays, assignments, loading]);

    const summary = useMemo(() => buildSummary(scrumData), [scrumData]);

    // Project name map
    const projectMap = useMemo(() => {
        const map = {};
        engProjects.forEach(p => { map[p.id] = p.name || p.title || '?'; });
        return map;
    }, [engProjects]);

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




    return (
        <div className="-m-4 md:-m-8 flex flex-col bg-slate-950 text-white" style={{ minHeight: '100vh' }}>
            <TaskModuleBanner />

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4">

                {/* Summary row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <SummaryCard icon={Users} label="Total" value={summary.total} color="indigo"
                        active={statusFilter === null}
                        onClick={() => setStatusFilter(null)} />
                    <SummaryCard icon={CheckCircle2} label="OK" value={summary.ok} color="emerald"
                        active={statusFilter === 'ok'}
                        onClick={() => setStatusFilter(f => f === 'ok' ? null : 'ok')} />
                    <SummaryCard icon={Activity} label="Sin tareas" value={summary.sin_tareas} color="amber"
                        alert={summary.sin_tareas > 0}
                        active={statusFilter === 'sin_tareas'}
                        onClick={() => setStatusFilter(f => f === 'sin_tareas' ? null : 'sin_tareas')} />
                    <SummaryCard icon={AlertTriangle} label="Sin reporte" value={summary.sin_reporte} color="rose"
                        alert={summary.sin_reporte > 0}
                        active={statusFilter === 'sin_reporte'}
                        onClick={() => setStatusFilter(f => f === 'sin_reporte' ? null : 'sin_reporte')} />
                    <SummaryCard icon={Shield} label="Bloqueados" value={summary.bloqueado} color="rose"
                        alert={summary.bloqueado > 0}
                        active={statusFilter === 'bloqueado'}
                        onClick={() => setStatusFilter(f => f === 'bloqueado' ? null : 'bloqueado')} />
                </div>

                {/* Filter indicator */}
                {statusFilter && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">Filtrando por:</span>
                        <button onClick={() => setStatusFilter(null)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold hover:bg-indigo-500/20 transition-colors">
                            {statusFilter === 'ok' ? '✅ OK' : statusFilter === 'sin_tareas' ? '⚡ Sin tareas' : statusFilter === 'sin_reporte' ? '⚠️ Sin reporte' : '🛡️ Bloqueados'}
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="text-center py-16 text-slate-500 text-sm font-medium">Cargando equipo...</div>
                )}

                {/* TABLE */}
                {!loading && scrumData.length > 0 && (
                    <div className="rounded-xl border border-slate-800/60 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-900/80 border-b border-slate-800/50">
                                        <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Miembro</th>
                                        <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                        <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ayer (h)</th>
                                        <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tareas de Ayer</th>
                                        <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">% Avance</th>
                                        <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tareas Hoy</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/40">
                                    {scrumData
                                        .filter(person => !statusFilter || person.status === statusFilter)
                                        .sort((a, b) => {
                                            const order = { ok: 0, bloqueado: 1, sin_tareas: 2, sin_reporte: 3 };
                                            return (order[a.status] ?? 9) - (order[b.status] ?? 9);
                                        })
                                        .map(person => {
                                            const cfg = person.statusConfig;
                                            const nameParts = (person.displayName || '?').split(' ');
                                            const shortName = nameParts.length > 1
                                                ? `${nameParts[0]} ${nameParts[1][0]}.`
                                                : nameParts[0];
                                            // % avance: avg percentComplete of person's tasks
                                            const personTasks = engTasks.filter(t => t.assignedTo === person.uid && t.status !== 'completed');
                                            const avgPct = personTasks.length > 0
                                                ? Math.round(personTasks.reduce((s, t) => s + (t.percentComplete || 0), 0) / personTasks.length)
                                                : 0;

                                            return (
                                                <tr key={person.uid} className="hover:bg-slate-800/40 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <span className="text-xs font-bold text-white">{shortName}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1"
                                                            style={{ background: cfg.bgColor, border: `1px solid ${cfg.borderColor}`, color: cfg.color }}>
                                                            {cfg.emoji} {cfg.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {person.yesterdayEvidence.hasEvidence ? (
                                                            <span className="text-xs font-bold text-emerald-400">{person.yesterdayEvidence.totalHours.toFixed(1)}h</span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-red-400">{"\u26A0"} 0h</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {(() => {
                                                            // Calculate yesterday (skip weekends)
                                                            const yd = new Date();
                                                            yd.setDate(yd.getDate() - 1);
                                                            if (yd.getDay() === 0) yd.setDate(yd.getDate() - 2);
                                                            if (yd.getDay() === 6) yd.setDate(yd.getDate() - 1);
                                                            const yStr = `${yd.getFullYear()}-${String(yd.getMonth()+1).padStart(2,'0')}-${String(yd.getDate()).padStart(2,'0')}`;

                                                            // Get all person's tasks and find subtasks completed yesterday
                                                            const pTaskIds = new Set(engTasks.filter(t => t.assignedTo === person.uid).map(t => t.id));
                                                            const allSubs = engSubtasks.filter(s => pTaskIds.has(s.taskId));
                                                            const completedYesterday = allSubs.filter(s => {
                                                                if (!s.completed) return false;
                                                                const cAt = s.completedAt;
                                                                if (!cAt) return false;
                                                                const d = typeof cAt === 'string' ? new Date(cAt) : (cAt.toDate ? cAt.toDate() : new Date(cAt));
                                                                if (isNaN(d.getTime())) return false;
                                                                return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` === yStr;
                                                            });

                                                            // Group by parent task
                                                            const taskMap = {};
                                                            completedYesterday.forEach(sub => {
                                                                if (!taskMap[sub.taskId]) taskMap[sub.taskId] = [];
                                                                taskMap[sub.taskId].push(sub);
                                                            });
                                                            const taskEntries = Object.entries(taskMap);

                                                            // Filter yesterday comments for this person's tasks
                                                            const personYdComments = ydComments.filter(c => pTaskIds.has(c.taskId));

                                                            if (taskEntries.length === 0 && personYdComments.length === 0) {
                                                                return <span className="text-[10px] text-slate-600">{"\u2014"}</span>;
                                                            }

                                                            return (
                                                                <div className="space-y-2">
                                                                    {taskEntries.map(([taskId, subs]) => {
                                                                        const parentTask = engTasks.find(t => t.id === taskId);
                                                                        return (
                                                                            <div key={taskId} className="border-l-2 border-emerald-500/40 pl-2">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-400" />
                                                                                    <span className="text-[11px] font-bold text-slate-300 truncate max-w-[180px]">{parentTask?.title || '?'}</span>
                                                                                    <span className="text-[9px] font-bold px-1 py-0.5 rounded shrink-0 bg-emerald-500/15 text-emerald-400">
                                                                                        {subs.length}
                                                                                    </span>
                                                                                </div>
                                                                                {parentTask?.projectId && projectMap[parentTask.projectId] && (
                                                                                    <span className="text-[8px] text-indigo-400/70 font-semibold ml-3">{"\uD83D\uDCC1"} {projectMap[parentTask.projectId]}</span>
                                                                                )}
                                                                                <div className="ml-3 mt-0.5 space-y-0.5">
                                                                                    {subs.slice(0, 5).map(sub => (
                                                                                        <div key={sub.id} className="flex items-center gap-1 text-[10px]">
                                                                                            <span className="text-emerald-400 shrink-0">{"\u2713"}</span>
                                                                                            <span className="text-emerald-300/70">{sub.title}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                    {subs.length > 5 && (
                                                                                        <span className="text-[9px] text-slate-600">+{subs.length - 5} m{"\u00E1"}s</span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    {/* Yesterday comments */}
                                                                    {personYdComments.length > 0 && (
                                                                        <div className="mt-1 space-y-0.5">
                                                                            {personYdComments.slice(0, 5).map(c => (
                                                                                <div key={c.id} className="flex items-start gap-1 text-[10px]">
                                                                                    <span className="text-indigo-400 shrink-0">{"\uD83D\uDCAC"}</span>
                                                                                    <span className="text-indigo-300/80"><strong>{c.userName || '?'}:</strong> {(c.text || '').slice(0, 80)}</span>
                                                                                </div>
                                                                            ))}
                                                                            {personYdComments.length > 5 && (
                                                                                <span className="text-[9px] text-slate-600">+{personYdComments.length - 5} m{"\u00E1"}s</span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`text-xs font-bold ${avgPct >= 60 ? 'text-emerald-400' : avgPct >= 30 ? 'text-amber-400' : 'text-slate-500'}`}>
                                                            {avgPct}%
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {person.todayTasks.length > 0 ? (
                                                            <div className="space-y-2">
                                                                {person.todayTasks.map(task => {
                                                                    const taskSubs = engSubtasks.filter(s => s.taskId === task.id);
                                                                    const pendingSubs = taskSubs.filter(s => !s.completed);
                                                                    const doneCount = taskSubs.filter(s => s.completed).length;
                                                                    const totalCount = taskSubs.length;
                                                                    const taskPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : (task.percentComplete || 0);
                                                                    const taskBlockers = person.blockers.filter(bl => bl.taskId === task.id);
                                                                    return (
                                                                        <div key={task.id} className={`border-l-2 ${taskBlockers.length > 0 ? 'border-red-500/60' : 'border-indigo-500/40'} pl-2`}>
                                                                            {/* Task header */}
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${taskBlockers.length > 0 ? 'bg-red-400' : taskPct === 100 ? 'bg-emerald-400' : taskPct > 0 ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                                                                                <span className="text-[11px] font-bold text-slate-200 truncate max-w-[180px]">{task.title}</span>
                                                                                <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${taskPct === 100 ? 'bg-emerald-500/15 text-emerald-400' : taskPct > 0 ? 'bg-indigo-500/15 text-indigo-400' : 'bg-slate-700/50 text-slate-500'}`}>
                                                                                    {taskPct}%
                                                                                </span>
                                                                            </div>
                                                                            {task.projectId && projectMap[task.projectId] && (
                                                                                <span className="text-[8px] text-indigo-400/70 font-semibold ml-3">{"\uD83D\uDCC1"} {projectMap[task.projectId]}</span>
                                                                            )}
                                                                            {/* Blockers for this task */}
                                                                            {taskBlockers.length > 0 && (
                                                                                <div className="ml-3 mt-0.5 space-y-0.5">
                                                                                    {taskBlockers.map((bl, i) => (
                                                                                        <div key={bl.id || i} className="flex items-center gap-1 text-[10px]">
                                                                                            <span className="text-red-400 shrink-0">{"\u26D4"}</span>
                                                                                            <span className="text-red-300 font-bold">{bl.causeName || bl.cause || 'Bloqueo'}</span>
                                                                                            {(bl.notes || bl.comment) && (
                                                                                                <span className="text-slate-500 truncate max-w-[120px]">— {bl.notes || bl.comment}</span>
                                                                                            )}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                            {/* Only pending subtasks */}
                                                                            {pendingSubs.length > 0 && (
                                                                                <div className="ml-3 mt-0.5 space-y-0.5">
                                                                                    {pendingSubs.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).slice(0, 5).map(sub => (
                                                                                        <div key={sub.id} className="flex items-center gap-1 text-[10px]">
                                                                                            <span className="text-slate-600 shrink-0">{"\u25CB"}</span>
                                                                                            <span className="text-slate-400">{sub.title}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                    {pendingSubs.length > 5 && (
                                                                                        <span className="text-[9px] text-slate-600">+{pendingSubs.length - 5} m{"\u00E1"}s</span>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-amber-400 font-medium">{"\uD83D\uDFE1"} Sin tareas</span>
                                                        )}
                                                    </td>

                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {!loading && scrumData.length === 0 && (
                    <div className="text-center py-16 text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p className="font-bold">No hay miembros del equipo</p>
                        <p className="text-sm mt-1">Agrega miembros desde la administración de usuarios.</p>
                    </div>
                )}
            </div>

            {/* Reassignment Modal */}
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


