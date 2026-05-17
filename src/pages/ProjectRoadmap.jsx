/**
 * Master Project Plan — Roadmap Multi-Proyecto
 * =============================================
 * Gantt-style horizontal view where each row is a project and bars are milestones.
 * Color-coded by milestone type (phase). Shows all projects simultaneously.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Map, ChevronLeft, ChevronRight, Loader2, Calendar,
    AlertTriangle, CheckCircle2, Clock, Target, Activity,
    TrendingUp, Flag, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import { getAllMilestones } from '../services/milestoneService';
import { useEngineeringData } from '../hooks/useEngineeringData';

// ── Phase Color Map ──
const PHASE_COLORS = {
    'Construction/Fabrication': { bg: '#38BDF8', text: '#0C4A6E', label: 'Construction' },
    'Debugging':               { bg: '#1E3A8A', text: '#BFDBFE', label: 'Debug' },
    'Desing reviews':          { bg: '#8B5CF6', text: '#EDE9FE', label: 'Design Rev.' },
    'Design reviews':          { bg: '#8B5CF6', text: '#EDE9FE', label: 'Design Rev.' },
    'Electrical Design':       { bg: '#6366F1', text: '#E0E7FF', label: 'Elec. Design' },
    'Initial Project Documents': { bg: '#94A3B8', text: '#0F172A', label: 'Init. Docs' },
    'Installation':            { bg: '#14B8A6', text: '#042F2E', label: 'Installation' },
    'Machnine technical documents': { bg: '#64748B', text: '#F1F5F9', label: 'Tech. Docs' },
    'Machine technical documents':  { bg: '#64748B', text: '#F1F5F9', label: 'Tech. Docs' },
    'Mechanical Desing':       { bg: '#3B82F6', text: '#EFF6FF', label: 'Mech. Design' },
    'Mechanical Design':       { bg: '#3B82F6', text: '#EFF6FF', label: 'Mech. Design' },
    'Mechanical inspection & Assembly': { bg: '#06B6D4', text: '#042F2E', label: 'Mech. Insp.' },
    'Parts receiving':         { bg: '#F59E0B', text: '#451A03', label: 'Parts Recv.' },
    'Procurement':             { bg: '#F97316', text: '#431407', label: 'Procurement' },
    'Production Documents':    { bg: '#FB923C', text: '#431407', label: 'Prod. Docs' },
    'Programming':             { bg: '#10B981', text: '#022C22', label: 'Programming' },
    'Transferring to manufacturing area': { bg: '#84CC16', text: '#1A2E05', label: 'Transfer' },
    'Validation documents':    { bg: '#E8935A', text: '#431407', label: 'Validation' },
};

const STATUS_OVERRIDE = {
    completed: { bg: '#22C55E', text: '#052E16' },
    on_hold:   { bg: '#EF4444', text: '#FEE2E2' },
    delayed:   { bg: '#EF4444', text: '#FEE2E2' },
    cancelled: { bg: '#6B7280', text: '#F9FAFB' },
};

function getPhaseColor(milestone) {
    // Status overrides take priority
    if (STATUS_OVERRIDE[milestone.status]) {
        return { ...STATUS_OVERRIDE[milestone.status], label: milestone.type || milestone.name };
    }
    // Then try type match
    const typeName = milestone.type || milestone.name || '';
    return PHASE_COLORS[typeName] || { bg: '#64748B', text: '#F1F5F9', label: typeName };
}

// ── Date Helpers ──
function addMonths(date, n) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + n);
    return d;
}

function getMonthStart(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function formatMonthLabel(date) {
    return date.toLocaleDateString('es-CR', { month: 'short', year: 'numeric' });
}

function daysBetween(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// ── Main Component ──
export default function ProjectRoadmap() {
    const { engProjects, milestoneTypes } = useEngineeringData();
    const [allMilestones, setAllMilestones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [monthsVisible, setMonthsVisible] = useState(12);
    const [startMonth, setStartMonth] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1); // start 1 month before today
        return getMonthStart(d);
    });
    const [hoveredMs, setHoveredMs] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    // Load ALL milestones once
    useEffect(() => {
        (async () => {
            const ms = await getAllMilestones();
            setAllMilestones(ms);
            setLoading(false);
        })();
    }, []);

    // Active projects (not cancelled), sorted
    const projects = useMemo(() => {
        return (engProjects || [])
            .filter(p => p.status !== 'cancelled')
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [engProjects]);

    // Group milestones by project
    const milestonesByProject = useMemo(() => {
        const map = {};
        for (const m of allMilestones) {
            if (!map[m.projectId]) map[m.projectId] = [];
            map[m.projectId].push(m);
        }
        return map;
    }, [allMilestones]);

    // Generate month columns
    const months = useMemo(() => {
        const result = [];
        for (let i = 0; i < monthsVisible; i++) {
            const d = addMonths(startMonth, i);
            result.push({
                date: d,
                year: d.getFullYear(),
                month: d.getMonth(),
                label: formatMonthLabel(d),
                days: getDaysInMonth(d.getFullYear(), d.getMonth()),
            });
        }
        return result;
    }, [startMonth, monthsVisible]);

    // Total days in visible range
    const totalDays = useMemo(() => months.reduce((s, m) => s + m.days, 0), [months]);
    const rangeStart = months[0]?.date || new Date();
    const rangeEnd = addMonths(startMonth, monthsVisible);

    // Today position
    const todayOffset = useMemo(() => {
        const now = new Date();
        const days = daysBetween(rangeStart, now);
        return Math.max(0, Math.min(100, (days / totalDays) * 100));
    }, [rangeStart, totalDays]);

    // Calculate bar position for a milestone
    const getBarStyle = useCallback((ms) => {
        if (!ms.startDate && !ms.dueDate) return null;
        const start = ms.startDate ? new Date(ms.startDate) : new Date(ms.dueDate);
        const end = ms.dueDate ? new Date(ms.dueDate) : addMonths(start, 1);
        const startDay = daysBetween(rangeStart, start);
        const endDay = daysBetween(rangeStart, end);
        const left = Math.max(0, (startDay / totalDays) * 100);
        const right = Math.min(100, (endDay / totalDays) * 100);
        const width = Math.max(0.5, right - left); // min 0.5% width
        if (right < 0 || left > 100) return null; // completely out of range
        return { left: `${left}%`, width: `${width}%` };
    }, [rangeStart, totalDays]);

    // Navigation
    const navigate = (dir) => setStartMonth(prev => addMonths(prev, dir * 3));
    const goToday = () => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        setStartMonth(getMonthStart(d));
    };
    const zoomIn = () => setMonthsVisible(prev => Math.max(6, prev - 3));
    const zoomOut = () => setMonthsVisible(prev => Math.min(24, prev + 3));

    // Stats
    const stats = useMemo(() => {
        const total = allMilestones.length;
        const withDates = allMilestones.filter(m => m.startDate || m.dueDate).length;
        const completed = allMilestones.filter(m => m.status === 'completed').length;
        const overdue = allMilestones.filter(m => {
            if (!m.dueDate || m.status === 'completed') return false;
            return new Date(m.dueDate) < new Date();
        }).length;
        return { total, withDates, completed, overdue, projects: projects.length };
    }, [allMilestones, projects]);

    // Legend — unique types in use
    const legendItems = useMemo(() => {
        const used = new Set(allMilestones.map(m => m.type || m.name));
        return [...used].map(type => ({ type, ...getPhaseColor({ type, status: 'active' }) })).sort((a, b) => a.label.localeCompare(b.label));
    }, [allMilestones]);

    // Tooltip handler
    const handleBarHover = (ms, e) => {
        setHoveredMs(ms);
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    };

    if (loading && projects.length === 0) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
        );
    }

    const COL_WIDTH = 180; // px per month
    const ROW_HEIGHT = 44;
    const PROJECT_COL = 160;

    return (
        <div className="min-h-screen bg-slate-950 p-3 md:p-5">
            <div className="max-w-full mx-auto">
                {/* ═══ Header ═══ */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/20">
                            <Map className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-white tracking-tight">Master Project Plan</h1>
                            <p className="text-[10px] text-slate-500">AME TIJ — Vista de portafolio completo</p>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Zoom */}
                        <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 p-0.5 h-8">
                            <button onClick={zoomIn} className="p-1.5 text-slate-400 hover:text-white transition" title="Zoom in">
                                <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] text-slate-400 font-bold px-1">{monthsVisible}m</span>
                            <button onClick={zoomOut} className="p-1.5 text-slate-400 hover:text-white transition" title="Zoom out">
                                <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 p-0.5 h-8">
                            <button onClick={() => navigate(-1)} className="p-1.5 text-slate-400 hover:text-white transition">
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={goToday} className="px-2 text-[10px] font-bold text-slate-300 hover:text-white transition h-full">
                                Hoy
                            </button>
                            <button onClick={() => navigate(1)} className="p-1.5 text-slate-400 hover:text-white transition">
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Range label */}
                        <div className="flex items-center gap-1 px-2.5 bg-slate-800/60 rounded-lg border border-slate-700/50 h-8">
                            <Calendar className="w-3 h-3 text-indigo-400" />
                            <span className="text-[10px] font-semibold text-slate-200">
                                {formatMonthLabel(rangeStart)} — {formatMonthLabel(addMonths(startMonth, monthsVisible - 1))}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ═══ Stats Bar ═══ */}
                <div className="flex items-center gap-3 mb-3 overflow-x-auto scrollbar-none">
                    <StatChip icon={Target} label="Proyectos" value={stats.projects} color="indigo" />
                    <StatChip icon={Activity} label="Milestones" value={stats.total} color="violet" />
                    <StatChip icon={Calendar} label="Con fechas" value={stats.withDates} color="blue" />
                    <StatChip icon={CheckCircle2} label="Completados" value={stats.completed} color="green" />
                    {stats.overdue > 0 && <StatChip icon={AlertTriangle} label="Vencidos" value={stats.overdue} color="red" />}
                </div>

                {/* ═══ Legend ═══ */}
                {legendItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4 px-1">
                        {legendItems.map(item => (
                            <div key={item.type} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/50 border border-slate-700/30">
                                <div className="w-3 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: item.bg }} />
                                <span className="text-[9px] font-bold text-slate-400">{item.label}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ═══ Gantt Grid ═══ */}
                <div className="bg-slate-800/30 rounded-2xl border border-slate-700/30 overflow-hidden">
                    <div className="overflow-x-auto">
                        <div style={{ minWidth: `${PROJECT_COL + COL_WIDTH * monthsVisible}px` }}>
                            {/* Month Headers */}
                            <div className="flex border-b border-slate-700/50 sticky top-0 z-20 bg-slate-900/95 backdrop-blur-sm">
                                {/* Project column header */}
                                <div className="flex-shrink-0 flex items-center px-3 py-2 border-r border-slate-700/50 font-bold text-[10px] text-slate-500 uppercase tracking-wider"
                                    style={{ width: PROJECT_COL }}>
                                    Proyecto
                                </div>
                                {/* Month columns */}
                                <div className="flex-1 flex">
                                    {months.map((m, i) => (
                                        <div key={i} className="flex flex-col border-r border-slate-700/30 text-center"
                                            style={{ width: COL_WIDTH }}>
                                            <div className="text-[10px] font-bold text-slate-300 py-1 border-b border-slate-700/20 capitalize">
                                                {m.label}
                                            </div>
                                            <div className="flex">
                                                <div className="flex-1 text-[8px] text-slate-600 py-0.5 border-r border-slate-700/15">Q1</div>
                                                <div className="flex-1 text-[8px] text-slate-600 py-0.5">Q2</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Project Rows */}
                            {projects.map((project, pi) => {
                                const pMilestones = milestonesByProject[project.id] || [];
                                const hasAny = pMilestones.length > 0;
                                const hasDates = pMilestones.some(m => m.startDate || m.dueDate);

                                return (
                                    <div key={project.id}
                                        className={`flex border-b border-slate-700/20 transition-colors ${pi % 2 === 0 ? 'bg-slate-800/10' : 'bg-slate-800/25'} hover:bg-slate-700/20`}
                                        style={{ height: ROW_HEIGHT }}>
                                        {/* Project Name */}
                                        <div className="flex-shrink-0 flex items-center px-3 border-r border-slate-700/30 gap-2"
                                            style={{ width: PROJECT_COL }}>
                                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                project.status === 'completed' ? 'bg-emerald-500' :
                                                project.status === 'on_hold' ? 'bg-amber-500' :
                                                'bg-indigo-500'
                                            }`} />
                                            <span className="text-xs font-bold text-white truncate" title={project.name}>
                                                {project.name}
                                            </span>
                                            {!hasAny && (
                                                <span className="text-[8px] text-slate-600 ml-auto">sin fases</span>
                                            )}
                                        </div>

                                        {/* Timeline area */}
                                        <div className="flex-1 relative">
                                            {/* Today line */}
                                            <div className="absolute top-0 bottom-0 w-px bg-indigo-500/60 z-10"
                                                style={{ left: `${todayOffset}%` }} />

                                            {/* Milestone bars */}
                                            {pMilestones.map(ms => {
                                                const barStyle = getBarStyle(ms);
                                                if (!barStyle) return null;
                                                const pc = getPhaseColor(ms);
                                                return (
                                                    <div
                                                        key={ms.id}
                                                        className="absolute top-1/2 -translate-y-1/2 rounded-md cursor-pointer transition-all hover:brightness-110 hover:shadow-lg hover:z-30 group"
                                                        style={{
                                                            left: barStyle.left,
                                                            width: barStyle.width,
                                                            height: '26px',
                                                            backgroundColor: pc.bg,
                                                            minWidth: '8px',
                                                        }}
                                                        onMouseEnter={(e) => handleBarHover(ms, e)}
                                                        onMouseLeave={() => setHoveredMs(null)}
                                                    >
                                                        {/* Bar label */}
                                                        <div className="absolute inset-0 flex items-center px-1.5 overflow-hidden">
                                                            <span className="text-[9px] font-bold truncate whitespace-nowrap"
                                                                style={{ color: pc.text }}>
                                                                {pc.label}
                                                            </span>
                                                        </div>
                                                        {/* Completed check */}
                                                        {ms.status === 'completed' && (
                                                            <CheckCircle2 className="absolute -right-1 -top-1 w-3 h-3 text-emerald-300 drop-shadow" />
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* No-dates indicator */}
                                            {hasAny && !hasDates && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-[9px] text-slate-600 italic">
                                                        {pMilestones.length} fase{pMilestones.length > 1 ? 's' : ''} sin fechas
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Empty state */}
                            {projects.length === 0 && (
                                <div className="flex items-center justify-center py-16">
                                    <div className="text-center">
                                        <Map className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                                        <p className="text-sm text-slate-500 font-bold">No hay proyectos activos</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Today label at bottom */}
                    <div className="relative h-5 border-t border-slate-700/30">
                        <div className="absolute top-0 flex flex-col items-center z-10" style={{ left: `calc(${PROJECT_COL}px + (100% - ${PROJECT_COL}px) * ${todayOffset / 100})` }}>
                            <div className="w-px h-2 bg-indigo-500" />
                            <span className="text-[8px] font-black text-indigo-400 -translate-x-1/2">HOY</span>
                        </div>
                    </div>
                </div>

                {/* ═══ Footer info ═══ */}
                <div className="flex items-center justify-between mt-3 px-1">
                    <p className="text-[10px] text-slate-600">
                        {stats.total - stats.withDates > 0 && (
                            <span className="text-amber-500/80">
                                ⚠ {stats.total - stats.withDates} milestone{stats.total - stats.withDates > 1 ? 's' : ''} sin fechas asignadas
                            </span>
                        )}
                    </p>
                    <p className="text-[10px] text-slate-600">
                        Última actualización: {new Date().toLocaleDateString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </div>

            {/* ═══ Floating Tooltip ═══ */}
            {hoveredMs && (
                <div className="fixed z-50 pointer-events-none"
                    style={{ left: tooltipPos.x, top: tooltipPos.y, transform: 'translate(-50%, -100%)' }}>
                    <div className="bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 shadow-2xl min-w-[200px]">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: getPhaseColor(hoveredMs).bg }} />
                            <p className="text-xs font-black text-white">{hoveredMs.type || hoveredMs.name}</p>
                        </div>
                        <div className="space-y-1 text-[10px]">
                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500">Proyecto</span>
                                <span className="text-slate-300 font-bold">
                                    {projects.find(p => p.id === hoveredMs.projectId)?.name || '—'}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500">Inicio</span>
                                <span className="text-slate-300">{hoveredMs.startDate ? new Date(hoveredMs.startDate).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha'}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500">Fin</span>
                                <span className="text-slate-300">{hoveredMs.dueDate ? new Date(hoveredMs.dueDate).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha'}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500">Estado</span>
                                <span className={`font-bold capitalize ${
                                    hoveredMs.status === 'completed' ? 'text-emerald-400' :
                                    hoveredMs.status === 'on_hold' ? 'text-amber-400' :
                                    'text-slate-300'
                                }`}>{hoveredMs.status?.replace('_', ' ')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Stat Chip ──
function StatChip({ icon: Icon, label, value, color }) {
    const colors = {
        indigo: 'text-indigo-400 bg-indigo-500/10',
        violet: 'text-violet-400 bg-violet-500/10',
        blue: 'text-blue-400 bg-blue-500/10',
        green: 'text-emerald-400 bg-emerald-500/10',
        red: 'text-red-400 bg-red-500/10',
    };
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold ${colors[color] || colors.indigo}`}>
            <Icon className="w-3.5 h-3.5" />
            <span className="text-slate-500 font-medium">{label}</span>
            <span>{value}</span>
        </div>
    );
}
