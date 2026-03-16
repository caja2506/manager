/**
 * GanttGrid
 * =========
 * Renders tasks grouped by task type, with collapsible group headers.
 * Supports: drag-to-resize/move bars, dependency linking, dependency arrows.
 *
 * Props:
 *   tasks, dependencies, viewMode, viewStart, taskTypes, users,
 *   onTaskClick, onBarDragEnd, onLinkCreated, onDeleteDependency
 */

import React, { useRef, useMemo, useState, useCallback } from 'react';
import GanttBar from './GanttBar';
import DependencyArrows from './DependencyArrows';
import {
    ChevronDown, ChevronRight, Plus, Ban, Circle, Play, CheckCircle2,
    Clock, PanelLeftOpen, PanelLeftClose, CheckCircle, AlertTriangle, Link2,
} from 'lucide-react';

// ---- Layout constants ----
const ROW_HEIGHT = 42;
const GROUP_HEADER_HEIGHT = 32;
const LEFT_PANEL_W = 340;
const DAY_WIDTH_WEEKLY = 96;
const DAY_WIDTH_MONTHLY = 32;

// Status icons
const STATUS_ICONS = {
    backlog: <Circle className="w-3 h-3 text-slate-400" />,
    pending: <Clock className="w-3 h-3 text-red-400" />,
    in_progress: <Clock className="w-3 h-3 text-amber-400" />,
    validation: <AlertTriangle className="w-3 h-3 text-purple-400" />,
    completed: <CheckCircle className="w-3 h-3 text-emerald-400" />,
    blocked: <Ban className="w-3 h-3 text-red-500" />,
    cancelled: <Ban className="w-3 h-3 text-slate-500" />,
};

const GROUP_COLORS = ['indigo', 'violet', 'sky', 'emerald', 'amber', 'rose', 'cyan', 'fuchsia'];

