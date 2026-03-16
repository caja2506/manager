/**
 * GanttBar
 * ========
 * Interactive task bar with:
 * - Center drag to move (shifts both dates)
 * - Left/right edge drag to resize (changes start/end dates)
 * - Link connector dot (right edge) to create dependencies
 * - Milestone diamonds, summary bars, and regular bars
 */

import React, { useState, useRef, useCallback } from 'react';

const COLOR_MAP = {
    indigo: 'bg-indigo-500 border-indigo-600',
    blue: 'bg-blue-500 border-blue-600',
    green: 'bg-emerald-500 border-emerald-600',
    amber: 'bg-amber-400 border-amber-500',
    red: 'bg-red-500 border-red-600',
    purple: 'bg-purple-500 border-purple-600',
    teal: 'bg-teal-500 border-teal-600',
    slate: 'bg-slate-500 border-slate-600',
    pink: 'bg-pink-500 border-pink-600',
    orange: 'bg-orange-500 border-orange-600',
    violet: 'bg-violet-500 border-violet-600',
    sky: 'bg-sky-500 border-sky-600',
    emerald: 'bg-emerald-500 border-emerald-600',
    rose: 'bg-rose-500 border-rose-600',
    cyan: 'bg-cyan-500 border-cyan-600',
    fuchsia: 'bg-fuchsia-500 border-fuchsia-600',
};

const PROGRESS_MAP = {
    indigo: 'bg-indigo-700',
    blue: 'bg-blue-700',
    green: 'bg-emerald-700',
    amber: 'bg-amber-600',
    red: 'bg-red-700',
    purple: 'bg-purple-700',
    teal: 'bg-teal-700',
    slate: 'bg-slate-700',
    pink: 'bg-pink-700',
    orange: 'bg-orange-700',
    violet: 'bg-violet-700',
    sky: 'bg-sky-700',
    emerald: 'bg-emerald-700',
    rose: 'bg-rose-700',
    cyan: 'bg-cyan-700',
    fuchsia: 'bg-fuchsia-700',
};

/**
 * @param {{
 *   task: Object,
 *   left: number,
 *   width: number,
 *   color: string,
 *   rowHeight: number,
 *   dayWidth: number,
 *   viewStart: Date,
 *   onClick: (task) => void,
 *   onDragEnd: ({ taskId, newStartDate, newEndDate }) => void,
 *   onLinkStart: (taskId) => void,
 *   isLinking: boolean,
 *   isLinkSource: boolean,
 * }} props
 */
