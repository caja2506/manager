import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Search, Bell, AlertTriangle, LogOut, Settings,
    User as UserIcon, Folder, Command, Briefcase, UserCircle, ListTodo
} from 'lucide-react';

// Contexts
import { useAuth } from '../../contexts/AuthContext';
import { useAuditData } from '../../hooks/useAuditData';
import { useNotifications } from '../../hooks/useNotifications';
import { useEngineeringData } from '../../hooks/useEngineeringData';
import TaskDetailModal from '../tasks/TaskDetailModal';

export default function TopBar() {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();

    // Data Hooks
    const { auditResult, runClientAudit, isReady, isAuditing } = useAuditData();
    const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();
    const { engProjects = [], engTasks = [] } = useEngineeringData();

    // State
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null); // for task modal
    const searchInputRef = useRef(null);
    const searchContainerRef = useRef(null);
    const userMenuRef = useRef(null);
    const notifMenuRef = useRef(null);

    // --- Computed Audit ---
    const auditStats = useMemo(() => {
        if (!auditResult?.findings) return { count: 0, critical: 0 };
        const critical = auditResult.findings.filter(f => f.severity === 'critical').length;
        const warning = auditResult.findings.filter(f => f.severity === 'warning').length;
        return { count: critical + warning, critical };
    }, [auditResult]);

    // --- Auto-Run Global Audit ---
    useEffect(() => {
        // Run audit locally for the badge count. This is safe because useAuditData caches the state.
        if (isReady && !auditResult && !isAuditing) {
            runClientAudit();
        }
    }, [isReady, auditResult, isAuditing, runClientAudit]);

    // --- User Active Tasks Count ---
    const myTasksCount = useMemo(() => {
        if (!user?.uid || !engTasks) return 0;
        return engTasks.filter(t => t.assignedTo === user.uid && !['completed', 'cancelled'].includes(t.status)).length;
    }, [user, engTasks]);

    // --- Global Search Logic ---
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return { projects: [], tasks: [], pages: [] };
        
        const q = searchQuery.toLowerCase();
        
        // 1. Pages
        const availablePages = [
            { title: 'Control Tower', path: '/control-tower', icon: <Command className="w-4 h-4" /> },
            { title: 'Dashboard', path: '/', icon: <AlertTriangle className="w-4 h-4" /> },
            { title: 'Mi Trabajo', path: '/my-work', icon: <UserIcon className="w-4 h-4" /> },
            { title: 'Notificaciones', path: '/notifications', icon: <Bell className="w-4 h-4" /> },
            { title: 'Analítica', path: '/analytics', icon: <Search className="w-4 h-4" /> } // placeholder icon
        ];
        const pages = availablePages.filter(p => p.title.toLowerCase().includes(q));

        // 2. Projects
        const projects = engProjects.filter(p => 
            (p.name && p.name.toLowerCase().includes(q)) || 
            (p.customerName && p.customerName.toLowerCase().includes(q)) ||
            (p.id && p.id.toLowerCase().includes(q))
        ).slice(0, 5);

        // 3. Tasks
        const tasks = engTasks.filter(t => 
            (t.title && t.title.toLowerCase().includes(q)) ||
            (t.id && t.id.toLowerCase().includes(q))
        ).slice(0, 5);

        return { projects, tasks, pages };
    }, [searchQuery, engProjects, engTasks]);

    // --- Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ctrl+K to open search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            // Escape to close menus
            if (e.key === 'Escape') {
                setIsSearchOpen(false);
                setIsUserMenuOpen(false);
                setIsNotifOpen(false);
                searchInputRef.current?.blur();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // --- Click Outside to Close ---
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
                setIsSearchOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
                setIsUserMenuOpen(false);
            }
            if (notifMenuRef.current && !notifMenuRef.current.contains(e.target)) {
                setIsNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- Handlers ---
    const handleLogout = async () => {
        setIsUserMenuOpen(false);
        try {
            await signOut();
            navigate('/', { replace: true });
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const handleSearchSelect = (type, item) => {
        setSearchQuery('');
        setIsSearchOpen(false);
        
        if (type === 'page') {
            navigate(item.path);
        } else if (type === 'project') {
            navigate(`/projects/${item.id}`);
        } else if (type === 'task') {
            setSelectedTask(item); // open modal
        }
    };

    return (
        <div className="flex-shrink-0 h-16 bg-white/5 dark:bg-slate-900/40 backdrop-blur-xl border-b border-white/10 dark:border-slate-800/50 flex items-center justify-between px-4 md:px-6 sticky top-0 z-[100]">
            
            {/* LEFT: Omnibar Search */}
            <div className="flex-1 max-w-xl relative" ref={searchContainerRef}>
                <div 
                    className={`relative flex items-center w-full h-10 bg-black/5 dark:bg-black/20 rounded-full border transition-all ${
                        isSearchOpen ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : 'border-transparent hover:bg-black/10 dark:hover:bg-black/40'
                    }`}
                >
                    <Search className="w-4 h-4 ml-3 text-slate-500" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Buscar proyectos, tareas... (Ctrl + K)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setIsSearchOpen(true)}
                        className="w-full h-full bg-transparent px-3 text-sm text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400"
                    />
                </div>

                {/* Search Results Dropdown */}
                {isSearchOpen && (searchQuery.trim().length > 0) && (
                    <div className="absolute top-12 left-0 w-full max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-2 animate-in slide-in-from-top-2 duration-200">
                        
                        {/* Pages */}
                        {searchResults.pages.length > 0 && (
                            <div className="px-3 pb-2">
                                <h3 className="text-[10px] font-bold text-slate-400 capitalize mb-1 px-2">Navegación</h3>
                                {searchResults.pages.map(page => (
                                    <button 
                                        key={page.path}
                                        onClick={() => handleSearchSelect('page', page)}
                                        className="w-full flex items-center gap-3 px-2 py-2 hover:bg-indigo-500/10 rounded-lg text-left transition-colors"
                                    >
                                        <div className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-md text-slate-500">{page.icon}</div>
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{page.title}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Projects */}
                        {searchResults.projects.length > 0 && (
                            <div className="px-3 pb-2 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                                <h3 className="text-[10px] font-bold text-slate-400 capitalize mb-1 px-2">Proyectos</h3>
                                {searchResults.projects.map(proj => (
                                    <button 
                                        key={proj.id}
                                        onClick={() => handleSearchSelect('project', proj)}
                                        className="w-full flex items-center gap-3 px-2 py-2 hover:bg-indigo-500/10 rounded-lg text-left transition-colors"
                                    >
                                        <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-md"><Folder className="w-4 h-4" /></div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{proj.name}</p>
                                            <p className="text-[10px] text-slate-400">{proj.customerName} · ID: {proj.id?.slice(-4)}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Tasks */}
                        {searchResults.tasks.length > 0 && (
                            <div className="px-3 pb-1 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                                <h3 className="text-[10px] font-bold text-slate-400 capitalize mb-1 px-2">Tareas</h3>
                                {searchResults.tasks.map(task => (
                                    <button 
                                        key={task.id}
                                        onClick={() => handleSearchSelect('task', task)}
                                        className="w-full flex items-center gap-3 px-2 py-2 hover:bg-indigo-500/10 rounded-lg text-left transition-colors"
                                    >
                                        <div className="p-1.5 bg-cyan-500/10 text-cyan-500 rounded-md"><Briefcase className="w-4 h-4" /></div>
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{task.title}</p>
                                            <p className="text-[10px] text-slate-400 truncate">Proyecto: {engProjects.find(p => p.id === task.projectId)?.name || 'Desconocido'}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {(searchResults.pages.length === 0 && searchResults.projects.length === 0 && searchResults.tasks.length === 0) && (
                            <div className="px-4 py-6 text-center">
                                <Search className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                <p className="text-sm font-bold text-slate-500">No se encontraron resultados</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* RIGHT: Tools & Profile */}
            <div className="flex items-center gap-2 md:gap-4 ml-4">
                
                {/* Desktop Quick Shortcuts (Tareas & Mi Trabajo) */}
                <div className="hidden md:flex items-center gap-2 mr-2">
                    <Link
                        to="/my-work"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors font-bold text-xs"
                    >
                        <UserCircle className="w-4 h-4" />
                        <span>Mi Trabajo</span>
                    </Link>
                    <Link
                        to="/tasks"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors font-bold text-xs relative"
                    >
                        <ListTodo className="w-4 h-4" />
                        <span>Tablero</span>
                        {myTasksCount > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-indigo-500 text-white">
                                {myTasksCount}
                            </span>
                        )}
                    </Link>
                </div>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2 hidden md:block" />

                {/* Audit Alerts */}
                <button 
                    onClick={() => { navigate('/notifications'); }}
                    className={`relative p-2 rounded-full transition-colors focus:outline-none ${
                        auditStats.count > 0 
                            ? (auditStats.critical > 0 ? 'text-rose-500 hover:bg-rose-500/10' : 'text-amber-500 hover:bg-amber-500/10')
                            : 'text-slate-400 hover:text-amber-500 hover:bg-amber-500/10'
                    }`}
                    title="Alertas de Auditoría"
                >
                    <AlertTriangle className="w-5 h-5" />
                    {auditStats.count > 0 && (
                        <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 border border-white dark:border-slate-900 shadow-sm ${
                            auditStats.critical > 0 ? 'bg-rose-500' : 'bg-amber-500'
                        }`}>
                            {auditStats.count > 9 ? '9+' : auditStats.count}
                        </span>
                    )}
                </button>

                {/* Notifications Popover */}
                <div className="relative" ref={notifMenuRef}>
                    <button 
                        onClick={() => setIsNotifOpen(!isNotifOpen)}
                        className="relative p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-full transition-colors focus:outline-none"
                        title="Notificaciones"
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-indigo-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 border border-white dark:border-slate-900 shadow-sm">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Notif Dropdown */}
                    {isNotifOpen && (
                        <div className="absolute top-12 right-0 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[110]">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/80">
                                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">Notificaciones</h3>
                                {unreadCount > 0 && (
                                    <button 
                                        onClick={() => { markAllRead(); setIsNotifOpen(false); }}
                                        className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400 transition-colors"
                                    >
                                        Marcar todo como leído
                                    </button>
                                )}
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-6 text-center text-slate-400 text-xs">Sin notificaciones recientes</div>
                                ) : (
                                    notifications.slice(0, 5).map(n => {
                                        return (
                                            <div 
                                                key={n.id} 
                                                onClick={() => {
                                                    if (!n.read) markAsRead(n.id);
                                                    if (n.taskId) {
                                                        const task = engTasks.find(t => t.id === n.taskId);
                                                        if (task) { setSelectedTask(task); setIsNotifOpen(false); }
                                                    }
                                                }}
                                                className={`flex items-start gap-3 p-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${n.read ? 'opacity-60' : ''}`}
                                            >
                                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-indigo-500' : 'bg-transparent'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs ${!n.read ? 'font-bold text-slate-800 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-300'} truncate`}>
                                                        {n.title}
                                                    </p>
                                                    {n.message && <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{n.message}</p>}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <div className="p-2 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/80">
                                <button 
                                    onClick={() => { setIsNotifOpen(false); navigate('/notifications'); }}
                                    className="w-full py-1.5 text-xs font-bold text-center text-slate-500 hover:text-indigo-500 transition-colors"
                                >
                                    Ver todas las notificaciones
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* User Menu */}
                <div className="relative pl-2 md:pl-4 border-l border-slate-200 dark:border-slate-700/50" ref={userMenuRef}>
                    <button 
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className="flex items-center gap-2 focus:outline-none group"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:ring-2 ring-indigo-500/50 transition-all">
                            {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-xs font-bold text-slate-700 dark:text-white leading-tight truncate max-w-[100px]">{user?.displayName || 'Usuario'}</p>
                            <p className="text-[10px] text-slate-400 capitalize leading-tight">Activo</p>
                        </div>
                    </button>

                    {/* Dropdown */}
                    {isUserMenuOpen && (
                        <div className="absolute right-0 mt-3 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[110]">
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 md:hidden">
                                <p className="text-sm font-bold text-slate-700 dark:text-white truncate">{user?.displayName}</p>
                                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                            </div>
                            <button 
                                onClick={() => { setIsUserMenuOpen(false); navigate('/settings'); }}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                                <Settings className="w-4 h-4" /> Configuración
                            </button>
                            <button 
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                            >
                                <LogOut className="w-4 h-4" /> Cerrar sesión
                            </button>
                        </div>
                    )}
                </div>

            </div>

            {/* Task Detail Modal from Search/Notifs */}
            <TaskDetailModal
                isOpen={!!selectedTask}
                onClose={() => setSelectedTask(null)}
                task={selectedTask}
                projects={engProjects}
                userId={user?.uid}
            />

        </div>
    );
}
