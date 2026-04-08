import React, { useState, useEffect, useMemo } from 'react';
import {
    DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor,
    useSensor, useSensors, defaultDropAnimationSideEffects, useDroppable
} from '@dnd-kit/core';
import {
    collection, addDoc, doc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { COLLECTIONS } from '../../models/schemas';
import {
    SortableContext, arrayMove, sortableKeyboardCoordinates,
    verticalListSortingStrategy, horizontalListSortingStrategy,
    rectSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Compass, LayoutGrid, Plus, Check, X, Edit2, Trash2 } from 'lucide-react';
import { updateWorkAreaTypeMapping } from '../../services/workAreaService';
import { useAppData } from '../../contexts/AppDataContext';

// ==========================================
// Sortable Item (Dragabble Task Type Card)
// ==========================================
function SortableTaskType({ taskType, onEdit, onDelete }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: taskType.id });
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(taskType.name || '');
    
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    if (isEditing) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="flex flex-col gap-2 p-2.5 mb-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl shadow-inner"
            >
                <input 
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') { 
                            onEdit(taskType.id, editName); 
                            setIsEditing(false); 
                        }
                        if (e.key === 'Escape') setIsEditing(false);
                    }}
                    className="w-full text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex items-center justify-end gap-1 mt-1">
                    <button onClick={() => setIsEditing(false)} className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                        <X className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { onEdit(taskType.id, editName); setIsEditing(false); }} className="p-1 rounded text-white bg-indigo-500 hover:bg-indigo-600 shadow-sm">
                        <Check className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-center gap-1.5 p-2 mb-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors ${isDragging ? 'shadow-xl z-50 ring-2 ring-indigo-500/50' : ''}`}
        >
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none flex-shrink-0">
                <GripVertical className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate flex-1 leading-tight">{taskType.name}</span>
            
            {onEdit && onDelete && !isDragging && (
                <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity flex-shrink-0">
                    <button onClick={() => { setEditName(taskType.name); setIsEditing(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/20" title="Editar">
                        <Edit2 className="w-3 h-3" />
                    </button>
                    <button onClick={() => onDelete(taskType.id, taskType.name)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20" title="Eliminar">
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            )}
        </div>
    );
}

// ==========================================
// Droppable Column (Bucket)
// ==========================================
function DroppableColumn({ id, title, icon, colorClass, items, activeQuickAdd, setActiveQuickAdd, onQuickAdd, onEditTask, onDeleteTask }) {
    const { isOver, setNodeRef } = useDroppable({
        id: id,
        data: { type: 'column', columnId: id }
    });
    
    const [newTaskName, setNewTaskName] = useState('');

    const handleSave = () => {
        if (newTaskName.trim()) {
            onQuickAdd(id, newTaskName.trim());
        }
        setNewTaskName('');
        setActiveQuickAdd(null);
    };

    return (
        <div ref={setNodeRef} className={`flex flex-col h-full transition-colors ${
            isOver ? 'bg-indigo-50/50 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/50' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/80'
        } border rounded-2xl overflow-hidden`}>
            {/* Column Header */}
            <div className={`p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900`}>
                {icon}
                <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-bold truncate ${colorClass}`}>{title}</h3>
                </div>
                <span className="bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">{items.length}</span>
                {id !== 'unassigned' && (
                    <button 
                        onClick={() => setActiveQuickAdd(id)}
                        className="p-1 -mr-1 flex-shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-indigo-500"
                        title="Crear nueva tarea en esta área"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                )}
            </div>
            
            {/* Sortable Area */}
            <div className="p-3 flex-1 overflow-y-auto">
                <SortableContext id={id} items={items.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="min-h-[100px] h-full flex flex-col">
                        {items.length === 0 && activeQuickAdd !== id ? (
                            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl mb-2">
                                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium px-4 text-center">Arrastra tareas aquí o presiona +</span>
                            </div>
                        ) : (
                            items.map(item => <SortableTaskType key={item.id} taskType={item} onEdit={onEditTask} onDelete={onDeleteTask} />)
                        )}
                        
                        {/* Inline Quick Add Input */}
                        {activeQuickAdd === id && (
                            <div className="flex flex-col gap-2 p-2.5 mb-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl shadow-inner animate-in fade-in slide-in-from-top-2">
                                <input 
                                    autoFocus
                                    placeholder="Nombre de la tarea..."
                                    value={newTaskName}
                                    onChange={e => setNewTaskName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleSave();
                                        if (e.key === 'Escape') setActiveQuickAdd(null);
                                    }}
                                    className="w-full text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <div className="flex items-center justify-end gap-1 mt-1">
                                    <button onClick={() => setActiveQuickAdd(null)} className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={handleSave} className="p-1 rounded text-white bg-indigo-500 hover:bg-indigo-600 shadow-sm">
                                        <Check className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </SortableContext>
            </div>
        </div>
    );
}

