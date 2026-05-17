import React, { useState, useEffect, useMemo } from 'react';
import {
    DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor,
    useSensor, useSensors, defaultDropAnimationSideEffects, useDroppable
} from '@dnd-kit/core';
import {
    SortableContext, arrayMove, sortableKeyboardCoordinates,
    verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../../supabase';
import { GripVertical, Target, Compass, LayoutGrid, Plus, Check, X, Layers } from 'lucide-react';

// ==========================================
// Sortable Work Area Card
// ==========================================
function SortableAreaCard({ area, taskTypes }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: area.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    // Resolve default task type names for display
    const resolvedTypes = useMemo(() => {
        const rawIds = area.taskTypeIds || area.defaultTaskTypes || area.default_task_types || [];
        return rawIds.map(val => {
            const t = taskTypes.find(tt => tt.id === val) || taskTypes.find(tt => tt.name === val);
            return t ? t.name : null;
        }).filter(Boolean);
    }, [area, taskTypes]);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex flex-col gap-1.5 p-2.5 mb-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-amber-400 dark:hover:border-amber-500 transition-colors ${isDragging ? 'shadow-xl z-50 ring-2 ring-amber-500/50' : ''}`}
        >
            <div className="flex items-center gap-1.5">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none flex-shrink-0">
                    <GripVertical className="w-4 h-4" />
                </div>
                <Layers className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate flex-1 leading-tight">
                    {area.name}
                </span>
            </div>
            {resolvedTypes.length > 0 && (
                <div className="flex flex-wrap gap-1 ml-7">
                    {resolvedTypes.map(name => (
                        <span key={name} className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                            {name}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// ==========================================
// Droppable Column (Milestone bucket)
// ==========================================
function MilestoneColumn({ id, title, items, taskTypes, activeQuickAdd, setActiveQuickAdd, onQuickAdd, allWorkAreaTypes }) {
    const { isOver, setNodeRef } = useDroppable({
        id: id,
        data: { type: 'column', columnId: id }
    });

    const [showPicker, setShowPicker] = useState(false);

    // Areas NOT already in this column
    const availableAreas = useMemo(() => {
        const usedIds = items.map(i => i.id);
        return allWorkAreaTypes.filter(a => !usedIds.includes(a.id));
    }, [items, allWorkAreaTypes]);

    return (
        <div ref={setNodeRef} className={`flex flex-col h-full transition-colors ${
            isOver ? 'bg-purple-50/50 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/50' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/80'
        } border rounded-2xl overflow-hidden`}>
            {/* Column Header */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900">
                {id === 'unassigned'
                    ? <div className="w-2 h-2 rounded-full bg-slate-400" />
                    : <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                }
                <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-bold truncate ${id === 'unassigned' ? 'text-slate-600 dark:text-slate-300' : 'text-purple-700 dark:text-purple-400'}`}>
                        {title}
                    </h3>
                </div>
                <span className="bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                    {items.length}
                </span>
                {id !== 'unassigned' && (
                    <button
                        onClick={() => setShowPicker(!showPicker)}
                        className="p-1 -mr-1 flex-shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-purple-500"
                        title="Agregar área a este milestone"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Sortable Area */}
            <div className="p-3 flex-1 overflow-y-auto">
                <SortableContext id={id} items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    <div className="min-h-[80px] h-full flex flex-col">
                        {items.length === 0 && !showPicker ? (
                            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl mb-2">
                                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium px-4 text-center">Arrastra áreas aquí o presiona +</span>
                            </div>
                        ) : (
                            items.map(item => <SortableAreaCard key={item.id} area={item} taskTypes={taskTypes} />)
                        )}

                        {/* Quick area picker */}
                        {showPicker && (
                            <div className="p-2 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-xl mt-1 space-y-1">
                                <p className="text-[10px] text-purple-500 font-bold mb-1">Seleccionar área:</p>
                                {availableAreas.length === 0 ? (
                                    <p className="text-[10px] text-slate-400">Todas las áreas ya asignadas</p>
                                ) : (
                                    availableAreas.map(a => (
                                        <button
                                            key={a.id}
                                            onClick={() => { onQuickAdd(id, a); setShowPicker(false); }}
                                            className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors flex items-center gap-1.5"
                                        >
                                            <Layers className="w-3 h-3 text-amber-500" />
                                            {a.name}
                                        </button>
                                    ))
                                )}
                                <button onClick={() => setShowPicker(false)} className="w-full text-center text-[10px] text-slate-400 mt-1 hover:text-slate-600">Cancelar</button>
                            </div>
                        )}
                    </div>
                </SortableContext>
            </div>
        </div>
    );
}

