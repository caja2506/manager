import React, { useState, useMemo } from 'react';
import {
    HeartPulse, CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
    ListChecks, Clock, User, CalendarDays, Link2, Layers, Target
} from 'lucide-react';

/**
 * TaskHealthScore — expert-level quality indicator for task definition.
 *
 * Calculates a 0-100 "Health Score" based on how well-defined the task is:
 *   - Subtareas definidas      (15 pts) — at least 1 subtask
 *   - Estimación de horas      (20 pts) — estimatedHours > 0
 *   - Responsable asignado     (20 pts) — assignedTo is set
 *   - Fecha límite             (15 pts) — dueDate is set
 *   - Tipo de tarea definido   (10 pts) — taskTypeId is set
 *   - Descripción completa     (10 pts) — description has 10+ chars
 *   - Milestone asignado       (10 pts) — milestoneId is set (SOLO tareas críticas)
 *
 * Shows a radial/linear visual + expandable checklist of what's missing.
 */

const CRITERIA = [
    {
        key: 'subtasks',
        label: 'Subtareas definidas',
        icon: ListChecks,
        weight: 15,
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
        weight: 10,
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
    {
        key: 'milestone',
        label: 'Milestone asignado',
        icon: Target,
        weight: 10,
        // Solo aplica a tareas críticas — si no es crítica, pasa automáticamente
        check: (ctx) => ctx.form.priority !== 'critical' || !!ctx.form.milestoneId,
        hint: '⚠ Esta tarea es crítica. Asígnala a un milestone para seguimiento de score',
        criticalOnly: true,
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
        form.taskTypeId, form.description, form.milestoneId, form.priority,
        subtaskCount,
    ]);

    const theme = getScoreTheme(score);
    const passedCount = results.filter(r => r.passed).length;
    const failedResults = results.filter(r => !r.passed);

    return (
        <div className={`relative rounded-xl border ${theme.border} ${theme.bgFaded} transition-all duration-300 w-full`}>
            {/* Main block */}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between gap-2.5 px-3 py-1.5 outline-none group"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-8 h-8 flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-800" strokeWidth="4" />
                            <circle 
                                cx="18" cy="18" r="16" fill="none" 
                                className={`stroke-current ${theme.color} transition-all duration-1000 ease-out`} 
                                strokeWidth="4" strokeDasharray="100" strokeDashoffset={100 - score} strokeLinecap="round" 
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-[9px] font-black ${theme.color}`}>{score}</span>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0 text-left flex flex-col justify-center">
                        <div className="flex items-center gap-1.5 leading-none mb-0.5">
                            <HeartPulse className={`w-3 h-3 ${theme.color} flex-shrink-0`} />
                            <span className="text-[10px] font-black text-white tracking-wide uppercase leading-none mt-0.5">HEALTH SCORE</span>
                            <span className={`text-[10px] font-bold ${theme.color} leading-none mt-0.5`}>{theme.label}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-none">
                            {passedCount}/{results.length} criterios cumplidos — {failedResults.length} pendientes
                        </p>
                    </div>
                </div>

                {/* Expand chevron */}
                {expanded
                    ? <ChevronUp className={`w-3.5 h-3.5 ${theme.color} opacity-60 flex-shrink-0`} />
                    : <ChevronDown className={`w-3.5 h-3.5 ${theme.color} opacity-60 flex-shrink-0`} />
                }
            </button>

            {/* Expanded checklist */}
            {expanded && (
                <div className={`absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border-2 border-slate-700/50 shadow-2xl p-3 lg:p-4 space-y-1.5 animate-in fade-in slide-in-from-top-2 bg-slate-900`}>
                    {results.map(r => {
                        const Icon = r.icon;
                        return (
                            <div
                                key={r.key}
                                className={`flex items-start gap-2.5 px-2 py-1.5 rounded-lg transition-all ${
                                    r.passed ? 'opacity-60' : 'bg-slate-800/80 shadow-inner'
                                }`}
                            >
                                {r.passed ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <Icon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                        <span className={`text-[11px] font-bold ${
                                            r.passed ? 'text-slate-500 line-through' : 'text-slate-200'
                                        }`}>
                                            {r.label}
                                        </span>
                                        <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${
                                            r.passed
                                                ? 'bg-emerald-500/15 text-emerald-400'
                                                : 'bg-slate-700 text-slate-300'
                                        }`}>
                                            {r.weight}pts
                                        </span>
                                    </div>
                                    {!r.passed && (
                                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight ml-4.5">
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
