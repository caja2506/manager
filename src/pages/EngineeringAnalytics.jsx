import React, { useMemo, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
    LineChart as LineChartIcon, TrendingUp, AlertTriangle, Users,
    Calendar as CalendarIcon, Download, Clock, Briefcase, Award
} from 'lucide-react';
import { format, subDays, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { TASK_STATUS_CONFIG } from '../models/schemas';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4'];

export default function EngineeringAnalytics() {
    const { engProjects, engTasks, timeLogs, delays, teamMembers } = useAppData();

    // Configurable time frame (default 30 days)
    const [daysRange, setDaysRange] = useState(30);

    const analytics = useMemo(() => {
        if (!timeLogs || !engTasks || !engProjects || !delays) return null;

        const endDate = new Date();
        const startDate = subDays(endDate, daysRange);

        // ---------------------------------------------------------
        // 1. TREND ANALYSIS (Productivity & Overtime over time)
        // ---------------------------------------------------------
        const trendMap = new Map();
        for (let i = 0; i <= daysRange; i++) {
            const dateStr = format(subDays(endDate, daysRange - i), 'yyyy-MM-dd');
            trendMap.set(dateStr, {
                name: format(subDays(endDate, daysRange - i), 'dd MMM', { locale: es }),
                productivas: 0,
                extras: 0
            });
        }

        let totalStandard = 0;
        let totalOvertime = 0;

        timeLogs.forEach(log => {
            if (!log.startTime) return;
            const logDate = new Date(log.startTime);
            if (isWithinInterval(logDate, { start: startOfDay(startDate), end: endOfDay(endDate) })) {
                const dateStr = format(logDate, 'yyyy-MM-dd');
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
            }
        });

        // Round trends
        const trendData = Array.from(trendMap.values()).map(d => ({
            ...d,
            productivas: parseFloat(d.productivas.toFixed(1)),
            extras: parseFloat(d.extras.toFixed(1))
        }));

        // ---------------------------------------------------------
        // 2. DELAYS BY CAUSE (Bar Chart)
        // ---------------------------------------------------------
        const delayMap = new Map();
        delays.forEach(d => {
            if (!d.createdAt) return;
            const dDate = new Date(d.createdAt);
            if (isWithinInterval(dDate, { start: startOfDay(startDate), end: endOfDay(endDate) })) {
                const cause = d.causeName || 'Desconocida';
                delayMap.set(cause, (delayMap.get(cause) || 0) + 1);
            }
        });

        const delayData = Array.from(delayMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // top 5

        // ---------------------------------------------------------
        // 3. TEAM UTILIZATION (Pie Chart) 
        // ---------------------------------------------------------
        const utilMap = new Map();
        timeLogs.forEach(log => {
            if (!log.startTime) return;
            const logDate = new Date(log.startTime);
            if (isWithinInterval(logDate, { start: startOfDay(startDate), end: endOfDay(endDate) })) {
                const u = log.userId;
                utilMap.set(u, (utilMap.get(u) || 0) + (log.totalHours || 0));
            }
        });

        const utilizationData = Array.from(utilMap.entries()).map(([uid, hours]) => {
            const usr = teamMembers.find(t => t.uid === uid);
            return {
                name: usr ? (usr.displayName || usr.email?.split('@')[0]) : 'Desconocido',
                horas: parseFloat(hours.toFixed(1))
            };
        }).sort((a, b) => b.horas - a.horas).slice(0, 6);

        // ---------------------------------------------------------
        // 4. PROJECT COMPLETION VS TOTAL (Bar)
        // ---------------------------------------------------------
        const projectData = engProjects.map(p => {
            const pTasks = engTasks.filter(t => t.projectId === p.id);
            const total = pTasks.length;
            const completed = pTasks.filter(t => t.status === 'completed').length;
            return {
                name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
                completadas: completed,
                pendientes: total - completed,
                total
            };
        }).filter(p => p.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

        return {
            trendData,
            totalStandard: parseFloat(totalStandard.toFixed(1)),
            totalOvertime: parseFloat(totalOvertime.toFixed(1)),
            delayData,
            utilizationData,
            projectData
        };
    }, [daysRange, timeLogs, engTasks, engProjects, delays, teamMembers]);

    const handleExport = () => {
        alert("Exportar a Excel en construcción (Módulo Analítico).");
    };

    if (!analytics) return <div className="p-8 text-center text-slate-400">Procesando cubos de datos...</div>;

    const totalStr = (analytics.totalStandard + analytics.totalOvertime).toFixed(1);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between gap-4 bg-slate-900/70 backdrop-blur-sm p-6 rounded-2xl border border-slate-800 shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center">
                        <LineChartIcon className="w-7 h-7 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="font-black text-2xl text-white tracking-tight">Analítica de Ingeniería</h2>
                        <p className="text-sm text-slate-400 font-bold mt-1">
                            Tendencias, utilización e historial de desempeño.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-1.5 flex items-center shadow-inner">
                        <CalendarIcon className="w-5 h-5 text-slate-400 ml-2" />
                        <select
                            value={daysRange}
                            onChange={e => setDaysRange(Number(e.target.value))}
                            className="bg-transparent border-none text-sm font-bold text-slate-200 py-1.5 px-3 focus:ring-0 cursor-pointer outline-none"
                        >
                            <option value={7}>Últimos 7 días</option>
                            <option value={15}>Últimos 15 días</option>
                            <option value={30}>Últimos 30 días</option>
                            <option value={90}>Últimos 3 meses</option>
                            <option value={180}>Últimos 6 meses</option>
                        </select>
                    </div>
                    <button
                        onClick={handleExport}
                        className="bg-indigo-600 text-white p-3 rounded-xl shadow-md hover:bg-indigo-700 transition flex items-center justify-center"
                        title="Exportar a Excel"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* --- TOP KPIs SUMMARY --- */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
                    <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Horas Reportadas (Periodo)</span>
                    <div className="text-3xl font-black text-white mt-2">{totalStr}</div>
                </div>
                <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
                    <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Proporción Horas Extra</span>
                    <div className="text-3xl font-black text-amber-500 mt-2">
                        {totalStr > 0 ? ((analytics.totalOvertime / parseFloat(totalStr)) * 100).toFixed(1) : 0}%
                    </div>
                </div>
                <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
                    <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Acu. Retrasos (Periodo)</span>
                    <div className="text-3xl font-black text-rose-500 mt-2">
                        {analytics.delayData.reduce((acc, d) => acc + d.count, 0)}
                    </div>
                </div>
                <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
                    <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Miembros Activos</span>
                    <div className="text-3xl font-black text-emerald-500 mt-2">{analytics.utilizationData.length}</div>
                </div>
            </div>

            {/* --- CHARTS MAIN GRID --- */}
            <div className="grid lg:grid-cols-2 gap-6">

                {/* VELOCITY & TRENDS (AREA CHART) */}
                <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg xl:col-span-2 relative">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="w-5 h-5 text-indigo-400" />
                        <h3 className="font-bold text-lg text-white">Inversión de Tiempo (Tendencia Histórica)</h3>
                    </div>
                    <div className="h-[300px] w-full">
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
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <Tooltip
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
                    <div className="flex items-center gap-2 mb-6">
                        <AlertTriangle className="w-5 h-5 text-rose-400" />
                        <h3 className="font-bold text-lg text-white">Top 5 Causas de Retraso</h3>
                    </div>
                    {analytics.delayData.length === 0 ? (
                        <div className="h-[250px] flex items-center justify-center text-slate-400 font-bold">No hay retrasos reportados.</div>
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

                {/* PROJECT FORECAST/HEALTH (STACKED BAR CHART) */}
                <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg relative">
                    <div className="flex items-center gap-2 mb-6">
                        <Briefcase className="w-5 h-5 text-indigo-400" />
                        <h3 className="font-bold text-lg text-white">Completitud por Proyecto (Top 5)</h3>
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
                                    <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)', backgroundColor: '#1e293b', color: '#e2e8f0' }} />
                                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                    <Bar dataKey="completadas" name="Completadas" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} barSize={32} />
                                    <Bar dataKey="pendientes" name="Pendientes" stackId="a" fill="#334155" radius={[4, 4, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* TEAM UTILIZATION (PIE CHART) */}
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
