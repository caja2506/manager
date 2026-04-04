import React, { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAppData } from '../contexts/AppDataContext';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useRole } from '../contexts/RoleContext';
import {
    Tag, Truck, LayoutList, AlertOctagon, ListTodo,
    Plus, Edit2, Trash2, Check, X, Search, List, Compass, Target
} from 'lucide-react';
import { createDelayCause, updateDelayCause, deleteDelayCause } from '../services/delayService';
import AreaTaskTypeRelationModal from '../components/milestones/AreaTaskTypeRelationModal';

// ============================================================
// Generic List Card — reusable for simple name-only lists
// ============================================================
function SimpleListCard({ title, subtitle, icon: Icon, iconBg, iconColor, items, onSave }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editItems, setEditItems] = useState([]);
    const [search, setSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const startEdit = () => {
        setEditItems(items.map((name, i) => ({ id: `e-${i}`, name, original: name })));
        setIsEditing(true);
    };

    const handleAdd = () => {
        setEditItems(prev => [...prev, { id: `n-${Date.now()}`, name: '', original: null }]);
    };

    const handleRemove = (id) => {
        setEditItems(prev => prev.filter(i => i.id !== id));
    };

    const handleChange = (id, value) => {
        setEditItems(prev => prev.map(i => i.id === id ? { ...i, name: value } : i));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const renames = editItems
            .filter(i => i.original && i.name.trim() && i.original !== i.name.trim())
            .map(i => ({ oldName: i.original, newName: i.name.trim() }));
        const added = editItems.filter(i => !i.original && i.name.trim()).map(i => i.name.trim());
        const remainingOriginals = editItems.map(i => i.original).filter(Boolean);
        const deleted = items.filter(name => !remainingOriginals.includes(name));
        try {
            await onSave({ renames, deleted, added });
            setIsEditing(false);
        } catch (err) {
            console.error('Error saving managed list:', err);
            alert('Error al guardar: ' + (err.message || 'Error desconocido'));
        }
        setIsSaving(false);
    };

    const cancel = () => {
        setIsEditing(false);
        setEditItems([]);
    };

    const filtered = items.filter(n => n.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${iconBg} rounded-2xl flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">{title}</h3>
                        <p className="text-[11px] text-slate-500">{subtitle} · {items.length} registros</p>
                    </div>
                </div>
                {!isEditing ? (
                    <button onClick={startEdit} className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={cancel} className="text-xs font-bold text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors">Cancelar</button>
                        <button onClick={handleSave} disabled={isSaving} className="text-xs font-bold text-white bg-indigo-600 px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                            {isSaving ? '...' : 'Guardar'}
                        </button>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="p-4">
                {isEditing ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {editItems.map(item => (
                            <div key={item.id} className="flex items-center gap-2">
                                <input
                                    value={item.name}
                                    onChange={e => handleChange(item.id, e.target.value)}
                                    placeholder="Nuevo valor..."
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button onClick={() => handleRemove(item.id)} className="p-2 text-red-400 hover:bg-red-500/15 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <button onClick={handleAdd} className="w-full mt-2 p-2 text-xs font-bold text-indigo-400 bg-indigo-500/10 rounded-lg flex items-center justify-center hover:bg-indigo-500/20 transition-colors">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Agregar otro
                        </button>
                    </div>
                ) : (
                    <>
                        {items.length > 5 && (
                            <div className="relative mb-3">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        )}
                        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                            {filtered.length === 0 && (
                                <p className="text-xs text-slate-500 text-center py-4">Sin resultados</p>
                            )}
                            {filtered.map((name, idx) => (
                                <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg">
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0" />
                                    <span className="text-sm text-slate-200 font-medium">{name}</span>
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
// Delay Causes Card — SAME visual style as SimpleListCard
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
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rose-100 rounded-2xl flex items-center justify-center">
                        <AlertOctagon className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">Causas de Retraso</h3>
                        <p className="text-[11px] text-slate-500">Motivos de bloqueo para tareas y proyectos · {causes.length} registros</p>
                    </div>
                </div>
                {!isEditing ? (
                    <button onClick={startEdit} className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={cancel} className="text-xs font-bold text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors">Cancelar</button>
                        <button onClick={handleSave} disabled={isSaving} className="text-xs font-bold text-white bg-indigo-600 px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                            {isSaving ? '...' : 'Guardar'}
                        </button>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="p-4">
                {isEditing ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {editItems.map(item => (
                            <div key={item.id} className="flex items-center gap-2">
                                <input
                                    value={item.name}
                                    onChange={e => handleChange(item.id, 'name', e.target.value)}
                                    placeholder="Nombre de la causa..."
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button onClick={() => handleRemove(item.id)} className="p-2 text-red-400 hover:bg-red-500/15 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <button onClick={handleAdd} className="w-full mt-2 p-2 text-xs font-bold text-indigo-400 bg-indigo-500/10 rounded-lg flex items-center justify-center hover:bg-indigo-500/20 transition-colors">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Agregar otro
                        </button>
                    </div>
                ) : (
                    <>
                        {causes.length > 5 && (
                            <div className="relative mb-3">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        )}
                        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                            {filtered.length === 0 && (
                                <p className="text-xs text-slate-500 text-center py-4">Sin resultados</p>
                            )}
                            {filtered.map(cause => (
                                <div key={cause.id} className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg">
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cause.active !== false ? 'bg-indigo-500' : 'bg-slate-600'}`} />
                                    <span className={`text-sm font-medium ${cause.active !== false ? 'text-slate-200' : 'text-slate-500 line-through'}`}>{cause.name}</span>
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
// Area ↔ Task Type Relationship — Summary card + Modal trigger
// ============================================================
function AreaTaskTypeRelationSection({ workAreaTypes, taskTypes }) {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden lg:col-span-2">
                {/* Header */}
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-2xl flex items-center justify-center">
                            <Compass className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm">Relación Áreas ↔ Tipos de Tarea</h3>
                            <p className="text-[11px] text-slate-500">Define qué tipos de tarea pertenecen a cada área · Aplica a todos los milestones</p>
                        </div>
                    </div>
                    <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 text-xs font-bold text-teal-400 hover:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-3 py-1.5 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                </div>
                {/* Quick summary */}
                <div className="p-4">
                    <div className="space-y-1">
                    {(workAreaTypes || []).map(area => {
                            const rawTypes = area.defaultTaskTypes || [];
                            // Resolve: if value is an ID, find name; if it's already a name, show it
                            const resolvedTypes = rawTypes.map(val => {
                                const byId = (taskTypes || []).find(t => t.id === val);
                                if (byId) return byId.name;
                                // Legacy: value is already a name
                                return val;
                            });
                            return (
                                <div key={area.id} className="flex items-center gap-3 px-3 py-2 bg-slate-800/30 rounded-lg">
                                    <div className="w-2 h-2 bg-teal-500 rounded-full flex-shrink-0" />
                                    <span className="text-sm font-semibold text-slate-200 min-w-[90px]">{area.name}</span>
                                    <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                                        {resolvedTypes.length > 0 ? resolvedTypes.map(tt => (
                                            <span key={tt} className="px-2 py-0.5 text-[10px] font-semibold rounded border border-teal-500/30 bg-teal-500/10 text-teal-300 whitespace-nowrap">{tt}</span>
                                        )) : (
                                            <span className="text-[10px] text-slate-500 italic">sin asignar</span>
                                        )}
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0 ${resolvedTypes.length > 0 ? 'text-teal-400 bg-teal-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                                        {resolvedTypes.length}
                                    </span>
                                </div>
                            );
                        })}
                        {(workAreaTypes || []).length === 0 && (
                            <p className="text-xs text-slate-500 text-center py-4">Agrega áreas de trabajo primero.</p>
                        )}
                    </div>
                </div>
            </div>
            <AreaTaskTypeRelationModal
                open={showModal}
                onClose={() => setShowModal(false)}
                workAreaTypes={workAreaTypes}
                taskTypes={taskTypes}
            />
        </>
    );
}


export default function ManagedListsPage() {
    const { managedLists, handleSaveManagedList } = useAppData();
    const { delayCauses, taskTypes, workAreaTypes, milestoneTypes } = useEngineeringData();
    const { canEdit } = useRole();

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <PageHeader title="" showBack={true} />
            {/* Page Header */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-500/15 rounded-2xl flex items-center justify-center">
                    <List className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-white">Listas Gestionadas</h1>
                    <p className="text-sm text-slate-400">Administra todas las listas configurables del sistema en un solo lugar.</p>
                </div>
            </div>

            {/* Grid of Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SimpleListCard
                    title="Proveedores"
                    subtitle="Empresas suministradoras de materiales"
                    icon={Truck}
                    iconBg="bg-cyan-100"
                    iconColor="text-cyan-600"
                    items={managedLists.providers.map(p => p.name)}
                    onSave={(data) => handleSaveManagedList({ type: 'provider', data })}
                />
                <SimpleListCard
                    title="Marcas"
                    subtitle="Marcas comerciales de componentes"
                    icon={Tag}
                    iconBg="bg-violet-100"
                    iconColor="text-violet-600"
                    items={managedLists.brands.map(b => b.name)}
                    onSave={(data) => handleSaveManagedList({ type: 'brand', data })}
                />
                <SimpleListCard
                    title="Categorías"
                    subtitle="Clasificación de partes y componentes"
                    icon={LayoutList}
                    iconBg="bg-amber-100"
                    iconColor="text-amber-600"
                    items={managedLists.categories.map(c => c.name)}
                    onSave={(data) => handleSaveManagedList({ type: 'category', data })}
                />
                <DelayCausesCard causes={delayCauses} />
                <SimpleListCard
                    title="Tipos de Tarea"
                    subtitle="Clasificación de tareas de ingeniería"
                    icon={ListTodo}
                    iconBg="bg-emerald-100"
                    iconColor="text-emerald-600"
                    items={(taskTypes || []).map(t => t.name)}
                    onSave={(data) => handleSaveManagedList({ type: 'taskType', data })}
                />
                <SimpleListCard
                    title="Áreas de Trabajo"
                    subtitle="Disciplinas de ingeniería para milestones"
                    icon={Compass}
                    iconBg="bg-teal-100"
                    iconColor="text-teal-600"
                    items={(workAreaTypes || []).map(t => t.name)}
                    onSave={(data) => handleSaveManagedList({ type: 'workAreaType', data })}
                />
                <AreaTaskTypeRelationSection workAreaTypes={workAreaTypes} taskTypes={taskTypes} />
                <SimpleListCard
                    title="Tipos de Milestone"
                    subtitle="Clasificación de hitos y fases del proyecto"
                    icon={Target}
                    iconBg="bg-purple-100"
                    iconColor="text-purple-600"
                    items={(milestoneTypes || []).map(t => t.name)}
                    onSave={(data) => handleSaveManagedList({ type: 'milestoneType', data })}
                />
            </div>
        </div>
    );
}
