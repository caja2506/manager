/**
 * MotionStandardsKanban — Parámetros de Tiempo de Movimiento
 * ===========================================================
 * Configura los valores de tiempo/velocidad globales del sistema:
 *   - Scan time, Valve response, EOAT relay, Robot settle times
 *
 * NOTA: El mapeo Clasificadores → Perfiles fue eliminado y reemplazado
 * por ActuatorGroupsEditor (tabla Perfiles × Subtipos).
 *
 * Los datos se persisten en Firestore: settings/standardsConfig
 */

import React, { useState, useEffect } from 'react';
import { Save, Check, X, ChevronDown, ChevronUp, Settings2, Clock } from 'lucide-react';

// ─── Valores por defecto ─────────────────────────────────────────────────────
export const DEFAULT_MOTION_TIME_VALUES = {
    scan_time: 20,
    valve_response: 30,
    eoat_relay: 10,
    epson_t3_robot: 1500,
    c6_robot: 1000,
};

// ─── Campos configurables ────────────────────────────────────────────────────
const TIME_FIELDS = [
    {
        section: 'Sistema de Control',
        fields: [
            { id: 'scan_time', label: 'Scan Time del PLC', unit: 'ms', description: 'Tiempo de ciclo del scan del controlador' },
        ]
    },
    {
        section: 'Neumática',
        fields: [
            { id: 'valve_response', label: 'Respuesta de Válvula', unit: 'ms', description: 'Tiempo de respuesta de electroválvulas neumáticas' },
        ]
    },
    {
        section: 'EOAT / End Effector',
        fields: [
            { id: 'eoat_relay', label: 'Relay EOAT', unit: 'ms', description: 'Tiempo de respuesta relay de herramienta' },
        ]
    },
    {
        section: 'Robots',
        fields: [
            { id: 'epson_t3_robot', label: 'Epson T3 — Settle Time', unit: 'ms', description: 'Tiempo de asentamiento Epson T3' },
            { id: 'c6_robot', label: 'C6 Robot — Settle Time', unit: 'ms', description: 'Tiempo de asentamiento robot C6' },
        ]
    },
];

// ─── Componente Principal ────────────────────────────────────────────────────
export default function MotionStandardsKanban({ globalData, onSave }) {
    const [values, setValues] = useState(DEFAULT_MOTION_TIME_VALUES);
    const [isSaving, setIsSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [expandedSections, setExpandedSections] = useState({});

    // Cargar datos desde globalData (prop del padre)
    useEffect(() => {
        if (globalData?.motionTimeValues) {
            setValues(prev => ({ ...prev, ...globalData.motionTimeValues }));
        }
    }, [globalData]);

    const handleChange = (id, val) => {
        setValues(prev => ({ ...prev, [id]: Number(val) || 0 }));
    };

    const handleSave = async () => {
        if (!onSave) return;
        setIsSaving(true); setSavedMsg(''); setErrorMsg('');
        try {
            await onSave({ motionTimeValues: values, classifiers: globalData?.classifiers || [] });
            setSavedMsg('Parámetros guardados correctamente.');
            setTimeout(() => setSavedMsg(''), 4000);
        } catch (err) {
            setErrorMsg(`Error al guardar: ${err.message}`);
            setTimeout(() => setErrorMsg(''), 5000);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    return (
        <div className="w-full space-y-4">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-xl flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-slate-800 dark:text-white">Parámetros de Tiempo</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Valores globales de scan, válvulas, EOAT y robots usados en el cálculo de duración
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition shadow-md disabled:opacity-50 cursor-pointer shrink-0"
                >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Guardando...' : 'Guardar'}
                </button>
            </div>

            {/* Toasts */}
            {savedMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-300">
                    <Check className="w-4 h-4 shrink-0" /> {savedMsg}
                </div>
            )}
            {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2">
                    <X className="w-4 h-4 shrink-0" /> {errorMsg}
                </div>
            )}

            {/* Secciones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TIME_FIELDS.map(({ section, fields }) => {
                    const isExpanded = expandedSections[section] !== false; // default open
                    return (
                        <div key={section} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden">
                            {/* Sección header */}
                            <button
                                onClick={() => toggleSection(section)}
                                className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Settings2 className="w-3.5 h-3.5 text-violet-500" />
                                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">{section}</span>
                                </div>
                                {isExpanded
                                    ? <ChevronUp className="w-4 h-4 text-slate-400" />
                                    : <ChevronDown className="w-4 h-4 text-slate-400" />
                                }
                            </button>

                            {isExpanded && (
                                <div className="p-5 space-y-4">
                                    {fields.map(field => (
                                        <div key={field.id}>
                                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                {field.label}
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={values[field.id] ?? 0}
                                                    onChange={e => handleChange(field.id, e.target.value)}
                                                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-black text-violet-600 dark:text-violet-400 font-mono focus:outline-none focus:border-violet-500 transition-colors"
                                                />
                                                <span className="text-xs font-bold text-slate-500 w-8 shrink-0">{field.unit}</span>
                                            </div>
                                            {field.description && (
                                                <p className="text-[10px] text-slate-400 mt-1 italic">{field.description}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
