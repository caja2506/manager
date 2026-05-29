import React, { useState } from 'react';
import { Edit2, Trash2, Plus, Search } from 'lucide-react';

/**
 * MotionProfilesCard — Card para perfiles globales de movimiento
 * ==============================================================
 * Cada perfil tiene: nombre, valor numérico, unidad.
 */

const UNIT_OPTIONS = ['mm/s', 'deg/s', 'ms'];

export default function MotionProfilesCard({ title, subtitle, icon: Icon, iconBg, iconColor, items, onSave }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editItems, setEditItems] = useState([]);
    const [search, setSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const startEdit = () => {
        setEditItems(items.map((item, i) => ({
            id: `e-${i}`,
            name: item.name,
            value: item.value,
            unit: item.unit || 'mm/s',
            originalName: item.name,
        })));
        setIsEditing(true);
    };

    const handleAdd = () => {
        setEditItems(prev => [...prev, { id: `n-${Date.now()}`, name: '', value: 0, unit: 'mm/s', originalName: null }]);
    };

    const handleRemove = (id) => {
        setEditItems(prev => prev.filter(i => i.id !== id));
    };

    const handleChange = (id, field, val) => {
        setEditItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(editItems.filter(i => i.name.trim()));
            setIsEditing(false);
        } catch (err) {
            console.error('Error saving motion profiles:', err);
            alert('Error al guardar: ' + (err.message || 'Error desconocido'));
        }
        setIsSaving(false);
    };

    const cancel = () => { setIsEditing(false); setEditItems([]); };

    const filtered = items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.unit.toLowerCase().includes(search.toLowerCase())
    );

    // Group by unit
    const unitGroups = {};
    filtered.forEach(item => {
        const u = item.unit || 'mm/s';
        if (!unitGroups[u]) unitGroups[u] = [];
        unitGroups[u].push(item);
    });

    const unitLabel = { 'mm/s': 'Velocidad Lineal', 'deg/s': 'Velocidad Angular', 'ms': 'Tiempo Fijo' };
    const unitBadge = {
        'mm/s': 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
        'deg/s': 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
        'ms': 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden h-full flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${iconBg} rounded-2xl flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-sm">{title}</h3>
                        <p className="text-[11px] text-slate-500">{subtitle} · {items.length} registros</p>
                    </div>
                </div>
                {!isEditing ? (
                    <button onClick={startEdit} className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                        <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={cancel} className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">Cancelar</button>
                        <button onClick={handleSave} disabled={isSaving} className="text-xs font-bold text-white bg-indigo-600 px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer">
                            {isSaving ? '...' : 'Guardar'}
                        </button>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="p-4 flex-1 overflow-hidden flex flex-col">
                {isEditing ? (
                    <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                        {editItems.map(item => (
                            <div key={item.id} className="flex items-center gap-2">
                                <input
                                    value={item.name}
                                    onChange={e => handleChange(item.id, 'name', e.target.value)}
                                    placeholder="Nombre del perfil..."
                                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <input
                                    type="number"
                                    value={item.value}
                                    onChange={e => handleChange(item.id, 'value', Number(e.target.value))}
                                    placeholder="0"
                                    className="w-20 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-xs font-black text-cyan-600 dark:text-cyan-400 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <select
                                    value={item.unit}
                                    onChange={e => handleChange(item.id, 'unit', e.target.value)}
                                    className="w-20 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-1 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                                <button onClick={() => handleRemove(item.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-lg transition-colors cursor-pointer shrink-0">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <button onClick={handleAdd} className="w-full mt-2 p-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors cursor-pointer">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Agregar perfil
                        </button>
                    </div>
                ) : (
                    <>
                        {items.length > 5 && (
                            <div className="relative mb-3 shrink-0">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        )}
                        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                            {filtered.length === 0 && (
                                <p className="text-xs text-slate-500 text-center py-4">Sin resultados</p>
                            )}
                            {Object.entries(unitGroups).map(([unit, profileList]) => (
                                <div key={unit}>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black ${unitBadge[unit] || 'bg-slate-100 text-slate-600'}`}>
                                            {unitLabel[unit] || unit}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold">{unit}</span>
                                    </div>
                                    <div className="space-y-1">
                                        {profileList.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-transparent">
                                                <span className="flex-1 text-sm text-slate-600 dark:text-slate-300 font-medium truncate">
                                                    {item.name}
                                                </span>
                                                <span className="inline-flex items-center gap-1 shrink-0">
                                                    <span className="font-black font-mono text-sm text-cyan-600 dark:text-cyan-400">
                                                        {item.value}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-bold">
                                                        {item.unit}
                                                    </span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
