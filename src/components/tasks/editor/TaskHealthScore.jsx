import React, { useState, useMemo } from 'react';
import {
    HeartPulse, CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
    ListChecks, Clock, User, CalendarDays, Link2, Layers
} from 'lucide-react';

/**
 * TaskHealthScore — expert-level quality indicator for task definition.
 *
 * Calculates a 0-100 "Health Score" based on how well-defined the task is:
 *   - Subtareas definidas      (20 pts) — at least 1 subtask
 *   - Estimación de horas      (20 pts) — estimatedHours > 0
 *   - Responsable asignado     (20 pts) — assignedTo is set
 *   - Fecha límite             (15 pts) — dueDate is set
 *   - Tipo de tarea definido   (10 pts) — taskTypeId is set
 *   - Descripción completa     (15 pts) — description has 10+ chars
 *
 * Shows a radial/linear visual + expandable checklist of what's missing.
 */

const CRITERIA = [
    {
        key: 'subtasks',
        label: 'Subtareas definidas',
        icon: ListChecks,
        weight: 20,
        check: (ctx) => ctx.subtaskCount > 0,
        hint: 'Agrega al menos una subtarea para desglosar el trabajo',
    },
    {
        key: 'estimation',
        label: 'Estimación de horas',
        icon: Clock,
        weight: 20,
        check: (ctx) => Number(ctx.form.estimatedHours) > 0,
        hint: 'Define las horas estimadas para esta tarea',
    },
    {
        key: 'assignee',
        label: 'Responsable asignado',
        icon: User,
        weight: 20,
        check: (ctx) => !!ctx.form.assignedTo,
        hint: 'Asigna un responsable para esta tarea',
    },
    {
        key: 'dueDate',
        label: 'Fecha límite',
        icon: CalendarDays,
        weight: 15,
        check: (ctx) => !!ctx.form.dueDate,
        hint: 'Establece una fecha límite',
    },
    {
        key: 'description',
        label: 'Descripción completa',
        icon: Layers,
        weight: 15,
        check: (ctx) => (ctx.form.description || '').trim().length >= 10,
        hint: 'Agrega una descripción detallada (mín. 10 caracteres)',
    },
    {
        key: 'taskType',
        label: 'Tipo de tarea',
        icon: Link2,
        weight: 10,
        check: (ctx) => !!ctx.form.taskTypeId,
        hint: 'Selecciona el tipo de tarea',
    },
];

/** Get the color scheme based on the score */
function getScoreTheme(score) {
    if (score >= 80) return {
        color: 'text-emerald-400',
        bg: 'bg-emerald-500',
        bgFaded: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        ring: 'ring-emerald-500/20',
        gradient: 'from-emerald-500 to-teal-400',
        label: 'Excelente',
    };
    if (score >= 60) return {
        color: 'text-amber-400',
        bg: 'bg-amber-500',
        bgFaded: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        ring: 'ring-amber-500/20',
        gradient: 'from-amber-500 to-yellow-400',
        label: 'Bueno',
    };
    if (score >= 40) return {
        color: 'text-orange-400',
        bg: 'bg-orange-500',
        bgFaded: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        ring: 'ring-orange-500/20',
        gradient: 'from-orange-500 to-amber-400',
        label: 'Regular',
    };
    return {
        color: 'text-red-400',
        bg: 'bg-red-500',
        bgFaded: 'bg-red-500/10',
        border: 'border-red-500/30',
        ring: 'ring-red-500/20',
        gradient: 'from-red-500 to-rose-400',
        label: 'Necesita mejoras',
    };
}

export default function TaskHealthScore({ form, subtaskCount = 0 }) {
    const [expanded, setExpanded] = useState(false);

    const { score, results } = useMemo(() => {
        const ctx = { form, subtaskCount };
        let total = 0;
        const res = CRITERIA.map(c => {
            const passed = c.check(ctx);
            if (passed) total += c.weight;
            return { ...c, passed };
        });
        return { score: total, results: res };
    }, [
        form.assignedTo, form.estimatedHours, form.dueDate,
        form.taskTypeId, form.description, subtaskCount,
    ]);

    const theme = getScoreTheme(score);
    const passedCount = results.filter(r => r.passed).length;
    const failedResults = results.filter(r => !r.passed);

    return (
        <div className={`mx-4 lg:mx-5 rounded-xl border ${theme.border} ${theme.bgFaded} overflow-hidden transition-all duration-300`}>
            {/* Main bar — always visible */}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 group"
            >
                {/* Radial score indicator */}
                <div className="relative w-10 h-10 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        {/* Background circle  */}
                        <circle
                            cx="18" cy="18" r="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            className="text-slate-800"
                        />
                        {/* Score arc */}
                        <circle
                            cx="18" cy="18" r="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={`${(score / 100) * 87.96} 87.96`}
                            className={`${theme.color} transition-all duration-700 ease-out`}
                        />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-black ${theme.color}`}>
                        {score}
                    </span>
                </div>

                {/* Label */}
                <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-1.5">
                        <HeartPulse className={`w-3.5 h-3.5 ${theme.color} flex-shrink-0`} />
                        <span className="text-[11px] font-black text-slate-300 uppercase tracking-wide">
                            Health Score
                        </span>
                        <span className={`text-[10px] font-bold ${theme.color}`}>
                            {theme.label}
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                        {passedCount}/{results.length} criterios cumplidos
                        {failedResults.length > 0 && (
                            <span className="text-slate-600 ml-1">
                                — {failedResults.length} pendiente{failedResults.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </p>
                </div>

                {/* Expand chevron */}
                <div className={`p-1 rounded-lg transition-colors ${theme.color} opacity-60 group-hover:opacity-100`}>
                    {expanded
                        ? <ChevronUp className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5" />
                    }
                </div>
            </button>

            {/* Expanded checklist */}
            {expanded && (
                <div className="border-t border-slate-700/40 px-3.5 py-2.5 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    {results.map(r => {
                        const Icon = r.icon;
                        return (
                            <div
                                key={r.key}
                                className={`flex items-start gap-2 px-2 py-1.5 rounded-lg transition-all ${
                                    r.passed
                                        ? 'opacity-60'
                                        : 'bg-slate-800/40'
                                }`}
                            >
                                {r.passed ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <Icon className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                        <span className={`text-[11px] font-bold ${
                                            r.passed ? 'text-slate-500 line-through' : 'text-slate-300'
                                        }`}>
                                            {r.label}
                                        </span>
                                        <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${
                                            r.passed
                                                ? 'bg-emerald-500/15 text-emerald-400'
                                                : 'bg-slate-700 text-slate-400'
                                        }`}>
                                            {r.weight}pts
                                        </span>
                                    </div>
                                    {!r.passed && (
                                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight ml-4.5">
                                            💡 {r.hint}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
