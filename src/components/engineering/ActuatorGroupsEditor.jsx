/**
 * ActuatorGroupsEditor — Editor de Grupos de Actuadores
 * ======================================================
 * UI de control total para gestionar la jerarquía:
 *   Grupo → Subtipos → Acciones → Perfiles (velocidad/tiempo)
 *
 * PERFILES: Tabla matriz — filas = perfiles, columnas = subtipos.
 * Cada celda tiene un checkbox que indica si ese perfil aplica a ese subtipo.
 * applicableSubtypes: [] → aplica a TODOS (retrocompatible).
 *
 * Los datos se persisten en Firestore: settings/actuator_groups
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Plus, Trash2, Save, X, ChevronDown, ChevronUp,
    Layers, Settings, Check, Edit2, GripVertical, Table2
} from 'lucide-react';
import { getActuatorGroups, updateActuatorGroups } from '../../services/timingStudyService';
import { useEngineeringData } from '../../hooks/useEngineeringData';

// ─── Acciones del sistema (base) ──────────────────────────────────────────────
const BASE_SYSTEM_ACTIONS = [
    { id: 'EXT', label: 'Extender' }, { id: 'RET', label: 'Retraer' },
    { id: 'CW', label: 'Giro CW' }, { id: 'CCW', label: 'Giro CCW' },
    { id: 'OPN', label: 'Abrir' }, { id: 'CLS', label: 'Cerrar' },
    { id: 'UP', label: 'Subir' }, { id: 'DWN', label: 'Bajar' },
    { id: 'ADV', label: 'Avanzar' }, { id: 'RTN', label: 'Retornar' },
    { id: 'HOR', label: 'Home' }, { id: 'ON', label: 'ON' },
    { id: 'OFF', label: 'OFF' }, { id: 'READ', label: 'Leer' },
    { id: 'WAIT', label: 'Esperar' }, { id: 'DELAY', label: 'Demora' },
    { id: 'INSPECT', label: 'Inspeccionar' }, { id: '*', label: 'Cualquiera (*)' },
];

/** Merge acciones base + custom del grupo + acciones globales */
function getAllActions(group, globalActions) {
    // Use global actions from DB if available, otherwise fall back to base
    const baseActions = globalActions && globalActions.length > 0
        ? globalActions.map(a => ({ id: a.name || a.id, label: a.description || a.name || a.id }))
        : BASE_SYSTEM_ACTIONS;
    const baseIds = new Set(baseActions.map(a => a.id));
    // Also include any custom actions from the group that aren't in the global list
    const customActions = (group?.actions || [])
        .filter(id => !baseIds.has(id))
        .map(id => ({ id, label: id }));
    return [...baseActions, ...customActions];
}

const UNIT_OPTIONS = ['mm/s', 'deg/s', 'ms'];

