/**
 * PageHeader
 * ==========
 * Shared header component for all pages.
 * Provides a consistent back button, title, subtitle, and optional actions.
 *
 * Usage:
 *   <PageHeader title="Mi Trabajo" subtitle="Panel personal" icon={User}>
 *     <button>Action</button>
 *   </PageHeader>
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PageHeader({
    title,
    subtitle,
    icon: Icon,
    badge,
    badgeColor = 'indigo',
    children,
    showBack = true,
    backTo,
    className = '',
}) {
    const navigate = useNavigate();

    const badgeColors = {
        indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
        emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        violet: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
        blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };

    const handleBack = () => {
        if (backTo) {
            navigate(backTo);
        } else {
            navigate(-1);
        }
    };

    return (
        <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${className}`}>
            <div className="flex items-start gap-3 min-w-0">
                {showBack && (
                    <button
                        onClick={handleBack}
                        className="mt-1 w-9 h-9 md:w-10 md:h-10 rounded-xl bg-slate-800/70 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all duration-200 active:scale-95 shrink-0"
                        title="Volver"
                    >
                        <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                )}
                <div className="min-w-0">
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2 md:gap-3 flex-wrap">
                        {Icon && (
                            <div className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                                <Icon className="w-5 h-5 text-indigo-400" />
                            </div>
                        )}
                        <span className="truncate">{title}</span>
                        {badge && (
                            <span className={`text-xs px-2.5 py-1 rounded-lg uppercase tracking-widest leading-none border font-bold ${badgeColors[badgeColor] || badgeColors.indigo}`}>
                                {badge}
                            </span>
                        )}
                    </h1>
                    {subtitle && (
                        <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 ml-1">{subtitle}</p>
                    )}
                </div>
            </div>
            {children && (
                <div className="flex items-center gap-2 shrink-0">
                    {children}
                </div>
            )}
        </div>
    );
}
