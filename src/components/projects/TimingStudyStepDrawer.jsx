/**
 * TimingStudyStepDrawer — Modal de Edición de Pasos
 * ==================================================
 * Usa los grupos de actuadores dinámicos desde Firestore para:
 *  - Filtrar acciones válidas por grupo
 *  - Mostrar perfiles (velocidad/tiempo) por grupo
 *  - Calcular duración automáticamente al ingresar distancia
 */

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Sparkles, ListTodo, Zap, AlertTriangle } from 'lucide-react';
import {
    TIMING_DEVICE_TYPES,
    TIMING_SENSOR_TYPES,
    calculateSuggestedDuration,
} from '../../models/schemas';
import { DEFAULT_ACTUATOR_GROUPS } from '../engineering/ActuatorGroupsEditor';
import { useEngineeringData } from '../../hooks/useEngineeringData';

// Labels de display
const DEVICE_LABELS = {
    'CAM': 'Cámara/Visión', 'CYL PNEU': 'Cil. Neumático', 'CYL ELEC': 'Cil. Eléctrico',
    'CYL HYD': 'Cil. Hidráulico', 'DISP': 'Dispensador', 'FEEDER': 'Alimentador',
    'GPR': 'Gripper/Pinza', 'GPR SO': 'Grip. Resorte Abierto', 'GPR SC': 'Grip. Resorte Cerrado',
    'HEAT CRT': 'Cartucho Calefactor', 'INDEXER': 'Indexador', 'IONIZER': 'Ionizador',
    'LASER': 'Marcador Láser', 'LT CURT': 'Cortina Luz', 'SV': 'Servo',
    'ST': 'Stepper/Motor Paso a Paso', 'ROBOT': 'Robot', 'ROD LOCK': 'Bloq. Vástago',
    'ROT PNEU': 'Rot. Neumático/Aire', 'ROT ELEC': 'Rot. Eléctrico', 'MAN': 'Op. Manual',
    'MTR': 'Motor', 'VAC GEN': 'Generador de Vacío', 'VAC PMP': 'Bomba de Vacío',
    'VFD': 'Variador Frecuencia (VFD)', 'VIB': 'Alimentador Vibratorio',
    'VISN LT': 'Iluminación Visión', 'WELDER': 'Soldadora', 'LIGHT': 'Indicador Luminoso',
    'HORN': 'Alarma Sonora', 'MISC': 'Misceláneo', 'VAL': 'Válvula Neumática',
};

const ACTION_LABELS = {
    'EXT': 'Extender', 'RET': 'Retraer', 'CW': 'Giro CW', 'CCW': 'Giro CCW',
    'OPN': 'Abrir', 'CLS': 'Cerrar', 'UP': 'Subir', 'DWN': 'Bajar',
    'ADV': 'Avanzar', 'RTN': 'Retornar', 'HOR': 'Home', 'ON': 'Activar (ON)',
    'OFF': 'Desactivar (OFF)', 'READ': 'Leer', 'WAIT': 'Esperar',
    'DELAY': 'Demora', 'INSPECT': 'Inspeccionar', '*': 'Cualquiera',
};

const SENSOR_LABELS = {
    'ANLG': 'Sensor Analógico', 'CNTRL': 'Señal Control', 'ENC': 'Encoder',
    'FO': 'Fibra Óptica', 'HS': 'Sensor Hall/Reed', 'HS AM': 'Hall Anti-Mag',
    'LS': 'Limit Switch', 'LVDT': 'Transd. LVDT', 'LC': 'Celda Carga',
    'PE': 'Fotoeléctrico', 'PLC': 'Señal PLC', 'PS': 'Presostato',
    'PX': 'Prox. Inductivo', 'PX AM': 'Prox. Anti-Mag', 'RF': 'RFID',
    'TC': 'Termopar', 'VS': 'Sensor Visión', 'VISN': 'Cámara Visión',
    'PB': 'Pulsador', 'FRC/DIST': 'Fuerza/Distancia',
};

// ─── Helper: buscar grupo al que pertenece un subtipo ────────────────────────
function findGroupForSubtype(deviceType, actuatorGroups) {
    if (!deviceType || !actuatorGroups) return null;
    return actuatorGroups.find(g => g.subtypes && g.subtypes.includes(deviceType)) || null;
}

// ─── Helper: obtener velocidad del perfil ────────────────────────────────────
function getProfileSpeed(profileId, group, standardsConfig) {
    if (!profileId || !group) return null;
    const profile = group.profiles?.find(p => p.id === profileId);
    if (!profile) return null;

    // Si hay override en standardsConfig
    const motionValues = standardsConfig?.motionTimeValues || {};
    if (motionValues[profileId] !== undefined) {
        const unit = standardsConfig?.motionTimeUnits?.[profileId] || profile.unit;
        return { value: Number(motionValues[profileId]), unit };
    }
    return { value: profile.value, unit: profile.unit };
}