// ─── Defaults precargados ─────────────────────────────────────────────────────
export const DEFAULT_ACTUATOR_GROUPS = {
    groups: [
        {
            id: 'grp_cyl', code: 'CYL', label: 'Cilindro',
            needsLinearDistance: true, needsAngularDistance: false, needsValve: true,
            subtypes: ['CYL PNEU', 'CYL ELEC', 'CYL HYD'],
            actions: ['EXT', 'RET'],
            profiles: [
                { id: 'standard_pneumatic_cylinder', name: 'Cilindro Estándar', value: 300, unit: 'mm/s', applicableSubtypes: ['CYL PNEU'] },
                { id: 'guided_cylinder', name: 'Cilindro Guiado', value: 200, unit: 'mm/s', applicableSubtypes: ['CYL PNEU'] },
                { id: 'rodless_cylinder', name: 'Sin Vástago', value: 350, unit: 'mm/s', applicableSubtypes: ['CYL PNEU'] },
                { id: 'short_large_bore_cylinder', name: 'Carrera Corta', value: 450, unit: 'mm/s', applicableSubtypes: ['CYL PNEU'] },
                { id: 'elec_cyl_standard', name: 'Cil. Eléctrico Estándar', value: 400, unit: 'mm/s', applicableSubtypes: ['CYL ELEC'] },
                { id: 'elec_cyl_fast', name: 'Cil. Eléctrico Rápido', value: 800, unit: 'mm/s', applicableSubtypes: ['CYL ELEC'] },
                { id: 'hyd_cyl_standard', name: 'Cil. Hidráulico Estándar', value: 100, unit: 'mm/s', applicableSubtypes: ['CYL HYD'] },
            ]
        },
        {
            id: 'grp_gpr', code: 'GPR', label: 'Gripper / Pinza',
            needsLinearDistance: false, needsAngularDistance: false, needsValve: true,
            subtypes: ['GPR', 'GPR SO', 'GPR SC'],
            actions: ['OPN', 'CLS'],
            profiles: [
                { id: 'small_gripper', name: 'Pinza Chica', value: 150, unit: 'ms', applicableSubtypes: ['GPR', 'GPR SC'] },
                { id: 'large_gripper', name: 'Pinza Grande', value: 200, unit: 'ms', applicableSubtypes: ['GPR'] },
                { id: 'vacuum_gripper', name: 'Ventosa de Vacío', value: 400, unit: 'ms', applicableSubtypes: ['GPR SO'] },
            ]
        },
        {
            id: 'grp_rot', code: 'ROT', label: 'Rotativo',
            needsLinearDistance: false, needsAngularDistance: true, needsValve: true,
            subtypes: ['ROT PNEU', 'ROT ELEC'],
            actions: ['CW', 'CCW'],
            profiles: [
                { id: 'small_rotary_actuator', name: 'Rotativo Chico', value: 600, unit: 'deg/s', applicableSubtypes: ['ROT PNEU'] },
                { id: 'large_rotary_actuator', name: 'Rotativo Grande', value: 2400, unit: 'deg/s', applicableSubtypes: ['ROT PNEU'] },
                { id: 'elec_rotary', name: 'Rotativo Eléctrico', value: 3600, unit: 'deg/s', applicableSubtypes: ['ROT ELEC'] },
            ]
        },
        {
            id: 'grp_sv', code: 'SV', label: 'Servo',
            needsLinearDistance: true, needsAngularDistance: false, needsValve: false,
            subtypes: ['SV'],
            actions: ['ADV', 'RTN', 'HOR'],
            profiles: [
                { id: 'servo_belt_driven', name: 'Banda', value: 500, unit: 'mm/s', applicableSubtypes: [] },
                { id: 'servo_ballscrew_direct_coupled', name: 'Husillo', value: 500, unit: 'mm/s', applicableSubtypes: [] },
                { id: 'servo_timing_belt_driven', name: 'Banda de Tiempo', value: 1000, unit: 'mm/s', applicableSubtypes: [] },
                { id: 'servo_linear_motor', name: 'Motor Lineal', value: 2000, unit: 'mm/s', applicableSubtypes: [] },
            ]
        },
        {
            id: 'grp_robot', code: 'ROBOT', label: 'Robot',
            needsLinearDistance: false, needsAngularDistance: false, needsValve: false,
            subtypes: ['ROBOT'],
            actions: ['*', 'WAIT', 'DELAY'],
            profiles: [
                { id: 'epson_t3_robot', name: 'Epson T3', value: 1500, unit: 'ms', applicableSubtypes: [] },
                { id: 'c6_robot', name: 'C6', value: 1000, unit: 'ms', applicableSubtypes: [] },
            ]
        },
        {
            id: 'grp_feeder', code: 'FEEDER', label: 'Alimentador',
            needsLinearDistance: false, needsAngularDistance: false, needsValve: false,
            subtypes: ['FEEDER', 'VIB'],
            actions: ['ADV', 'RTN', 'ON', 'OFF'],
            profiles: [
                { id: 'escapement_tic_toc', name: 'Escapement', value: 500, unit: 'ms', applicableSubtypes: [] },
            ]
        },
    ]
};

