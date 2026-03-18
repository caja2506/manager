/**
 * Project Detail Page — V5
 * ==========================
 * Real project detail: summary, milestones, score, setup,
 * and gateway to milestone detail/history/ai-monitoring.
 *
 * Route: /projects/:projectId
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { useAppData } from '../contexts/AppDataContext';
import {
    ArrowLeft, Target, ListTodo, Clock, Calendar, AlertTriangle,
    ChevronRight, Plus, BarChart3, Settings, FolderGit2,
    CheckCircle2, Activity, Edit3, Trash2, AlertCircle, Loader2
} from 'lucide-react';
import { PROJECT_STATUS_CONFIG, TASK_PRIORITY_CONFIG, MILESTONE_TYPE } from '../models/schemas';
import ProjectModal from '../components/tasks/ProjectModal';
import MilestoneModal from '../components/milestones/MilestoneModal';
import { createMilestone, deleteMilestone, getMilestonesByProject } from '../services/milestoneService';

const TYPE_LABELS = {
    [MILESTONE_TYPE.SETUP]: { icon: '⚙️', label: 'Setup' },
    [MILESTONE_TYPE.COMMISSIONING]: { icon: '🔧', label: 'Commissioning' },
    [MILESTONE_TYPE.VALIDATION]: { icon: '✅', label: 'Validación' },
    [MILESTONE_TYPE.CUSTOM]: { icon: '🎯', label: 'Custom' },
};

export default function ProjectDetailPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { canEdit } = useRole();
    const { engProjects, engTasks, teamMembers } = useAppData();

    const [showEditModal, setShowEditModal] = useState(false);
    const [showMilestoneModal, setShowMilestoneModal] = useState(false);
    const [milestones, setMilestones] = useState([]);
    const [loadingMs, setLoadingMs] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState(null); // { id, name }
    const [deleting, setDeleting] = useState(false);

    const project = useMemo(
        () => engProjects.find(p => p.id === projectId),
        [engProjects, projectId]
    );

    const projectTasks = useMemo(
        () => engTasks.filter(t => t.projectId === projectId),
        [engTasks, projectId]
    );

    // ── Load milestones from Firestore ──
    const loadMilestones = useCallback(async () => {
        if (!projectId) return;
        setLoadingMs(true);
        try {
            const ms = await getMilestonesByProject(projectId);
            setMilestones(ms);
        } catch (err) {
            console.error('Error loading milestones:', err);
        } finally {
            setLoadingMs(false);
        }
    }, [projectId]);

    useEffect(() => { loadMilestones(); }, [loadMilestones]);

    // ── Create milestone handler ──
    const handleCreateMilestone = async (data) => {
        await createMilestone(projectId, data, user?.uid);
        await loadMilestones();
    };

    // ── Delete milestone handler ──
    const confirmDeleteMilestone = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteMilestone(deleteTarget.id);
            setDeleteTarget(null);
            await loadMilestones();
        } catch (err) {
            console.error('Error deleting milestone:', err);
        }
        setDeleting(false);
    };

    // ── Task stats ──
    const stats = useMemo(() => {
        const total = projectTasks.length;
        const completed = projectTasks.filter(t => t.status === 'completed').length;
        const blocked = projectTasks.filter(t => t.status === 'blocked').length;
        const inProgress = projectTasks.filter(t => t.status === 'in_progress').length;
        const pending = projectTasks.filter(t => t.status === 'pending').length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        const overdue = projectTasks.filter(t => {
            if (t.status === 'completed' || t.status === 'cancelled') return false;
            return t.dueDate && new Date(t.dueDate) < new Date();
        }).length;
        return { total, completed, blocked, inProgress, pending, progress, overdue };
    }, [projectTasks]);

    // ── Not found ──
    if (!project) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center">
                    <FolderGit2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-slate-400 mb-2">Proyecto no encontrado</h3>
                    <button onClick={() => navigate('/projects')}
                        className="px-5 py-2 bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 rounded-lg text-sm cursor-pointer">
                        Volver a Proyectos
                    </button>
                </div>
            </div>
        );
    }

    const statusCfg = PROJECT_STATUS_CONFIG[project.status] || {};
    const priorityCfg = TASK_PRIORITY_CONFIG[project.priority] || {};
    const owner = teamMembers.find(u => u.uid === project.ownerId);
    const daysLeft = project.targetEndDate
        ? Math.round((new Date(project.targetEndDate) - new Date()) / (1000 * 60 * 60 * 24))
        : null;

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* Modals */}
            <ProjectModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                project={project}
                teamMembers={teamMembers}
                userId={user?.uid}
            />
            <MilestoneModal
                isOpen={showMilestoneModal}
                onClose={() => setShowMilestoneModal(false)}
                onSave={handleCreateMilestone}
                teamMembers={teamMembers}
            />

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl p-6 max-w-sm mx-4 w-full">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-500/15 rounded-xl flex items-center justify-center">
                                <AlertCircle className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h4 className="font-bold text-white">Eliminar Milestone</h4>
                                <p className="text-xs text-slate-400">Esta acción no se puede deshacer</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-300 mb-5">
                            ¿Estás seguro de eliminar <strong className="text-white">"{deleteTarget.name}"</strong>?
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700 transition cursor-pointer">
                                Cancelar
                            </button>
                            <button onClick={confirmDeleteMilestone} disabled={deleting}
                                className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5">
                                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                {deleting ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════ HEADER ══════════════ */}
            <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
                <div className="h-1.5" style={{ backgroundColor: statusCfg.color || '#e2e8f0' }} />
                <div className="p-5">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                            <button onClick={() => navigate('/projects')}
                                className="text-indigo-400 hover:text-indigo-300 transition mt-0.5 cursor-pointer">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg"
                                        style={{ backgroundColor: `${statusCfg.color}15`, color: statusCfg.color }}>
                                        {statusCfg.icon} {statusCfg.label}
                                    </span>
                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-${priorityCfg.color}-600 bg-${priorityCfg.color}-50 flex items-center gap-0.5`}>
                                        <AlertTriangle className="w-3 h-3" /> {priorityCfg.label}
                                    </span>
                                </div>
                                <h2 className="font-black text-xl text-white tracking-tight">{project.name}</h2>
                                {project.description && (
                                    <p className="text-sm text-slate-400 mt-1 max-w-xl">{project.description}</p>
                                )}
                            </div>
                        </div>
                        {canEdit && (
                            <button onClick={() => setShowEditModal(true)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold hover:bg-amber-500/20 transition cursor-pointer">
                                <Edit3 className="w-3.5 h-3.5" /> Editar
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-400">
                        {owner && (
                            <span className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[9px] font-bold text-indigo-400">
                                    {(owner.displayName || owner.email || '?')[0].toUpperCase()}
                                </div>
                                {owner.displayName || owner.email}
                            </span>
                        )}
                        {project.targetStartDate && (
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(project.targetStartDate).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                        )}
                        {project.targetEndDate && (
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(project.targetEndDate).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                                {daysLeft !== null && (
                                    <span className={`font-bold ${daysLeft < 0 ? 'text-red-400' : daysLeft < 7 ? 'text-amber-400' : 'text-slate-400'}`}>
                                        ({daysLeft < 0 ? `${Math.abs(daysLeft)}d vencido` : `${daysLeft}d`})
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ══════════════ STATS KPIs ══════════════ */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Tareas" value={stats.total} icon={<ListTodo className="w-5 h-5" />} color="indigo" />
                <StatCard label="Completadas" value={stats.completed} icon={<CheckCircle2 className="w-5 h-5" />} color="emerald" />
                <StatCard label="En Progreso" value={stats.inProgress} icon={<Activity className="w-5 h-5" />} color="blue" />
                <StatCard label="Pendientes" value={stats.pending} icon={<Clock className="w-5 h-5" />} color="slate" />
                <StatCard label="Bloqueadas" value={stats.blocked} icon={<AlertTriangle className="w-5 h-5" />} color="red" />
                <StatCard label="Vencidas" value={stats.overdue} icon={<AlertTriangle className="w-5 h-5" />} color="amber" />
            </div>

            {/* Progress bar */}
            <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-bold text-slate-300">Avance General</span>
                    <span className="font-black text-white">{stats.progress}%</span>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ${stats.progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${stats.progress}%` }}
                    />
                </div>
            </div>

            {/* ══════════════ MILESTONES & SETUP ══════════════ */}
            <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-400" />
                        <h3 className="font-bold text-lg text-white">Milestones & Setup</h3>
                        {milestones.length > 0 && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{milestones.length}</span>
                        )}
                    </div>
                    {canEdit && (
                        <button
                            onClick={() => setShowMilestoneModal(true)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 shadow-lg shadow-purple-900/30 transition cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5" /> Nuevo Milestone
                        </button>
                    )}
                </div>

                {loadingMs ? (
                    <div className="text-center py-8">
                        <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-xs text-slate-500 mt-2">Cargando milestones...</p>
                    </div>
                ) : milestones.length === 0 ? (
                    <div className="text-center py-8">
                        <Target className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 mb-1">
                            Este proyecto aún no tiene milestones configurados.
                        </p>
                        <p className="text-[11px] text-slate-600">
                            Crea tu primer milestone para activar el motor de score, tendencia y AI Monitoring.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {milestones.map(ms => {
                            const typeInfo = TYPE_LABELS[ms.type] || TYPE_LABELS.custom;
                            return (
                                <div
                                    key={ms.id}
                                    className="flex items-center justify-between p-4 bg-slate-800/40 rounded-xl border border-slate-700/40 hover:border-purple-500/40 transition-all group"
                                >
                                    <div
                                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                                        onClick={() => navigate(`/projects/${projectId}/milestones/${ms.id}`)}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                            ms.type === 'setup'
                                                ? 'bg-purple-500/15 border border-purple-500/30'
                                                : 'bg-indigo-500/15 border border-indigo-500/30'
                                        }`}>
                                            <Target className={`w-5 h-5 ${ms.type === 'setup' ? 'text-purple-400' : 'text-indigo-400'}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-sm text-slate-200 group-hover:text-purple-300 transition-colors truncate">
                                                {ms.name}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">
                                                    {typeInfo.icon} {typeInfo.label}
                                                </span>
                                                {ms.dueDate && (
                                                    <span className="text-[10px] text-slate-500">
                                                        <Clock className="w-3 h-3 inline mr-0.5" />
                                                        {new Date(ms.dueDate).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                )}
                                                {ms.status && (
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                        ms.status === 'active' ? 'bg-green-500/10 text-green-400' :
                                                        ms.status === 'completed' ? 'bg-blue-500/10 text-blue-400' :
                                                        'bg-slate-700 text-slate-400'
                                                    }`}>{ms.status}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {canEdit && (
                                            <button
                                                onClick={() => setDeleteTarget({ id: ms.id, name: ms.name })}
                                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/15 rounded-lg transition cursor-pointer"
                                                title="Eliminar milestone"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        <ChevronRight
                                            className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition cursor-pointer"
                                            onClick={() => navigate(`/projects/${projectId}/milestones/${ms.id}`)}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ══════════════ QUICK NAVIGATION ══════════════ */}
            <div className="grid md:grid-cols-3 gap-3">
                <QuickNavCard
                    icon={<ListTodo className="w-5 h-5 text-indigo-400" />}
                    label="Ver Tareas"
                    desc="Gestión y seguimiento de tareas"
                    onClick={() => navigate(`/tasks?project=${projectId}`)}
                />
                <QuickNavCard
                    icon={<BarChart3 className="w-5 h-5 text-emerald-400" />}
                    label="Analítica"
                    desc="Métricas y gráficas del proyecto"
                    onClick={() => navigate('/analytics')}
                />
                <QuickNavCard
                    icon={<Settings className="w-5 h-5 text-amber-400" />}
                    label="Configuración"
                    desc="Parámetros y ajustes del proyecto"
                    onClick={() => setShowEditModal(true)}
                />
            </div>
        </div>
    );
}

// ── Helper Components ──

function StatCard({ label, value, icon, color }) {
    const colors = {
        indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
        blue: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
        amber: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
        red: { bg: 'bg-red-500/10', text: 'text-red-400' },
        slate: { bg: 'bg-slate-500/10', text: 'text-slate-400' },
    };
    const c = colors[color] || colors.slate;
    return (
        <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800 shadow-lg">
            <span className={`text-[9px] font-black tracking-wider uppercase ${c.text}`}>{label}</span>
            <div className="flex items-center gap-2 mt-1.5">
                <div className={`w-9 h-9 rounded-full ${c.bg} flex items-center justify-center ${c.text} shrink-0`}>
                    {icon}
                </div>
                <span className="text-2xl font-black text-white">{value}</span>
            </div>
        </div>
    );
}

function QuickNavCard({ icon, label, desc, onClick }) {
    return (
        <button
            onClick={onClick}
            className="text-left p-4 bg-slate-900/70 rounded-2xl border border-slate-800 hover:border-indigo-500/30 shadow-lg transition-all group cursor-pointer"
        >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/10 transition">
                    {icon}
                </div>
                <div>
                    <div className="font-bold text-sm text-slate-200 group-hover:text-indigo-300 transition">{label}</div>
                    <div className="text-[10px] text-slate-500">{desc}</div>
                </div>
            </div>
        </button>
    );
}
