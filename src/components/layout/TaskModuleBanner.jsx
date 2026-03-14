import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, Search, Bell, Settings, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AppDataContext';

/**
 * TaskModuleBanner — Shared header across Task Management pages.
 * ===
 * Displays: Icon + Title + Stats | Action icons | + New Task | User avatar
 * Navigation tabs: Tareas, Weekly Planner, Gantt, Analytics
 *
 * Standard design rule documented in blueprint.md
 */

const TABS = [
    { label: 'Main Table',      path: '/main-table' },
    { label: 'Kanban',          path: '/tasks' },
    { label: 'Weekly Planner',  path: '/planner' },
    { label: 'Gantt',           path: '/gantt' },
];

export default function TaskModuleBanner({ onNewTask, canEdit = false, children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { engTasks, engProjects } = useAppData();

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
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/60">
                {/* Left: Icon + Title + Stats */}
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                        <LayoutGrid className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="font-black text-lg text-white tracking-tight leading-none">
                            Gestión de Tareas
                        </h1>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                            {activeTasks.length} tarea{activeTasks.length !== 1 ? 's' : ''} activa{activeTasks.length !== 1 ? 's' : ''}
                            {engProjects.length > 0 && (
                                <>
                                    <span className="text-slate-600">•</span>
                                    {engProjects.length} proyecto{engProjects.length !== 1 ? 's' : ''}
                                </>
                            )}
                        </p>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {/* Inline action icons */}
                    <div className="hidden md:flex items-center gap-1 bg-slate-800/60 rounded-xl p-1 border border-slate-700/50">
                        <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Buscar">
                            <Search className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Notificaciones">
                            <Bell className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Configuración">
                            <Settings className="w-4 h-4" />
                        </button>
                    </div>

                    {/* + New Task */}
                    {canEdit && onNewTask && (
                        <button
                            onClick={onNewTask}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/25 border border-indigo-500/50 active:scale-95 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Nueva Tarea
                        </button>
                    )}

                    {/* User avatar */}
                    <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold ring-2 ring-amber-500/40 cursor-pointer hover:ring-amber-400/60 transition-all"
                        style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#b45309' }}
                        title={user?.displayName || user?.email}
                    >
                        {initials}
                    </div>
                </div>
            </div>

            {/* ── Tab Navigation ── */}
            <div className="flex items-center gap-0 px-6 bg-slate-900/70 border-b border-slate-800/50">
                {TABS.map(tab => {
                    const isActive = location.pathname === tab.path;
                    return (
                        <button
                            key={tab.path}
                            onClick={() => navigate(tab.path)}
                            className={`relative px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap ${
                                isActive
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
