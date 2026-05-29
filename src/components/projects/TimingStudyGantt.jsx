import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import {
    ChevronDown, ChevronRight, Plus, Trash2, Copy, Sparkles, ChevronUp, ChevronDown as ChevronDownIcon,
    Layers, Clock, Settings, RefreshCw, ZoomIn, ZoomOut, Zap, Link, List
} from 'lucide-react';
import TimingStudyGanttBar from './TimingStudyGanttBar';
import TimingStudyDependencyArrows from './TimingStudyDependencyArrows';
import TimingStudyStepDrawer from './TimingStudyStepDrawer';
import { calculateTimingStudyMetrics } from '../../models/schemas';

const ROW_HEIGHT = 44;
const GROUP_HEADER_HEIGHT = 34;
const LEFT_PANEL_W = 340;

export default function TimingStudyGantt({
    currentStudy,
    steps = [],
    stations = [],
    canEdit = false,
    onAddStep,
    onUpdateStep,
    onUpdateStepField,
    onDeleteStep,
    onDuplicateStep,
    onMoveStep,
    onRecalculate,
    onSuggestDuration,
    onSuggestAllDurations,
    standardsConfig = null,
    actuatorGroups = null,
    getValidActionsForDevice
}) {
    const timelineRef = useRef(null);
    const leftPanelRef = useRef(null);

    // Ajustes visuales de escala
    const [zoomLevel, setZoomLevel] = useState(1);
    const pxPerMs = 0.3 * zoomLevel;

    // Estados de colapso y UI
    const [collapsedStations, setCollapsedStations] = useState(new Set());
    const [selectedStepForEdit, setSelectedStepForEdit] = useState(null);
    const [linkSource, setLinkSource] = useState(null);

    // Sincronización de scroll vertical
    const handleLeftScroll = (e) => {
        if (timelineRef.current && timelineRef.current.scrollTop !== e.currentTarget.scrollTop) {
            timelineRef.current.scrollTop = e.currentTarget.scrollTop;
        }
    };

    const handleRightScroll = (e) => {
        if (leftPanelRef.current && leftPanelRef.current.scrollTop !== e.currentTarget.scrollTop) {
            leftPanelRef.current.scrollTop = e.currentTarget.scrollTop;
        }
    };

    const toggleStation = (id) => {
        setCollapsedStations(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // ESC para cancelar modo enlace de dependencias
    useEffect(() => {
        if (!linkSource) return;
        const handleEsc = (e) => {
            if (e.key === 'Escape') setLinkSource(null);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [linkSource]);

    // ── 1. Determinar el tiempo máximo del timeline (Escala) ──
    const timelineMaxMs = useMemo(() => {
        const maxStepFinish = steps.length > 0 ? Math.max(...steps.map(s => s.finishTimeMs || 0)) : 0;
        const machineCycle = currentStudy?.machineCycleTimeMs || 0;
        const maxVal = Math.max(maxStepFinish, machineCycle);
        // Margen extra de 1000ms o hasta 1.2 veces, mínimo 3000ms
        const bound = maxVal > 0 ? maxVal * 1.15 : 3000;
        // Redondear a la centena superior
        return Math.ceil(bound / 500) * 500;
    }, [steps, currentStudy]);

    // ── 2. Calcular la posición del Target y del Main Index ──
    const targetMs = useMemo(() => {
        if (!currentStudy?.targetPPM || currentStudy.targetPPM <= 0) return 0;
        return (60 / currentStudy.targetPPM) * 1000;
    }, [currentStudy]);

    const targetPositionPx = targetMs * pxPerMs;
    const mainIndexPositionPx = (currentStudy?.mainIndexTimeMs || 0) * pxPerMs;

    // ── 3. Construir la escala temporal (marcas) ──
    const rulerMarks = useMemo(() => {
        const marks = [];
        // Determinar intervalo dinámico basado en zoom
        let interval = 500; // por defecto cada 500ms
        if (zoomLevel > 1.8) interval = 100;
        else if (zoomLevel > 1.2) interval = 250;
        else if (zoomLevel < 0.6) interval = 1000;

        for (let i = 0; i <= timelineMaxMs; i += interval) {
            marks.push(i);
        }
        return marks;
    }, [timelineMaxMs, zoomLevel]);

    const totalTimelineWidth = timelineMaxMs * pxPerMs;

    // ── 4. Agrupación y mapeo de pasos ──
    const stationGroups = useMemo(() => {
        const groups = {};

        // Inicializar con estaciones activas del proyecto
        stations.forEach(stn => {
            const stnPad = String(stn.stn || '').padStart(2, '0');
            const multiIdx = stations.some(s => s.indx > 1);
            const label = multiIdx ? `${stn.indx || 1}-STN${stnPad}` : `STN${stnPad}`;

            groups[stn.id] = {
                id: stn.id,
                label,
                description: stn.description || '',
                abbreviation: stn.abbreviation || '',
                steps: [],
                maxFinishTimeMs: 0
            };
        });

        // Grupo especial para pasos sin estación vinculada
        const NO_STATION_KEY = 'no_station';
        groups[NO_STATION_KEY] = {
            id: null,
            label: 'Sin Estación',
            description: 'Pasos sin estación vinculada',
            abbreviation: 'S/E',
            steps: [],
            maxFinishTimeMs: 0
        };

        // Distribuir pasos activos
        steps.forEach(step => {
            const key = step.stationId && groups[step.stationId] ? step.stationId : NO_STATION_KEY;
            groups[key].steps.push(step);
            if ((step.finishTimeMs || 0) > groups[key].maxFinishTimeMs) {
                groups[key].maxFinishTimeMs = step.finishTimeMs;
            }
        });

        // Ordenar internamente los pasos de cada estación
        Object.keys(groups).forEach(key => {
            groups[key].steps.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        });

        // Eliminar el grupo especial si está vacío
        if (groups[NO_STATION_KEY].steps.length === 0) {
            delete groups[NO_STATION_KEY];
        }

        // Orden final de visualización
        const orderedGroups = [];
        stations.forEach(stn => {
            if (groups[stn.id]) orderedGroups.push(groups[stn.id]);
        });
        if (groups[NO_STATION_KEY]) {
            orderedGroups.push(groups[NO_STATION_KEY]);
        }

        return orderedGroups;
    }, [steps, stations]);

    // ── 5. Construcción de filas planas (Flat rows) para sincronización vertical ──
    const rows = useMemo(() => {
        const list = [];
        stationGroups.forEach(g => {
            list.push({ type: 'group', group: g, id: g.id || 'no_station' });
            if (!collapsedStations.has(g.id || 'no_station')) {
                g.steps.forEach(s => {
                    list.push({ type: 'step', step: s, stationId: g.id, id: s.id });
                });
            }
        });
        return list;
    }, [stationGroups, collapsedStations]);

    // ── 6. Mapear coordenadas de filas de pasos para pintar flechas de dependencias ──
    const taskRowMap = useMemo(() => {
        const map = new Map();
        let y = 0;
        rows.forEach(row => {
            if (row.type === 'group') {
                y += GROUP_HEADER_HEIGHT;
                return;
            }
            const s = row.step;
            const left = (s.startTimeMs || 0) * pxPerMs;
            const width = Math.max((s.durationMs || 0) * pxPerMs, 12);
            map.set(s.id, { top: y, left, width });
            y += ROW_HEIGHT;
        });
        return map;
    }, [rows, pxPerMs]);

    const totalGridHeight = rows.reduce((h, r) => h + (r.type === 'group' ? GROUP_HEADER_HEIGHT : ROW_HEIGHT), 0);

    // ── 7. Adaptador de dependencias planas para DependencyArrows ──
    const stepsDependencies = useMemo(() => {
        const list = [];
        steps.forEach(step => {
            (step.dependencyStepIds || []).forEach(depId => {
                list.push({
                    predecessorTaskId: depId,
                    successorTaskId: step.id,
                    type: 'FS' // Timing studies siempre son Finish-to-Start
                });
            });
        });
        return list;
    }, [steps]);

    // ── 8. Lógica de dependencias (Enlaces interactivos) ──
    const handleLinkStart = useCallback((stepId) => {
        setLinkSource(prev => prev === stepId ? null : stepId);
    }, []);

    const handleLinkComplete = useCallback(async (targetStepId) => {
        if (linkSource && linkSource !== targetStepId) {
            const targetStep = steps.find(s => s.id === targetStepId);
            if (targetStep) {
                const currentDeps = targetStep.dependencyStepIds || [];
                if (!currentDeps.includes(linkSource)) {
                    const updatedDeps = [...currentDeps, linkSource];
                    await onUpdateStepField(targetStepId, 'dependencyStepIds', updatedDeps);
                    await onRecalculate?.();
                }
            }
            setLinkSource(null);
        }
    }, [linkSource, steps, onUpdateStepField, onRecalculate]);

    // ── 9. Lógica de arrastre de barra interactiva ──
    const handleBarDragEnd = useCallback(({ stepId, durationMs, lagMs }) => {
        onUpdateStep(stepId, { durationMs, lagMs });
    }, [onUpdateStep]);

    return (
        <div className="space-y-4">
            {/* Toolbar Superior del Gantt */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <List className="w-4 h-4 text-cyan-400" />
                        Vista Gantt de Ciclos
                    </span>
                    <span className="px-2 py-0.5 bg-slate-800 text-[10px] text-slate-400 border border-slate-700 rounded-md font-mono">
                        Escala: ms
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Zoom Control */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-850 border border-slate-750 rounded-xl">
                        <ZoomOut className="w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.1"
                            value={zoomLevel}
                            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                            className="w-20 sm:w-28 h-1 bg-slate-750 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                        <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 font-mono w-8 text-right">
                            {Math.round(zoomLevel * 100)}%
                        </span>
                    </div>

                    {/* Acciones Rápidas */}
                    {canEdit && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onSuggestAllDurations}
                                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-cyan-400 border border-cyan-500/20 rounded-xl text-xs font-bold transition cursor-pointer"
                                title="Calcular duración para todos los pasos activos"
                            >
                                <Sparkles className="w-3.5 h-3.5" /> Sugerir Todo
                            </button>
                            <button
                                onClick={onRecalculate}
                                className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
                                title="Recalcular todo el estudio y reevaluar ruta crítica"
                            >
                                <RefreshCw className="w-3.5 h-3.5" /> Recalcular
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Placement Info / Link mode Banner */}
            {linkSource && (
                <div className="bg-indigo-600/90 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center justify-between gap-3 animate-pulse border border-indigo-500/30">
                    <div className="flex items-center gap-2">
                        <Link className="w-4 h-4" />
                        <span>Modo Enlace: Haz clic derecho (o clic normal) en otra barra para que sea precedida por el paso seleccionado.</span>
                    </div>
                    <button
                        onClick={() => setLinkSource(null)}
                        className="px-2 py-0.5 bg-slate-900/30 text-white rounded text-[10px] hover:bg-slate-900/50 transition-colors cursor-pointer"
                    >
                        ESC Cancelar
                    </button>
                </div>
            )}

            {/* Contenedor Principal del Grid */}
            <div className="flex overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/20 relative shadow-2xl">
                {/* ──── PANEL IZQUIERDO (Lista de Pasos) ──── */}
                <div
                    ref={leftPanelRef}
                    onScroll={handleLeftScroll}
                    className="flex-shrink-0 bg-slate-900/90 border-r border-slate-800/60 overflow-y-auto"
                    style={{ width: LEFT_PANEL_W }}
                >
                    {/* Header vacío/escala del panel izquierdo */}
                    <div className="sticky top-0 z-20 bg-slate-950/80 border-b border-slate-800/60 px-4 flex items-center justify-between" style={{ height: 48 }}>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Secuencia por Estación
                        </span>
                    </div>

                    {/* Filas del Panel Izquierdo */}
                    {rows.map((row) => {
                        if (row.type === 'group') {
                            const g = row.group;
                            const collapsed = collapsedStations.has(g.id || 'no_station');
                            return (
                                <div
                                    key={`lg-${g.id || 'no_stn'}`}
                                    onClick={() => toggleStation(g.id || 'no_station')}
                                    className="flex items-center justify-between gap-2 px-3 border-b border-slate-800/40 cursor-pointer hover:bg-slate-850/50 transition-colors select-none group"
                                    style={{ height: GROUP_HEADER_HEIGHT }}
                                >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                                        <span className="font-mono text-xs font-bold text-slate-200 truncate">
                                            {g.label}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-semibold truncate max-w-[120px]" title={g.description}>
                                            {g.abbreviation || g.description}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-mono font-bold text-slate-500">
                                            {Math.round(g.maxFinishTimeMs)} ms
                                        </span>
                                        {canEdit && g.id && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAddStep(g.id);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-800 text-cyan-400 border border-slate-700/80 rounded transition cursor-pointer"
                                                title="Añadir paso a esta estación"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        const s = row.step;
                        const hasDevice = !!s.deviceType;
                        const deviceStr = hasDevice 
                            ? `${s.deviceType}${s.deviceLetter ? ' ' + s.deviceLetter : ''}`
                            : 'Definir actividad';
                        const actionStr = s.deviceAction ? ` [${s.deviceAction}]` : '';

                        return (
                            <div
                                key={`ls-${s.id}`}
                                onDoubleClick={() => setSelectedStepForEdit(s)}
                                className={`group flex items-center justify-between gap-2 px-4 border-b border-slate-800/40 hover:bg-slate-800/20 cursor-pointer transition-colors`}
                                style={{ height: ROW_HEIGHT, paddingLeft: 16 }}
                            >
                                <div className="flex flex-col min-w-0 pr-1 flex-1">
                                    <p className={`text-xs font-semibold truncate ${s.isCriticalPath ? 'text-red-400 font-bold' : s.isBottleneck ? 'text-amber-400 font-bold' : 'text-slate-200'}`} title={s.taskDescription}>
                                        {s.taskDescription || `${deviceStr}${actionStr}`}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] font-mono font-bold text-slate-500">
                                            {s.startTimeMs !== undefined ? Math.round(s.startTimeMs) : 0}ms ➜ {s.finishTimeMs !== undefined ? Math.round(s.finishTimeMs) : 0}ms
                                        </span>
                                        {s.sequenceGroup && (
                                            <span className="px-1 py-px bg-slate-800 border border-slate-750 text-slate-400 rounded text-[8px] font-mono">
                                                G:{s.sequenceGroup}
                                            </span>
                                        )}
                                        {s.dependencyStepIds?.length > 0 && (
                                            <span className="text-[8px] text-indigo-400 font-bold">
                                                {s.dependencyStepIds.length} dep(s)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {canEdit && (
                                        <>
                                            <button
                                                onClick={() => onSuggestDuration(s)}
                                                className="p-1 hover:bg-slate-800 text-cyan-400 rounded transition cursor-pointer"
                                                title="Sugerir duración"
                                            >
                                                <Sparkles className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => onDuplicateStep(s)}
                                                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition cursor-pointer"
                                                title="Duplicar"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteStep(s.id)}
                                                className="p-1 hover:bg-slate-800 text-slate-500 hover:text-red-400 rounded transition cursor-pointer"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ──── PANEL DERECHO (Timeline) ──── */}
                <div
                    ref={timelineRef}
                    onScroll={handleRightScroll}
                    className="flex-1 overflow-x-auto overflow-y-auto bg-slate-950/40 relative"
                >
                    <div style={{ width: totalTimelineWidth, minWidth: '100%', height: totalGridHeight + 48 }}>
                        {/* Regla Temporal (Ms Ruler Header) */}
                        <div className="sticky top-0 z-20 bg-slate-950/95 border-b border-slate-800/60 flex relative" style={{ height: 48 }}>
                            {rulerMarks.map((val, idx) => {
                                const posPx = val * pxPerMs;
                                const isMajor = val % 1000 === 0;

                                return (
                                    <div
                                        key={idx}
                                        className="absolute top-0 bottom-0 border-r border-slate-800/40"
                                        style={{ left: posPx, width: 1 }}
                                    >
                                        <div className="px-1 py-1.5 select-none sticky left-0">
                                            <span className={`text-[9px] font-mono font-bold tracking-wider ${isMajor ? 'text-slate-300' : 'text-slate-650'}`}>
                                                {val >= 1000 ? `${(val / 1000).toFixed(1)}s` : `${val}ms`}
                                            </span>
                                            {isMajor && (
                                                <div className="w-px h-1.5 bg-slate-700 mt-1" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Líneas Verticales de Referencia (Indexador y Target) */}


                        {targetPositionPx > 0 && targetPositionPx <= totalTimelineWidth && (
                            <div
                                className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-cyan-500/40 z-10 pointer-events-none"
                                style={{ left: targetPositionPx }}
                                title={`Target Cycle: ${Math.round(targetMs)} ms`}
                            >
                                <span className="absolute bottom-4 left-2 bg-cyan-950 text-cyan-400 border border-cyan-800 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Target
                                </span>
                            </div>
                        )}

                        {/* Cuadrícula de Fondo (Alternancia sombreado de ms) */}
                        <div className="absolute inset-y-0 left-0 right-0 pointer-events-none z-0">
                            {rulerMarks.map((val, idx) => {
                                if (val % 1000 !== 0) return null;
                                const posPx = val * pxPerMs;
                                const isOdd = (val / 1000) % 2 !== 0;
                                return (
                                    <div
                                        key={`bg-${idx}`}
                                        className={`absolute inset-y-0 ${isOdd ? 'bg-slate-900/10' : 'bg-transparent'}`}
                                        style={{ left: posPx, width: 1000 * pxPerMs }}
                                    />
                                );
                            })}
                        </div>
                        {/* ── Zonas DWELL / INDEX (solo para máquinas Indexer) ── */}
                        {currentStudy?.mainIndexEnabled && (currentStudy?.mainIndexTimeMs || 0) > 0 && (() => {
                            const indexMs = currentStudy.mainIndexTimeMs || 0;
                            const dwellMs = currentStudy.dwellTimeMs || 0;
                            const indexPx = indexMs * pxPerMs;
                            const dwellPx = dwellMs * pxPerMs;

                            return (
                                <div className="absolute inset-y-0 left-0 right-0 pointer-events-none z-[1]" style={{ top: 48 }}>
                                    {/* DWELL zone (0 → dwellMs) — mesa quieta, operaciones */}
                                    {dwellPx > 0 && (
                                        <div
                                            className="absolute inset-y-0"
                                            style={{ left: 0, width: dwellPx, background: 'linear-gradient(180deg, rgba(16,185,129,0.07) 0%, rgba(16,185,129,0.02) 100%)' }}
                                        >
                                            {/* Borde derecho */}
                                            <div className="absolute right-0 inset-y-0 w-px bg-emerald-500/20" />
                                            {/* Label */}
                                            <div className="sticky top-0 flex items-center justify-center pt-2">
                                                <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-[0.15em]">
                                                    🔵 DWELL · {dwellMs}ms
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* INDEX zone (dwellMs → dwellMs + indexMs) — mesa en movimiento */}
                                    {indexPx > 0 && (
                                        <div
                                            className="absolute inset-y-0"
                                            style={{ left: dwellPx, width: indexPx, background: 'linear-gradient(180deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.03) 100%)' }}
                                        >
                                            {/* Borde derecho */}
                                            <div className="absolute right-0 inset-y-0 w-px bg-amber-500/20" />
                                            {/* Label */}
                                            <div className="sticky top-0 flex items-center justify-center pt-2">
                                                <span className="bg-amber-950/80 text-amber-400 border border-amber-800/50 text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-[0.15em]">
                                                    ⚡ INDEX · {indexMs}ms
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Contenedor de las Barras del Gantt */}
                        <div className="relative z-10" style={{ height: totalGridHeight }}>
                            {/* SVG de dependencias */}
                            <TimingStudyDependencyArrows
                                dependencies={stepsDependencies}
                                taskRowMap={taskRowMap}
                                rowHeight={ROW_HEIGHT}
                                svgWidth={totalTimelineWidth}
                                svgHeight={totalGridHeight}
                            />

                            {/* Barras de pasos y grupos */}
                            {(() => {
                                let currentY = 0;
                                return rows.map((row) => {
                                    if (row.type === 'group') {
                                        const g = row.group;
                                        const y = currentY;
                                        currentY += GROUP_HEADER_HEIGHT;

                                        // Renderizar barra de resumen para el grupo si tiene pasos
                                        if (g.steps.length === 0) return null;
                                        const scheduled = g.steps.filter(s => s.startTimeMs !== undefined);
                                        if (scheduled.length === 0) return null;

                                        const minStart = Math.min(...scheduled.map(s => s.startTimeMs || 0));
                                        const maxFinish = Math.max(...scheduled.map(s => s.finishTimeMs || 0));

                                        const gLeft = minStart * pxPerMs;
                                        const gWidth = Math.max((maxFinish - minStart) * pxPerMs, 10);
                                        const barH = 5;
                                        const barTop = y + (GROUP_HEADER_HEIGHT - barH) / 2;

                                        return (
                                            <div
                                                key={`group-bar-${g.id || 'no_stn'}`}
                                                className="absolute bg-slate-750/75 border border-slate-700/50 rounded-full z-10 pointer-events-none"
                                                style={{
                                                    left: gLeft,
                                                    width: gWidth,
                                                    top: barTop,
                                                    height: barH
                                                }}
                                            />
                                        );
                                    }

                                    const s = row.step;
                                    const y = currentY;
                                    currentY += ROW_HEIGHT;

                                    const left = (s.startTimeMs || 0) * pxPerMs;
                                    const width = (s.durationMs || 0) * pxPerMs;

                                    const isLinkSrc = linkSource === s.id;
                                    const isLinkingMode = !!linkSource;

                                    return (
                                        <div
                                            key={`bar-row-${s.id}`}
                                            id={`step-row-${s.id}`}
                                            className="absolute left-0 right-0 border-b border-slate-900/30 hover:bg-slate-800/10 transition-colors"
                                            style={{ top: y, height: ROW_HEIGHT }}
                                        >
                                            <TimingStudyGanttBar
                                                step={s}
                                                left={left}
                                                width={width}
                                                rowHeight={ROW_HEIGHT}
                                                pxPerMs={pxPerMs}
                                                onClick={() => setSelectedStepForEdit(s)}
                                                onDragEnd={handleBarDragEnd}
                                                onLinkStart={handleLinkStart}
                                                onLinkComplete={handleLinkComplete}
                                                isLinking={isLinkingMode}
                                                isLinkSource={isLinkSrc}
                                                isCritical={s.isCriticalPath}
                                                dimmed={isLinkingMode && !isLinkSrc && !s.dependencyStepIds?.includes(linkSource)}
                                                standardsConfig={standardsConfig}
                                                actuatorGroups={actuatorGroups}
                                            />
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal/Drawer de Edición Detallada */}
            <TimingStudyStepDrawer
                isOpen={!!selectedStepForEdit}
                onClose={() => setSelectedStepForEdit(null)}
                step={selectedStepForEdit}
                stations={stations}
                allSteps={steps}
                onSave={(stepId, updates) => {
                    onUpdateStep(stepId, updates);
                }}
                standardsConfig={standardsConfig}
                actuatorGroups={actuatorGroups}
                getValidActionsForDevice={getValidActionsForDevice}
            />
        </div>
    );
}