// ==========================================
// Main Kanban: Milestone → Work Areas
// ==========================================
export default function MilestoneAreaKanban({ milestoneTypes, workAreaTypes, taskTypes }) {
    const [boards, setBoards] = useState({});
    const [activeId, setActiveId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [unsavedChanges, setUnsavedChanges] = useState(false);

    // Initialize board state from props
    useEffect(() => {
        if (!milestoneTypes || !workAreaTypes) return;

        const newBoards = { unassigned: [] };

        // Initialize milestone buckets
        milestoneTypes.forEach(ms => {
            newBoards[ms.id] = [];
        });

        const assignedAreaIds = new Set();

        // Populate milestone buckets from their default_work_areas
        milestoneTypes.forEach(ms => {
            const rawAreas = ms.defaultWorkAreas || ms.default_work_areas || [];
            const resolvedAreas = [];
            rawAreas.forEach(val => {
                let areaObj = workAreaTypes.find(a => a.id === val);
                if (!areaObj) areaObj = workAreaTypes.find(a => a.name === val);
                if (areaObj) {
                    resolvedAreas.push(areaObj);
                    assignedAreaIds.add(areaObj.id);
                }
            });
            newBoards[ms.id] = resolvedAreas;
        });

        // Populate unassigned
        workAreaTypes.forEach(a => {
            if (!assignedAreaIds.has(a.id)) {
                newBoards.unassigned.push(a);
            }
        });

        setBoards(newBoards);
        setUnsavedChanges(false);
    }, [milestoneTypes, workAreaTypes]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // --- Save to Supabase ---
    const handleSave = async () => {
        if (!unsavedChanges) return;
        setIsSaving(true);
        try {
            for (const ms of milestoneTypes) {
                const areasInBoard = boards[ms.id] || [];
                const areaIds = areasInBoard.map(a => a.id);

                // Compare with original
                const origIds = (ms.defaultWorkAreas || ms.default_work_areas || []).slice().sort();
                const newIds = areaIds.slice().sort();

                if (JSON.stringify(newIds) !== JSON.stringify(origIds)) {
                    await supabase.from('milestone_types')
                        .update({ default_work_areas: areaIds })
                        .eq('id', ms.id);
                }
            }
            setUnsavedChanges(false);
        } catch (error) {
            console.error("Error saving milestone-area mapping:", error);
        }
        setIsSaving(false);
    };

    // Auto Save on drop end
    useEffect(() => {
        if (!activeId && unsavedChanges && !isSaving) {
            handleSave();
        }
    }, [activeId, unsavedChanges]);

    // --- DnD Handlers ---
    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDragOver = (event) => {
        const { active, over } = event;
        if (!over) return;

        const aId = active.id;
        const oId = over.id;

        const activeContainer = Object.keys(boards).find(key => boards[key].some(a => a.id === aId));
        const overContainer = Object.keys(boards).find(key => key === oId || boards[key].some(a => a.id === oId));

        if (!activeContainer || !overContainer || activeContainer === overContainer) return;

        setBoards(prev => {
            const activeItems = prev[activeContainer];
            const overItems = prev[overContainer];
            const activeIndex = activeItems.findIndex(a => a.id === aId);
            const overIndex = oId === overContainer
                ? overItems.length + 1
                : overItems.findIndex(a => a.id === oId);

            return {
                ...prev,
                [activeContainer]: prev[activeContainer].filter(item => item.id !== aId),
                [overContainer]: [
                    ...prev[overContainer].slice(0, overIndex),
                    activeItems[activeIndex],
                    ...prev[overContainer].slice(overIndex)
                ]
            };
        });
        setUnsavedChanges(true);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const aId = active.id;
        const oId = over.id;

        const activeContainer = Object.keys(boards).find(key => boards[key].some(a => a.id === aId));
        const overContainer = Object.keys(boards).find(key => key === oId || boards[key].some(a => a.id === oId));

        if (activeContainer && overContainer && activeContainer === overContainer) {
            const items = boards[activeContainer];
            const oldIndex = items.findIndex(a => a.id === aId);
            const newIndex = items.findIndex(a => a.id === oId);

            if (oldIndex !== newIndex) {
                setBoards(prev => ({
                    ...prev,
                    [activeContainer]: arrayMove(items, oldIndex, newIndex)
                }));
                setUnsavedChanges(true);
            }
        }
    };

    // Quick add from picker
    const handleQuickAdd = (milestoneId, area) => {
        setBoards(prev => {
            const newBoards = { ...prev };
            // Remove from wherever it is
            Object.keys(newBoards).forEach(key => {
                newBoards[key] = newBoards[key].filter(a => a.id !== area.id);
            });
            // Add to target milestone
            newBoards[milestoneId] = [...(newBoards[milestoneId] || []), area];
            return newBoards;
        });
        setUnsavedChanges(true);
    };

    // Active item for overlay
    const activeArea = useMemo(() => {
        if (!activeId || !workAreaTypes) return null;
        return workAreaTypes.find(a => a.id === activeId);
    }, [activeId, workAreaTypes]);

    if (!milestoneTypes || milestoneTypes.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-lg">
                <Target className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Faltan Tipos de Milestone</h3>
                <p className="text-xs text-slate-500 mt-1">Configura los tipos de milestone en las listas maestras para utilizar este tablero.</p>
            </div>
        );
    }

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } })
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 350px)', minHeight: '500px' }}>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center">
                        <Target className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-slate-800 dark:text-white">Tablero de Asignación: Áreas a Milestones</h2>
                        <p className="text-xs text-slate-500">Arrastra las áreas de trabajo a los milestones correspondientes. Define la estructura estándar del proyecto.</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold transition-colors">
                    {isSaving ? (
                        <span className="flex items-center gap-1.5 text-purple-500 dark:text-purple-400 min-w-24">
                            <span className="animate-pulse text-[10px]">●</span> Guardando...
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 min-w-24">
                            <Check className="w-3.5 h-3.5" /> Guardado
                        </span>
                    )}
                </div>
            </div>

            {/* Board Area */}
            <div className="flex-1 overflow-x-auto p-4 custom-scrollbar">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex h-full gap-4 min-w-max pb-2">
                        {/* Unassigned Pool */}
                        <div className="w-56 flex-shrink-0 h-full pb-6">
                            <MilestoneColumn
                                id="unassigned"
                                title="Sin Asignar"
                                items={boards.unassigned || []}
                                taskTypes={taskTypes || []}
                                allWorkAreaTypes={workAreaTypes || []}
                                onQuickAdd={handleQuickAdd}
                            />
                        </div>

                        {/* Milestone Columns */}
                        {milestoneTypes.map(ms => (
                            <div key={ms.id} className="w-56 flex-shrink-0 h-full pb-6">
                                <MilestoneColumn
                                    id={ms.id}
                                    title={ms.name}
                                    items={boards[ms.id] || []}
                                    taskTypes={taskTypes || []}
                                    allWorkAreaTypes={workAreaTypes || []}
                                    onQuickAdd={handleQuickAdd}
                                />
                            </div>
                        ))}
                    </div>

                    <DragOverlay dropAnimation={dropAnimation}>
                        {activeArea ? <SortableAreaCard area={activeArea} taskTypes={taskTypes || []} /> : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </div>
    );
}
