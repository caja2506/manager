import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useAuth } from '../contexts/AuthContext';
import { generateDailyReport } from '../services/reportService';
import { FileText, Calendar as CalendarIcon, Download, Zap, AlertTriangle, Users } from 'lucide-react';
import { format, isToday, isYesterday, formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { exportDailyReport } from '../utils/excelExport';

export default function DailyReports() {
    const { user } = useAuth();
    const { timeLogs, engTasks, engProjects, delays, teamMembers } = useEngineeringData();

    // Get selectedUser from shared ReportsLayout via outlet context
    const outletCtx = useOutletContext() || {};
    const selectedUser = outletCtx.selectedUser || user.uid;

    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    const report = useMemo(() => {
        if (!timeLogs || !engTasks || !engProjects) return null;
        return generateDailyReport(
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
        exportDailyReport(report, tUser?.displayName || tUser?.email || 'Ingeniero');
    };

    if (!report) {
        return <div className="p-8 text-center text-slate-400">Cargando datos del reporte...</div>;
    }

    const dateObj = parseISO(selectedDate);
    const dayName = isToday(dateObj) ? 'Hoy' : isYesterday(dateObj) ? 'Ayer' : format(dateObj, 'EEEE', { locale: es });

    return (
        <div className="space-y-6">
            {/* Action bar (date picker + export — no duplicate banner) */}
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-slate-400 font-bold capitalize">
                    {format(dateObj, "dd 'de' MMMM, yyyy", { locale: es })} ({dayName})
                </div>
                <div className="flex gap-3 items-center">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl flex items-center p-1 w-full sm:w-auto">
                        <CalendarIcon className="w-5 h-5 text-slate-400 ml-3" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            max={format(new Date(), 'yyyy-MM-dd')}
                            className="bg-transparent border-none text-sm font-bold text-slate-200 py-2 px-3 focus:ring-0 outline-none w-full"
                        />
                    </div>

                    <button
                        onClick={handleExport}
                        className="bg-emerald-600 text-white p-3 rounded-xl shadow-md hover:bg-emerald-700 transition flex items-center justify-center gap-2 w-full sm:w-auto"
                        title="Exportar a Excel"
                    >
                        <Download className="w-5 h-5" />
                        <span className="sm:hidden font-bold">Exportar</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col justify-between">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-2">Horas Productivas</span>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-blue-500/15 flex items-center justify-center text-blue-400 shrink-0">
                            <Zap className="w-6 h-6" />
                        </div>
                        <span className="text-3xl font-black text-white">{report.totalHours}</span>
                    </div>
                </div>

                <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col justify-between">
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider block mb-2">Horas Extras</span>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0">
                            <Zap className="w-6 h-6" />
                        </div>
                        <span className="text-3xl font-black text-white">{report.overtimeHours}</span>
                    </div>
                </div>

                <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col justify-between">
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wider block mb-2">Tareas Completadas</span>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                            <FileText className="w-6 h-6" />
                        </div>
                        <span className="text-3xl font-black text-white">{report.tasksCompleted}</span>
                    </div>
                </div>

                <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col justify-between">
                    <span className="text-xs font-black text-rose-400 uppercase tracking-wider block mb-2">Retrasos Reportados</span>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-400 shrink-0">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <span className="text-3xl font-black text-white">{report.delaysReported}</span>
                    </div>
                </div>
            </div>

            {/* Task Breakdown */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
                <div className="p-6 border-b border-slate-800">
                    <h3 className="font-bold text-lg text-white">Desglose de Actividad</h3>
                    <p className="text-xs text-slate-400 mt-1">Tareas trabajadas durante el día seleccionado.</p>
                </div>

                {report.tasksWorked.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-400 font-bold">Sin actividad registrada en esta fecha.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-800/50 border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400 font-bold">
                                    <th className="p-4 pl-6">Proyecto</th>
                                    <th className="p-4">Tarea</th>
                                    <th className="p-4 text-center">Registros</th>
                                    <th className="p-4 pr-6 text-right">Horas Invertidas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.tasksWorked.map((tw, i) => (
                                    <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4 pl-6 font-bold text-slate-200">
                                            {tw.projectName}
                                        </td>
                                        <td className="p-4 text-slate-300 font-medium">
                                            {tw.taskTitle}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="px-2 py-1 bg-slate-800 text-slate-400 rounded-lg text-xs font-bold">
                                                {tw.logCount} logs
                                            </span>
                                        </td>
                                        <td className="p-4 pr-6 text-right font-black text-indigo-400">
                                            {tw.hours.toFixed(2)} hrs
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Notes Summary */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-800 shadow-lg p-6 line-clamp-4">
                <h3 className="font-bold text-lg text-white mb-2">Comentarios / Bitácora</h3>
                <p className="text-sm text-slate-400 italic">
                    "{report.notesSummary}"
                </p>
            </div>

        </div>
    );
}