// ==========================================
// Main Kanban Board
// ==========================================
export default function AreaTaskKanban({ workAreaTypes, taskTypes }) {
    const { setConfirmDelete } = useAppData();
    
    // Local state to manage rapid DnD updates before saving to server
    const [boards, setBoards] = useState({});
    const [activeId, setActiveId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [unsavedChanges, setUnsavedChanges] = useState(false);
    const [activeQuickAdd, setActiveQuickAdd] = useState(null);

    // Initialize board state from props
    useEffect(() => {
        if (!workAreaTypes || !taskTypes) return;

        const newBoards = {
            unassigned: []
        };
        
        // Initialize area buckets
        workAreaTypes.forEach(area => {
            newBoards[area.id] = [];
        });

        // Track which tasks are assigned
        const assignedTaskIds = new Set();

        // Populate area buckets
        workAreaTypes.forEach(area => {
            // Support legacy formats where names were used or new generic format
            const rawTypes = area.taskTypeIds || area.defaultTaskTypes || [];
            
            // Map IDs or Names to real task types
            const resolvedTypes = [];
            rawTypes.forEach(val => {
                let typeObj = taskTypes.find(t => t.id === val);
                if (!typeObj) typeObj = taskTypes.find(t => t.name === val); // Legacy fallback
                
                if (typeObj) {
                    resolvedTypes.push(typeObj);
                    assignedTaskIds.add(typeObj.id);
                }
            });
            
            newBoards[area.id] = resolvedTypes;
        });

        // Populate unassigned bucket
        taskTypes.forEach(t => {
            if (!assignedTaskIds.has(t.id)) {
                newBoards.unassigned.push(t);
            }
        });

        setBoards(newBoards);
        setUnsavedChanges(false);
    }, [workAreaTypes, taskTypes]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // --- Save to Firebase ---
    const handleSave = async () => {
        if (!unsavedChanges) return;
        setIsSaving(true);
        try {
            for (const area of workAreaTypes) {
                const typesInBoard = boards[area.id] || [];
                const typeIds = typesInBoard.map(t => t.id);
                
                // Compare with original to avoid redundant saves
                const rawOriginals = area.taskTypeIds || area.defaultTaskTypes || [];
                const origIds = rawOriginals.map(val => {
                    let typeObj = taskTypes.find(t => t.id === val) || taskTypes.find(t => t.name === val);
                    return typeObj ? typeObj.id : null;
                }).filter(Boolean);
                
                // If diff, update
                if (JSON.stringify(typeIds.sort()) !== JSON.stringify(origIds.sort())) {
                    await updateWorkAreaTypeMapping(area.id, typeIds);
                }
            }
            setUnsavedChanges(false);
        } catch (error) {
            console.error("Error saving Kanban mapping:", error);
        }
        setIsSaving(false);
    };

    // --- Auto Save Effect ---
    useEffect(() => {
        if (!activeId && unsavedChanges && !isSaving) {
            handleSave();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId, unsavedChanges]);

    // --- DnD Handlers ---
    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDragOver = (event) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        // Find which column they are from
        const activeContainer = Object.keys(boards).find(key => boards[key].some(t => t.id === activeId));
        const overContainer = Object.keys(boards).find(key => key === overId || boards[key].some(t => t.id === overId));

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        // Cross-container movement
        setBoards(prev => {
            const activeItems = prev[activeContainer];
            const overItems = prev[overContainer];
            
            const activeIndex = activeItems.findIndex(t => t.id === activeId);
            const overIndex = overId === overContainer 
                ? overItems.length + 1 
                : overItems.findIndex(t => t.id === overId);

            return {
                ...prev,
                [activeContainer]: [...prev[activeContainer].filter(item => item.id !== activeId)],
                [overContainer]: [
                    ...prev[overContainer].slice(0, overIndex),
                    activeItems[activeIndex],
                    ...prev[overContainer].slice(overIndex, prev[overContainer].length)
                ]
            };
        });
        setUnsavedChanges(true);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        const activeContainer = Object.keys(boards).find(key => boards[key].some(t => t.id === activeId));
        const overContainer = Object.keys(boards).find(key => key === overId || boards[key].some(t => t.id === overId));

        if (activeContainer && overContainer && activeContainer === overContainer) {
            // Reorder within the same container
            const items = boards[activeContainer];
            const oldIndex = items.findIndex(t => t.id === activeId);
            const newIndex = items.findIndex(t => t.id === overId);
            
            if (oldIndex !== newIndex) {
                setBoards(prev => ({
                    ...prev,
                    [activeContainer]: arrayMove(items, oldIndex, newIndex)
                }));
                setUnsavedChanges(true);
            }
        }
    };

    // --- Quick Add ---
    const handleAddDirectTask = async (areaId, taskName) => {
        setIsSaving(true);
        try {
            // 1. Create task_type globally
            const typeRef = await addDoc(collection(db, COLLECTIONS.TASK_TYPES), { name: taskName });
            
            // 2. Fetch original area mapping to append to it strictly
            const area = workAreaTypes.find(a => a.id === areaId);
            if (!area) return;
            
            const rawOriginals = area.taskTypeIds || area.defaultTaskTypes || [];
            const origIds = rawOriginals.map(val => {
                let typeObj = taskTypes.find(t => t.id === val) || taskTypes.find(t => t.name === val);
                return typeObj ? typeObj.id : val; // Keep existing IDs
            });
            
            const newIds = [...origIds, typeRef.id];
            
            // 3. Update immediately in Firebase
            await updateWorkAreaTypeMapping(areaId, newIds);
            
            // 4. Temporarily add to local UI unassigned to simulate creation
            // However, the Firebase listener from Context will refresh engTasks very soon,
            // so we don't strictly *need* to manually update the board logic here - it will reload.
            // But let's trigger an unsaved changes reset just in case.
        } catch (error) {
            console.error("Error creating direct task type:", error);
            alert("No se pudo agregar la tarea.");
        }
        setIsSaving(false);
    };

    // --- Edit Task Type ---
    const handleEditTaskType = async (taskId, newName) => {
        if (!newName.trim()) return;
        const existing = taskTypes.find(t => t.id === taskId);
        if (existing && existing.name === newName.trim()) return;

        setIsSaving(true);
        try {
            await updateDoc(doc(db, COLLECTIONS.TASK_TYPES, taskId), { name: newName.trim() });
        } catch (error) {
            console.error("Error updating task type:", error);
            alert("No se pudo editar la tarea.");
        }
        setIsSaving(false);
    };

    // --- Delete Task Type ---
    const handleDeleteTaskType = (taskId, taskName) => {
        setConfirmDelete({
            isOpen: true,
            title: 'Eliminar Tipo de Tarea',
            message: `¿Estás seguro de eliminar el tipo de tarea "${taskName}"? Se removerá de todas las áreas de trabajo permanentemente.`,
            onConfirm: async () => {
                setIsSaving(true);
                try {
                    // 1. Delete from global collection
                    await deleteDoc(doc(db, COLLECTIONS.TASK_TYPES, taskId));
                    
                    // 2. Remove any references from work areas
                    for (const area of workAreaTypes) {
                        const rawOriginals = area.taskTypeIds || area.defaultTaskTypes || [];
                        // Check if it's referenced by ID or by Name
                        if (rawOriginals.includes(taskId) || rawOriginals.includes(taskName)) {
                            const newIds = rawOriginals.filter(v => v !== taskId && v !== taskName);
                            await updateWorkAreaTypeMapping(area.id, newIds);
                        }
                    }
                } catch (error) {
                    console.error("Error deleting task type:", error);
                    alert("No se pudo eliminar la tarea.");
                }
                setIsSaving(false);
            }
        });
    };

    // --- Active Item lookup for DragOverlay ---
    const activeTaskType = useMemo(() => {
        if (!activeId || !taskTypes) return null;
        return taskTypes.find(t => t.id === activeId);
    }, [activeId, taskTypes]);

    if (!workAreaTypes || workAreaTypes.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-lg">
                <Compass className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Faltan Áreas de Trabajo</h3>
                <p className="text-xs text-slate-500 mt-1">Configura las áreas de trabajo arriba para utilizar este tablero.</p>
            </div>
        );
    }

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } })
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 350px)', minHeight: '600px' }}>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-100 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400 rounded-xl flex items-center justify-center">
                        <LayoutGrid className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-slate-800 dark:text-white">Tablero de Asignación: Tipos a Áreas</h2>
                        <p className="text-xs text-slate-500">Arrastra los tipos de tarea a sus columnas correspondientes.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold transition-colors">
                    {isSaving ? (
                        <span className="flex items-center gap-1.5 text-teal-500 dark:text-teal-400">
                            <span className="animate-pulse text-[10px]">●</span> Guardando...
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
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
                        <div className="w-64 flex-shrink-0 h-full pb-6">
                            <DroppableColumn 
                                id="unassigned"
                                title="Sin Asignar (Pool de Tareas)"
                                icon={<div className="w-2 h-2 rounded-full bg-slate-400" />}
                                colorClass="text-slate-600 dark:text-slate-300"
                                items={boards.unassigned || []}
                                activeQuickAdd={activeQuickAdd}
                                setActiveQuickAdd={setActiveQuickAdd}
                                onQuickAdd={handleAddDirectTask}
                                onEditTask={handleEditTaskType}
                                onDeleteTask={handleDeleteTaskType}
                            />
                        </div>

                        {/* Work Area Columns */}
                        {workAreaTypes.map(area => (
                            <div key={area.id} className="w-64 flex-shrink-0 h-full pb-6">
                                <DroppableColumn 
                                    id={area.id}
                                    title={area.name}
                                    icon={<div className="w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]" />}
                                    colorClass="text-teal-700 dark:text-teal-400"
                                    items={boards[area.id] || []}
                                    activeQuickAdd={activeQuickAdd}
                                    setActiveQuickAdd={setActiveQuickAdd}
                                    onQuickAdd={handleAddDirectTask}
                                    onEditTask={handleEditTaskType}
                                    onDeleteTask={handleDeleteTaskType}
                                />
                            </div>
                        ))}
                    </div>

                    <DragOverlay dropAnimation={dropAnimation}>
                        {activeTaskType ? <SortableTaskType taskType={activeTaskType} /> : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </div>
    );
}
