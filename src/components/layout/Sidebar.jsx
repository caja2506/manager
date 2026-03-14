import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRole } from '../../contexts/RoleContext';
import { useAppData, APP_VERSION } from '../../contexts/AppDataContext';
import {
    BrainCircuit, Activity, LayoutDashboard, User, FolderGit2,
    ListTodo, Database, Clock, FileText, BarChart3, Users,
    Bell, Settings, LogOut, Shield, LayoutList, Briefcase, LineChart, CalendarDays, GanttChartSquare, Radar
} from 'lucide-react';

const NAV_ITEMS = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, section: 'main' },
    { to: '/my-work', label: 'Mi Trabajo', icon: User, section: 'main' },
    { divider: true, label: 'AutoBOM' },
    { to: '/bom/projects', label: 'Proyectos BOM', icon: FolderGit2, section: 'bom', countKey: 'proyectos' },
    { to: '/catalog', label: 'Catálogo', icon: Database, section: 'bom', countKey: 'catalogo' },
    { divider: true, label: 'Ingeniería' },
    { to: '/projects', label: 'Proyectos', icon: Briefcase, section: 'engineering', countKey: 'engProjects' },
    { to: '/tasks', label: 'Tareas', icon: ListTodo, section: 'engineering', countKey: 'engTasks' },
    { to: '/work-logs', label: 'Registro Horas', icon: Clock, section: 'engineering' },
    { to: '/planner', label: 'Weekly Planner', icon: CalendarDays, section: 'engineering' },
    { to: '/gantt', label: 'Project Gantt', icon: GanttChartSquare, section: 'engineering' },
    { divider: true, label: 'Intelligence' },
    { to: '/control-tower', label: 'Control Tower', icon: Radar, section: 'intelligence' },
    { to: '/audit', label: 'Auditoría', icon: Shield, section: 'intelligence' },
    { divider: true, label: 'Reportes y Analítica' },
    { to: '/reports/daily', label: 'Reporte Diario', icon: FileText, section: 'reports' },
    { to: '/reports/weekly', label: 'Reporte Semanal', icon: BarChart3, section: 'reports' },
    { to: '/analytics', label: 'Analítica', icon: LineChart, section: 'reports' },
    { divider: true, label: 'Equipo' },
    { to: '/team', label: 'Equipo', icon: Users, section: 'team' },
    { to: '/notifications', label: 'Notificaciones', icon: Bell, section: 'team' },
];

export default function Sidebar() {
    const { user, signOut } = useAuth();
    const { role, isAdmin, canEdit } = useRole();
    const { proyectos, catalogo, engProjects, engTasks } = useAppData();

    const counts = {
        proyectos: proyectos.length,
        catalogo: catalogo.length,
        engProjects: engProjects.length,
        engTasks: engTasks.length,
    };

    return (
        <>
            {/* Spacer to hold the space for the mini-rail so main content isn't shifted */}
            <div className="hidden md:block w-16 bg-slate-900 flex-shrink-0 z-40 border-r border-slate-800"></div>

            {/* Sidebar Overlay Rail */}
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

                {/* Nav Items */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    {NAV_ITEMS.map((item, idx) => {
                        if (item.divider) {
                            return (
                                <div key={`div-${idx}`} className="pt-4 pb-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden h-9 group-hover:h-auto overflow-y-visible">
                                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">{item.label}</span>
                                </div>
                            );
                        }
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

                    {/* Managed Lists */}
                    <div className="pt-4 pb-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden h-9 group-hover:h-auto overflow-y-visible">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Listas</span>
                    </div>
                    <NavLink
                        to="/listas"
                        title="Listas Gestionadas"
                        className={({ isActive }) =>
                            `w-[220px] flex items-center gap-4 px-2.5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${isActive
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`
                        }
                    >
                        <LayoutList className="w-5 h-5 flex-shrink-0 ml-[1px]" />
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">Listas Gestionadas</span>
                    </NavLink>

                    {/* Admin */}
                    {isAdmin && (
                        <>
                            <div className="pt-4 pb-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden h-9 group-hover:h-auto overflow-y-visible">
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Admin</span>
                            </div>
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
                        </>
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
