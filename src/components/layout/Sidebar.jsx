import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRole } from '../../contexts/RoleContext';
import { useAppData, APP_VERSION } from '../../contexts/AppDataContext';
import {
    BrainCircuit, Activity, LayoutDashboard, User, FolderGit2,
    ListTodo, Database, Clock, FileText, BarChart3, Users,
    Bell, Settings, LogOut, Shield, LayoutList, Briefcase, LineChart, CalendarDays, GanttChartSquare, Radar, Zap,
    ChevronDown, ChevronRight
} from 'lucide-react';

const SECTIONS = [
    {
        key: 'main',
        label: null,
        items: [
            { to: '/', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/my-work', label: 'Mi Trabajo', icon: User },
        ],
    },
    {
        key: 'bom',
        label: 'AutoBOM',
        items: [
            { to: '/bom/projects', label: 'Proyectos BOM', icon: FolderGit2, countKey: 'proyectos' },
            { to: '/catalog', label: 'Catálogo', icon: Database, countKey: 'catalogo' },
        ],
    },
    {
        key: 'engineering',
        label: 'Ingeniería',
        items: [
            { to: '/projects', label: 'Proyectos', icon: Briefcase, countKey: 'engProjects' },
            { to: '/tasks', label: 'Tareas', icon: ListTodo, countKey: 'engTasks' },
            { to: '/planner', label: 'Weekly Planner', icon: CalendarDays },
            { to: '/gantt', label: 'Project Gantt', icon: GanttChartSquare },
        ],
    },
    {
        key: 'intelligence',
        label: 'Intelligence',
        items: [
            { to: '/control-tower', label: 'Control Tower', icon: Radar },
            { to: '/audit', label: 'Auditoría', icon: Shield },
        ],
    },
    {
        key: 'reports',
        label: 'Reportes y Analítica',
        items: [
            { to: '/work-logs', label: 'Registro Horas', icon: Clock },
            { to: '/reports/daily', label: 'Reporte Diario', icon: FileText },
            { to: '/reports/weekly', label: 'Reporte Semanal', icon: BarChart3 },
            { to: '/analytics', label: 'Analítica', icon: LineChart },
        ],
    },
    {
        key: 'team',
        label: 'Equipo',
        items: [
            { to: '/team', label: 'Equipo', icon: Users },
            { to: '/notifications', label: 'Notificaciones', icon: Bell },
        ],
    },
    {
        key: 'lists',
        label: 'Listas',
        items: [
            { to: '/listas', label: 'Listas Gestionadas', icon: LayoutList },
        ],
    },
];

const ADMIN_ROUTES = ['/automation', '/settings'];

export default function Sidebar() {
    const { user, signOut } = useAuth();
    const { role, isAdmin, canEdit } = useRole();
    const { proyectos, catalogo, engProjects, engTasks } = useAppData();
    const location = useLocation();

    // Sections start closed. Hover opens them (sticky). Click chevron closes.
    const [openSections, setOpenSections] = useState(() => {
        // Auto-open the section containing the current active route on mount
        const initial = {};
        SECTIONS.forEach(s => {
            if (!s.label) { initial[s.key] = true; return; } // main always open
            if (s.items.some(i => i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to))) {
                initial[s.key] = true;
            }
        });
        if (ADMIN_ROUTES.some(r => location.pathname.startsWith(r))) {
            initial.admin = true;
        }
        return initial;
    });

    const openSection = (key) => {
        setOpenSections(prev => ({ ...prev, [key]: true }));
    };

    const closeSection = (key) => {
        setOpenSections(prev => ({ ...prev, [key]: false }));
    };

    const counts = {
        proyectos: proyectos.length,
        catalogo: catalogo.length,
        engProjects: engProjects.length,
        engTasks: engTasks.length,
    };

    const renderSection = (section) => {
        const isOpen = openSections[section.key];
        return (
            <div
                key={section.key}
                onMouseEnter={() => { if (section.label && !isOpen) openSection(section.key); }}
            >
                {/* Section Header */}
                {section.label && (
                    <div className="w-full pt-4 pb-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden h-9 group-hover:h-auto flex items-center justify-between">
                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-colors ${isOpen ? 'text-slate-400' : 'text-slate-600'}`}>
                            {section.label}
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); isOpen ? closeSection(section.key) : openSection(section.key); }}
                            className="p-0.5 rounded hover:bg-slate-800 transition-colors"
                            title={isOpen ? 'Contraer sección' : 'Expandir sección'}
                        >
                            {isOpen
                                ? <ChevronDown className="w-3 h-3 text-slate-500 hover:text-slate-300 transition-colors" />
                                : <ChevronRight className="w-3 h-3 text-slate-600 hover:text-slate-300 transition-colors" />
                            }
                        </button>
                    </div>
                )}

                {/* Section Items with smooth animation */}
                <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100' : section.label ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}`}>
                    {section.items.map(item => {
                        const Icon = item.icon;
                        const count = item.countKey ? counts[item.countKey] : null;
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                title={item.label}
                                className={({ isActive }) =>
                                    `w-[220px] flex items-center gap-4 px-2.5 py-2.5 rounded-xl text-sm font-bold transition-all ${isActive
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`
                                }
                            >
                                <Icon className="w-5 h-5 flex-shrink-0 ml-[1px]" />
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 truncate">{item.label}</span>
                                {count != null && (
                                    <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[10px] bg-slate-800 px-2 py-0.5 rounded-full">{count}</span>
                                )}
                            </NavLink>
                        );
                    })}
                </div>
            </div>
        );
    };

    const isAdminOpen = openSections.admin;

    return (
        <>
            {/* Spacer */}
            <div className="hidden md:block w-16 bg-slate-900 flex-shrink-0 z-40 border-r border-slate-800"></div>

            {/* Sidebar */}
            <aside className="hidden md:flex flex-col h-full bg-slate-900 text-white fixed left-0 top-0 z-[100] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] w-16 hover:w-64 group border-r border-slate-800 shadow-[4px_0_24px_rgba(0,0,0,0.3)] hover:shadow-[12px_0_48px_rgba(0,0,0,0.5)] overflow-x-hidden overflow-y-hidden hover:overflow-y-auto scrollbar-thin">

                {/* Logo */}
                <div className="p-4 border-b border-slate-800 h-[73px] flex items-center justify-start flex-shrink-0">
                    <div className="flex items-center gap-4 w-[220px]">
                        <BrainCircuit className="text-indigo-400 w-8 h-8 flex-shrink-0 ml-0.5" />
                        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden whitespace-nowrap">
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-black tracking-tighter leading-none">AutoBOM Pro</h1>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 mt-1">v{APP_VERSION}</span>
                        </div>
                    </div>
                </div>

                {/* Nav Sections */}
                <nav className="flex-1 px-3 py-4 space-y-0.5">
                    {SECTIONS.map(renderSection)}

                    {/* Admin */}
                    {isAdmin && (
                        <div onMouseEnter={() => { if (!isAdminOpen) openSection('admin'); }}>
                            <div className="w-full pt-4 pb-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden h-9 group-hover:h-auto flex items-center justify-between">
                                <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-colors ${isAdminOpen ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Admin
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); isAdminOpen ? closeSection('admin') : openSection('admin'); }}
                                    className="p-0.5 rounded hover:bg-slate-800 transition-colors"
                                    title={isAdminOpen ? 'Contraer sección' : 'Expandir sección'}
                                >
                                    {isAdminOpen
                                        ? <ChevronDown className="w-3 h-3 text-slate-500 hover:text-slate-300 transition-colors" />
                                        : <ChevronRight className="w-3 h-3 text-slate-600 hover:text-slate-300 transition-colors" />
                                    }
                                </button>
                            </div>
                            <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isAdminOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <NavLink
                                    to="/automation"
                                    title="Automatización"
                                    className={({ isActive }) =>
                                        `w-[220px] flex items-center gap-4 px-2.5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${isActive
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                        }`
                                    }
                                >
                                    <Zap className="w-5 h-5 flex-shrink-0 ml-[1px]" />
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">Automatización</span>
                                </NavLink>
                                <NavLink
                                    to="/settings"
                                    title="Configuración"
                                    className={({ isActive }) =>
                                        `w-[220px] flex items-center gap-4 px-2.5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${isActive
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                        }`
                                    }
                                >
                                    <Settings className="w-5 h-5 flex-shrink-0 ml-[1px]" />
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">Configuración</span>
                                </NavLink>
                            </div>
                        </div>
                    )}
                </nav>

                {/* User Info & Sign Out */}
                <div className="p-4 border-t border-slate-800 flex-shrink-0 flex items-center justify-between overflow-hidden whitespace-nowrap w-[256px]">
                    <div className="flex items-center gap-4">
                        {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {(user.displayName || user.email || '?')[0].toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0 flex-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <p className="text-xs font-bold text-white truncate max-w-[100px]">{user.displayName || 'Usuario'}</p>
                            <span className={`text-[9px] font-black uppercase tracking-wider ${isAdmin ? 'text-emerald-400' : canEdit ? 'text-amber-400' : 'text-slate-500'}`}>{role || 'viewer'}</span>
                        </div>
                    </div>
                    <button onClick={signOut} title="Cerrar Sesión" className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </aside>
        </>
    );
}
