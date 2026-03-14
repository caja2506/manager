import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { useAppData } from '../contexts/AppDataContext';
import {
    FolderGit2, Plus, Trash2, Edit3, ChevronRight,
    Clock, ListTodo, AlertTriangle, Users as UsersIcon, Shield, AlertOctagon
} from 'lucide-react';
import { PROJECT_STATUS_CONFIG, TASK_PRIORITY_CONFIG, RISK_LEVEL_CONFIG } from '../models/schemas';
import ProjectModal from '../components/tasks/ProjectModal';
import { deleteProject } from '../services/taskService';

export default function Projects() {
    const { user } = useAuth();
    const { canEdit, canDelete, isAdmin } = useRole();
    const { engProjects, engTasks, teamMembers, setConfirmDelete } = useAppData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);

    const openNew = () => { setEditingProject(null); setIsModalOpen(true); };
    const openEdit = (p) => { setEditingProject(p); setIsModalOpen(true); };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <ProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                project={editingProject}
                teamMembers={teamMembers}
                userId={user?.uid}
            />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/70 backdrop-blur-sm p-6 rounded-2xl border border-slate-800 shadow-lg">
                <div>
                    <h2 className="font-black text-2xl text-white tracking-tight">Proyectos de Ingeniería</h2>
                    <p className="text-xs text-slate-400 font-bold mt-1">{engProjects.length} proyecto{engProjects.length !== 1 ? 's' : ''}</p>
                </div>
                {canEdit && (
                    <button
                        onClick={openNew}
                        className="bg-indigo-600 text-white px-6 py-4 rounded-xl font-black shadow-lg shadow-indigo-500/20 flex items-center justify-center active:scale-95 transition-transform border border-indigo-500"
                    >
                        <Plus className="mr-2" /> Nuevo Proyecto
                    </button>
                )}
            </div>

            {/* Project Grid */}
            {engProjects.length === 0 ? (
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-16 text-center">
                    <FolderGit2 className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-400 mb-2">Sin proyectos de ingeniería</h3>
                    <p className="text-sm text-slate-500 mb-6">Crea tu primer proyecto para empezar a gestionar tareas</p>
                    {canEdit && (
                        <button onClick={openNew} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/20 border border-indigo-500">
                            <Plus className="w-4 h-4 inline mr-2" /> Crear proyecto
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {engProjects.map(project => {
                        const projectTasks = engTasks.filter(t => t.projectId === project.id);
                        const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
                        const blockedTasks = projectTasks.filter(t => t.status === 'blocked').length;
                        const totalTasks = projectTasks.length;
                        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                        const statusCfg = PROJECT_STATUS_CONFIG[project.status] || {};
                        const priorityCfg = TASK_PRIORITY_CONFIG[project.priority] || {};
                        const owner = teamMembers.find(u => u.uid === project.ownerId);

                        return (
                            <div
                                key={project.id}
                                className="bg-slate-900/70 rounded-2xl border border-slate-800 hover:border-indigo-500/50 shadow-lg transition-all group cursor-pointer overflow-hidden backdrop-blur-sm"
                                onClick={() => openEdit(project)}
                            >
                                {/* Status bar */}
                                <div className="h-1.5" style={{ backgroundColor: statusCfg.color || '#e2e8f0' }} />

                                <div className="p-5 space-y-4">
                                    {/* Top badges */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg"
                                                style={{ backgroundColor: `${statusCfg.color}15`, color: statusCfg.color }}
                                            >
                                                {statusCfg.icon} {statusCfg.label}
                                            </span>
                                            {(() => {
                                                const riskLevel = project.riskLevel || 'low';
                                                const riskConfig = RISK_LEVEL_CONFIG[riskLevel];
                                                if (!riskConfig) return null;
                                                return (
                                                    <span
                                                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${riskLevel === 'high' ? 'text-red-600 bg-red-50 border border-red-200' :
                                                                riskLevel === 'medium' ? 'text-amber-600 bg-amber-50 border border-amber-200' :
                                                                    'text-green-600 bg-green-50 border border-green-200'
                                                            }`}
                                                        title={project.riskSummary || 'Riesgo del proyecto'}
                                                    >
                                                        {riskLevel === 'high' ? <AlertOctagon className="w-3 h-3" /> :
                                                            riskLevel === 'medium' ? <AlertTriangle className="w-3 h-3" /> :
                                                                <Shield className="w-3 h-3" />}
                                                        {riskConfig.label}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 text-${priorityCfg.color}-600 bg-${priorityCfg.color}-50`}>
                                            <AlertTriangle className="w-3 h-3" /> {priorityCfg.label}
                                        </span>
                                    </div>

                                    {/* Name */}
                                    <div>
                                        <h3 className="font-black text-lg text-slate-200 leading-tight group-hover:text-indigo-400 transition-colors line-clamp-2">
                                            {project.name}
                                        </h3>
                                        {project.description && (
                                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{project.description}</p>
                                        )}
                                    </div>

                                    {/* Progress */}
                                    {totalTasks > 0 && (
                                        <div>
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                                                <span><ListTodo className="w-3 h-3 inline mr-0.5" /> {completedTasks}/{totalTasks} tareas</span>
                                                <span>{progress}%</span>
                                            </div>
                                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Bottom info */}
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                                        <div className="flex items-center gap-2">
                                            {owner && (
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-600">
                                                        {(owner.displayName || owner.email || '?')[0].toUpperCase()}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-medium truncate max-w-[80px]">
                                                        {owner.displayName || owner.email}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {blockedTasks > 0 && (
                                                <span className="text-[10px] font-bold text-red-500 flex items-center gap-0.5">
                                                    <AlertTriangle className="w-3 h-3" /> {blockedTasks}
                                                </span>
                                            )}
                                            {project.targetEndDate && (
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    <Clock className="w-3 h-3 inline mr-0.5" />
                                                    {new Date(project.targetEndDate).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {(canEdit || canDelete) && (
                                        <div className="flex justify-end gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {canEdit && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openEdit(project); }}
                                                    className="p-2 text-amber-500 bg-amber-50 rounded-lg hover:bg-amber-100 text-xs font-bold flex items-center gap-1"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" /> Editar
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmDelete({
                                                            isOpen: true,
                                                            title: '¿Eliminar proyecto?',
                                                            message: `Se eliminará "${project.name}" y todas sus tareas.`,
                                                            onConfirm: () => deleteProject(project.id),
                                                        });
                                                    }}
                                                    className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100 text-xs font-bold flex items-center gap-1"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