// ─── Calcular duración automáticamente ───────────────────────────────────────
function calcDurationFromProfile(profileId, group, linearDistanceMm, angularDistanceDeg, standardsConfig) {
    const speed = getProfileSpeed(profileId, group, standardsConfig);
    if (!speed) return null;

    const motionValues = standardsConfig?.motionTimeValues || {};
    // Soportar ambas keys por compatibilidad: 'scan_time' (nueva) y 'controller_scan_network' (legacy)
    const scanTime = Number(motionValues['scan_time'] ?? motionValues['controller_scan_network'] ?? 20);
    const valveTime = Number(motionValues['valve_response'] ?? 30);
    const needsValve = group?.needsValve ?? false;

    let duration = 0;
    if (speed.unit === 'mm/s') {
        if (linearDistanceMm > 0 && speed.value > 0) duration = (linearDistanceMm / speed.value) * 1000;
    } else if (speed.unit === 'deg/s') {
        if (angularDistanceDeg > 0 && speed.value > 0) duration = (angularDistanceDeg / speed.value) * 1000;
    } else {
        // ms fijo (gripper, robot, feeder)
        duration = speed.value;
    }

    if (duration > 0) {
        duration += scanTime;
        if (needsValve) duration += valveTime;
    }
    return duration > 0 ? Math.round(duration) : null;
}

