import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { useAppData } from '../contexts/AppDataContext';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import TransitionConfirmModal from '../components/workflow/TransitionConfirmModal';
import TaskModuleBanner from '../components/layout/TaskModuleBanner';
import { useWorkflowTransition } from '../hooks/useWorkflowTransition';
import {
    TASK_STATUS, TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG
} from '../models/schemas';
import {
    Search, Filter, X, ChevronDown, ChevronRight, User, Calendar
} from 'lucide-react';

// ============================================================
// STATUS GROUP ORDER
// ============================================================

const STATUS_GROUPS = [
    { status: TASK_STATUS.IN_PROGRESS, label: 'In Progress', color: '#f59e0b' },
    { status: TASK_STATUS.PENDING,     label: 'To Do',       color: '#ef4444' },
    { status: TASK_STATUS.BACKLOG,     label: 'Backlog',     color: '#64748b' },
    { status: TASK_STATUS.VALIDATION,  label: 'Validación',  color: '#8b5cf6' },
    { status: TASK_STATUS.COMPLETED,   label: 'Completado',  color: '#22c55e' },
    { status: TASK_STATUS.BLOCKED,     label: 'Bloqueado',   color: '#ef4444' },
    { status: TASK_STATUS.CANCELLED,   label: 'Cancelado',   color: '#6b7280' },
];

// ============================================================
// STATUS BADGE COMPONENT
// ============================================================

function StatusBadge({ status }) {
    const cfg = TASK_STATUS_CONFIG[status];
    if (!cfg) return null;

    return (
        <span
            className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide whitespace-nowrap"
            style={{
                backgroundColor: cfg.color + '22',
                color: cfg.color,
                border: `1px solid ${cfg.color}44`,
            }}
        >
            {cfg.label}
        </span>
    );
}

// ============================================================
// PRIORITY BADGE COMPONENT
// ============================================================

const PRIORITY_COLORS = {
    low:      { bg: '#64748b22', text: '#94a3b8', border: '#64748b44' },
    medium:   { bg: '#3b82f622', text: '#60a5fa', border: '#3b82f644' },
    high:     { bg: '#f59e0b22', text: '#fbbf24', border: '#f59e0b44' },
    critical: { bg: '#ef444422', text: '#f87171', border: '#ef444444' },
};

function PriorityBadge({ priority }) {
    const cfg = TASK_PRIORITY_CONFIG[priority];
    const colors = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
    if (!cfg) return null;

    return (
        <span
            className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide whitespace-nowrap"
            style={{
                backgroundColor: colors.bg,
                color: colors.text,
                border: `1px solid ${colors.border}`,
            }}
        >
            {cfg.label}
        </span>
    );
}

// ============================================================
// OWNER AVATAR COMPONENT
// ============================================================

function OwnerAvatar({ task, teamMembers }) {
    const member = teamMembers.find(m => m.uid === task.assignedTo);
    if (!member) {
        return (
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-slate-600" />
            </div>
        );
    }

    const initials = (() => {
        const name = member.displayName || member.email || '?';
        const parts = name.trim().split(/\s+/);
        return parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : name[0].toUpperCase();
    })();

    return (
        <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-slate-700 cursor-default"
            style={{
                background: member.photoURL
                    ? `url(${member.photoURL}) center/cover`
                    : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: member.photoURL ? 'transparent' : '#fff',
            }}
            title={member.displayName || member.email}
        >
            {!member.photoURL && initials}
        </div>
    );
}

// ============================================================
// TIMELINE DISPLAY
// ============================================================

function TimelineDisplay({ task }) {
    const start = task.plannedStartDate || task.createdAt;
    const end = task.dueDate || task.plannedEndDate;

    const formatDate = (dateStr) => {
        if (!dateStr) return null;
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
        } catch {
            return null;
        }
    };

    const startFormatted = formatDate(start);
    const endFormatted = formatDate(end);

    if (!startFormatted && !endFormatted) {
        return <span className="text-slate-600 text-xs">—</span>;
    }

    return (
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
            <span>
                {startFormatted || '?'}
                {endFormatted && ` - ${endFormatted}`}
            </span>
        </div>
    );
}

