import React, { useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useEngineeringData } from '../../hooks/useEngineeringData';
import { onProjectStations, hasMultipleIndexers } from '../../services/stationService';
import { formatStationLabel } from '../../models/schemas';
import TaskDetailModal from '../tasks/TaskDetailModal';
import { Check, AlertTriangle, Plus, X, Search, ChevronRight, Filter } from 'lucide-react';

export default function StationTaskMatrix({ projectId, canEdit, userId }) {
    const { engTasks, workAreaTypes, taskTypes, engProjects, teamMembers } = useEngineeringData();
    const [stations, setStations] = useState([]);
    
    const [popoverState, setPopoverState] = useState(null); // { cellRef, tasks, area, type, station }
    const [modalTask, setModalTask] = useState(null); // single task for edition
    const [showAreaFilter, setShowAreaFilter] = useState(false);

    // Filter state
    const STORAGE_KEY = `obeya_matrix_hidden_areas_${projectId}`;
    const [hiddenAreas, setHiddenAreas] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(hiddenAreas));
    }, [hiddenAreas, STORAGE_KEY]);

    // Load Stations
    useEffect(() => {
        if (!projectId) return;
        const unsub = onProjectStations(projectId, (data) => {
            // Sort by order or indx, stn
            setStations(data.sort((a,b) => {
                if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
                if (a.indx !== b.indx) return (a.indx || 0) - (b.indx || 0);
                return (a.stn || 0) - (b.stn || 0);
            }));
        });
        return unsub;
    }, [projectId]);

    const multiIdx = useMemo(() => hasMultipleIndexers(stations), [stations]);

    // Data computation
    const columnsData = useMemo(() => {
        if (!workAreaTypes || !taskTypes) return [];
        return workAreaTypes
            .filter(area => !hiddenAreas.includes(area.id))
            .map(area => {
            const rawTypes = area.taskTypeIds || area.defaultTaskTypes || [];
            const types = [];
            rawTypes.forEach(val => {
                let typeObj = taskTypes.find(t => t.id === val) || taskTypes.find(t => t.name === val);
                if (typeObj) types.push(typeObj);
            });
            return { area, types };
        }).filter(c => c.types.length > 0);
    }, [workAreaTypes, taskTypes, hiddenAreas]);

    const prjTasks = useMemo(() => {
        return engTasks.filter(t => t.projectId === projectId && t.status !== 'cancelled');
    }, [engTasks, projectId]);

    // Total counts for sticky positioning offsets


    return (
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden mt-6 mb-24 relative">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                <div>
                    <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                        MATRIZ DE CONTROL (OBEYA)
                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 px-2 py-0.5 rounded-full">BETA</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Avance general de tareas por tipo y estación. Tareas sin estación asignada impactan todas las filas.
                    </p>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="flex gap-4 text-[10px] uppercase font-bold tracking-wider mr-4 text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-300 dark:bg-slate-600 border border-slate-400 dark:border-slate-500 rounded-sm" /> Not Started</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700/50 rounded-sm" /> Started</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-yellow-300 dark:bg-yellow-500 border border-yellow-400 dark:border-yellow-600 rounded-sm" /> Issues</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-500 dark:bg-emerald-600 rounded-sm" /> Completed</div>
                    </div>
                    {/* Area Filter */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowAreaFilter(!showAreaFilter)} 
                            className={`p-1.5 rounded transition border flex items-center justify-center cursor-pointer ${
                                hiddenAreas.length > 0 
                                ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50' 
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                            }`}
                            title="Filtrar Áreas"
                        >
                            <Filter className="w-4 h-4" />
                            {hiddenAreas.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full" />}
                        </button>
                        {showAreaFilter && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-3">
                                <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest px-1">Áreas Visibles</h4>
                                <div className="space-y-1">
                                    {workAreaTypes.map(area => (
                                        <label key={area.id} className="flex items-center gap-3 px-2 py-1.5 hover:bg-slate-700/50 rounded-lg cursor-pointer transition">
                                            <input 
                                                type="checkbox" 
                                                checked={!hiddenAreas.includes(area.id)}
                                                onChange={() => setHiddenAreas(prev => 
                                                    prev.includes(area.id) ? prev.filter(id => id !== area.id) : [...prev, area.id]
                                                )}
                                                className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                                            />
                                            <span className="text-sm font-semibold text-slate-200">{area.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto w-full custom-scrollbar pb-6 relative">
                <table className="w-max min-w-full text-left border-collapse p-1">
                    <thead className="sticky top-0 z-20">
                        {/* AREA ROW */}
                        <tr>
                            <th rowSpan={2} className="sticky left-0 w-[50px] min-w-[50px] max-w-[50px] z-30 bg-white dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 p-2 text-[9px] align-bottom">
                                <div className="font-bold text-slate-800 dark:text-slate-300">STN#</div>
                            </th>
                            <th rowSpan={2} className="sticky left-[50px] z-30 bg-white dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 p-2 pl-3 text-[9px] align-bottom whitespace-nowrap">
                                <div className="font-bold text-slate-800 dark:text-slate-300">STATION NAME</div>
                                <div className="text-slate-500">Full Description</div>
                            </th>
                            {columnsData.map(group => (
                                <th 
                                    key={group.area.id} 
                                    colSpan={group.types.length} 
                                    className="border-r border-b border-slate-200 dark:border-slate-700 p-1 text-center text-[10px] font-black uppercase overflow-hidden text-ellipsis whitespace-nowrap max-w-0"
                                    style={{ 
                                        backgroundColor: group.area.color ? `${group.area.color}20` : '#f1f5f9', // 20 represents 12% opacity roughly in hex
                                        color: group.area.color || '#334155',
                                        borderTop: `4px solid ${group.area.color || '#6366f1'}` 
                                    }}
                                    title={group.area.name}
                                >
                                    {group.area.name}
                                </th>
                            ))}
                            <th rowSpan={2} className="sticky right-0 z-30 bg-slate-100 dark:bg-slate-800 border-l border-b border-slate-300 dark:border-slate-600 p-2 text-center text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                                AVANCE<br/>(STN)
                            </th>
                        </tr>
                        {/* TYPE ROW */}
                        <tr>
                            {columnsData.map(group => (
                                group.types.map(type => (
                                    <th 
                                        key={type.id} 
                                        className="bg-slate-50 dark:bg-slate-800/80 border-r border-b border-slate-200 dark:border-slate-700 text-center align-bottom min-w-[28px] max-w-[28px]"
                                    >
                                        <div 
                                            className="whitespace-nowrap text-[8px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest inline-block align-bottom py-1.5"
                                            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                            title={type.name}
                                        >
                                            {type.name}
                                        </div>
                                    </th>
                                ))
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {stations.map(stn => (
                            <tr key={stn.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 group">
                                {/* Station cells */}
                                <td className="sticky left-0 w-[50px] min-w-[50px] max-w-[50px] z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-800 p-1 text-center text-[10px] font-bold text-slate-700 dark:text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
                                    {formatStationLabel(stn, multiIdx)}
                                </td>
                                <td className="sticky left-[50px] z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-800 py-1 px-2.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                    {stn.abbreviation ? `${stn.description} (${stn.abbreviation})` : stn.description || '—'}
                                </td>
                                
                                {/* Matrix Cells */}
                                {columnsData.map(group => (
                                    group.types.map(type => {
                                        const cellTasks = prjTasks.filter(t => {
                                            const matchesType = t.workAreaTypeId === group.area.id && t.taskTypeId === type.id;
                                            if (!matchesType) return false;
                                            // Includes missing station as general
                                            return t.stationId === stn.id || !t.stationId;
                                        });

                                        return (
                                            <Cell 
                                                key={`${stn.id}-${type.id}`}
                                                station={stn}
                                                area={group.area}
                                                type={type}
                                                tasks={cellTasks}
                                                onOpenPopover={setPopoverState}
                                            />
                                        );
                                    })
                                ))}
                                
                                {/* Row Total Cell */}
                                <td className="sticky right-0 z-10 bg-slate-50 dark:bg-slate-900 border-l border-b border-slate-300 dark:border-slate-600 p-0 shadow-[-4px_0_10px_rgba(0,0,0,0.05)] w-[50px] min-w-[50px]">
                                    <TotalCell tasks={prjTasks.filter(t => 
                                        columnsData.some(g => g.area.id === t.workAreaTypeId) &&
                                        (t.stationId === stn.id || !t.stationId)
                                    )} />
                                </td>
                            </tr>
                        ))}
                        
                        {/* TOTAL ROW (Column Totals) */}
                        <tr className="bg-slate-100 dark:bg-slate-900/80 sticky bottom-0 z-30 shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
                            <td colSpan={2} className="sticky left-0 z-40 bg-white dark:bg-slate-900 border-t-2 border-r border-slate-300 dark:border-slate-600 p-2 text-right text-[10px] font-black uppercase text-slate-800 dark:text-slate-300 shadow-[4px_0_10px_rgba(0,0,0,0.05)] h-[30px]">
                                GLOBAL AVANCE
                            </td>
                            {columnsData.map(group => (
                                group.types.map(type => {
                                    const colTasks = prjTasks.filter(t => t.workAreaTypeId === group.area.id && t.taskTypeId === type.id);
                                    return (
                                        <td key={type.id} className="border-t-2 border-r border-slate-300 dark:border-slate-600 p-0 text-center w-[28px] max-w-[28px] h-[30px]">
                                            <TotalCell tasks={colTasks} />
                                        </td>
                                    );
                                })
                            ))}
                            {/* GRAND TOTAL */}
                            <td className="sticky right-0 z-40 bg-slate-200 dark:bg-slate-800 border-t-2 border-l border-slate-400 dark:border-slate-500 p-0 text-center w-[50px] min-w-[50px] shadow-[-4px_0_10px_rgba(0,0,0,0.15)] h-[30px]">
                                <TotalCell tasks={prjTasks.filter(t => columnsData.some(g => g.area.id === t.workAreaTypeId))} forceStrong={true} />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Task Detail Modal for Deep Edit */}
            {modalTask && (
                <TaskDetailModal
                    isOpen={!!modalTask}
                    onClose={() => setModalTask(null)}
                    task={modalTask}
                    projectId={projectId}
                    userId={userId}
                    canEdit={canEdit}
                    projects={engProjects}
                    teamMembers={teamMembers}
                    taskTypes={taskTypes}
                />
            )}

            {/* Popover for Cell Details */}
            {popoverState && (
                <CellPopover 
                    data={popoverState} 
                    onClose={() => setPopoverState(null)} 
                    onOpenTask={setModalTask}
                    multiIdx={multiIdx}
                    canEdit={canEdit}
                    projectId={projectId}
                />
            )}
        </div>
    );
}

function Cell({ station, area, type, tasks, onOpenPopover }) {
    const cellRef = useRef(null);
    const hasTasks = tasks.length > 0;
    
    // Status Logic
    const completed = tasks.filter(t => t.status === 'completed').length;
    
    let state = 'na'; // Gray
    let pct = 0;
    
    if (hasTasks) {
        pct = Math.round((completed / tasks.length) * 100);
        if (completed === tasks.length) {
            state = 'done'; // Green
        } else if (tasks.some(t => t.status === 'blocked')) {
            state = 'issue'; // Yellow
        } else {
            state = 'progress'; // White
        }
    }

    const colorClasses = {
        na: 'bg-slate-300 hover:bg-slate-400 border-slate-400 dark:bg-slate-600 dark:border-slate-500 dark:hover:bg-slate-500 text-transparent',
        done: 'bg-emerald-500 border-emerald-600 text-white shadow-[inset_0_0_8px_rgba(0,0,0,0.1)] dark:bg-emerald-600 dark:border-emerald-700',
        issue: 'bg-yellow-300 border-yellow-400 text-yellow-900 font-extrabold dark:bg-yellow-500 dark:border-yellow-600',
        progress: 'bg-emerald-100 border-emerald-200 text-emerald-900 font-bold dark:bg-emerald-900/40 dark:border-emerald-700/50 dark:text-emerald-300 shadow-[inset_0_0_8px_rgba(0,0,0,0.05)]'
    };

    const handleClick = () => {
        onOpenPopover({
            cellRef: cellRef.current,
            tasks,
            area,
            type,
            station
        });
    };

    return (
        <td className="p-0 border border-slate-300 dark:border-slate-800 text-center w-[28px] max-w-[28px] outline-none relative">
            <button
                ref={cellRef}
                onClick={handleClick}
                title={hasTasks ? `${completed}/${tasks.length} completadas` : 'Sin tareas'}
                className={`w-full h-full min-h-[20px] flex items-center justify-center text-[8.5px] transition-colors cursor-pointer border-t border-l m-0 outline-none
                    ${colorClasses[state]}
                `}
            >
                {state === 'progress' && `${pct}%`}
                {state === 'issue' && <AlertTriangle className="w-[10px] h-[10px]" />}
            </button>
        </td>
    );
}

function CellPopover({ data, onClose, onOpenTask, multiIdx, canEdit }) {
    const { cellRef, tasks, area, type, station } = data;
    const popoverRef = useRef(null);
    const [pos, setPos] = useState({ top: 0, left: 0, showAbove: false, showLeft: false });

    // Handle outside click
    useEffect(() => {
        const handler = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                onClose();
            }
        };
        // Small timeout to prevent immediate close on the native click event
        setTimeout(() => document.addEventListener('mousedown', handler), 10);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    // Calculate dynamic position using useLayoutEffect to prevent layout shift / cascading render
    useLayoutEffect(() => {
        if (!cellRef || !popoverRef.current) return;
        const rect = cellRef.getBoundingClientRect();
        const popRect = popoverRef.current.getBoundingClientRect();
        
        let showAbove = false;
        let showLeft = false;

        let top = rect.bottom + window.scrollY;
        let left = rect.left + window.scrollX;

        // If not enough space below, show above
        if (rect.bottom + popRect.height > window.innerHeight) {
            top = rect.top + window.scrollY - popRect.height;
            showAbove = true;
        }

        // If not enough space to the right, align to right side of cell
        if (rect.left + popRect.width > window.innerWidth) {
            left = Math.min(rect.right + window.scrollX - popRect.width, window.innerWidth + window.scrollX - popRect.width - 8);
            showLeft = true;
        }

        setPos({ top, left, showAbove, showLeft });
    }, [cellRef]);

    const stnLabel = formatStationLabel(station, multiIdx);

    return createPortal(
        <div
            ref={popoverRef}
            className={`absolute z-[9999] w-[320px] bg-slate-900 border border-slate-700/80 shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${pos.top === 0 ? 'opacity-0' : 'opacity-100'}`}
            style={{ top: pos.top, left: pos.left }}
        >
            <div className="bg-slate-800 px-4 py-3 flex items-start justify-between border-b border-slate-700/50">
                <div>
                    <h4 className="text-[11px] font-black uppercase text-indigo-400 tracking-wider mb-1">{area.name} / {type.name}</h4>
                    <p className="text-white text-sm font-bold">{stnLabel} — {station.abbreviation || 'Sin nombre'}</p>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-white transition">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="max-h-[250px] overflow-auto p-2 space-y-1">
                {tasks.length === 0 ? (
                    <div className="py-6 text-center text-slate-500 text-xs">
                        No hay tareas asociadas aún en este cruce.
                    </div>
                ) : (
                    tasks.map(t => (
                        <div 
                            key={t.id} 
                            onClick={() => { onOpenTask(t); onClose(); }}
                            className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800 transition cursor-pointer group"
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className={`w-2 h-2 rounded-full ${
                                    t.status === 'completed' ? 'bg-emerald-500' :
                                    t.status === 'blocked' ? 'bg-amber-500' :
                                    t.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-500'
                                }`} />
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                    {t.status}
                                </span>
                                {!t.stationId && (
                                    <span className="ml-auto text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-bold uppercase">
                                        General
                                    </span>
                                )}
                            </div>
                            <h5 className="text-sm font-semibold text-white group-hover:text-indigo-400 transition truncate">
                                {t.title}
                            </h5>
                        </div>
                    ))
                )}
            </div>
            
            {/* Quick action to add a new task at this intersection (optional for future) */}
            {canEdit && (
                <div className="p-2 border-t border-slate-700/50 bg-slate-800/80">
                    <button 
                        onClick={() => { 
                            // This would create a new task directly, bypassing full modal, or prefetching forms. 
                            // For MVP, just pass partial state or close. 
                            // Let's open an empty modal by simulating a new task template logic?
                            // Actually, just close the popover. The main planner has a big Create Task button.
                            onClose();
                        }}
                        className="w-full text-center text-[11px] font-bold text-slate-400 hover:text-indigo-400 uppercase tracking-wider py-1 cursor-pointer flex items-center justify-center gap-1"
                    >
                        {tasks.length > 0 ? "Ver más tareas en Tareas de Proyecto" : "Agregar desde Panel de Tareas"}
                    </button>
                </div>
            )}
        </div>,
        document.body
    );
}

function TotalCell({ tasks, forceStrong }) {
    if (!tasks || tasks.length === 0) return (
        <div className="w-full h-full min-h-[20px] flex items-center justify-center text-[8.5px] bg-slate-300 dark:bg-slate-600 text-transparent">—</div>
    );
    
    const completed = tasks.filter(t => t.status === 'completed').length;
    const total = tasks.length;
    const pct = Math.round((completed / total) * 100);
    const hasIssues = tasks.some(t => t.status === 'blocked');
    
    let state = 'progress';
    if (completed === total) state = 'done';
    else if (hasIssues) state = 'issue';
    
    const colorClasses = {
        na: 'bg-slate-300 dark:bg-slate-600 text-transparent',
        done: 'bg-emerald-500 dark:bg-emerald-600 text-white font-bold',
        issue: 'bg-yellow-300 dark:bg-yellow-500 text-yellow-900 font-extrabold',
        progress: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-300 font-bold'
    };

    return (
        <div 
            title={`${completed}/${total} completadas`}
            className={`w-full h-full min-h-[100%] flex flex-col items-center justify-center ${forceStrong ? 'text-[11px] font-black' : 'text-[9.5px] font-bold'} outline-none ${colorClasses[state]}`}
        >
            {pct}%
        </div>
    );
}
