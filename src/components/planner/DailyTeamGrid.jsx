import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { parseISO } from 'date-fns';
import { MousePointerClick } from 'lucide-react';
import PlannerTaskBlock from './PlannerTaskBlock';
import { PLANNER_START_HOUR, PLANNER_END_HOUR, SLOT_HEIGHT_PX } from './PlannerGrid';

// ── Break time bands (same as PlannerGrid) ──
const TIME_BANDS = [
    { id: 'desayuno', label: '🍳 Desayuno', start: 8,    end: 8.5,  bg: 'rgba(251,191,36,0.35)', border: 'rgba(245,158,11,0.65)', text: '#fcd34d' },
    { id: 'almuerzo', label: '🍽 Almuerzo', start: 12,   end: 13,   bg: 'rgba(52,211,153,0.35)',  border: 'rgba(16,185,129,0.60)',  text: '#fde68a' },
    { id: 'cafe',     label: '☕ Café',      start: 15.5, end: 16,   bg: 'rgba(249,115,22,0.35)',  border: 'rgba(234,88,12,0.60)',   text: '#fdba74' },
];

const DEFAULT_SCROLL_HOUR = 9;

// ── Role config for column header ──
const ROLE_ICONS = {
    manager:    { emoji: '👑', color: '#8b5cf6' },
    team_lead:  { emoji: '🎯', color: '#f59e0b' },
    engineer:   { emoji: '⚙️', color: '#6366f1' },
    technician: { emoji: '🔧', color: '#10b981' },
};

// ── Calendar layout algorithm (same as PlannerGrid) ──
function computeColumnLayout(items) {
    if (!items.length) return [];
    const sorted = items
        .map(item => ({
            ...item,
            _start: item.startDateTime ? parseISO(item.startDateTime) : new Date(),
            _end:   item.endDateTime   ? parseISO(item.endDateTime)   : new Date(),
        }))
        .sort((a, b) => a._start - b._start);

    const columns = [];
    const layoutItems = sorted.map(item => {
        let col = -1;
        for (let i = 0; i < columns.length; i++) {
            if (item._start >= columns[i]) { col = i; break; }
        }
        if (col === -1) { col = columns.length; columns.push(item._end); }
        else            { columns[col] = item._end; }
        return { ...item, _col: col };
    });

    return layoutItems.map(item => {
        const concurrent = layoutItems.filter(other =>
            other._start < item._end && other._end > item._start
        );
        const maxCols = Math.max(...concurrent.map(o => o._col)) + 1;
        return { ...item, columnIndex: item._col, totalColumns: maxCols };
    });
}

/**
 * DailyTeamGrid — team-member columns × hour rows visual scheduler.
 * Same concept as PlannerGrid but columns = team members instead of days.
 */
