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

import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import GanttBar from './GanttBar';
import DependencyArrows from './DependencyArrows';
import {
    ChevronDown, ChevronRight, Plus, Ban, Circle, Play, CheckCircle2,
    Clock, PanelLeftOpen, PanelLeftClose, CheckCircle, AlertTriangle, Link2,
    Target, ListTodo, MoreVertical, Flag, CalendarX,
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
const PROJECT_COLORS = ['blue', 'violet', 'emerald', 'amber', 'pink', 'orange', 'cyan', 'rose'];

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

function getLocalDateStr(dateOrStr) {
    if (!dateOrStr) return null;
    if (typeof dateOrStr === 'string' && dateOrStr.length === 10) {
        return dateOrStr;
    }
    const d = new Date(dateOrStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-CA');
}

function daysBetweenStr(str1, str2) {
    if (!str1 || !str2) return 0;
    const d1 = new Date(str1 + 'T12:00:00');
    const d2 = new Date(str2 + 'T12:00:00');
    return Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
}

export default function GanttGrid({
    tasks, dependencies, viewMode, viewStart: viewStartProp, taskTypes, milestones = [], users,
    groupBy = 'type', onGroupByChange, onCreateMilestone,
    onCreateTaskInMilestone, onDeleteMilestone,
    placingTask, onPlacementComplete, onStartPlacement, onAssignMilestone,
    onTaskClick, onBarDragEnd, onLinkCreated, onDeleteDependency,
    zoomLevel = 1, showCriticalPath, projects = [],
    onRemoveFromGantt,
    visualizeLateness = false,
}) {
    const timelineRef = useRef(null);
    const leftPanelRef = useRef(null);

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
    let dayWidth;
    if (viewMode === 'weekly') {
        dayWidth = DAY_WIDTH_WEEKLY * zoomLevel;
    } else if (viewMode === 'weeks') {
        dayWidth = (56 / 7) * zoomLevel; // 56px por semana de 7 días = 8px por día
    } else {
        dayWidth = DAY_WIDTH_MONTHLY * zoomLevel;
    }

    // Hover sync
    const [hoveredTaskId, setHoveredTaskId] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);

    // Click outside listener for menu
    useEffect(() => {
        if (!openMenuId) return;
        const closeMenu = () => setOpenMenuId(null);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, [openMenuId]);

    // Panning (drag-to-scroll)
    const [isPanning, setIsPanning] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e) => {
        if (!timelineRef.current) return;
        setIsPanning(true);
        setStartX(e.pageX - timelineRef.current.offsetLeft);
        setScrollLeft(timelineRef.current.scrollLeft);
    };

    const handleMouseMove = (e) => {
        if (!isPanning || !timelineRef.current) return;
        e.preventDefault();
        const x = e.pageX - timelineRef.current.offsetLeft;
        const walk = (x - startX) * 1.5;
        timelineRef.current.scrollLeft = scrollLeft - walk;
    };

    const handleMouseUpOrLeave = () => {
        setIsPanning(false);
    };

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

    // Date columns (Dynamic timeline bounds)
    const { computedStart, computedNumDays } = useMemo(() => {
        let minD = new Date();
        let maxD = new Date();
        
        let hasDates = false;
        (tasks || []).forEach(t => {
            if (t.plannedStartDate) {
                const start = toMidnight(t.plannedStartDate);
                const end = t.plannedEndDate ? toMidnight(t.plannedEndDate) : start;
                if (!hasDates) { minD = start; maxD = end; hasDates = true; }
                else {
                    if (start < minD) minD = start;
                    if (end > maxD) maxD = end;
                }
            }
        });

        // Add padding: 14 days before, 30 days after
        minD = addDays(minD, -14);
        maxD = addDays(maxD, 30);

        // Ensure "Today" is included in the timeline
        const today = toMidnight(new Date());
        if (today < minD) minD = addDays(today, -14);
        if (today > maxD) maxD = addDays(today, 30);

        if (viewMode === 'weeks') {
            const day = minD.getDay(); // 0=Sun, 1=Mon...
            const diff = day === 0 ? -6 : 1 - day;
            minD = addDays(minD, diff);
        }

        const diffDays = Math.max(daysBetween(minD, maxD), 35); // minimum 35 days width
        return { computedStart: minD, computedNumDays: diffDays };
    }, [tasks]);

    const viewStart = computedStart;
    const numDays = computedNumDays;

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
    // Milestone map
    const milestoneMap = useMemo(() => {
        const m = new Map();
        (milestones || []).forEach(ms => m.set(ms.id, ms));
        return m;
    }, [milestones]);

    const projectColorsMap = useMemo(() => {
        const m = new Map();
        (projects || []).forEach((p, idx) => {
            const color = PROJECT_COLORS[idx % PROJECT_COLORS.length];
            m.set(p.id, color);
        });
        return m;
    }, [projects]);

    const projectMap = useMemo(() => {
        const m = new Map();
        (projects || []).forEach(p => m.set(p.id, p));
        return m;
    }, [projects]);

    const renderMilestoneOptions = useCallback((projectId) => {
        if (!milestones || milestones.length === 0) return [];
        const projectMs = milestones.filter(m => m.projectId === projectId || m.parentProjectId === projectId);
        if (projectMs.length === 0) return [];

        const allMs = [...projectMs].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        const roots = allMs.filter(m => !m.parentMilestoneId);
        const childrenOf = (parentId) => allMs.filter(m => m.parentMilestoneId === parentId);
        
        const buildOptions = (nodes, depth) => {
            let result = [];
            nodes.forEach(node => {
                const prefix = depth > 0 ? '\u00A0\u00A0\u00A0\u00A0'.repeat(depth - 1) + '└─ ' : '';
                result.push(
                    <option key={node.id} value={node.id}>{prefix}{node.name}</option>
                );
                const kids = childrenOf(node.id);
                if (kids.length > 0) {
                    result.push(...buildOptions(kids, depth + 1));
                }
            });
            return result;
        };
        return buildOptions(roots, 0);
    }, [milestones]);

    function getTaskHealthColor(task, defaultColor) {
        if (task.status === 'cancelled') return 'slate';
        if (task.status === 'completed') return 'green';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Alerta de riesgo (quedan <= 3 días y avance < 75%)
        if (task.plannedEndDate) {
            const end = toMidnight(task.plannedEndDate);
            const daysLeft = daysBetween(today, end);
            const pct = task.percentComplete || 0;
            if (daysLeft >= 0 && daysLeft <= 3 && pct < 75) {
                return 'amber';
            }
        }

        return defaultColor;
    }

    function getTaskColor(task) {
        const defaultColor = projectColorsMap.get(task.projectId) || taskTypeMap.get(task.taskTypeId || task.taskType)?.color || 'indigo';
        return getTaskHealthColor(task, defaultColor);
    }

    // Ruta Crítica
    const criticalTaskIds = useMemo(() => {
        if (!showCriticalPath) return new Set();
        return computeCriticalPath(tasks, dependencies);
    }, [tasks, dependencies, showCriticalPath]);

    // Group tasks by type OR by milestone (hierarchical tree up to 4 levels)
    const groups = useMemo(() => {
        const sorted = [...tasks].sort((a, b) => {
            const aD = a.plannedStartDate ? 0 : 1;
            const bD = b.plannedStartDate ? 0 : 1;
            if (aD !== bD) return aD - bD;
            if (a.plannedStartDate && b.plannedStartDate) return new Date(a.plannedStartDate) - new Date(b.plannedStartDate);
            return (a.title || '').localeCompare(b.title || '');
        });

        if (groupBy === 'milestone') {
            // Build milestone tree (parent→children)
            const allMs = [...milestoneMap.values()];
            const rootMs = allMs.filter(ms => !ms.parentMilestoneId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            const childrenOf = (parentId) => allMs.filter(ms => ms.parentMilestoneId === parentId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            
            // Map tasks to their milestone
            const tasksByMs = new Map();
            sorted.forEach(task => {
                const msId = task.milestoneId || '__no_milestone__';
                if (!tasksByMs.has(msId)) tasksByMs.set(msId, []);
                tasksByMs.get(msId).push(task);
            });

            // Build recursive tree nodes (max depth 4)
            const buildNode = (ms, depth, colorIdx) => {
                const children = depth < 3 ? childrenOf(ms.id) : []; // depth 0-3 = 4 levels
                const projectColor = projectColorsMap.get(ms.projectId) || GROUP_COLORS[colorIdx % GROUP_COLORS.length];
                const projectName = projectMap.get(ms.projectId)?.name || '';
                return {
                    id: ms.id,
                    name: ms.name || 'Sin nombre',
                    projectName,
                    projectId: ms.projectId,
                    color: projectColor,
                    tasks: tasksByMs.get(ms.id) || [],
                    count: (tasksByMs.get(ms.id) || []).length,
                    isMilestone: true,
                    depth,
                    children: children.map((c, ci) => buildNode(c, depth + 1, colorIdx * 8 + ci)),
                };
            };

            const tree = rootMs.map((ms, i) => buildNode(ms, 0, i));

            // Add "Sin Milestone" if there are unassigned tasks
            const unassigned = tasksByMs.get('__no_milestone__') || [];
            if (unassigned.length > 0) {
                tree.push({
                    id: '__no_milestone__',
                    name: 'Sin Milestone',
                    color: 'slate',
                    tasks: unassigned,
                    count: unassigned.length,
                    isMilestone: true,
                    depth: 0,
                    children: [],
                });
            }
            return tree;
        }

        // Default: group by task type (flat)
        const grouped = new Map();
        sorted.forEach(task => {
            const typeId = task.taskTypeId || task.taskType || '__general__';
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
                    depth: 0,
                    children: [],
                };
            });
    }, [tasks, taskTypeMap, milestoneMap, groupBy, milestones]);

    // Flat rows — recursive for milestone tree
    const rows = useMemo(() => {
        const list = [];
        const INDENT_PER_LEVEL = 16; // px per depth level

        const addGroup = (g) => {
            list.push({ type: 'group', group: g, indent: (g.depth || 0) * INDENT_PER_LEVEL });
            if (!collapsedGroups.has(g.id)) {
                // Add child milestones first (sub-groups)
                if (g.children) {
                    g.children.forEach(child => addGroup(child));
                }
                // Then add tasks
                g.tasks.forEach(t => list.push({ type: 'task', task: t, groupColor: g.color, indent: ((g.depth || 0) + 1) * INDENT_PER_LEVEL }));
            }
        };

        groups.forEach(g => addGroup(g));
        return list;
    }, [groups, collapsedGroups]);

    const totalGridHeight = rows.reduce((h, r) => h + (r.type === 'group' ? GROUP_HEADER_HEIGHT : ROW_HEIGHT), 0);

    function getEffectiveEndDateStr(task) {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const startStr = task.plannedStartDate ? getLocalDateStr(task.plannedStartDate) : todayStr;
        let endStr = task.plannedEndDate ? getLocalDateStr(task.plannedEndDate) : startStr;
        
        if (task.status === 'completed') {
            if (task.completedDate) {
                const completedStr = getLocalDateStr(task.completedDate);
                if (completedStr && completedStr > endStr) {
                    endStr = completedStr;
                }
            }
        } else if (task.status !== 'cancelled' && visualizeLateness) {
            if (todayStr > endStr) {
                endStr = todayStr;
            }
        }
        return endStr;
    }

    // Bar geometry
    function getBarGeometry(task) {
        if (!task.plannedStartDate) return null;
        const viewStartStr = getLocalDateStr(viewStart);
        const startStr = getLocalDateStr(task.plannedStartDate);
        const endStr = getEffectiveEndDateStr(task);
        return {
            left: daysBetweenStr(viewStartStr, startStr) * dayWidth,
            width: Math.max(daysBetweenStr(startStr, endStr) + 1, 1) * dayWidth,
        };
    }

    // Group geometry (Milestone roof)
    function getGroupGeometry(group) {
        if (!group.tasks) return null;
        const gatherTasks = (g) => {
            let t = [...(g.tasks || [])];
            if (g.children) {
                g.children.forEach(c => t.push(...gatherTasks(c)));
            }
            return t;
        };
        const allTasks = gatherTasks(group);
        const scheduledTasks = allTasks.filter(t => t.plannedStartDate);
        if (scheduledTasks.length === 0) return null;
        
        let minStart = new Date('2100-01-01');
        let maxEnd = new Date('1900-01-01');
        
        scheduledTasks.forEach(task => {
            const start = toMidnight(task.plannedStartDate);
            const end = task.plannedEndDate ? toMidnight(task.plannedEndDate) : start;
            if (start < minStart) minStart = start;
            if (end > maxEnd) maxEnd = end;
        });
        
        return {
            left: daysBetween(viewStart, minStart) * dayWidth,
            width: Math.max(daysBetween(minStart, maxEnd) + 1, 1) * dayWidth,
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

    // Auto-scroll to today
    useEffect(() => {
        if (timelineRef.current && showToday) {
            setTimeout(() => {
                if (timelineRef.current) {
                    const centerOffset = timelineRef.current.clientWidth / 2;
                    timelineRef.current.scrollLeft = Math.max(0, todayOffset - centerOffset);
                }
            }, 50);
        }
    }, [todayOffset, showToday]);

    // Monthly week groups
    const weekGroups = useMemo(() => {
        if (viewMode !== 'monthly' && viewMode !== 'weeks') return [];
        const grps = []; let cur = null;
        dateCols.forEach((d, i) => {
            const wn = getISOWeek(d);
            const label = viewMode === 'weeks' ? `W${wn}` : `Sem ${wn}`;
            if (!cur || cur.week !== wn) { cur = { week: wn, start: i, count: 1, label }; grps.push(cur); }
            else cur.count++;
        });
        return grps;
    }, [dateCols, viewMode]);

    // Daily month groups
    const monthGroups = useMemo(() => {
        const grps = []; let cur = null;
        dateCols.forEach((d, i) => {
            const mn = d.getMonth();
            const year = d.getFullYear();
            const label = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
            if (!cur || cur.month !== mn || cur.year !== year) {
                cur = { month: mn, year, start: i, count: 1, label: label };
                grps.push(cur);
            } else {
                cur.count++;
            }
        });
        return grps;
    }, [dateCols]);

    const headerHeight = viewMode === 'weeks' ? 48 : 72;

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
            <div
                ref={leftPanelRef}
                onScroll={handleLeftScroll}
                className={`${leftPanelOpen ? 'translate-x-0' : '-translate-x-full'
                } md:translate-x-0 fixed md:relative z-40 md:z-auto h-full transition-transform duration-200 ease-in-out flex-shrink-0 bg-slate-900 border-r border-slate-700/50 overflow-y-auto`}
                style={{ width: LEFT_PANEL_W }}
            >
                <div className="sticky top-0 z-20 bg-slate-800 border-b border-slate-700/50 px-4 flex items-center gap-3" style={{ height: headerHeight }}>
                    {onGroupByChange ? (
                        <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg p-0.5">
                            <button
                                onClick={() => onGroupByChange('milestone')}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${groupBy === 'milestone' ? 'bg-purple-500/20 dark:bg-purple-500/30 text-purple-700 dark:text-purple-300 border border-purple-500/40' : 'text-slate-400 hover:text-slate-300'}`}
                            >
                                <Target className="w-3 h-3" />
                                Milestone
                            </button>
                            <button
                                onClick={() => onGroupByChange('type')}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${groupBy === 'type' ? 'bg-indigo-500/20 dark:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-slate-300'}`}
                            >
                                <ListTodo className="w-3 h-3" />
                                Tipo
                            </button>
                        </div>
                    ) : (
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Tarea por tipo</span>
                    )}
                    {groupBy === 'milestone' && onCreateMilestone && (
                        <button
                            onClick={() => onCreateMilestone(null, null)}
                            className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/30 dark:border-purple-500/50 hover:bg-purple-500/20 dark:hover:bg-purple-500/30 transition-all"
                            title="Nuevo Milestone"
                        >
                            <Plus className="w-3 h-3" />
                            Nuevo
                        </button>
                    )}
                </div>
                {rows.map((row) => {
                    if (row.type === 'group') {
                        const g = row.group;
                        const collapsed = collapsedGroups.has(g.id);
                        const depth = g.depth || 0;
                        const depthColors = ['text-purple-700 dark:text-purple-300', 'text-blue-700 dark:text-blue-300', 'text-teal-700 dark:text-teal-300', 'text-amber-700 dark:text-amber-300'];
                        const depthIconColors = ['text-purple-400', 'text-blue-400', 'text-teal-400', 'text-amber-400'];
                        const totalCount = g.count + (g.children || []).reduce((sum, c) => sum + c.count, 0);
                        return (
                            <div key={`g-${g.id}`} className="flex items-center gap-2 border-b border-slate-700/40 cursor-pointer hover:bg-slate-800/60 transition-colors select-none"
                                style={{ height: GROUP_HEADER_HEIGHT, paddingLeft: 12 + (row.indent || 0) }} onClick={() => toggleGroup(g.id)}>
                                {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                                {g.isMilestone
                                    ? <Target className={`w-3 h-3 ${depthIconColors[depth] || 'text-purple-400'}`} />
                                    : <div className={`w-2 h-2 rounded-full bg-${g.color}-500`} />
                                }
                                <span className={`text-[11px] font-black uppercase tracking-wider flex-1 truncate ${g.isMilestone ? (depthColors[depth] || 'text-slate-300') : 'text-slate-300'}`}>
                                    {g.name}
                                    {g.projectName && (
                                        <span className="ml-2 text-[9px] font-bold text-slate-400 bg-slate-800 border border-slate-700/80 px-1.5 py-0.5 rounded uppercase tracking-wider select-none">
                                            {g.projectName}
                                        </span>
                                    )}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 mr-1">{totalCount || g.count}</span>
                                {g.isMilestone && (
                                    <div className="relative mr-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === g.id ? null : g.id); }}
                                            className="w-5 h-5 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-all"
                                            title="Opciones de milestone"
                                        >
                                            <MoreVertical className="w-3.5 h-3.5" />
                                        </button>
                                        {openMenuId === g.id && (
                                            <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 flex flex-col">
                                                {onCreateMilestone && depth < 3 && (
                                                    <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); onCreateMilestone(g.id, g.name); }} className="w-full text-left px-3 py-2 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                                                        Crear Sub-Milestone
                                                    </button>
                                                )}
                                                {onCreateTaskInMilestone && (
                                                    <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); onCreateTaskInMilestone(g.id); }} className="w-full text-left px-3 py-2 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                                                        Crear Tarea
                                                    </button>
                                                )}
                                                {onDeleteMilestone && (
                                                    <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); onDeleteMilestone(g.id, g.name); }} className="w-full text-left px-3 py-2 text-[11px] font-semibold text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors border-t border-slate-700/50">
                                                        Eliminar Milestone
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    }
                    const task = row.task;
                    const assignee = userMap.get(task.assignedTo);
                    const hasDates = !!task.plannedStartDate;
                    const statusIcon = STATUS_ICONS[task.status] || STATUS_ICONS.pending;
                    return (
                        <div key={task.id}
                            className={`group flex items-center gap-2 border-b cursor-pointer transition-colors ${!hasDates ? 'opacity-50' : ''} ${hoveredTaskId === task.id ? 'bg-slate-700/50 border-slate-600/60' : 'border-slate-800/60 hover:bg-slate-800/40'}`}
                            style={{ height: ROW_HEIGHT, paddingLeft: 12 + (row.indent || 16) }}
                            onMouseEnter={() => setHoveredTaskId(task.id)}
                            onMouseLeave={() => setHoveredTaskId(null)}
                            onClick={() => {
                                if (linkSource) { handleBarClickForLink(task.id); return; }
                                onTaskClick?.(task);
                            }}>
                            <div className={`w-1 rounded-full h-5 bg-${row.groupColor}-500`} />
                            <div className="flex-shrink-0">{statusIcon}</div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center pr-2">
                                <p className={`text-xs font-semibold truncate ${task.milestone ? 'text-amber-300' : 'text-slate-200'}`} title={task.title}>
                                    {task.milestone ? '◆ ' : ''}{task.title}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 min-w-0">
                                    {assignee && <p className="text-[10px] text-slate-500 truncate flex-shrink-0 max-w-[50%]" title={assignee.displayName || assignee.name || assignee.email}>{assignee.displayName || assignee.name || assignee.email}</p>}
                                    {milestones.length > 0 && onAssignMilestone && (() => {
                                        const opts = renderMilestoneOptions(task.projectId);
                                        if (opts.length === 0) return null;
                                        return (
                                            <select
                                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity bg-slate-800 border border-slate-700 text-[9px] text-slate-300 rounded outline-none cursor-pointer w-auto h-4 py-0 pl-1 pr-4 truncate"
                                                onClick={e => e.stopPropagation()}
                                                onChange={e => {
                                                    e.stopPropagation();
                                                    onAssignMilestone(task.id, e.target.value);
                                                }}
                                                value={task.milestone || ''}
                                            >
                                                <option value="">Sin Milestone</option>
                                                {opts}
                                            </select>
                                        );
                                    })()}
                                </div>
                            </div>
                            {hasDates ? (
                                <div className="relative w-8 h-6 flex items-center justify-end">
                                    <span className="text-[10px] font-bold text-slate-400 group-hover:hidden transition-all">
                                        {task.percentComplete || 0}%
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveFromGantt?.(task);
                                        }}
                                        className="hidden group-hover:flex items-center justify-center p-1 rounded-md text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 transition-all active:scale-95"
                                        title="Quitar del Gantt"
                                    >
                                        <CalendarX className="w-3.5 h-3.5" />
                                    </button>
                                </div>
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
            <div
                ref={timelineRef}
                onScroll={handleRightScroll}
                className={`flex-1 overflow-x-auto overflow-y-auto bg-slate-900 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'} ${linkSource ? 'cursor-crosshair' : ''} ${placingTask ? 'cursor-crosshair ring-2 ring-amber-400/30 ring-inset' : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
            >
                <div style={{ width: totalTimelineWidth, minWidth: '100%' }}>
                    {/* Date Header */}
                    <div className="sticky top-0 z-20 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/50 flex" style={{ height: headerHeight }}>
                        {viewMode === 'weekly' ? (
                            <div className="flex flex-col w-full">
                                <div className="flex border-b border-slate-200 dark:border-slate-700/30" style={{ height: 36 }}>
                                    {monthGroups.map((mg, i) => (
                                        <div key={i} className={`border-r border-slate-200 dark:border-slate-700/20 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider ${i % 2 === 0 ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-900/50'}`}
                                            style={{ width: mg.count * dayWidth }}>
                                            <div className="sticky left-0 flex items-center h-full px-3" style={{ width: 'max-content' }}>
                                                {mg.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex" style={{ height: 36 }}>
                                    {dateCols.map((d, i) => {
                                        const isToday = daysBetween(d, new Date()) === 0;
                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                        const isEvenMonth = d.getMonth() % 2 === 0;
                                        
                                        let bgClass = isEvenMonth ? 'bg-slate-100/50 dark:bg-slate-800/30' : 'bg-transparent dark:bg-slate-900/30';
                                        if (isToday) bgClass = 'bg-indigo-50 dark:bg-indigo-900/40';

                                        return (
                                            <div key={i}
                                                className={`flex-shrink-0 flex flex-col items-center justify-center border-r border-slate-200 dark:border-slate-700/30 ${bgClass}`}
                                                style={{ width: dayWidth }}>
                                                <span className={`text-[9px] font-bold uppercase tracking-wider ${isWeekend ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                                    {d.toLocaleDateString('es-MX', { weekday: 'short' })}
                                                </span>
                                                <span className={`text-lg font-black ${isToday ? 'text-indigo-600 dark:text-indigo-300' : isWeekend ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-200'}`}>
                                                    {d.getDate()}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                             </div>
                        ) : viewMode === 'weeks' ? (
                            <div className="flex flex-col w-full">
                                <div className="flex border-b border-slate-200 dark:border-slate-700/30" style={{ height: 24 }}>
                                    {monthGroups.map((mg, i) => (
                                        <div key={i} className={`border-r border-slate-200 dark:border-slate-700/20 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider ${i % 2 === 0 ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-900/50'}`}
                                            style={{ width: mg.count * dayWidth }}>
                                            <div className="sticky left-0 flex items-center h-full px-3" style={{ width: 'max-content' }}>
                                                {mg.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex" style={{ height: 24 }}>
                                    {weekGroups.map((wg, i) => (
                                        <div key={i} className="flex items-center justify-center border-r border-slate-200 dark:border-slate-700/20 text-[9px] font-black text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50"
                                            style={{ width: wg.count * dayWidth }}>{wg.label}</div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col w-full">
                                <div className="flex border-b border-slate-200 dark:border-slate-700/30" style={{ height: 24 }}>
                                    {monthGroups.map((mg, i) => (
                                        <div key={i} className={`border-r border-slate-200 dark:border-slate-700/20 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider ${i % 2 === 0 ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-900/50'}`}
                                            style={{ width: mg.count * dayWidth }}>
                                            <div className="sticky left-0 flex items-center h-full px-3" style={{ width: 'max-content' }}>
                                                {mg.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex border-b border-slate-200 dark:border-slate-700/30" style={{ height: 24 }}>
                                    {weekGroups.map((wg, i) => (
                                        <div key={i} className="flex items-center justify-center border-r border-slate-200 dark:border-slate-700/20 text-[9px] font-black text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50"
                                            style={{ width: wg.count * dayWidth }}>{wg.label}</div>
                                    ))}
                                </div>
                                <div className="flex" style={{ height: 24 }}>
                                    {dateCols.map((d, i) => {
                                        const isToday = daysBetween(d, new Date()) === 0;
                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                        const isEvenMonth = d.getMonth() % 2 === 0;
                                        
                                        let bgClass = isEvenMonth ? 'bg-slate-100/50 dark:bg-slate-800/30' : 'bg-transparent dark:bg-slate-900/30';
                                        if (isToday) bgClass = 'bg-indigo-50 dark:bg-indigo-900/40';

                                        return (
                                            <div key={i}
                                                className={`flex-shrink-0 flex items-center justify-center border-r border-slate-200 dark:border-slate-700/20 ${bgClass}`}
                                                style={{ width: dayWidth }}>
                                                <span className={`text-[9px] font-bold ${isToday ? 'text-indigo-600 dark:text-indigo-300' : isWeekend ? 'text-slate-400 dark:text-slate-600' : 'text-slate-500 dark:text-slate-500'}`}>
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
                            const x = e.clientX - rect.left;
                            const idx = Math.floor(x / dayWidth);
                            if (idx >= 0 && idx < numDays && idx !== hoverDayIndex) setHoverDayIndex(idx);
                        }}
                        onMouseLeave={() => { if (hoverDayIndex >= 0) setHoverDayIndex(-1); }}
                        onClick={(e) => {
                            if (!placingTask || !onPlacementComplete) return;
                            if (linkSource) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
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
                        {viewMode === 'weeks' ? (
                            weekGroups.map((wg, i) => {
                                const isEven = i % 2 === 0;
                                return (
                                    <div
                                        key={i}
                                        className={`absolute top-0 bottom-0 border-r border-slate-800/60 ${isEven ? 'bg-slate-800/5 dark:bg-slate-950/10' : ''}`}
                                        style={{ left: wg.start * dayWidth, width: wg.count * dayWidth }}
                                    />
                                );
                            })
                        ) : (
                            dateCols.map((d, i) => {
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                return <div key={i} className={`absolute top-0 bottom-0 border-r border-slate-800/60 ${isWeekend ? 'bg-slate-800/20' : ''}`}
                                    style={{ left: i * dayWidth, width: dayWidth }} />;
                            })
                        )}

                        {/* Today line */}
                        {showToday && (
                            <div className="absolute top-0 bottom-0 w-px bg-red-500/80 z-20 pointer-events-none" style={{ left: todayOffset }}>
                                <div className="absolute top-0 -left-1 w-2.5 h-2.5 rounded-full bg-red-500" />
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
                                    const geo = getGroupGeometry(row.group);
                                    const el = (
                                        <div key={`gh-${row.group.id}`}>
                                            <div className="absolute left-0 right-0 bg-slate-800/30 border-b border-slate-700/40" style={{ top: y, height: GROUP_HEADER_HEIGHT }} />
                                            {geo && (
                                                <div className="absolute pointer-events-none" style={{ top: y + GROUP_HEADER_HEIGHT / 2 - 4, left: geo.left, width: geo.width, height: 8 }}>
                                                    <div className={`w-full h-full bg-slate-500/50 border-t-2 border-l-2 border-r-2 rounded-t-sm ${row.group.depth > 0 ? 'border-purple-500/50' : 'border-slate-400'}`} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                    y += GROUP_HEADER_HEIGHT;
                                    return el;
                                }

                                const curY = y;
                                y += ROW_HEIGHT;
                                const task = row.task;
                                const geo = getBarGeometry(task);

                                return (
                                    <div key={task.id}
                                        onMouseEnter={() => setHoveredTaskId(task.id)}
                                        onMouseLeave={() => setHoveredTaskId(null)}
                                    >
                                        <div className={`absolute left-0 right-0 border-b border-slate-800/40 transition-colors ${hoveredTaskId === task.id ? 'bg-slate-700/50' : ''}`} style={{ top: curY, height: ROW_HEIGHT }} />
                                        {geo && (
                                            <div className="absolute" style={{ top: curY, left: 0, right: 0, height: ROW_HEIGHT }}
                                                onClick={() => {
                                                    if (linkSource && linkSource !== task.id) {
                                                        handleBarClickForLink(task.id);
                                                    } else if (!linkSource) {
                                                        handleLinkStart(task.id);
                                                    }
                                                }}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (linkSource && linkSource !== task.id) {
                                                        handleBarClickForLink(task.id);
                                                    } else if (!linkSource) {
                                                        handleLinkStart(task.id);
                                                    }
                                                }}
                                            >
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
                                                    isCritical={criticalTaskIds.has(task.id)}
                                                    dimmed={showCriticalPath && !criticalTaskIds.has(task.id)}
                                                    visualizeLateness={visualizeLateness}
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

// Algoritmo del Camino Crítico (CPM)
function computeCriticalPath(tasks, dependencies) {
    const scheduledTasks = tasks.filter(t => t.plannedStartDate && t.plannedEndDate);
    if (scheduledTasks.length === 0) return new Set();

    const taskMap = new Map(scheduledTasks.map(t => [t.id, t]));
    
    const adjSuccessors = new Map();
    scheduledTasks.forEach(t => {
        adjSuccessors.set(t.id, []);
    });

    dependencies.forEach(dep => {
        const predId = dep.predecessorTaskId;
        const succId = dep.successorTaskId;
        if (taskMap.has(predId) && taskMap.has(succId)) {
            adjSuccessors.get(predId).push(succId);
        }
    });

    const getDuration = (task) => {
        const start = new Date(task.plannedStartDate + 'T12:00:00');
        const end = new Date(task.plannedEndDate + 'T12:00:00');
        return Math.max(Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1, 1);
    };

    let projectFinishDate = new Date('1970-01-01');
    scheduledTasks.forEach(t => {
        const end = new Date(t.plannedEndDate + 'T12:00:00');
        if (end > projectFinishDate) projectFinishDate = end;
    });

    const lateFinish = new Map();
    const lateStart = new Map();

    const memoBackward = (taskId) => {
        if (lateFinish.has(taskId)) return lateStart.get(taskId);

        const task = taskMap.get(taskId);
        const duration = getDuration(task);
        const successors = adjSuccessors.get(taskId) || [];

        let lf;
        if (successors.length === 0) {
            lf = new Date(projectFinishDate);
        } else {
            let minSuccLS = null;
            successors.forEach(succId => {
                const succLS = memoBackward(succId);
                if (minSuccLS === null || succLS < minSuccLS) {
                    minSuccLS = succLS;
                }
            });
            const lfDate = new Date(minSuccLS);
            lfDate.setDate(lfDate.getDate() - 1);
            lf = lfDate;
        }

        const ls = new Date(lf);
        ls.setDate(ls.getDate() - (duration - 1));

        lateFinish.set(taskId, lf);
        lateStart.set(taskId, ls);
        return ls;
    };

    scheduledTasks.forEach(t => {
        memoBackward(t.id);
    });

    const criticalTaskIds = new Set();
    scheduledTasks.forEach(t => {
        const ls = lateStart.get(t.id);
        const actualStart = new Date(t.plannedStartDate + 'T12:00:00');
        const slack = Math.round((ls - actualStart) / (24 * 60 * 60 * 1000));
        if (slack <= 0) {
            criticalTaskIds.add(t.id);
        }
    });

    return criticalTaskIds;
}
