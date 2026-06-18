import React, { useState } from 'react';
import {
    AlertTriangle, Check, Loader2, Calendar, User, Users,
    CheckCircle2, ArrowRight, X, Clock, HelpCircle
} from 'lucide-react';

export default function PlannerImportModal({
    isOpen,
    onClose,
    projectName,
    parsedData,
    onConfirm,
    isSyncing
}) {
    const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'newTasks' | 'updates' | 'users'

    if (!isOpen || !parsedData) return null;

    const { stats, tasksToCreate, tasksToUpdate, userMappings } = parsedData;

    const handleConfirm = () => {
        if (onConfirm) onConfirm();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/50 shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-green-400 bg-green-500/10">
                                Planner Excel
                            </span>
                            <h3 className="font-black text-lg text-white tracking-tight">
                                Vista Previa de Sincronización
                            </h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Cargando cronograma para el proyecto: <span className="text-white font-bold">{projectName}</span>
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                        disabled={isSyncing}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-900 px-6 border-b border-slate-800/60 shrink-0 overflow-x-auto scrollbar-none">
                    <TabButton 
                        active={activeTab === 'summary'} 
                        onClick={() => setActiveTab('summary')}
                        label="Resumen General"
                    />
                    <TabButton 
                        active={activeTab === 'newTasks'} 
                        onClick={() => setActiveTab('newTasks')}
                        label={`Tareas Nuevas (${stats.totalNewTasks})`}
                    />
                    <TabButton 
                        active={activeTab === 'updates'} 
                        onClick={() => setActiveTab('updates')}
                        label={`Por Actualizar (${stats.totalUpdateTasks})`}
                    />
                    <TabButton 
                        active={activeTab === 'users'} 
                        onClick={() => setActiveTab('users')}
                        label={`Equipo (${userMappings.length})`}
                    />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-slate-950/20 text-slate-300">
                    
                    {/* TAB: SUMMARY */}
                    {activeTab === 'summary' && (
                        <div className="space-y-6">
                            {/* KPI cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <SummaryKpiCard 
                                    label="Total en Excel" 
                                    value={stats.totalExcel} 
                                    desc={`${stats.totalMilestones} hitos, ${stats.totalTasks} tareas, ${stats.totalSubtasks} subtareas`}
                                    color="indigo"
                                />
                                <SummaryKpiCard 
                                    label="Tareas Nuevas" 
                                    value={stats.totalNewTasks} 
                                    desc={`+${stats.totalNewMilestones} hitos y +${stats.totalSubtasks} subtareas a crear`}
                                    color="emerald"
                                />
                                <SummaryKpiCard 
                                    label="Tareas a Actualizar" 
                                    value={stats.totalUpdateTasks} 
                                    desc="Sincroniza fechas/dependencias de Gantt"
                                    color="amber"
                                />
                            </div>

                            {/* Warning alert */}
                            <div className="flex gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                <div className="text-xs">
                                    <h5 className="font-bold text-white mb-1">Políticas de Sincronización Envejecidas</h5>
                                    <p className="leading-relaxed text-slate-400">
                                        Las tareas existentes en la plataforma <strong>no se borrarán</strong>, y se **conservará** su porcentaje de avance y estado Kanban actual. Solo se actualizarán sus fechas de planificación, notas, estimación de esfuerzo y dependencias basadas en el Excel de Planner.
                                    </p>
                                </div>
                            </div>

                            {/* User assignments info */}
                            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-3">
                                <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                                    <Users className="w-4 h-4 text-indigo-400" />
                                    Asignación de Responsables
                                </h4>
                                <p className="text-xs text-slate-400">
                                    Se identificaron {userMappings.length} personas asignadas en el Planner. Las coincidencias se realizaron con una similitud del nombre mayor al 75%.
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1.5">
                                    {userMappings.map((m, idx) => (
                                        <div 
                                            key={idx} 
                                            className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                                                m.matched 
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                            }`}
                                        >
                                            {m.matched ? (
                                                <>
                                                    <Check className="w-3 h-3" />
                                                    <span>{m.excelName} &rarr; {m.mappedUserName} ({Math.round(m.similarity * 100)}%)</span>
                                                </>
                                            ) : (
                                                <>
                                                    <AlertTriangle className="w-3 h-3" />
                                                    <span>{m.excelName} &rarr; Sin asignar (No hay coincidencia)</span>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: NEW TASKS */}
                    {activeTab === 'newTasks' && (
                        <div className="space-y-4">
                            {tasksToCreate.length === 0 ? (
                                <EmptyState message="No hay tareas nuevas a crear. Todas las tareas del Excel ya existen en el proyecto." />
                            ) : (
                                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/40">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0">
                                            <tr>
                                                <th className="p-3 w-12 text-center">Num</th>
                                                <th className="p-3">WBS</th>
                                                <th className="p-3">Tarea</th>
                                                <th className="p-3 text-center">⏱️ Start</th>
                                                <th className="p-3 text-center">⏱️ Finish</th>
                                                <th className="p-3">Asignado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                            {tasksToCreate.map((t, idx) => (
                                                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="p-3 text-center text-slate-500 font-mono">#{t.taskNumber}</td>
                                                    <td className="p-3 font-semibold text-slate-400">{t.outlineNumber}</td>
                                                    <td className="p-3 font-bold text-white max-w-xs truncate">{t.name}</td>
                                                    <td className="p-3 text-center font-mono text-emerald-400">{t.plannedStartDate || '—'}</td>
                                                    <td className="p-3 text-center font-mono text-indigo-400">{t.plannedEndDate || '—'}</td>
                                                    <td className="p-3">
                                                        {t.assignedUserName ? (
                                                            <div className="flex items-center gap-1.5 text-slate-200">
                                                                <div className="w-4 h-4 rounded-full bg-indigo-500/20 text-[8px] font-bold text-indigo-400 flex items-center justify-center">
                                                                    {t.assignedUserName[0].toUpperCase()}
                                                                </div>
                                                                <span className="truncate">{t.assignedUserName}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-500 italic">Sin asignar</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: UPDATES */}
                    {activeTab === 'updates' && (
                        <div className="space-y-4">
                            {tasksToUpdate.length === 0 ? (
                                <EmptyState message="No hay tareas existentes por actualizar." />
                            ) : (
                                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/40">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0">
                                            <tr>
                                                <th className="p-3 w-12 text-center">Num</th>
                                                <th className="p-3">Tarea</th>
                                                <th className="p-3 text-center">Avance App</th>
                                                <th className="p-3 text-center">Nuevas Fechas</th>
                                                <th className="p-3">Mapeado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                            {tasksToUpdate.map((t, idx) => (
                                                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="p-3 text-center text-slate-500 font-mono">#{t.taskNumber}</td>
                                                    <td className="p-3 font-bold text-white max-w-xs truncate">{t.name}</td>
                                                    <td className="p-3 text-center">
                                                        <span className="px-2 py-0.5 bg-slate-800 rounded font-black text-[10px] text-indigo-400">
                                                            {t.existingPercentComplete || 0}% ({t.existingStatus})
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center gap-1 font-mono">
                                                            <span className="text-emerald-400">{t.plannedStartDate || '—'}</span>
                                                            <span className="text-slate-600">&rarr;</span>
                                                            <span className="text-indigo-400">{t.plannedEndDate || '—'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-slate-400">
                                                        {t.assignedUserName ? (
                                                            <span className="truncate block max-w-[120px]">{t.assignedUserName}</span>
                                                        ) : (
                                                            <span className="text-slate-600 italic text-[10px]">Sin cambios</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: USERS MAP */}
                    {activeTab === 'users' && (
                        <div className="space-y-4">
                            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/40">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0">
                                        <tr>
                                            <th className="p-3">Nombre en Excel</th>
                                            <th className="p-3">Mapeo a la Plataforma</th>
                                            <th className="p-3 text-center">Similitud</th>
                                            <th className="p-3 text-center">Estado de Mapeo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {userMappings.map((m, idx) => (
                                            <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="p-3 font-bold text-white flex items-center gap-2">
                                                    <User className="w-3.5 h-3.5 text-slate-500" />
                                                    {m.excelName}
                                                </td>
                                                <td className="p-3 text-slate-300">
                                                    {m.matched ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-[9px] font-bold text-emerald-400 flex items-center justify-center">
                                                                {(m.mappedUserName || '?')[0].toUpperCase()}
                                                            </div>
                                                            <span>{m.mappedUserName}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-500 italic">No emparejado</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center font-mono font-bold text-slate-400">
                                                    {m.matched ? `${Math.round(m.similarity * 100)}%` : '—'}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {m.matched ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                                                            <CheckCircle2 className="w-3 h-3" /> Mapeado
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400" title="La similitud no superó el 75% o el usuario no existe en la base de datos. Se importará como Sin Asignar.">
                                                            <AlertTriangle className="w-3 h-3" /> Sin Asignar
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-900/50 flex justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                        disabled={isSyncing}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-900/30 transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                        disabled={isSyncing}
                    >
                        {isSyncing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Sincronizando...</span>
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                <span>Confirmar e Importar</span>
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}

// Subcomponentes Helpers

function TabButton({ active, onClick, label }) {
    return (
        <button
            onClick={onClick}
            className={`relative px-4 py-3 text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                active ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
        >
            {label}
            {active && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-500 rounded-t-full" />
            )}
        </button>
    );
}

function SummaryKpiCard({ label, value, desc, color }) {
    const colors = {
        indigo: { text: 'text-indigo-400', bg: 'bg-indigo-500/10' },
        emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        amber: { text: 'text-amber-400', bg: 'bg-amber-500/10' }
    };
    const c = colors[color] || colors.indigo;
    
    return (
        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl shadow-lg">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">{label}</span>
            <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-black text-white ${c.text}`}>{value}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{desc}</p>
        </div>
    );
}

function EmptyState({ message }) {
    return (
        <div className="text-center py-10 bg-slate-900/20 border border-slate-800/40 rounded-2xl">
            <HelpCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">{message}</p>
        </div>
    );
}