export default function DailyTeamGrid({
    members,         // array of { uid, displayName, teamRole }
    planItems,       // plan items for the selected day only
    dateStr,         // 'yyyy-MM-dd' of the selected day
    conflictIds,
    onDropTask,
    onBlockMove,
    onBlockResize,
    onBlockClick,
    onBlockDelete,
    placingTask,
    onPlacementComplete,
    onMemberClick,
    activeMemberFilter,
    allMemberUids,       // all team member UIDs (not just visible), to distinguish truly unassigned
}) {
    const totalHours   = PLANNER_END_HOUR - PLANNER_START_HOUR;
    const scrollBodyRef = useRef(null);
    const [hoverSlot, setHoverSlot] = useState(null);

    // Scroll to default hour on mount
    useEffect(() => {
        if (scrollBodyRef.current) {
            scrollBodyRef.current.scrollTop = (DEFAULT_SCROLL_HOUR - PLANNER_START_HOUR) * SLOT_HEIGHT_PX;
        }
    }, []);

    const effectiveHoverSlot = placingTask ? hoverSlot : null;

    useEffect(() => {
        if (!placingTask) return;
        const handler = e => { if (e.key === 'Escape') onPlacementComplete?.(null); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [placingTask, onPlacementComplete]);

    function getTopOffset(dateTimeStr) {
        if (!dateTimeStr) return 0;
        try {
            const dt = parseISO(dateTimeStr);
            const hours = dt.getHours() + dt.getMinutes() / 60;
            return Math.max(0, hours - PLANNER_START_HOUR) * SLOT_HEIGHT_PX;
        } catch { return 0; }
    }

    function getBlockHeight(startStr, endStr) {
        if (!startStr || !endStr) return SLOT_HEIGHT_PX;
        try {
            const diffH = (parseISO(endStr) - parseISO(startStr)) / 3_600_000;
            return Math.max(SLOT_HEIGHT_PX / 2, diffH * SLOT_HEIGHT_PX);
        } catch { return SLOT_HEIGHT_PX; }
    }

    function snapToHour(relY) {
        const rawHours = PLANNER_START_HOUR + relY / SLOT_HEIGHT_PX;
        const snapped  = Math.floor(rawHours * 2) / 2;
        return { hour: Math.floor(snapped), minute: (snapped % 1) * 60 };
    }

    const handleDragOver = useCallback(e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    function handleDrop(e, memberUid) {
        e.preventDefault();
        const raw = e.dataTransfer.getData('text/plain');
        if (!raw) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const relY = Math.max(0, e.clientY - rect.top);
        const { hour, minute } = snapToHour(relY);

        if (raw.startsWith('move:')) {
            const itemId = raw.replace('move:', '');
            onBlockMove?.({ itemId, date: dateStr, hour, minute, assignedTo: memberUid });
        } else {
            onDropTask?.({ taskId: raw, date: dateStr, hour, minute, assignedTo: memberUid });
        }
    }

    function handlePlacementMouseMove(e, memberUid, memberIndex) {
        if (!placingTask) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const relY = Math.max(0, e.clientY - rect.top);
        const { hour, minute } = snapToHour(relY);
        const top = (hour - PLANNER_START_HOUR + minute / 60) * SLOT_HEIGHT_PX;
        setHoverSlot({ memberUid, hour, minute, top, memberIndex });
    }

    function handlePlacementClick(e, memberUid) {
        if (!placingTask) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const relY = Math.max(0, e.clientY - rect.top);
        const { hour, minute } = snapToHour(relY);
        onPlacementComplete?.({ taskId: placingTask.id, date: dateStr, hour, minute, assignedTo: memberUid });
    }

    const hours = Array.from({ length: totalHours }, (_, i) => PLANNER_START_HOUR + i);

    // Compute per-member layout
    const memberLayouts = useMemo(() => {
        const layouts = members.map(member => {
            const rawItems    = planItems.filter(p => p.assignedTo === member.uid);
            const layoutItems = computeColumnLayout(rawItems);
            const maxSim      = layoutItems.length ? Math.max(...layoutItems.map(i => i.totalColumns)) : 1;
            const dynMinWidth = Math.max(140, maxSim * 80);
            return { member, layoutItems, dynMinWidth };
        });

        // Unassigned items — only truly unassigned (not assigned to any known team member)
        const knownUids = allMemberUids ? new Set(allMemberUids) : new Set(members.map(m => m.uid));
        const unassignedItems = planItems.filter(p => !p.assignedTo || !knownUids.has(p.assignedTo));
        if (unassignedItems.length > 0) {
            const layoutItems = computeColumnLayout(unassignedItems);
            layouts.push({
                member: { uid: '__unassigned__', displayName: 'Sin Asignar', teamRole: null },
                layoutItems,
                dynMinWidth: 140,
            });
        }
        return layouts;
    }, [members, planItems, allMemberUids]);

    const ghostHeight = placingTask
        ? Math.min(2, placingTask.estimatedHours || 1) * SLOT_HEIGHT_PX
        : SLOT_HEIGHT_PX;

    return (
        <div className="flex flex-col h-full">

            {/* Placement mode banner */}
            {placingTask && (
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 border-b border-emerald-500/30 shrink-0 z-20">
                    <MousePointerClick className="w-4 h-4 text-emerald-400 animate-bounce" />
                    <span className="text-xs font-black text-emerald-300">
                        Haz clic en la columna del miembro para colocar: <span className="text-emerald-200">{placingTask.title}</span>
                    </span>
                    <span className="text-[10px] text-emerald-400/70 ml-auto font-medium">ESC para cancelar</span>
                </div>
            )}

            {/* Scrollable body — header, grid, and footer all scroll horizontally together */}
            <div ref={scrollBodyRef} className="flex-1 overflow-auto">
                <div className="inline-flex flex-col" style={{ minWidth: '100%' }}>

                    {/* Sticky header row */}
                    <div className="flex shrink-0 border-b border-slate-700 bg-slate-900 z-20 sticky top-0" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        <div className="w-16 shrink-0 border-r border-slate-800 bg-slate-900" />
                        <div className="flex flex-1 min-w-0">
                            {memberLayouts.map(({ member, dynMinWidth }) => {
                                const roleCfg = ROLE_ICONS[member.teamRole] || ROLE_ICONS.engineer;
                                const initials = (member.displayName || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                                const isFiltered = activeMemberFilter === member.uid;
                                return (
                                    <div
                                        key={member.uid}
                                        onClick={() => onMemberClick?.(member.uid)}
                                        className={`border-r border-slate-800 last:border-r-0 flex flex-col items-center justify-center py-2.5 px-1 transition-all bg-slate-900 ${
                                            onMemberClick ? 'cursor-pointer hover:bg-slate-800' : ''
                                        } ${isFiltered ? 'ring-2 ring-indigo-500/60 bg-indigo-950/40' : ''}`}
                                        style={{ flex: `1 0 ${dynMinWidth}px` }}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white mb-1 transition-all ${isFiltered ? 'scale-110' : ''}`}
                                            style={{ background: `${roleCfg.color}30`, border: `2px solid ${isFiltered ? roleCfg.color : roleCfg.color + '50'}` }}>
                                            {initials}
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-200 truncate max-w-full px-1">
                                            {member.displayName?.split(' ')[0] || member.uid}
                                        </span>
                                        <span className="text-[9px] font-medium" style={{ color: roleCfg.color }}>
                                            {roleCfg.emoji} {member.teamRole?.replace('_', ' ') || ''}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Grid body */}
                    <div className="flex">
                        {/* Time ruler — sticky left */}
                        <div className="w-16 shrink-0 border-r border-slate-800 bg-slate-800 sticky left-0 z-10">
                            {hours.map(h => (
                                <div key={h} className="border-b border-slate-800 flex items-start justify-end pr-2 pt-1" style={{ height: SLOT_HEIGHT_PX }}>
                                    <span className="text-[10px] font-black text-slate-400 leading-none">
                                        {`${String(h).padStart(2, '0')}:00`}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Member columns */}
                        <div className="flex flex-1 min-w-0" style={{ minHeight: totalHours * SLOT_HEIGHT_PX }}>
                            {memberLayouts.map(({ member, layoutItems, dynMinWidth }, memberIndex) => (
                                <div
                                    key={member.uid}
                                    className="flex flex-col border-r border-slate-800 last:border-r-0"
                                    style={{ flex: `1 0 ${dynMinWidth}px` }}
                                >
                                    <div
                                        className={`relative ${placingTask ? 'cursor-crosshair' : ''}`}
                                        style={{ height: totalHours * SLOT_HEIGHT_PX }}
                                        onDragOver={handleDragOver}
                                        onDrop={e => handleDrop(e, member.uid)}
                                        onMouseMove={e => handlePlacementMouseMove(e, member.uid, memberIndex)}
                                        onMouseLeave={() => setHoverSlot(null)}
                                        onClick={e => { if (placingTask) handlePlacementClick(e, member.uid); }}
                                    >
                                        {/* Hour grid lines */}
                                        {hours.map(h => (
                                            <React.Fragment key={h}>
                                                <div className="absolute left-0 right-0 border-t border-slate-800"
                                                    style={{ top: (h - PLANNER_START_HOUR) * SLOT_HEIGHT_PX }} />
                                                <div className="absolute left-0 right-0 border-t border-dashed border-slate-800/70"
                                                    style={{ top: (h - PLANNER_START_HOUR) * SLOT_HEIGHT_PX + SLOT_HEIGHT_PX / 2 }} />
                                            </React.Fragment>
                                        ))}

                                        {/* Time bands */}
                                        {TIME_BANDS.map(band => {
                                            const top    = (band.start - PLANNER_START_HOUR) * SLOT_HEIGHT_PX;
                                            const height = (band.end - band.start) * SLOT_HEIGHT_PX;
                                            return (
                                                <div key={band.id}
                                                    className="absolute left-0 right-0 pointer-events-none flex items-center justify-center overflow-hidden"
                                                    style={{ top, height, zIndex: 25, background: band.bg, borderTop: `1.5px dashed ${band.border}`, borderBottom: `1.5px dashed ${band.border}` }}>
                                                    <span className="text-[9px] font-black uppercase tracking-[0.18em] select-none whitespace-nowrap"
                                                        style={{ color: band.text, opacity: 0.75 }}>
                                                        {band.label}
                                                    </span>
                                                </div>
                                            );
                                        })}

                                        {/* Ghost preview */}
                                        {placingTask && effectiveHoverSlot && effectiveHoverSlot.memberUid === member.uid && (
                                            <div
                                                className="absolute left-1 right-1 rounded-xl border-2 border-dashed border-emerald-400/60 bg-emerald-500/15 pointer-events-none flex flex-col items-center justify-center gap-0.5 z-15 transition-all duration-100"
                                                style={{ top: effectiveHoverSlot.top, height: ghostHeight }}>
                                                <MousePointerClick className="w-4 h-4 text-emerald-400" />
                                                <span className="text-[10px] font-black text-emerald-300 truncate px-2 max-w-full">{placingTask.title}</span>
                                                <span className="text-[9px] font-bold text-emerald-400/80">
                                                    {`${String(effectiveHoverSlot.hour).padStart(2, '0')}:${String(effectiveHoverSlot.minute).padStart(2, '0')}`}
                                                </span>
                                            </div>
                                        )}

                                        {/* Placement highlight */}
                                        {placingTask && (
                                            <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none z-1" />
                                        )}

                                        {/* Task blocks */}
                                        {layoutItems.map(item => {
                                            const { totalColumns, columnIndex } = item;
                                            const GAP_PX = 3;
                                            const colWidth = `calc(${100 / totalColumns}% - ${GAP_PX}px)`;
                                            const colLeft  = `calc(${(columnIndex / totalColumns) * 100}% + ${GAP_PX / 2}px)`;
                                            return (
                                                <PlannerTaskBlock
                                                    key={item.id}
                                                    item={item}
                                                    topOffset={getTopOffset(item.startDateTime)}
                                                    height={getBlockHeight(item.startDateTime, item.endDateTime)}
                                                    widthStyle={colWidth}
                                                    leftStyle={colLeft}
                                                    totalColumns={totalColumns}
                                                    isConflict={conflictIds?.has(item.id)}
                                                    onClick={() => onBlockClick?.(item)}
                                                    onDelete={() => onBlockDelete?.(item.id)}
                                                    onResize={newEnd => onBlockResize?.(item.id, newEnd)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer: hours per member summary */}
            <div className="flex shrink-0 border-t border-slate-700 bg-slate-900/80">
                <div className="w-16 shrink-0 border-r border-slate-800 flex items-center justify-end pr-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase">Total</span>
                </div>
                <div className="flex flex-1 min-w-0">
                    {memberLayouts.map(({ member, layoutItems, dynMinWidth }) => {
                        const totalH = layoutItems.reduce((s, i) => s + (i.plannedHours || 0), 0);
                        const overloaded = totalH > 8;
                        return (
                            <div
                                key={member.uid}
                                className="border-r border-slate-800 last:border-r-0 flex items-center justify-center py-2"
                                style={{ flex: `1 0 ${dynMinWidth}px` }}
                            >
                                <span className={`text-sm font-black ${overloaded ? 'text-rose-400' : totalH > 0 ? 'text-indigo-400' : 'text-slate-600'}`}>
                                    {totalH.toFixed(1)}h
                                </span>
                                {overloaded && <span className="text-[9px] text-rose-400 ml-1 font-bold">⚠️</span>}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
