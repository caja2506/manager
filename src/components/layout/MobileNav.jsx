import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, FolderGit2, Database, ListTodo, User, Shield
} from 'lucide-react';

const MOBILE_NAV_ITEMS = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/my-work', label: 'Mi Trabajo', icon: User },
    { to: '/tasks', label: 'Tareas', icon: ListTodo },
    { to: '/audit', label: 'Auditoría', icon: Shield },
    { to: '/bom/projects', label: 'BOM', icon: FolderGit2 },
];

export default function MobileNav() {
    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-slate-900 border-t border-slate-800 flex justify-around px-2 py-2 safe-area-bottom">
            {MOBILE_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${isActive ? 'text-indigo-400 bg-indigo-950' : 'text-slate-500'
                            }`
                        }
                    >
                        <Icon className="w-5 h-5" />
                        <span className="text-[10px] font-bold">{item.label}</span>
                    </NavLink>
                );
            })}
        </nav>
    );
}
