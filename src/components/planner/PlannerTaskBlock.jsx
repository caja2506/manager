import React, { useRef, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { X, User, Clock, AlertTriangle } from 'lucide-react';
import { PLANNER_START_HOUR, SLOT_HEIGHT_PX } from './PlannerGrid';

const PRIORITY_STYLES = {
    critical: 'bg-red-500    border-red-700    text-white',
    high:     'bg-amber-500  border-amber-700  text-white',
    medium:   'bg-indigo-500 border-indigo-700 text-white',
    low:      'bg-slate-400  border-slate-600  text-white',
};

/**
 * PlannerTaskBlock — renders a single time block on the planner grid.
 *
 * Three rendering modes based on totalColumns:
 *   1  → NORMAL: full horizontal info
 *   2  → COMPACT: smaller horizontal info
 *   ≥3 → VERTICAL: ALL info rotated 90°, reads bottom→top
 *
 * Data source: enriched plan items. Uses `item.title` and
 * `item.assigneeDisplayName` which come from live task data
 * via enrichPlanItemsWithTasks(). Falls back to legacy snapshot
 * fields if the task is not found (item._taskNotFound).
 */
export default function PlannerTaskBlock({
    item,
    topOffset,
    height,
    widthStyle,
    leftStyle,
    totalColumns = 1,
    isConflict,
    onClick,
    onDelete,
    onResize,
    timerStatus,  // { status: 'active'|'idle'|'overflow', timerId?, elapsedMin?, source? }
}) {
    const blockRef      = useRef(null);
    const resizingRef   = useRef(false);
    const liveHeightRef = useRef(height);

    useEffect(() => { liveHeightRef.current = height; }, [height]);

    // Resolve display values from enriched data
    // (enrichPlanItemsWithTasks already handles fallback to snapshots)
    const displayTitle    = item.title || item.taskTitleSnapshot || '(Sin título)';
    const displayAssignee = item.assigneeDisplayName || item.assignedToName || '';
    const isOrphan        = item._taskNotFound;

    const isDraft = timerStatus?.isDraft;
    const isConfirmed = timerStatus?.isConfirmed;

    const baseStyleClass = isConflict
        ? 'bg-rose-500 border-rose-700 text-white ring-2 ring-rose-300'
        : isOrphan
            ? 'bg-slate-600 border-slate-700 text-white ring-1 ring-amber-500/50'
            : (PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.medium);

    let borderClass = 'border-l-4';
    let opacityStyle = '';
    let styleClass = baseStyleClass;

    if (isDraft) {
        borderClass = 'border-l-4 border-dashed border-amber-500';
        styleClass = 'bg-slate-50/90 dark:bg-slate-900/50 border-slate-250 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 ring-1 ring-amber-500/10';
        opacityStyle = 'border-dashed';
    } else if (isConfirmed) {
        borderClass = 'border-l-4 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]';
    }

    // Timer indicator styles
    const tsStatus = timerStatus?.status || 'idle';
    const timerRingClass = tsStatus === 'active'
        ? 'ring-2 ring-emerald-400/60'
        : tsStatus === 'overflow'
            ? 'ring-2 ring-rose-400/70 animate-pulse'
            : '';

    const isCompact  = totalColumns === 2;
    const isVertical = totalColumns >= 3;

    // ── Drag ───────────────────────────────────────────────────
    const handleDragStart = useCallback(e => {
        e.dataTransfer.setData('text/plain', `move:${item.id}`);
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
    }, [item.id]);

    // ── Resize ─────────────────────────────────────────────────
    const handleResizeMouseDown = useCallback(e => {
        e.stopPropagation();
        e.preventDefault();
        const startY = e.clientY;
        const startH = blockRef.current?.offsetHeight || liveHeightRef.current;
        resizingRef.current = true;

        if (blockRef.current) {
            blockRef.current.style.opacity = '0.85';
            blockRef.current.style.outline = '2px solid rgba(255,255,255,0.5)';
        }

        const onMouseMove = mv => {
            if (!resizingRef.current) return;
            const rawH = startH + (mv.clientY - startY);
            const snap = Math.max(SLOT_HEIGHT_PX / 2,
                Math.round(rawH / (SLOT_HEIGHT_PX / 2)) * (SLOT_HEIGHT_PX / 2));
            liveHeightRef.current = snap;
            if (blockRef.current) {
                blockRef.current.style.height = `${snap}px`;
                const badge = blockRef.current.querySelector('[data-duration]');
                if (badge) badge.textContent = `${(snap / SLOT_HEIGHT_PX).toFixed(1)}h`;
            }
        };

        const onMouseUp = () => {
            if (!resizingRef.current) return;
            resizingRef.current = false;
            if (blockRef.current) {
                blockRef.current.style.opacity = '';
                blockRef.current.style.outline = '';
            }
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup',   onMouseUp);
            if (!item.startDateTime) return;
            const finalH     = liveHeightRef.current;
            const deltaHours = finalH / SLOT_HEIGHT_PX;
            const startDt    = parseISO(item.startDateTime);
            const newEndDt   = new Date(startDt.getTime() + deltaHours * 3_600_000);
            onResize && onResize(newEndDt.toISOString());
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup',   onMouseUp);
    }, [item.startDateTime, onResize]);

    // ── Time label ─────────────────────────────────────────────
    let timeLabel = '';
    try {
        const s = format(parseISO(item.startDateTime), 'HH:mm');
        const e = format(parseISO(item.endDateTime),   'HH:mm');
        timeLabel = `${s}–${e}`;
    } catch { /* skip */ }

    // ── Position style ─────────────────────────────────────────
    const wrapperStyle = {
        top:    topOffset,
        height,
        minHeight: 28,
        ...(widthStyle
            ? { left: leftStyle, width: widthStyle }
            : { left: '4px', right: '4px' }
        )
    };

    return (
        <div
            ref={blockRef}
            draggable
            onDragStart={handleDragStart}
            className={`absolute rounded-xl ${borderClass} ${styleClass} ${timerRingClass} shadow-md cursor-grab active:cursor-grabbing overflow-hidden z-20 group hover:shadow-xl hover:z-30 transition-shadow ${opacityStyle}`}
            style={wrapperStyle}
            onClick={e => { if (!resizingRef.current) { e.stopPropagation(); onClick && onClick(); } }}
        >
            {/* ── Timer status indicator dot ── */}
            {tsStatus === 'active' && (
                <div className="absolute top-1.5 right-1.5 z-30 flex items-center gap-1" title={`Timer activo: ${timerStatus.elapsedMin || 0} min`}>
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                </div>
            )}
            {tsStatus === 'overflow' && (
                <div className="absolute top-1.5 right-1.5 z-30 flex items-center gap-1" title={`Timer desbordado: ${timerStatus.elapsedMin || 0} min`}>
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                    </span>
                </div>
            )}

            {/* ══════════════════════════════════════════════════
                VERTICAL MODE (3+ concurrent blocks)
                All content uses writing-mode: vertical-lr + rotate(180deg)
                so it reads from bottom → top (natural for a narrow column)
            ══════════════════════════════════════════════════ */}
            {isVertical ? (
                <div className="relative flex h-full w-full overflow-hidden">
                    {/* Delete button — pinned absolute top-right */}
                    <button
                        onClick={e => { e.stopPropagation(); onDelete && onDelete(); }}
                        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-white/80 hover:text-white z-10"
                    ><X className="w-2.5 h-2.5" /></button>

                    {/* Orphan warning icon */}
                    {isOrphan && (
                        <div className="absolute top-0.5 left-0.5 z-10" title="Tarea no encontrada">
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                        </div>
                    )}

                    {/* LEFT 60% — task title (vertical, reads bottom→top) */}
                    <div
                        className="flex items-center justify-center overflow-hidden py-2 pl-1.5 pr-0.5"
                        style={{
                            flex:            '6 0 0',
                            writingMode:     'vertical-lr',
                            transform:       'rotate(180deg)',
                            textOrientation: 'mixed',
                        }}
                    >
                        <span
                            className={`font-black text-[11px] leading-tight ${isDraft ? 'text-slate-800 dark:text-slate-200' : 'text-white'}`}
                            style={{
                                overflow:        'hidden',
                                display:         '-webkit-box',
                                WebkitLineClamp: 4,
                                WebkitBoxOrient: 'vertical',
                                wordBreak:       'break-word',
                            }}
                        >
                            {isConfirmed && '✓ '}
                            {isDraft && '⏱️ '}
                            {displayTitle}
                        </span>
                    </div>

                    {/* RIGHT 40% — assignee + hours (vertical, reads bottom→top) */}
                    <div
                        className="flex flex-col items-center justify-center gap-1 overflow-hidden py-2 pr-1 pl-0.5"
                        style={{
                            flex:            '4 0 0',
                            writingMode:     'vertical-lr',
                            transform:       'rotate(180deg)',
                            textOrientation: 'mixed',
                        }}
                    >
                        {item.plannedHours > 0 && (
                            <span data-duration className={`text-[10px] font-black leading-none whitespace-nowrap ${isDraft ? 'text-slate-800 dark:text-slate-200' : 'text-white'}`}>
                                {item.plannedHours.toFixed(1)}h
                            </span>
                        )}
                        {displayAssignee && (
                            <span
                                className={`text-[9px] font-semibold leading-none ${isDraft ? 'text-slate-600 dark:text-slate-400' : 'text-white/80'}`}
                                style={{
                                    overflow:        'hidden',
                                    display:         '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    wordBreak:       'break-word',
                                }}
                            >
                                {displayAssignee.split(' ')[0]}
                            </span>
                        )}
                    </div>
                </div>


            ) : isCompact ? (
            /* ══════════════════════════════════════════════════
                COMPACT MODE (2 concurrent blocks)
            ══════════════════════════════════════════════════ */
                <div className={`px-1.5 py-1 flex flex-col h-full overflow-hidden ${isDraft ? 'text-slate-800 dark:text-slate-200' : 'text-white'}`}>
                    <div className="flex items-start justify-between gap-0.5">
                        <p className="text-[10px] font-black leading-tight line-clamp-2 flex-1 break-words">
                            {isOrphan && <AlertTriangle className="w-2.5 h-2.5 text-amber-400 inline mr-0.5" />}
                            {isConfirmed && <span className="text-emerald-450 font-black mr-1" title="Confirmado">✓</span>}
                            {isDraft && <span className="text-amber-500 font-bold mr-1" title="Borrador">⏱️</span>}
                            {displayTitle}
                        </p>
                        <button
                            onClick={e => { e.stopPropagation(); onDelete && onDelete(); }}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${isDraft ? 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100' : 'text-white/70 hover:text-white'}`}
                        ><X className="w-2.5 h-2.5" /></button>
                    </div>

                    {height > 60 && (
                        <div className="mt-auto space-y-0.5">
                            {displayAssignee && (
                                <div className={`flex items-center gap-0.5 text-[8px] font-bold truncate ${isDraft ? 'text-slate-600 dark:text-slate-400' : 'text-white/80'}`}>
                                    <User className="w-2 h-2 shrink-0" />
                                    <span className="truncate">{displayAssignee}</span>
                                </div>
                            )}
                            <div className={`text-[8px] font-bold ${isDraft ? 'text-slate-500 dark:text-slate-500' : 'text-white/70'}`}>{timeLabel}</div>
                            <span data-duration className={`text-[8px] font-black ${isDraft ? 'text-slate-700 dark:text-slate-300' : 'text-white/90'}`}>
                                {item.plannedHours?.toFixed(1)}h
                            </span>
                        </div>
                    )}
                </div>

            ) : (
            /* ══════════════════════════════════════════════════
                NORMAL MODE (single column, full width)
            ══════════════════════════════════════════════════ */
                <div className={`px-2 py-1.5 flex flex-col h-full overflow-hidden ${isDraft ? 'text-slate-800 dark:text-slate-200' : 'text-white'}`}>
                    <div className="flex items-start justify-between gap-1">
                        <p className="text-[11px] font-black leading-tight line-clamp-2 flex-1">
                            {isOrphan && <AlertTriangle className="w-3 h-3 text-amber-400 inline mr-0.5" />}
                            {isConfirmed && <span className="text-emerald-450 font-black mr-1" title="Confirmado">✓</span>}
                            {isDraft && <span className="text-amber-500 font-bold mr-1" title="Borrador">⏱️</span>}
                            {displayTitle}
                        </p>
                        <button
                            onClick={e => { e.stopPropagation(); onDelete && onDelete(); }}
                            className={`opacity-0 group-hover:opacity-100 ml-1 transition-opacity shrink-0 mt-0.5 ${isDraft ? 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100' : 'text-white/70 hover:text-white'}`}
                        ><X className="w-3 h-3" /></button>
                    </div>

                    {height > 50 && (
                        <div className="mt-auto space-y-0.5">
                            {displayAssignee && (
                                <div className={`flex items-center gap-1 text-[9px] font-bold truncate ${isDraft ? 'text-slate-650 dark:text-slate-400' : 'text-white/80'}`}>
                                    <User className="w-2.5 h-2.5 shrink-0" />
                                    <span className="truncate">{displayAssignee}</span>
                                </div>
                            )}
                            {timeLabel && (
                                <div className={`text-[9px] font-bold ${isDraft ? 'text-slate-500 dark:text-slate-500' : 'text-white/70'}`}>{timeLabel}</div>
                            )}
                            {item.plannedHours > 0 && (
                                <div data-duration className={`text-[9px] font-black ${isDraft ? 'text-slate-700 dark:text-slate-300' : 'text-white/90'}`}>
                                    {item.plannedHours.toFixed(1)}h
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Resize handle — all modes */}
            <div
                onMouseDown={handleResizeMouseDown}
                className="absolute bottom-0 left-0 right-0 h-3 flex items-center justify-center cursor-s-resize select-none opacity-0 group-hover:opacity-100 transition-opacity"
                title="Arrastra para cambiar duración"
            >
                <div className="w-6 h-1 rounded-full bg-white/60" />
            </div>
        </div>
    );
}
