import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRole } from '../../contexts/RoleContext';
import { useAppData, APP_VERSION } from '../../contexts/AppDataContext';
import { useEngineeringData } from '../../hooks/useEngineeringData';
import AnalyzeOpsLogo from '../brand/AnalyzeOpsLogo';
import {
    Activity, LayoutDashboard, User, FolderGit2,
    ListTodo, Database, Clock, FileText, BarChart3, Users,
    Bell, Settings, LogOut, Shield, LayoutList, Briefcase, LineChart, CalendarDays, GanttChartSquare, Radar, Zap,
    ChevronRight, X, Target, Map, Award, LayoutGrid
} from 'lucide-react';

// ─── Section Definitions ───
const SECTIONS = [
    {
        key: 'main',
        label: 'Principal',
        icon: LayoutDashboard,
        directNav: true, // sections with 1-2 items navigate directly
        items: [
            { to: '/', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/my-work', label: 'Mi Trabajo', icon: User },
            { to: '/daily-briefing', label: 'Daily Briefing', icon: Activity },
            { to: '/overview', label: 'Cómo Funciona', icon: Map },
        ],
    },
    {
        key: 'bom',
        label: 'AutoBOM',
        icon: Database,
        items: [
            { to: '/bom/projects', label: 'Proyectos BOM', icon: FolderGit2, countKey: 'proyectos' },
            { to: '/catalog', label: 'Catálogo', icon: Database, countKey: 'catalogo' },
        ],
    },
    {
        key: 'engineering',
        label: 'Ingeniería',
        icon: Briefcase,
        items: [
            { to: '/projects', label: 'Proyectos', icon: Briefcase, countKey: 'engProjects' },
            { to: '/tasks', label: 'Tareas', icon: ListTodo, countKey: 'engTasks' },
            { to: '/main-table', label: 'Main Table', icon: LayoutList },
            { to: '/daily-scrum', label: 'Equipo Hoy', icon: Users },
            { to: '/planner', label: 'Weekly Planner', icon: CalendarDays },
            { to: '/daily-board', label: 'Daily Board', icon: LayoutGrid },
            { to: '/gantt', label: 'Project Gantt', icon: GanttChartSquare },
        ],
    },
    {
        key: 'intelligence',
        label: 'Intelligence',
        icon: Radar,
        items: [
            { to: '/control-tower', label: 'Control Tower', icon: Radar },
            { to: '/audit', label: 'Auditoría', icon: Shield },
            { to: '/team-scores', label: 'Scorecard', icon: Award },
        ],
    },
    {
        key: 'reports',
        label: 'Reportes',
        icon: BarChart3,
        items: [
            { to: '/work-logs', label: 'Registro Horas', icon: Clock },
            { to: '/reports/daily', label: 'Reporte Diario', icon: FileText },
            { to: '/reports/weekly', label: 'Reporte Semanal', icon: BarChart3 },
            { to: '/analytics', label: 'Analítica', icon: LineChart },
            { to: '/reports/activity', label: 'Actividad', icon: Activity },
        ],
    },
    {
        key: 'team',
        label: 'Equipo',
        icon: Users,
        items: [
            { to: '/team', label: 'Equipo', icon: Users },
            { to: '/notifications', label: 'Notificaciones', icon: Bell },
        ],
    },
    {
        key: 'lists',
        label: 'Listas',
        icon: LayoutList,
        items: [
            { to: '/listas', label: 'Listas Gestionadas', icon: LayoutList },
        ],
    },
];

const ADMIN_SECTION = {
    key: 'admin',
    label: 'Admin',
    icon: Settings,
    items: [
        { to: '/automation', label: 'Automatización', icon: Zap },
        { to: '/settings', label: 'Configuración', icon: Settings },
    ],
};

// ─── Helper: check if a section contains the active route ───
function sectionContainsRoute(section, pathname) {
    return section.items.some(i =>
        i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)
    );
}