export default function GanttBar({
    task, left, width, color = 'indigo', rowHeight = 42, dayWidth = 96,
    viewStart, onClick, onDragEnd, onLinkStart, onLinkComplete, isLinking, isLinkSource,
}) {
    const [hovered, setHovered] = useState(false);
    const [dragState, setDragState] = useState(null); // { mode: 'move'|'left'|'right', startX, origLeft, origWidth }
    const barRef = useRef(null);

    const barClasses = `${COLOR_MAP[color] || COLOR_MAP.indigo} border`;
    const progressClasses = PROGRESS_MAP[color] || PROGRESS_MAP.indigo;
    const pct = Math.min(Math.max(task.percentComplete || 0, 0), 100);

    // --- Date from pixel offset (local timezone safe) ---
    const toLocalDateStr = useCallback((d) => {
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    }, []);

    const pixelToDate = useCallback((pixelLeft) => {
        const dayOffset = Math.round(pixelLeft / dayWidth);
        const d = new Date(viewStart);
        d.setDate(d.getDate() + dayOffset);
        return toLocalDateStr(d);
    }, [dayWidth, viewStart, toLocalDateStr]);

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

            // Snap to nearest day
            const daySnap = Math.round(dx / dayWidth) * dayWidth;

            let newLeft = origLeft;
            let newWidth = origWidth;

            if (mode === 'move') {
                newLeft = origLeft + daySnap;
            } else if (mode === 'left') {
                newLeft = origLeft + daySnap;
                newWidth = origWidth - daySnap;
                if (newWidth < dayWidth) {
                    newWidth = dayWidth;
                    newLeft = origLeft + origWidth - dayWidth;
                }
            } else if (mode === 'right') {
                newWidth = origWidth + daySnap;
                if (newWidth < dayWidth) newWidth = dayWidth;
            }

            const newStartDate = pixelToDate(newLeft);
            // width → number of days = width/dayWidth, but end date is start + (days - 1)
            const durationDays = Math.max(Math.round(newWidth / dayWidth) - 1, 0);
            const endD = new Date(newStartDate + 'T12:00:00'); // noon to avoid DST issues
            endD.setDate(endD.getDate() + durationDays);
            const newEndDate = toLocalDateStr(endD);

            setDragState(null);

            if (daySnap !== 0 && onDragEnd) {
                onDragEnd({ taskId: task.id, newStartDate, newEndDate });
            } else if (daySnap === 0 && mode === 'move') {
                // No movement = a click → start linking
                onLinkStart?.(task.id);
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [left, width, dayWidth, pixelToDate, onDragEnd, task.id]);

    // --- Compute visual position during drag ---
    let displayLeft = left;
    let displayWidth = Math.max(width, 8);

    if (dragState && dragState.dx !== undefined) {
        const dx = dragState.dx;
        if (dragState.mode === 'move') {
            displayLeft = dragState.origLeft + dx;
        } else if (dragState.mode === 'left') {
            displayLeft = dragState.origLeft + dx;
            displayWidth = dragState.origWidth - dx;
            if (displayWidth < dayWidth) {
                displayWidth = dayWidth;
                displayLeft = dragState.origLeft + dragState.origWidth - dayWidth;
            }
        } else if (dragState.mode === 'right') {
            displayWidth = dragState.origWidth + dx;
            if (displayWidth < dayWidth) displayWidth = dayWidth;
        }
    }

    const isDragging = !!dragState;
    const HANDLE_W = 6;
    const barH = rowHeight * 0.55;
    const barTop = rowHeight * 0.22;

    // --- Milestone ---
    if (task.milestone) {
        const size = 16;
        return (
            <div
                className="absolute flex items-center justify-center cursor-pointer"
                style={{ left: left - size / 2, top: (rowHeight - size) / 2, width: size, height: size, zIndex: 10 }}
                onClick={() => onClick?.(task)}
                title={task.title}
            >
                <div
                    className={`w-3 h-3 rotate-45 ${barClasses} shadow-md`}
                    style={{ boxShadow: hovered ? '0 0 8px rgba(0,0,0,0.4)' : undefined }}
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                />
            </div>
        );
    }

    // --- Regular task bar ---
    return (
        <div
            ref={barRef}
            className={`absolute rounded-md overflow-visible ${barClasses} shadow-lg transition-shadow ${isDragging ? 'shadow-xl opacity-90 z-30' : 'hover:shadow-md'} ${isLinkSource ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900 animate-pulse z-20' : ''} ${isLinking && !isLinkSource ? 'cursor-crosshair hover:ring-2 hover:ring-emerald-400' : ''}`}
            style={{
                left: displayLeft,
                width: Math.max(displayWidth, 8),
                height: barH,
                top: barTop,
                zIndex: isDragging ? 30 : isLinkSource ? 20 : 5,
                cursor: isDragging ? 'grabbing' : isLinking ? 'crosshair' : 'grab',
                userSelect: 'none',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onMouseDown={(e) => {
                // Don't start drag if in linking mode
                if (isLinking) return;
                if (e.target.dataset?.handle) return;
                startDrag(e, 'move');
            }}
            onClick={(e) => {
                e.stopPropagation();
                if (isDragging) return;
                if (isLinking && !isLinkSource) {
                    onLinkComplete?.(task.id);
                    return;
                }
                if (isLinking && isLinkSource) {
                    onLinkStart?.(task.id);
                    return;
                }
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                if (isLinking) return;
                onClick?.(task);
            }}
            title={isLinking && !isLinkSource ? `Click para enlazar con "${task.title}"` : `${task.title} (${pct}%) — Click para enlazar, doble click para editar`}
        >
            {/* Progress fill */}
            {pct > 0 && (
                <div className={`absolute inset-y-0 left-0 ${progressClasses} opacity-60`} style={{ width: `${pct}%` }} />
            )}

            {/* Label */}
            {displayWidth > 60 && (
                <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-white truncate drop-shadow pointer-events-none">
                    {task.title}
                </span>
            )}

            {/* Left resize handle */}
            {!isLinking && (
                <div
                    data-handle="left"
                    className={`absolute left-0 top-0 bottom-0 cursor-col-resize transition-opacity ${hovered || isDragging ? 'opacity-100' : 'opacity-0'}`}
                    style={{ width: HANDLE_W, background: 'rgba(255,255,255,0.3)', borderRadius: '4px 0 0 4px' }}
                    onMouseDown={(e) => startDrag(e, 'left')}
                />
            )}

            {/* Right resize handle */}
            {!isLinking && (
                <div
                    data-handle="right"
                    className={`absolute right-0 top-0 bottom-0 cursor-col-resize transition-opacity ${hovered || isDragging ? 'opacity-100' : 'opacity-0'}`}
                    style={{ width: HANDLE_W, background: 'rgba(255,255,255,0.3)', borderRadius: '0 4px 4px 0' }}
                    onMouseDown={(e) => startDrag(e, 'right')}
                />
            )}

            {/* Link source indicator — only after click */}
            {isLinkSource && (
                <div
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-indigo-500 border-2 border-white shadow-lg z-30 flex items-center justify-center"
                    title="Click en otra tarea para enlazar"
                >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                </div>
            )}
        </div>
    );
}
