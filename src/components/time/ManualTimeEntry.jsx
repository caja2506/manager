import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, Clock, Zap, ListTodo, FolderGit2, FileText } from 'lucide-react';
import { createManualTimeLog, updateTimeLog, deleteTimeLog, confirmDraftLogs } from '../../services/timeService';
import { useEngineeringData } from '../../hooks/useEngineeringData';


/**
 * ManualTimeEntry — supports CREATE and EDIT modes.
 * Pass `editLog` prop to open in edit mode with pre-filled data.
 */
export default function ManualTimeEntry({
    isOpen, onClose, tasks, projects, userId, teamMembers = [], editLog = null
}) {
    const { timeLogs } = useEngineeringData();
    const isEditMode = !!editLog;
    const [selectedDraftId, setSelectedDraftId] = useState(null);

    const isoToLocalTimeStr = (isoStr) => {
        if (!isoStr) return '09:00';
        try {
            const d = new Date(isoStr);
            const h = String(d.getHours()).padStart(2, '0');
            const m = String(d.getMinutes()).padStart(2, '0');
            return `${h}:${m}`;
        } catch {
            return '09:00';
        }
    };


    const getLocalDateString = (d = new Date()) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Helpers de tiempo
    const timeToMinutes = (timeStr) => {
        if (!timeStr) return 540; // default 09:00 (9 * 60)
        const [h, m] = timeStr.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const minutesToTime = (mins) => {
        const h = Math.floor(mins / 60) % 24;
        const m = Math.round(mins % 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const calculateDuration = (start, end) => {
        const startMins = timeToMinutes(start);
        let endMins = timeToMinutes(end);
        if (endMins < startMins) endMins += 1440; // Cruza la medianoche
        return (endMins - startMins) / 60;
    };

    const [form, setForm] = useState({
        taskId: '',
        projectId: '',
        date: getLocalDateString(),
        startHour: '09:00',
        endHour: '10:00',
        notes: '',
        overtime: false,
    });
    const [workedHours, setWorkedHours] = useState(1);
    const [selectedUserId, setSelectedUserId] = useState(userId || '');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [taskQuery, setTaskQuery] = useState('');
    const [tempBlockPos, setTempBlockPos] = useState(null); // { id, startHour, endHour }

    // Sincronizadores bidireccionales
    const handleStartHourChange = (newStart) => {
        const startMins = timeToMinutes(newStart);
        const endMins = (startMins + Math.round(workedHours * 60)) % 1440;
        setForm(f => ({
            ...f,
            startHour: newStart,
            endHour: minutesToTime(endMins)
        }));
    };

    const handleWorkedHoursChange = (newHours) => {
        const hours = Math.max(0.25, Math.min(24, Number(newHours)));
        setWorkedHours(hours);
        const startMins = timeToMinutes(form.startHour);
        const endMins = (startMins + Math.round(hours * 60)) % 1440;
        setForm(f => ({
            ...f,
            endHour: minutesToTime(endMins)
        }));
    };

    const handleEndHourChange = (newEnd) => {
        const duration = calculateDuration(form.startHour, newEnd);
        setForm(f => ({ ...f, endHour: newEnd }));
        setWorkedHours(duration);
    };

    // Populate form when editing
    useEffect(() => {
        if (editLog && isOpen) {
            const start = editLog.startTime ? new Date(editLog.startTime) : null;
            const end = editLog.endTime ? new Date(editLog.endTime) : null;
            const startStr = start ? start.toTimeString().slice(0, 5) : '09:00';
            const endStr = end ? end.toTimeString().slice(0, 5) : '10:00';
            const duration = calculateDuration(startStr, endStr);
            setForm({
                taskId: editLog.taskId || '',
                projectId: editLog.projectId || '',
                date: start ? getLocalDateString(start) : getLocalDateString(),
                startHour: startStr,
                endHour: endStr,
                notes: editLog.notes || '',
                overtime: editLog.overtime || false,
            });
            setWorkedHours(duration);
            setSelectedUserId(editLog.userId || userId || '');
            setSelectedDraftId(null);
        } else if (isOpen && !editLog) {
            setForm({
                taskId: '', projectId: '',
                date: getLocalDateString(),
                startHour: '09:00', endHour: '10:00', notes: '', overtime: false,
            });
            setWorkedHours(1);
            setSelectedUserId(userId || '');
            setSelectedDraftId(null);
        }
        if (isOpen) {
            setTaskQuery('');
            setTempBlockPos(null);
        }
    }, [editLog, isOpen, userId]);

    const getLocalDateOnly = (isoStr) => {
        if (!isoStr) return '';
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return '';
            return getLocalDateString(d);
        } catch {
            return '';
        }
    };

    const currentDrafts = useMemo(() => {
        if (!timeLogs || !selectedUserId || !form.date) return [];
        return timeLogs.filter(log => 
            log.userId === selectedUserId &&
            log.status === 'draft' &&
            getLocalDateOnly(log.startTime) === form.date
        );
    }, [timeLogs, selectedUserId, form.date]);

    const currentConfirmed = useMemo(() => {
        if (!timeLogs || !selectedUserId || !form.date) return [];
        return timeLogs.filter(log => 
            log.userId === selectedUserId &&
            log.status === 'confirmed' &&
            getLocalDateOnly(log.startTime) === form.date
        );
    }, [timeLogs, selectedUserId, form.date]);

    const [isConfirmingDrafts, setIsConfirmingDrafts] = useState(false);

    const handleConfirmLocalDrafts = async () => {
        if (!currentDrafts.length) return;
        setIsConfirmingDrafts(true);
        try {
            const result = await confirmDraftLogs(currentDrafts);
            console.log(`[ManualTimeEntry] Confirmed ${result.count} drafts for ${selectedUserId} on ${form.date}`);
        } catch (err) {
            console.error('[ManualTimeEntry] Error confirming drafts:', err);
        }
        setIsConfirmingDrafts(false);
    };

    const applyDraftSuggestion = (draft) => {
        const startHour = isoToLocalTimeStr(draft.startTime);
        const endHour = isoToLocalTimeStr(draft.endTime);
        const duration = calculateDuration(startHour, endHour);
        
        setForm({
            projectId: draft.projectId || '',
            taskId: draft.taskId || '',
            date: draft.startTime ? draft.startTime.slice(0, 10) : getLocalDateString(),
            startHour,
            endHour,
            notes: draft.notes && draft.notes !== 'Sugerido desde el planificador'
                ? draft.notes
                : (draft.taskTitle || ''),
            overtime: draft.overtime || false,
        });
        setWorkedHours(duration);
        setSelectedDraftId(draft.id);
    };

    // Filter tasks by selected project and user assignment
    const filteredTasks = useMemo(() => {
        if (!tasks) return [];
        return tasks.filter(t => {
            if (t.status === 'completed' || t.status === 'cancelled') return false;
            
            // If a project is selected, show tasks belonging to that project
            if (form.projectId) {
                return t.projectId === form.projectId;
            }
            
            // If no project is selected, show all tasks assigned to the user
            return t.assignedTo === selectedUserId;
        });
    }, [tasks, form.projectId, selectedUserId]);

    // Apply text search on top of filtered tasks
    const searchedTasks = useMemo(() => {
        const query = taskQuery.toLowerCase().trim();
        if (!query) return filteredTasks;
        return filteredTasks.filter(t => 
            (t.title || '').toLowerCase().includes(query) || 
            (t.description || '').toLowerCase().includes(query)
        );
    }, [filteredTasks, taskQuery]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!form.date || !form.startHour || !form.endHour) return;
        setIsSaving(true);
        setError('');
        try {
            // Parse the date and time explicitly to avoid browser quirks with ISO strings
            const [y, m, d] = form.date.split('-').map(Number);
            const [sh, sm] = form.startHour.split(':').map(Number);
            const [eh, em] = form.endHour.split(':').map(Number);
            
            const startDate = new Date(y, m - 1, d, sh, sm, 0);
            const endDate = new Date(y, m - 1, d, eh, em, 0);

            // Output as fully-qualified UTC ISO strings
            const startTime = startDate.toISOString();
            const endTime = endDate.toISOString();

            console.log("DEBUG TZ -> Local Start:", startDate.toString());
            console.log("DEBUG TZ -> ISO Start:", startTime);

            // Obtener el planItemId para asociar el nuevo log manual al bloque del planificador
            let associatedPlanItemId = null;
            if (selectedDraftId) {
                const selDraftObj = currentDrafts.find(d => d.id === selectedDraftId);
                associatedPlanItemId = selDraftObj?.planItemId || null;
            }

            const startNew = new Date(startTime);
            const endNew = new Date(endTime);

            // Filtrar borradores locales que se solapan en tiempo
            const overlappingDrafts = currentDrafts.filter(draft => {
                if (draft.id === selectedDraftId) return true;
                const draftStart = new Date(draft.startTime);
                const draftEnd = new Date(draft.endTime);
                return draftStart < endNew && draftEnd > startNew;
            });

            if (!associatedPlanItemId && overlappingDrafts.length > 0) {
                associatedPlanItemId = overlappingDrafts[0]?.planItemId || null;
            }

            if (isEditMode) {
                await updateTimeLog(editLog.id, {
                    taskId: form.taskId || null,
                    projectId: form.projectId || null,
                    startTime,
                    endTime,
                    notes: form.notes,
                    overtime: form.overtime,
                });
            } else {
                await createManualTimeLog({
                    taskId: form.taskId || null,
                    projectId: form.projectId || null,
                    userId: selectedUserId || userId,
                    startTime,
                    endTime,
                    notes: form.notes,
                    overtime: form.overtime,
                    planItemId: associatedPlanItemId,
                });
            }

            // --- EVITAR DUPLICIDAD DE HORAS ---
            // Sincronizar y eliminar borradores solapados/seleccionados
            // Combinar los IDs de borradores solapados y el seleccionado
            const draftsToDelete = [...new Set([
                ...overlappingDrafts.map(d => d.id),
                ...(selectedDraftId ? [selectedDraftId] : [])
            ])];

            // Eliminar de la base de datos uno a uno
            for (const draftId of draftsToDelete) {
                try {
                    const draftObj = currentDrafts.find(d => d.id === draftId);
                    await deleteTimeLog(draftId, draftObj?.taskId, draftObj?.projectId);
                    console.log(`[ManualTimeEntry] Deleted draft log to prevent duplication: ${draftId}`);
                } catch (err) {
                    console.error(`[ManualTimeEntry] Error deleting draft log ${draftId}:`, err);
                }
            }

            onClose();
        } catch (err) {
            console.error('Error saving time log:', err);
            setError(err.message || 'Error guardando registro');
        }
        setIsSaving(false);
    };

    const confirmedHoursToday = useMemo(() => {
        return currentConfirmed.reduce((sum, log) => sum + (log.totalHours || 0), 0);
    }, [currentConfirmed]);

    const suggestedHoursToday = useMemo(() => {
        return currentDrafts.reduce((sum, log) => sum + (log.totalHours || 0), 0);
    }, [currentDrafts]);

    const totalHoursToday = confirmedHoursToday + suggestedHoursToday;

    const START_HOUR = 8;
    const END_HOUR = 17;
    const ROW_HEIGHT = 44;

    const TIME_BANDS = [
        {
            id:     'desayuno',
            label:  '🍳 Desayuno',
            start:  8,
            end:    8.5,
            bg:     'rgba(245, 158, 11, 0.08)',
            border: 'rgba(245, 158, 11, 0.25)',
            text:   '#d97706',
            textDark:'#fbbf24',
        },
        {
            id:     'almuerzo',
            label:  '🍽 Almuerzo',
            start:  12,
            end:    13,
            bg:     'rgba(16, 185, 129, 0.08)',
            border: 'rgba(16, 185, 129, 0.25)',
            text:   '#059669',
            textDark:'#34d399',
        },
        {
            id:     'cafe',
            label:  '☕ Café',
            start:  15.5,
            end:    16,
            bg:     'rgba(249, 115, 22, 0.08)',
            border: 'rgba(234, 88, 12, 0.25)',
            text:   '#ea580c',
            textDark:'#fb923c',
        },
    ];

    // --- INTERACTIVE TIMELINE DRAG & RESIZE HANDLERS FOR GHOST BLOCK ---

    const handleGhostDragStart = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const initialY = e.clientY;
        const initialStartMins = timeToMinutes(form.startHour);
        const durationMins = Math.round(workedHours * 60);

        const handleMouseMove = (mv) => {
            const deltaY = mv.clientY - initialY;
            const deltaMins = (deltaY / ROW_HEIGHT) * 60;
            
            // Snap a múltiplos de 15 minutos (0.25h)
            const snappedDeltaMins = Math.round(deltaMins / 15) * 15;
            let newStartMins = initialStartMins + snappedDeltaMins;

            // Limitar al rango laboral del timeline (START_HOUR a END_HOUR)
            const minAllowedMins = START_HOUR * 60;
            const maxAllowedMins = END_HOUR * 60 - durationMins;
            newStartMins = Math.max(minAllowedMins, Math.min(maxAllowedMins, newStartMins));

            const newStartStr = minutesToTime(newStartMins);
            const newEndMins = (newStartMins + durationMins) % 1440;

            setForm(f => ({
                ...f,
                startHour: newStartStr,
                endHour: minutesToTime(newEndMins)
            }));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup',   handleMouseUp);
    };

    const handleGhostResizeStart = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const initialY = e.clientY;
        const initialDurationMins = Math.round(workedHours * 60);
        const startMins = timeToMinutes(form.startHour);

        const handleMouseMove = (mv) => {
            const deltaY = mv.clientY - initialY;
            const deltaMins = (deltaY / ROW_HEIGHT) * 60;

            // Snap a múltiplos de 15 minutos (0.25h)
            const snappedDeltaMins = Math.round(deltaMins / 15) * 15;
            let newDurationMins = initialDurationMins + snappedDeltaMins;

            // Mínimo 15 minutos y máximo hasta el fin del timeline
            const minDurationMins = 15;
            const maxDurationMins = (END_HOUR * 60) - startMins;
            newDurationMins = Math.max(minDurationMins, Math.min(maxDurationMins, newDurationMins));

            const newDurationHours = newDurationMins / 60;
            const newEndMins = (startMins + newDurationMins) % 1440;

            setWorkedHours(newDurationHours);
            setForm(f => ({
                ...f,
                endHour: minutesToTime(newEndMins)
            }));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup',   handleMouseUp);
    };

    const handleExistingBlockDragStart = (e, log) => {
        e.preventDefault();
        e.stopPropagation();

        const initialY = e.clientY;
        const startDt = new Date(log.startTime);
        const endDt = new Date(log.endTime);
        const durationMins = Math.round((endDt - startDt) / 60000);
        const initialStartMins = startDt.getHours() * 60 + startDt.getMinutes();

        const handleMouseMove = (mv) => {
            const deltaY = mv.clientY - initialY;
            const deltaMins = (deltaY / ROW_HEIGHT) * 60;
            const snappedDeltaMins = Math.round(deltaMins / 15) * 15;
            let newStartMins = initialStartMins + snappedDeltaMins;

            // Limitar al rango laboral (8 a 17)
            const minAllowedMins = START_HOUR * 60;
            const maxAllowedMins = END_HOUR * 60 - durationMins;
            newStartMins = Math.max(minAllowedMins, Math.min(maxAllowedMins, newStartMins));

            const newStartStr = minutesToTime(newStartMins);
            const newEndMins = (newStartMins + durationMins) % 1440;
            const newEndStr = minutesToTime(newEndMins);

            setTempBlockPos({
                id: log.id,
                startHour: newStartStr,
                endHour: newEndStr
            });
        };

        const handleMouseUp = async () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup',   handleMouseUp);

            if (tempBlockPos && tempBlockPos.id === log.id) {
                const [sh, sm] = tempBlockPos.startHour.split(':').map(Number);
                const [eh, em] = tempBlockPos.endHour.split(':').map(Number);
                
                const baseStart = new Date(log.startTime);
                const newStartDt = new Date(baseStart.getFullYear(), baseStart.getMonth(), baseStart.getDate(), sh, sm, 0);
                const newEndDt = new Date(baseStart.getFullYear(), baseStart.getMonth(), baseStart.getDate(), eh, em, 0);

                try {
                    await updateTimeLog(log.id, {
                        startTime: newStartDt.toISOString(),
                        endTime: newEndDt.toISOString()
                    });
                    console.log(`[ManualTimeEntry] Dragged existing log ${log.id} successfully.`);
                } catch (err) {
                    console.error("[ManualTimeEntry] Error dragging existing log:", err);
                    setError("Error al reposicionar registro");
                }
            }
            setTempBlockPos(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup',   handleMouseUp);
    };

    const handleExistingBlockResizeStart = (e, log) => {
        e.preventDefault();
        e.stopPropagation();

        const initialY = e.clientY;
        const startDt = new Date(log.startTime);
        const endDt = new Date(log.endTime);
        const initialDurationMins = Math.round((endDt - startDt) / 60000);
        const startMins = startDt.getHours() * 60 + startDt.getMinutes();

        const handleMouseMove = (mv) => {
            const deltaY = mv.clientY - initialY;
            const deltaMins = (deltaY / ROW_HEIGHT) * 60;
            const snappedDeltaMins = Math.round(deltaMins / 15) * 15;
            let newDurationMins = initialDurationMins + snappedDeltaMins;

            // Mínimo 15 minutos, máximo hasta el final del rango laboral
            const minDurationMins = 15;
            const maxDurationMins = (END_HOUR * 60) - startMins;
            newDurationMins = Math.max(minDurationMins, Math.min(maxDurationMins, newDurationMins));

            const newEndMins = (startMins + newDurationMins) % 1440;
            const newEndStr = minutesToTime(newEndMins);

            setTempBlockPos({
                id: log.id,
                startHour: minutesToTime(startMins),
                endHour: newEndStr
            });
        };

        const handleMouseUp = async () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup',   handleMouseUp);

            if (tempBlockPos && tempBlockPos.id === log.id) {
                const [eh, em] = tempBlockPos.endHour.split(':').map(Number);
                const baseStart = new Date(log.startTime);
                const newEndDt = new Date(baseStart.getFullYear(), baseStart.getMonth(), baseStart.getDate(), eh, em, 0);

                try {
                    await updateTimeLog(log.id, {
                        startTime: baseStart.toISOString(),
                        endTime: newEndDt.toISOString()
                    });
                    console.log(`[ManualTimeEntry] Resized existing log ${log.id} successfully.`);
                } catch (err) {
                    console.error("[ManualTimeEntry] Error resizing existing log:", err);
                    setError("Error al redimensionar registro");
                }
            }
            setTempBlockPos(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup',   handleMouseUp);
    };

    const timelineScrollRef = useRef(null);

    // No scroll needed as timeline spans exactly 8 to 17
    useEffect(() => {
        if (isOpen && timelineScrollRef.current) {
            timelineScrollRef.current.scrollTop = 0;
        }
    }, [isOpen]);

    const getBlockStyle = (startHourStr, endHourStr) => {
        const getHourVal = (timeStr) => {
            if (!timeStr) return 8;
            if (timeStr.includes('T')) {
                const d = new Date(timeStr);
                return d.getHours() + d.getMinutes() / 60;
            }
            const [h, m] = timeStr.split(':').map(Number);
            return h + m / 60;
        };

        const startVal = getHourVal(startHourStr);
        const endVal = getHourVal(endHourStr);

        const top = Math.max(0, (startVal - START_HOUR) * ROW_HEIGHT);
        const height = Math.max(20, (endVal - startVal) * ROW_HEIGHT);

        return {
            top: `${top}px`,
            height: `${height}px`,
        };
    };

    const timelineHours = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
        timelineHours.push(h);
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            {/* Custom Range Sliders Premium Styling */}
            <style>{`
                .premium-slider {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 100%;
                    height: 6px;
                    border-radius: 9999px;
                    background: #1e293b; /* slate-800 */
                    outline: none;
                    transition: background 0.15s;
                }
                .premium-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #6366f1; /* indigo-500 */
                    cursor: pointer;
                    box-shadow: 0 0 10px rgba(99, 102, 241, 0.6);
                    transition: transform 0.1s, background-color 0.15s;
                }
                .premium-slider::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                    background: #4f46e5; /* indigo-600 */
                }
                .premium-slider::-moz-range-thumb {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #6366f1;
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 0 10px rgba(99, 102, 241, 0.6);
                    transition: transform 0.1s, background-color 0.15s;
                }
                .premium-slider::-moz-range-thumb:hover {
                    transform: scale(1.2);
                    background: #4f46e5;
                }
                .premium-select {
                    appearance: none;
                    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(100, 116, 139)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
                    background-repeat: no-repeat;
                    background-position: right 10px center;
                    background-size: 14px;
                    padding-right: 32px !important;
                }
            `}</style>

            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${isEditMode ? 'bg-indigo-500/10' : 'bg-green-500/10'} rounded-2xl flex items-center justify-center`}>
                            <Clock className={`w-5 h-5 ${isEditMode ? 'text-indigo-400' : 'text-green-400'}`} />
                        </div>
                        <h2 className="font-black text-lg tracking-tight text-white">
                            {isEditMode ? 'Editar Registro de Horas' : 'Registro de Horas Manual'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5 mb-4 animate-in fade-in duration-150">
                            {error}
                        </div>
                    )}

                    {/* TWO-COLUMN INTEGRATED LAYOUT: Form (7 cols) + Mini Daily Board (5 cols) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* LEFT COLUMN: Form Fields (7 columns) */}
                        <div className="lg:col-span-7 space-y-4">
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Sub-columna 1: Campos Generales */}
                                <div className="space-y-4">
                                    {/* Colaborador / Técnico selector */}
                                    {teamMembers.length > 0 && (
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">
                                                Colaborador / Técnico
                                            </span>
                                            <select
                                                value={selectedUserId}
                                                onChange={e => setSelectedUserId(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 font-bold transition-all premium-select"
                                            >
                                                {teamMembers.filter(u => {
                                                    const uid = u.uid || u.id;
                                                    return uid && !uid.startsWith('ext_');
                                                }).map(u => (
                                                    <option key={u.uid || u.id} value={u.uid || u.id}>
                                                        {u.displayName || u.email || 'Usuario'}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Project selector */}
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">
                                            <FolderGit2 className="w-3.5 h-3.5 inline mr-1 text-indigo-400" />Proyecto
                                        </span>
                                        <select
                                            value={form.projectId}
                                            onChange={e => setForm({ ...form, projectId: e.target.value, taskId: '' })}
                                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 transition-all premium-select"
                                        >
                                            <option value="">Sin proyecto</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Task selector (filtered by project) */}
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">
                                            <ListTodo className="w-3.5 h-3.5 inline mr-1 text-indigo-400" />Tarea
                                        </span>
                                        <select
                                            value={form.taskId}
                                            onChange={e => {
                                                const newTaskId = e.target.value;
                                                setForm(f => ({ ...f, taskId: newTaskId }));
                                                const t = tasks.find(t => t.id === newTaskId);
                                                if (t?.projectId && !form.projectId) {
                                                    setForm(f => ({ ...f, projectId: t.projectId }));
                                                }
                                            }}
                                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 transition-all premium-select"
                                        >
                                            <option value="">Sin tarea</option>
                                            {filteredTasks.map(t => (
                                                <option key={t.id} value={t.id}>{t.title}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Date */}
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Fecha</span>
                                        <input
                                            type="date"
                                            value={form.date}
                                            onChange={e => setForm({ ...form, date: e.target.value })}
                                            className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 transition-all"
                                        />
                                    </div>

                                    {/* Lista de Tareas Disponibles (Arrastrables / Clickeables) */}
                                    <div className="space-y-1.5 pt-1">
                                        <div className="text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-wider ml-1 mb-1.5 flex items-center justify-between">
                                            <span>Tareas Disponibles ({searchedTasks.length})</span>
                                            <span className="text-[8px] text-indigo-500 dark:text-indigo-400 normal-case font-bold animate-pulse">Arrastra al Timeline ➔</span>
                                        </div>
                                        
                                        {/* Input de Búsqueda de Tareas */}
                                        <div className="relative mb-2">
                                            <input
                                                type="text"
                                                placeholder="Buscar tarea..."
                                                value={taskQuery}
                                                onChange={e => setTaskQuery(e.target.value)}
                                                className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] outline-none focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 placeholder-slate-450 dark:placeholder-slate-600 transition-all font-medium"
                                            />
                                            {taskQuery && (
                                                <button
                                                    onClick={() => setTaskQuery('')}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-250 text-xs font-bold"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 scrollbar-track-transparent">
                                            {searchedTasks.length === 0 ? (
                                                <div className="text-[10px] text-slate-500 dark:text-slate-600 py-4 text-center font-bold bg-slate-50/30 dark:bg-slate-950/25 border border-dashed border-slate-200 dark:border-slate-850 rounded-xl">
                                                    No hay tareas activas
                                                </div>
                                            ) : (
                                                searchedTasks.map(t => {
                                                    const isSelected = form.taskId === t.id;
                                                    const projectObj = projects.find(p => p.id === t.projectId);
                                                    const priorityColors = {
                                                        critical: 'bg-red-500/10 border-red-500/20 text-red-650 dark:text-red-400',
                                                        high: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
                                                        medium: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400',
                                                        low: 'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400',
                                                    };
                                                    const pColor = priorityColors[t.priority] || priorityColors.medium;
                                                    return (
                                                        <div
                                                            key={t.id}
                                                            draggable
                                                            onDragStart={(e) => {
                                                                e.dataTransfer.setData('text/plain', `task:${t.id}`);
                                                                e.dataTransfer.effectAllowed = 'copy';
                                                            }}
                                                            onClick={() => {
                                                                setForm(f => ({ ...f, taskId: t.id, projectId: t.projectId || '' }));
                                                            }}
                                                            className={`p-2 rounded-lg border transition-all duration-150 cursor-grab active:cursor-grabbing flex items-center justify-between gap-2 text-left select-none ${
                                                                isSelected
                                                                    ? 'bg-indigo-500/10 border-indigo-500 text-indigo-900 dark:text-white shadow-sm shadow-indigo-550/10'
                                                                    : 'bg-slate-50/30 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-850/60 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                                                            }`}
                                                        >
                                                            <div className="flex-1 min-w-0 pr-1">
                                                                <div className="text-xs font-bold truncate">{t.title}</div>
                                                                {projectObj && (
                                                                    <div className="text-[9px] text-purple-600 dark:text-purple-400 font-bold truncate mt-0.5">
                                                                        📁 {projectObj.name}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${pColor}`}>
                                                                {t.priority}
                                                            </span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Sub-columna 2: Sliders & Tiempos */}
                                <div className="space-y-4">
                                    {/* Slider Hora de Inicio */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1 block">
                                                Hora de Inicio
                                            </span>
                                            <input
                                                type="time"
                                                value={form.startHour}
                                                onChange={e => handleStartHourChange(e.target.value)}
                                                className="px-2 py-0.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 font-bold transition-all"
                                            />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="range"
                                                min="0"
                                                max="95"
                                                step="1"
                                                value={Math.floor(timeToMinutes(form.startHour) / 15)}
                                                onChange={e => {
                                                    const mins = Number(e.target.value) * 15;
                                                    handleStartHourChange(minutesToTime(mins));
                                                }}
                                                className="premium-slider"
                                            />
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 min-w-[70px] text-right font-mono">
                                                {(() => {
                                                    const [h, m] = form.startHour.split(':').map(Number);
                                                    const ampm = h >= 12 ? 'PM' : 'AM';
                                                    const dispH = h % 12 === 0 ? 12 : h % 12;
                                                    return `${dispH}:${String(m).padStart(2, '0')} ${ampm}`;
                                                })()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Slider Horas Trabajadas */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1 block">
                                                Horas Trabajadas
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    min="0.25"
                                                    max="24"
                                                    step="0.25"
                                                    value={workedHours}
                                                    onChange={e => handleWorkedHoursChange(Number(e.target.value))}
                                                    className="w-14 px-1 py-0.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-950/40 text-center font-bold text-indigo-500 dark:text-indigo-400 transition-all"
                                                />
                                                <span className="text-xs text-slate-500 font-bold">h</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="range"
                                                min="0.25"
                                                max="24"
                                                step="0.25"
                                                value={workedHours}
                                                onChange={e => handleWorkedHoursChange(Number(e.target.value))}
                                                className="premium-slider"
                                            />
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 min-w-[70px] text-right font-mono">
                                                {workedHours.toFixed(2)}h
                                            </span>
                                        </div>
                                    </div>

                                    {/* Hora de Fin (calculada / ajustable) */}
                                    <div className="flex items-center justify-between bg-slate-50/30 dark:bg-slate-950/30 p-3 rounded-xl border border-slate-200/50 dark:border-slate-850">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">
                                                Hora de Fin
                                            </span>
                                            {(() => {
                                                const startMins = timeToMinutes(form.startHour);
                                                const endMins = timeToMinutes(form.endHour);
                                                if (endMins < startMins) {
                                                    return <span className="text-[9px] text-amber-500 font-bold ml-1 mt-0.5">⚠️ Siguiente día</span>;
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                                {(() => {
                                                    const [h, m] = form.endHour.split(':').map(Number);
                                                    const ampm = h >= 12 ? 'PM' : 'AM';
                                                    const dispH = h % 12 === 0 ? 12 : h % 12;
                                                    return `${dispH}:${String(m).padStart(2, '0')} ${ampm}`;
                                                })()}
                                            </span>
                                            <input
                                                type="time"
                                                value={form.endHour}
                                                onChange={e => handleEndHourChange(e.target.value)}
                                                className="px-2 py-0.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 font-bold transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">
                                    <FileText className="w-3.5 h-3.5 inline mr-1 text-indigo-400" />Notas
                                </span>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm({ ...form, notes: e.target.value })}
                                    placeholder="¿Qué lograste avanzar hoy?"
                                    rows="3"
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 resize-none transition-all"
                                />
                            </div>

                            {/* Horas Totales e Interruptor de Horas Extra (Alineados en tarjeta premium) */}
                            <div className="flex items-center justify-between p-4 bg-slate-50/30 dark:bg-slate-950/30 border border-slate-200/50 dark:border-slate-850 rounded-xl mt-2">
                                <div className="text-left">
                                    <span className="text-3xl font-black text-indigo-650 dark:text-indigo-400 tracking-tight tabular-nums">{workedHours.toFixed(2)}h</span>
                                    <p className="text-[9px] text-slate-450 uppercase tracking-wider font-black mt-0.5">Total de Horas</p>
                                </div>

                                {/* Premium iOS-like Switch for Overtime */}
                                <div className="flex items-center gap-3 px-3 py-2.5 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 dark:border-amber-500/20 rounded-xl select-none">
                                    <div className="flex items-center gap-1.5">
                                        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/10" />
                                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-450 uppercase tracking-wider">Tiempo extra</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, overtime: !f.overtime }))}
                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            form.overtime ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-800'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                form.overtime ? 'translate-x-4' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Mini Daily Board (5 columns) */}
                        <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 pt-6 lg:pt-0 lg:pl-6 flex flex-col h-full min-h-[460px]">
                            {/* Panel Integrado del Daily Board */}
                            <div className="bg-slate-50/20 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850/80 rounded-2xl p-4 flex-1 flex flex-col min-h-[400px]">
                                
                                {/* Cabecera del Panel Derecho */}
                                <div className="space-y-3 mb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 tracking-wider uppercase">
                                                Resumen de hoy
                                            </span>
                                        </div>
                                        {currentDrafts.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleConfirmLocalDrafts}
                                                disabled={isConfirmingDrafts}
                                                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-700/50 text-white font-bold text-[9px] rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1 shadow-md shadow-amber-900/10"
                                            >
                                                {isConfirmingDrafts ? 'Confirmando...' : '✓ Confirmar sugerencias'}
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-slate-50/50 dark:bg-slate-950/40 p-2 rounded-xl border border-slate-200/60 dark:border-slate-850/60">
                                            <div className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Confirmadas</div>
                                            <div className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{confirmedHoursToday.toFixed(1)}h</div>
                                        </div>
                                        <div className="bg-slate-50/50 dark:bg-slate-950/40 p-2 rounded-xl border border-slate-200/60 dark:border-slate-850/60">
                                            <div className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sugeridas</div>
                                            <div className="text-xs font-mono font-black text-amber-600 dark:text-amber-400 mt-0.5">{suggestedHoursToday.toFixed(1)}h</div>
                                        </div>
                                        <div className="bg-slate-50/50 dark:bg-slate-950/40 p-2 rounded-xl border border-slate-200/60 dark:border-slate-850/60">
                                            <div className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total</div>
                                            <div className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{totalHoursToday.toFixed(1)}h</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Grid del Timeline */}
                                <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950/20 rounded-2xl border border-slate-200 dark:border-slate-850 p-3 overflow-hidden shadow-inner">
                                    <div className="text-[9px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
                                        <span>Línea de Tiempo</span>
                                        <span className="text-slate-400 dark:text-slate-500 text-[8px] normal-case font-bold">Haz clic en ⏱️ para aplicar</span>
                                    </div>
                                    
                                    <div 
                                        ref={timelineScrollRef}
                                        className="flex-1 overflow-y-auto pr-1 relative"
                                        style={{ height: '310px' }}
                                    >
                                        <div className="flex relative" style={{ height: `${(END_HOUR - START_HOUR + 1) * ROW_HEIGHT}px` }}>
                                            {/* Regla de horas */}
                                            <div className="w-10 shrink-0 border-r border-slate-200 dark:border-slate-850 flex flex-col select-none pr-1">
                                                {timelineHours.map(h => (
                                                    <div 
                                                        key={h} 
                                                        className="flex items-start justify-end text-[9px] font-bold text-slate-400 dark:text-slate-500" 
                                                        style={{ height: `${ROW_HEIGHT}px` }}
                                                    >
                                                        {`${String(h).padStart(2, '0')}:00`}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Columna de bloques */}
                                            <div 
                                                className="flex-1 relative ml-1.5"
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    e.dataTransfer.dropEffect = 'copy';
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    const rawData = e.dataTransfer.getData('text/plain');
                                                    if (!rawData || !rawData.startsWith('task:')) return;
                                                    const droppedTaskId = rawData.replace('task:', '');
                                                    
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const relY = Math.max(0, e.clientY - rect.top);
                                                    
                                                    const hourVal = START_HOUR + relY / ROW_HEIGHT;
                                                    const snappedHourVal = Math.floor(hourVal * 4) / 4;
                                                    
                                                    const h = Math.floor(snappedHourVal);
                                                    const m = Math.round((snappedHourVal % 1) * 60);
                                                    const startStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                                    
                                                    const selectedTaskObj = tasks.find(t => t.id === droppedTaskId);
                                                    
                                                    setForm(f => {
                                                        const newStart = startStr;
                                                        const endMins = (timeToMinutes(newStart) + Math.round(workedHours * 60)) % 1440;
                                                        return {
                                                            ...f,
                                                            taskId: droppedTaskId,
                                                            projectId: selectedTaskObj?.projectId || '',
                                                            startHour: newStart,
                                                            endHour: minutesToTime(endMins)
                                                        };
                                                    });
                                                }}
                                            >
                                                {/* Líneas horizontales de fondo (Estilo Daily Board) */}
                                                {timelineHours.map(h => (
                                                    <React.Fragment key={h}>
                                                        <div 
                                                            className="absolute left-0 right-0 border-t border-slate-200/90 dark:border-slate-800/80" 
                                                            style={{ top: `${(h - START_HOUR) * ROW_HEIGHT}px` }}
                                                        />
                                                        {h < END_HOUR && (
                                                            <div 
                                                                className="absolute left-0 right-0 border-t border-dashed border-slate-200/40 dark:border-slate-800/30" 
                                                                style={{ top: `${(h - START_HOUR) * ROW_HEIGHT + ROW_HEIGHT / 2}px` }}
                                                            />
                                                        )}
                                                    </React.Fragment>
                                                ))}

                                                {/* Bandas de descanso / rutina (Estilo Daily Board) */}
                                                {TIME_BANDS.map(band => {
                                                    const top = Math.max(0, (band.start - START_HOUR) * ROW_HEIGHT);
                                                    const height = Math.max(10, (band.end - band.start) * ROW_HEIGHT);
                                                    return (
                                                        <div
                                                            key={band.id}
                                                            className="absolute left-0 right-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 select-none"
                                                            style={{
                                                                top: `${top}px`,
                                                                height: `${height}px`,
                                                                background: band.bg,
                                                                borderTop: `1.5px dashed ${band.border}`,
                                                                borderBottom: `1.5px dashed ${band.border}`,
                                                            }}
                                                        >
                                                            <span
                                                                className="text-[9px] font-black uppercase tracking-[0.18em] select-none whitespace-nowrap"
                                                            >
                                                                <span className="dark:hidden font-black" style={{ color: band.text }}>{band.label}</span>
                                                                <span className="hidden dark:inline font-black" style={{ color: band.textDark }}>{band.label}</span>
                                                            </span>
                                                        </div>
                                                    );
                                                })}

                                                {/* Bloques confirmados reales */}
                                                {currentConfirmed.map(log => {
                                                    const isTemp = tempBlockPos && tempBlockPos.id === log.id;
                                                    const startVal = isTemp ? tempBlockPos.startHour : log.startTime;
                                                    const endVal = isTemp ? tempBlockPos.endHour : log.endTime;
                                                    const style = getBlockStyle(startVal, endVal);
                                                    const startDisp = isTemp ? tempBlockPos.startHour : isoToLocalTimeStr(log.startTime);
                                                    const endDisp = isTemp ? tempBlockPos.endHour : isoToLocalTimeStr(log.endTime);
                                                    
                                                    // Calculate display hours
                                                    let displayHrs = log.totalHours || 0;
                                                    if (isTemp) {
                                                        displayHrs = calculateDuration(tempBlockPos.startHour, tempBlockPos.endHour);
                                                    }

                                                    // Get task priority styles matching Daily Board
                                                    const taskObj = tasks.find(t => t.id === log.taskId);
                                                    const priority = taskObj?.priority || 'medium';
                                                    
                                                    const priorityStyles = {
                                                        critical: 'bg-red-500 border-red-700 text-white',
                                                        high:     'bg-amber-500 border-amber-700 text-white',
                                                        medium:   'bg-indigo-505 border-indigo-700 text-white',
                                                        low:      'bg-slate-500 border-slate-700 text-white',
                                                    };
                                                    const styleClass = priorityStyles[priority] || priorityStyles.medium;

                                                    return (
                                                        <div
                                                            key={log.id}
                                                            onMouseDown={(e) => handleExistingBlockDragStart(e, log)}
                                                            className={`absolute left-0.5 right-0.5 rounded-xl border-l-4 border-emerald-500 ${styleClass} text-[9px] px-2.5 py-1.5 overflow-hidden select-none z-[15] shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:shadow-xl transition-shadow cursor-grab active:cursor-grabbing group/confirmed`}
                                                            style={style}
                                                            title={`${log.taskTitle || 'Sin título'} (${displayHrs.toFixed(2)}h)`}
                                                        >
                                                            <div className="flex justify-between items-start pointer-events-none">
                                                                <div className="font-black truncate pr-1">
                                                                    {log.taskTitle || 'Registro Manual'}
                                                                </div>
                                                                <span className="text-[8px] font-black bg-white/25 px-1 py-0.2 rounded shrink-0">
                                                                    {displayHrs.toFixed(1)}h
                                                                </span>
                                                            </div>
                                                            <div className="text-[8px] opacity-80 font-mono font-bold mt-1 pointer-events-none">
                                                                {startDisp} - {endDisp}
                                                            </div>

                                                            {/* Manilla para estirar (borde inferior) */}
                                                            <div 
                                                                onMouseDown={(e) => handleExistingBlockResizeStart(e, log)}
                                                                className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center bg-white/10 border-t border-white/20 opacity-0 group-hover/confirmed:opacity-100 transition-opacity"
                                                                title="Arrastra para cambiar duración"
                                                            >
                                                                <div className="w-6 h-0.5 rounded-full bg-white/80" />
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Bloques sugeridos en borrador */}
                                                {currentDrafts.map(draft => {
                                                    const isTemp = tempBlockPos && tempBlockPos.id === draft.id;
                                                    const startVal = isTemp ? tempBlockPos.startHour : draft.startTime;
                                                    const endVal = isTemp ? tempBlockPos.endHour : draft.endTime;
                                                    const style = getBlockStyle(startVal, endVal);
                                                    const startDisp = isTemp ? tempBlockPos.startHour : isoToLocalTimeStr(draft.startTime);
                                                    const endDisp = isTemp ? tempBlockPos.endHour : isoToLocalTimeStr(draft.endTime);
                                                    const isSelected = selectedDraftId === draft.id;

                                                    // Calculate display hours
                                                    let displayHrs = draft.totalHours || 0;
                                                    if (isTemp) {
                                                        displayHrs = calculateDuration(tempBlockPos.startHour, tempBlockPos.endHour);
                                                    }

                                                    return (
                                                        <div
                                                            key={draft.id}
                                                            onMouseDown={(e) => handleExistingBlockDragStart(e, draft)}
                                                            className={`absolute left-0.5 right-0.5 rounded-xl border-l-4 border-dashed border-amber-500 bg-slate-100/90 dark:bg-slate-900/95 border border-y-slate-200/80 dark:border-y-slate-800 border-r-slate-200/80 dark:border-r-slate-800 text-slate-800 dark:text-slate-200 text-[9px] px-2.5 py-1.5 overflow-hidden transition-all duration-205 z-[15] cursor-grab active:cursor-grabbing group/draft shadow-sm ${
                                                                isSelected
                                                                    ? 'ring-2 ring-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                                                                    : 'hover:bg-slate-200/70 dark:hover:bg-slate-850'
                                                            }`}
                                                            style={style}
                                                            title={`Sugerencia: ${draft.taskTitle || 'Planificación libre'} (${displayHrs.toFixed(2)}h)`}
                                                        >
                                                            <div 
                                                                onClick={(e) => {
                                                                    if (!tempBlockPos) {
                                                                        applyDraftSuggestion(draft);
                                                                    }
                                                                }}
                                                                className="h-full w-full pointer-events-auto flex flex-col justify-between"
                                                            >
                                                                <div>
                                                                    <div className="font-black truncate flex items-center gap-1 pointer-events-none text-slate-700 dark:text-slate-350">
                                                                        <span className="text-amber-500 font-bold">⏱️</span>
                                                                        <span className="truncate">{draft.taskTitle || 'Planificación libre'}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-between items-center mt-1 pointer-events-none">
                                                                    <span className="text-[8px] text-slate-500 dark:text-slate-400 font-mono font-semibold">
                                                                        {startDisp} - {endDisp}
                                                                    </span>
                                                                    <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded">
                                                                        {displayHrs.toFixed(1)}h
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Manilla para estirar (borde inferior) */}
                                                            <div 
                                                                onMouseDown={(e) => handleExistingBlockResizeStart(e, draft)}
                                                                className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center bg-amber-500/10 border-t border-amber-500/20 opacity-0 group-hover/draft:opacity-100 transition-opacity"
                                                                title="Arrastra para cambiar duración"
                                                            >
                                                                <div className="w-6 h-0.5 rounded-full bg-amber-400/80" />
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Previsualización actual interactiva */}
                                                {(() => {
                                                    if (isEditMode) return null;
                                                    const style = getBlockStyle(form.startHour, form.endHour);
                                                    return (
                                                        <div
                                                            className="absolute left-0.5 right-0.5 rounded-xl border-l-4 border-emerald-500 bg-emerald-550/10 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-250 text-[9px] px-2.5 py-1.5 overflow-hidden select-none z-[16] shadow-xl shadow-emerald-950/20 ring-1 ring-emerald-500/30 cursor-grab active:cursor-grabbing group/ghost"
                                                            style={style}
                                                            onMouseDown={handleGhostDragStart}
                                                        >
                                                            <div className="flex justify-between items-start pointer-events-none">
                                                                <div className="font-black truncate flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                                                                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                                                                    </span>
                                                                    <span className="truncate">{tasks.find(t => t.id === form.taskId)?.title || 'Nuevo Registro'}</span>
                                                                </div>
                                                                <span className="text-[8px] font-black bg-emerald-500/20 px-1 py-0.2 rounded shrink-0 text-emerald-700 dark:text-emerald-300">
                                                                    {workedHours.toFixed(2)}h
                                                                </span>
                                                            </div>
                                                            <div className="text-[8px] text-emerald-650/90 dark:text-emerald-400/80 font-mono font-bold mt-1 pointer-events-none">
                                                                {form.startHour} - {form.endHour}
                                                            </div>

                                                            {/* Manilla para estirar (borde inferior) */}
                                                             <div 
                                                                 onMouseDown={handleGhostResizeStart}
                                                                 className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize flex items-center justify-center bg-emerald-500/20 border-t border-emerald-500/30 opacity-60 group-hover/ghost:opacity-100 transition-all duration-150"
                                                                 title="Arrastra para cambiar duración"
                                                             >
                                                                 <div className="flex gap-1 items-center justify-center pointer-events-none">
                                                                     <span className="w-1 h-1 rounded-full bg-emerald-400" />
                                                                     <span className="w-4 h-0.5 rounded-full bg-emerald-400" />
                                                                     <span className="w-1 h-1 rounded-full bg-emerald-400" />
                                                                 </div>
                                                             </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold text-slate-500 dark:text-slate-400 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || workedHours <= 0}
                        className={`flex-1 px-4 py-3 ${
                            isEditMode 
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                        } text-white rounded-xl font-bold active:scale-95 transition-all duration-200 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:shadow-none flex items-center justify-center gap-2`}
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Guardando...' : isEditMode ? 'Actualizar' : 'Registrar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
