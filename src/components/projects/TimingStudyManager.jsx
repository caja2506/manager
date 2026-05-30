import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Timer, Plus, Trash2, Copy, RefreshCw, Save, AlertTriangle, CheckCircle, XCircle,
    ChevronUp, ChevronDown, ChevronRight, Sparkles, Settings, Eye, Info, Clock, Play, List, HelpCircle, Download,
    Target, Activity, Award, TrendingUp, ArrowRight
} from 'lucide-react';
import {
    onProjectTimingStudies,
    createTimingStudy,
    updateTimingStudy,
    deleteTimingStudy,
    getTimingStudySteps,
    onTimingStudySteps,
    addTimingStep,
    updateTimingStep,
    deleteTimingStep,
    bulkCreateTimingSteps,
    recalculateTimingStudy,
    getGlobalMotionStandards,
    getActuatorGroups
} from '../../services/timingStudyService';
import { onProjectStations } from '../../services/stationService';
import TimingStudyGantt from './TimingStudyGantt';
import TimingStudyValidationPanel from './TimingStudyValidationPanel';
import {
    TIMING_DEVICE_TYPES,
    TIMING_ACTIONS,
    TIMING_SENSOR_TYPES,
    calculateSuggestedDuration,
    createTimingStudyDocument,
    createTimingStepDocument,
    calculateTimingStudyMetrics,
    validateTimingStudy
} from '../../models/schemas';

const DEVICE_LABELS = {
    'CAM': 'Cámara/Visión',
    'CYL PNEU': 'Cil. Neumático',
    'CYL ELEC': 'Cil. Eléctrico',
    'CYL HYD': 'Cil. Hidráulico',
    'DISP': 'Dispensador',
    'FEEDER': 'Alimentador',
    'GPR': 'Gripper/Pinza',
    'GPR SO': 'Grip. Resorte Abierto',
    'GPR SC': 'Grip. Resorte Cerrado',
    'HEAT CRT': 'Cartucho Calefactor',
    'INDEXER': 'Indexador',
    'IONIZER': 'Ionizador',
    'LASER': 'Marcador Láser',
    'LT CURT': 'Cortina Luz',
    'SV': 'Servo',
    'ST': 'Stepper/Motor Paso a Paso',
    'ROBOT': 'Robot',
    'ROD LOCK': 'Bloq. Vástago',
    'ROT PNEU': 'Rot. Neumático/Aire',
    'ROT ELEC': 'Rot. Eléctrico',
    'MAN': 'Op. Manual',
    'MTR': 'Motor',
    'VAC GEN': 'Generador de Vacío',
    'VAC PMP': 'Bomba de Vacío',
    'VFD': 'Variador Frecuencia (VFD)',
    'VIB': 'Alimentador Vibratorio',
    'VISN LT': 'Iluminación Visión',
    'WELDER': 'Soldadora',
    'LIGHT': 'Indicador Luminoso',
    'HORN': 'Alarma Sonora',
    'MISC': 'Misceláneo',
    'VAL': 'Válvula Neumática',
};

const ACTION_LABELS = {
    'EXT': 'Extender',
    'RET': 'Retraer',
    'CW': 'Giro CW',
    'CCW': 'Giro CCW',
    'OPN': 'Abrir',
    'CLS': 'Cerrar',
    'UP': 'Subir',
    'DWN': 'Bajar',
    'ADV': 'Avanzar',
    'RTN': 'Retornar',
    'HOR': 'Home',
    'ON': 'Activar (ON)',
    'OFF': 'Desactivar (OFF)',
    'READ': 'Leer',
    'WAIT': 'Esperar',
    'DELAY': 'Demora',
    'INSPECT': 'Inspeccionar',
};

const SENSOR_LABELS = {
    'ANLG': 'Sensor Anal├│gico',
    'CNTRL': 'Señal Control',
    'ENC': 'Encoder',
    'FO': 'Fibra ├ôptica',
    'HS': 'Sensor Hall/Reed',
    'HS AM': 'Hall Anti-Mag',
    'LS': 'Limit Switch',
    'LVDT': 'Transd. LVDT',
    'LC': 'Celda Carga',
    'PE': 'Fotoeléctrico',
    'PLC': 'Señal PLC',
    'PS': 'Presostato',
    'PX': 'Prox. Inductivo',
    'PX AM': 'Prox. Anti-Mag',
    'RF': 'RFID',
    'TC': 'Termopar',
    'VS': 'Sensor Visión',
    'VISN': 'Cámara Visión',
    'PB': 'Pulsador',
    'FRC/DIST': 'Fuerza/Distancia',
};

function TableInput({ value, onBlur, type = 'text', className = '', placeholder = '', disabled = false, min = undefined }) {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    return (
        <input
            type={type}
            min={min}
            value={localValue !== undefined && localValue !== null ? localValue : ''}
            onChange={e => setLocalValue(e.target.value)}
            onBlur={onBlur}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            disabled={disabled}
            placeholder={placeholder}
            className={className}
        />
    );
}