function toMidnight(dateOrStr) {
    // When parsing "YYYY-MM-DD" strings, new Date() treats them as UTC.
    // In negative UTC offsets (e.g. CST/-6), this shifts the date back by 1 day.
    // Fix: append T12:00:00 so it's parsed as local noon — safe from both UTC shift and DST.
    let d;
    if (typeof dateOrStr === 'string') {
        d = new Date(dateOrStr.length === 10 ? dateOrStr + 'T12:00:00' : dateOrStr);
    } else {
        d = new Date(dateOrStr);
    }
    d.setHours(0, 0, 0, 0);
    return d;
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function daysBetween(a, b) { return Math.round((toMidnight(b) - toMidnight(a)) / (24 * 60 * 60 * 1000)); }

export default function GanttGrid({
    tasks, dependencies, viewMode, viewStart, taskTypes, users,
    placingTask, onPlacementComplete, onStartPlacement,
    onTaskClick, onBarDragEnd, onLinkCreated, onDeleteDependency,
}) {
    const timelineRef = useRef(null);
    const dayWidth = viewMode === 'weekly' ? DAY_WIDTH_WEEKLY : DAY_WIDTH_MONTHLY;

    // Collapsed groups
    const [collapsedGroups, setCollapsedGroups] = useState(new Set());
    const [leftPanelOpen, setLeftPanelOpen] = useState(false);
    const toggleGroup = (id) => setCollapsedGroups(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    // Link mode (2-click: click source bar, then click target bar)
    const [linkSource, setLinkSource] = useState(null);

    const handleLinkStart = useCallback((taskId) => {
        // Toggle: clicking same bar cancels linking
        setLinkSource(prev => prev === taskId ? null : taskId);
    }, []);

    // ESC to cancel link mode
    React.useEffect(() => {
        if (!linkSource) return;
        const handleEsc = (e) => { if (e.key === 'Escape') setLinkSource(null); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [linkSource]);

    const handleTimelineMouseMove = useCallback(() => { }, []);
    const handleTimelineMouseUp = useCallback(() => { }, []);

    // Placement hover preview
    const [hoverDayIndex, setHoverDayIndex] = useState(-1);

    // Date columns
    const numDays = viewMode === 'weekly' ? 7 : 35;
    const dateCols = useMemo(() => {
        const cols = [];
        for (let i = 0; i < numDays; i++) cols.push(addDays(viewStart, i));
        return cols;
    }, [viewStart, numDays]);
    const totalTimelineWidth = numDays * dayWidth;

    // Maps
    const taskTypeMap = useMemo(() => {
        const m = new Map();
        (taskTypes || []).forEach(tt => m.set(tt.id, tt));
        return m;
    }, [taskTypes]);
    const userMap = useMemo(() => {
        const m = new Map();
        (users || []).forEach(u => m.set(u.id, u));
        return m;
    }, [users]);
    function getTaskColor(task) {
        return taskTypeMap.get(task.taskTypeId)?.color || 'indigo';
    }

    // Group tasks by type
    const groups = useMemo(() => {
        const grouped = new Map();
        const sorted = [...tasks].sort((a, b) => {
            const aD = a.plannedStartDate ? 0 : 1;
            const bD = b.plannedStartDate ? 0 : 1;
            if (aD !== bD) return aD - bD;
            if (a.plannedStartDate && b.plannedStartDate) return new Date(a.plannedStartDate) - new Date(b.plannedStartDate);
            return (a.title || '').localeCompare(b.title || '');
        });
        sorted.forEach(task => {
            const typeId = task.taskTypeId || '__general__';
            if (!grouped.has(typeId)) grouped.set(typeId, []);
            grouped.get(typeId).push(task);
        });
        return [...grouped.entries()]
            .sort((a, b) => {
                if (a[0] === '__general__') return 1;
                if (b[0] === '__general__') return -1;
                return (taskTypeMap.get(a[0])?.name || '').localeCompare(taskTypeMap.get(b[0])?.name || '');
            })
            .map(([typeId, typeTasks], i) => {
                const info = taskTypeMap.get(typeId);
                return {
                    id: typeId,
                    name: info?.name || 'General',
                    color: info?.color || GROUP_COLORS[i % GROUP_COLORS.length],
                    tasks: typeTasks,
                    count: typeTasks.length,
                };
            });
    }, [tasks, taskTypeMap]);

    // Flat rows
    const rows = useMemo(() => {
        const list = [];
        groups.forEach(g => {
            list.push({ type: 'group', group: g });
            if (!collapsedGroups.has(g.id)) {
                g.tasks.forEach(t => list.push({ type: 'task', task: t, groupColor: g.color }));
            }
        });
        return list;
    }, [groups, collapsedGroups]);

    const totalGridHeight = rows.reduce((h, r) => h + (r.type === 'group' ? GROUP_HEADER_HEIGHT : ROW_HEIGHT), 0);

    // Bar geometry
    function getBarGeometry(task) {
        if (!task.plannedStartDate) return null;
        const start = toMidnight(task.plannedStartDate);
        const end = task.plannedEndDate ? toMidnight(task.plannedEndDate) : start;
        return {
            left: daysBetween(viewStart, start) * dayWidth,
            width: Math.max(daysBetween(start, end) + 1, 1) * dayWidth,
        };
    }

    // TaskRowMap for arrows
    const taskRowMap = useMemo(() => {
        const map = new Map();
        let y = 0;
        rows.forEach(row => {
            if (row.type === 'group') { y += GROUP_HEADER_HEIGHT; return; }
            const geo = getBarGeometry(row.task);
            if (geo) map.set(row.task.id, { top: y, left: geo.left, width: geo.width });
            y += ROW_HEIGHT;
        });
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, viewStart, dayWidth]);

    // Today
    const todayOffset = daysBetween(viewStart, new Date()) * dayWidth;
    const showToday = todayOffset >= 0 && todayOffset <= totalTimelineWidth;

    // Monthly week groups
    const weekGroups = useMemo(() => {
        if (viewMode !== 'monthly') return [];
        const grps = []; let cur = null;
        dateCols.forEach((d, i) => {
            const wn = getISOWeek(d);
            if (!cur || cur.week !== wn) { cur = { week: wn, start: i, count: 1, label: `Sem ${wn}` }; grps.push(cur); }
            else cur.count++;
        });
        return grps;
    }, [dateCols, viewMode]);

    const headerHeight = viewMode === 'monthly' ? 64 : 48;

    // Handle click on a bar to link (when in link mode)
    const handleBarClickForLink = useCallback((targetTaskId) => {
        if (linkSource && linkSource !== targetTaskId) {
            onLinkCreated?.(linkSource, targetTaskId);
            setLinkSource(null);
        }
    }, [linkSource, onLinkCreated]);

    // --- Fixed Y position for placingTask (locked to its row) ---
    const placingTaskRowY = useMemo(() => {
        if (!placingTask) return 0;
        let y = 0;
        for (const row of rows) {
            if (row.type === 'group') { y += GROUP_HEADER_HEIGHT; continue; }
            if (row.task.id === placingTask.id) {
                return y + (ROW_HEIGHT - (ROW_HEIGHT * 0.55)) / 2;
            }
            y += ROW_HEIGHT;
        }
        return 0;
    }, [placingTask, rows]);

    return (
        <div className="flex flex-1 overflow-hidden rounded-xl border border-slate-700/50 relative">
            {/* Mobile left panel toggle */}
            <button
                onClick={() => setLeftPanelOpen(o => !o)}
                className="md:hidden fixed bottom-20 left-3 z-50 w-10 h-10 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center active:scale-90 transition-all"
                title={leftPanelOpen ? 'Cerrar panel' : 'Lista de tareas'}
            >
                {leftPanelOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>

            {/* Mobile overlay backdrop */}
            {leftPanelOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setLeftPanelOpen(false)}
                />
            )}

            {/* ---- LEFT PANEL ---- */}
            <div className={`${leftPanelOpen ? 'translate-x-0' : '-translate-x-full'
                } md:translate-x-0 fixed md:relative z-40 md:z-auto h-full transition-transform duration-200 ease-in-out flex-shrink-0 bg-slate-900 border-r border-slate-700/50 overflow-y-auto`} style={{ width: LEFT_PANEL_W }}>
                <div className="sticky top-0 z-20 bg-slate-800 border-b border-slate-700/50 px-4 flex items-center" style={{ height: headerHeight }}>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Tarea por tipo</span>
                </div>
                {rows.map((row) => {
                    if (row.type === 'group') {
                        const g = row.group;
                        const collapsed = collapsedGroups.has(g.id);
                        return (
                            <div key={`g-${g.id}`} className="flex items-center gap-2 px-3 border-b border-slate-700/40 cursor-pointer hover:bg-slate-800/60 transition-colors select-none"
                                style={{ height: GROUP_HEADER_HEIGHT }} onClick={() => toggleGroup(g.id)}>
                                {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                                <div className={`w-2 h-2 rounded-full bg-${g.color}-500`} />
                                <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex-1 truncate">{g.name}</span>
                                <span className="text-[10px] font-bold text-slate-500">{g.count}</span>
                            </div>
                        );
                    }
                    const task = row.task;
                    const assignee = userMap.get(task.assignedTo);
                    const hasDates = !!task.plannedStartDate;
                    const statusIcon = STATUS_ICONS[task.status] || STATUS_ICONS.pending;
                    return (
                        <div key={task.id}
                            className={`flex items-center px-3 pl-8 gap-2 border-b border-slate-800/60 cursor-pointer hover:bg-slate-800/40 transition-colors ${!hasDates ? 'opacity-50' : ''}`}
                            style={{ height: ROW_HEIGHT }}
                            onClick={() => {
                                if (linkSource) { handleBarClickForLink(task.id); return; }
                                onTaskClick?.(task);
                            }}>
                            <div className={`w-1 rounded-full h-5 bg-${row.groupColor}-500`} />
                            <div className="flex-shrink-0">{statusIcon}</div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold truncate ${task.milestone ? 'text-amber-300' : 'text-slate-200'}`}>
                                    {task.milestone ? '◆ ' : ''}{task.title}
                                </p>
                                {assignee && <p className="text-[10px] text-slate-500 truncate">{assignee.name || assignee.email}</p>}
                            </div>
                            {hasDates ? (
                                <span className="text-[10px] font-bold text-slate-400">{task.percentComplete || 0}%</span>
                            ) : (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStartPlacement?.(task);
                                    }}
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-400/50 transition-all active:scale-95"
                                    title="Colocar en el Gantt"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ---- RIGHT PANEL (timeline) ---- */}
            <div className={`flex-1 overflow-x-auto overflow-y-auto bg-slate-900/50 ${linkSource ? 'cursor-crosshair' : ''} ${placingTask ? 'cursor-crosshair ring-2 ring-amber-400/30 ring-inset' : ''}`}
                ref={timelineRef}
                onMouseMove={handleTimelineMouseMove}
                onMouseUp={handleTimelineMouseUp}>
                <div style={{ width: totalTimelineWidth, minWidth: '100%' }}>
                    {/* Date Header */}
                    <div className="sticky top-0 z-20 bg-slate-800 border-b border-slate-700/50 flex" style={{ height: headerHeight }}>
                        {viewMode === 'weekly' ? (
                            dateCols.map((d, i) => {
                                const isToday = daysBetween(d, new Date()) === 0;
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                return (
                                    <div key={i}
                                        className={`flex-shrink-0 flex flex-col items-center justify-center border-r border-slate-700/30 ${isToday ? 'bg-indigo-900/40' : ''}`}
                                        style={{ width: dayWidth }}>
                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${isWeekend ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {d.toLocaleDateString('es-MX', { weekday: 'short' })}
                                        </span>
                                        <span className={`text-lg font-black ${isToday ? 'text-indigo-300' : isWeekend ? 'text-slate-600' : 'text-slate-200'}`}>
                                            {d.getDate()}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="flex flex-col w-full">
                                <div className="flex border-b border-slate-700/30" style={{ height: 24 }}>
                                    {weekGroups.map((wg, i) => (
                                        <div key={i} className="flex items-center justify-center border-r border-slate-700/20 text-[9px] font-black text-slate-500 uppercase tracking-wider"
                                            style={{ width: wg.count * dayWidth }}>{wg.label}</div>
                                    ))}
                                </div>
                                <div className="flex" style={{ height: 40 }}>
                                    {dateCols.map((d, i) => {
                                        const isToday = daysBetween(d, new Date()) === 0;
                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                        return (
                                            <div key={i}
                                                className={`flex-shrink-0 flex items-center justify-center border-r border-slate-700/20 ${isToday ? 'bg-indigo-900/30' : ''}`}
                                                style={{ width: dayWidth }}>
                                                <span className={`text-[9px] font-bold ${isToday ? 'text-indigo-300' : isWeekend ? 'text-slate-600' : 'text-slate-500'}`}>
                                                    {d.getDate()}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Grid body */}
                    <div className={`relative ${placingTask ? 'cursor-crosshair' : ''}`}
                        style={{ height: totalGridHeight }}
                        onMouseMove={(e) => {
                            if (!placingTask) { if (hoverDayIndex >= 0) setHoverDayIndex(-1); return; }
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
                            const idx = Math.floor(x / dayWidth);
                            if (idx >= 0 && idx < numDays && idx !== hoverDayIndex) setHoverDayIndex(idx);
                        }}
                        onMouseLeave={() => { if (hoverDayIndex >= 0) setHoverDayIndex(-1); }}
                        onClick={(e) => {
                            if (!placingTask || !onPlacementComplete) return;
                            if (linkSource) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
                            const dayIndex = Math.floor(x / dayWidth);
                            if (dayIndex >= 0 && dayIndex < numDays) {
                                const clickedDate = addDays(viewStart, dayIndex);
                                // Local timezone safe formatting (avoid UTC shift from toISOString)
                                const yy = clickedDate.getFullYear();
                                const mm = String(clickedDate.getMonth() + 1).padStart(2, '0');
                                const dd = String(clickedDate.getDate()).padStart(2, '0');
                                const dateStr = `${yy}-${mm}-${dd}`;
                                setHoverDayIndex(-1);
                                onPlacementComplete(dateStr);
                            }
                        }}
                    >
                        {/* Column lines */}
                        {dateCols.map((d, i) => {
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            return <div key={i} className={`absolute top-0 bottom-0 border-r border-slate-800/60 ${isWeekend ? 'bg-slate-800/20' : ''}`}
                                style={{ left: i * dayWidth, width: dayWidth }} />;
                        })}

                        {/* Today line */}
                        {showToday && (
                            <div className="absolute top-0 bottom-0 w-px bg-indigo-400/70 z-10" style={{ left: todayOffset }}>
                                <div className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-indigo-400" />
                            </div>
                        )}

                        {/* Placement preview — green column + bar LOCKED to task's row */}
                        {placingTask && hoverDayIndex >= 0 && (
                            <>
                                {/* Full-column green highlight */}
                                <div
                                    className="absolute top-0 bottom-0 bg-emerald-500/15 border-x border-emerald-400/40 z-[5] pointer-events-none transition-all duration-75"
                                    style={{ left: hoverDayIndex * dayWidth, width: dayWidth * 4 }}
                                />
                                {/* Preview bar — locked to the task's own row */}
                                <div
                                    className="absolute z-[6] pointer-events-none flex items-center gap-1.5 px-2 rounded-lg border-2 border-emerald-400/60 bg-emerald-500/25 backdrop-blur-sm transition-[left] duration-75"
                                    style={{
                                        left: hoverDayIndex * dayWidth + 4,
                                        width: dayWidth * 4 - 8,
                                        top: placingTaskRowY,
                                        height: ROW_HEIGHT * 0.55,
                                    }}
                                >
                                    <span className="text-[10px] font-bold text-emerald-300 truncate">
                                        {placingTask.title}
                                    </span>
                                    <span className="text-[9px] text-emerald-400/70 ml-auto flex-shrink-0">3 días</span>
                                </div>
                            </>
                        )}

                        {/* Rows + bars */}
                        {(() => {
                            let y = 0;
                            return rows.map((row) => {
                                if (row.type === 'group') {
                                    const el = <div key={`gh-${row.group.id}`}
                                        className="absolute left-0 right-0 bg-slate-800/30 border-b border-slate-700/40"
                                        style={{ top: y, height: GROUP_HEADER_HEIGHT }} />;
                                    y += GROUP_HEADER_HEIGHT;
                                    return el;
                                }
                                const task = row.task;
                                const geo = getBarGeometry(task);
                                const curY = y;
                                y += ROW_HEIGHT;
                                return (
                                    <div key={task.id}>
                                        <div className="absolute left-0 right-0 border-b border-slate-800/40" style={{ top: curY, height: ROW_HEIGHT }} />
                                        {geo && (
                                            <div className="absolute" style={{ top: curY, left: 0, right: 0, height: ROW_HEIGHT }}
                                                onClick={() => {
                                                    if (linkSource && linkSource !== task.id) {
                                                        handleBarClickForLink(task.id);
                                                    } else if (!linkSource) {
                                                        handleLinkStart(task.id);
                                                    }
                                                }}>
                                                <GanttBar
                                                    task={task}
                                                    left={geo.left}
                                                    width={geo.width}
                                                    color={getTaskColor(task)}
                                                    rowHeight={ROW_HEIGHT}
                                                    dayWidth={dayWidth}
                                                    viewStart={viewStart}
                                                    onClick={onTaskClick}
                                                    onDragEnd={onBarDragEnd}
                                                    onLinkStart={handleLinkStart}
                                                    onLinkComplete={handleBarClickForLink}
                                                    isLinking={!!linkSource}
                                                    isLinkSource={linkSource === task.id}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()}

                        {/* Dependency arrows */}
                        <DependencyArrows
                            dependencies={dependencies}
                            taskRowMap={taskRowMap}
                            rowHeight={ROW_HEIGHT}
                            svgWidth={totalTimelineWidth}
                            svgHeight={totalGridHeight}
                        />



                        {/* Link mode indicator */}
                        {linkSource && (() => {
                            const srcTask = tasks.find(t => t.id === linkSource);
                            return (
                                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2.5 animate-bounce">
                                    <Link2 className="w-4 h-4" />
                                    <span>Enlazando desde "<span className="text-indigo-200">{srcTask?.title || '...'}</span>" — click en otra tarea</span>
                                    <button
                                        onClick={() => setLinkSource(null)}
                                        className="ml-2 px-2 py-0.5 bg-white/20 text-white rounded-lg text-[10px] font-bold hover:bg-white/30 transition-colors"
                                    >
                                        ESC Cancelar
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}

function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
