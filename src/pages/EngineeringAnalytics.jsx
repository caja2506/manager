import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useEngineeringData } from '../hooks/useEngineeringData';
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
    LineChart as LineChartIcon, TrendingUp, AlertTriangle, Users,
    Calendar as CalendarIcon, Download, Clock, Briefcase, Award,
    Filter, X, ChevronDown, Check, FolderGit2, User
} from 'lucide-react';
import { format, subDays, isWithinInterval, startOfDay, endOfDay, parseISO, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { TASK_STATUS_CONFIG } from '../models/schemas';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

// --- Multi-select Dropdown Component ---
function MultiSelect({ label, icon: Icon, options, selected, onChange, allLabel = 'Todos' }) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isAll = selected.length === 0;
    const displayText = isAll ? allLabel : selected.length === 1
        ? options.find(o => o.value === selected[0])?.label || '1 seleccionado'
        : `${selected.length} seleccionados`;

    const toggle = (val) => {
        if (selected.includes(val)) {
            onChange(selected.filter(v => v !== val));
        } else {
            onChange([...selected, val]);
        }
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${!isAll ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
            >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate max-w-[120px]">{displayText}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-1 left-0 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden min-w-[200px] max-h-[280px] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                    {/* Select All / Clear */}
                    <button
                        onClick={() => onChange([])}
                        className={`w-full text-left px-3 py-2 text-sm font-bold flex items-center gap-2 border-b border-slate-700 transition-colors ${isAll ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:bg-slate-700'
                            }`}
                    >
                        {isAll && <Check className="w-3.5 h-3.5" />}
                        {allLabel}
                    </button>

                    {options.map(opt => {
                        const active = selected.includes(opt.value);
                        return (
                            <button
                                key={opt.value}
                                onClick={() => toggle(opt.value)}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${active ? 'text-indigo-300 bg-indigo-500/10 font-bold' : 'text-slate-300 hover:bg-slate-700 font-medium'
                                    }`}
                            >
                                {active && <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                                <span className="truncate">{opt.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function EngineeringAnalytics() {
    const { engProjects, engTasks, timeLogs, delays, teamMembers } = useEngineeringData();

    // --- Filter State ---
    const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedPersons, setSelectedPersons] = useState([]);   // empty = all
    const [selectedProjects, setSelectedProjects] = useState([]); // empty = all

    // --- Filter Options ---
    const personOptions = useMemo(() => {
        if (!teamMembers) return [];
        return teamMembers.map(m => ({
            value: m.uid || m.id,
            label: m.displayName || m.name || m.email?.split('@')[0] || 'Sin nombre'
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [teamMembers]);

    const projectOptions = useMemo(() => {
        if (!engProjects) return [];
        return engProjects.map(p => ({
            value: p.id,
            label: p.name || 'Sin nombre'
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [engProjects]);

    const hasActiveFilters = selectedPersons.length > 0 || selectedProjects.length > 0;

    // --- Core Analytics (all filtered) ---
    const analytics = useMemo(() => {
        if (!timeLogs || !engTasks || !engProjects || !delays) return null;

        // Parse dates (force local timezone)
        const startDate = startOfDay(new Date(dateFrom + 'T00:00:00'));
        const endDate = endOfDay(new Date(dateTo + 'T00:00:00'));

        // Helper: check if log passes person & project filters
        const passesFilters = (log) => {
            if (selectedPersons.length > 0 && !selectedPersons.includes(log.userId)) return false;
            if (selectedProjects.length > 0) {
                const task = log.taskId ? engTasks.find(t => t.id === log.taskId) : null;
                const projId = task?.projectId || log.projectId;
                if (!projId || !selectedProjects.includes(projId)) return false;
            }
            return true;
        };

        // ── Filtered time logs ──
        const filteredLogs = timeLogs.filter(log => {
            if (!log.startTime) return false;
            const logDate = new Date(log.startTime);
            if (!isWithinInterval(logDate, { start: startDate, end: endDate })) return false;
            return passesFilters(log);
        });

        // ---------------------------------------------------------
        // 1. TREND ANALYSIS
        // ---------------------------------------------------------
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const trendMap = new Map();
        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            trendMap.set(dateStr, {
                name: format(day, 'dd MMM', { locale: es }),
                productivas: 0,
                extras: 0
            });
        });

        let totalStandard = 0;
        let totalOvertime = 0;

        filteredLogs.forEach(log => {
            const dateStr = format(new Date(log.startTime), 'yyyy-MM-dd');
            if (trendMap.has(dateStr)) {
                const data = trendMap.get(dateStr);
                const tHrs = log.totalHours || 0;
                const oHrs = log.overtimeHours || 0;
                const sHrs = Math.max(0, tHrs - oHrs);

                data.productivas += sHrs;
                data.extras += oHrs;

                totalStandard += sHrs;
                totalOvertime += oHrs;
            }
        });

        // Smart label: show fewer labels when range is large
        const trendData = Array.from(trendMap.values()).map((d, i, arr) => {
            const showLabel = arr.length <= 14 || i % Math.ceil(arr.length / 14) === 0;
            return {
                ...d,
                displayName: showLabel ? d.name : '',
                productivas: parseFloat(d.productivas.toFixed(1)),
                extras: parseFloat(d.extras.toFixed(1))
            };
        });

        // ---------------------------------------------------------
        // 2. DELAYS BY CAUSE
        // ---------------------------------------------------------
        const delayMap = new Map();
        delays.forEach(d => {
            if (!d.createdAt) return;
            const dDate = new Date(d.createdAt);
            if (!isWithinInterval(dDate, { start: startDate, end: endDate })) return;
            // Person filter for delays
            if (selectedPersons.length > 0 && !selectedPersons.includes(d.createdBy)) return;
            // Project filter for delays
            if (selectedProjects.length > 0 && d.projectId && !selectedProjects.includes(d.projectId)) return;
            const cause = d.causeName || 'Desconocida';
            delayMap.set(cause, (delayMap.get(cause) || 0) + 1);
        });

        const delayData = Array.from(delayMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // top 5

        // ---------------------------------------------------------
        // 3. TEAM UTILIZATION (Pie Chart)
        // ---------------------------------------------------------
        const utilMap = new Map();
        filteredLogs.forEach(log => {
            const u = log.userId;
            utilMap.set(u, (utilMap.get(u) || 0) + (log.totalHours || 0));
        });

        const utilizationData = Array.from(utilMap.entries()).map(([uid, hours]) => {
            const usr = teamMembers.find(t => t.uid === uid);
            return {
                name: usr ? (usr.displayName || usr.name || usr.email?.split('@')[0]) : 'Desconocido',
                horas: parseFloat(hours.toFixed(1))
            };
        }).sort((a, b) => b.horas - a.horas).slice(0, 8);

        // ---------------------------------------------------------
        // 4. PROJECT COMPLETION (Bar)
        // ---------------------------------------------------------
        const filteredProjects = selectedProjects.length > 0
            ? engProjects.filter(p => selectedProjects.includes(p.id))
            : engProjects;

        const projectData = filteredProjects.map(p => {
            const pTasks = engTasks.filter(t => t.projectId === p.id);
            const total = pTasks.length;
            const completed = pTasks.filter(t => t.status === 'completed').length;
            return {
                name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
                completadas: completed,
                pendientes: total - completed,
                total
            };
        }).filter(p => p.total > 0).sort((a, b) => b.total - a.total).slice(0, 6);

        // ---------------------------------------------------------
        // 5. HOURS BY PROJECT (Donut)
        // ---------------------------------------------------------
        const projHoursMap = new Map();
        filteredLogs.forEach(log => {
            const task = log.taskId ? engTasks.find(t => t.id === log.taskId) : null;
            const projId = task?.projectId || log.projectId;
            const project = projId ? engProjects.find(p => p.id === projId) : null;
            const pName = project ? project.name : 'Sin proyecto';
            projHoursMap.set(pName, (projHoursMap.get(pName) || 0) + (log.totalHours || 0));
        });

        const projectHoursData = Array.from(projHoursMap.entries())
            .map(([name, hours]) => ({ name, horas: parseFloat(hours.toFixed(1)) }))
            .sort((a, b) => b.horas - a.horas)
            .slice(0, 6);

        return {
            trendData,
            totalStandard: parseFloat(totalStandard.toFixed(1)),
            totalOvertime: parseFloat(totalOvertime.toFixed(1)),
            delayData,
            utilizationData,
            projectData,
            projectHoursData,
            totalLogs: filteredLogs.length
        };
    }, [dateFrom, dateTo, selectedPersons, selectedProjects, timeLogs, engTasks, engProjects, delays, teamMembers]);

    const handleExport = () => {
        alert("Exportar a Excel en construcción (Módulo Analítico).");
    };

    const clearFilters = () => {
        setDateFrom(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
        setDateTo(format(new Date(), 'yyyy-MM-dd'));
        setSelectedPersons([]);
        setSelectedProjects([]);
    };

    // Quick presets
    const applyPreset = (days) => {
        setDateTo(format(new Date(), 'yyyy-MM-dd'));
        setDateFrom(format(subDays(new Date(), days), 'yyyy-MM-dd'));
    };

    if (!analytics) return <div className="p-8 text-center text-slate-400">Procesando cubos de datos...</div>;

    const totalStr = (analytics.totalStandard + analytics.totalOvertime).toFixed(1);

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* --- FILTER BAR (Power BI Style) --- */}
            <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg relative z-20">
                {/* Title row */}
                <div className="flex items-center justify-between p-4 pb-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center">
                            <LineChartIcon className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="font-black text-xl text-white tracking-tight">Analítica de Ingeniería</h2>
                            <p className="text-[11px] text-slate-500 font-bold">Filtros dinámicos · Datos en tiempo real</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                            >
                                <X className="w-3.5 h-3.5" /> Limpiar filtros
                            </button>
                        )}
                        <button
                            onClick={handleExport}
                            className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-md hover:bg-indigo-700 transition"
                            title="Exportar a Excel"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Filter controls */}
                <div className="p-4 flex flex-wrap items-center gap-3">
                    {/* Date Range */}
                    <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl p-1 pl-3">
                        <CalendarIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-slate-200 py-1 px-1 focus:ring-0 outline-none w-[120px]"
                        />
                        <span className="text-slate-500 text-xs font-bold">→</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            max={format(new Date(), 'yyyy-MM-dd')}
                            className="bg-transparent border-none text-sm font-bold text-slate-200 py-1 px-1 focus:ring-0 outline-none w-[120px]"
                        />
                    </div>

                    {/* Quick presets */}
                    <div className="flex gap-1">
                        {[
                            { label: '7d', days: 7 },
                            { label: '15d', days: 15 },
                            { label: '30d', days: 30 },
                            { label: '90d', days: 90 },
                        ].map(p => (
                            <button
                                key={p.days}
                                onClick={() => applyPreset(p.days)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-black text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Separator */}
                    <div className="w-px h-6 bg-slate-700" />

                    {/* Person Filter */}
                    <MultiSelect
                        label="Persona"
                        icon={User}
                        options={personOptions}
                        selected={selectedPersons}
                        onChange={setSelectedPersons}
                        allLabel="Todas las personas"
                    />

                    {/* Project Filter */}
                    <MultiSelect
                        label="Proyecto"
                        icon={FolderGit2}
                        options={projectOptions}
                        selected={selectedProjects}
                        onChange={setSelectedProjects}
                        allLabel="Todos los proyectos"
                    />

                    {/* Active filter summary */}
                    <div className="ml-auto text-[11px] text-slate-500 font-bold">
                        {analytics.totalLogs} registros · {totalStr} hrs
                    </div>
                </div>
            </div>

            {/* --- TOP KPIs SUMMARY --- */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
                    <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Horas Productivas</span>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="w-12 h-12 rounded-full bg-blue-500/15 flex items-center justify-center text-blue-400 shrink-0">
                            <Clock className="w-6 h-6" />
                        </div>
                        <span className="text-3xl font-black text-white">{analytics.totalStandard}</span>
                    </div>
                </div>

                <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
                    <span className="text-[10px] font-black tracking-wider text-amber-400 uppercase">Horas Extras</span>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0">
                            <Award className="w-6 h-6" />
                        </div>
                        <span className="text-3xl font-black text-white">{analytics.totalOvertime}</span>
                    </div>
                </div>

                <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
                    <span className="text-[10px] font-black tracking-wider text-rose-400 uppercase">Retrasos Periodo</span>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="w-12 h-12 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-400 shrink-0">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <span className="text-3xl font-black text-white">
                            {analytics.delayData.reduce((acc, d) => acc + d.count, 0)}
                        </span>
                    </div>
                </div>

                <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
                    <span className="text-[10px] font-black tracking-wider text-emerald-400 uppercase">Personas Activas</span>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                            <Users className="w-6 h-6" />
                        </div>
                        <span className="text-3xl font-black text-white">{analytics.utilizationData.length}</span>
                    </div>
                </div>
            </div>

            {/* --- CHARTS MAIN GRID --- */}
            <div className="grid lg:grid-cols-2 gap-5">

                {/* VELOCITY & TRENDS (AREA CHART) — full width */}
                <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg lg:col-span-2 relative">
                    <div className="flex items-center gap-2 mb-5">
                        <TrendingUp className="w-5 h-5 text-indigo-400" />
                        <h3 className="font-bold text-lg text-white">Inversión de Tiempo (Tendencia)</h3>
                    </div>
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analytics.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorOvr" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                <XAxis dataKey="displayName" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
                                    contentStyle={{ borderRadius: '16px', border: '1px solid #334155', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', backgroundColor: '#1e293b', color: '#e2e8f0' }}
                                    cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                                <Area type="monotone" name="Productivas" dataKey="productivas" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorProd)" />
                                <Area type="monotone" name="Extras" dataKey="extras" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorOvr)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* DELAY ANALYSIS (BAR CHART) */}
                <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg relative">
                    <div className="flex items-center gap-2 mb-5">
                        <AlertTriangle className="w-5 h-5 text-rose-400" />
                        <h3 className="font-bold text-lg text-white">Top 5 Causas de Retraso</h3>
                    </div>
                    {analytics.delayData.length === 0 ? (
                        <div className="h-[250px] flex items-center justify-center text-slate-400 font-bold">No hay retrasos en este periodo.</div>
                    ) : (
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.delayData} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                                    <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)', backgroundColor: '#1e293b', color: '#e2e8f0' }} />
                                    <Bar dataKey="count" name="Incidencias" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* HOURS BY PROJECT (Donut) */}
                <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg relative">
                    <div className="flex items-center gap-2 mb-5">
                        <FolderGit2 className="w-5 h-5 text-purple-400" />
                        <h3 className="font-bold text-lg text-white">Horas por Proyecto</h3>
                    </div>
                    {analytics.projectHoursData.length === 0 ? (
                        <div className="h-[250px] flex items-center justify-center text-slate-400 font-bold">Sin datos en este periodo.</div>
                    ) : (
                        <div className="flex flex-col md:flex-row h-[250px]">
                            <div className="flex-1 min-w-[180px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analytics.projectHoursData}
                                            cx="50%" cy="50%"
                                            innerRadius={50} outerRadius={85}
                                            paddingAngle={3}
                                            dataKey="horas"
                                        >
                                            {analytics.projectHoursData.map((_, index) => (
                                                <Cell key={`cell-proj-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex-1 flex flex-col justify-center px-3 space-y-2 overflow-y-auto">
                                {analytics.projectHoursData.map((entry, index) => (
                                    <div key={index} className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                            <span className="font-bold text-slate-300 text-xs truncate max-w-[130px]">{entry.name}</span>
                                        </div>
                                        <span className="font-black text-slate-400 text-xs">{entry.horas}h</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* PROJECT COMPLETION (STACKED BAR CHART) */}
                <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg relative">
                    <div className="flex items-center gap-2 mb-5">
                        <Briefcase className="w-5 h-5 text-indigo-400" />
                        <h3 className="font-bold text-lg text-white">Completitud por Proyecto</h3>
                    </div>
                    {analytics.projectData.length === 0 ? (
                        <div className="h-[250px] flex items-center justify-center text-slate-400 font-bold">No hay proyectos activos.</div>
                    ) : (
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.projectData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ borderRadius: '12px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0' }} />
                                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                    <Bar dataKey="completadas" name="Completadas" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} barSize={32} />
                                    <Bar dataKey="pendientes" name="Pendientes" stackId="a" fill="#334155" radius={[4, 4, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* TEAM UTILIZATION (PIE CHART) — full width */}
                <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg lg:col-span-2 relative">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="w-5 h-5 text-emerald-400" />
                        <h3 className="font-bold text-lg text-white">Distribución de Esfuerzo / Equipo</h3>
                    </div>
                    {analytics.utilizationData.length === 0 ? (
                        <div className="h-[250px] flex items-center justify-center text-slate-400 font-bold">No hay horas registradas en este periodo.</div>
                    ) : (
                        <div className="flex flex-col md:flex-row h-[280px]">
                            <div className="flex-1 min-w-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analytics.utilizationData}
                                            cx="50%" cy="50%"
                                            innerRadius={60} outerRadius={100}
                                            paddingAngle={3}
                                            dataKey="horas"
                                        >
                                            {analytics.utilizationData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)', backgroundColor: '#1e293b', color: '#e2e8f0' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex-1 flex flex-col justify-center px-4 space-y-3">
                                {analytics.utilizationData.map((entry, index) => (
                                    <div key={index} className="flex items-center justify-between border-b border-slate-800 pb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                            <span className="font-bold text-slate-300 text-sm">{entry.name}</span>
                                        </div>
                                        <span className="font-black text-slate-400">{entry.horas} hrs</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
