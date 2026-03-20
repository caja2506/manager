import React, { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../contexts/RoleContext';
import { useAppData } from '../contexts/AppDataContext';
import { deleteBomProject } from '../services/bomCrudService';
import { db } from '../firebase';
import {
    FolderGit2, Plus, Trash2, ChevronRight, DollarSign, Edit3, X
} from 'lucide-react';

export default function BomProjects() {
    const navigate = useNavigate();
    const { canEdit, canDelete } = useRole();
    const { proyectos, bomItems, handleSaveProject, setConfirmDelete } = useAppData();

    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [editingProjectId, setEditingProjectId] = useState(null);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDesc, setNewProjectDesc] = useState('');

    const onSaveProject = async (e) => {
        e.preventDefault();
        await handleSaveProject(e, { name: newProjectName, description: newProjectDesc }, editingProjectId);
        setIsProjectModalOpen(false);
        setNewProjectName('');
        setNewProjectDesc('');
        setEditingProjectId(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <PageHeader title="" showBack={true} />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/70 backdrop-blur-sm p-6 rounded-2xl border border-slate-800 shadow-lg">
                <h2 className="font-black text-2xl text-white tracking-tight">Tus Proyectos</h2>
                {canEdit && (
                    <button
                        onClick={() => { setEditingProjectId(null); setNewProjectName(''); setNewProjectDesc(''); setIsProjectModalOpen(true); }}
                        className="bg-indigo-600 text-white px-6 py-4 rounded-xl font-black shadow-lg shadow-indigo-500/20 flex items-center justify-center active:scale-95 transition-transform border border-indigo-500"
                    >
                        <Plus className="mr-2" /> Nuevo Proyecto
                    </button>
                )}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {(proyectos || []).map(p => {
                    const totalProyecto = bomItems.filter(item => item.projectId === p.id).reduce((sum, item) => sum + (item.totalPrice || 0), 0);
                    return (
                        <div
                            key={p.id}
                            onClick={() => navigate(`/bom/projects/${p.id}`)}
                            className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/50 cursor-pointer shadow-lg relative group transition-all h-52 flex flex-col justify-between overflow-hidden backdrop-blur-sm"
                        >
                            <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/10 rounded-bl-full opacity-40"></div>
                            <div>
                                <h3 className="font-black text-xl text-slate-200 truncate pr-10">{p.name}</h3>
                                <p className="text-slate-400 text-xs line-clamp-3 mt-2">{p.description || 'Sin notas'}</p>
                            </div>
                            <div className="flex justify-between items-center border-t pt-4 border-slate-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(p.createdAt).toLocaleDateString()}</span>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center font-bold text-green-600 text-sm"><DollarSign className="w-4 h-4 mr-1" />{totalProyecto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                                    <ChevronRight className="text-indigo-500 w-5 h-5" />
                                </div>
                            </div>
                            {(canEdit || canDelete) && (
                                <div className="absolute top-4 right-4 flex space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    {canEdit && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setEditingProjectId(p.id); setNewProjectName(p.name); setNewProjectDesc(p.description); setIsProjectModalOpen(true); }}
                                            className="p-2 text-amber-500 bg-amber-50 rounded-lg hover:bg-amber-100"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setConfirmDelete({
                                                    isOpen: true,
                                                    title: '¿Borrar proyecto?',
                                                    message: `Se borrarán todos los datos de "${p.name}".`,
                                                    onConfirm: () => deleteBomProject(p.id)
                                                });
                                            }}
                                            className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Project Modal */}
            {isProjectModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
                    <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200 border border-slate-800">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                            <h2 className="font-black text-2xl flex items-center tracking-tighter text-white"><FolderGit2 className="mr-2 text-indigo-400 w-6 h-6" /> {editingProjectId ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h2>
                            <button onClick={() => { setIsProjectModalOpen(false); setEditingProjectId(null); }} className="p-2 text-slate-400 hover:bg-slate-800 rounded-full"><X /></button>
                        </div>
                        <form onSubmit={onSaveProject} className="space-y-4">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1">Nombre</span>
                                <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Ej: Celda Robotizada..." className="w-full p-4 border border-slate-700 rounded-2xl bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-white" required />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1">Notas</span>
                                <textarea value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} placeholder="Centro de costos o justificación..." className="w-full p-4 border border-slate-700 rounded-2xl bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-white" rows="3" />
                            </div>
                            <button type="submit" className="w-full p-5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all text-lg">
                                {editingProjectId ? 'Actualizar Proyecto' : 'Crear Proyecto'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