function uid() {
    return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Modal para agregar/editar perfil ────────────────────────────────────────
function ProfileModal({ onSave, onClose, existing = null, subtypes = [], globalProfiles = [] }) {
    const [name, setName] = useState(existing?.name || '');
    const [value, setValue] = useState(existing?.value ?? 0);
    const [unit, setUnit] = useState(existing?.unit || 'mm/s');
    const [search, setSearch] = useState('');

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({
            id: existing?.id || `prof_${uid()}`,
            name: name.trim(),
            value: Number(value),
            unit,
            applicableSubtypes: existing?.applicableSubtypes || []
        });
        onClose();
    };

    const selectGlobal = (profile) => {
        setName(profile.name);
        setValue(profile.value);
        setUnit(profile.unit || 'mm/s');
    };

    const filteredGlobals = globalProfiles.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.unit.toLowerCase().includes(search.toLowerCase())
    );

    const unitBadge = {
        'mm/s': 'bg-blue-500/15 text-blue-400',
        'deg/s': 'bg-amber-500/15 text-amber-400',
        'ms': 'bg-emerald-500/15 text-emerald-400',
    };

    const isNew = !existing;

    return createPortal(
        <div
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className={`relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full ${isNew && globalProfiles.length > 0 ? 'max-w-lg' : 'max-w-sm'} p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-300`}>
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-white">{existing ? 'Editar Perfil' : 'Nuevo Perfil'}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Global profiles selector — only when creating new */}
                {isNew && globalProfiles.length > 0 && (
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Seleccionar de perfiles globales
                        </label>
                        {globalProfiles.length > 6 && (
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Filtrar perfiles..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 mb-1"
                            />
                        )}
                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                            {filteredGlobals.map((p, idx) => {
                                const isSelected = name === p.name && Number(value) === p.value && unit === p.unit;
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => selectGlobal(p)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-cyan-600/20 border border-cyan-500/40 ring-1 ring-cyan-500/30'
                                                : 'bg-slate-950/60 border border-slate-800 hover:border-slate-600 hover:bg-slate-800/80'
                                        }`}
                                    >
                                        <span className={`flex-1 text-xs font-medium truncate ${isSelected ? 'text-cyan-300' : 'text-slate-300'}`}>
                                            {p.name}
                                        </span>
                                        <span className={`font-mono text-xs font-black ${isSelected ? 'text-cyan-400' : 'text-cyan-500/70'}`}>
                                            {p.value}
                                        </span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${unitBadge[p.unit] || 'bg-slate-800 text-slate-400'}`}>
                                            {p.unit}
                                        </span>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                                    </button>
                                );
                            })}
                            {filteredGlobals.length === 0 && (
                                <p className="text-[10px] text-slate-500 text-center py-2">Sin resultados</p>
                            )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <div className="flex-1 h-px bg-slate-800" />
                            <span className="text-[9px] font-bold text-slate-600 uppercase">o personalizar</span>
                            <div className="flex-1 h-px bg-slate-800" />
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre del Perfil</label>
                        <input autoFocus={!!existing} value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Cilindro Estándar"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Valor</label>
                            <input type="number" value={value} onChange={e => setValue(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-cyan-300 focus:outline-none focus:border-cyan-500 font-mono font-bold" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Unidad</label>
                            <select value={unit} onChange={e => setUnit(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 cursor-pointer">
                                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                <p className="text-[10px] text-slate-500 italic">
                    * Los subtipos se asignan directamente en la tabla de la tarjeta.
                </p>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-400 cursor-pointer">Cancelar</button>
                    <button onClick={handleSave} disabled={!name.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40">
                        <Check className="w-3.5 h-3.5" /> Guardar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}


// ─── Tabla Matriz: Perfiles × Subtipos ───────────────────────────────────────
function ProfileSubtypeMatrix({ group, onChange, globalProfiles = [] }) {
    const [profileModal, setProfileModal] = useState(null);

    const { subtypes = [], profiles = [] } = group;

    const addProfile = (profile) => onChange({ ...group, profiles: [...profiles, profile] });
    const editProfile = (profile) => onChange({ ...group, profiles: profiles.map(p => p.id === profile.id ? profile : p) });
    const removeProfile = (id) => onChange({ ...group, profiles: profiles.filter(p => p.id !== id) });

    // Toggle: perfil × subtipo
    const toggleSubtype = (profileId, subtype) => {
        const updated = profiles.map(p => {
            if (p.id !== profileId) return p;
            const current = p.applicableSubtypes || [];
            const hasAll = current.length === 0; // vacío = todos
            let next;
            if (hasAll) {
                // De "todos" → excluir este subtipo (marcar todos menos este)
                next = subtypes.filter(s => s !== subtype);
            } else if (current.includes(subtype)) {
                next = current.filter(s => s !== subtype);
                // Si queda vacío tras quitar → vuelve a "todos"
            } else {
                next = [...current, subtype];
                // Si ahora tiene todos → colapsar a []
                if (next.length === subtypes.length) next = [];
            }
            return { ...p, applicableSubtypes: next };
        });
        onChange({ ...group, profiles: updated });
    };

    // Toggle "todos" para un perfil
    const toggleAll = (profileId) => {
        const updated = profiles.map(p => {
            if (p.id !== profileId) return p;
            const isAll = !p.applicableSubtypes || p.applicableSubtypes.length === 0;
            return { ...p, applicableSubtypes: isAll ? [] : [] }; // [] siempre = todos
        });
        onChange({ ...group, profiles: updated });
    };

    // Chequear si un perfil aplica a un subtipo
    const applies = (profile, subtype) => {
        const subs = profile.applicableSubtypes || [];
        return subs.length === 0 || subs.includes(subtype);
    };

    const isAppliesAll = (profile) => {
        return !profile.applicableSubtypes || profile.applicableSubtypes.length === 0;
    };

    if (subtypes.length === 0 && profiles.length === 0) {
        return (
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Table2 className="w-3.5 h-3.5" /> Perfiles × Subtipos
                    </h4>
                    <button onClick={() => setProfileModal('new')} className="flex items-center gap-1 px-2.5 py-1 bg-cyan-50 dark:bg-cyan-500/10 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 border border-cyan-200 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-400 rounded-lg text-[11px] font-bold cursor-pointer">
                        <Plus className="w-3 h-3" /> Agregar Perfil
                    </button>
                </div>
                <p className="text-xs text-slate-400 italic py-2">Agrega subtipos y perfiles para construir la tabla.</p>
                {profileModal && (
                    <ProfileModal existing={null} subtypes={subtypes} globalProfiles={globalProfiles}
                        onSave={addProfile} onClose={() => setProfileModal(null)} />
                )}
            </div>
        );
    }

    return (
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Table2 className="w-3.5 h-3.5" /> Perfiles × Subtipos
                    <span className="ml-1 text-slate-400 font-normal normal-case tracking-normal">
                        — ✓ = perfil aplica a ese subtipo
                    </span>
                </h4>
                <button
                    onClick={() => setProfileModal('new')}
                    className="flex items-center gap-1 px-2.5 py-1 bg-cyan-50 dark:bg-cyan-500/10 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 border border-cyan-200 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-400 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                    <Plus className="w-3 h-3" /> Agregar Perfil
                </button>
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                            {/* Columna: Perfil */}
                            <th className="text-left px-4 py-2.5 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] min-w-[180px]">
                                Perfil
                            </th>
                            {/* Columna: Valor/Unidad */}
                            <th className="text-center px-3 py-2.5 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] w-24">
                                Valor
                            </th>
                            {/* Columna: Todos */}
                            <th className="text-center px-3 py-2.5 font-black text-slate-400 uppercase tracking-wider text-[10px] w-14">
                                Todos
                            </th>
                            {/* Columna por Subtipo */}
                            {subtypes.map(sub => (
                                <th key={sub} className="text-center px-3 py-2.5 font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[10px] w-20">
                                    {sub}
                                </th>
                            ))}
                            {/* Acciones */}
                            <th className="w-16" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {profiles.map((profile, rowIdx) => {
                            const allApply = isAppliesAll(profile);
                            return (
                                <tr key={profile.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                    {/* Nombre del perfil */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                                            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{profile.name}</span>
                                        </div>
                                    </td>
                                    {/* Valor */}
                                    <td className="px-3 py-3 text-center">
                                        <span className="font-black font-mono text-sm text-cyan-600 dark:text-cyan-400">{profile.value}</span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1">{profile.unit}</span>
                                    </td>
                                    {/* Todos checkbox */}
                                    <td className="px-3 py-3 text-center">
                                        <button
                                            onClick={() => onChange({
                                                ...group,
                                                profiles: profiles.map(p =>
                                                    p.id === profile.id ? { ...p, applicableSubtypes: [] } : p
                                                )
                                            })}
                                            title={allApply ? 'Aplica a todos los subtipos' : 'Clic para aplicar a todos'}
                                            className={`mx-auto w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer border ${
                                                allApply
                                                    ? 'bg-cyan-500 border-cyan-500 text-white'
                                                    : 'border-slate-300 dark:border-slate-600 hover:border-cyan-400 text-transparent hover:text-cyan-400'
                                            }`}
                                        >
                                            <Check className="w-3 h-3" />
                                        </button>
                                    </td>
                                    {/* Checkbox por subtipo */}
                                    {subtypes.map(sub => {
                                        const checked = applies(profile, sub);
                                        return (
                                            <td key={sub} className="px-3 py-3 text-center">
                                                <button
                                                    onClick={() => toggleSubtype(profile.id, sub)}
                                                    title={checked ? `Quitar ${sub}` : `Agregar ${sub}`}
                                                    className={`mx-auto w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer border ${
                                                        checked
                                                            ? 'bg-indigo-500 border-indigo-500 text-white'
                                                            : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 text-transparent hover:text-indigo-400'
                                                    }`}
                                                >
                                                    <Check className="w-3 h-3" />
                                                </button>
                                            </td>
                                        );
                                    })}
                                    {/* Editar / Eliminar */}
                                    <td className="px-2 py-3">
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setProfileModal(profile)}
                                                className="p-1 rounded text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-colors cursor-pointer">
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => removeProfile(profile.id)}
                                                className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {profiles.length === 0 && (
                <p className="text-xs text-slate-400 italic py-2">Sin perfiles definidos.</p>
            )}

            {/* Modal */}
            {profileModal && (
                <ProfileModal
                    existing={profileModal === 'new' ? null : profileModal}
                    subtypes={subtypes}
                    globalProfiles={globalProfiles}
                    onSave={profileModal === 'new' ? addProfile : editProfile}
                    onClose={() => setProfileModal(null)}
                />
            )}
        </div>
    );
}

// ─── Tarjeta de Grupo ────────────────────────────────────────────────────────
function ActuatorGroupCard({ group, onChange, onDelete, globalActions, globalProfiles = [] }) {
    const [expanded, setExpanded] = useState(true);
    const [newSubtype, setNewSubtype] = useState('');
    const [editingCode, setEditingCode] = useState(false);
    const [editingLabel, setEditingLabel] = useState(false);

    const updateField = (field, value) => onChange({ ...group, [field]: value });

    const addSubtype = () => {
        const val = newSubtype.trim().toUpperCase();
        if (!val || group.subtypes.includes(val)) return;
        onChange({ ...group, subtypes: [...group.subtypes, val] });
        setNewSubtype('');
    };

    const removeSubtype = (sub) => {
        // Al eliminar subtipo, limpiar de applicableSubtypes de todos los perfiles
        const updatedProfiles = (group.profiles || []).map(p => ({
            ...p,
            applicableSubtypes: (p.applicableSubtypes || []).filter(s => s !== sub)
        }));
        onChange({ ...group, subtypes: group.subtypes.filter(s => s !== sub), profiles: updatedProfiles });
    };

    const toggleAction = (actionId) => {
        const has = group.actions.includes(actionId);
        onChange({ ...group, actions: has ? group.actions.filter(a => a !== actionId) : [...group.actions, actionId] });
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors border-b border-slate-100 dark:border-slate-800"
                onClick={() => setExpanded(v => !v)}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center shrink-0">
                        <Layers className="w-4 h-4 text-cyan-500" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            {editingCode ? (
                                <input autoFocus value={group.code} onClick={e => e.stopPropagation()}
                                    onChange={e => updateField('code', e.target.value.toUpperCase())}
                                    onBlur={() => setEditingCode(false)} onKeyDown={e => e.key === 'Enter' && setEditingCode(false)}
                                    className="text-sm font-black text-white bg-slate-800 border border-slate-700 rounded px-2 py-0.5 focus:outline-none focus:border-cyan-500 uppercase w-28" />
                            ) : (
                                <span className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider"
                                    onDoubleClick={e => { e.stopPropagation(); setEditingCode(true); }}>{group.code}</span>
                            )}
                            <button onClick={e => { e.stopPropagation(); setEditingCode(true); }}
                                className="p-0.5 text-slate-400 hover:text-cyan-400 transition-colors">
                                <Edit2 className="w-3 h-3" />
                            </button>
                        </div>
                        {editingLabel ? (
                            <input autoFocus value={group.label} onClick={e => e.stopPropagation()}
                                onChange={e => updateField('label', e.target.value)}
                                onBlur={() => setEditingLabel(false)} onKeyDown={e => e.key === 'Enter' && setEditingLabel(false)}
                                className="text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 focus:outline-none focus:border-cyan-500 w-48 mt-0.5" />
                        ) : (
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium cursor-text"
                                onDoubleClick={e => { e.stopPropagation(); setEditingLabel(true); }}>
                                {group.label || 'Sin descripción'}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {group.subtypes.length} subtipos · {group.profiles.length} perfiles
                    </span>
                    <button onClick={e => { e.stopPropagation(); onDelete(); }}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
            </div>

            {/* Cuerpo */}
            {expanded && (
                <div className="p-5 space-y-5">
                    {/* SUBTIPOS */}
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Subtipos de Actuador</h4>
                        <div className="flex flex-wrap gap-1.5">
                            {group.subtypes.map(sub => (
                                <span key={sub} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                    {sub}
                                    <button onClick={() => removeSubtype(sub)} className="text-indigo-400 hover:text-rose-500 ml-0.5 cursor-pointer">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                            <div className="flex items-center gap-1">
                                <input value={newSubtype} onChange={e => setNewSubtype(e.target.value.toUpperCase())}
                                    onKeyDown={e => e.key === 'Enter' && addSubtype()} placeholder="+ SUBTIPO"
                                    className="w-24 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:border-indigo-500 uppercase placeholder-slate-400" />
                                <button onClick={addSubtype}
                                    className="p-1 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors cursor-pointer">
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ACCIONES */}
                    <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones Válidas (click para activar/desactivar)</h4>
                        <div className="flex flex-wrap gap-1.5">
                            {getAllActions(group, globalActions).map(action => {
                                const active = group.actions.includes(action.id);
                                return (
                                    <button key={action.id} onClick={() => toggleAction(action.id)} title={action.label}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all cursor-pointer ${
                                            active
                                                ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-400 dark:border-teal-500/50 text-teal-700 dark:text-teal-300'
                                                : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-teal-400 dark:hover:border-teal-500/50 hover:text-teal-600'
                                        }`}>
                                        {active && <Check className="w-2.5 h-2.5 shrink-0" />}
                                        {action.id}
                                    </button>
                                );
                            })}
                        </div>
                        {(!globalActions || globalActions.length === 0) && (
                            <p className="text-[10px] text-amber-500 italic">Cargando acciones globales...</p>
                        )}
                    </div>

                    {/* OPCIONES DE CÁLCULO */}
                    <div className="flex flex-wrap gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider w-full">Opciones de Cálculo</h4>
                        {[
                            { field: 'needsLinearDistance', label: 'Requiere Distancia Lineal (mm)' },
                            { field: 'needsAngularDistance', label: 'Requiere Distancia Angular (deg)' },
                            { field: 'needsValve', label: 'Suma Respuesta de Válvula' },
                        ].map(opt => (
                            <label key={opt.field} className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={!!group[opt.field]} onChange={e => updateField(opt.field, e.target.checked)}
                                    className="w-3.5 h-3.5 rounded text-cyan-600 cursor-pointer" />
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{opt.label}</span>
                            </label>
                        ))}
                    </div>

                    {/* TABLA MATRIZ: PERFILES × SUBTIPOS */}
                    <ProfileSubtypeMatrix group={group} onChange={onChange} globalProfiles={globalProfiles} />
                </div>
            )}
        </div>
    );
}

// ─── Componente Principal ────────────────────────────────────────────────────
export default function ActuatorGroupsEditor() {
    const [groups, setGroups] = useState(null);
    const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // idle | saving | saved | error
    const { timingActions, motionProfiles } = useEngineeringData();
    const isInitialLoad = useRef(true);
    const saveTimerRef = useRef(null);

    useEffect(() => {
        async function load() {
            try {
                const data = await getActuatorGroups();
                if (data && Array.isArray(data.groups) && data.groups.length > 0) {
                    setGroups(data.groups);
                } else {
                    setGroups(DEFAULT_ACTUATOR_GROUPS.groups);
                    await updateActuatorGroups(DEFAULT_ACTUATOR_GROUPS);
                }
            } catch (err) {
                console.error('Error cargando grupos de actuadores:', err);
                setGroups(DEFAULT_ACTUATOR_GROUPS.groups);
            }
        }
        load();
    }, []);

    // Auto-save with debounce
    useEffect(() => {
        if (!groups) return;
        if (isInitialLoad.current) {
            isInitialLoad.current = false;
            return;
        }
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        setAutoSaveStatus('saving');
        saveTimerRef.current = setTimeout(async () => {
            try {
                await updateActuatorGroups({ groups });
                setAutoSaveStatus('saved');
                setTimeout(() => setAutoSaveStatus('idle'), 2500);
            } catch (err) {
                console.error('Auto-save error:', err);
                setAutoSaveStatus('error');
                setTimeout(() => setAutoSaveStatus('idle'), 4000);
            }
        }, 1500);
        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, [groups]);

    const handleChange = useCallback((idx, updated) => {
        setGroups(prev => prev.map((g, i) => i === idx ? updated : g));
    }, []);

    const handleDelete = useCallback((idx) => {
        if (!confirm('¿Eliminar este grupo de actuadores?')) return;
        setGroups(prev => prev.filter((_, i) => i !== idx));
    }, []);

    const handleAdd = () => {
        setGroups(prev => [...prev, {
            id: `grp_${uid()}`, code: 'NUEVO', label: 'Nuevo Grupo',
            needsLinearDistance: false, needsAngularDistance: false, needsValve: false,
            subtypes: [], actions: [], profiles: []
        }]);
    };

    if (!groups) {
        return (
            <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin" />
                    <span className="text-xs font-semibold text-slate-500">Cargando grupos de actuadores...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-xl flex items-center justify-center shrink-0">
                        <Settings className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-slate-800 dark:text-white">Grupos de Actuadores</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Grupo → Subtipos → Acciones → Perfiles (tabla de asignación por subtipo)</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {/* Auto-save status indicator */}
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold min-w-[100px] justify-end">
                        {autoSaveStatus === 'saving' && (
                            <>
                                <div className="w-3 h-3 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
                                <span className="text-cyan-500">Guardando...</span>
                            </>
                        )}
                        {autoSaveStatus === 'saved' && (
                            <>
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-emerald-500">Guardado</span>
                            </>
                        )}
                        {autoSaveStatus === 'error' && (
                            <>
                                <X className="w-3.5 h-3.5 text-rose-500" />
                                <span className="text-rose-500">Error al guardar</span>
                            </>
                        )}
                    </div>
                    <button onClick={handleAdd} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer">
                        <Plus className="w-4 h-4" /> Nuevo Grupo
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {groups.map((group, idx) => (
                    <ActuatorGroupCard key={group.id} group={group}
                        onChange={(updated) => handleChange(idx, updated)}
                        onDelete={() => handleDelete(idx)}
                        globalActions={timingActions}
                        globalProfiles={motionProfiles || []} />
                ))}
            </div>

            {groups.length === 0 && (
                <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center">
                    <Layers className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-500">No hay grupos definidos</p>
                    <button onClick={handleAdd} className="mt-3 text-xs font-bold text-cyan-500 hover:text-cyan-400 cursor-pointer">
                        + Crear primer grupo
                    </button>
                </div>
            )}
        </div>
    );
}