// ============================================================
// COLLAPSIBLE TABLE GROUP
// ============================================================

function TableGroup({ label, color, tasks, engProjects, teamMembers, onTaskClick, isExpanded, onToggle }) {
    return (
        <div className="mb-5 animate-in fade-in duration-200">
            {/* Group Header */}
            <button
                onClick={onToggle}
                className="flex items-center gap-2.5 w-full text-left px-2 py-2.5 rounded-lg hover:bg-slate-800/50 transition-colors group"
            >
                {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                    : <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                }
                <span className="font-bold text-sm" style={{ color }}>
                    {label}
                </span>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700/50">
                    {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
                </span>
            </button>

            {/* Table */}
            {isExpanded && (
                <div className="mt-1 rounded-xl overflow-hidden border border-slate-800/60 bg-slate-900/40">
                    {/* Column Headers */}
                    <div
                        className="grid items-center px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] border-b border-slate-800/60 bg-slate-900/60"
                        style={{
                            gridTemplateColumns: '36px 1fr 60px 130px 110px 150px 140px',
                            borderLeft: `3px solid ${color}`,
                        }}
                    >
                        <div>
                            <input
                                type="checkbox"
                                className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 accent-indigo-500 cursor-pointer"
                                readOnly
                            />
                        </div>
                        <div>Task Name</div>
                        <div className="text-center">Owner</div>
                        <div className="text-center">Status</div>
                        <div className="text-center">Priority</div>
                        <div>Timeline</div>
                        <div>Project</div>
                    </div>

                    {/* Rows */}
                    {tasks.length === 0 ? (
                        <div
                            className="px-4 py-6 text-center text-sm text-slate-600"
                            style={{ borderLeft: `3px solid ${color}` }}
                        >
                            Sin tareas en esta sección
                        </div>
                    ) : (
                        tasks.map((task, idx) => {
                            const project = engProjects.find(p => p.id === task.projectId);
                            return (
                                <div
                                    key={task.id}
                                    onClick={() => onTaskClick(task)}
                                    className={`grid items-center px-4 py-3 cursor-pointer transition-all duration-150 hover:bg-indigo-500/8 group/row ${
                                        idx < tasks.length - 1 ? 'border-b border-slate-800/40' : ''
                                    }`}
                                    style={{
                                        gridTemplateColumns: '36px 1fr 60px 130px 110px 150px 140px',
                                        borderLeft: `3px solid ${color}`,
                                    }}
                                >
                                    {/* Checkbox */}
                                    <div onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 accent-indigo-500 cursor-pointer"
                                        />
                                    </div>

                                    {/* Task Name */}
                                    <div className="pr-3">
                                        <p className="text-sm font-semibold text-slate-200 group-hover/row:text-white truncate transition-colors">
                                            {task.title || 'Sin título'}
                                        </p>
                                        {task.description && (
                                            <p className="text-[11px] text-slate-500 truncate mt-0.5 max-w-[300px]">
                                                {task.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Owner */}
                                    <div className="flex justify-center">
                                        <OwnerAvatar task={task} teamMembers={teamMembers} />
                                    </div>

                                    {/* Status */}
                                    <div className="flex justify-center">
                                        <StatusBadge status={task.status} />
                                    </div>

                                    {/* Priority */}
                                    <div className="flex justify-center">
                                        <PriorityBadge priority={task.priority} />
                                    </div>

                                    {/* Timeline */}
                                    <div>
                                        <TimelineDisplay task={task} />
                                    </div>

                                    {/* Project */}
                                    <div>
                                        <span className="text-xs text-slate-400 italic truncate block">
                                            {project?.name || '—'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function MainTable() {
    const { user } = useAuth();
    const { canEdit, canDelete } = useRole();
    const { engProjects, engTasks, engSubtasks, teamMembers, taskTypes } = useAppData();

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);

    // Filters
    const [search, setSearch] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterAssignee, setFilterAssignee] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Collapsed groups
    const [collapsedGroups, setCollapsedGroups] = useState({});

    const openNew = () => { setSelectedTask(null); setIsModalOpen(true); };
    const openTask = (task) => { setSelectedTask(task); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setSelectedTask(null); };

    // Workflow transition hook
    const {
        pendingTransition, transitionError, isTransitioning,
        confirmTransition, cancelTransition,
    } = useWorkflowTransition();

    // --- Filter tasks ---
    const filteredTasks = useMemo(() => {
        return engTasks.filter(task => {
            const s = search.toLowerCase();
            const matchSearch = !s || (task.title || '').toLowerCase().includes(s) || (task.description || '').toLowerCase().includes(s);
            const matchProject = !filterProject || task.projectId === filterProject;
            const matchAssignee = !filterAssignee || task.assignedBy === filterAssignee || task.assignedTo === filterAssignee;
            const matchPriority = !filterPriority || task.priority === filterPriority;
            return matchSearch && matchProject && matchAssignee && matchPriority;
        });
    }, [engTasks, search, filterProject, filterAssignee, filterPriority]);

    // --- Group by status ---
    const tasksByStatus = useMemo(() => {
        const map = {};
        Object.values(TASK_STATUS).forEach(s => { map[s] = []; });
        filteredTasks.forEach(t => {
            if (map[t.status]) map[t.status].push(t);
            else map[TASK_STATUS.BACKLOG].push(t);
        });
        // Sort within each group by priority
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        Object.keys(map).forEach(key => {
            map[key].sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));
        });
        return map;
    }, [filteredTasks]);

    const toggleGroup = (status) => {
        setCollapsedGroups(prev => ({ ...prev, [status]: !prev[status] }));
    };

    // Count active filters
    const activeFilterCount = [search, filterProject, filterAssignee, filterPriority].filter(Boolean).length;

    return (
        <div className="-m-4 md:-m-8 flex flex-col bg-slate-950 text-white" style={{ minHeight: '100vh' }}>
            <TaskDetailModal
                isOpen={isModalOpen}
                onClose={closeModal}
                task={selectedTask}
                projects={engProjects}
                teamMembers={teamMembers}
                subtasks={selectedTask ? engSubtasks.filter(s => s.taskId === selectedTask.id) : []}
                taskTypes={taskTypes}
                userId={user?.uid}
                canEdit={canEdit}
                canDelete={canDelete}
            />

            <TransitionConfirmModal
                isOpen={!!pendingTransition}
                pending={pendingTransition}
                isTransitioning={isTransitioning}
                onConfirm={confirmTransition}
                onCancel={cancelTransition}
            />

            {/* Transition Error Toast */}
            {transitionError && (
                <div className="fixed bottom-24 md:bottom-4 left-1/2 -translate-x-1/2 z-[201] bg-rose-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-4">
                    {transitionError}
                </div>
            )}

            {/* ══════════════ SHARED BANNER ══════════════ */}
            <TaskModuleBanner onNewTask={canEdit ? openNew : null} canEdit={canEdit}>
                {/* Filter toggle in the tabs bar */}
                <button
                    onClick={() => setShowFilters(f => !f)}
                    className={`relative px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 text-xs border transition-all active:scale-95 ${
                        showFilters
                            ? 'bg-indigo-600/15 text-indigo-400 border-indigo-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600 hover:text-slate-300'
                    }`}
                >
                    {showFilters ? <X className="w-3.5 h-3.5" /> : <Filter className="w-3.5 h-3.5" />}
                    Filtros
                    {activeFilterCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-indigo-500 text-white text-[8px] font-bold flex items-center justify-center shadow">
                            {activeFilterCount}
                        </span>
                    )}
                </button>
            </TaskModuleBanner>

            {/* ══════════════ FILTERS BAR (collapsible) ══════════════ */}
            {showFilters && (
                <div className="flex flex-wrap gap-3 items-center flex-shrink-0 animate-in fade-in slide-in-from-top-2 duration-200 px-6 py-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar tareas..."
                            className="pl-10 pr-4 py-2.5 w-full border border-slate-700/60 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 bg-slate-900/60 backdrop-blur-sm placeholder:text-slate-600 transition-all"
                        />
                    </div>
                    {/* Dropdowns */}
                    <select
                        value={filterProject}
                        onChange={e => setFilterProject(e.target.value)}
                        className="px-4 py-2.5 border border-slate-700/60 rounded-xl text-sm text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 bg-slate-900/60 backdrop-blur-sm cursor-pointer hover:border-slate-600 transition-all"
                    >
                        <option value="">Todos los proyectos</option>
                        {engProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select
                        value={filterAssignee}
                        onChange={e => setFilterAssignee(e.target.value)}
                        className="px-4 py-2.5 border border-slate-700/60 rounded-xl text-sm text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 bg-slate-900/60 backdrop-blur-sm cursor-pointer hover:border-slate-600 transition-all"
                    >
                        <option value="">Todos los miembros</option>
                        {teamMembers.map(u => <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>)}
                    </select>
                    <select
                        value={filterPriority}
                        onChange={e => setFilterPriority(e.target.value)}
                        className="px-4 py-2.5 border border-slate-700/60 rounded-xl text-sm text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 bg-slate-900/60 backdrop-blur-sm cursor-pointer hover:border-slate-600 transition-all"
                    >
                        <option value="">Todas las prioridades</option>
                        {Object.entries(TASK_PRIORITY_CONFIG).map(([key, cfg]) => (
                            <option key={key} value={key}>{cfg.label}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* ══════════════ SUMMARY BAR ══════════════ */}
            <div className="flex items-center justify-between px-6 py-2 flex-shrink-0">
                <p className="text-xs text-slate-500 font-medium">
                    {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''} en total
                    {activeFilterCount > 0 && (
                        <span className="text-indigo-400 ml-1.5">
                            ({activeFilterCount} filtro{activeFilterCount !== 1 ? 's' : ''} activo{activeFilterCount !== 1 ? 's' : ''})
                        </span>
                    )}
                </p>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            const allExpanded = STATUS_GROUPS.every(g => !collapsedGroups[g.status]);
                            const newState = {};
                            STATUS_GROUPS.forEach(g => { newState[g.status] = allExpanded; });
                            setCollapsedGroups(newState);
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-300 font-semibold px-2.5 py-1 rounded-lg hover:bg-slate-800/60 transition-all"
                    >
                        {STATUS_GROUPS.every(g => !collapsedGroups[g.status]) ? 'Colapsar todo' : 'Expandir todo'}
                    </button>
                </div>
            </div>

            {/* ══════════════ TABLE GROUPS ══════════════ */}
            <div className="flex-1 overflow-y-auto pb-4 px-6 pt-2">
                {STATUS_GROUPS.map(group => {
                    const tasks = tasksByStatus[group.status] || [];
                    // Hide empty groups for Completed and Cancelled to reduce noise
                    if (tasks.length === 0 && (group.status === TASK_STATUS.COMPLETED || group.status === TASK_STATUS.CANCELLED)) {
                        return null;
                    }
                    return (
                        <TableGroup
                            key={group.status}
                            label={group.label}
                            color={group.color}
                            tasks={tasks}
                            engProjects={engProjects}
                            teamMembers={teamMembers}
                            onTaskClick={openTask}
                            isExpanded={!collapsedGroups[group.status]}
                            onToggle={() => toggleGroup(group.status)}
                        />
                    );
                })}

                {filteredTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-4">
                            <Search className="w-7 h-7 text-slate-600" />
                        </div>
                        <p className="text-slate-500 font-semibold text-sm">No se encontraron tareas</p>
                        <p className="text-slate-600 text-xs mt-1">Intenta ajustar los filtros de búsqueda</p>
                    </div>
                )}
            </div>
        </div>
    );
}