// ─── Sidebar Component ───
export default function Sidebar() {
    const { user, signOut } = useAuth();
    const { role, isAdmin, canEdit } = useRole();
    const { proyectos, catalogo } = useAppData();
    const { engProjects, engTasks } = useEngineeringData();
    const location = useLocation();
    const panelRef = useRef(null);
    const sidebarRef = useRef(null);

    // Which panel is open (section key or null)
    const [openPanel, setOpenPanel] = useState(null);

    // Determine which section the current route belongs to
    const activeSection = [...SECTIONS, ...(isAdmin ? [ADMIN_SECTION] : [])].find(
        s => sectionContainsRoute(s, location.pathname)
    )?.key || 'main';

    const counts = {
        proyectos: proyectos.length,
        catalogo: catalogo.length,
        engProjects: engProjects.length,
        engTasks: engTasks.length,
    };

    // Click outside to close panel
    useEffect(() => {
        function handleClickOutside(e) {
            if (
                openPanel &&
                sidebarRef.current &&
                !sidebarRef.current.contains(e.target)
            ) {
                setOpenPanel(null);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openPanel]);

    // Close panel on route change
    useEffect(() => {
        setOpenPanel(null);
    }, [location.pathname]);

    const handleIconClick = useCallback((section) => {
        // For sections with directNav and only 1 item, we don't need a panel
        // (but we keep panel for multi-item sections)
        if (openPanel === section.key) {
            setOpenPanel(null); // toggle off
        } else {
            setOpenPanel(section.key);
        }
    }, [openPanel]);

    // Get the section data for the current open panel
    const panelSection = openPanel
        ? [...SECTIONS, ADMIN_SECTION].find(s => s.key === openPanel)
        : null;

    return (
        <>
            {/* Spacer to maintain layout */}
            <div className="hidden md:block w-[60px] bg-slate-950 flex-shrink-0 z-40" />

            {/* ═══ TWO-COLUMN SIDEBAR ═══ */}
            <div ref={sidebarRef} className="hidden md:flex fixed left-0 top-0 h-full z-[100]">

                {/* ─── COLUMN 1: Icon Strip (always visible) ─── */}
                <div className="w-[60px] h-full bg-slate-950 border-r border-slate-800/50 flex flex-col items-center py-3 flex-shrink-0">

                    {/* Logo */}
                    <div className="mb-4 p-0.5">
                        <AnalyzeOpsLogo size={34} />
                    </div>

                    <div className="w-8 h-px bg-slate-800 mb-3" />

                    {/* Section Icons */}
                    <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2 overflow-y-auto scrollbar-none">
                        {SECTIONS.map(section => {
                            const Icon = section.icon;
                            const isActive = activeSection === section.key;
                            const isPanelOpen = openPanel === section.key;
                            return (
                                <button
                                    key={section.key}
                                    onClick={() => handleIconClick(section)}
                                    title={section.label}
                                    className={`
                                        group/icon relative w-10 h-10 rounded-xl flex items-center justify-center
                                        transition-all duration-200 ease-out
                                        ${isActive
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                                            : isPanelOpen
                                                ? 'bg-slate-800 text-white'
                                                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'
                                        }
                                    `}
                                >
                                    <Icon className="w-[18px] h-[18px]" />
                                    {/* Tooltip */}
                                    {!openPanel && (
                                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg
                                            opacity-0 group-hover/icon:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap
                                            shadow-lg shadow-black/30 border border-slate-700/50 z-50">
                                            {section.label}
                                            <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-slate-800" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}

                        {/* Admin icon */}
                        {isAdmin && (
                            <>
                                <div className="w-6 h-px bg-slate-800 my-1" />
                                <button
                                    onClick={() => handleIconClick(ADMIN_SECTION)}
                                    title="Admin"
                                    className={`
                                        group/icon relative w-10 h-10 rounded-xl flex items-center justify-center
                                        transition-all duration-200 ease-out
                                        ${activeSection === 'admin'
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                                            : openPanel === 'admin'
                                                ? 'bg-slate-800 text-white'
                                                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'
                                        }
                                    `}
                                >
                                    <Settings className="w-[18px] h-[18px]" />
                                    {!openPanel && (
                                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg
                                            opacity-0 group-hover/icon:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap
                                            shadow-lg shadow-black/30 border border-slate-700/50 z-50">
                                            Admin
                                            <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-slate-800" />
                                        </div>
                                    )}
                                </button>
                            </>
                        )}
                    </nav>

                    <div className="w-8 h-px bg-slate-800 my-2" />

                    {/* User Avatar */}
                    <div className="flex flex-col items-center gap-2 pb-1">
                        <button
                            onClick={signOut}
                            title="Cerrar Sesión"
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-all duration-200"
                        >
                            <LogOut className="w-[18px] h-[18px]" />
                        </button>
                        {user.photoURL ? (
                            <img
                                src={user.photoURL}
                                alt=""
                                className="w-8 h-8 rounded-full ring-2 ring-slate-800 hover:ring-indigo-500 transition-all cursor-pointer"
                                referrerPolicy="no-referrer"
                                title={user.displayName || user.email}
                            />
                        ) : (
                            <div
                                className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-slate-800"
                                title={user.displayName || user.email}
                            >
                                {(user.displayName || user.email || '?')[0].toUpperCase()}
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── COLUMN 2: Slide-out Panel ─── */}
                <div
                    ref={panelRef}
                    className={`
                        h-full bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/40
                        transition-all duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden
                        ${openPanel ? 'w-[240px] opacity-100' : 'w-0 opacity-0'}
                    `}
                    style={{ boxShadow: openPanel ? '8px 0 32px rgba(0,0,0,0.4)' : 'none' }}
                >
                    {panelSection && (
                        <div className="w-[240px] h-full flex flex-col">
                            {/* Panel Header */}
                            <div className="px-4 pt-4 pb-3 border-b border-slate-800/60 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2.5">
                                    {(() => { const PIcon = panelSection.icon; return <PIcon className="w-4 h-4 text-indigo-400" />; })()}
                                    <h2 className="text-sm font-bold text-white tracking-tight">{panelSection.label}</h2>
                                </div>
                                <button
                                    onClick={() => setOpenPanel(null)}
                                    className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Panel Items */}
                            <div className="flex-1 px-2 py-2 overflow-y-auto scrollbar-thin">
                                {panelSection.items.map((item, idx) => {
                                    const ItemIcon = item.icon;
                                    const count = item.countKey ? counts[item.countKey] : null;
                                    return (
                                        <NavLink
                                            key={item.to}
                                            to={item.to}
                                            end={item.to === '/'}
                                            className={({ isActive }) => `
                                                flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium
                                                transition-all duration-150 group/item mb-0.5
                                                ${isActive
                                                    ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/20 shadow-sm'
                                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
                                                }
                                            `}
                                            style={{ animationDelay: `${idx * 30}ms` }}
                                        >
                                            <ItemIcon className="w-4 h-4 flex-shrink-0" />
                                            <span className="flex-1 truncate">{item.label}</span>
                                            {count != null && (
                                                <span className="text-[10px] font-mono bg-slate-800/80 text-slate-400 px-1.5 py-0.5 rounded-md min-w-[24px] text-center">
                                                    {count}
                                                </span>
                                            )}
                                            <ChevronRight className="w-3 h-3 text-slate-600 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                        </NavLink>
                                    );
                                })}
                            </div>

                            {/* Panel Footer */}
                            <div className="px-4 py-3 border-t border-slate-800/40 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] text-slate-500 font-mono">v{APP_VERSION}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
