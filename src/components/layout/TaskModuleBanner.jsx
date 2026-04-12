import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Folder, Table2, KanbanSquare, Calendar, Clock, BarChart3, Users } from 'lucide-react';

/**
 * TaskModuleBanner — Tab navigation bar for Task Management pages.
 * ===
 * Title + stats are now in the global TopBar (dynamic per route).
 * This component only provides: Tab navigation + Action button + children toolbar
 */

const TABS = [
    { label: 'Proyectos', path: '/projects', icon: Folder },
    { label: 'Main Table', path: '/main-table', icon: Table2 },
    { label: 'Kanban', path: '/tasks', icon: KanbanSquare },
    { label: 'Weekly Planner', path: '/planner', icon: Calendar },
    { label: 'Daily Scrum', path: '/daily-scrum', icon: Users },
    { label: 'Daily Board', path: '/daily-board', icon: Clock },
    { label: 'Gantt', path: '/gantt', icon: BarChart3 },
];

export default function TaskModuleBanner({ onNewTask, canEdit = false, actionLabel = 'Nueva Tarea', children }) {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="shrink-0 flex items-center gap-0 px-3 md:px-6 bg-slate-100 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800/50 overflow-x-auto scrollbar-none">
            {/* Tab Navigation */}
            {TABS.map(tab => {
                const isActive = location.pathname === tab.path;
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.path}
                        onClick={() => navigate(tab.path)}
                        className={`relative flex items-center gap-1.5 px-2.5 md:px-4 py-2.5 md:py-3 text-[11px] md:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${isActive
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        {tab.label}
                        {isActive && (
                            <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-indigo-500 rounded-t-full" />
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

            {/* Spacer + New Task button */}
            {canEdit && onNewTask && (
                <div className={`${children ? '' : 'ml-auto'} shrink-0 pl-2`}>
                    <button
                        onClick={onNewTask}
                        className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] md:text-xs font-bold rounded-lg shadow-lg shadow-indigo-600/25 border border-indigo-500/50 active:scale-95 transition-all"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{actionLabel}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
