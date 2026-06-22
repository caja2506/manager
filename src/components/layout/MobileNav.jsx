import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useRole } from '../../contexts/RoleContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
    LayoutDashboard, User, ListTodo, Shield, FolderGit2,
    Database, Clock, FileText, BarChart3, Users, Bell, Settings,
    Briefcase, LineChart, CalendarDays, GanttChartSquare, Radar, Zap,
    LayoutList, Activity, Map, Menu, X, ChevronRight, Award, LayoutGrid,
    Sun, Moon, Plus
} from 'lucide-react';

import { useAppData } from '../../contexts/AppDataContext';

// ─── Quick Access (bottom bar — always visible) ───
const QUICK_NAV = [
    { to: '/', label: 'Inicio', icon: LayoutDashboard },
    { to: '/my-work', label: 'Mi Trabajo', icon: User },
    { to: '/tasks', label: 'Tareas', icon: ListTodo },
];

// ─── Full menu sections (matches Sidebar) ───
const FULL_SECTIONS = [
    {
        label: 'Principal',
        items: [
            { to: '/', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/my-work', label: 'Mi Trabajo', icon: User },
            { to: '/daily-briefing', label: 'Daily Briefing', icon: Activity },
            { to: '/overview', label: 'Cómo Funciona', icon: Map },
        ],
    },
    {
        label: 'Ingeniería',
        items: [
            { to: '/projects', label: 'Proyectos', icon: Briefcase },
            { to: '/tasks', label: 'Tareas', icon: ListTodo },
            { to: '/engineering/lists', label: 'Clasificadores', icon: Settings },
            { to: '/daily-scrum', label: 'Equipo Hoy', icon: Users },
            { to: '/planner', label: 'Weekly Planner', icon: CalendarDays },
            { to: '/daily-board', label: 'Daily Board', icon: LayoutGrid },
            { to: '/gantt', label: 'Project Gantt', icon: GanttChartSquare },
            { to: '/roadmap', label: 'Roadmap', icon: Map },
        ],
    },
    {
        label: 'Intelligence',
        items: [
            { to: '/control-tower', label: 'Control Tower', icon: Radar },
            { to: '/audit', label: 'Auditoría', icon: Shield },
            { to: '/team-scores', label: 'Scorecard', icon: Award },
        ],
    },
    {
        label: 'Reportes',
        items: [
            { to: '/work-logs', label: 'Registro Horas', icon: Clock },
            { to: '/reports/daily', label: 'Reporte Diario', icon: FileText },
            { to: '/reports/weekly', label: 'Reporte Semanal', icon: BarChart3 },
            { to: '/analytics', label: 'Analítica', icon: LineChart },
            { to: '/reports/activity', label: 'Actividad', icon: Activity },
        ],
    },
    {
        label: 'AutoBOM',
        items: [
            { to: '/bom/projects', label: 'Proyectos BOM', icon: FolderGit2 },
            { to: '/catalog', label: 'Catálogo', icon: Database },
            { to: '/bom/lists', label: 'Listas BOM', icon: ListTodo },
        ],
    },
    {
        label: 'Equipo',
        items: [
            { to: '/team', label: 'Equipo', icon: Users },
            { to: '/notifications', label: 'Notificaciones', icon: Bell },
        ],
    },
];

const ADMIN_SECTION = {
    label: 'Admin',
    items: [
        { to: '/automation', label: 'Automatización', icon: Zap },
        { to: '/settings', label: 'Configuración', icon: Settings },
    ],
};

export default function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
    const location = useLocation();
    const { isAdmin, canEdit } = useRole();
    const { logout } = useAuth();
    const { toggleTheme, isDark } = useTheme();
    const { setIsGlobalTaskModalOpen, setIsGlobalTimeLogModalOpen } = useAppData();

    useEffect(() => {
        // Debounce to prevent React warning "Calling setState synchronously within an effect"
        const timer = setTimeout(() => setIsOpen(false), 0);
        return () => clearTimeout(timer);
    }, [location.pathname]);

    // Prevent body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const sections = isAdmin ? [...FULL_SECTIONS, ADMIN_SECTION] : FULL_SECTIONS;

    return (
        <>
            {/* ════════════ FULL-SCREEN DRAWER ════════════ */}
            {isOpen && (
                <div className="md:hidden fixed inset-0 z-[200]">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Drawer Panel — slides up from bottom */}
                    <div
                        className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-slate-900 border-t border-slate-700 rounded-t-3xl overflow-hidden animate-in slide-in-from-bottom duration-300"
                    >
                        {/* Handle bar */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 rounded-full bg-slate-700" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pb-3 border-b border-slate-800">
                            <h2 className="text-lg font-black text-white">Navegación</h2>

                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Scrollable content */}
                        <div className="overflow-y-auto max-h-[calc(85vh-80px)] pb-safe overscroll-contain">
                            {sections.map((section) => (
                                <div key={section.label} className="py-2 px-4">
                                    {/* Section header */}
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] px-2 mb-1.5">
                                        {section.label}
                                    </p>

                                    {/* Items */}
                                    <div className="space-y-0.5">
                                        {section.items.map((item) => {
                                            const Icon = item.icon;
                                            return (
                                                <NavLink
                                                    key={item.to}
                                                    to={item.to}
                                                    end={item.to === '/'}
                                                    className={({ isActive }) =>
                                                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                                                            isActive
                                                                ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30'
                                                                : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                                                        }`
                                                    }
                                                >
                                                    <Icon className="w-5 h-5 shrink-0" />
                                                    <span className="text-sm font-bold flex-1">{item.label}</span>
                                                    <ChevronRight className="w-4 h-4 text-slate-600" />
                                                </NavLink>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {/* Bottom padding for safe area */}
                            <div className="h-8" />
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════ BOTTOM BAR ════════════ */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-slate-900/95 backdrop-blur-md border-t border-slate-800 safe-area-bottom">
                {/* Backdrop para cerrar el menú flotante */}
                {quickActionsOpen && (
                    <div 
                        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-30 animate-in fade-in duration-200"
                        onClick={() => setQuickActionsOpen(false)}
                    />
                )}

                <div className="flex justify-around items-center px-1 py-1.5 relative">
                    {QUICK_NAV.slice(0, 2).map((item) => {
                        const Icon = item.icon;
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                className={({ isActive }) =>
                                    `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[56px] ${
                                        isActive
                                            ? 'text-indigo-400 bg-indigo-950/80'
                                            : 'text-slate-500 active:text-slate-300'
                                    }`
                                }
                            >
                                <Icon className="w-5 h-5" />
                                <span className="text-[10px] font-bold leading-tight">{item.label}</span>
                            </NavLink>
                        );
                    })}

                    {/* Botón de Acciones Rápidas (Rayo FAB) */}
                    {canEdit && (
                        <div className="relative z-40">
                            {/* Menú de Botones Flotantes */}
                            <div className={`absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 transition-all duration-300 origin-bottom ${
                                quickActionsOpen 
                                    ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
                                    : 'opacity-0 scale-75 translate-y-4 pointer-events-none'
                            }`}>
                                {/* Opción 1: Registrar Horas */}
                                <div className="relative flex items-center justify-center">
                                    <button
                                        onClick={() => {
                                            setIsGlobalTimeLogModalOpen(true);
                                            setQuickActionsOpen(false);
                                        }}
                                        className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-xl border border-slate-950 active:scale-95 transition-all"
                                        title="Registrar Horas"
                                    >
                                        <Clock className="w-5 h-5" />
                                    </button>
                                    <span className="absolute right-14 bg-slate-950/90 border border-slate-800 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow-md whitespace-nowrap">
                                        Registrar Horas
                                    </span>
                                </div>

                                {/* Opción 2: Nueva Tarea */}
                                <div className="relative flex items-center justify-center">
                                    <button
                                        onClick={() => {
                                            setIsGlobalTaskModalOpen(true);
                                            setQuickActionsOpen(false);
                                        }}
                                        className="w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xl border border-slate-950 active:scale-95 transition-all"
                                        title="Nueva Tarea"
                                    >
                                        <ListTodo className="w-5 h-5" />
                                    </button>
                                    <span className="absolute right-14 bg-slate-950/90 border border-slate-800 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow-md whitespace-nowrap">
                                        Nueva Tarea
                                    </span>
                                </div>
                            </div>

                            {/* Botón Principal (Rayo) */}
                            <button
                                onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                                className={`flex items-center justify-center -mt-5 w-12 h-12 rounded-full text-white shadow-xl border border-slate-950 active:scale-95 transition-all shrink-0 ${
                                    quickActionsOpen 
                                        ? 'bg-indigo-700 rotate-90 scale-110 shadow-indigo-500/20' 
                                        : 'bg-indigo-600 hover:bg-indigo-500'
                                }`}
                                title="Acciones Rápidas"
                            >
                                <Zap className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {QUICK_NAV.slice(2).map((item) => {
                        const Icon = item.icon;
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                className={({ isActive }) =>
                                    `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[56px] ${
                                        isActive
                                            ? 'text-indigo-400 bg-indigo-950/80'
                                            : 'text-slate-500 active:text-slate-300'
                                    }`
                                }
                            >
                                <Icon className="w-5 h-5" />
                                <span className="text-[10px] font-bold leading-tight">{item.label}</span>
                            </NavLink>
                        );
                    })}

                    {/* Menu button — opens full drawer */}
                    <button
                        onClick={() => setIsOpen(true)}
                        className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[56px] ${
                            isOpen
                                ? 'text-indigo-400 bg-indigo-950/80'
                                : 'text-slate-500 active:text-slate-300'
                        }`}
                    >
                        <Menu className="w-5 h-5" />
                        <span className="text-[10px] font-bold leading-tight">Más</span>
                    </button>
                </div>
            </nav>
        </>
    );
}