export default function TimingStudyManager({ projectId, canEdit = false, userId = null }) {
    // ── Estados Principales ──
    const [studies, setStudies] = useState([]);
    const [stations, setStations] = useState([]);
    const [steps, setSteps] = useState([]);
    const [selectedStudyId, setSelectedStudyId] = useState('');
    const [loading, setLoading] = useState(true);
    const [recalculating, setRecalculating] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // ── Estado colapsable para configuración ──
    const [showConfig, setShowConfig] = useState(true);
    const [showNotes, setShowNotes] = useState(false);

    // ── Configuración en edición local ──
    const [studyConfig, setStudyConfig] = useState(null);
    const [hasConfigChanges, setHasConfigChanges] = useState(false);
    const [configAutoSaveStatus, setConfigAutoSaveStatus] = useState('idle'); // idle | saving | saved | error
    const [configAutoSaveError, setConfigAutoSaveError] = useState('');
    const configSaveTimerRef = useRef(null);
    const configInitialLoadRef = useRef(true);
    const justSavedConfigRef = useRef(0); // timestamp of last save

    // ── Paso que tiene abierto el selector de dependencias ──
    const [activeDependencyStepId, setActiveDependencyStepId] = useState(null);

    // ── Resaltado Dinámico de Dependencias (Fórmulas) ──
    const [hoveredRelation, setHoveredRelation] = useState(null);
    const [activeTooltipId, setActiveTooltipId] = useState(null);

    const handleRelationClick = useCallback((relationId, e) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        
        if (hoveredRelation === relationId) {
            // Estado 2 -> Clic 3: Desactivar todo
            setHoveredRelation(null);
            setActiveTooltipId(null);
        } else if (activeTooltipId === relationId) {
            // Estado 1 -> Clic 2: Activar ayuda visual, desactivar tooltip
            setHoveredRelation(relationId);
            setActiveTooltipId(null);
        } else {
            // Estado 0 -> Clic 1: Activar tooltip, desactivar ayuda visual
            setHoveredRelation(null);
            setActiveTooltipId(relationId);
        }
    }, [hoveredRelation, activeTooltipId]);

    // Mapa bidireccional de dependencias
    const DEPENDENCY_RELATIONS = useMemo(() => ({
        // Inputs -> KPIs que afectan
        'input-piecesPerHour': ['card-objDia', 'card-objHora', 'card-ppmObj', 'card-cicloTarget', 'card-piezasDia', 'card-piezasSem', 'card-piezasAno'],
        'input-shiftHours': ['card-objDia', 'card-piezasDia', 'card-piezasSem', 'card-piezasAno'],
        'input-oeePenalty': ['card-piezasDia', 'card-piezasSem', 'card-piezasAno', 'input-availability', 'input-efficiency', 'input-yield'],
        'input-availability': ['input-oeePenalty', 'card-piezasDia', 'card-piezasSem', 'card-piezasAno'],
        'input-efficiency': ['input-oeePenalty', 'card-piezasDia', 'card-piezasSem', 'card-piezasAno'],
        'input-yield': ['input-oeePenalty', 'card-piezasDia', 'card-piezasSem', 'card-piezasAno'],
        'input-workDaysPerWeek': ['card-piezasSem', 'card-piezasAno'],
        'input-country': ['card-piezasAno'],
        'input-annualDemand': ['card-piezasAno', 'input-piecesPerHour'],
        'input-machineType': ['card-cicloReal', 'card-ppmReal', 'card-realHora', 'card-piezasDia', 'card-piezasSem', 'card-piezasAno', 'input-indexTime', 'input-dwellTime'],
        'input-indexTime': ['card-cicloReal', 'card-ppmReal', 'card-realHora', 'card-piezasDia', 'card-piezasSem', 'card-piezasAno'],
        'input-dwellTime': ['card-cicloReal', 'card-ppmReal', 'card-realHora', 'card-piezasDia', 'card-piezasSem', 'card-piezasAno', 'card-bottleneck'],
        'input-up': ['card-objDia', 'card-objHora', 'card-ppmObj', 'card-cicloTarget', 'card-realHora', 'card-piezasDia', 'card-piezasSem', 'card-piezasAno'],

        // KPIs -> Inputs de los que dependen o KPIs relacionados
        'card-objDia': ['input-piecesPerHour', 'input-shiftHours', 'input-up', 'card-ppmObj'],
        'card-objHora': ['input-piecesPerHour', 'input-up', 'card-ppmObj'],
        'card-ppmObj': ['input-piecesPerHour', 'input-up'],
        'card-cicloTarget': ['card-ppmObj'],
        'card-realHora': ['card-ppmReal', 'input-up', 'input-machineType', 'input-indexTime', 'input-dwellTime'],
        'card-bottleneck': ['input-dwellTime'],
        'card-status': ['card-cicloReal', 'card-cicloTarget'],
        'card-piezasDia': ['card-realHora', 'input-shiftHours', 'input-oeePenalty', 'input-availability', 'input-efficiency', 'input-yield', 'input-piecesPerHour'],
        'card-ppmReal': ['card-cicloReal', 'input-machineType', 'input-indexTime', 'input-dwellTime'],
        'card-cicloReal': ['input-dwellTime', 'input-indexTime', 'input-machineType'],
        'card-piezasSem': ['card-piezasDia', 'input-workDaysPerWeek', 'input-shiftHours', 'input-oeePenalty', 'input-availability', 'input-efficiency', 'input-yield', 'input-piecesPerHour'],
        'card-piezasAno': ['card-piezasDia', 'input-workDaysPerWeek', 'input-country', 'input-annualDemand', 'input-shiftHours', 'input-oeePenalty', 'input-availability', 'input-efficiency', 'input-yield', 'input-piecesPerHour']
    }), []);

    const getHighlightStyles = useCallback((id) => {
        if (!hoveredRelation) return { wrapperClass: '', isDimmed: false, role: null };

        const isCurrent = hoveredRelation === id;
        const isRelated = DEPENDENCY_RELATIONS[hoveredRelation]?.includes(id);

        if (isCurrent) {
            return {
                wrapperClass: 'ring-2 ring-cyan-500 border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-500/10 scale-[1.01] z-30',
                isDimmed: false,
                role: 'active'
            };
        }

        if (isRelated) {
            const isInput = id.startsWith('input-');
            const colorRing = isInput ? 'ring-2 ring-indigo-500/80 border-indigo-400/80 bg-indigo-950/5' : 'ring-2 ring-emerald-500/80 border-emerald-400/80 bg-emerald-950/5';
            return {
                wrapperClass: `${colorRing} shadow-md scale-[1.005] z-30`,
                isDimmed: false,
                role: 'related'
            };
        }

        return {
            wrapperClass: 'opacity-30 transition-all duration-300 blur-[0.2px]',
            isDimmed: true,
            role: 'dimmed'
        };
    }, [hoveredRelation, DEPENDENCY_RELATIONS]);

    const getHighlightLabel = useCallback((id) => {
        if (!hoveredRelation) return null;
        if (hoveredRelation === id) {
            return id.startsWith('input-') ? 'Variable' : 'Resultado';
        }
        const isRelated = DEPENDENCY_RELATIONS[hoveredRelation]?.includes(id);
        if (isRelated) {
            if (hoveredRelation.startsWith('input-')) {
                return id.startsWith('input-') ? 'Influenciado' : 'Impactado';
            } else {
                return id.startsWith('input-') ? 'Fórmula' : 'Componente';
            }
        }
        return null;
    }, [hoveredRelation, DEPENDENCY_RELATIONS]);

    // ── Ajustes Estándar por Proyecto (Clasificadores y Tiempos) ──
    const [showStandards, setShowStandards] = useState(false);
    const [standardsConfig, setStandardsConfig] = useState(null);
    const [hasStandardsChanges, setHasStandardsChanges] = useState(false);
    const [standardsActiveTab, setStandardsActiveTab] = useState('classifiers');
    const [actuatorGroups, setActuatorGroups] = useState(null);

    // ── Obtener el estudio seleccionado actualmente ──
    const currentStudy = useMemo(() => {
        return studies.find(s => s.id === selectedStudyId) || null;
    }, [studies, selectedStudyId]);

    // ── Obtener acciones válidas: grupos dinámicos primero, luego clasificadores ──
    const getValidActionsForDevice = useCallback((deviceType) => {
        if (!deviceType) return Object.values(TIMING_ACTIONS);
        // 1. Grupos dinámicos
        if (actuatorGroups && actuatorGroups.length > 0) {
            const group = actuatorGroups.find(g => g.subtypes && g.subtypes.includes(deviceType));
            if (group && group.actions && group.actions.length > 0) {
                if (group.actions.includes('*')) return Object.values(TIMING_ACTIONS);
                return group.actions;
            }
        }
        // 2. Fallback a clasificadores
        if (!standardsConfig || !Array.isArray(standardsConfig.classifiers)) {
            return Object.values(TIMING_ACTIONS);
        }
        const matches = standardsConfig.classifiers.filter(c => c.deviceType === deviceType);
        if (matches.length === 0) return Object.values(TIMING_ACTIONS);
        const actions = matches.map(m => m.deviceAction).filter(Boolean);
        if (actions.includes('*')) return Object.values(TIMING_ACTIONS);
        return Array.from(new Set(actions));
    }, [standardsConfig, actuatorGroups]);

    // ── Resultados de Validación del Estudio ──
    const validationResults = useMemo(() => {
        if (!currentStudy) {
            return {
                isValid: true,
                errorCount: 0,
                warningCount: 0,
                infoCount: 0,
                issues: []
            };
        }
        return validateTimingStudy(currentStudy, steps, stations);
    }, [currentStudy, steps, stations]);

    // ── Confiabilidad (Data Quality) ──
    const dataQuality = useMemo(() => {
        if (!currentStudy || steps.length === 0) return 'EMPTY';
        if (validationResults.errorCount > 0) return 'BLOCKED';
        if (validationResults.warningCount > 0) return 'REVIEW';
        return 'READY';
    }, [currentStudy, steps, validationResults]);

    // ── Métricas calculadas en memoria local para detectar discrepancias ──
    const localMetrics = useMemo(() => {
        if (!studyConfig) return null;
        return calculateTimingStudyMetrics(studyConfig, steps, stations);
    }, [studyConfig, steps, stations]);

    // ── Bandera que detecta si el estudio requiere recálculo ──
    const needsRecalculate = useMemo(() => {
        if (!currentStudy || !localMetrics) return false;
        if (hasConfigChanges) return true;

        const cycleDiff = Math.abs((localMetrics.machineCycleTimeMs || 0) - (currentStudy.machineCycleTimeMs || 0)) > 1;
        const ppmDiff = Math.abs((localMetrics.calculatedPPM || 0) - (currentStudy.calculatedPPM || 0)) > 0.05;
        const statusDiff = localMetrics.status !== currentStudy.status;

        let stepsDiff = false;
        for (const localStep of localMetrics.steps) {
            const storedStep = steps.find(s => s.id === localStep.id);
            if (!storedStep) {
                stepsDiff = true;
                break;
            }
            if (
                Math.abs((localStep.startTimeMs || 0) - (storedStep.startTimeMs || 0)) > 1 ||
                Math.abs((localStep.finishTimeMs || 0) - (storedStep.finishTimeMs || 0)) > 1 ||
                !!localStep.isCriticalPath !== !!storedStep.isCriticalPath ||
                !!localStep.isBottleneck !== !!storedStep.isBottleneck
            ) {
                stepsDiff = true;
                break;
            }
        }

        return cycleDiff || ppmDiff || statusDiff || stepsDiff;
    }, [currentStudy, localMetrics, steps, hasConfigChanges]);

    // ── Métricas a largo plazo (Capacidad Anual, OEE, etc.) ──
    const longTermMetrics = useMemo(() => {
        if (!studyConfig || !localMetrics) return null;

        const calcMode = studyConfig.calcMode || 'pph'; // 'pph' | 'demand'
        const workDaysPerWeek = studyConfig.workDaysPerWeek !== undefined ? Number(studyConfig.workDaysPerWeek) : 5;
        const country = studyConfig.country || 'MX';
        const annualDemand = studyConfig.annualDemand !== undefined ? Number(studyConfig.annualDemand) : 18388734;
        const shiftHours = studyConfig.shiftHours !== undefined ? Number(studyConfig.shiftHours) : 8;
        const cycleOutputQty = studyConfig.cycleOutputQty !== undefined ? Number(studyConfig.cycleOutputQty) : 1;

        const feriados = country === 'MX' ? 7 : (country === 'CR' ? 11 : (country === 'US' ? 11 : 0));
        const diasAnuales = (workDaysPerWeek * 52) - feriados;

        // ── Datos REALES del diagrama (siempre fijos) ──
        const machineCycleMs = localMetrics.machineCycleTimeMs || 0;
        const cicloRealSeg = machineCycleMs / 1000;
        const ppmReal = cicloRealSeg > 0 ? (60 / cicloRealSeg) : 0;
        const piezasHoraReal = ppmReal * 60 * cycleOutputQty;
        const cpmReal = ppmReal; // ciclos por minuto real (= PPM sin UP)

        const linkOeeToStudy = !!studyConfig.linkOeeToStudy;

        // ── OEE y Pérdidas ──
        const availability = studyConfig.availability !== undefined ? Number(studyConfig.availability) : 95;
        const yieldVal = studyConfig.yield !== undefined ? Number(studyConfig.yield) : 98;

        let efficiency;
        let oeeFactor;
        let oeePenalty;

        // ── Cálculos TARGET según MODO ──
        let targetPPM;
        let piezasHoraTarget;

        if (calcMode === 'demand') {
            // MODO DEMANDA: calcular PPH requerido desde demanda anual
            // Primero necesitamos OEE para calcular bruto
            if (linkOeeToStudy) {
                // Usar PPM target provisional para calcular efficiency
                const provisionalTargetPPM = Number(studyConfig.targetPPM) || 10;
                efficiency = provisionalTargetPPM > 0 ? (ppmReal / provisionalTargetPPM) * 100 : 100;
                oeeFactor = (availability / 100) * (efficiency / 100) * (yieldVal / 100);
                oeePenalty = 100 - (oeeFactor * 100);
            } else {
                oeePenalty = studyConfig.oeePenalty !== undefined ? Number(studyConfig.oeePenalty) : 15;
                oeeFactor = (100 - oeePenalty) / 100;
                efficiency = studyConfig.efficiency !== undefined 
                    ? Number(studyConfig.efficiency) 
                    : ((oeeFactor * 1000000) / (availability * yieldVal));
            }

            const piezasDiaReq = diasAnuales > 0 ? annualDemand / diasAnuales : 0;
            const piezasDiaBrutoReq = oeeFactor > 0 ? piezasDiaReq / oeeFactor : 0;
            piezasHoraTarget = shiftHours > 0 ? piezasDiaBrutoReq / shiftHours : 0;
            targetPPM = cycleOutputQty > 0 ? (piezasHoraTarget / 60 / cycleOutputQty) : 0;
        } else {
            // MODO PPH: calcular PPH bruto requerido desde piezas netas ingresadas
            if (linkOeeToStudy) {
                // Usar PPM target provisional para calcular efficiency
                const provisionalTargetPPM = Number(studyConfig.targetPPM) || 10;
                efficiency = provisionalTargetPPM > 0 ? (ppmReal / provisionalTargetPPM) * 100 : 100;
                oeeFactor = (availability / 100) * (efficiency / 100) * (yieldVal / 100);
                oeePenalty = 100 - (oeeFactor * 100);
            } else {
                oeePenalty = studyConfig.oeePenalty !== undefined ? Number(studyConfig.oeePenalty) : 15;
                oeeFactor = (100 - oeePenalty) / 100;
                efficiency = studyConfig.efficiency !== undefined 
                    ? Number(studyConfig.efficiency) 
                    : ((oeeFactor * 1000000) / (availability * yieldVal));
            }

            const targetPiecesPerShift = studyConfig.targetPiecesPerShift !== undefined ? Number(studyConfig.targetPiecesPerShift) : 8000;
            const piezasDiaReq = targetPiecesPerShift;
            const piezasDiaBrutoReq = oeeFactor > 0 ? piezasDiaReq / oeeFactor : 0;
            piezasHoraTarget = shiftHours > 0 ? piezasDiaBrutoReq / shiftHours : 0;
            targetPPM = cycleOutputQty > 0 ? (piezasHoraTarget / 60 / cycleOutputQty) : 0;
        }

        // ── PPM y Ciclos Target ──
        const ppmTarget = targetPPM;
        const cpmTarget = targetPPM; // ciclos por minuto target (= PPM sin UP)
        const cicloTargetSeg = targetPPM > 0 ? (60 / targetPPM) : 0;

        // ── Producción calculada (basada en el TARGET, no en el real) ──
        const piezasDiaSinOEE = piezasHoraTarget * shiftHours;
        const piezasDia = piezasDiaSinOEE * oeeFactor;
        const piezasSemana = piezasDia * workDaysPerWeek;
        const piezasSemanaBruto = piezasDiaSinOEE * workDaysPerWeek;
        const piezasAno = piezasDia * diasAnuales;
        const piezasAnoBruto = piezasDiaSinOEE * diasAnuales;

        // ── Producción REAL del diagrama (para comparación) ──
        const piezasDiaReal = piezasHoraReal * shiftHours * oeeFactor;
        const piezasSemanaReal = piezasDiaReal * workDaysPerWeek;
        const piezasAnoReal = piezasDiaReal * diasAnuales;

        const metaAno = piezasAno;
        const cumplimiento = annualDemand > 0 ? (metaAno / annualDemand) * 100 : 0;
        const cumpleDemanda = metaAno >= annualDemand;

        // Cumplimiento REAL (diagrama vs demanda)
        const cumplimientoReal = annualDemand > 0 ? (piezasAnoReal / annualDemand) * 100 : 0;
        const cumpleDemandaReal = piezasAnoReal >= annualDemand;

        // ── Pérdidas OEE (basadas en target) ──
        const piezasPerdidasDisp = piezasDiaSinOEE * (1 - availability / 100);
        const piezasPerdidasEficiencia = piezasDiaSinOEE * (availability / 100) * (1 - efficiency / 100);
        const piezasPerdidasCalidad = piezasDiaSinOEE * (availability / 100) * (efficiency / 100) * (1 - yieldVal / 100);

        // OEE % para UI (invertido de oeePenalty)
        const oeePercent = Math.round((100 - oeePenalty) * 10) / 10;

        return {
            calcMode,
            oeePenalty,
            oeePercent,
            oeeFactor,
            workDaysPerWeek,
            country,
            annualDemand,
            shiftHours,
            cycleOutputQty,

            feriados,
            diasAnuales,
            cicloRealSeg,
            cicloTargetSeg,
            ppmReal,
            ppmTarget,
            cpmReal,
            cpmTarget,
            piezasHora: piezasHoraTarget, // backward compat
            piezasHoraTarget,
            piezasHoraReal,
            piezasDia,
            piezasDiaSinOEE,
            piezasSemana,
            piezasSemanaBruto,
            piezasAno,
            piezasAnoBruto,
            metaAno,
            cumplimiento,
            cumpleDemanda,

            // Datos REALES del diagrama
            piezasDiaReal,
            piezasSemanaReal,
            piezasAnoReal,
            cumplimientoReal,
            cumpleDemandaReal,

            // OEE y Pérdidas
            availability,
            yieldVal,
            efficiency,
            piezasPerdidasDisp,
            piezasPerdidasEficiencia,
            piezasPerdidasCalidad,
            linkOeeToStudy
        };
    }, [studyConfig, localMetrics]);

    const {
        calcMode = 'pph',
        oeePenalty = 15,
        oeePercent = 85,
        oeeFactor = 0.85,
        workDaysPerWeek = 5,
        country = 'MX',
        annualDemand = 18388734,
        shiftHours = 8,

        feriados = 7,
        diasAnuales = 253,
        cicloRealSeg = 0,
        cicloTargetSeg = 0,
        ppmReal = 0,
        ppmTarget = 0,
        cpmReal = 0,
        cpmTarget = 0,
        piezasHora = 0,
        piezasHoraTarget = 0,
        piezasHoraReal = 0,
        piezasDia = 0,
        piezasDiaSinOEE = 0,
        piezasSemana = 0,
        piezasSemanaBruto = 0,
        piezasAno = 0,
        piezasAnoBruto = 0,
        metaAno = 0,
        cumplimiento = 0,
        cumpleDemanda = false,
        cycleOutputQty = 1,

        piezasDiaReal = 0,
        piezasSemanaReal = 0,
        piezasAnoReal = 0,
        cumplimientoReal = 0,
        cumpleDemandaReal = false,

        availability = 95,
        yieldVal = 98,
        efficiency = 91.3978,
        piezasPerdidasDisp = 0,
        piezasPerdidasEficiencia = 0,
        piezasPerdidasCalidad = 0,
        linkOeeToStudy = false
    } = longTermMetrics || {};


    // ── Helpers de Exportación a CSV ──
    const getYYYYMMDD = () => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        return `${yyyy}${mm}${dd}`;
    };

    const downloadCSV = (content, filename) => {
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportStepsCSV = () => {
        if (!currentStudy) return;

        if (validationResults.errorCount > 0) {
            showMessage('La exportación está bloqueada porque existen errores críticos de validación.', 'error');
            return;
        }



        const headers = [
            'Study Name',
            'Project ID',
            'Station',
            'Device Letter',
            'Device Type',
            'Action',
            'Device Qty',
            'Sensor Type',
            'Sensor Qty',
            'Linear Distance mm',
            'Angular Distance deg',
            'Task Description',
            'Dependencies',
            'Start Time ms',
            'Duration ms',
            'Finish Time ms',
            'Sequence Group',
            'Waits Main Index',
            'Can Run During Index',
            'Critical Path',
            'Bottleneck',
            'Notes'
        ];

        const escapeCSV = (val) => {
            if (val === undefined || val === null) return '';
            let str = String(val);
            if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
                str = '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        const rows = steps.map(step => {
            const depsStr = (step.dependencyStepIds || []).map(depId => {
                const depStep = steps.find(s => s.id === depId);
                if (depStep) {
                    return `${depStep.stationLabel || 'STN'}: ${depStep.taskDescription || 'Paso'}`;
                }
                return depId;
            }).join('; ');

            return [
                currentStudy.name,
                projectId,
                step.stationLabel || '',
                step.deviceLetter || '',
                step.deviceType || '',
                step.deviceAction || '',
                step.deviceQty !== undefined ? step.deviceQty : 1,
                step.sensorType || '',
                step.sensorQty !== undefined ? step.sensorQty : 0,
                step.linearDistanceMm || 0,
                step.angularDistanceDeg || 0,
                step.taskDescription || '',
                depsStr,
                step.startTimeMs !== undefined ? Math.round(step.startTimeMs) : 0,
                step.durationMs !== undefined ? Math.round(step.durationMs) : 0,
                step.finishTimeMs !== undefined ? Math.round(step.finishTimeMs) : 0,
                step.sequenceGroup || '',
                step.waitsForMainIndex ? 'Yes' : 'No',
                step.canRunDuringIndex ? 'Yes' : 'No',
                step.isCriticalPath ? 'Yes' : 'No',
                step.isBottleneck ? 'Yes' : 'No',
                step.notes || ''
            ].map(escapeCSV);
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        downloadCSV(csvContent, `timing-study-${currentStudy.name.replace(/[^a-zA-Z0-9-_]/g, '_')}-${getYYYYMMDD()}.csv`);
    };

    const handleExportSummaryCSV = () => {
        if (!currentStudy) return;

        if (validationResults.errorCount > 0) {
            showMessage('La exportación está bloqueada porque existen errores críticos de validación.', 'error');
            return;
        }



        const headers = [
            'Study Name',
            'Target PPM',
            'Effective Target Cycle Time Sec',
            'Machine Cycle Time Ms',
            'Calculated PPM',
            'Bottleneck Station',
            'Status',
            'Error Count',
            'Warning Count',
            'Info Count'
        ];

        const escapeCSV = (val) => {
            if (val === undefined || val === null) return '';
            let str = String(val);
            if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
                str = '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        const targetCycleSec = currentStudy.targetPPM ? (60 / currentStudy.targetPPM) : 0;

        const row = [
            currentStudy.name,
            currentStudy.targetPPM || 0,
            targetCycleSec.toFixed(2),
            currentStudy.machineCycleTimeMs || 0,
            currentStudy.calculatedPPM !== undefined ? currentStudy.calculatedPPM.toFixed(1) : 0,
            currentStudy.bottleneckStationLabel || '',
            currentStudy.status || '',
            validationResults.errorCount,
            validationResults.warningCount,
            validationResults.infoCount
        ].map(escapeCSV);

        const csvContent = [
            headers.join(','),
            row.join(',')
        ].join('\n');

        downloadCSV(csvContent, `timing-study-summary-${currentStudy.name.replace(/[^a-zA-Z0-9-_]/g, '_')}-${getYYYYMMDD()}.csv`);
    };

    const getDataQualityBadge = (quality) => {
        switch (String(quality).toUpperCase()) {
            case 'READY':
                return <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold">READY</span>;
            case 'REVIEW':
                return <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-[10px] font-bold">REVIEW</span>;
            case 'BLOCKED':
                return <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-[10px] font-bold">BLOCKED</span>;
            default:
                return <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-md text-[10px] font-bold">EMPTY</span>;
        }
    };

    // ── Listeners de datos ──
    useEffect(() => {
        if (!projectId) {
            setStudies([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        // 1. Cargar estudios del proyecto
        const unsubStudies = onProjectTimingStudies(projectId, (data) => {
            setStudies(data);
            if (data.length > 0) {
                // Seleccionar el primer estudio si no hay ninguno seleccionado o el seleccionado ya no existe
                setSelectedStudyId(prev => {
                    const exists = data.some(s => s.id === prev);
                    return exists ? prev : data[0].id;
                });
            } else {
                setSelectedStudyId('');
            }
            setLoading(false);
        });

        // 2. Cargar estaciones del proyecto
        const unsubStations = onProjectStations(projectId, (data) => {
            // Ordenar por indexer y stn
            const sortedStations = [...data].sort((a, b) => {
                if (a.indx !== b.indx) return (a.indx || 1) - (b.indx || 1);
                return (Number(a.stn) || 0) - (Number(b.stn) || 0);
            });
            setStations(sortedStations);
        });

        return () => {
            unsubStudies();
            unsubStations();
        };
    }, [projectId]);

    // ── Cargar pasos del estudio seleccionado ──
    useEffect(() => {
        if (!projectId || !selectedStudyId) {
            setSteps([]);
            return;
        }

        const unsubSteps = onTimingStudySteps(projectId, selectedStudyId, (data) => {
            setSteps(data);
        });

        return () => {
            unsubSteps();
        };
    }, [projectId, selectedStudyId]);

    // ── Sincronizar configuración local al cambiar de estudio ──
    useEffect(() => {
        if (currentStudy) {
            // Skip sync if we recently saved (prevents onSnapshot from overwriting local edits)
            if (justSavedConfigRef.current && (Date.now() - justSavedConfigRef.current) < 3000) {
                return;
            }
            // If user has pending local changes, only update calculated fields (metrics), not config
            if (hasConfigChanges) {
                setStudyConfig(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        machineCycleTimeMs: currentStudy.machineCycleTimeMs,
                        machineCycleTimeSec: currentStudy.machineCycleTimeSec,
                        calculatedPPM: currentStudy.calculatedPPM,
                        dwellTimeMs: currentStudy.dwellTimeMs,
                        bottleneckStationId: currentStudy.bottleneckStationId,
                        bottleneckStationLabel: currentStudy.bottleneckStationLabel,
                        status: currentStudy.status
                    };
                });
                return;
            }
            const custom = currentStudy.customStandards || {};
            const linkOeeToStudy = !!custom.linkOeeToStudy;
            const oeePenalty = custom.oeePenalty !== undefined ? Number(custom.oeePenalty) : 15;
            const oeeFactor = (100 - oeePenalty) / 100;
            
            const availability = custom.availability !== undefined ? Number(custom.availability) : 95;
            const yieldVal = custom.yield !== undefined ? Number(custom.yield) : 98;
            const efficiency = custom.efficiency !== undefined 
                ? Number(custom.efficiency) 
                : ((oeeFactor * 1000000) / (availability * yieldVal));

            setStudyConfig({
                ...currentStudy,
                linkOeeToStudy,
                oeePenalty,
                availability: Math.round(availability * 10000) / 10000,
                efficiency: Math.round(efficiency * 10000) / 10000,
                yield: Math.round(yieldVal * 10000) / 10000,
                workDaysPerWeek: custom.workDaysPerWeek !== undefined ? custom.workDaysPerWeek : 5,
                country: custom.country !== undefined ? custom.country : 'MX',
                annualDemand: custom.annualDemand !== undefined ? custom.annualDemand : 18388734
            });
            setHasConfigChanges(false);
        } else {
            setStudyConfig(null);
            setHasConfigChanges(false);
        }
    }, [currentStudy]);

    // ── Sincronizar ajustes estándar globales (con fallback a locales de estudio si existen) ──
    useEffect(() => {
        if (currentStudy) {
            const defaults = {
                motionTimeValues: {
                    controller_scan_network: 80,
                    valve_response: 30,
                    handshake_response: 200,
                    vision_camera_response: 15,
                    rf_tag_read: 25,
                    shock_absorber_deceleration: 1000,
                    small_gripper: 150,
                    large_gripper: 200,
                    vacuum_gripper: 400,
                    guided_cylinder: 200,
                    standard_pneumatic_cylinder: 300,
                    rodless_cylinder: 350,
                    short_large_bore_cylinder: 450,
                    small_rotary_actuator: 600,
                    large_rotary_actuator: 2400,
                    escapement_tic_toc: 500,
                    pneumatic_rotary_clamp: 1000,
                    servo_belt_driven: 500,
                    servo_ballscrew_direct_coupled: 500,
                    servo_timing_belt_driven: 1000,
                    servo_linear_motor: 2000,
                    epson_t3_robot: 1500,
                    c6_robot: 1000
                },
                classifiers: [
                    { id: "c1", deviceType: "CYL PNEU", deviceAction: "EXT", motionValueId: "standard_pneumatic_cylinder" },
                    { id: "c2", deviceType: "CYL PNEU", deviceAction: "RET", motionValueId: "standard_pneumatic_cylinder" },
                    { id: "c3", deviceType: "ROT PNEU", deviceAction: "CW", motionValueId: "small_rotary_actuator" },
                    { id: "c4", deviceType: "ROT PNEU", deviceAction: "CCW", motionValueId: "small_rotary_actuator" },
                    { id: "c5", deviceType: "GPR", deviceAction: "*", motionValueId: "small_gripper" },
                    { id: "c6", deviceType: "GPR SO", deviceAction: "*", motionValueId: "small_gripper" },
                    { id: "c7", deviceType: "GPR SC", deviceAction: "*", motionValueId: "large_gripper" },
                    { id: "c8", deviceType: "SV", deviceAction: "*", motionValueId: "servo_timing_belt_driven" }
                ]
            };
            
            async function loadGlobalStandards() {
                try {
                    const globalData = await getGlobalMotionStandards();
                    const baseStandards = globalData || defaults;
                    
                    const studyStandards = currentStudy.customStandards || baseStandards;
                    const merged = {
                        ...studyStandards,
                        motionTimeValues: { ...baseStandards.motionTimeValues, ...(studyStandards.motionTimeValues || {}) },
                        classifiers: Array.isArray(studyStandards.classifiers) ? studyStandards.classifiers : baseStandards.classifiers
                    };
                    
                    setStandardsConfig(merged);
                    setHasStandardsChanges(false);
                } catch (e) {
                    console.error("Error cargando estándares globales en TimingStudyManager:", e);
                    setStandardsConfig(JSON.parse(JSON.stringify(defaults)));
                    setHasStandardsChanges(false);
                }
            }
            
            loadGlobalStandards();
        } else {
            setStandardsConfig(null);
            setHasStandardsChanges(false);
        }
    }, [currentStudy]);

    // ── Cargar grupos de actuadores dinámicos desde Firestore ──
    useEffect(() => {
        getActuatorGroups()
            .then(data => {
                if (data && Array.isArray(data.groups) && data.groups.length > 0) {
                    setActuatorGroups(data.groups);
                }
            })
            .catch(err => console.warn('[TimingStudyManager] No se pudieron cargar grupos:', err));
    }, []);

    // ── Mostrar mensajes temporales ──
    const showMessage = (msg, type = 'success') => {
        if (type === 'success') {
            setSuccess(msg);
            setTimeout(() => setSuccess(null), 4000);
        } else {
            setError(msg);
            setTimeout(() => setError(null), 5000);
        }
    };

    // ── Configuración Handlers ──
    const handleConfigChanges = useCallback((updates) => {
        setStudyConfig(prev => {
            if (!prev) return prev;
            
            const newConfig = { ...prev, ...updates };
            const linkOeeToStudy = !!newConfig.linkOeeToStudy;

            // Caso A: Se cambi├│ el OEE (oeePenalty)
            if (updates.oeePenalty !== undefined && updates.oeePenalty !== prev.oeePenalty) {
                if (!linkOeeToStudy) {
                    const oeePenaltyNew = Number(updates.oeePenalty);
                    const oeeNew = (100 - oeePenaltyNew) / 100;
                    
                    const currentA = prev.availability !== undefined ? Number(prev.availability) : 95;
                    const currentY = prev.yield !== undefined ? Number(prev.yield) : 98;
                    const currentE = prev.efficiency !== undefined ? Number(prev.efficiency) : (( (100 - prev.oeePenalty) / 100 * 1000000 ) / (currentA * currentY));
                    
                    const oeeOld = (currentA * currentE * currentY) / 1000000;
                    let r = oeeOld > 0 ? Math.pow(oeeNew / oeeOld, 1/3) : 1;
                    
                    let aNew = Math.min(100, Math.max(0.1, currentA * r));
                    let yNew = Math.min(100, Math.max(0.1, currentY * r));
                    let eNew = (oeeNew * 1000000) / (aNew * yNew);
                    
                    if (eNew > 100) {
                        eNew = 100;
                        const r2 = Math.sqrt((oeeNew * 1000000) / (aNew * yNew * 100));
                        aNew = Math.min(100, Math.max(0.1, aNew * r2));
                        yNew = Math.min(100, Math.max(0.1, yNew * r2));
                        eNew = (oeeNew * 1000000) / (aNew * yNew);
                    }
                    
                    newConfig.availability = Math.round(aNew * 10000) / 10000;
                    newConfig.yield = Math.round(yNew * 10000) / 10000;
                    newConfig.efficiency = Math.round(eNew * 10000) / 10000;
                }
            }
            
            // Caso B: Se cambi├│ la disponibilidad (availability)
            else if (updates.availability !== undefined && updates.availability !== prev.availability) {
                if (!linkOeeToStudy) {
                    const aNew = Number(updates.availability);
                    const oee = (100 - (prev.oeePenalty !== undefined ? Number(prev.oeePenalty) : 15)) / 100;
                    
                    // Adjust Efficiency (keeping Yield constant)
                    const currentY = prev.yield !== undefined ? Number(prev.yield) : 98;
                    let eNew = (oee * 1000000) / (aNew * currentY);
                    let yNew = currentY;
                    
                    if (eNew > 100) {
                        eNew = 100;
                        yNew = (oee * 1000000) / (aNew * 100);
                        if (yNew > 100) {
                            yNew = 100;
                        }
                    }
                    
                    newConfig.efficiency = Math.round(eNew * 10000) / 10000;
                    newConfig.yield = Math.round(yNew * 10000) / 10000;
                }
            }
            
            // Caso C: Se cambi├│ la eficiencia (efficiency)
            else if (updates.efficiency !== undefined && updates.efficiency !== prev.efficiency) {
                if (!linkOeeToStudy) {
                    const eNew = Number(updates.efficiency);
                    const oee = (100 - (prev.oeePenalty !== undefined ? Number(prev.oeePenalty) : 15)) / 100;
                    
                    // Adjust Availability (keeping Yield constant)
                    const currentY = prev.yield !== undefined ? Number(prev.yield) : 98;
                    let aNew = (oee * 1000000) / (eNew * currentY);
                    let yNew = currentY;
                    
                    if (aNew > 100) {
                        aNew = 100;
                        yNew = (oee * 1000000) / (eNew * 100);
                        if (yNew > 100) {
                            yNew = 100;
                        }
                    }
                    
                    newConfig.availability = Math.round(aNew * 10000) / 10000;
                    newConfig.yield = Math.round(yNew * 10000) / 10000;
                }
            }
            
            // Caso D: Se cambi├│ el rendimiento (yield)
            else if (updates.yield !== undefined && updates.yield !== prev.yield) {
                if (!linkOeeToStudy) {
                    const yNew = Number(updates.yield);
                    const oee = (100 - (prev.oeePenalty !== undefined ? Number(prev.oeePenalty) : 15)) / 100;
                    
                    // Adjust Availability (keeping Efficiency constant)
                    const currentE = prev.efficiency !== undefined ? Number(prev.efficiency) : 91.3978;
                    let aNew = (oee * 1000000) / (yNew * currentE);
                    let eNew = currentE;
                    
                    if (aNew > 100) {
                        aNew = 100;
                        eNew = (oee * 1000000) / (yNew * 100);
                        if (eNew > 100) {
                            eNew = 100;
                        }
                    }
                    
                    newConfig.availability = Math.round(aNew * 10000) / 10000;
                    newConfig.efficiency = Math.round(eNew * 10000) / 10000;
                }
            }

            return newConfig;
        });
        setHasConfigChanges(true);
    }, []);

    const handleConfigChange = useCallback((field, value) => {
        handleConfigChanges({ [field]: value });
    }, [handleConfigChanges]);

    // Helper: build the save payload from current studyConfig
    const buildConfigPayload = useCallback(() => {
        if (!studyConfig) return null;
        return {
            name: studyConfig.name?.trim() || 'Sin nombre',
            customer: studyConfig.customer || '',
            machineName: studyConfig.machineName || '',
            stationName: studyConfig.stationName || '',
            targetPPM: Number(studyConfig.targetPPM),
            targetPiecesPerShift: Number(studyConfig.targetPiecesPerShift) || 0,
            shiftHours: Number(studyConfig.shiftHours) || 8,
            mainIndexEnabled: !!studyConfig.mainIndexEnabled,
            mainIndexTimeMs: Number(studyConfig.mainIndexTimeMs),
            nestCount: Number(studyConfig.nestCount) || 1,
            positionsPerNest: Number(studyConfig.positionsPerNest) || 1,
            cycleOutputQty: Number(studyConfig.cycleOutputQty) || 1,
            notes: studyConfig.notes || '',
            customStandards: {
                ...(standardsConfig || {}),
                linkOeeToStudy: !!studyConfig.linkOeeToStudy,
                oeePenalty: Number(studyConfig.oeePenalty !== undefined ? studyConfig.oeePenalty : 15),
                availability: Number(studyConfig.availability !== undefined ? studyConfig.availability : 95),
                efficiency: Number(studyConfig.efficiency !== undefined ? studyConfig.efficiency : 91.3978),
                yield: Number(studyConfig.yield !== undefined ? studyConfig.yield : 98),
                workDaysPerWeek: Number(studyConfig.workDaysPerWeek !== undefined ? studyConfig.workDaysPerWeek : 5),
                country: studyConfig.country || 'MX',
                annualDemand: Number(studyConfig.annualDemand !== undefined ? studyConfig.annualDemand : 18388734)
            }
        };
    }, [studyConfig, standardsConfig]);

    // Auto-save config with debounce
    useEffect(() => {
        if (!hasConfigChanges || !studyConfig || !projectId || !selectedStudyId || !canEdit) return;
        if (configSaveTimerRef.current) clearTimeout(configSaveTimerRef.current);
        setConfigAutoSaveStatus('saving');
        configSaveTimerRef.current = setTimeout(async () => {
            try {
                const payload = buildConfigPayload();
                if (!payload) return;
                await updateTimingStudy(projectId, selectedStudyId, payload, userId);
                justSavedConfigRef.current = Date.now();
                setHasConfigChanges(false);
                setConfigAutoSaveStatus('saved');
                setTimeout(() => setConfigAutoSaveStatus('idle'), 2500);
            } catch (err) {
                console.error('Auto-save config error:', err);
                setConfigAutoSaveError(err.message || String(err));
                setConfigAutoSaveStatus('error');
                setTimeout(() => setConfigAutoSaveStatus('idle'), 5000);
            }
        }, 500);
        return () => { if (configSaveTimerRef.current) clearTimeout(configSaveTimerRef.current); };
    }, [hasConfigChanges, studyConfig, projectId, selectedStudyId, canEdit, userId, buildConfigPayload]);

    // Flush pending config changes on page unload (reload / close)
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (!hasConfigChanges || !studyConfig || !projectId || !selectedStudyId) return;
            if (configSaveTimerRef.current) clearTimeout(configSaveTimerRef.current);
            const payload = buildConfigPayload();
            if (!payload) return;
            // Use sendBeacon for reliable unload save
            const body = JSON.stringify({
                projectId,
                studyId: selectedStudyId,
                updates: payload,
                userId
            });
            // Fallback: synchronous XHR is deprecated, use navigator.sendBeacon or just save synchronously via fetch keepalive
            try {
                // Fire-and-forget: save via fetch with keepalive
                const mappedUpdates = {};
                // Map to supabase column names inline for beacon
                if (payload.name !== undefined) mappedUpdates.name = payload.name;
                if (payload.customer !== undefined) mappedUpdates.customer = payload.customer;
                if (payload.machineName !== undefined) mappedUpdates.machine_name = payload.machineName;
                if (payload.stationName !== undefined) mappedUpdates.station_name = payload.stationName;
                if (payload.targetPPM !== undefined) mappedUpdates.target_ppm = payload.targetPPM;
                if (payload.targetPiecesPerShift !== undefined) mappedUpdates.target_pieces_per_shift = payload.targetPiecesPerShift;
                if (payload.shiftHours !== undefined) mappedUpdates.shift_hours = payload.shiftHours;
                if (payload.mainIndexEnabled !== undefined) mappedUpdates.main_index_enabled = payload.mainIndexEnabled;
                if (payload.mainIndexTimeMs !== undefined) mappedUpdates.main_index_time_ms = payload.mainIndexTimeMs;
                if (payload.nestCount !== undefined) mappedUpdates.nest_count = payload.nestCount;
                if (payload.positionsPerNest !== undefined) mappedUpdates.positions_per_nest = payload.positionsPerNest;
                if (payload.cycleOutputQty !== undefined) mappedUpdates.cycle_output_qty = payload.cycleOutputQty;
                
                // Workaround: combine notes and custom_standards
                let cleanNotes = payload.notes || '';
                if (payload.customStandards !== undefined) {
                    mappedUpdates.notes = cleanNotes.trim() + '\n\n---METADATA---\n' + JSON.stringify(payload.customStandards);
                } else {
                    mappedUpdates.notes = cleanNotes;
                }
                
                mappedUpdates.updated_by = userId;
                mappedUpdates.updated_at = new Date().toISOString();
                
                // Use supabase REST API via fetch keepalive
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                if (supabaseUrl && supabaseKey) {
                    fetch(`${supabaseUrl}/rest/v1/timing_studies?id=eq.${selectedStudyId}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`,
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify(mappedUpdates),
                        keepalive: true
                    });
                }
            } catch (e) {
                console.error('beforeunload save error:', e);
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasConfigChanges, studyConfig, projectId, selectedStudyId, userId, buildConfigPayload]);

    // Auto-recalculate with debounce when there are unsaved metrics but config is already saved
    useEffect(() => {
        if (!needsRecalculate || hasConfigChanges || recalculating || !projectId || !selectedStudyId || !canEdit) return;
        
        const timer = setTimeout(async () => {
            setRecalculating(true);
            try {
                const metrics = await recalculateTimingStudy(projectId, selectedStudyId, userId);
                if (metrics && metrics.steps) {
                    setSteps(metrics.steps);
                }
                setStudies(prev => prev.map(s => s.id === selectedStudyId ? {
                    ...s,
                    machineCycleTimeMs: metrics.machineCycleTimeMs,
                    machineCycleTimeSec: metrics.machineCycleTimeSec,
                    calculatedPPM: metrics.calculatedPPM,
                    bottleneckStationId: metrics.bottleneckStationId,
                    bottleneckStationLabel: metrics.bottleneckStationLabel,
                    status: metrics.status
                } : s));
                // Proteger contra onSnapshot sobrescribiendo el estado local
                justSavedConfigRef.current = Date.now();
            } catch (err) {
                console.error('Auto-recalculate error:', err);
            } finally {
                setRecalculating(false);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [needsRecalculate, hasConfigChanges, recalculating, projectId, selectedStudyId, canEdit, userId]);

    const handleSaveConfig = async () => {
        if (!projectId || !selectedStudyId || !studyConfig || !canEdit) return;

        // Validaciones
        if (!studyConfig.name?.trim()) {
            showMessage('El nombre del estudio es requerido.', 'error');
            return;
        }
        if (Number(studyConfig.targetPiecesPerShift) <= 0 && Number(studyConfig.targetPPM) <= 0) {
            showMessage('Debes configurar las piezas por turno o el PPM objetivo.', 'error');
            return;
        }

        if (Number(studyConfig.mainIndexTimeMs) < 0) {
            showMessage('El tiempo de indexador no puede ser negativo.', 'error');
            return;
        }

        try {
            const payload = buildConfigPayload();
            if (!payload) return;
            await updateTimingStudy(projectId, selectedStudyId, payload, userId);

            setHasConfigChanges(false);
            showMessage('Configuración del estudio guardada con éxito.');
        } catch (err) {
            console.error(err);
            showMessage(`Error al guardar configuración: ${err.message}`, 'error');
        }
    };

    // ── Ajustes Estándar del Proyecto Handlers ──
    const handleMotionValueChange = (key, value) => {
        setStandardsConfig(prev => {
            if (!prev) return prev;
            const updated = {
                ...prev,
                motionTimeValues: {
                    ...prev.motionTimeValues,
                    [key]: value === '' ? null : Number(value)
                }
            };
            setHasStandardsChanges(true);
            return updated;
        });
    };

    const handleAddClassifierRule = () => {
        setStandardsConfig(prev => {
            if (!prev) return prev;
            const newRule = {
                id: 'cr_' + Date.now(),
                deviceType: TIMING_DEVICE_TYPES.CYL_PNEU,
                deviceAction: 'EXT',
                motionValueId: 'standard_pneumatic_cylinder',
                overrideValue: null
            };
            const updated = {
                ...prev,
                classifiers: [...(prev.classifiers || []), newRule]
            };
            setHasStandardsChanges(true);
            return updated;
        });
    };

    const handleUpdateClassifierRule = (ruleId, updates) => {
        setStandardsConfig(prev => {
            if (!prev) return prev;
            const updated = {
                ...prev,
                classifiers: (prev.classifiers || []).map(c => 
                    c.id === ruleId ? { ...c, ...updates } : c
                )
            };
            setHasStandardsChanges(true);
            return updated;
        });
    };

    const handleDeleteClassifierRule = (ruleId) => {
        setStandardsConfig(prev => {
            if (!prev) return prev;
            const updated = {
                ...prev,
                classifiers: (prev.classifiers || []).filter(c => c.id !== ruleId)
            };
            setHasStandardsChanges(true);
            return updated;
        });
    };

    const handleSaveStandards = async () => {
        if (!projectId || !selectedStudyId || !canEdit || !standardsConfig) return;

        try {
            await updateTimingStudy(projectId, selectedStudyId, {
                notes: studyConfig?.notes || '',
                customStandards: {
                    ...standardsConfig,
                    oeePenalty: Number(studyConfig?.oeePenalty !== undefined ? studyConfig.oeePenalty : 15),
                    availability: Number(studyConfig?.availability !== undefined ? studyConfig.availability : 95),
                    efficiency: Number(studyConfig?.efficiency !== undefined ? studyConfig.efficiency : 91.3978),
                    yield: Number(studyConfig?.yield !== undefined ? studyConfig.yield : 98),
                    workDaysPerWeek: Number(studyConfig?.workDaysPerWeek !== undefined ? studyConfig.workDaysPerWeek : 5),
                    country: studyConfig?.country || 'MX',
                    annualDemand: Number(studyConfig?.annualDemand !== undefined ? studyConfig.annualDemand : 18388734)
                }
            }, userId);

            setHasStandardsChanges(false);
            showMessage('Ajustes estándar del proyecto guardados en Supabase.');
        } catch (err) {
            console.warn('[TimingStudyManager] Fall├│ guardado en Supabase, guardando en localStorage como fallback:', err.message);
            // Guardar en localStorage como fallback
            localStorage.setItem(`custom_standards_${selectedStudyId}`, JSON.stringify(standardsConfig));
            setHasStandardsChanges(false);
            showMessage('Ajustes estándar guardados localmente (ejecuta el script SQL en Supabase para habilitar guardado en la nube).', 'warning');
        }
    };

    // ── CRUD Timing Study Handlers ──
    const handleCreateStudy = async (name = '') => {
        if (!projectId || !canEdit) return;

        const studyName = name || prompt('Ingrese el nombre para el nuevo estudio de tiempos:', 'Estudio de Tiempos V1');
        if (!studyName || !studyName.trim()) return;

        try {
            const newId = await createTimingStudy(projectId, {
                name: studyName.trim(),
                targetPPM: 20,
                targetPiecesPerShift: 9600,
                shiftHours: 8,
                mainIndexTimeMs: 2500,
                nestCount: 1,
                positionsPerNest: 1,
                cycleOutputQty: 1,
                customStandards: {
                    oeePenalty: 15,
                    availability: 95,
                    efficiency: 91.3978,
                    yield: 98,
                    workDaysPerWeek: 5,
                    country: 'MX',
                    annualDemand: 18388734
                }
            }, userId);

            setSelectedStudyId(newId);
            showMessage('Estudio de tiempos creado con éxito.');
        } catch (err) {
            console.error(err);
            showMessage(`Error al crear estudio: ${err.message}`, 'error');
        }
    };

    const handleCreateFromStations = async () => {
        if (!projectId || !canEdit) return;
        if (stations.length === 0) {
            showMessage('No hay estaciones configuradas en el proyecto para crear el estudio.', 'error');
            return;
        }

        const studyName = prompt('Nombre del nuevo estudio basado en estaciones:', 'Estudio de Tiempos - Estaciones');
        if (!studyName || !studyName.trim()) return;

        try {
            // 1. Crear el estudio
            const studyId = await createTimingStudy(projectId, {
                name: studyName.trim(),
                targetPPM: 20,
                targetPiecesPerShift: 9600,
                shiftHours: 8,
                mainIndexTimeMs: 2500,
                nestCount: 1,
                positionsPerNest: 1,
                cycleOutputQty: 1,
                customStandards: {
                    oeePenalty: 15,
                    availability: 95,
                    efficiency: 91.3978,
                    yield: 98,
                    workDaysPerWeek: 5,
                    country: 'MX',
                    annualDemand: 18388734
                }
            }, userId);

            // 2. Crear los pasos placeholders en orden
            const newSteps = stations.map((stn, idx) => {
                const stnPad = String(stn.stn || '').padStart(2, '0');
                const multiIdx = stations.some(s => s.indx > 1);
                const label = multiIdx ? `${stn.indx || 1}-STN${stnPad}` : `STN${stnPad}`;

                return {
                    stationId: stn.id,
                    stationLabel: label,
                    taskDescription: `Secuencia para ${stn.abbreviation || stn.description || label}`,
                    durationMs: 0,
                    sortOrder: idx + 1,
                    active: true
                };
            });

            await bulkCreateTimingSteps(projectId, studyId, newSteps, userId);
            setSelectedStudyId(studyId);
            showMessage('Estudio creado a partir de las estaciones del proyecto.');
            
            // Recalcular inicialmente para fijar estado
            await recalculateTimingStudy(projectId, studyId, userId);
        } catch (err) {
            console.error(err);
            showMessage(`Error al crear desde estaciones: ${err.message}`, 'error');
        }
    };

    const handleDeleteStudy = async () => {
        if (!projectId || !selectedStudyId || !canEdit) return;
        if (!confirm('┬┐Está seguro de que desea eliminar este estudio de tiempos? Esta acción se aplicará mediante soft-delete.')) return;

        try {
            await deleteTimingStudy(projectId, selectedStudyId, userId);
            showMessage('Estudio de tiempos eliminado.');
        } catch (err) {
            console.error(err);
            showMessage(`Error al eliminar estudio: ${err.message}`, 'error');
        }
    };

    const handleRecalculate = async () => {
        if (!projectId || !selectedStudyId) return;
        setRecalculating(true);
        setError(null);

        try {
            // 1. Si hay cambios de configuración pendientes, guardarlos primero
            if (hasConfigChanges && studyConfig && canEdit) {
                if (configSaveTimerRef.current) {
                    clearTimeout(configSaveTimerRef.current);
                    configSaveTimerRef.current = null;
                }
                const payload = buildConfigPayload();
                if (payload) {
                    await updateTimingStudy(projectId, selectedStudyId, payload, userId);
                }
                setHasConfigChanges(false);
                setConfigAutoSaveStatus('saved');
                setTimeout(() => setConfigAutoSaveStatus('idle'), 2500);
            }

            // 2. Ahora sí recalcular (la BD ya tiene los datos más recientes)
            const metrics = await recalculateTimingStudy(projectId, selectedStudyId, userId);
            showMessage('Estudio recalculado correctamente.');
            if (metrics && metrics.steps) {
                setSteps(metrics.steps);
            }

            // 3. Actualizar studies preservando la config local del usuario
            setStudies(prev => prev.map(s => s.id === selectedStudyId ? {
                ...s,
                machineCycleTimeMs: metrics.machineCycleTimeMs,
                machineCycleTimeSec: metrics.machineCycleTimeSec,
                calculatedPPM: metrics.calculatedPPM,
                bottleneckStationId: metrics.bottleneckStationId,
                bottleneckStationLabel: metrics.bottleneckStationLabel,
                status: metrics.status
            } : s));

            // 4. Proteger contra onSnapshot sobrescribiendo el estado local
            justSavedConfigRef.current = Date.now();
        } catch (err) {
            console.error(err);
            showMessage(`Error al recalcular estudio: ${err.message}`, 'error');
        } finally {
            setRecalculating(false);
        }
    };

    // ── CRUD Timing Steps Handlers ──
    const handleAddStep = async (stationId = null) => {
        if (!projectId || !selectedStudyId || !canEdit) return;
        if (stations.length === 0) return;

        // Buscar el último sortOrder
        const lastSortOrder = steps.length > 0 ? Math.max(...steps.map(s => s.sortOrder || 0)) : 0;
        const defaultStation = stationId 
            ? (stations.find(s => s.id === stationId) || stations[0])
            : stations[0];

        try {
            const newStepData = {
                stationId: defaultStation.id,
                durationMs: 0,
                taskDescription: 'Definir actividad',
                sortOrder: lastSortOrder + 1,
                active: true
            };
            const newId = await addTimingStep(projectId, selectedStudyId, newStepData, userId);
            
            // Format station label
            const stnPad = String(defaultStation.stn || '').padStart(2, '0');
            const multiIdx = stations.some(s => s.indx > 1);
            const stationLabel = multiIdx ? `${defaultStation.indx || 1}-STN${stnPad}` : `STN${stnPad}`;

            const fullNewStep = {
                id: newId,
                ...newStepData,
                stationLabel,
                projectId,
                timingStudyId: selectedStudyId,
                deviceQty: 1,
                sensorQty: 0,
                linearDistanceMm: 0,
                angularDistanceDeg: 0,
                dependencyStepIds: []
            };

            setSteps(prev => [...prev, fullNewStep].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
        } catch (err) {
            console.error(err);
            showMessage(`Error al añadir paso: ${err.message}`, 'error');
        }
    };

    const handleUpdateStep = async (stepId, updates) => {
        if (!projectId || !selectedStudyId || !canEdit) return;

        const step = steps.find(s => s.id === stepId);
        if (!step) return;

        try {
            // Limpiar campos UI-only antes de guardar en Firestore
            const { selectedGroupId: _sg, ...cleanedUpdates } = updates;

            // Si el drawer ya envía durationMs explícito, respetarlo (no recalcular)
            const drawerSentDuration = cleanedUpdates.durationMs !== undefined;

            // Campos que afectan la duración sugerida (solo recalcular si el drawer NO envi├│ durationMs)
            const isCalculationFieldChanged = !drawerSentDuration && [
                'deviceType',
                'deviceAction',
                'linearDistanceMm',
                'angularDistanceDeg',
                'sensorType',
                'triggerCondition',
                'notes'
            ].some(f => cleanedUpdates[f] !== undefined && cleanedUpdates[f] !== step[f]);

            const tempStep = {
                ...step,
                ...cleanedUpdates
            };

            const finalUpdates = { ...cleanedUpdates };

            if (isCalculationFieldChanged && tempStep.deviceType) {
                const suggestion = calculateSuggestedDuration(tempStep, { customStandards: standardsConfig });
                if (suggestion !== null && suggestion !== undefined && suggestion >= 0) {
                    finalUpdates.durationMs = suggestion;
                }
            }

            // Llamar a Supabase/Firebase
            await updateTimingStep(projectId, selectedStudyId, stepId, finalUpdates, userId);

            // Actualizar localmente los pasos
            setSteps(prev => {
                const updatedSteps = prev.map(s => s.id === stepId ? { ...s, ...finalUpdates } : s);
                // Si el cambio afecta tiempos de inicio/fin, recalcular métricas localmente de forma instantánea
                const metrics = calculateTimingStudyMetrics(currentStudy, updatedSteps, stations);
                if (metrics && Array.isArray(metrics.steps)) {
                    return metrics.steps;
                }
                return updatedSteps;
            });
        } catch (err) {
            console.error(err);
            showMessage(`Error al actualizar paso: ${err.message}`, 'error');
        }
    };

    const handleUpdateStepField = async (stepId, field, value) => {
        if (!projectId || !selectedStudyId || !canEdit) return;
        
        const step = steps.find(s => s.id === stepId);
        if (!step) return;

        // Validar si el valor es el mismo para no hacer guardados innecesarios
        if (step[field] === value) return;

        // Validaciones locales
        if (field === 'durationMs' && Number(value) < 0) {
            showMessage('La duración no puede ser negativa.', 'error');
            return;
        }
        if (field === 'linearDistanceMm' && Number(value) < 0) {
            showMessage('La distancia no puede ser negativa.', 'error');
            return;
        }
        if (field === 'angularDistanceDeg' && Number(value) < 0) {
            showMessage('El ángulo no puede ser negativo.', 'error');
            return;
        }

        try {
            const updates = { [field]: value };
            if (field === 'stationId') {
                const station = stations.find(s => s.id === value);
                if (station) {
                    const stnPad = String(station.stn || '').padStart(2, '0');
                    const multiIdx = stations.some(s => s.indx > 1);
                    updates.stationLabel = multiIdx ? `${station.indx || 1}-STN${stnPad}` : `STN${stnPad}`;
                }
            }

            // Si se modifica el tipo de dispositivo, resetear acción y distancias incompatibles
            if (field === 'deviceType') {
                const newDeviceType = value;
                
                // Resetear acción si ya no es válida para el nuevo tipo de dispositivo
                const validActions = getValidActionsForDevice(newDeviceType);
                if (step.deviceAction && !validActions.includes(step.deviceAction)) {
                    updates.deviceAction = '';
                }

                // Resetear distancias según el tipo físico
                const isCylinderOrServo = ['CYL PNEU', 'CYL ELEC', 'CYL HYD', 'SV'].includes(newDeviceType);
                const isRotary = ['ROT PNEU', 'ROT ELEC'].includes(newDeviceType);

                if (!isCylinderOrServo) {
                    updates.linearDistanceMm = 0;
                }
                if (!isRotary) {
                    updates.angularDistanceDeg = 0;
                }
            }

            // Paso temporal con todas las actualizaciones combinadas
            const tempStep = {
                ...step,
                ...updates
            };

            // Campos que afectan la duración sugerida
            const isCalculationField = [
                'deviceType',
                'deviceAction',
                'linearDistanceMm',
                'angularDistanceDeg',
                'sensorType',
                'triggerCondition',
                'notes'
            ].includes(field);

            if (isCalculationField && tempStep.deviceType) {
                const suggestion = calculateSuggestedDuration(tempStep, { customStandards: standardsConfig });
                if (suggestion !== null && suggestion !== undefined && suggestion >= 0) {
                    updates.durationMs = suggestion;
                }
            }

            await updateTimingStep(projectId, selectedStudyId, stepId, updates, userId);
            setSteps(prev => prev.map(s => s.id === stepId ? { ...s, ...updates } : s));
        } catch (err) {
            console.error(err);
            showMessage(`Error al actualizar paso: ${err.message}`, 'error');
        }
    };

    const handleDuplicateStep = async (step) => {
        if (!projectId || !selectedStudyId || !canEdit) return;

        try {
            // Clonar datos sin ID ni auditoría
            const clonedData = {
                ...step,
                sortOrder: step.sortOrder + 1,
                taskDescription: `${step.taskDescription} (Copia)`
            };
            delete clonedData.id;
            delete clonedData.createdAt;
            delete clonedData.updatedAt;

            // Desplazar los siguientes pasos para hacer espacio
            const nextSteps = steps.filter(s => s.sortOrder > step.sortOrder);
            for (const s of nextSteps) {
                await updateTimingStep(projectId, selectedStudyId, s.id, { sortOrder: s.sortOrder + 1 }, userId);
            }

            await addTimingStep(projectId, selectedStudyId, clonedData, userId);
            showMessage('Paso duplicado correctamente.');

            const freshSteps = await getTimingStudySteps(projectId, selectedStudyId);
            setSteps(freshSteps);
        } catch (err) {
            console.error(err);
            showMessage(`Error al duplicar paso: ${err.message}`, 'error');
        }
    };

    const handleDeleteStep = async (stepId) => {
        if (!projectId || !selectedStudyId || !canEdit) return;
        if (!confirm('┬┐Desea quitar este paso del estudio?')) return;

        try {
            await deleteTimingStep(projectId, selectedStudyId, stepId, userId);
            showMessage('Paso eliminado.');
            setSteps(prev => prev.filter(s => s.id !== stepId));
        } catch (err) {
            console.error(err);
            showMessage(`Error al eliminar paso: ${err.message}`, 'error');
        }
    };

    const handleSuggestDuration = async (step) => {
        if (!projectId || !selectedStudyId || !canEdit) return;

        const suggestion = calculateSuggestedDuration(step, { customStandards: standardsConfig });
        if (suggestion !== null && suggestion !== undefined && suggestion >= 0) {
            try {
                await updateTimingStep(projectId, selectedStudyId, step.id, { durationMs: suggestion }, userId);
                showMessage(`Duración sugerida aplicada: ${suggestion} ms`);
                setSteps(prev => prev.map(s => s.id === step.id ? { ...s, durationMs: suggestion } : s));
            } catch (err) {
                console.error(err);
                showMessage(`Error al aplicar sugerencia: ${err.message}`, 'error');
            }
        } else {
            showMessage('No hay sugerencia disponible para este paso. Verifique el tipo de actuador y distancias.', 'error');
        }
    };

    const handleSuggestAllDurations = async () => {
        if (!projectId || !selectedStudyId || !canEdit || steps.length === 0) return;
        if (!confirm('┬┐Desea recalcular y aplicar la duración sugerida a TODOS los pasos activos del estudio? Esto sobrescribirá las duraciones manuales actuales.')) return;

        try {
            setRecalculating(true);
            const updatedSteps = [];
            
            await Promise.all(steps.map(async (step) => {
                if (step.active === false) {
                    updatedSteps.push(step);
                    return;
                }
                const suggestion = calculateSuggestedDuration(step, { customStandards: standardsConfig });
                if (suggestion !== null && suggestion !== undefined && suggestion >= 0) {
                    await updateTimingStep(projectId, selectedStudyId, step.id, { durationMs: suggestion }, userId);
                    updatedSteps.push({ ...step, durationMs: suggestion });
                } else {
                    updatedSteps.push(step);
                }
            }));
            
            setSteps(prev => prev.map(s => {
                const found = updatedSteps.find(u => u.id === s.id);
                return found ? found : s;
            }));
            
            showMessage('Duraciones sugeridas aplicadas a todos los pasos activos con éxito.');
        } catch (err) {
            console.error(err);
            showMessage(`Error al sugerir todas las duraciones: ${err.message}`, 'error');
        } finally {
            setRecalculating(false);
        }
    };

    const handleMoveStep = async (index, direction) => {
        if (!projectId || !selectedStudyId || !canEdit) return;

        const stepA = steps[index];
        const stepB = steps[index + direction];
        if (!stepA || !stepB) return;

        try {
            // Intercambiar sortOrder
            const tempOrder = stepA.sortOrder;
            await updateTimingStep(projectId, selectedStudyId, stepA.id, { sortOrder: stepB.sortOrder }, userId);
            await updateTimingStep(projectId, selectedStudyId, stepB.id, { sortOrder: tempOrder }, userId);
            
            setSteps(prev => {
                const updated = prev.map(s => {
                    if (s.id === stepA.id) return { ...s, sortOrder: stepB.sortOrder };
                    if (s.id === stepB.id) return { ...s, sortOrder: tempOrder };
                    return s;
                });
                return [...updated].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            });
        } catch (err) {
            console.error(err);
            showMessage(`Error al mover paso: ${err.message}`, 'error');
        }
    };

    // ── Manejar dependencias ──
    const handleToggleDependency = async (step, targetId) => {
        if (!projectId || !selectedStudyId || !canEdit) return;

        const currentDeps = step.dependencyStepIds || [];
        let updatedDeps;

        if (currentDeps.includes(targetId)) {
            updatedDeps = currentDeps.filter(id => id !== targetId);
        } else {
            // Evitar auto-dependencia
            if (step.id === targetId) return;
            updatedDeps = [...currentDeps, targetId];
        }

        try {
            await updateTimingStep(projectId, selectedStudyId, step.id, { dependencyStepIds: updatedDeps }, userId);
            setSteps(prev => prev.map(s => s.id === step.id ? { ...s, dependencyStepIds: updatedDeps } : s));
        } catch (err) {
            console.error(err);
            showMessage(`Error al actualizar dependencias: ${err.message}`, 'error');
        }
    };

    // ── Formateo Visual Helpers ──
    const formatTime = (ms) => {
        if (ms === undefined || ms === null) return '0 ms';
        if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
        return `${Math.round(ms)} ms`;
    };

    const getStatusBadge = (status) => {
        switch (String(status).toLowerCase()) {
            case 'ok':
                return <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold">OK</span>;
            case 'warning':
                return <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-[10px] font-bold">WARNING</span>;
            case 'fail':
                return <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-[10px] font-bold">FAIL</span>;
            default:
                return <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-md text-[10px] font-bold">DRAFT</span>;
        }
    };

    // ── Renders Secundarios ──
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800/80">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
                <p className="text-sm text-slate-400">Cargando m├│dulo de estudio de tiempos...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ── Banners de Alertas y ├ëxito ── */}
            {error && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs animate-in fade-in duration-200">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            {success && (
                <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs animate-in fade-in duration-200">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>{success}</span>
                </div>
            )}


            {/* ── Alerta si no hay estaciones en el proyecto ── */}
            {stations.length === 0 && (
                <div className="flex items-start gap-4 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                    <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Proyecto Sin Estaciones</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Este proyecto no tiene estaciones configuradas. Crea estaciones primero en la pestaña de estaciones para poder registrar y vincular correctamente los pasos del estudio de tiempos.
                        </p>
                    </div>
                </div>
            )}

            {/* ── HEADER PRINCIPAL ── */}
            <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                <div>
                    <h2 className="text-lg font-black text-white flex items-center gap-2 tracking-wide">
                        <Timer className="w-5 h-5 text-cyan-400" />
                        ESTUDIO DE TIEMPOS
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Estimación de ciclo, PPM, cuello de botella y secuencia por estación.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {studies.length > 0 && (
                        <select
                            value={selectedStudyId}
                            onChange={(e) => setSelectedStudyId(e.target.value)}
                            className="bg-slate-850 text-slate-200 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                        >
                            {studies.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}

                    {canEdit && (
                        <>
                            <button
                                onClick={() => handleCreateStudy()}
                                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer border border-slate-700"
                                title="Crear un estudio en blanco"
                            >
                                <Plus className="w-3.5 h-3.5" /> Nuevo
                            </button>
                            {stations.length > 0 && (
                                <button
                                    onClick={handleCreateFromStations}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                                    title="Pre-cargar todos los pasos basándose en las estaciones activas del proyecto"
                                >
                                    <List className="w-3.5 h-3.5" /> Crear desde Estaciones
                                </button>
                            )}
                        </>
                    )}

                    {currentStudy && (
                        <>


                            <button
                                onClick={handleExportStepsCSV}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-700"
                                title="Exportar secuencia de pasos a CSV"
                            >
                                <Download className="w-3.5 h-3.5 text-cyan-400" />
                                Exportar CSV
                            </button>

                            <button
                                onClick={handleExportSummaryCSV}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-700"
                                title="Exportar resumen del estudio a CSV"
                            >
                                <Download className="w-3.5 h-3.5 text-emerald-400" />
                                Exportar Resumen
                            </button>

                            {canEdit && (
                                <button
                                    onClick={handleDeleteStudy}
                                    className="p-1.5 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 border border-slate-750 text-slate-400 rounded-xl transition cursor-pointer"
                                    title="Eliminar estudio actual"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── ESTADO VAC├ìO DE ESTUDIOS ── */}
            {studies.length === 0 ? (
                <div className="bg-slate-900/50 p-12 text-center rounded-2xl border border-slate-800 shadow-lg">
                    <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-base font-bold text-white mb-2">No hay estudios de tiempos para este proyecto</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                        Crea tu primer estudio de tiempos en blanco o pre-cárgalo utilizando las estaciones configuradas en el proyecto.
                    </p>
                    {canEdit && (
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={() => handleCreateStudy()}
                                className="flex items-center gap-1.5 px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-cyan-900/30"
                            >
                                <Plus className="w-4 h-4" /> Crear Estudio en Blanco
                            </button>
                            {stations.length > 0 && (
                                <button
                                    onClick={handleCreateFromStations}
                                    className="flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-purple-900/30"
                                >
                                    <List className="w-4 h-4" /> Crear desde Estaciones
                                </button>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                currentStudy && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        {/* ── SECCIÓN CONFIGURACIÓN DEL ESTUDIO (arriba de las tarjetas) ── */}
                        <div className="bg-slate-900/70 rounded-xl border border-slate-800 overflow-hidden relative z-10">
                            <button
                                onClick={() => setShowConfig(!showConfig)}
                                className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-850/30 transition text-left cursor-pointer focus:outline-none"
                            >
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                                    Configuración General del Estudio
                                </span>
                                <span className="text-xs text-cyan-400 font-bold">
                                    {showConfig ? 'Ocultar' : 'Mostrar'}
                                </span>
                            </button>

                            {showConfig && studyConfig && (
                                <div className="p-4 border-t border-slate-800/60 space-y-3 bg-slate-950/20">
                                    {/* Toggle Modo de Cálculo */}
                                    <div className="flex items-center gap-2 p-2 bg-slate-900/60 rounded-xl border border-slate-800/60">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mr-1">Modo:</span>
                                        <button
                                            type="button"
                                            onClick={() => handleConfigChange('calcMode', 'pph')}
                                            disabled={!canEdit}
                                            className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                                                (studyConfig.calcMode || 'pph') === 'pph'
                                                    ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-900/30'
                                                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:bg-slate-850 hover:border-slate-700'
                                            } disabled:opacity-50`}
                                        >
                                            📊 Desde PPH
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleConfigChange('calcMode', 'demand')}
                                            disabled={!canEdit}
                                            className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                                                studyConfig.calcMode === 'demand'
                                                    ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/30'
                                                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:bg-slate-850 hover:border-slate-700'
                                            } disabled:opacity-50`}
                                        >
                                            📈 Desde Demanda
                                        </button>
                                        <span className="text-[8px] text-slate-600 ml-1 hidden md:inline">
                                            {(studyConfig.calcMode || 'pph') === 'pph' ? 'PPH → Piezas/Año' : 'Demanda → PPH requerido'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                                    {/* Nombre */}
                                    <div 
                                        onClick={(e) => handleRelationClick('input-name', e)}
                                        className={`relative p-1 border border-transparent rounded-lg cursor-pointer transition-all duration-200 ${getHighlightStyles('input-name').wrapperClass}`}
                                    >
                                        {getHighlightLabel('input-name') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'input-name' ? 'bg-cyan-500 text-slate-950' : 'bg-indigo-500 text-white'
                                            }`}>
                                                {getHighlightLabel('input-name')}
                                            </span>
                                        )}
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Nombre</label>
                                        <input
                                            value={studyConfig.name || ''}
                                            onChange={e => handleConfigChange('name', e.target.value)}
                                            disabled={!canEdit}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
                                        />
                                    </div>

                                    {/* Piezas por Hora */}
                                    <div 
                                        onClick={(e) => handleRelationClick('input-piecesPerHour', e)}
                                        className={`relative p-1 border border-transparent rounded-lg cursor-pointer transition-all duration-200 ${getHighlightStyles('input-piecesPerHour').wrapperClass}`}
                                    >
                                        {getHighlightLabel('input-piecesPerHour') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'input-piecesPerHour' ? 'bg-cyan-500 text-slate-950' : 'bg-indigo-500 text-white'
                                            }`}>
                                                {getHighlightLabel('input-piecesPerHour')}
                                            </span>
                                        )}
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                                            Piezas por Hora {calcMode === 'demand' && <span className="text-violet-400 text-[7px] normal-case">(calculado)</span>}
                                        </label>
                                        {calcMode === 'demand' ? (
                                            <div className="w-full bg-violet-950/30 border border-violet-600/40 rounded-lg px-2.5 py-1 text-xs text-violet-300 font-bold font-mono">
                                                {piezasHoraTarget > 0 ? Math.round(piezasHoraTarget).toLocaleString() : '—'}
                                            </div>
                                        ) : (
                                            <input
                                                type="number" min="1" step="1"
                                                value={studyConfig.targetPiecesPerShift && studyConfig.shiftHours ? Math.round(studyConfig.targetPiecesPerShift / studyConfig.shiftHours) : ''}
                                                onChange={e => {
                                                    const piecesPerHour = Number(e.target.value) || 0;
                                                    const hours = Number(studyConfig.shiftHours) || 8;
                                                    const up = Number(studyConfig.cycleOutputQty) || 1;
                                                    const targetPiecesPerShift = piecesPerHour * hours;
                                                    const targetPPM = piecesPerHour / 60 / up;
                                                    handleConfigChanges({ 
                                                        targetPiecesPerShift, 
                                                        targetPPM: Math.round(targetPPM * 100) / 100 
                                                    });
                                                }}
                                                disabled={!canEdit}
                                                placeholder="ej. 1200"
                                                className="w-full bg-slate-900 border border-cyan-700/40 rounded-lg px-2.5 py-1 text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
                                            />
                                        )}
                                    </div>

                                    {/* Horas por Día */}
                                    <div 
                                        onClick={(e) => handleRelationClick('input-shiftHours', e)}
                                        className={`relative p-1 border border-transparent rounded-lg cursor-pointer transition-all duration-200 ${getHighlightStyles('input-shiftHours').wrapperClass}`}
                                    >
                                        {getHighlightLabel('input-shiftHours') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'input-shiftHours' ? 'bg-cyan-500 text-slate-950' : 'bg-indigo-500 text-white'
                                            }`}>
                                                {getHighlightLabel('input-shiftHours')}
                                            </span>
                                        )}
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Horas / Día</label>
                                        <input
                                            type="number" min="0.1" max="24" step="0.1"
                                            value={studyConfig.shiftHours || 8}
                                            onChange={e => {
                                                const hours = Number(e.target.value) || 8;
                                                const currentHours = Number(studyConfig.shiftHours) || 8;
                                                const currentPieces = Number(studyConfig.targetPiecesPerShift) || 0;
                                                const piecesPerHour = currentHours ? (currentPieces / currentHours) : 0;
                                                const targetPiecesPerShift = Math.round(piecesPerHour * hours);
                                                handleConfigChanges({ 
                                                    shiftHours: hours, 
                                                    targetPiecesPerShift 
                                                });
                                            }}
                                            disabled={!canEdit}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
                                        />
                                    </div>

                                    {/* OEE (%) */}
                                    <div 
                                        onClick={(e) => handleRelationClick('input-oeePenalty', e)}
                                        className={`relative p-1 border border-transparent rounded-lg cursor-pointer transition-all duration-200 ${getHighlightStyles('input-oeePenalty').wrapperClass}`}
                                    >
                                        {getHighlightLabel('input-oeePenalty') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'input-oeePenalty' ? 'bg-cyan-500 text-slate-950' : 'bg-indigo-500 text-white'
                                            }`}>
                                                {getHighlightLabel('input-oeePenalty')}
                                            </span>
                                        )}
                                        <div className="flex items-center justify-between mb-0.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase block">OEE (%)</label>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleConfigChange('linkOeeToStudy', !studyConfig?.linkOeeToStudy);
                                                }}
                                                disabled={!canEdit}
                                                className={`px-1.5 py-0.5 rounded text-[7px] font-bold border transition-all ${
                                                    linkOeeToStudy
                                                        ? 'bg-cyan-950/80 border-cyan-800 text-cyan-400 hover:bg-cyan-900/50'
                                                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:bg-slate-850'
                                                }`}
                                            >
                                                {linkOeeToStudy ? 'Vincular a Estudio' : 'Fijar OEE'}
                                            </button>
                                        </div>
                                        <input
                                            type="number" min="0" max="100" step="1"
                                            value={Math.round(100 - oeePenalty)}
                                            onChange={e => handleConfigChange('oeePenalty', 100 - Number(e.target.value))}
                                            disabled={!canEdit || linkOeeToStudy}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
                                            title={linkOeeToStudy ? "Calculado automáticamente en base al ciclo de máquina real" : "OEE (%)"}
                                        />
                                    </div>

                                    {/* Días / Semana */}
                                    <div 
                                        onClick={(e) => handleRelationClick('input-workDaysPerWeek', e)}
                                        className={`relative p-1 border border-transparent rounded-lg cursor-pointer transition-all duration-200 ${getHighlightStyles('input-workDaysPerWeek').wrapperClass}`}
                                    >
                                        {getHighlightLabel('input-workDaysPerWeek') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'input-workDaysPerWeek' ? 'bg-cyan-500 text-slate-950' : 'bg-indigo-500 text-white'
                                            }`}>
                                                {getHighlightLabel('input-workDaysPerWeek')}
                                            </span>
                                        )}
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Días Laborales / Sem</label>
                                        <input
                                            type="number" min="1" max="7" step="1"
                                            value={studyConfig.workDaysPerWeek !== undefined ? studyConfig.workDaysPerWeek : 5}
                                            onChange={e => handleConfigChange('workDaysPerWeek', Number(e.target.value))}
                                            disabled={!canEdit}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
                                        />
                                    </div>

                                    {/* País (Feriados) */}
                                    <div 
                                        onClick={(e) => handleRelationClick('input-country', e)}
                                        className={`relative p-1 border border-transparent rounded-lg cursor-pointer transition-all duration-200 ${getHighlightStyles('input-country').wrapperClass}`}
                                    >
                                        {getHighlightLabel('input-country') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'input-country' ? 'bg-cyan-500 text-slate-950' : 'bg-indigo-500 text-white'
                                            }`}>
                                                {getHighlightLabel('input-country')}
                                            </span>
                                        )}
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">País (Feriados)</label>
                                        <select
                                            value={studyConfig.country || 'MX'}
                                            onChange={e => handleConfigChange('country', e.target.value)}
                                            disabled={!canEdit}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
                                        >
                                            <option value="MX">México (7 días feriados)</option>
                                            <option value="CR">Costa Rica (11 días feriados)</option>
                                            <option value="US">USA (11 días feriados)</option>
                                            <option value="NONE">Ninguno (0 días feriados)</option>
                                        </select>
                                    </div>

                                    {/* Demanda Anual */}
                                    <div 
                                        onClick={(e) => handleRelationClick('input-annualDemand', e)}
                                        className={`relative p-1 border border-transparent rounded-lg cursor-pointer transition-all duration-200 ${getHighlightStyles('input-annualDemand').wrapperClass}`}
                                    >
                                        {getHighlightLabel('input-annualDemand') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'input-annualDemand' ? 'bg-cyan-500 text-slate-950' : 'bg-indigo-500 text-white'
                                            }`}>
                                                {getHighlightLabel('input-annualDemand')}
                                            </span>
                                        )}
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                                            Demanda Anual {calcMode === 'demand' && <span className="text-violet-400 text-[7px] normal-case">(input primario)</span>}
                                        </label>
                                        <input
                                            type="number" min="1" step="1"
                                            value={studyConfig.annualDemand !== undefined ? studyConfig.annualDemand : 18388734}
                                            onChange={e => handleConfigChange('annualDemand', Number(e.target.value))}
                                            disabled={!canEdit}
                                            className={`w-full bg-slate-900 rounded-lg px-2.5 py-1 text-xs focus:outline-none disabled:opacity-50 ${
                                                calcMode === 'demand'
                                                    ? 'border border-violet-600/40 text-violet-300 font-bold focus:border-violet-500/50'
                                                    : 'border border-slate-800 text-slate-200 focus:border-cyan-500/50'
                                            }`}
                                        />
                                    </div>

                                    {/* Tipo de Máquina */}
                                    <div 
                                        onClick={(e) => handleRelationClick('input-machineType', e)}
                                        className={`relative p-1 border border-transparent rounded-lg cursor-pointer transition-all duration-200 ${getHighlightStyles('input-machineType').wrapperClass}`}
                                    >
                                        {getHighlightLabel('input-machineType') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'input-machineType' ? 'bg-cyan-500 text-slate-950' : 'bg-indigo-500 text-white'
                                            }`}>
                                                {getHighlightLabel('input-machineType')}
                                            </span>
                                        )}
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Tipo de Máquina</label>
                                        <select
                                            value={studyConfig.mainIndexEnabled ? 'indexer' : 'robot'}
                                            onChange={e => {
                                                const isIndexer = e.target.value === 'indexer';
                                                const updates = { mainIndexEnabled: isIndexer };
                                                if (!isIndexer) updates.mainIndexTimeMs = 0;
                                                handleConfigChanges(updates);
                                            }}
                                            disabled={!canEdit}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
                                        >
                                            <option value="indexer">🔄 Indexer (Mesa / Dial)</option>
                                            <option value="robot">🤖 Robot Transfer</option>
                                        </select>
                                    </div>

                                    {/* Index Time - solo si Indexer */}
                                    {studyConfig.mainIndexEnabled && (
                                        <div 
                                            onClick={(e) => handleRelationClick('input-indexTime', e)}
                                            className={`relative p-1 border border-transparent rounded-lg cursor-pointer transition-all duration-200 ${getHighlightStyles('input-indexTime').wrapperClass}`}
                                        >
                                            {getHighlightLabel('input-indexTime') && (
                                                <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                    hoveredRelation === 'input-indexTime' ? 'bg-cyan-500 text-slate-950' : 'bg-indigo-500 text-white'
                                                }`}>
                                                    {getHighlightLabel('input-indexTime')}
                                                </span>
                                            )}
                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Tiempo de Index (ms)</label>
                                            <input
                                                type="number" min="0"
                                                value={studyConfig.mainIndexTimeMs || 0}
                                                onChange={e => handleConfigChange('mainIndexTimeMs', e.target.value)}
                                                disabled={!canEdit}
                                                className="w-full bg-slate-900 border border-amber-700/40 rounded-lg px-2.5 py-1 text-xs text-amber-300 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
                                            />
                                        </div>
                                    )}

                                    {/* Dwell calculado - solo si Indexer */}
                                    {studyConfig.mainIndexEnabled && (
                                        <div 
                                            onClick={(e) => handleRelationClick('input-dwellTime', e)}
                                            className={`relative p-1 border border-transparent rounded-lg cursor-pointer transition-all duration-200 ${getHighlightStyles('input-dwellTime').wrapperClass}`}
                                        >
                                            {getHighlightLabel('input-dwellTime') && (
                                                <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                    hoveredRelation === 'input-dwellTime' ? 'bg-cyan-500 text-slate-950' : 'bg-indigo-500 text-white'
                                                }`}>
                                                    {getHighlightLabel('input-dwellTime')}
                                                </span>
                                            )}
                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Tiempo de Dwell (ms)</label>
                                            <div className="w-full bg-emerald-950/30 border border-emerald-600/40 rounded-lg px-2.5 py-1 text-xs text-emerald-400 font-mono font-bold flex items-center justify-between">
                                                <span>{currentStudy?.dwellTimeMs || 0} ms</span>
                                                <span className="text-[8px] text-emerald-600/60 font-normal">auto</span>
                                            </div>
                                            <span className="text-[8px] text-slate-600 mt-0.5 block">= Estación bottleneck (más lenta)</span>
                                        </div>
                                    )}


                                    {/* Configuración UP */}
                                    <div 
                                        onClick={(e) => handleRelationClick('input-up', e)}
                                        className={`relative p-1 border border-transparent rounded-lg cursor-pointer transition-all duration-200 md:col-span-2 ${getHighlightStyles('input-up').wrapperClass}`}
                                    >
                                        {getHighlightLabel('input-up') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'input-up' ? 'bg-cyan-500 text-slate-950' : 'bg-indigo-500 text-white'
                                            }`}>
                                                {getHighlightLabel('input-up')}
                                            </span>
                                        )}
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Configuración UP</label>
                                        <div className="flex gap-1">
                                            {[1, 2, 4, 6].map(up => (
                                                <button
                                                    key={up}
                                                    type="button"
                                                    onClick={() => {
                                                        const hours = Number(studyConfig.shiftHours) || 8;
                                                        const piecesPerHour = (Number(studyConfig.targetPiecesPerShift) || 0) / hours;
                                                        const updates = { cycleOutputQty: up };
                                                        if (piecesPerHour > 0) {
                                                            const ppm = piecesPerHour / 60 / up;
                                                            updates.targetPPM = Math.round(ppm * 100) / 100;
                                                        }
                                                        handleConfigChanges(updates);
                                                    }}
                                                    disabled={!canEdit}
                                                    className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                                                        Number(studyConfig.cycleOutputQty || 1) === up
                                                            ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-900/30'
                                                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:border-slate-700'
                                                    } disabled:opacity-50`}
                                                >
                                                    {up}-UP
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Notas */}
                                    <div 
                                        onClick={(e) => handleRelationClick('input-notes', e)}
                                        className={`relative p-1 border border-transparent rounded-lg cursor-pointer transition-all duration-200 md:col-span-4 ${getHighlightStyles('input-notes').wrapperClass}`}
                                    >
                                        {getHighlightLabel('input-notes') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'input-notes' ? 'bg-cyan-500 text-slate-950' : 'bg-indigo-500 text-white'
                                            }`}>
                                                {getHighlightLabel('input-notes')}
                                            </span>
                                        )}
                                        <div className="flex items-center justify-between mb-0.5">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowNotes(!showNotes);
                                                }}
                                                className="text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase flex items-center gap-1 focus:outline-none"
                                            >
                                                {showNotes ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                                                <span>Notas del Estudio</span>
                                            </button>
                                            {studyConfig.notes && !showNotes && (
                                                <span className="bg-cyan-950/80 border border-cyan-800 text-cyan-400 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-fade-in">
                                                    Contiene Notas
                                                </span>
                                            )}
                                        </div>
                                        {showNotes && (
                                            <textarea
                                                value={studyConfig.notes || ''}
                                                onChange={e => handleConfigChange('notes', e.target.value)}
                                                disabled={!canEdit}
                                                rows="2"
                                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50 resize-none mt-1 animate-fade-in"
                                            />
                                        )}
                                    </div>

                                    </div>
                                    {/* end grid */}

                                    {/* Auto-save indicator */}
                                    {canEdit && (
                                        <div className="md:col-span-4 flex justify-end pt-2">
                                            <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                                                {configAutoSaveStatus === 'saving' && (
                                                    <>
                                                        <div className="w-3 h-3 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
                                                        <span className="text-cyan-500">Guardando...</span>
                                                    </>
                                                )}
                                                {configAutoSaveStatus === 'saved' && (
                                                    <>
                                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                                        <span className="text-emerald-500">Guardado</span>
                                                    </>
                                                )}
                                                {configAutoSaveStatus === 'error' && (
                                                    <>
                                                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                                        <span className="text-rose-500">Error al guardar: {configAutoSaveError}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── KPI PANELS: GRUPOS LÓGICOS DE MÉTRICAS ── */}
                        <div className="grid grid-cols-1 xl:grid-cols-7 gap-4 relative z-[35]">
                            {/* 1. METAS DE DEMANDA (COMERCIAL) */}
                            <div className={`xl:col-span-2 bg-slate-900/40 border border-slate-800 border-t-cyan-500/80 border-t-[3px] rounded-2xl p-4 flex flex-col gap-3 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-slate-700/80 relative ${['card-objDia', 'card-objHora', 'card-ppmObj'].includes(activeTooltipId) ? 'z-[45]' : 'z-10'}`}>
                                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                                    <div className="p-1 bg-cyan-500/10 rounded-lg">
                                        <Target className="w-4 h-4 text-cyan-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">Metas de Demanda</h4>
                                        <p className="text-[9px] text-slate-500 font-semibold font-mono">Requerimientos Comerciales</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5 flex-1">
                                    {/* Piezas Objetivo / Día */}
                                    <div 
                                        onClick={(e) => handleRelationClick('card-objDia', e)}
                                        className={`relative group bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 hover:border-cyan-500/30 text-center cursor-pointer transition-all duration-200 overflow-visible ${activeTooltipId === 'card-objDia' ? 'z-[60]' : 'hover:z-50'} ${getHighlightStyles('card-objDia').wrapperClass}`}
                                    >
                                        {getHighlightLabel('card-objDia') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'card-objDia' ? 'bg-cyan-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                                            }`}>
                                                {getHighlightLabel('card-objDia')}
                                            </span>
                                        )}
                                                      {/* Tooltip */}
                                        <div className={`absolute top-full left-0 mt-2 w-64 p-3 bg-slate-950/95 text-slate-200 text-xs rounded-xl border border-slate-800/80 shadow-2xl backdrop-blur-md transition-all duration-200 z-50 text-left font-sans ${activeTooltipId === 'card-objDia' ? 'opacity-100 pointer-events-auto translate-y-0 scale-100' : 'opacity-0 pointer-events-none -translate-y-1 scale-95'}`}>
                                            <div className="font-bold text-white mb-1.5 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                <Info className="w-3.5 h-3.5 text-blue-400" />
                                                <span>Objetivo / Día</span>
                                            </div>
                                            <div className="text-[11px] leading-relaxed space-y-1.5">
                                                <p className="text-slate-400 text-[10px]">Meta de producción neta (piezas buenas) requerida por día de trabajo.</p>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fórmula:</p>
                                                    <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                        {calcMode === 'demand' ? (
                                                            <>
                                                                <span className="text-white">Obj/Día (Neto)</span> = <span className="text-violet-400">Demanda</span> ÷ <span className="text-indigo-400">Días/Año</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="text-white">Obj/Día (Neto)</span> = <span className="text-blue-400">Meta de Turno</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Cálculo con valores:</p>
                                                    <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                        {calcMode === 'demand' ? (
                                                            <>
                                                                <span className="text-violet-400">{Math.round(annualDemand).toLocaleString()}</span> ÷ <span className="text-indigo-400">{diasAnuales}</span> = <span className="text-blue-400">{Math.round(piezasDia || 0).toLocaleString()} pzas/día</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="text-blue-400">{Math.round(piezasDia || 0).toLocaleString()} pzas/día</span> <span className="text-slate-500">(definido por usuario)</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="absolute bottom-full left-6 border-4 border-transparent border-b-slate-950/95" />
                                        </div>
                                    </div>

                                    {/* Piezas/Hora Objetivo */}
                                    <div 
                                        onClick={(e) => handleRelationClick('card-objHora', e)}
                                        className={`relative group bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 hover:border-cyan-500/30 text-center cursor-pointer transition-all duration-200 overflow-visible ${activeTooltipId === 'card-objHora' ? 'z-[60]' : 'hover:z-50'} ${getHighlightStyles('card-objHora').wrapperClass}`}
                                    >
                                        {getHighlightLabel('card-objHora') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'card-objHora' ? 'bg-cyan-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                                            }`}>
                                                {getHighlightLabel('card-objHora')}
                                            </span>
                                        )}
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-sans">Objetivo / Hora</span>
                                        <span className="text-lg font-black text-blue-400 block mt-1">
                                            {piezasHoraTarget ? Math.round(piezasHoraTarget).toLocaleString() : '—'}
                                        </span>
                                        <span className="text-[8px] text-slate-600 block">pzas/hr</span>

                                        {/* Tooltip */}
                                        <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-slate-950/95 text-slate-200 text-xs rounded-xl border border-slate-800/80 shadow-2xl backdrop-blur-md transition-all duration-200 z-50 text-left font-sans ${activeTooltipId === 'card-objHora' ? 'opacity-100 pointer-events-auto translate-y-0 scale-100' : 'opacity-0 pointer-events-none -translate-y-1 scale-95'}`}>
                                            <div className="font-bold text-white mb-1.5 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                <Info className="w-3.5 h-3.5 text-blue-400" />
                                                <span>Objetivo / Hora</span>
                                            </div>
                                            <div className="text-[11px] leading-relaxed space-y-1.5">
                                                <p className="text-slate-400 text-[10px]">Meta de producción de piezas por hora de trabajo (Bruta, considerando pérdidas por OEE).</p>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fórmula:</p>
                                                    <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                        <span className="text-white">Obj/Hora (Bruto)</span> = <span className="text-blue-400">Obj/Día (Neto)</span> ÷ <span className="text-emerald-400">OEE</span> ÷ <span className="text-slate-400">Hrs/Día</span>
                                                    </p>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Cálculo con valores:</p>
                                                    <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                        <span className="text-blue-400">{Math.round(piezasDia || 0).toLocaleString()}</span> ÷ <span className="text-emerald-400">{oeePercent}%</span> ÷ <span className="text-slate-400">{shiftHours}</span> = <span className="text-blue-400">{Math.round(piezasHoraTarget).toLocaleString()} pzas/hr</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-950/95" />
                                        </div>
                                    </div>

                                    {/* Ciclos / Min Objetivo */}
                                    <div 
                                        onClick={(e) => handleRelationClick('card-ppmObj', e)}
                                        className={`relative group bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 hover:border-cyan-500/30 text-center cursor-pointer transition-all duration-200 overflow-visible ${activeTooltipId === 'card-ppmObj' ? 'z-[60]' : 'hover:z-50'} ${getHighlightStyles('card-ppmObj').wrapperClass}`}
                                    >
                                        {getHighlightLabel('card-ppmObj') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'card-ppmObj' ? 'bg-cyan-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                                            }`}>
                                                {getHighlightLabel('card-ppmObj')}
                                            </span>
                                        )}
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-sans">Ciclos / Min</span>
                                        <span className="text-[10px] text-slate-500 block font-mono mt-0.5">Objetivo</span>
                                        <span className="text-lg font-black text-blue-400 block mt-0.5">
                                            {ppmTarget ? ppmTarget.toFixed(2) : '—'}
                                        </span>
                                        <span className="text-[8px] text-slate-600 block">PPM Obj</span>

                                        {/* Tooltip */}
                                        <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-slate-950/95 text-slate-200 text-xs rounded-xl border border-slate-800/80 shadow-2xl backdrop-blur-md transition-all duration-200 z-50 text-left font-sans ${activeTooltipId === 'card-ppmObj' ? 'opacity-100 pointer-events-auto translate-y-0 scale-100' : 'opacity-0 pointer-events-none -translate-y-1 scale-95'}`}>
                                            <div className="font-bold text-white mb-1.5 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                <Info className="w-3.5 h-3.5 text-blue-400" />
                                                <span>Ciclos / Min Objetivo (PPM)</span>
                                            </div>
                                            <div className="text-[11px] leading-relaxed space-y-1.5">
                                                <p className="text-slate-400 text-[10px]">Meta de velocidad bruta en ciclos por minuto (PPM) a la que debe operar la máquina.</p>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fórmula:</p>
                                                    <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                        <span className="text-blue-400">PPM_obj</span> = <span className="text-blue-400">Obj/Hora (Bruto)</span> ÷ 60 ÷ <span className="text-fuchsia-400">UP</span>
                                                    </p>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Cálculo con valores:</p>
                                                    <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                        <span className="text-blue-400">PPM_obj</span> = <span className="text-blue-400">{Math.round(piezasHoraTarget).toLocaleString()}</span> ÷ 60 ÷ <span className="text-fuchsia-400">{cycleOutputQty}</span> = <span className="text-blue-400">{ppmTarget ? ppmTarget.toFixed(2) : 0} PPM</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-950/95" />
                                        </div>
                                    </div>

                                    {/* Ciclo Target */}
                                    <div 
                                        onClick={(e) => handleRelationClick('card-cicloTarget', e)}
                                        className={`relative group bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 hover:border-cyan-500/30 text-center cursor-pointer transition-all duration-200 overflow-visible ${activeTooltipId === 'card-cicloTarget' ? 'z-[60]' : 'hover:z-50'} ${getHighlightStyles('card-cicloTarget').wrapperClass}`}
                                    >
                                        {getHighlightLabel('card-cicloTarget') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'card-cicloTarget' ? 'bg-cyan-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                                            }`}>
                                                {getHighlightLabel('card-cicloTarget')}
                                            </span>
                                        )}
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-sans">Ciclo Target</span>
                                        <span className="text-lg font-black text-slate-200 block mt-1">
                                            {cicloTargetSeg ? formatTime(cicloTargetSeg * 1000) : '—'}
                                        </span>
                                        <span className="text-[8px] text-slate-600 block">segundos</span>
                                        <span className={`text-[8px] block mt-0.5 font-bold ${cicloRealSeg <= cicloTargetSeg ? 'text-emerald-400' : 'text-amber-400'}`}>
                                            vs Real: {cicloRealSeg.toFixed(2)}s {cicloRealSeg <= cicloTargetSeg ? '✅' : '⚠️'}
                                        </span>

                                        {/* Tooltip */}
                                        <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-slate-950/95 text-slate-200 text-xs rounded-xl border border-slate-800/80 shadow-2xl backdrop-blur-md transition-all duration-200 z-50 text-left font-sans ${activeTooltipId === 'card-cicloTarget' ? 'opacity-100 pointer-events-auto translate-y-0 scale-100' : 'opacity-0 pointer-events-none -translate-y-1 scale-95'}`}>
                                            <div className="font-bold text-white mb-1.5 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                <Info className="w-3.5 h-3.5 text-blue-400" />
                                                <span>Ciclo Target</span>
                                            </div>
                                            <div className="text-[11px] leading-relaxed space-y-1.5">
                                                <p className="text-slate-400 text-[10px]">Tiempo máximo permitido por ciclo de máquina (en segundos) para cumplir la meta bruta.</p>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fórmula:</p>
                                                    <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                        <span className="text-slate-300">Ciclo Target (s)</span> = 60 / <span className="text-blue-400">PPM_obj</span>
                                                    </p>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Cálculo con valores:</p>
                                                    <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                        <span className="text-slate-300">Ciclo Target</span> = 60 / <span className="text-blue-400">{ppmTarget ? ppmTarget.toFixed(2) : 0}</span> = <span className="text-slate-300">{cicloTargetSeg.toFixed(2)} s</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-950/95" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. CAPACIDAD FÍSICA REAL (AUTOMATIZACI├ôN) */}
                            <div className={`xl:col-span-2 bg-slate-900/40 border border-slate-800 border-t-amber-500/80 border-t-[3px] rounded-2xl p-4 flex flex-col gap-3 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-slate-700/80 relative ${['card-cicloTarget', 'card-cicloReal', 'card-ppmReal', 'card-bottleneck', 'card-realHora'].includes(activeTooltipId) ? 'z-[45]' : 'z-10'}`}>
                                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                                    <div className="p-1 bg-amber-500/10 rounded-lg">
                                        <Activity className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">Capacidad Física</h4>
                                        <p className="text-[9px] text-slate-500 font-semibold font-mono">Desempeño de Máquina</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5 flex-1">
                                    {/* Ciclo Real */}
                                    <div 
                                        onClick={(e) => handleRelationClick('card-cicloReal', e)}
                                        className={`relative group bg-slate-950/40 p-3 rounded-xl border border-cyan-700/20 hover:border-cyan-500/30 text-center cursor-pointer transition-all duration-200 overflow-visible ${activeTooltipId === 'card-cicloReal' ? 'z-[60]' : 'hover:z-50'} ${getHighlightStyles('card-cicloReal').wrapperClass}`}
                                    >
                                        {getHighlightLabel('card-cicloReal') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'card-cicloReal' ? 'bg-cyan-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                                            }`}>
                                                {getHighlightLabel('card-cicloReal')}
                                            </span>
                                        )}
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-sans">Ciclo Real</span>
                                        <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                                            Obj: {cicloTargetSeg ? `${cicloTargetSeg.toFixed(2)}s` : '—'}
                                        </span>
                                        <span className="text-lg font-black text-cyan-400 block mt-0.5">
                                            {formatTime(localMetrics?.machineCycleTimeMs)}
                                        </span>
                                        <span className="text-[8px] text-slate-600 block">segundos (Real)</span>

                                        {/* Tooltip */}
                                        <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-slate-950/95 text-slate-200 text-xs rounded-xl border border-slate-800/80 shadow-2xl backdrop-blur-md transition-all duration-200 z-50 text-left font-sans ${activeTooltipId === 'card-cicloReal' ? 'opacity-100 pointer-events-auto translate-y-0 scale-100' : 'opacity-0 pointer-events-none -translate-y-1 scale-95'}`}>
                                            <div className="font-bold text-white mb-1.5 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                <Info className="w-3.5 h-3.5 text-cyan-400" />
                                                <span>Ciclo Real</span>
                                            </div>
                                            <div className="text-[11px] leading-relaxed space-y-1.5">
                                                <p className="text-slate-400 text-[10px]">Duración calculada del ciclo completo actual de la máquina.</p>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fórmula:</p>
                                                    <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                        {studyConfig?.mainIndexEnabled ? (
                                                            <>
                                                                <span className="text-cyan-400">Ciclo Real</span> = <span className="text-emerald-400">Dwell</span> + <span className="text-amber-400">Index</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="text-cyan-400">Ciclo Real</span> = <span className="text-emerald-400">Dwell</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Cálculo con valores:</p>
                                                    <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                        {studyConfig?.mainIndexEnabled ? (
                                                            <>
                                                                <span className="text-cyan-400">Ciclo Real</span> = <span className="text-emerald-400">{localMetrics?.dwellTimeMs || 0}ms</span> + <span className="text-amber-400">{studyConfig?.mainIndexTimeMs || 0}ms</span> = <span className="text-cyan-400">{localMetrics?.machineCycleTimeMs || 0}ms ({((localMetrics?.machineCycleTimeMs || 0) / 1000).toFixed(2)}s)</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="text-cyan-400">Ciclo Real</span> = <span className="text-emerald-400">{localMetrics?.dwellTimeMs || 0}ms</span> = <span className="text-cyan-400">{localMetrics?.machineCycleTimeMs || 0}ms ({((localMetrics?.machineCycleTimeMs || 0) / 1000).toFixed(2)}s)</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-950/95" />
                                        </div>
                                    </div>

                                    {/* Ciclos / Min Real */}
                                    <div 
                                        onClick={(e) => handleRelationClick('card-ppmReal', e)}
                                        className={`relative group bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 hover:border-cyan-500/30 text-center cursor-pointer transition-all duration-200 overflow-visible ${activeTooltipId === 'card-ppmReal' ? 'z-[60]' : 'hover:z-50'} ${getHighlightStyles('card-ppmReal').wrapperClass}`}
                                    >
                                        {getHighlightLabel('card-ppmReal') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'card-ppmReal' ? 'bg-cyan-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                                            }`}>
                                                {getHighlightLabel('card-ppmReal')}
                                            </span>
                                        )}
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-sans">Ciclos / Min</span>
                                        <span className="text-[10px] text-slate-500 block font-mono mt-0.5">Real</span>
                                        <span className="text-lg font-black text-cyan-400 block mt-0.5">
                                            {ppmReal > 0 ? `${ppmReal.toFixed(1)}` : '—'}
                                        </span>
                                        <span className="text-[8px] text-slate-600 block">PPM Real</span>
                                        <span className="text-[8px] text-slate-500 block mt-0.5 font-mono">CPM: {cpmReal.toFixed(2)} · UP: {cycleOutputQty}</span>

                                        {/* Tooltip */}
                                        <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-slate-950/95 text-slate-200 text-xs rounded-xl border border-slate-800/80 shadow-2xl backdrop-blur-md transition-all duration-200 z-50 text-left font-sans ${activeTooltipId === 'card-ppmReal' ? 'opacity-100 pointer-events-auto translate-y-0 scale-100' : 'opacity-0 pointer-events-none -translate-y-1 scale-95'}`}>
                                            <div className="font-bold text-white mb-1.5 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                <Info className="w-3.5 h-3.5 text-cyan-400" />
                                                <span>Ciclos / Min Real (PPM)</span>
                                            </div>
                                            <div className="text-[11px] leading-relaxed space-y-1.5">
                                                <p className="text-slate-400 text-[10px]">Cantidad de ciclos ejecutados por minuto a velocidad real.</p>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fórmula:</p>
                                                    <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal text-slate-300">
                                                        <span className="text-cyan-400">PPM_real</span> = 60 / <span className="text-cyan-400">Ciclo Real (s)</span><br/>
                                                        <span className="text-cyan-400">CPM_real</span> = <span className="text-cyan-400">PPM_real</span> × <span className="text-fuchsia-400">UP</span>
                                                    </p>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Cálculo con valores:</p>
                                                    <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal text-slate-300">
                                                        <span className="text-cyan-400">PPM_real</span> = 60 / <span className="text-cyan-400">{cicloRealSeg.toFixed(2)}s</span> = <span className="text-cyan-400">{ppmReal.toFixed(1)} PPM</span><br/>
                                                        <span className="text-cyan-400">CPM_real</span> = <span className="text-cyan-400">{ppmReal.toFixed(1)}</span> × <span className="text-fuchsia-400">{studyConfig?.cycleOutputQty || 1}</span> = <span className="text-cyan-400">{cpmReal.toFixed(2)} CPM</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-950/95" />
                                        </div>
                                    </div>

                                    {/* Bottleneck Station */}
                                    <div 
                                        onClick={(e) => handleRelationClick('card-bottleneck', e)}
                                        className={`relative group bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 hover:border-cyan-500/30 text-center cursor-pointer transition-all duration-200 overflow-visible ${activeTooltipId === 'card-bottleneck' ? 'z-[60]' : 'hover:z-50'} ${getHighlightStyles('card-bottleneck').wrapperClass}`}
                                    >
                                        {getHighlightLabel('card-bottleneck') && (
                                            <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                hoveredRelation === 'card-bottleneck' ? 'bg-cyan-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                                            }`}>
                                                {getHighlightLabel('card-bottleneck')}
                                            </span>
                                        )}
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-sans">Bottleneck</span>
                                        <span className="text-[10px] text-slate-500 block font-mono mt-0.5">estación</span>
                                        <span className="text-sm font-black text-amber-500 block truncate mt-1 font-sans" title={localMetrics?.bottleneckStationLabel || '—'}>
                                            {localMetrics?.bottleneckStationLabel || '—'}
                                        </span>
                                        <span className="text-[8px] text-slate-600 block">estación</span>

                                        {/* Tooltip */}
                                        <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-slate-950/95 text-slate-200 text-xs rounded-xl border border-slate-800/80 shadow-2xl backdrop-blur-md transition-all duration-200 z-50 text-left font-sans ${activeTooltipId === 'card-bottleneck' ? 'opacity-100 pointer-events-auto translate-y-0 scale-100' : 'opacity-0 pointer-events-none -translate-y-1 scale-95'}`}>
                                            <div className="font-bold text-white mb-1.5 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                <Info className="w-3.5 h-3.5 text-amber-500" />
                                                <span>Bottleneck (Cuello de Botella)</span>
                                            </div>
                                            <div className="text-[11px] leading-relaxed space-y-1.5">
                                                <p className="text-slate-400 text-[10px]">Estación de trabajo más lenta de la secuencia que limita la velocidad de producción.</p>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fórmula:</p>
                                                    <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                        <span className="text-amber-500">Bottleneck</span> = max(<span className="text-emerald-400">T_estación_i</span>)
                                                    </p>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Cálculo con valores:</p>
                                                    <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                        <span className="text-amber-500">Bottleneck</span> = max(<span className="text-slate-300">{localMetrics?.bottleneckStationLabel || '—'}</span>) = <span className="text-emerald-400">{localMetrics?.dwellTimeMs || 0}ms ({((localMetrics?.dwellTimeMs || 0) / 1000).toFixed(2)}s)</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-950/95" />
                                        </div>
                                    </div>

                                    {/* Real / Hora */}
                                    {(() => {
                                        const targetPPH = calcMode === 'demand' 
                                            ? Math.round(piezasHoraTarget)
                                            : (studyConfig?.targetPPM ? Math.round(studyConfig.targetPPM * 60 * (studyConfig.cycleOutputQty || 1)) : 0);
                                        const realPPH = piezasHora || 0;
                                        const onTarget = targetPPH > 0 && realPPH >= targetPPH;
                                        return (
                                            <div 
                                                onClick={(e) => handleRelationClick('card-realHora', e)}
                                                className={`relative group bg-slate-955/40 p-3 rounded-xl border text-center cursor-pointer transition-all duration-200 overflow-visible ${onTarget ? 'border-emerald-600/40 hover:border-emerald-500/60 font-bold' : 'border-red-650/30 hover:border-red-500/50'} ${activeTooltipId === 'card-realHora' ? 'z-[60]' : 'hover:z-50'} ${getHighlightStyles('card-realHora').wrapperClass}`}
                                            >
                                                {getHighlightLabel('card-realHora') && (
                                                    <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                        hoveredRelation === 'card-realHora' ? 'bg-cyan-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                                                    }`}>
                                                        {getHighlightLabel('card-realHora')}
                                                    </span>
                                                )}
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-sans">Real / Hora</span>
                                                <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                                                    Obj: {targetPPH > 0 ? targetPPH.toLocaleString() : '—'}
                                                </span>
                                                <span className={`text-lg font-black block mt-0.5 ${onTarget ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {realPPH > 0 ? Math.round(realPPH).toLocaleString() : '—'}
                                                </span>
                                                <span className="text-[8px] text-slate-600 block">pzas/hr</span>

                                                {/* Tooltip */}
                                                <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-slate-950/95 text-slate-200 text-xs rounded-xl border border-slate-800/80 shadow-2xl backdrop-blur-md transition-all duration-200 z-50 text-left font-sans ${activeTooltipId === 'card-realHora' ? 'opacity-100 pointer-events-auto translate-y-0 scale-100' : 'opacity-0 pointer-events-none -translate-y-1 scale-95'}`}>
                                                    <div className="font-bold text-white mb-1.5 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <Info className={`w-3.5 h-3.5 ${onTarget ? 'text-emerald-400' : 'text-red-400'}`} />
                                                        <span>Real / Hora</span>
                                                    </div>
                                                    <div className="text-[11px] leading-relaxed space-y-1.5">
                                                        <p className="text-slate-400 text-[10px]">Producción horaria proyectada con el ciclo real medido.</p>
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fórmula:</p>
                                                            <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                                <span className="text-cyan-400">PPH_real</span> = (3,600,000 / <span className="text-cyan-400">Ciclo Real (ms)</span>) × <span className="text-fuchsia-400">UP</span>
                                                            </p>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Cálculo con valores:</p>
                                                            <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                                <span className="text-cyan-400">PPH_real</span> = (3,600,000 / <span className="text-cyan-400">{localMetrics?.machineCycleTimeMs || 1}ms</span>) × <span className="text-fuchsia-400">{studyConfig?.cycleOutputQty || 1}</span> = <span className={`font-bold ${onTarget ? 'text-emerald-400' : 'text-cyan-400'}`}>{Math.round(realPPH).toLocaleString()} pzas/hr</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-950/95" />
                                                </div>
                                            </div>
                                        );
                                    })()}

                                </div>
                            </div>

                            {/* 3. VIABILIDAD Y DESEMPEÑO (OEE) */}
                            <div className={`xl:col-span-3 bg-slate-900/40 border border-slate-800 border-t-emerald-500/80 border-t-[3px] rounded-2xl p-4 flex flex-col gap-3 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-slate-700/80 relative ${['card-status', 'card-piezasDia', 'card-piezasSem', 'card-piezasAno'].includes(activeTooltipId) ? 'z-[45]' : 'z-10'}`}>
                                <div 
                                    className={`flex items-center gap-2 border-b border-slate-800 pb-2 cursor-pointer overflow-visible relative group ${activeTooltipId === 'card-status' ? 'z-[60]' : 'hover:z-50'} ${getHighlightStyles('card-status').wrapperClass}`}
                                    onClick={(e) => handleRelationClick('card-status', e)}
                                >
                                    {getHighlightLabel('card-status') && (
                                        <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                            hoveredRelation === 'card-status' ? 'bg-cyan-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                                        }`}>
                                            {getHighlightLabel('card-status')}
                                        </span>
                                    )}
                                    <div className="p-1 bg-emerald-500/10 rounded-lg">
                                        <Award className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">Viabilidad y Desempeño</h4>
                                        <p className="text-[9px] text-slate-500 font-semibold font-mono">Resultados OEE & Calendario</p>
                                    </div>
                                    {getStatusBadge(localMetrics?.status)}

                                    {/* Tooltip Status */}
                                    <div className={`absolute top-full right-0 left-auto mt-2 w-64 p-3 bg-slate-950/95 text-slate-200 text-xs rounded-xl border border-slate-800/80 shadow-2xl backdrop-blur-md transition-all duration-200 z-50 text-left font-sans ${activeTooltipId === 'card-status' ? 'opacity-100 pointer-events-auto translate-y-0 scale-100' : 'opacity-0 pointer-events-none -translate-y-1 scale-95'}`}>
                                        <div className="font-bold text-white mb-1.5 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                            <Info className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Status (Estado del Estudio)</span>
                                        </div>
                                        <div className="text-[11px] leading-relaxed space-y-1.5">
                                            <p className="text-slate-400 text-[10px]">Indica si el ciclo real de la máquina cumple la meta requerida.</p>
                                            <div className="space-y-1.5">
                                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fórmula:</p>
                                                <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                    <span className="text-emerald-500">Status</span> = <span className="text-cyan-400">Ciclo Real (s)</span> ≤ <span className="text-blue-400">Ciclo Target (s)</span>
                                                </p>
                                            </div>
                                            <div className="space-y-1.5">
                                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Cálculo con valores:</p>
                                                <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[10px] leading-normal">
                                                    <span className="text-cyan-400">{((localMetrics?.machineCycleTimeMs || 0) / 1000).toFixed(2)}s</span> ≤ <span className="text-blue-400">{cicloTargetSeg.toFixed(2)}s</span> ⇒ <span className={`font-bold ${localMetrics?.status === 'OK' ? 'text-emerald-400' : 'text-rose-400'}`}>{localMetrics?.status || '—'}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="absolute bottom-full right-6 left-auto border-4 border-transparent border-b-slate-950/95" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5 flex-1">
                                    {/* Piezas / Día (Desglose OEE) - spans 2 columns */}
                                    {(() => {
                                        const piezasDiaSinOEE = piezasHora * shiftHours;
                                        const perdidaOEE = piezasDiaSinOEE - piezasDia;
                                        return (
                                            <div 
                                                onClick={(e) => handleRelationClick('card-piezasDia', e)}
                                                className={`relative group bg-slate-955/40 p-3 rounded-xl border border-slate-800/80 hover:border-emerald-500/30 transition-all duration-200 overflow-visible col-span-2 flex gap-3 text-left cursor-pointer ${activeTooltipId === 'card-piezasDia' ? 'z-[60]' : 'hover:z-50'} ${getHighlightStyles('card-piezasDia').wrapperClass}`}
                                            >
                                                {getHighlightLabel('card-piezasDia') && (
                                                    <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                        hoveredRelation === 'card-piezasDia' ? 'bg-cyan-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                                                    }`}>
                                                        {getHighlightLabel('card-piezasDia')}
                                                    </span>
                                                )}
                                                
                                                {/* Sección Izquierda */}
                                                <div className="flex-1 flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-sans">Piezas / Día</span>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleConfigChange('linkOeeToStudy', !studyConfig?.linkOeeToStudy);
                                                                }}
                                                                disabled={!canEdit}
                                                                className={`px-1 py-0.5 rounded text-[7px] font-extrabold uppercase border tracking-tight transition-all select-none ${
                                                                    linkOeeToStudy
                                                                        ? 'bg-cyan-950/80 border-cyan-800 text-cyan-400 hover:bg-cyan-900/40'
                                                                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:bg-slate-850'
                                                                }`}
                                                                title={linkOeeToStudy ? 'OEE vinculado al ciclo del estudio de tiempos' : 'OEE fijo independiente del ciclo'}
                                                            >
                                                                {linkOeeToStudy ? '🔗 Vinculado' : '🔗 Fijo'}
                                                            </button>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5" title="Capacidad te├│rica bruta al 100% de OEE">
                                                            Bruto: {piezasDiaSinOEE > 0 ? Math.round(piezasDiaSinOEE).toLocaleString() : '—'}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1">
                                                        <span className="text-lg font-black text-slate-200 block leading-tight">
                                                            {piezasDia > 0 ? Math.round(piezasDia).toLocaleString() : '—'}
                                                        </span>
                                                        <span className="text-[8px] text-slate-600 block mt-0.5">piezas (con OEE: {oeePercent}%{linkOeeToStudy ? ' real' : ''})</span>
                                                        <span className={`text-[8px] block mt-0.5 font-bold ${piezasDiaReal >= piezasDia ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                            vs Real: {Math.round(piezasDiaReal).toLocaleString()} {piezasDiaReal >= piezasDia ? '✅' : '⚠️'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Sección Derecha */}
                                                <div className="w-[60%] border-l border-slate-800/80 pl-3 flex flex-col gap-1.5">
                                                    {/* Disp */}
                                                    <div 
                                                        onClick={(e) => handleRelationClick('input-availability', e)}
                                                        className={`flex items-center justify-between gap-1 relative cursor-pointer p-0.5 rounded transition-all duration-200 ${getHighlightStyles('input-availability').wrapperClass}`}
                                                    >
                                                        <span className="text-[8px] font-bold text-slate-500 uppercase w-7" title="Disponibilidad (Paros/Setups)">Disp:</span>
                                                        <div className="flex items-center gap-1">
                                                            <input 
                                                                 type="number" min="0.1" max="100" step="0.1"
                                                                 value={studyConfig?.availability !== undefined ? studyConfig.availability : 95}
                                                                 onChange={e => handleConfigChange('availability', Number(e.target.value))}
                                                                 disabled={!canEdit}
                                                                 className="w-11 bg-slate-955 border border-slate-800 rounded px-1 py-0.5 text-[10px] text-slate-200 font-mono text-center font-bold focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
                                                            />
                                                            <span className="text-[8px] text-slate-600 font-bold">%</span>
                                                        </div>
                                                        <span className="text-[9px] text-rose-400 font-mono font-medium min-w-10 text-right" title="Pérdidas de disponibilidad">
                                                            -{Math.round(piezasPerdidasDisp || 0).toLocaleString()}
                                                        </span>
                                                    </div>

                                                    {/* Efec */}
                                                    <div 
                                                        onClick={(e) => handleRelationClick('input-efficiency', e)}
                                                        className={`flex items-center justify-between gap-1 relative cursor-pointer p-0.5 rounded transition-all duration-200 ${getHighlightStyles('input-efficiency').wrapperClass}`}
                                                    >
                                                        <span className="text-[8px] font-bold text-slate-500 uppercase w-7" title="Eficiencia (Velocidad/Microparos)">Efec:</span>
                                                        <div className="flex items-center gap-1">
                                                            <input 
                                                                 type="number" min="0.1" max="100" step="0.1"
                                                                 value={Math.round(efficiency * 10) / 10}
                                                                 onChange={e => handleConfigChange('efficiency', Number(e.target.value))}
                                                                 disabled={!canEdit || linkOeeToStudy}
                                                                 className="w-11 bg-slate-955 border border-slate-800 rounded px-1 py-0.5 text-[10px] text-slate-200 font-mono text-center font-bold focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
                                                                 title={linkOeeToStudy ? "Calculado automáticamente: PPM Real / PPM Target" : "Eficiencia (Velocidad/Microparos)"}
                                                            />
                                                            <span className="text-[8px] text-slate-600 font-bold">%</span>
                                                        </div>
                                                        <span className="text-[9px] text-amber-500 font-mono font-medium min-w-10 text-right" title="Pérdidas de velocidad/eficiencia">
                                                            -{Math.round(piezasPerdidasEficiencia || 0).toLocaleString()}
                                                        </span>
                                                    </div>

                                                    {/* Cal / Yield */}
                                                    <div 
                                                        onClick={(e) => handleRelationClick('input-yield', e)}
                                                        className={`flex items-center justify-between gap-1 relative cursor-pointer p-0.5 rounded transition-all duration-200 ${getHighlightStyles('input-yield').wrapperClass}`}
                                                    >
                                                        <span className="text-[8px] font-bold text-slate-500 uppercase w-7" title="Calidad / Yield (Scrap/Rechazos)">Cal:</span>
                                                        <div className="flex items-center gap-1">
                                                            <input 
                                                                 type="number" min="0.1" max="100" step="0.1"
                                                                 value={studyConfig?.yield !== undefined ? studyConfig.yield : 98}
                                                                 onChange={e => handleConfigChange('yield', Number(e.target.value))}
                                                                 disabled={!canEdit}
                                                                 className="w-11 bg-slate-955 border border-slate-800 rounded px-1 py-0.5 text-[10px] text-slate-200 font-mono text-center font-bold focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
                                                            />
                                                            <span className="text-[8px] text-slate-600 font-bold">%</span>
                                                        </div>
                                                        <span className="text-[9px] text-rose-500 font-mono font-medium min-w-10 text-right" title="Pérdidas por scrap de calidad">
                                                            -{Math.round(piezasPerdidasCalidad || 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Tooltip */}
                                                <div className={`absolute top-full left-0 mt-2 w-72 p-3 bg-slate-950/95 text-slate-200 text-xs rounded-xl border border-slate-800/80 shadow-2xl backdrop-blur-md transition-all duration-200 z-50 text-left font-sans ${activeTooltipId === 'card-piezasDia' ? 'opacity-100 pointer-events-auto translate-y-0 scale-100' : 'opacity-0 pointer-events-none -translate-y-1 scale-95'}`}>
                                                    <div className="font-bold text-white mb-1.5 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <Info className="w-3.5 h-3.5 text-cyan-400" />
                                                        <span>Piezas / Día — Desglose de Pérdidas OEE</span>
                                                    </div>
                                                    <div className="text-[11px] leading-relaxed space-y-1.5">
                                                        <p className="text-slate-400 text-[10px]">
                                                            El OEE ({Math.round((100 - oeePenalty) * 10) / 10}%) simula las pérdidas reales de producción por paros no planeados, 
                                                            rechazos de calidad y velocidad reducida.
                                                        </p>
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fórmula:</p>
                                                            <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[9px] leading-normal text-slate-300">
                                                                {calcMode === 'demand' ? (
                                                                    <>
                                                                        <span className="text-violet-400">Demanda/Día</span> = <span className="text-violet-400">Demanda Anual</span> ÷ <span className="text-indigo-400">Días Anuales</span><br/>
                                                                        <span className="text-cyan-400">Neta/Día</span> = <span className="text-cyan-400">PPH_real</span> × <span className="text-slate-400">Hrs/Día</span> × <span className="text-emerald-400">OEE</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <span className="text-slate-300">Bruta/Día</span> = <span className="text-cyan-400">PPH_real</span> × <span className="text-slate-400">Hrs/Día</span><br/>
                                                                        <span className="text-cyan-400">Neta/Día</span> = <span className="text-slate-300">Bruta/Día</span> × <span className="text-emerald-400">OEE</span>
                                                                    </>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Cálculo con valores:</p>
                                                            <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[9px] leading-normal text-slate-300">
                                                                {calcMode === 'demand' ? (
                                                                    <>
                                                                        <span className="text-violet-400">Demanda/Día</span> = <span className="text-violet-400">{Math.round(annualDemand).toLocaleString()}</span> ÷ <span className="text-indigo-400">{diasAnuales}</span> = <span className="text-violet-400">{Math.round(piezasDia).toLocaleString()} pzas</span><br/>
                                                                        <span className="text-cyan-400">Neta/Día</span> = <span className="text-cyan-400">{Math.round(piezasHora).toLocaleString()}</span> × <span className="text-slate-400">{shiftHours}</span> × <span className="text-emerald-400">{oeePercent}%</span> = <span className="text-cyan-400">{Math.round(piezasDia).toLocaleString()} pzas</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <span className="text-slate-300">Bruta/Día</span> = <span className="text-cyan-400">{Math.round(piezasHora).toLocaleString()}</span> × <span className="text-slate-400">{shiftHours}</span> = <span className="text-slate-300">{Math.round(piezasDiaSinOEE).toLocaleString()} pzas</span><br/>
                                                                        <span className="text-cyan-400">Neta/Día</span> = <span className="text-slate-300">{Math.round(piezasDiaSinOEE).toLocaleString()}</span> × <span className="text-emerald-400">{oeePercent}%</span> = <span className="text-cyan-400">{Math.round(piezasDia).toLocaleString()} pzas</span>
                                                                    </>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Desglose de Pérdidas:</p>
                                                            <div className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-[10px] leading-relaxed space-y-1">
                                                                <p>
                                                                    <span className="text-slate-500">Capacidad Bruta:</span>{' '}
                                                                    <span className="text-white font-bold">{Math.round(piezasDiaSinOEE).toLocaleString()} pzas</span>
                                                                </p>
                                                                <p className="text-rose-400">
                                                                    <span>Pérdida Disp ({studyConfig?.availability !== undefined ? studyConfig.availability : 95}%):</span>{' '}
                                                                    <span className="font-bold">−{Math.round(piezasPerdidasDisp).toLocaleString()} pzas</span>
                                                                </p>
                                                                <p className="text-amber-500">
                                                                    <span>Pérdida Efec ({Math.round(efficiency * 10) / 10}%):</span>{' '}
                                                                    <span className="font-bold">−{Math.round(piezasPerdidasEficiencia).toLocaleString()} pzas</span>
                                                                </p>
                                                                <p className="text-rose-500">
                                                                    <span>Pérdida Calidad ({studyConfig?.yield !== undefined ? studyConfig.yield : 98}%):</span>{' '}
                                                                    <span className="font-bold">−{Math.round(piezasPerdidasCalidad).toLocaleString()} pzas</span>
                                                                </p>
                                                                <div className="border-t border-slate-700 pt-1">
                                                                    <span className="text-slate-500">Capacidad Neta (OEE):</span>{' '}
                                                                    <span className="text-cyan-400 font-bold">{Math.round(piezasDia).toLocaleString()} pzas/día</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                    </div>
                                                    <div className="absolute bottom-full left-6 border-4 border-transparent border-b-slate-950/95" />
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Piezas / Semana */}
                                    {(() => {
                                        const pzSemBruto = piezasSemanaBruto;
                                        const perdidaSem = pzSemBruto - piezasSemana;
                                        return (
                                            <div 
                                                onClick={(e) => handleRelationClick('card-piezasSem', e)}
                                                className={`relative group bg-slate-955/40 p-3 rounded-xl border border-slate-800/80 hover:border-emerald-500/30 transition-all duration-200 overflow-visible cursor-pointer ${activeTooltipId === 'card-piezasSem' ? 'z-[60]' : 'hover:z-50'} ${getHighlightStyles('card-piezasSem').wrapperClass}`}
                                            >
                                                {getHighlightLabel('card-piezasSem') && (
                                                    <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                        hoveredRelation === 'card-piezasSem' ? 'bg-cyan-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                                                    }`}>
                                                        {getHighlightLabel('card-piezasSem')}
                                                    </span>
                                                )}
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-sans">Piezas / Sem</span>
                                                <span className="text-lg font-black text-slate-200 block leading-tight mt-0.5">
                                                    {piezasSemana > 0 ? Math.round(piezasSemana).toLocaleString() : '—'}
                                                </span>
                                                <span className="text-[8px] text-slate-600 block mt-0.5">neto (OEE {oeePercent}%)</span>
                                                <span className={`text-[8px] block mt-0.5 font-bold ${piezasSemanaReal >= piezasSemana ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    vs Real: {Math.round(piezasSemanaReal).toLocaleString()} {piezasSemanaReal >= piezasSemana ? '✅' : '⚠️'}
                                                </span>

                                                {/* Tooltip */}
                                                <div className={`absolute top-full left-0 mt-2 w-64 p-3 bg-slate-950/95 text-slate-200 text-xs rounded-xl border border-slate-800/80 shadow-2xl backdrop-blur-md transition-all duration-200 z-50 text-left font-sans ${activeTooltipId === 'card-piezasSem' ? 'opacity-100 pointer-events-auto translate-y-0 scale-100' : 'opacity-0 pointer-events-none -translate-y-1 scale-95'}`}>
                                                    <div className="font-bold text-white mb-1.5 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <Info className="w-3.5 h-3.5 text-violet-400" />
                                                        <span>Piezas / Semana — Bruto vs Neto</span>
                                                    </div>
                                                    <div className="text-[11px] leading-relaxed space-y-1.5">
                                                        <p className="text-slate-400 text-[10px]">Producción semanal proyectada neta versus objetivo semanal.</p>
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fórmula:</p>
                                                            <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[9px] leading-normal text-slate-300">
                                                                {calcMode === 'demand' ? (
                                                                    <>
                                                                        <span className="text-violet-400">Demanda/Sem</span> = <span className="text-violet-400">Demanda/Día</span> × <span className="text-slate-400">Días/Sem</span><br/>
                                                                        <span className="text-cyan-400">Neta/Sem</span> = <span className="text-cyan-400">Neta/Día</span> × <span className="text-slate-400">Días/Sem</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <span className="text-slate-300">Bruta/Sem</span> = <span className="text-cyan-400">PPH_real</span> × <span className="text-slate-400">Hrs/Día</span> × <span className="text-slate-400">Días/Sem</span><br/>
                                                                        <span className="text-cyan-400">Neta/Sem</span> = <span className="text-slate-300">Bruta/Sem</span> × <span className="text-emerald-400">OEE</span>
                                                                    </>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Cálculo con valores:</p>
                                                            <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[9px] leading-normal text-slate-300">
                                                                {calcMode === 'demand' ? (
                                                                    <>
                                                                        <span className="text-violet-400">Demanda/Sem</span> = <span className="text-violet-400">{Math.round(piezasDia).toLocaleString()}</span> × <span className="text-slate-400">{studyConfig?.workDaysPerWeek !== undefined ? studyConfig.workDaysPerWeek : 5}</span> = <span className="text-violet-400">{Math.round(piezasSemana).toLocaleString()} pzas</span><br/>
                                                                        <span className="text-cyan-400">Neta/Sem</span> = <span className="text-cyan-400">{Math.round(piezasDia).toLocaleString()}</span> × <span className="text-slate-400">{studyConfig?.workDaysPerWeek !== undefined ? studyConfig.workDaysPerWeek : 5}</span> = <span className="text-cyan-400">{Math.round(piezasSemana).toLocaleString()} pzas</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <span className="text-slate-300">Bruta/Sem</span> = <span className="text-cyan-400">{Math.round(piezasHora).toLocaleString()}</span> × <span className="text-slate-400">{shiftHours}</span> × <span className="text-slate-400">{studyConfig?.workDaysPerWeek !== undefined ? studyConfig.workDaysPerWeek : 5}</span> = <span className="text-slate-300">{Math.round(pzSemBruto).toLocaleString()} pzas</span><br/>
                                                                        <span className="text-cyan-400">Neta/Sem</span> = <span className="text-slate-300">{Math.round(pzSemBruto).toLocaleString()}</span> × <span className="text-emerald-400">{oeePercent}%</span> = <span className="text-cyan-400">{Math.round(piezasSemana).toLocaleString()} pzas</span>
                                                                    </>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-[10px] leading-relaxed space-y-0.5">
                                                            <p><span className="text-slate-500">Bruto Semanal:</span> <span className="text-white font-bold">{Math.round(pzSemBruto).toLocaleString()} pzas</span></p>
                                                            <p className="text-rose-400">Pérdida OEE: <span className="font-bold">−{Math.round(perdidaSem).toLocaleString()} pzas</span></p>
                                                            <div className="border-t border-slate-700 pt-0.5">
                                                                <span className="text-slate-500">Neto Semanal:</span> <span className="text-violet-400 font-bold">{Math.round(piezasSemana).toLocaleString()} pzas/sem</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="absolute bottom-full left-6 border-4 border-transparent border-b-slate-950/95" />
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Piezas / Año */}
                                    {(() => {
                                        const pzAnoBruto = piezasAnoBruto;
                                        const perdidaAno = pzAnoBruto - piezasAno;
                                        return (
                                            <div 
                                                onClick={(e) => handleRelationClick('card-piezasAno', e)}
                                                className={`relative group bg-slate-955/40 p-3 rounded-xl border border-slate-800/80 hover:border-emerald-500/30 transition-all duration-200 overflow-visible cursor-pointer ${activeTooltipId === 'card-piezasAno' ? 'z-[60]' : 'hover:z-50'} ${getHighlightStyles('card-piezasAno').wrapperClass}`}
                                            >
                                                {getHighlightLabel('card-piezasAno') && (
                                                    <span className={`absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm z-20 animate-fade-in ${
                                                        hoveredRelation === 'card-piezasAno' ? 'bg-cyan-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                                                    }`}>
                                                        {getHighlightLabel('card-piezasAno')}
                                                    </span>
                                                )}
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-sans">Piezas / Año</span>
                                                <span className="text-lg font-black text-amber-300 block leading-tight mt-0.5">
                                                    {piezasAno > 0 ? Math.round(piezasAno).toLocaleString() : '—'}
                                                </span>
                                                <span className={`text-[8px] block mt-0.5 ${cumpleDemanda ? 'text-emerald-500' : 'text-rose-400'}`}>
                                                    {cumpleDemanda ? '✓ Cumple' : '✗ No cumple'} demanda ({Math.round(cumplimiento)}%)
                                                </span>
                                                <span className={`text-[8px] block mt-0.5 font-bold ${piezasAnoReal >= annualDemand ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    vs Real: {Math.round(piezasAnoReal).toLocaleString()} ({Math.round(cumplimientoReal)}%) {cumpleDemandaReal ? '✅' : '⚠️'}
                                                </span>
                                                <div className={`absolute top-full right-0 left-auto mt-2 w-72 p-3 bg-slate-950/95 text-slate-200 text-xs rounded-xl border border-slate-800/80 shadow-2xl backdrop-blur-md transition-all duration-200 z-50 text-left font-sans ${activeTooltipId === 'card-piezasAno' ? 'opacity-100 pointer-events-auto translate-y-0 scale-100' : 'opacity-0 pointer-events-none -translate-y-1 scale-95'}`}>
                                                    <div className="font-bold text-white mb-1.5 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <Info className="w-3.5 h-3.5 text-amber-400" />
                                                        <span>Piezas / Año — Bruto vs Neto</span>
                                                    </div>
                                                    <div className="text-[11px] leading-relaxed space-y-1.5">
                                                        <p className="text-slate-400 text-[10px]">
                                                            Proyección anual: {diasAnuales} días laborales ({workDaysPerWeek} días/sem × 52 − {feriados} feriados {country}).
                                                        </p>
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fórmula:</p>
                                                            <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[9px] leading-normal text-slate-300">
                                                                {calcMode === 'demand' ? (
                                                                    <>
                                                                        <span className="text-violet-400">Demanda Anual</span> = (input primario)<br/>
                                                                        <span className="text-cyan-400">Neta/Año</span> = <span className="text-cyan-400">Neta/Día</span> × <span className="text-indigo-400">{diasAnuales} días</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <span className="text-slate-300">Bruta/Año</span> = <span className="text-cyan-400">PPH_real</span> × <span className="text-slate-400">Hrs/Día</span> × <span className="text-indigo-400">{diasAnuales} días</span><br/>
                                                                        <span className="text-cyan-400">Neta/Año</span> = <span className="text-slate-300">Bruta/Año</span> × <span className="text-emerald-400">OEE</span>
                                                                    </>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Cálculo con valores:</p>
                                                            <p className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-center font-bold text-[9px] leading-normal text-slate-300">
                                                                {calcMode === 'demand' ? (
                                                                    <>
                                                                        <span className="text-violet-400">Demanda Anual</span> = <span className="text-violet-400">{Math.round(annualDemand).toLocaleString()} pzas</span><br/>
                                                                        <span className="text-cyan-400">Neta/Año</span> = <span className="text-cyan-400">{Math.round(piezasDia).toLocaleString()}</span> × <span className="text-indigo-400">{diasAnuales}</span> = <span className="text-cyan-400">{Math.round(piezasAno).toLocaleString()} pzas</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <span className="text-slate-300">Bruta/Año</span> = <span className="text-cyan-400">{Math.round(piezasHora).toLocaleString()}</span> × <span className="text-slate-400">{shiftHours}</span> × <span className="text-indigo-400">{diasAnuales}</span> = <span className="text-slate-300">{Math.round(pzAnoBruto).toLocaleString()} pzas</span><br/>
                                                                        <span className="text-cyan-400">Neta/Año</span> = <span className="text-slate-300">{Math.round(pzAnoBruto).toLocaleString()}</span> × <span className="text-emerald-400">{oeePercent}%</span> = <span className="text-cyan-400">{Math.round(piezasAno).toLocaleString()} pzas</span>
                                                                    </>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-[10px] leading-relaxed space-y-0.5">
                                                            <p><span className="text-slate-500">Bruto Anual:</span> <span className="text-white font-bold">{Math.round(pzAnoBruto).toLocaleString()} pzas</span></p>
                                                            <p className="text-rose-400">Pérdida OEE: <span className="font-bold">−{Math.round(perdidaAno).toLocaleString()} pzas</span></p>
                                                            <div className="border-t border-slate-700 pt-0.5">
                                                                <span className="text-slate-500">Neto Anual:</span> <span className="text-amber-400 font-bold">{Math.round(piezasAno).toLocaleString()} pzas/año</span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Cumplimiento vs Demanda:</p>
                                                            <div className="bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono text-[10px] leading-relaxed space-y-0.5">
                                                                <p><span className="text-slate-500">Neto/Año:</span> <span className="text-amber-400 font-bold">{Math.round(piezasAno).toLocaleString()}</span></p>
                                                                <p><span className="text-slate-500">Demanda:</span> <span className="text-white font-bold">{Math.round(annualDemand).toLocaleString()}</span></p>
                                                                <div className="border-t border-slate-700 pt-0.5">
                                                                    <span className="text-slate-500">Resultado:</span>{' '}
                                                                    <span className={`font-bold ${cumpleDemanda ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                        {cumplimiento.toFixed(1)}% {cumpleDemanda ? '✓ Cumple' : '✗ No cumple'}
                                                                    </span>
                                                                </div>
                                                                {!cumpleDemanda && annualDemand > 0 && piezasAno > 0 && (
                                                                    <p className="text-rose-400/70">Faltan {Math.round(annualDemand - piezasAno).toLocaleString()} pzas/año</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="absolute bottom-full right-6 left-auto border-4 border-transparent border-b-slate-950/95" />
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>


                        {/* ── GANTT INTERACTIVO DE PASOS ── */}
                        <TimingStudyGantt
                            currentStudy={currentStudy}
                            steps={steps}
                            stations={stations}
                            canEdit={canEdit}
                            onAddStep={handleAddStep}
                            onUpdateStep={handleUpdateStep}
                            onUpdateStepField={handleUpdateStepField}
                            onDeleteStep={handleDeleteStep}
                            onDuplicateStep={handleDuplicateStep}
                            onMoveStep={handleMoveStep}
                            onRecalculate={handleRecalculate}
                            onSuggestDuration={handleSuggestDuration}
                            onSuggestAllDurations={handleSuggestAllDurations}
                            standardsConfig={standardsConfig}
                            actuatorGroups={actuatorGroups}
                            getValidActionsForDevice={getValidActionsForDevice}
                        />

                        {/* ── PANEL DE VALIDACI├ôN DEL ESTUDIO ── */}
                        <TimingStudyValidationPanel
                            validationResults={validationResults}
                            onSelectStep={(stepId) => {
                                const element = document.getElementById(`step-row-${stepId}`);
                                if (element) {
                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    element.classList.add('bg-cyan-500/20');
                                    setTimeout(() => {
                                        element.classList.remove('bg-cyan-500/20');
                                    }, 2000);
                                }
                            }}
                        />

                        {/* ── SECCIÓN AJUSTES EST├üNDAR DEL PROYECTO ── */}
                        <div className="bg-slate-900/70 rounded-xl border border-slate-800 overflow-hidden">
                            <button
                                onClick={() => setShowStandards(!showStandards)}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-850/30 transition text-left cursor-pointer focus:outline-none"
                            >
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    Ajustes Estándar de la Plataforma (S├│lo Lectura)
                                </span>
                                <span className="text-xs text-cyan-400 font-bold">
                                    {showStandards ? 'Ocultar' : 'Mostrar'}
                                </span>
                            </button>

                            {showStandards && standardsConfig && (
                                <div className="p-6 border-t border-slate-800/60 bg-slate-950/20">
                                    {/* Banner Informativo */}
                                    <div className="mb-5 p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-medium">
                                        <span>
                                            Γä╣∩╕Å <strong>Estándares de la Plataforma</strong>: Los clasificadores y tiempos estándar son configuraciones globales de la empresa. Para modificarlos, dirígete a la sección de clasificadores de ingeniería.
                                        </span>
                                        <a 
                                            href="/engineering/lists" 
                                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition shrink-0 text-[10px] text-center uppercase tracking-wider"
                                        >
                                            Ir a Configuración Global
                                        </a>
                                    </div>

                                    <fieldset disabled={true} className="border-0 p-0 m-0 w-full">
                                        {/* Tabs */}
                                        <div className="flex gap-2 mb-6 border-b border-slate-800/50 pb-2">
                                            <button
                                                onClick={() => setStandardsActiveTab('classifiers')}
                                                className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                                                    standardsActiveTab === 'classifiers'
                                                        ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                                                        : 'text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                Clasificadores (Acción Γåö Dispositivo)
                                            </button>
                                            <button
                                                onClick={() => setStandardsActiveTab('motionValues')}
                                                className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                                                    standardsActiveTab === 'motionValues'
                                                        ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                                                        : 'text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                Tiempos de Movimientos Estándar
                                            </button>
                                        </div>

                                        {/* TAB: Classifiers */}
                                        {standardsActiveTab === 'classifiers' && (
                                            <div>
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                                                    <p className="text-xs text-slate-400">
                                                        Define qué perfil de tiempo o valor fijo se sugiere para cada combinación de Dispositivo y Acción.
                                                    </p>
                                                </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs text-left border-collapse" style={{ minWidth: '800px' }}>
                                                    <thead>
                                                        <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                                                            <th className="py-2.5 px-3">Tipo de Dispositivo</th>
                                                            <th className="py-2.5 px-3">Acción</th>
                                                            <th className="py-2.5 px-3">Perfil Estándar</th>
                                                            <th className="py-2.5 px-3">Valor Fijo Override (ms)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(standardsConfig.classifiers || []).map((rule) => (
                                                            <tr key={rule.id} className="border-b border-slate-800/50 hover:bg-slate-900/20">
                                                                <td className="py-2 px-3">
                                                                    <select
                                                                        value={rule.deviceType}
                                                                        onChange={(e) => handleUpdateClassifierRule(rule.id, { deviceType: e.target.value })}
                                                                        disabled={!canEdit}
                                                                        className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500"
                                                                    >
                                                                        {Object.entries(TIMING_DEVICE_TYPES).map(([k, v]) => (
                                                                            <option key={k} value={v}>
                                                                                {v}{DEVICE_LABELS[v] ? ` (${DEVICE_LABELS[v]})` : ''}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                                <td className="py-2 px-3">
                                                                    <select
                                                                        value={rule.deviceAction || '*'}
                                                                        onChange={(e) => handleUpdateClassifierRule(rule.id, { deviceAction: e.target.value === '*' ? null : e.target.value })}
                                                                        disabled={!canEdit}
                                                                        className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500"
                                                                    >
                                                                        <option value="*">* (Cualquiera)</option>
                                                                        {Object.entries(TIMING_ACTIONS).map(([k, v]) => (
                                                                            <option key={k} value={v}>
                                                                                {v}{ACTION_LABELS[v] ? ` (${ACTION_LABELS[v]})` : ''}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                                <td className="py-2 px-3">
                                                                    <select
                                                                        value={rule.motionValueId || ''}
                                                                        onChange={(e) => handleUpdateClassifierRule(rule.id, { motionValueId: e.target.value || null })}
                                                                        disabled={!canEdit || (rule.overrideValue > 0)}
                                                                        className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500 disabled:opacity-30"
                                                                    >
                                                                        <option value="">Ninguno (usar valor fijo)</option>
                                                                        <optgroup label="Tiempos Base">
                                                                            <option value="controller_scan_network">Scan de Red del Controlador</option>
                                                                            <option value="valve_response">Respuesta de Válvula</option>
                                                                            <option value="handshake_response">Respuesta de Handshake</option>
                                                                        </optgroup>
                                                                        <optgroup label="Actuadores Neumáticos / Grippers">
                                                                            <option value="small_gripper">Gripper Pequeño</option>
                                                                            <option value="large_gripper">Gripper Grande</option>
                                                                            <option value="vacuum_gripper">Gripper de Vacío</option>
                                                                            <option value="escapement_tic_toc">Escapador Tic-Toc</option>
                                                                            <option value="pneumatic_rotary_clamp">Clamp Giratorio Neumático</option>
                                                                        </optgroup>
                                                                        <optgroup label="Velocidades de Cilindros">
                                                                            <option value="guided_cylinder">Cilindro Guiado</option>
                                                                            <option value="standard_pneumatic_cylinder">Cilindro Estándar</option>
                                                                            <option value="rodless_cylinder">Cilindro Sin Vástago</option>
                                                                            <option value="short_large_bore_cylinder">Cilindro Pancake / Diámetro Corto</option>
                                                                        </optgroup>
                                                                        <optgroup label="Actuadores Giratorios">
                                                                            <option value="small_rotary_actuator">Actuador Giratorio Chico</option>
                                                                            <option value="large_rotary_actuator">Actuador Giratorio Grande</option>
                                                                        </optgroup>
                                                                        <optgroup label="Servos y Motores">
                                                                            <option value="servo_belt_driven">Servo - Correa/Banda</option>
                                                                            <option value="servo_ballscrew_direct_coupled">Servo - Husillo de Bolas</option>
                                                                            <option value="servo_timing_belt_driven">Servo - Correa de Tiempo</option>
                                                                            <option value="servo_linear_motor">Servo - Motor Lineal</option>
                                                                        </optgroup>
                                                                        <optgroup label="Robots">
                                                                            <option value="epson_t3_robot">Robot Epson T3</option>
                                                                            <option value="c6_robot">Robot C6</option>
                                                                        </optgroup>
                                                                    </select>
                                                                </td>
                                                                <td className="py-2 px-3">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={rule.overrideValue !== null && rule.overrideValue !== undefined ? rule.overrideValue : ''}
                                                                        onChange={(e) => handleUpdateClassifierRule(rule.id, { overrideValue: e.target.value === '' ? null : Number(e.target.value) })}
                                                                        disabled={!canEdit}
                                                                        placeholder="Usar cálculo dinámico..."
                                                                        className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-full max-w-[200px]"
                                                                    />
                                                                </td>
                                                                {/* No actions column in read-only mode */}
                                                            </tr>
                                                        ))}
                                                        {(!standardsConfig.classifiers || standardsConfig.classifiers.length === 0) && (
                                                            <tr>
                                                                <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                                                                    No se han definido reglas de clasificación para este estudio.
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Read-only: no save button needed */}
                                        </div>
                                    )}

                                    {/* TAB: Motion Values */}
                                    {standardsActiveTab === 'motionValues' && (
                                        <div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                                {/* Tiempos de Respuesta */}
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 pb-1 border-b border-slate-800/80">Tiempos de Respuesta del Sistema</h4>
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Scan de Red del Controlador (ms):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.controller_scan_network ?? ''}
                                                                onChange={(e) => handleMotionValueChange('controller_scan_network', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Respuesta de Válvula Neumática (ms):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.valve_response ?? ''}
                                                                onChange={(e) => handleMotionValueChange('valve_response', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Respuesta de Handshake (ms):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.handshake_response ?? ''}
                                                                onChange={(e) => handleMotionValueChange('handshake_response', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Cámara / Visión Artificial (ms):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.vision_camera_response ?? ''}
                                                                onChange={(e) => handleMotionValueChange('vision_camera_response', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Lectura de Tag RFID (ms):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.rf_tag_read ?? ''}
                                                                onChange={(e) => handleMotionValueChange('rf_tag_read', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                    </div>

                                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-5 mb-3 pb-1 border-b border-slate-800/80">Grippers y Elementos Auxiliares</h4>
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Gripper Pequeño (ms):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.small_gripper ?? ''}
                                                                onChange={(e) => handleMotionValueChange('small_gripper', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Gripper Grande (ms):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.large_gripper ?? ''}
                                                                onChange={(e) => handleMotionValueChange('large_gripper', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Gripper de Vacío (ms):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.vacuum_gripper ?? ''}
                                                                onChange={(e) => handleMotionValueChange('vacuum_gripper', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Desaceleración Shock Absorber (ms):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.shock_absorber_deceleration ?? ''}
                                                                onChange={(e) => handleMotionValueChange('shock_absorber_deceleration', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Escapador Tic / Toc (ms):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.escapement_tic_toc ?? ''}
                                                                onChange={(e) => handleMotionValueChange('escapement_tic_toc', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Clamp Giratorio Neumático (ms):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.pneumatic_rotary_clamp ?? ''}
                                                                onChange={(e) => handleMotionValueChange('pneumatic_rotary_clamp', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Velocidades de Cilindros y Actuadores */}
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 pb-1 border-b border-slate-800/80">Velocidades de Cilindros y Actuadores</h4>
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Cilindro Guiado (mm/s):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.guided_cylinder ?? ''}
                                                                onChange={(e) => handleMotionValueChange('guided_cylinder', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Cilindro Estándar / Inox (mm/s):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.standard_pneumatic_cylinder ?? ''}
                                                                onChange={(e) => handleMotionValueChange('standard_pneumatic_cylinder', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Cilindro Sin Vástago (mm/s):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.rodless_cylinder ?? ''}
                                                                onChange={(e) => handleMotionValueChange('rodless_cylinder', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Cilindro Pancake / Bore Corto (mm/s):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.short_large_bore_cylinder ?? ''}
                                                                onChange={(e) => handleMotionValueChange('short_large_bore_cylinder', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Actuador Giratorio Pequeño (deg/s):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.small_rotary_actuator ?? ''}
                                                                onChange={(e) => handleMotionValueChange('small_rotary_actuator', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Actuador Giratorio Grande (deg/s):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.large_rotary_actuator ?? ''}
                                                                onChange={(e) => handleMotionValueChange('large_rotary_actuator', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                    </div>

                                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-5 mb-3 pb-1 border-b border-slate-800/80">Servos y Actuadores Eléctricos</h4>
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Servo Acoplado a Correa / Banda (mm/s):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.servo_belt_driven ?? ''}
                                                                onChange={(e) => handleMotionValueChange('servo_belt_driven', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Servo Husillo de Bolas acoplado (mm/s):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.servo_ballscrew_direct_coupled ?? ''}
                                                                onChange={(e) => handleMotionValueChange('servo_ballscrew_direct_coupled', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Servo Correa Sincronizada (mm/s):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.servo_timing_belt_driven ?? ''}
                                                                onChange={(e) => handleMotionValueChange('servo_timing_belt_driven', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Servo Motor Lineal (mm/s):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.servo_linear_motor ?? ''}
                                                                onChange={(e) => handleMotionValueChange('servo_linear_motor', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Ciclo Robot Epson T3 (ms):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.epson_t3_robot ?? ''}
                                                                onChange={(e) => handleMotionValueChange('epson_t3_robot', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center gap-4">
                                                            <label className="text-xs text-slate-300">Ciclo Robot C6 (ms):</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={standardsConfig.motionTimeValues.c6_robot ?? ''}
                                                                onChange={(e) => handleMotionValueChange('c6_robot', e.target.value)}
                                                                disabled={!canEdit}
                                                                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500/50 w-24 text-right"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                        </div>
                                    )}
                                    </fieldset>
                                </div>
                            )}
                        </div>

                        {/* ── TABLA DE SECUENCIA / PASOS (OCULTA POR GANTT) ── */}
                        {false && (
                        <div className="bg-slate-900/70 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/20 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                    <List className="w-4 h-4 text-slate-400" />
                                    Pasos de Secuencia
                                </span>
                                {canEdit && stations.length > 0 && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSuggestAllDurations}
                                            disabled={recalculating || steps.length === 0}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700/80 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                                            title="Sugerir duración automáticamente para todos los pasos en base a la configuración estándar"
                                        >
                                            <Sparkles className="w-3.5 h-3.5" /> Sugerir Todo
                                        </button>
                                        <button
                                            onClick={handleAddStep}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Agregar Paso
                                        </button>
                                    </div>
                                )}
                            </div>

                            {steps.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                    <h4 className="text-sm font-bold text-white mb-1">No hay pasos definidos en este estudio</h4>
                                    <p className="text-xs text-slate-500 max-w-xs mx-auto mb-6">
                                        Agrega pasos individuales o imp├│rtalos automáticamente desde las estaciones del proyecto.
                                    </p>
                                    {canEdit && stations.length > 0 && (
                                        <div className="flex justify-center gap-3">
                                            <button
                                                onClick={handleAddStep}
                                                className="flex items-center gap-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Agregar Primer Paso
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="overflow-x-auto" style={{ overflowX: 'auto', width: '100%' }}>
                                    <div style={{ minWidth: '2150px' }}>
                                        <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed', width: '100%' }}>
                                            <thead>
                                                <tr className="bg-slate-950/40 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800/80">
                                                    <th className="px-3 py-3 whitespace-normal" style={{ width: '220px' }}>Station</th>
                                                    <th className="px-3 py-3" style={{ width: '180px' }}>Device</th>
                                                    <th className="px-3 py-3" style={{ width: '150px' }}>Action</th>
                                                    <th className="px-3 py-3 text-center" style={{ width: '60px' }}>Qty</th>
                                                    <th className="px-3 py-3" style={{ width: '180px' }}>Sensor</th>
                                                    <th className="px-3 py-3 text-center" style={{ width: '80px' }}>Linear mm</th>
                                                    <th className="px-3 py-3 text-center" style={{ width: '80px' }}>Ang deg</th>
                                                    <th className="px-3 py-3" style={{ width: '300px' }}>Task Description</th>
                                                    <th className="px-3 py-3" style={{ width: '160px' }}>Dependencies / Trigger</th>
                                                    <th className="px-3 py-3 text-center" style={{ width: '85px' }}>Lag ms</th>
                                                    <th className="px-3 py-3 text-center" style={{ width: '85px' }}>Start ms</th>
                                                    <th className="px-3 py-3 text-center" style={{ width: '100px' }}>Duration ms</th>
                                                    <th className="px-3 py-3 text-center" style={{ width: '85px' }}>Finish ms</th>
                                                    <th className="px-3 py-3" style={{ width: '100px' }}>Group</th>
                                                    <th className="px-2 py-3 text-center" style={{ width: '60px' }} title="Waits For Main Index">Index</th>
                                                    <th className="px-2 py-3 text-center" style={{ width: '60px' }} title="Is Critical Path">Crit</th>
                                                    <th className="px-3 py-3" style={{ width: '180px' }}>Notes</th>
                                                    {canEdit && <th className="px-3 py-3 text-right" style={{ width: '165px' }}>Actions</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {steps.map((step, idx) => {
                                                    const isCritical = !!step.isCriticalPath;
                                                    const isBottleneck = !!step.isBottleneck;

                                                    return (
                                                        <tr
                                                            key={step.id}
                                                            id={`step-row-${step.id}`}
                                                            className={`border-b border-slate-800/50 hover:bg-slate-850/20 transition-colors ${
                                                                isCritical ? 'bg-amber-500/5' : ''
                                                            }`}
                                                        >
                                                            {/* Station Selection */}
                                                            <td className="px-2 py-2">
                                                                <select
                                                                    value={step.stationId || ''}
                                                                    onChange={e => handleUpdateStepField(step.id, 'stationId', e.target.value)}
                                                                    disabled={!canEdit}
                                                                    className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:ring-0 text-xs text-slate-200 font-semibold cursor-pointer py-1"
                                                                >
                                                                    {stations.map(stn => {
                                                                        const stnPad = String(stn.stn || '').padStart(2, '0');
                                                                        const label = stations.some(s => s.indx > 1) ? `${stn.indx || 1}-STN${stnPad}` : `STN${stnPad}`;
                                                                        return (
                                                                            <option key={stn.id} value={stn.id}>
                                                                                {label} ({stn.abbreviation || 'Sin nom'})
                                                                            </option>
                                                                        );
                                                                    })}
                                                                </select>
                                                            </td>

                                                            {/* Device Selection */}
                                                            <td className="px-2 py-2">
                                                                <select
                                                                    value={step.deviceType || ''}
                                                                    onChange={e => handleUpdateStepField(step.id, 'deviceType', e.target.value)}
                                                                    disabled={!canEdit}
                                                                    className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:ring-0 text-xs text-slate-300 py-1"
                                                                >
                                                                    <option value="">— Ninguno —</option>
                                                                    {Object.entries(TIMING_DEVICE_TYPES).map(([k, v]) => (
                                                                        <option key={k} value={v}>
                                                                            {v}{DEVICE_LABELS[v] ? ` (${DEVICE_LABELS[v]})` : ''}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>

                                                            {/* Action Selection */}
                                                            <td className="px-2 py-2">
                                                                <select
                                                                    value={step.deviceAction || ''}
                                                                    onChange={e => handleUpdateStepField(step.id, 'deviceAction', e.target.value)}
                                                                    disabled={!canEdit}
                                                                    className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:ring-0 text-xs text-slate-300 py-1"
                                                                >
                                                                    <option value="">— Ninguno —</option>
                                                                    {getValidActionsForDevice(step.deviceType).map((action) => (
                                                                        <option key={action} value={action}>
                                                                            {action}{ACTION_LABELS[action] ? ` (${ACTION_LABELS[action]})` : ''}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>

                                                            {/* Device Qty */}
                                                            <td className="px-2 py-2">
                                                                <TableInput
                                                                    type="number"
                                                                    min="1"
                                                                    value={step.deviceQty !== undefined ? step.deviceQty : 1}
                                                                    onBlur={e => handleUpdateStepField(step.id, 'deviceQty', Number(e.target.value) || 1)}
                                                                    disabled={!canEdit}
                                                                    className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:ring-0 text-xs text-center text-slate-300 py-1"
                                                                />
                                                            </td>

                                                            {/* Sensor Selection */}
                                                            <td className="px-2 py-2">
                                                                <select
                                                                    value={step.sensorType || ''}
                                                                    onChange={e => handleUpdateStepField(step.id, 'sensorType', e.target.value)}
                                                                    disabled={!canEdit}
                                                                    className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:ring-0 text-xs text-slate-300 py-1"
                                                                >
                                                                    <option value="">— Ninguno —</option>
                                                                    {Object.entries(TIMING_SENSOR_TYPES).map(([k, v]) => (
                                                                        <option key={k} value={v}>
                                                                            {v}{SENSOR_LABELS[v] ? ` (${SENSOR_LABELS[v]})` : ''}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>

                                                            {/* Linear distance */}
                                                            <td className="px-2 py-2">
                                                                {(() => {
                                                                    const isCylinderOrServo = ['CYL PNEU', 'CYL ELEC', 'CYL HYD', 'SV'].includes(step.deviceType);
                                                                    return (
                                                                        <TableInput
                                                                            type={isCylinderOrServo ? "number" : "text"}
                                                                            min="0"
                                                                            value={isCylinderOrServo ? (step.linearDistanceMm || 0) : '—'}
                                                                            onBlur={e => isCylinderOrServo && handleUpdateStepField(step.id, 'linearDistanceMm', Number(e.target.value) || 0)}
                                                                            disabled={!canEdit || !isCylinderOrServo}
                                                                            className={`w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:ring-0 text-xs text-center py-1 font-mono ${
                                                                                isCylinderOrServo ? 'text-slate-300' : 'text-slate-600 dark:text-slate-600 select-none'
                                                                            }`}
                                                                        />
                                                                    );
                                                                })()}
                                                            </td>

                                                            {/* Angular distance */}
                                                            <td className="px-2 py-2">
                                                                {(() => {
                                                                    const isRotary = ['ROT PNEU', 'ROT ELEC'].includes(step.deviceType);
                                                                    return (
                                                                        <TableInput
                                                                            type={isRotary ? "number" : "text"}
                                                                            min="0"
                                                                            value={isRotary ? (step.angularDistanceDeg || 0) : '—'}
                                                                            onBlur={e => isRotary && handleUpdateStepField(step.id, 'angularDistanceDeg', Number(e.target.value) || 0)}
                                                                            disabled={!canEdit || !isRotary}
                                                                            className={`w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:ring-0 text-xs text-center py-1 font-mono ${
                                                                                isRotary ? 'text-slate-300' : 'text-slate-600 dark:text-slate-600 select-none'
                                                                            }`}
                                                                        />
                                                                    );
                                                                })()}
                                                            </td>

                                                            {/* Task Description */}
                                                            <td className="px-2 py-2">
                                                                <TableInput
                                                                    type="text"
                                                                    value={step.taskDescription || ''}
                                                                    onBlur={e => handleUpdateStepField(step.id, 'taskDescription', e.target.value.trim())}
                                                                    disabled={!canEdit}
                                                                    placeholder="Descripción del paso..."
                                                                    className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:ring-0 text-xs text-slate-200 py-1"
                                                                />
                                                            </td>

                                                            {/* Dependency Multi-Select Trigger */}
                                                            <td className="px-2 py-2 relative">
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => setActiveDependencyStepId(activeDependencyStepId === step.id ? null : step.id)}
                                                                        className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded text-[10px] font-semibold cursor-pointer truncate max-w-[120px] flex items-center justify-between gap-1 w-full"
                                                                    >
                                                                        <span>
                                                                            {step.dependencyStepIds?.length > 0
                                                                                ? `${step.dependencyStepIds.length} dep(s)`
                                                                                : '— Sin dep —'
                                                                            }
                                                                        </span>
                                                                        <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                                    </button>
                                                                </div>

                                                                {/* Dropdown flotante de dependencias */}
                                                                {activeDependencyStepId === step.id && (
                                                                    <div className="absolute top-full left-0 mt-1 w-64 bg-slate-850 border border-slate-700 rounded-lg shadow-2xl z-50 p-2 text-xs">
                                                                        <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-1.5">
                                                                            <span className="font-bold text-slate-400">Precedencias</span>
                                                                            <button
                                                                                onClick={() => setActiveDependencyStepId(null)}
                                                                                className="text-slate-500 hover:text-white"
                                                                            >
                                                                                Listo
                                                                            </button>
                                                                        </div>
                                                                        <div className="max-h-[160px] overflow-y-auto space-y-1 custom-scrollbar">
                                                                            {steps
                                                                                .filter(s => s.id !== step.id)
                                                                                .map(s => {
                                                                                    const isChecked = (step.dependencyStepIds || []).includes(s.id);
                                                                                    return (
                                                                                        <label
                                                                                            key={s.id}
                                                                                            className="flex items-start gap-2.5 px-2 py-1 hover:bg-slate-800 rounded cursor-pointer transition"
                                                                                        >
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={isChecked}
                                                                                                onChange={() => handleToggleDependency(step, s.id)}
                                                                                                disabled={!canEdit}
                                                                                                className="w-3.5 h-3.5 bg-slate-900 border-slate-700 text-cyan-600 rounded mt-0.5"
                                                                                            />
                                                                                            <span className="text-slate-300 leading-tight">
                                                                                                <strong className="text-cyan-400 mr-1">{s.stationLabel || 'STN'}:</strong>
                                                                                                {s.taskDescription || 'Paso'}
                                                                                            </span>
                                                                                        </label>
                                                                                    );
                                                                                })}
                                                                            {steps.filter(s => s.id !== step.id).length === 0 && (
                                                                                <span className="text-slate-500 text-center block py-2">
                                                                                    No hay otros pasos creados.
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Lag (ms) */}
                                                            <td className="px-2 py-2">
                                                                <TableInput
                                                                    type="number"
                                                                    value={step.lagMs || 0}
                                                                    onBlur={e => handleUpdateStepField(step.id, 'lagMs', Number(e.target.value) || 0)}
                                                                    disabled={!canEdit}
                                                                    className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:ring-0 text-xs text-center text-slate-350 py-1 font-mono"
                                                                />
                                                            </td>

                                                            {/* Start Time (Calculado) */}
                                                            <td className="px-3 py-2 text-center text-xs font-semibold text-slate-400 font-mono">
                                                                {step.startTimeMs !== undefined ? Math.round(step.startTimeMs) : '0'}
                                                            </td>

                                                            {/* Duration (ms) */}
                                                            <td className="px-2 py-2">
                                                                <TableInput
                                                                    type="number"
                                                                    min="0"
                                                                    value={step.durationMs !== undefined ? step.durationMs : 0}
                                                                    onBlur={e => handleUpdateStepField(step.id, 'durationMs', Number(e.target.value) || 0)}
                                                                    disabled={!canEdit}
                                                                    className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:ring-0 text-xs text-center text-cyan-400 font-bold py-1 font-mono"
                                                                />
                                                            </td>

                                                            {/* Finish Time (Calculado) */}
                                                            <td className="px-3 py-2 text-center text-xs font-semibold text-slate-400 font-mono">
                                                                {step.finishTimeMs !== undefined ? Math.round(step.finishTimeMs) : '0'}
                                                            </td>

                                                            {/* Sequence Group */}
                                                            <td className="px-2 py-2">
                                                                <TableInput
                                                                    type="text"
                                                                    value={step.sequenceGroup || ''}
                                                                    onBlur={e => handleUpdateStepField(step.id, 'sequenceGroup', e.target.value.trim())}
                                                                    disabled={!canEdit}
                                                                    placeholder="Grupo..."
                                                                    className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:ring-0 text-xs text-slate-300 py-1"
                                                                />
                                                            </td>

                                                            {/* Waits for main index */}
                                                            <td className="px-2 py-2 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!step.waitsForMainIndex}
                                                                    onChange={e => handleUpdateStepField(step.id, 'waitsForMainIndex', e.target.checked)}
                                                                    disabled={!canEdit}
                                                                    className="w-3.5 h-3.5 bg-slate-900 border-slate-700 text-cyan-600 rounded cursor-pointer disabled:opacity-50"
                                                                />
                                                            </td>

                                                            {/* Critical Path Indicator */}
                                                            <td className="px-2 py-2 text-center">
                                                                <div className="flex justify-center items-center">
                                                                    {isCritical ? (
                                                                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" title="Secuencia Crítica" />
                                                                    ) : (
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-750" />
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Notes */}
                                                            <td className="px-2 py-2">
                                                                <TableInput
                                                                    type="text"
                                                                    value={step.notes || ''}
                                                                    onBlur={e => handleUpdateStepField(step.id, 'notes', e.target.value.trim())}
                                                                    disabled={!canEdit}
                                                                    placeholder="Notas..."
                                                                    className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:ring-0 text-xs text-slate-400 py-1"
                                                                />
                                                            </td>

                                                            {/* Actions Column */}
                                                            {canEdit && (
                                                                <td className="px-3 py-2 text-right">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        {/* Sugerencia de duración */}
                                                                        <button
                                                                            onClick={() => handleSuggestDuration(step)}
                                                                            className="p-1 hover:bg-slate-800 text-cyan-500 rounded transition cursor-pointer"
                                                                            title="Calcular duración sugerida"
                                                                        >
                                                                            <Sparkles className="w-3.5 h-3.5" />
                                                                        </button>

                                                                        {/* Duplicar paso */}
                                                                        <button
                                                                            onClick={() => handleDuplicateStep(step)}
                                                                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition cursor-pointer"
                                                                            title="Duplicar paso"
                                                                        >
                                                                            <Copy className="w-3.5 h-3.5" />
                                                                        </button>

                                                                        {/* Reordenación (Subir) */}
                                                                        <button
                                                                            onClick={() => handleMoveStep(idx, -1)}
                                                                            disabled={idx === 0}
                                                                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                                            title="Subir orden"
                                                                        >
                                                                            <ChevronUp className="w-3.5 h-3.5" />
                                                                        </button>

                                                                        {/* Reordenación (Bajar) */}
                                                                        <button
                                                                            onClick={() => handleMoveStep(idx, 1)}
                                                                            disabled={idx === steps.length - 1}
                                                                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                                            title="Bajar orden"
                                                                        >
                                                                            <ChevronDown className="w-3.5 h-3.5" />
                                                                        </button>

                                                                        {/* Eliminar paso */}
                                                                        <button
                                                                            onClick={() => handleDeleteStep(step.id)}
                                                                            className="p-1 hover:bg-slate-800 text-slate-500 hover:text-red-400 rounded transition cursor-pointer"
                                                                            title="Quitar paso"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                        )}
                    </div>
                )
            )}
        </div>
    );
}
