import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Zap, HelpCircle, AlertTriangle } from 'lucide-react';
import { calculateSuggestedDuration } from '../../modules/planning/domain/timingStudyModel';

/**
 * @param {{
 *   step: Object,
 *   left: number,
 *   width: number,
 *   rowHeight: number,
 *   pxPerMs: number,
 *   onClick: (step) => void,
 *   onDragEnd: ({ stepId, durationMs, lagMs }) => void,
 *   onLinkStart: (stepId) => void,
 *   onLinkComplete: (stepId) => void,
 *   isLinking: boolean,
 *   isLinkSource: boolean,
 *   isCritical: boolean,
 *   dimmed: boolean,
 *   standardsConfig: Object,
 *   actuatorGroups: Array
 * }} props
 */
export default function TimingStudyGanttBar({
    step,
    left,
    width,
    rowHeight = 42,
    pxPerMs = 0.3,
    onClick,
    onDragEnd,
    onLinkStart,
    onLinkComplete,
    isLinking,
    isLinkSource,
    isCritical = false,
    dimmed = false,
    standardsConfig = null,
    actuatorGroups = null
}) {
    const [hovered, setHovered] = useState(false);
    const [dragState, setDragState] = useState(null); // { mode: 'move'|'left'|'right', startX, origLeft, origWidth }
    const barRef = useRef(null);

    const isZeroDur = !step.durationMs || step.durationMs <= 0;

    // ── Validación contra perfil de movimiento ──
    const profileWarning = useMemo(() => {
        if (!step.deviceType || !step.durationMs || step.durationMs <= 0) return null;
        const suggested = calculateSuggestedDuration(step, { customStandards: standardsConfig });
        if (suggested === null || suggested === undefined || suggested <= 0) return null;
        if (step.durationMs < suggested) {
            return {
                suggested,
                diff: suggested - step.durationMs,
                message: `⚠️ ${step.durationMs}ms < ${suggested}ms mínimo del perfil. Ajusta la distancia o cambia de actuador.`
            };
        }
        return null;
    }, [step.deviceType, step.durationMs, step.linearDistanceMm, step.angularDistanceDeg, step.motionProfileId, standardsConfig]);

    // --- Drag handlers ---
    const startDrag = useCallback((e, mode) => {
        e.stopPropagation();
        e.preventDefault();
        const startX = e.clientX;
        const origLeft = left;
        const origWidth = width;

        const state = { mode, startX, origLeft, origWidth };
        setDragState(state);

        const handleMouseMove = (moveE) => {
            const dx = moveE.clientX - startX;
            setDragState(prev => ({ ...prev, dx }));
        };

        const handleMouseUp = (upE) => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            const dx = upE.clientX - startX;

            // Desplazamiento en milisegundos
            const dMs = Math.round(dx / pxPerMs);

            let newLeft = origLeft;
            let newWidth = origWidth;

            let newLagMs = step.lagMs || 0;
            let newDurationMs = step.durationMs || 0;

            if (mode === 'move') {
                newLeft = origLeft + dx;
                newLagMs = Math.max(0, (step.lagMs || 0) + dMs);
            } else if (mode === 'left') {
                newLeft = origLeft + dx;
                newWidth = origWidth - dx;
                if (newWidth < 10) {
                    newWidth = 10;
                    newLeft = origLeft + origWidth - 10;
                }
                newLagMs = Math.max(0, (step.lagMs || 0) + dMs);
                newDurationMs = Math.max(0, (step.durationMs || 0) - dMs);
            } else if (mode === 'right') {
                newWidth = origWidth + dx;
                if (newWidth < 10) newWidth = 10;
                newDurationMs = Math.max(0, (step.durationMs || 0) + dMs);
            }

            setDragState(null);

            // Evitar guardar si no hay un cambio real
            const changed = (mode === 'move' && dMs !== 0) ||
                            (mode === 'left' && dMs !== 0) ||
                            (mode === 'right' && dMs !== 0);

            if (changed && onDragEnd) {
                onDragEnd({
                    stepId: step.id,
                    durationMs: newDurationMs,
                    lagMs: newLagMs
                });
            } else if (!changed && mode === 'move') {
                // Si no se movió nada, se interpreta como clic rápido para iniciar enlace
                onLinkStart?.(step.id);
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [left, width, pxPerMs, onDragEnd, step.id, step.lagMs, step.durationMs, onLinkStart]);

    // --- Compute visual position during drag ---
    let displayLeft = left;
    let displayWidth = Math.max(width, isZeroDur ? 12 : 16);

    if (dragState && dragState.dx !== undefined) {
        const dx = dragState.dx;
        if (dragState.mode === 'move') {
            displayLeft = dragState.origLeft + dx;
        } else if (dragState.mode === 'left') {
            displayLeft = dragState.origLeft + dx;
            displayWidth = dragState.origWidth - dx;
            if (displayWidth < 10) {
                displayWidth = 10;
                displayLeft = dragState.origLeft + dragState.origWidth - 10;
            }
        } else if (dragState.mode === 'right') {
            displayWidth = dragState.origWidth + dx;
            if (displayWidth < 10) displayWidth = 10;
        }
    }

    const isDragging = !!dragState;
    const HANDLE_W = 6;
    const barH = rowHeight * 0.55;
    const barTop = rowHeight * 0.22;

    const dimClass = dimmed ? 'opacity-20' : '';
    
    // Asignar colores según la naturaleza del paso
    let barBgBorder = 'bg-slate-800 border-slate-700 text-slate-300';
    let progressBg = 'bg-slate-700';

    if (profileWarning) {
        barBgBorder = 'bg-orange-950/60 border-orange-500/80 border-dashed text-orange-200 shadow-[0_0_14px_rgba(249,115,22,0.35)]';
        progressBg = 'bg-orange-800/40';
    } else if (step.isCriticalPath) {
        barBgBorder = 'bg-red-950/80 border-red-500/80 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.3)]';
        progressBg = 'bg-red-800/60';
    } else if (step.isBottleneck) {
        barBgBorder = 'bg-amber-950/80 border-amber-500/80 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.3)]';
        progressBg = 'bg-amber-800/60';
    } else if (isZeroDur) {
        barBgBorder = 'bg-amber-500/10 border-dashed border-amber-500/50 text-amber-400';
    }

    const barStyle = {
        left: displayLeft,
        width: displayWidth,
        height: barH,
        top: barTop,
        zIndex: isDragging ? 30 : isLinkSource ? 20 : 5,
        cursor: isDragging ? 'grabbing' : isLinking ? 'crosshair' : 'grab',
        userSelect: 'none',
    };

    // Label interno del paso
    const deviceLabel = step.deviceType 
        ? `${step.deviceType}${step.deviceLetter ? ' ' + step.deviceLetter : ''}`
        : '';
    const actionLabel = step.deviceAction ? ` (${step.deviceAction})` : '';
    const innerLabel = deviceLabel 
        ? `${deviceLabel}${actionLabel}`
        : step.taskDescription;

    const tooltip = `[Paso] ${step.taskDescription || 'Sin descripción'}
Estación: ${step.stationLabel || 'S/E'}
Inicio: ${Math.round(step.startTimeMs || 0)} ms
Duración: ${Math.round(step.durationMs || 0)} ms
Fin: ${Math.round(step.finishTimeMs || 0)} ms
Lag/Retardo: ${Math.round(step.lagMs || 0)} ms
Dispositivo: ${step.deviceType || '—'} ${step.deviceLetter || ''}
Acción: ${step.deviceAction || '—'}
Dependencias: ${step.dependencyStepIds?.length > 0 ? step.dependencyStepIds.length : 'Ninguna'}
Ruta Crítica: ${step.isCriticalPath ? 'Sí' : 'No'}
Cuello de Botella: ${step.isBottleneck ? 'Sí' : 'No'}`;

    return (
        <div
            ref={barRef}
            className={`absolute rounded-lg border shadow-md flex items-center justify-between overflow-visible transition-shadow ${
                isDragging ? 'shadow-xl opacity-90 z-30' : 'hover:shadow-lg'
            } ${
                isLinkSource ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900 animate-pulse z-20' : ''
            } ${
                isLinking && !isLinkSource ? 'cursor-crosshair hover:ring-2 hover:ring-emerald-400' : ''
            } ${dimClass} ${barBgBorder}`}
            style={barStyle}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onMouseDown={(e) => {
                if (isLinking) return;
                if (e.target.dataset?.handle) return;
                startDrag(e, 'move');
            }}
            onClick={(e) => {
                e.stopPropagation();
                if (isDragging) return;
                if (isLinking && !isLinkSource) {
                    onLinkComplete?.(step.id);
                    return;
                }
                if (isLinking && isLinkSource) {
                    onLinkStart?.(step.id);
                    return;
                }
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                if (isLinking) return;
                onClick?.(step);
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isLinking && !isLinkSource) {
                    onLinkComplete?.(step.id);
                } else if (!isLinking) {
                    onLinkStart?.(step.id);
                }
            }}
            title={profileWarning ? profileWarning.message : (isLinking && !isLinkSource ? `Conectar como predecesor de esta tarea` : `${innerLabel} — Doble click para editar, Click derecho para conectar dependencias`)}
        >
            {/* Background progress indicator if any */}
            {!isZeroDur && (
                <div className={`absolute inset-0 rounded-lg ${progressBg} opacity-15 pointer-events-none`} />
            )}

            {/* Profile warning icon */}
            {profileWarning && !isZeroDur && (
                <div className="absolute -top-2.5 -right-2.5 z-20 flex items-center gap-0.5" title={profileWarning.message}>
                    <div className="w-5 h-5 rounded-full bg-orange-600 border-2 border-orange-400 flex items-center justify-center animate-pulse shadow-lg shadow-orange-500/40">
                        <AlertTriangle className="w-3 h-3 text-white" />
                    </div>
                </div>
            )}

            {/* Label inside the bar */}
            {!isZeroDur && displayWidth > 45 && (
                <span className={`absolute inset-0 flex items-center px-2 text-[9px] font-black truncate select-none pointer-events-none drop-shadow-md ${profileWarning ? 'text-orange-200' : ''}`}>
                    {profileWarning && <AlertTriangle className="w-3 h-3 mr-1 text-orange-400 shrink-0" />}
                    {innerLabel}
                </span>
            )}

            {/* Icon for Zero Duration / Pulse */}
            {isZeroDur && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                </div>
            )}

            {/* Left resize handle */}
            {!isLinking && !isZeroDur && (
                <div
                    data-handle="left"
                    className={`absolute left-0 top-0 bottom-0 cursor-col-resize transition-opacity rounded-l-lg ${
                        hovered || isDragging ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{ width: HANDLE_W, background: 'rgba(255,255,255,0.2)' }}
                    onMouseDown={(e) => startDrag(e, 'left')}
                />
            )}

            {/* Right resize handle */}
            {!isLinking && !isZeroDur && (
                <div
                    data-handle="right"
                    className={`absolute right-0 top-0 bottom-0 cursor-col-resize transition-opacity rounded-r-lg ${
                        hovered || isDragging ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{ width: HANDLE_W, background: 'rgba(255,255,255,0.2)' }}
                    onMouseDown={(e) => startDrag(e, 'right')}
                />
            )}

            {/* Dependency connection dot / target indicator */}
            {isLinkSource && (
                <div
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-indigo-500 border-2 border-white shadow-xl z-30 flex items-center justify-center"
                    title="Haz clic derecho en otro paso para crear una dependencia"
                >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                </div>
            )}
        </div>
    );
}
