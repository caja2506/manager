import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useRole } from '../../contexts/RoleContext';
import {
    LayoutDashboard, User, ListTodo, Shield, FolderGit2,
    Database, Clock, FileText, BarChart3, Users, Bell, Settings,
    Briefcase, LineChart, CalendarDays, GanttChartSquare, Radar, Zap,
    LayoutList, Activity, Map, Menu, X, ChevronRight, Award
} from 'lucide-react';

// ─── Quick Access (bottom bar — always visible) ───
const QUICK_NAV = [
    { to: '/', label: 'Inicio', icon: LayoutDashboard },
    { to: '/my-work', label: 'Mi Trabajo', icon: User },
    { to: '/tasks', label: 'Tareas', icon: ListTodo },
    { to: '/projects', label: 'Proyectos', icon: Briefcase },
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
            { to: '/daily-scrum', label: 'Equipo Hoy', icon: Users },
            { to: '/planner', label: 'Weekly Planner', icon: CalendarDays },
            { to: '/gantt', label: 'Project Gantt', icon: GanttChartSquare },
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
        ],
    },
    {
        label: 'Equipo',
        items: [
            { to: '/team', label: 'Equipo', icon: Users },
            { to: '/notifications', label: 'Notificaciones', icon: Bell },
            { to: '/listas', label: 'Listas', icon: LayoutList },
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
    const location = useLocation();
    const { isAdmin } = useRole();

    // Close drawer on navigation
    useEffect(() => {
        setIsOpen(false);
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
                <div className="flex justify-around items-center px-1 py-1.5">
                    {QUICK_NAV.map((item) => {
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
