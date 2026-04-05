import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, Plus, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useEngineeringData } from '../../hooks/useEngineeringData';

/**
 * TaskModuleBanner — Shared header across Task Management pages.
 * ===
 * Displays: Back | Icon + Title + Stats | Action icons | + New Task | User avatar
 * Navigation tabs: Tareas, Weekly Planner, Gantt, Analytics
 *
 * Standard design rule documented in blueprint.md
 */

const TABS = [
    { label: 'Proyectos', path: '/projects' },
    { label: 'Main Table', path: '/main-table' },
    { label: 'Kanban', path: '/tasks' },
    { label: 'Weekly Planner', path: '/planner' },
    { label: 'Daily Board', path: '/daily-board' },
    { label: 'Gantt', path: '/gantt' },
];

export default function TaskModuleBanner({ onNewTask, canEdit = false, actionLabel = 'Nueva Tarea', children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { engTasks, engProjects } = useEngineeringData();

    const activeTasks = engTasks.filter(t => !['completed', 'cancelled'].includes(t.status));

    // Get initials
    const initials = (() => {
        const name = user?.displayName || user?.email || '?';
        const parts = name.trim().split(/\s+/);
        return parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : name[0].toUpperCase();
    })();

    return (
        <div className="flex-shrink-0">
            {/* ── Main Banner Row ── */}
            <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/60">
                {/* Left: Back + Icon + Title + Stats */}
                <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all shrink-0"
                        title="Volver"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                        <LayoutGrid className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-black text-base md:text-lg text-white tracking-tight leading-none truncate">
                            Gestión de Tareas
                        </h1>
                        <p className="text-[10px] md:text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                            <span className="truncate">
                                {activeTasks.length} tarea{activeTasks.length !== 1 ? 's' : ''} activa{activeTasks.length !== 1 ? 's' : ''}
                                {engProjects.length > 0 && (
                                    <>
                                        <span className="text-slate-600"> · </span>
                                        {engProjects.length} proyecto{engProjects.length !== 1 ? 's' : ''}
                                    </>
                                )}
                            </span>
                        </p>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* + New Task */}
                    {canEdit && onNewTask && (
                        <button
                            onClick={onNewTask}
                            className="flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs md:text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/25 border border-indigo-500/50 active:scale-95 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">{actionLabel}</span>
                        </button>
                    )}

                    {/* User avatar */}
                    <div
                        className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-[10px] md:text-[11px] font-bold ring-2 ring-amber-500/40 cursor-pointer hover:ring-amber-400/60 transition-all shrink-0 hidden sm:flex"
                        style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#b45309' }}
                        title={user?.displayName || user?.email}
                    >
                        {initials}
                    </div>
                </div>
            </div>

            {/* ── Tab Navigation ── */}
            <div className="flex items-center gap-0 px-3 md:px-6 bg-slate-900/70 border-b border-slate-800/50 overflow-x-auto scrollbar-none">
                {TABS.map(tab => {
                    const isActive = location.pathname === tab.path;
                    return (
                        <button
                            key={tab.path}
                            onClick={() => navigate(tab.path)}
                            className={`relative px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${isActive
                                ? 'text-white'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {tab.label}
                            {isActive && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full" />
                            )}
                        </button>
                    );
                })}

                {/* Page-specific toolbar (children slot) */}
                {children && (
                    <div className="ml-auto flex items-center gap-2">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}
