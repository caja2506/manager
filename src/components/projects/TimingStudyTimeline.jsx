import React, { useMemo } from 'react';
import { AlertTriangle, Clock, Target, Info, Sparkles, Zap } from 'lucide-react';

export default function TimingStudyTimeline({ currentStudy, steps = [], stations = [], onSelectStep = null }) {
    // ── 1. Determinar el tiempo máximo del timeline (Escala) ──
    const timelineMaxMs = useMemo(() => {
        const maxStepFinish = steps.length > 0 ? Math.max(...steps.map(s => s.finishTimeMs || 0)) : 0;
        const machineCycle = currentStudy?.machineCycleTimeMs || 0;
        const maxVal = Math.max(maxStepFinish, machineCycle);
        return maxVal > 0 ? maxVal : 5000; // Por defecto 5 segundos si no hay tiempos
    }, [steps, currentStudy]);

    // ── 2. Calcular la posición del Target y del Main Index ──
    const targetMs = useMemo(() => {
        if (!currentStudy?.targetPPM || currentStudy.targetPPM <= 0) return 0;
        return (60 / currentStudy.targetPPM) * 1000;
    }, [currentStudy]);

    const targetPositionPct = useMemo(() => {
        if (targetMs <= 0) return 0;
        return (targetMs / timelineMaxMs) * 100;
    }, [targetMs, timelineMaxMs]);

    const mainIndexPositionPct = useMemo(() => {
        if (!currentStudy?.mainIndexEnabled || !currentStudy.mainIndexTimeMs || currentStudy.mainIndexTimeMs <= 0) return 0;
        return (currentStudy.mainIndexTimeMs / timelineMaxMs) * 100;
    }, [currentStudy, timelineMaxMs]);

    // ── 3. Agrupación de pasos por estación ──
    const stationGroups = useMemo(() => {
        const groups = {};

        // Inicializar los grupos con las estaciones del proyecto en orden
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

        // Grupo especial para pasos sin estación
        const NO_STATION_KEY = 'no_station';
        groups[NO_STATION_KEY] = {
            id: null,
            label: 'Sin Estación',
            description: 'Pasos sin estación vinculada',
            abbreviation: 'S/E',
            steps: [],
            maxFinishTimeMs: 0
        };

        // Distribuir los pasos activos
        steps.forEach(step => {
            const key = step.stationId && groups[step.stationId] ? step.stationId : NO_STATION_KEY;
            groups[key].steps.push(step);
            if ((step.finishTimeMs || 0) > groups[key].maxFinishTimeMs) {
                groups[key].maxFinishTimeMs = step.finishTimeMs;
            }
        });

        // Ordenar los pasos dentro de cada grupo por startTimeMs y sortOrder
        Object.keys(groups).forEach(key => {
            groups[key].steps.sort((a, b) => {
                if (a.startTimeMs !== b.startTimeMs) return (a.startTimeMs || 0) - (b.startTimeMs || 0);
                return (a.sortOrder || 0) - (b.sortOrder || 0);
            });
        });

        // Eliminar grupos de estaciones que no tengan pasos Y que no pertenezcan al proyecto
        // Conservamos las del proyecto para mantener el layout visual
        // Pero el grupo "Sin Estación" solo lo mostramos si contiene pasos
        if (groups[NO_STATION_KEY].steps.length === 0) {
            delete groups[NO_STATION_KEY];
        }

        // Devolver arreglo ordenado según el orden de estaciones del proyecto
        const orderedGroups = [];
        stations.forEach(stn => {
            if (groups[stn.id]) orderedGroups.push(groups[stn.id]);
        });
        if (groups[NO_STATION_KEY]) {
            orderedGroups.push(groups[NO_STATION_KEY]);
        }

        return orderedGroups;
    }, [steps, stations]);

    // ── 4. Marcas de la regla temporal (Header) ──
    const rulerMarks = useMemo(() => {
        const marks = [];
        const count = 5; // Cantidad de subdivisiones
        const interval = timelineMaxMs / count;
        for (let i = 0; i <= count; i++) {
            const val = i * interval;
            marks.push(val);
        }
        return marks;
    }, [timelineMaxMs]);

    // ── 5. Banderas de estado del estudio ──
    const isOverTarget = currentStudy?.machineCycleTimeMs > targetMs && targetMs > 0;
    const allStepsZeroDuration = steps.length > 0 && steps.every(s => !s.durationMs || s.durationMs <= 0);

    // ── Renders de Estados Vacíos ──
    if (!currentStudy) {
        return (
            <div className="bg-slate-900/50 p-8 text-center rounded-2xl border border-slate-800">
                <Info className="w-10 h-10 text-slate-650 mx-auto mb-3" />
                <p className="text-xs text-slate-400">Selecciona o crea un estudio para ver el timeline.</p>
            </div>
        );
    }

    if (steps.length === 0) {
        return (
            <div className="bg-slate-900/50 p-8 text-center rounded-2xl border border-slate-800">
                <Info className="w-10 h-10 text-slate-650 mx-auto mb-3" />
                <p className="text-xs text-slate-400">No hay pasos para visualizar en el timeline de este estudio.</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md space-y-6">
            {/* ── Header del Timeline ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-4">
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        Timeline por Estación
                    </h3>
                    <p className="text-[11px] text-slate-550 mt-0.5">
                        Representación gráfica del ciclo estimado, secuencia temporal y cuellos de botella.
                    </p>
                </div>

                {/* Advertencia si excede el Target */}
                {isOverTarget && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-wide animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        El ciclo estimado excede el target
                    </div>
                )}
            </div>

            {/* ── Leyenda Compacta ── */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] text-slate-400 font-semibold bg-slate-950/20 px-4 py-2.5 rounded-xl border border-slate-850">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-red-500/80 border border-red-400" />
                    <span>Ruta Crítica</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700" />
                    <span>Paso Común</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-0.5 border-t border-dashed border-purple-500" />
                    <span>Main Index</span>
                </div>
                {targetMs > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-0.5 border-t border-dashed border-cyan-500" />
                        <span>Target Cycle</span>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-amber-500/20 border border-dashed border-amber-500/60" />
                    <span>Duración 0 / Pulso</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[8px] font-black uppercase">Bottleneck</span>
                    <span>Cuello de Botella</span>
                </div>
            </div>

            {/* ── Advertencia de duraciones cero ── */}
            {allStepsZeroDuration && (
                <div className="flex items-center gap-2.5 p-3 bg-amber-500/5 border border-amber-500/10 text-amber-550 rounded-xl text-xs">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>Agrega duraciones a los pasos en la tabla de abajo para generar una vista del timeline con barras de tiempo proporcionales.</span>
                </div>
            )}

            {/* ── CONTENEDOR DEL TIMELINE CON SCROLL HORIZONTAL SI ES NECESARIO ── */}
            <div className="relative border border-slate-850 rounded-xl bg-slate-950/15 overflow-x-auto" style={{ overflowX: 'auto', width: '100%' }}>
                <div className="pb-4 select-none relative" style={{ minWidth: '900px' }}>
                    
                    {/* ── Regla Temporal (Escala Superior) ── */}
                    <div className="grid grid-cols-12 items-center border-b border-slate-850 bg-slate-950/30 py-2.5 px-4">
                        <div className="col-span-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estación</div>
                        <div className="col-span-9 relative h-4">
                            {rulerMarks.map((val, idx) => {
                                const posPct = (val / timelineMaxMs) * 100;
                                return (
                                    <div
                                        key={idx}
                                        className="absolute transform -translate-x-1/2 text-[9px] font-mono font-bold text-slate-500"
                                        style={{ left: `${posPct}%` }}
                                    >
                                        {val >= 1000 ? `${(val / 1000).toFixed(1)}s` : `${Math.round(val)}ms`}
                                        <div className="w-px h-1 bg-slate-800 mx-auto mt-0.5" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Filas de Estaciones ── */}
                    <div className="divide-y divide-slate-850 relative">
                        
                        {/* Línea Vertical de Referencia del Main Index */}
                        {mainIndexPositionPct > 0 && mainIndexPositionPct <= 100 && (
                            <div
                                className="absolute top-0 bottom-0 w-px border-l border-dashed border-purple-500/50 z-10 pointer-events-none"
                                style={{ left: `calc(25% + (75% * ${mainIndexPositionPct} / 100))` }}
                                title={`Main Index: ${currentStudy.mainIndexTimeMs} ms`}
                            >
                                <span className="absolute top-1 transform -translate-x-1/2 bg-purple-950 text-purple-400 border border-purple-800 text-[8px] font-black px-1 rounded uppercase tracking-wider">
                                    Index
                                </span>
                            </div>
                        )}

                        {/* Línea Vertical de Referencia del Target */}
                        {targetPositionPct > 0 && targetPositionPct <= 100 && (
                            <div
                                className="absolute top-0 bottom-0 w-px border-l border-dashed border-cyan-500/50 z-10 pointer-events-none"
                                style={{ left: `calc(25% + (75% * ${targetPositionPct} / 100))` }}
                                title={`Target: ${Math.round(targetMs)} ms`}
                            >
                                <span className="absolute bottom-1 transform -translate-x-1/2 bg-cyan-950 text-cyan-400 border border-cyan-800 text-[8px] font-black px-1 rounded uppercase tracking-wider">
                                    Target
                                </span>
                            </div>
                        )}

                        {stationGroups.map(group => {
                            const isBottleneckStation = currentStudy.bottleneckStationId === group.id || 
                                (group.id === null && currentStudy.bottleneckStationLabel === 'Sin Estación');

                            return (
                                <div
                                    key={group.id || 'no_stn'}
                                    className={`grid grid-cols-12 gap-0 items-center px-4 py-3.5 hover:bg-slate-850/5 transition-colors relative ${
                                        isBottleneckStation ? 'border-l-4 border-l-amber-500/80 bg-amber-500/5' : ''
                                    }`}
                                >
                                    {/* Nombre de Estación e Indicadores */}
                                    <div className="col-span-3 pr-4 flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-bold text-slate-200">
                                                {group.label}
                                            </span>
                                            {isBottleneckStation && (
                                                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded text-[8px] font-black uppercase tracking-wider">
                                                    Bottleneck
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-semibold truncate" title={group.description}>
                                            {group.description || 'Sin descripción'}
                                        </span>
                                        <span className="text-[9px] font-mono font-black text-slate-400 mt-1">
                                            Ciclo Est.: {group.maxFinishTimeMs ? `${Math.round(group.maxFinishTimeMs)} ms` : '0 ms'}
                                        </span>
                                    </div>

                                    {/* Barra del Timeline de la Estación */}
                                    <div className="col-span-9 relative h-10 bg-slate-950/45 border border-slate-900/60 rounded-xl overflow-hidden shadow-inner">
                                        
                                        {/* Dibujar los bloques de pasos */}
                                        {group.steps.map(step => {
                                            const leftPct = ((step.startTimeMs || 0) / timelineMaxMs) * 100;
                                            const widthPct = (((step.durationMs || 0)) / timelineMaxMs) * 100;
                                            
                                            // Manejo visual de duración cero
                                            const isZeroDur = !step.durationMs || step.durationMs <= 0;
                                            
                                            // Tooltip rico
                                            const tooltip = `[Paso] ${step.taskDescription || 'Sin descripción'}
Estación: ${step.stationLabel || 'S/E'}
Inicio: ${Math.round(step.startTimeMs || 0)} ms
Duración: ${Math.round(step.durationMs || 0)} ms
Fin: ${Math.round(step.finishTimeMs || 0)} ms
Dispositivo: ${step.deviceType || '—'} ${step.deviceLetter || ''}
Acción: ${step.deviceAction || '—'}
Sensor: ${step.sensorType || '—'}
Dependencias: ${step.dependencyStepIds?.length > 0 ? step.dependencyStepIds.length : 'Ninguna'}
Ruta Crítica: ${step.isCriticalPath ? 'Sí' : 'No'}`;

                                            return (
                                                <div
                                                    key={step.id}
                                                    onClick={() => onSelectStep && onSelectStep(step.id)}
                                                    className={`absolute top-1 bottom-1 rounded-lg flex items-center justify-center text-[9px] font-black border transition-all cursor-pointer select-none px-1.5 shadow-sm group ${
                                                        step.isCriticalPath
                                                            ? 'bg-red-500/85 hover:bg-red-500 border-red-400/70 text-white shadow-red-950/10'
                                                            : isZeroDur
                                                            ? 'bg-amber-500/10 border-dashed border-amber-500/50 hover:bg-amber-500/20 text-amber-400'
                                                            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-350 hover:text-slate-200'
                                                    }`}
                                                    style={{
                                                        left: `${leftPct}%`,
                                                        width: isZeroDur ? '8px' : `calc(${widthPct}% - 2px)`,
                                                        minWidth: isZeroDur ? '8px' : '16px'
                                                    }}
                                                    title={tooltip}
                                                >
                                                    {!isZeroDur && widthPct > 5 && (
                                                        <span className="truncate">
                                                            {step.deviceType || step.deviceAction || step.taskDescription}
                                                        </span>
                                                    )}
                                                    {isZeroDur && <Zap className="w-2.5 h-2.5 text-amber-500 animate-pulse shrink-0" />}
                                                </div>
                                            );
                                        })}

                                        {/* Barra de estado vacío de pasos en la estación */}
                                        {group.steps.length === 0 && (
                                            <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-700 italic uppercase tracking-widest">
                                                Sin secuencia activa
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