// ─── Desglose detallado del cálculo ───────────────────────────────────────
function calcBreakdown(profileId, group, linearDistanceMm, angularDistanceDeg, standardsConfig) {
    const speed = getProfileSpeed(profileId, group, standardsConfig);
    if (!speed) return null;

    const motionValues = standardsConfig?.motionTimeValues || {};
    const scanTime = Number(motionValues['scan_time'] ?? motionValues['controller_scan_network'] ?? 20);
    const valveTime = Number(motionValues['valve_response'] ?? 30);
    const needsValve = group?.needsValve ?? false;

    const lines = [];
    let motionMs = 0;

    if (speed.unit === 'mm/s' && linearDistanceMm > 0 && speed.value > 0) {
        motionMs = (linearDistanceMm / speed.value) * 1000;
        lines.push({ label: `${linearDistanceMm} mm ÷ ${speed.value} mm/s`, value: Math.round(motionMs), unit: 'ms', highlight: true });
    } else if (speed.unit === 'deg/s' && angularDistanceDeg > 0 && speed.value > 0) {
        motionMs = (angularDistanceDeg / speed.value) * 1000;
        lines.push({ label: `${angularDistanceDeg}° ÷ ${speed.value} deg/s`, value: Math.round(motionMs), unit: 'ms', highlight: true });
    } else if (speed.unit === 'ms') {
        motionMs = speed.value;
        lines.push({ label: 'Tiempo fijo', value: motionMs, unit: 'ms', highlight: true });
    }

    if (motionMs > 0) {
        lines.push({ label: '+ scan_time', value: scanTime, unit: 'ms', highlight: false });
        if (needsValve) lines.push({ label: '+ valve_response', value: valveTime, unit: 'ms', note: `(${group?.code || 'actuador'} usa válvula)`, highlight: false });
    }

    const total = motionMs > 0 ? Math.round(motionMs + scanTime + (needsValve ? valveTime : 0)) : null;
    return { lines, total };
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function TimingStudyStepDrawer({
    isOpen,
    onClose,
    step,
    stations = [],
    allSteps = [],
    onSave,
    standardsConfig = null,
    actuatorGroups = null,
    getValidActionsForDevice
}) {
    const [formData, setFormData] = useState(null);
    const [autoCalculated, setAutoCalculated] = useState(false);
    const { timingActions: globalTimingActions } = useEngineeringData();

    // Los grupos a usar: los dinámicos de Firestore o los defaults
    const groups = useMemo(() =>
        (actuatorGroups && actuatorGroups.length > 0) ? actuatorGroups : DEFAULT_ACTUATOR_GROUPS.groups
    , [actuatorGroups]);

    // Effect 1: Inicializar form completo cuando cambia el step o se abre el modal
    useEffect(() => {
        if (step) {
            const resolvedGroups = (actuatorGroups && actuatorGroups.length > 0)
                ? actuatorGroups
                : DEFAULT_ACTUATOR_GROUPS.groups;
            const grp = findGroupForSubtype(step.deviceType || '', resolvedGroups);
            setFormData({
                id: step.id,
                stationId: step.stationId || '',
                selectedGroupId: grp?.id || '',
                deviceType: step.deviceType || '',
                deviceLetter: step.deviceLetter || '',
                deviceQty: step.deviceQty !== undefined ? step.deviceQty : 1,
                deviceAction: step.deviceAction || '',
                motionProfileId: step.motionProfileId || '',
                sensorType: step.sensorType || '',
                sensorLetter: step.sensorLetter || '',
                sensorQty: step.sensorQty !== undefined ? step.sensorQty : 0,
                linearDistanceMm: step.linearDistanceMm || 0,
                angularDistanceDeg: step.angularDistanceDeg || 0,
                taskDescription: step.taskDescription || '',
                triggerCondition: step.triggerCondition || '',
                lagMs: step.lagMs || 0,
                startTimeMs: step.startTimeMs || 0,
                durationMs: step.durationMs || 0,
                sequenceGroup: step.sequenceGroup || '',
                waitsForMainIndex: !!step.waitsForMainIndex,
                canRunDuringIndex: !!step.canRunDuringIndex,
                dependencyStepIds: Array.isArray(step.dependencyStepIds) ? [...step.dependencyStepIds] : [],
                notes: step.notes || ''
            });
            setAutoCalculated(false);
        } else {
            setFormData(null);
        }
    }, [step, isOpen]); // NO incluir actuatorGroups aquí — ver Effect 2

    // Effect 2: Solo actualizar selectedGroupId cuando actuatorGroups carga de Firestore
    // Sin tocar motionProfileId ni otros campos del form
    useEffect(() => {
        if (!formData || !formData.deviceType) return;
        if (formData.selectedGroupId) return; // Ya tiene grupo → no resetear
        const resolvedGroups = (actuatorGroups && actuatorGroups.length > 0)
            ? actuatorGroups
            : DEFAULT_ACTUATOR_GROUPS.groups;
        const grp = findGroupForSubtype(formData.deviceType, resolvedGroups);
        if (grp) {
            setFormData(prev => prev ? { ...prev, selectedGroupId: grp.id } : prev);
        }
    }, [actuatorGroups]); // Solo se dispara cuando cambian los grupos


    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // ─── Grupo del dispositivo actual ────────────────────────────────────────
    const currentGroup = useMemo(() =>
        findGroupForSubtype(formData?.deviceType, groups)
    , [formData?.deviceType, groups]);

    // ─── Acciones válidas del grupo ──────────────────────────────────────────
    const validActions = useMemo(() => {
        if (!formData?.deviceType) {
            // Fallback: mostrar todas las acciones globales
            if (globalTimingActions && globalTimingActions.length > 0) {
                return globalTimingActions.map(a => a.name || a.id);
            }
            return Object.values({ EXT:'EXT', RET:'RET', OPN:'OPN', CLS:'CLS', CW:'CW', CCW:'CCW', ADV:'ADV', RTN:'RTN', HOR:'HOR', ON:'ON', OFF:'OFF', READ:'READ', WAIT:'WAIT', DELAY:'DELAY', INSPECT:'INSPECT' });
        }
        if (currentGroup && currentGroup.actions && currentGroup.actions.length > 0) {
            return currentGroup.actions;
        }
        // Fallback al prop externo
        return getValidActionsForDevice ? getValidActionsForDevice(formData.deviceType) : [];
    }, [formData?.deviceType, currentGroup, getValidActionsForDevice, globalTimingActions]);

    // ─── Perfiles del grupo filtrados por el subtipo seleccionado ───────────────
    const availableProfiles = useMemo(() => {
        const all = currentGroup?.profiles || [];
        if (!formData?.deviceType) return all;
        return all.filter(p => {
            const subs = p.applicableSubtypes;
            // applicableSubtypes vacío o undefined → aplica a todos
            return !subs || subs.length === 0 || subs.includes(formData.deviceType);
        });
    }, [currentGroup, formData?.deviceType]);


    const profileSpeedInfo = useMemo(() =>
        getProfileSpeed(formData?.motionProfileId, currentGroup, standardsConfig)
    , [formData?.motionProfileId, currentGroup, standardsConfig]);

    // ── Predecesor máximo y discrepancias físicas ──
    const maxDepFinish = useMemo(() => {
        if (!formData) return 0;
        const deps = formData.dependencyStepIds || [];
        if (deps.length === 0) return 0;
        let maxFinish = 0;
        for (const depId of deps) {
            const depStep = allSteps.find(s => s.id === depId);
            if (depStep) {
                maxFinish = Math.max(maxFinish, depStep.finishTimeMs || 0);
            }
        }
        return maxFinish;
    }, [formData?.dependencyStepIds, allSteps]);

    const suggestedDuration = useMemo(() => {
        if (!formData || !formData.deviceType) return null;
        return calculateSuggestedDuration(formData, { customStandards: standardsConfig });
    }, [formData, standardsConfig]);

    const isPhysicalMismatch = useMemo(() => {
        if (!formData || !formData.deviceType || !formData.durationMs || formData.durationMs <= 0) return false;
        if (suggestedDuration === null || suggestedDuration === undefined || suggestedDuration <= 0) return false;
        return formData.durationMs < suggestedDuration;
    }, [formData, suggestedDuration]);

    if (!isOpen || !formData) return null;

    const handleInputChange = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };

            // Cascada: al cambiar grupo → resetear subtipo, acción y perfil
            if (field === 'selectedGroupId') {
                updated.deviceType = '';
                updated.deviceAction = '';
                updated.motionProfileId = '';
                updated.linearDistanceMm = 0;
                updated.angularDistanceDeg = 0;
                return updated;
            }

            // Cascada: al cambiar subtipo (deviceType) → resetear acción y perfil
            if (field === 'deviceType') {
                updated.deviceAction = '';
                updated.motionProfileId = '';
                const grp = findGroupForSubtype(value, groups);
                if (!grp?.needsLinearDistance) updated.linearDistanceMm = 0;
                if (!grp?.needsAngularDistance) updated.angularDistanceDeg = 0;
            }

            // Recalcular lagMs y startTimeMs en cascada
            if (field === 'startTimeMs') {
                const newStartTime = Number(value) || 0;
                updated.lagMs = Math.max(0, newStartTime - maxDepFinish);
            } else if (field === 'lagMs') {
                const newLag = Number(value) || 0;
                updated.startTimeMs = maxDepFinish + newLag;
            }

            // Recalculo automático de duración
            const profileId = field === 'motionProfileId' ? value : updated.motionProfileId;
            const grp = findGroupForSubtype(updated.deviceType, groups);
            const linDist = field === 'linearDistanceMm' ? Number(value) || 0 : updated.linearDistanceMm;
            const angDist = field === 'angularDistanceDeg' ? Number(value) || 0 : updated.angularDistanceDeg;

            if (profileId && (field === 'motionProfileId' || field === 'linearDistanceMm' || field === 'angularDistanceDeg')) {
                const auto = calcDurationFromProfile(profileId, grp, linDist, angDist, standardsConfig);
                if (auto !== null) {
                    updated.durationMs = auto;
                    setAutoCalculated(true);
                }
            } else if (field === 'durationMs') {
                setAutoCalculated(false);
            }

            return updated;
        });
    };

    const handleSuggestDuration = () => {
        if (formData.motionProfileId && currentGroup) {
            const auto = calcDurationFromProfile(formData.motionProfileId, currentGroup, formData.linearDistanceMm, formData.angularDistanceDeg, standardsConfig);
            if (auto !== null) { handleInputChange('durationMs', auto); setAutoCalculated(true); return; }
        }
        const suggestion = calculateSuggestedDuration(formData, { customStandards: standardsConfig });
        if (suggestion !== null && suggestion >= 0) { handleInputChange('durationMs', suggestion); setAutoCalculated(true); }
    };

    const handleToggleDependency = (depId) => {
        setFormData(prev => {
            const deps = prev.dependencyStepIds || [];
            return { ...prev, dependencyStepIds: deps.includes(depId) ? deps.filter(id => id !== depId) : [...deps, depId] };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        let stationLabel = step.stationLabel;
        if (formData.stationId !== step.stationId) {
            const newStation = stations.find(s => s.id === formData.stationId);
            if (newStation) {
                const stnPad = String(newStation.stn || '').padStart(2, '0');
                const multiIdx = stations.some(s => s.indx > 1);
                stationLabel = multiIdx ? `${newStation.indx || 1}-STN${stnPad}` : `STN${stnPad}`;
            }
        }
        onSave(formData.id, { ...formData, stationLabel });
        onClose();
    };

    const needsLinear = currentGroup?.needsLinearDistance ?? ['CYL PNEU', 'CYL ELEC', 'CYL HYD', 'SV'].includes(formData.deviceType);
    const needsAngular = currentGroup?.needsAngularDistance ?? ['ROT PNEU', 'ROT ELEC'].includes(formData.deviceType);
    const hasProfiles = availableProfiles.length > 0;

    return createPortal(
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-[980px] max-h-[92vh] bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl shadow-black/50 overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] text-white">

                {/* ── Header ── */}
                <div className="px-6 py-4 lg:py-5 lg:px-8 bg-slate-950 border-b border-slate-800 flex-shrink-0 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <span className="text-[10px] font-mono font-bold bg-slate-800 text-white px-2 py-1 rounded-md tracking-wider shrink-0">
                                #{formData.id.slice(0, 8)}
                            </span>
                            <textarea
                                value={formData.taskDescription}
                                onChange={e => handleInputChange('taskDescription', e.target.value)}
                                placeholder="Título / Descripción del paso..."
                                className="flex-1 min-w-0 text-lg font-black tracking-tight outline-none bg-transparent text-white placeholder-slate-600 border-b border-transparent focus:border-slate-700/50 transition-colors py-0.5 resize-none overflow-hidden"
                                rows={1}
                                ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                            />
                        </div>

                        <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* ── 4 COLUMNAS EN CASCADA: Estación | Grupo | Subtipo | Acción ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">

                        {/* 1. Estación */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider px-0.5">Estación</span>
                            <select
                                value={formData.stationId}
                                onChange={e => handleInputChange('stationId', e.target.value)}
                                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-xs font-bold text-white cursor-pointer focus:outline-none focus:border-cyan-500 transition-colors"
                            >
                                {stations.map(stn => {
                                    const stnPad = String(stn.stn || '').padStart(2, '0');
                                    const multiIdx = stations.some(s => s.indx > 1);
                                    const label = multiIdx ? `${stn.indx || 1}-STN${stnPad}` : `STN${stnPad}`;
                                    return <option key={stn.id} value={stn.id} className="bg-slate-900 text-white">{label} — {stn.abbreviation || stn.description}</option>;
                                })}
                            </select>
                        </div>

                        {/* 2. Grupo */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider px-0.5">Grupo</span>
                            <select
                                value={formData.selectedGroupId || ''}
                                onChange={e => handleInputChange('selectedGroupId', e.target.value)}
                                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-xs font-bold text-white cursor-pointer focus:outline-none focus:border-cyan-500 transition-colors"
                            >
                                <option value="" className="bg-slate-900 text-white">— Seleccionar —</option>
                                {groups.map(g => (
                                    <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                                        {g.code} — {g.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 3. Subtipo (filtrado por grupo) */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider px-0.5">Subtipo</span>
                            <select
                                value={formData.deviceType}
                                onChange={e => handleInputChange('deviceType', e.target.value)}
                                disabled={!formData.selectedGroupId}
                                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-xs font-bold text-white cursor-pointer focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <option value="" className="bg-slate-900 text-white">— Seleccionar —</option>
                                {(groups.find(g => g.id === formData.selectedGroupId)?.subtypes || []).map(sub => (
                                    <option key={sub} value={sub} className="bg-slate-900 text-white">
                                        {sub} {DEVICE_LABELS[sub] ? `— ${DEVICE_LABELS[sub]}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 4. Acción (filtrada por grupo) */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider px-0.5">Acción</span>
                            <select
                                value={formData.deviceAction}
                                onChange={e => handleInputChange('deviceAction', e.target.value)}
                                disabled={!formData.deviceType}
                                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-xs font-bold text-white cursor-pointer focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <option value="" className="bg-slate-900 text-white">— Seleccionar —</option>
                                {validActions.map(act => (
                                    <option key={act} value={act} className="bg-slate-900 text-white">
                                        {act} {ACTION_LABELS[act] ? `— ${ACTION_LABELS[act]}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* ── Fila 2: Perfil y Tiempo de Inicio ── */}
                    <div className="flex flex-wrap items-end justify-between gap-4 mt-2 pt-2 border-t border-slate-800/20">
                        {/* Lado izquierdo: Perfil de Velocidad */}
                        {hasProfiles ? (
                            <div className="flex items-center gap-3 flex-1 min-w-[200px] max-w-sm">
                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-[9px] text-cyan-500 font-black uppercase tracking-wider px-0.5">Perfil de Velocidad</span>
                                    <select
                                        value={formData.motionProfileId}
                                        onChange={e => handleInputChange('motionProfileId', e.target.value)}
                                        disabled={!formData.deviceType}
                                        className="w-full bg-cyan-950/30 border border-cyan-700/40 rounded-xl px-3 py-2 text-xs font-bold text-cyan-300 cursor-pointer focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <option value="" className="bg-slate-900 text-white">— Seleccionar subtipo —</option>
                                        {availableProfiles.map(p => (
                                            <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                                                {p.name} · {p.value} {p.unit}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {profileSpeedInfo && (
                                    <div className="flex flex-col gap-0.5 mt-4">
                                        <span className="px-3 py-1.5 bg-cyan-500/15 border border-cyan-500/30 rounded-xl text-xs font-black text-cyan-400 font-mono">
                                            {profileSpeedInfo.value} {profileSpeedInfo.unit}
                                        </span>
                                        {autoCalculated && formData.motionProfileId && (
                                            <span className="text-[9px] text-cyan-600 font-mono px-1">
                                                {profileSpeedInfo.unit === 'mm/s'
                                                    ? `${formData.linearDistanceMm}mm ÷ ${profileSpeedInfo.value} + overheads`
                                                    : profileSpeedInfo.unit === 'deg/s'
                                                    ? `${formData.angularDistanceDeg}° ÷ ${profileSpeedInfo.value} + overheads`
                                                    : `Fijo: ${profileSpeedInfo.value}ms`
                                                }
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1" />
                        )}

                        {/* Lado derecho: Tiempo de Inicio + Notificación de Dependencias */}
                        <div className="flex items-center gap-3 shrink-0">
                            {/* Notificación de Dependencias */}
                            {formData.dependencyStepIds && formData.dependencyStepIds.length > 0 && (
                                <div className="flex items-center gap-1.5 bg-cyan-950/40 border border-cyan-700/30 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-cyan-300 animate-pulse">
                                    <span>🔗</span>
                                    <span>Calculado por dependencias</span>
                                </div>
                            )}

                            {/* Caja del Input de Inicio */}
                            <div className={`flex items-center gap-2 bg-slate-900 border px-3 py-1.5 rounded-xl transition-all duration-200 ${
                                formData.dependencyStepIds && formData.dependencyStepIds.length > 0
                                    ? 'border-cyan-700/50 bg-cyan-950/10 text-cyan-400 opacity-90'
                                    : 'border-slate-800/80 text-white'
                            }`}>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                    formData.dependencyStepIds && formData.dependencyStepIds.length > 0 ? 'text-cyan-400' : 'text-slate-500'
                                }`}>
                                    Inicio
                                </span>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.startTimeMs || 0}
                                        onChange={e => handleInputChange('startTimeMs', Number(e.target.value) || 0)}
                                        readOnly={formData.dependencyStepIds && formData.dependencyStepIds.length > 0}
                                        title={formData.dependencyStepIds && formData.dependencyStepIds.length > 0 ? 'Este valor se calcula automáticamente debido a las dependencias. Modifica el Lag si deseas desplazarlo.' : 'Editar tiempo de inicio del paso'}
                                        className={`w-16 bg-transparent text-right text-xs font-mono font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                            formData.dependencyStepIds && formData.dependencyStepIds.length > 0
                                                ? 'text-cyan-300 cursor-not-allowed'
                                                : 'text-amber-400'
                                        }`}
                                    />
                                    <span className="text-[9px] text-slate-500 font-medium">ms</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Form — Dos Columnas ── */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col md:flex-row gap-6 lg:gap-8 custom-scrollbar">

                    {/* Columna Izquierda */}
                    <div className="w-full md:w-[330px] shrink-0 space-y-5 md:border-r border-slate-800/60 pr-0 md:pr-6 lg:pr-8">

                        {/* Distancia Física (primero — orden lógico) */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Distancia Física</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lineal (mm)</label>
                                    <input type="number" min="0" value={needsLinear ? formData.linearDistanceMm : ''} onChange={e => handleInputChange('linearDistanceMm', Number(e.target.value) || 0)} disabled={!needsLinear} placeholder={needsLinear ? '0' : '— N/A —'} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 disabled:opacity-30 font-mono" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Angular (deg)</label>
                                    <input type="number" min="0" value={needsAngular ? formData.angularDistanceDeg : ''} onChange={e => handleInputChange('angularDistanceDeg', Number(e.target.value) || 0)} disabled={!needsAngular} placeholder={needsAngular ? '0' : '— N/A —'} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 disabled:opacity-30 font-mono" />
                                </div>
                            </div>
                            {formData.motionProfileId && profileSpeedInfo && (profileSpeedInfo.unit === 'mm/s' || profileSpeedInfo.unit === 'deg/s') && (
                                <p className="text-[10px] text-amber-500/80 font-semibold flex items-center gap-1">
                                    <Zap className="w-3 h-3" />
                                    {profileSpeedInfo.unit === 'mm/s' ? 'Ingresa distancia lineal (mm) para calcular automáticamente' : 'Ingresa ángulo (deg) para calcular automáticamente'}
                                </p>
                            )}
                        </div>

                        {/* Tiempos de Ciclo (después de distancia) */}
                        <div className="space-y-3 pt-4 border-t border-slate-800/40">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tiempos de Ciclo</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Duración (ms)</label>
                                        <button type="button" onClick={handleSuggestDuration} disabled={!formData.deviceType} className="flex items-center gap-0.5 text-[9px] font-bold text-cyan-400 hover:text-cyan-300 disabled:opacity-30 cursor-pointer" title="Calcular">
                                            <Sparkles className="w-3 h-3" /> Calcular
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number" min="0"
                                            value={formData.durationMs}
                                            onChange={e => { setAutoCalculated(false); handleInputChange('durationMs', Number(e.target.value) || 0); }}
                                            className={`w-full border rounded-lg px-3 py-2 text-xs font-bold focus:outline-none font-mono transition-colors ${
                                                isPhysicalMismatch
                                                    ? 'bg-red-950/20 border-red-500/80 text-red-200 focus:border-red-500 focus:ring-1 focus:ring-red-500/50'
                                                    : autoCalculated 
                                                        ? 'bg-cyan-950/30 border-cyan-600/40 text-cyan-300 focus:border-cyan-500' 
                                                        : 'bg-slate-950 border-slate-800 text-cyan-300 focus:border-cyan-500'
                                            }`}
                                        />
                                        {autoCalculated && !isPhysicalMismatch && <span className="absolute -top-1 -right-1"><Zap className="w-3 h-3 text-cyan-400" /></span>}
                                        {isPhysicalMismatch && <span className="absolute -top-1 -right-1 animate-pulse"><AlertTriangle className="w-3.5 h-3.5 text-red-500" /></span>}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lag (ms)</label>
                                    <input type="number" value={formData.lagMs} onChange={e => handleInputChange('lagMs', Number(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-350 focus:outline-none focus:border-cyan-500 font-mono" />
                                </div>
                            </div>

                            {/* Desglose siempre visible si hay datos para calcular */}
                            {formData.motionProfileId && profileSpeedInfo && (() => {
                                const bd = calcBreakdown(
                                    formData.motionProfileId, currentGroup,
                                    formData.linearDistanceMm, formData.angularDistanceDeg,
                                    standardsConfig
                                );
                                if (!bd || !bd.total) return null;
                                return (
                                    <div className="mt-1 bg-gradient-to-br from-slate-950 via-slate-900/80 to-slate-950 border border-slate-700/40 rounded-xl overflow-hidden shadow-lg shadow-black/20">
                                        {/* Header */}
                                        <div className="px-3 py-2 bg-slate-800/30 border-b border-slate-700/30 flex items-center justify-between">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <Zap className="w-3 h-3 text-cyan-500" /> Desglose del Cálculo
                                            </span>
                                            <span className="text-[8px] text-slate-600 font-mono">{bd.lines.length} componentes</span>
                                        </div>

                                        {/* Line items */}
                                        <div className="px-3 py-2 space-y-1.5">
                                            {bd.lines.map((line, i) => {
                                                const isMotion = line.highlight;
                                                const isScan = line.label.includes('scan');
                                                const isValve = line.label.includes('valve');
                                                const dotColor = isMotion ? 'bg-cyan-500' : isScan ? 'bg-purple-500' : isValve ? 'bg-amber-500' : 'bg-slate-600';
                                                const textColor = isMotion ? 'text-cyan-300' : isScan ? 'text-purple-300' : isValve ? 'text-amber-300' : 'text-slate-400';
                                                const valueColor = isMotion ? 'text-cyan-400' : isScan ? 'text-purple-400' : isValve ? 'text-amber-400' : 'text-slate-400';
                                                const pct = bd.total > 0 ? Math.round((line.value / bd.total) * 100) : 0;

                                                return (
                                                    <div key={i} className="group">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
                                                            <span className={`text-[10px] font-medium ${textColor} flex-1 truncate`}>
                                                                {line.label}
                                                                {line.note && <span className="text-slate-600 ml-1 text-[8px]">{line.note}</span>}
                                                            </span>
                                                            <span className={`text-[10px] font-bold ${valueColor} tabular-nums shrink-0`}>
                                                                {line.value > 0 ? line.value : '—'} <span className="text-slate-600 font-normal text-[8px]">{line.unit}</span>
                                                            </span>
                                                        </div>
                                                        <div className="ml-3.5 mt-0.5 h-[2px] rounded-full bg-slate-800/60 overflow-hidden">
                                                            <div className={`h-full rounded-full ${isMotion ? 'bg-cyan-500/50' : isScan ? 'bg-purple-500/40' : isValve ? 'bg-amber-500/40' : 'bg-slate-600/40'}`} style={{ width: `${pct}%`, transition: 'width 0.6s ease' }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Total */}
                                        <div className="px-3 py-2.5 bg-gradient-to-r from-cyan-950/40 via-cyan-900/20 to-transparent border-t border-cyan-800/20 flex items-center justify-between">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-black text-cyan-300 tabular-nums">{bd.total}</span>
                                                <span className="text-[9px] text-slate-500 font-medium">ms</span>
                                                <div className="w-4 h-4 rounded-full bg-cyan-500/20 flex items-center justify-center">
                                                    <span className="text-cyan-400 text-[9px]">✓</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {isPhysicalMismatch && (
                                <div className="mt-2.5 p-3 bg-red-950/30 border border-red-500/35 rounded-xl text-red-205 text-[10px] leading-relaxed flex gap-2.5 items-start animate-[pulse_2s_infinite]">
                                    <AlertTriangle className="w-4 h-4 text-red-405 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-extrabold tracking-wide text-red-400 uppercase text-[8px] mb-0.5">Discrepancia Física</p>
                                        <p>La duración es inferior al mínimo sugerido de <strong className="text-white">{suggestedDuration} ms</strong> para esta distancia y perfil. Se recomienda recalcular la distancia o aumentar la duración.</p>
                                    </div>
                                </div>
                            )}
                        </div>


                        {/* Sensor */}
                        <div className="space-y-3 pt-4 border-t border-slate-800/40">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sensor</h4>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Tipo</label>
                                    <select value={formData.sensorType} onChange={e => handleInputChange('sensorType', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer">
                                        <option value="">— Ninguno —</option>
                                        {Object.entries(TIMING_SENSOR_TYPES).map(([k, v]) => (
                                            <option key={k} value={v} className="bg-slate-900 text-white">{v} {SENSOR_LABELS[v] ? `(${SENSOR_LABELS[v]})` : ''}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cant.</label>
                                    <input type="number" min="0" value={formData.sensorQty} onChange={e => handleInputChange('sensorQty', Number(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500" />
                                </div>
                            </div>
                        </div>

                        {/* Fase del Ciclo */}
                        <div className="space-y-2 pt-4 border-t border-slate-800/40">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fase del Ciclo</h4>
                            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 border border-slate-800/40 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleInputChange('canRunDuringIndex', false);
                                        handleInputChange('waitsForMainIndex', true);
                                    }}
                                    className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                                        !formData.canRunDuringIndex && formData.waitsForMainIndex
                                            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                                            : 'text-slate-550 hover:text-slate-350 border border-transparent'
                                    }`}
                                >
                                    <span className="text-[13px] mb-0.5">🔵</span>
                                    <span>Dwell</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleInputChange('canRunDuringIndex', true);
                                        handleInputChange('waitsForMainIndex', false);
                                    }}
                                    className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                                        formData.canRunDuringIndex && !formData.waitsForMainIndex
                                            ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                                            : 'text-slate-550 hover:text-slate-350 border border-transparent'
                                    }`}
                                >
                                    <span className="text-[13px] mb-0.5">⚡</span>
                                    <span>Index</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleInputChange('canRunDuringIndex', true);
                                        handleInputChange('waitsForMainIndex', true);
                                    }}
                                    className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                                        formData.canRunDuringIndex && formData.waitsForMainIndex
                                            ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                                            : 'text-slate-550 hover:text-slate-350 border border-transparent'
                                    }`}
                                >
                                    <span className="text-[13px] mb-0.5">🔄</span>
                                    <span>Ambos</span>
                                </button>
                            </div>
                            <p className="text-[9px] text-slate-500 leading-normal px-1">
                                {!formData.canRunDuringIndex && formData.waitsForMainIndex && '🔵 DWELL: El paso corre únicamente cuando la mesa está quieta (consume tiempo de parada).'}
                                {formData.canRunDuringIndex && !formData.waitsForMainIndex && '⚡ INDEX: El paso corre puramente en paralelo al movimiento (no consume Dwell).'}
                                {formData.canRunDuringIndex && formData.waitsForMainIndex && '🔄 AMBOS: Corre en paralelo al Index y continúa en Dwell si excede el tiempo de movimiento.'}
                            </p>
                        </div>
                    </div>

                    {/* Columna Derecha */}
                    <div className="flex-1 space-y-5">
                        <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-slate-450 font-bold uppercase tracking-wider text-xs">
                                <ListTodo className="w-4 h-4 text-cyan-400 shrink-0" />
                                <span>Instrucciones / Notas del Paso</span>
                            </div>
                            <textarea value={formData.notes} onChange={e => handleInputChange('notes', e.target.value)} placeholder="Detalles adicionales, notas o instrucciones..." rows="5" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 resize-none text-white placeholder-slate-700 font-normal leading-relaxed" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">Condición de Disparo (Trigger)</label>
                            <input type="text" value={formData.triggerCondition} onChange={e => handleInputChange('triggerCondition', e.target.value)} placeholder="Ej. Handshake PLC, Pinza Abierta..." className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-cyan-500 text-white placeholder-slate-700" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Precedencias (Dependencias)</label>
                            <div className="max-h-[180px] overflow-y-auto border border-slate-800 rounded-lg p-3 space-y-1.5 bg-slate-955/45 custom-scrollbar">
                                {formData.dependencyStepIds.length > 0 ? (
                                    formData.dependencyStepIds.map(depId => {
                                        const s = allSteps.find(st => st.id === depId);
                                        if (!s) return null;
                                        return (
                                            <div key={s.id} className="flex items-center gap-2.5 px-2 py-1.5 bg-slate-900/50 rounded-lg group">
                                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                                                <span className="text-xs text-slate-350 leading-tight flex-1">
                                                    <strong className="text-cyan-400 mr-1">{s.stationLabel || 'STN'}:</strong>
                                                    {s.taskDescription || 'Paso sin descripción'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleDependency(s.id)}
                                                    className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                                    title="Quitar dependencia"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <span className="text-slate-500 italic text-center block py-4 text-xs">Sin dependencias. Usa el Gantt (click derecho → enlazar) para agregar.</span>
                                )}
                            </div>
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-2.5">
                    <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-800 hover:bg-slate-900 rounded-xl text-xs font-bold transition-all cursor-pointer text-slate-350">Cancelar</button>
                    <button type="button" onClick={handleSubmit} className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-950/20">
                        <Save className="w-4 h-4" /> Guardar Cambios
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
