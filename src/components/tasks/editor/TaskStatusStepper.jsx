import React from 'react';
import { ChevronRight, ShieldOff, RotateCcw } from 'lucide-react';
import {
    TASK_STATUS, TASK_STATUS_CONFIG,
} from '../../../models/schemas';

/**
 * TaskStatusStepper — horizontal workflow stepper matching the design mockup.
 * Shows numbered steps: 1 BACKLOG → 2 PENDIENTE → 3 EN PROGRESO → 4 VALIDACIÓN → 5 COMPLETADO
 * 
 * Now handles BLOCKED and CANCELLED states with special action buttons.
 */

const STATUS_FLOW = [
    TASK_STATUS.BACKLOG,
    TASK_STATUS.PENDING,
    TASK_STATUS.IN_PROGRESS,
    TASK_STATUS.VALIDATION,
    TASK_STATUS.COMPLETED,
];

// Tailwind-safe color classes for each status (hex-keyed from TASK_STATUS_CONFIG)
const STATUS_COLORS = {
    '#64748b': { text: 'text-slate-400', activeBg: 'bg-slate-500', activeText: 'text-white', ring: 'ring-slate-500' },
    '#ef4444': { text: 'text-red-400', activeBg: 'bg-red-500', activeText: 'text-white', ring: 'ring-red-500' },
    '#f59e0b': { text: 'text-amber-400', activeBg: 'bg-amber-500', activeText: 'text-white', ring: 'ring-amber-500' },
    '#8b5cf6': { text: 'text-purple-400', activeBg: 'bg-purple-500', activeText: 'text-white', ring: 'ring-purple-500' },
    '#22c55e': { text: 'text-emerald-400', activeBg: 'bg-emerald-500', activeText: 'text-white', ring: 'ring-emerald-500' },
    '#6b7280': { text: 'text-gray-400', activeBg: 'bg-gray-500', activeText: 'text-white', ring: 'ring-gray-500' },
};

export default function TaskStatusStepper({ currentStatus, onStatusChange, canEdit }) {
    const isBlocked = currentStatus === TASK_STATUS.BLOCKED;
    const isCancelled = currentStatus === TASK_STATUS.CANCELLED;
    const isSpecialState = isBlocked || isCancelled;
    const activeIdx = STATUS_FLOW.indexOf(currentStatus);

    return (
        <div className="border-b border-slate-800 flex-shrink-0">
            {/* Special state banner */}
            {isSpecialState && (
                <div className={`flex items-center justify-between px-4 py-2.5 ${isBlocked
                    ? 'bg-red-500/10 border-b border-red-500/20'
                    : 'bg-gray-500/10 border-b border-gray-500/20'
                    }`}>
                    <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${isBlocked ? 'bg-red-500' : 'bg-gray-500'
                            }`} />
                        <span className={`text-xs font-black uppercase tracking-wider ${isBlocked ? 'text-red-400' : 'text-gray-400'
                            }`}>
                            {isBlocked ? '🚫 Tarea Bloqueada' : '⛔ Tarea Cancelada'}
                        </span>
                    </div>
                    {canEdit && (
                        <button
                            onClick={() => onStatusChange(
                                isBlocked ? TASK_STATUS.IN_PROGRESS : TASK_STATUS.BACKLOG
                            )}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 ${isBlocked
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-500'
                                : 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500'
                                }`}
                        >
                            {isBlocked ? (
                                <>
                                    <ShieldOff className="w-3.5 h-3.5" />
                                    Desbloquear
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Reactivar
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}

            {/* Normal flow stepper */}
            <div className="flex items-center gap-0 overflow-x-auto py-2 md:py-3 px-3 md:px-4 lg:px-5 scrollbar-none">
                {STATUS_FLOW.map((s, idx) => {
                    const cfg = TASK_STATUS_CONFIG[s];
                    const colors = STATUS_COLORS[cfg.color] || STATUS_COLORS['#64748b'];
                    const isActive = currentStatus === s;
                    const isPast = !isSpecialState && activeIdx > idx;
                    const stepNum = idx + 1;

                    return (
                        <React.Fragment key={s}>
                            <button
                                onClick={() => canEdit && !isSpecialState && onStatusChange(s)}
                                disabled={!canEdit || isSpecialState}
                                title={isSpecialState
                                    ? (isBlocked ? 'Desbloquea la tarea primero' : 'Reactiva la tarea primero')
                                    : `Cambiar a ${cfg.label}`
                                }
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${isActive
                                    ? `${colors.activeBg} ${colors.activeText} shadow-md scale-[1.03]`
                                    : isSpecialState
                                        ? 'text-slate-700 cursor-not-allowed opacity-50'
                                        : isPast
                                            ? `text-slate-500 hover:text-slate-300`
                                            : `text-slate-600 hover:text-slate-400`
                                    }`}
                            >
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${isActive
                                    ? 'bg-white/20 text-white'
                                    : isPast && !isSpecialState
                                        ? `${colors.activeBg} text-white`
                                        : 'bg-slate-800 text-slate-500'
                                    }`}>
                                    {stepNum}
                                </span>
                                {cfg.label}
                            </button>
                            {idx < STATUS_FLOW.length - 1 && (
                                <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 mx-0.5 ${isPast && !isSpecialState ? 'text-slate-600' : 'text-slate-700'
                                    }`} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
