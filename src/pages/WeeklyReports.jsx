import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAppData } from '../contexts/AppDataContext';
import { useAuth } from '../contexts/AuthContext';
import { generateWeeklyReport } from '../services/reportService';
import { BarChart3, Calendar as CalendarIcon, Download, Clock, Zap, Target } from 'lucide-react';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { exportWeeklyReport } from '../utils/excelExport';

export default function WeeklyReports() {
    const { user } = useAuth();
    const { timeLogs, engTasks, engProjects, delays, teamMembers } = useAppData();

    // Get selectedUser from shared ReportsLayout via outlet context
    const outletCtx = useOutletContext() || {};
    const selectedUser = outletCtx.selectedUser || user.uid;

    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    const report = useMemo(() => {
        if (!timeLogs || !engTasks || !engProjects) return null;
        return generateWeeklyReport(
            selectedDate,
            selectedUser,
            timeLogs,
            engTasks,
            engProjects,
            delays || []
        );
    }, [selectedDate, selectedUser, timeLogs, engTasks, engProjects, delays]);

    const handleExport = () => {
        if (!report) return;
        const tUser = teamMembers.find(t => t.uid === selectedUser);
        exportWeeklyReport(report, tUser?.displayName || tUser?.email || 'Ingeniero');
    };

    if (!report) {
        return <div className="p-8 text-center text-slate-400">Cargando reporte semanal...</div>;
    }

    const startObj = parseISO(report.startDate);
    const endObj = parseISO(report.endDate);

    // Compute max hours for bar scaling
    const maxHours = Math.max(...report.dailyReports.map(d => d.totalHours), 8);

    return (
        <div className="space-y-6">
            {/* Action bar (date picker + export) */}
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-slate-400 font-bold capitalize">
                    Semana: {format(startObj, "d MMM", { locale: es })} - {format(endObj, "d MMM, yyyy", { locale: es })}
                </div>
                <div className="flex gap-3 items-center">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl flex items-center p-1 w-full sm:w-auto">
                        <CalendarIcon className="w-5 h-5 text-slate-400 ml-3" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-slate-200 py-2 px-3 focus:ring-0 outline-none w-full hover:cursor-pointer"
                        />
                    </div>

                    <button
                        onClick={handleExport}
                        className="bg-indigo-600 text-white p-3 rounded-xl shadow-md hover:bg-indigo-700 transition flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                        <Download className="w-5 h-5" />
                        <span className="sm:hidden font-bold">Resumen Excel</span>
                    </button>
                </div>
            </div>

            {/* Aggregated KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Horas Productivas', val: report.totalHours, icon: Clock, color: 'blue' },
                    { label: 'Horas Extra', val: report.overtimeHours, icon: Zap, color: 'amber' },
                    { label: 'Tareas Completadas', val: report.tasksCompleted, icon: Target, color: 'emerald' },
                    { label: 'Retrasos Totales', val: report.delaysReported, icon: BarChart3, color: 'rose' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
                        <span className={`text-[10px] font-black uppercase tracking-wider text-${kpi.color}-500 mb-2 block`}>{kpi.label}</span>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full bg-${kpi.color}-500/15 flex items-center justify-center text-${kpi.color}-400 shrink-0`}>
                                <kpi.icon className="w-5 h-5" />
                            </div>
                            <span className="text-2xl font-black text-white">{kpi.val}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Daily Breakdown Chart */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-800 shadow-lg p-6 overflow-hidden">
                <h3 className="font-bold text-lg text-white mb-6">Tendencia Productiva Diaria</h3>

                <div className="flex items-end gap-2 h-64 mt-4">
                    {report.dailyReports.map((day, i) => {
                        const h = Math.max(0, day.totalHours);
                        const oh = Math.max(0, day.overtimeHours);
                        const standardH = Math.max(0, h - oh);

                        const renderScale = maxHours > 0 ? 100 / maxHours : 0;
                        const standardPct = (standardH * renderScale) + '%';
                        const ovrPct = (oh * renderScale) + '%';

                        return (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2 group h-full relative">
                                {/* Hover Tooltip */}
                                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-700 text-white text-[10px] py-1 px-2 rounded-lg font-bold shadow-lg z-10 whitespace-nowrap pointer-events-none">
                                    {h.toFixed(1)} hrs ({oh.toFixed(1)} ex)
                                </div>

                                {/* Bar Stack */}
                                <div className="w-10 sm:w-16 flex flex-col-reverse justify-start rounded-t-xl overflow-hidden h-full">
                                    <div
                                        className="w-full bg-blue-500 rounded-b-sm group-hover:bg-blue-600 transition-colors"
                                        style={{ height: standardPct }}
                                    />
                                    <div
                                        className="w-full bg-amber-400 rounded-t-xl group-hover:bg-amber-500 transition-colors"
                                        style={{ height: ovrPct }}
                                    />
                                </div>
                                <span className="text-xs font-bold text-slate-400 capitalize whitespace-nowrap overflow-hidden text-ellipsis">
                                    {format(parseISO(day.date), 'EEE', { locale: es })}
                                </span>
                            </div>
                        );
                    })}
                </div>
                <div className="flex items-center justify-center gap-6 mt-6 border-t border-slate-800 pt-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-xs font-bold text-slate-400">Horas Estándar</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-amber-400 rounded-full"></div>
                        <span className="text-xs font-bold text-slate-400">Horas Extra</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <span className="text-slate-500 text-xs italic font-bold">Datos generados dinámicamente según avance diario.</span>
            </div>
        </div>
    );
}
