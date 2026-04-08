import React, { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAppData } from '../contexts/AppDataContext';
import { useEngineeringData } from '../hooks/useEngineeringData';
import ManagedListCard from '../components/ui/ManagedListCard';
import WorkAreasCard from '../components/ui/WorkAreasCard';
import AreaTaskKanban from '../components/engineering/AreaTaskKanban';
import { createDelayCause, updateDelayCause, deleteDelayCause } from '../services/delayService';
import { 
    AlertOctagon, ListTodo, Compass, Target, Plus, Trash2, Search, Settings2
} from 'lucide-react';

// ============================================================
// Delay Causes Card — Adapted specifically for engineering
// ============================================================
function DelayCausesCard({ causes }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editItems, setEditItems] = useState([]);
    const [search, setSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const startEdit = () => {
        setEditItems(causes.map(c => ({ id: c.id, name: c.name, description: c.description || '', active: c.active !== false, isNew: false })));
        setIsEditing(true);
    };

    const handleAdd = () => {
        setEditItems(prev => [...prev, { id: `n-${Date.now()}`, name: '', description: '', active: true, isNew: true }]);
    };

    const handleRemove = (id) => {
        setEditItems(prev => prev.filter(i => i.id !== id));
    };

    const handleChange = (id, field, value) => {
        setEditItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Create new items
            for (const item of editItems.filter(i => i.isNew && i.name.trim())) {
                await createDelayCause({ name: item.name.trim(), description: item.description.trim(), active: item.active, order: causes.length });
            }
            // Update existing items that changed
            for (const item of editItems.filter(i => !i.isNew)) {
                const original = causes.find(c => c.id === item.id);
                if (original && (original.name !== item.name.trim() || original.description !== item.description || original.active !== item.active)) {
                    await updateDelayCause(item.id, { name: item.name.trim(), description: item.description.trim(), active: item.active });
                }
            }
            // Delete removed items
            const keptIds = editItems.filter(i => !i.isNew).map(i => i.id);
            for (const cause of causes) {
                if (!keptIds.includes(cause.id)) {
                    await deleteDelayCause(cause.id);
                }
            }
        } catch (e) { console.error(e); }
        setIsSaving(false);
        setIsEditing(false);
    };

    const cancel = () => {
        setIsEditing(false);
        setEditItems([]);
    };

    const filtered = causes.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden flex flex-col h-[400px]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rose-50 dark:bg-rose-500/10 rounded-2xl flex items-center justify-center">
                        <AlertOctagon className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-sm">Causas de Retraso</h3>
                        <p className="text-[11px] text-slate-500">Motivos de bloqueo · {causes.length} registros</p>
                    </div>
                </div>
                {!isEditing ? (
                    <button onClick={startEdit} className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors">
                        Editar
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={cancel} className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                        <button onClick={handleSave} disabled={isSaving} className="text-xs font-bold text-white bg-indigo-600 px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                            {isSaving ? '...' : 'Guardar'}
                        </button>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="p-4 flex-1 overflow-hidden flex flex-col">
                {isEditing ? (
                    <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                        {editItems.map(item => (
                            <div key={item.id} className="flex items-center gap-2">
                                <input
                                    value={item.name}
                                    onChange={e => handleChange(item.id, 'name', e.target.value)}
                                    placeholder="Nombre de la causa..."
                                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button onClick={() => handleRemove(item.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <button onClick={handleAdd} className="w-full mt-2 p-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Agregar otro
                        </button>
                    </div>
                ) : (
                    <>
                        {causes.length > 5 && (
                            <div className="relative mb-3 flex-shrink-0">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        )}
                        <div className="space-y-1 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                            {filtered.length === 0 && (
                                <p className="text-xs text-slate-500 text-center py-4">Sin resultados</p>
                            )}
                            {filtered.map(cause => (
                                <div key={cause.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-transparent">
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cause.active !== false ? 'bg-indigo-500' : 'bg-slate-400 dark:bg-slate-600'}`} />
                                    <span className={`text-sm font-medium ${cause.active !== false ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 line-through'}`}>{cause.name}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}


// ============================================================
// Main Engineering Lists Page
// ============================================================
export default function EngineeringListsPage() {
    const { handleSaveManagedList } = useAppData();
    const { delayCauses, taskTypes, workAreaTypes, milestoneTypes } = useEngineeringData();

    return (
        <div className="w-full space-y-6 pb-20">
            <PageHeader title="" showBack={true} />
            
            {/* Page Header */}
            <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-indigo-500/15 rounded-2xl flex items-center justify-center">
                    <Settings2 className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">Clasificadores de Ingeniería</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Configura Tipos de Tarea, Áreas de Trabajo y construye las reglas de negocio.</p>
                </div>
            </div>

            {/* Kanban section for mapping tasks to areas (Moved to top) */}
            <div className="pb-6">
                <AreaTaskKanban 
                    workAreaTypes={workAreaTypes || []} 
                    taskTypes={taskTypes || []} 
                />
            </div>

            {/* Grid of basic lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-1">
                    <DelayCausesCard causes={delayCauses || []} />
                </div>
                <div className="lg:col-span-1 h-[400px]">
                    <ManagedListCard
                        title="Tipos de Milestone"
                        subtitle="Fases del proyecto"
                        icon={Target}
                        iconBg="bg-purple-100 dark:bg-purple-500/10"
                        iconColor="text-purple-600 dark:text-purple-400"
                        items={(milestoneTypes || []).map(t => t.name)}
                        onSave={(data) => handleSaveManagedList({ type: 'milestoneType', data })}
                    />
                </div>
                <div className="lg:col-span-1 h-[400px]">
                    <ManagedListCard
                        title="Tipos de Tarea"
                        subtitle="Catálogo de operaciones"
                        icon={ListTodo}
                        iconBg="bg-emerald-100 dark:bg-emerald-500/10"
                        iconColor="text-emerald-600 dark:text-emerald-400"
                        items={(taskTypes || []).map(t => t.name)}
                        onSave={(data) => handleSaveManagedList({ type: 'taskType', data })}
                    />
                </div>
                <div className="lg:col-span-1 border-0">
                    <WorkAreasCard workAreas={workAreaTypes || []} />
                </div>
            </div>
        </div>
    );
}
