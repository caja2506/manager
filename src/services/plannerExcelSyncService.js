import { supabase } from '../supabase';

/**
 * Persiste hitos (milestones), tareas y subtareas en orden jerárquico y recrea dependencias en Supabase.
 *
 * @param {string} projectId - ID del proyecto en Supabase.
 * @param {Object} parsedData - Datos jerárquicos de plannerExcelParser.
 * @param {string} userId - ID del usuario actual para auditoría.
 */
export async function syncPlannerExcelToSupabase(projectId, parsedData, userId) {
    if (!projectId) throw new Error('Se requiere el ID del proyecto para sincronizar.');
    if (!parsedData) throw new Error('No se proporcionaron datos para sincronizar.');

    const {
        milestonesToCreate,
        milestonesToUpdate,
        tasksToCreate,
        tasksToUpdate,
        subtasksToCreate,
        rawMilestones,
        rawTasks
    } = parsedData;

    // Mapas para asociar Outline Numbers a UUIDs de Supabase
    const outlineToMilestoneUuidMap = new Map();
    const outlineToTaskUuidMap = new Map();
    const taskNumberToUuidMap = new Map(); // Mapeo plano de número de Excel a UUID de Supabase

    // ============================================================
    // 0. ACTUALIZAR FECHAS DEL PROYECTO
    // ============================================================
    if (parsedData.projectStartDate || parsedData.projectFinishDate) {
        const projectUpdates = {
            updated_at: new Date().toISOString()
        };
        if (parsedData.projectStartDate) {
            projectUpdates.start_date = parsedData.projectStartDate;
        }
        if (parsedData.projectFinishDate) {
            projectUpdates.due_date = parsedData.projectFinishDate;
        }
        
        const { error: projUpdErr } = await supabase
            .from('projects')
            .update(projectUpdates)
            .eq('id', projectId);

        if (projUpdErr) {
            console.warn('[PlannerSync] Error al actualizar fechas del proyecto:', projUpdErr.message);
        } else {
            console.log(`[PlannerSync] Fechas del proyecto actualizadas: Start=${parsedData.projectStartDate}, End=${parsedData.projectFinishDate}`);
        }
    }

    // ============================================================
    // 1. PROCESAR MILESTONES (NIVEL 1)
    // ============================================================

    // A. Actualizar Milestones existentes
    if (milestonesToUpdate.length > 0) {
        for (const m of milestonesToUpdate) {
            await supabase
                .from('milestones')
                .update({
                    start_date: m.plannedStartDate || null,
                    due_date: m.plannedEndDate || null,
                    sort_order: m.taskNumber,
                    updated_by: userId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', m.id);

            outlineToMilestoneUuidMap.set(m.outlineNumber, m.id);
        }
    }

    // B. Crear Milestones nuevos
    if (milestonesToCreate.length > 0) {
        const milestoneRows = milestonesToCreate.map(m => ({
            project_id: projectId,
            name: m.name,
            milestone_type: 'custom',
            description: m.notes || '',
            status: m.percentComplete >= 1.0 ? 'completed' : m.percentComplete > 0 ? 'active' : 'planning',
            sort_order: m.taskNumber,
            start_date: m.plannedStartDate || null,
            due_date: m.plannedEndDate || null,
            created_by: userId,
            updated_by: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }));

        const { data: createdMilestones, error: mError } = await supabase
            .from('milestones')
            .insert(milestoneRows)
            .select('id, name');

        if (mError) throw new Error(`Error creando milestones: ${mError.message}`);

        if (createdMilestones && createdMilestones.length > 0) {
            const createdByName = new Map();
            createdMilestones.forEach(cm => {
                createdByName.set(normalizeKey(cm.name), cm.id);
            });

            milestonesToCreate.forEach(m => {
                const uuid = createdByName.get(normalizeKey(m.name));
                if (uuid) {
                    outlineToMilestoneUuidMap.set(m.outlineNumber, uuid);
                }
            });
        }
    }

    // C. Mapear cualquier milestone del proyecto en Supabase que no estuviera en los arrays pero sí en el Excel
    const { data: dbMilestones } = await supabase
        .from('milestones')
        .select('id, name')
        .eq('project_id', projectId);

    if (dbMilestones && dbMilestones.length > 0) {
        const dbMilestonesByName = new Map();
        dbMilestones.forEach(dm => {
            dbMilestonesByName.set(normalizeKey(dm.name), dm.id);
        });

        rawMilestones.forEach(m => {
            if (!outlineToMilestoneUuidMap.has(m.outlineNumber)) {
                const uuid = dbMilestonesByName.get(normalizeKey(m.name));
                if (uuid) {
                    outlineToMilestoneUuidMap.set(m.outlineNumber, uuid);
                }
            }
        });
    }

    // ============================================================
    // 2. PROCESAR TAREAS (NIVEL 2)
    // ============================================================

    // A. Actualizar Tareas existentes
    if (tasksToUpdate.length > 0) {
        for (const t of tasksToUpdate) {
            const milestoneId = outlineToMilestoneUuidMap.get(t.parentOutlineNumber) || null;
            
            const updates = {
                planned_start_date: t.plannedStartDate || null,
                planned_end_date: t.plannedEndDate || null,
                estimated_hours: t.estimatedHours || null,
                description: t.notes || '',
                priority: t.priority || 'medium',
                milestone_id: milestoneId,
                show_in_gantt: true,
                sort_order: t.taskNumber,
                updated_at: new Date().toISOString()
            };

            if (t.assignedUserId) {
                updates.assigned_to = t.assignedUserId;
            }

            const { error: tUpdErr } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', t.id);

            if (tUpdErr) {
                console.warn(`[PlannerSync] Error al actualizar la tarea "${t.name}" (${t.id}):`, tUpdErr.message);
            }

            outlineToTaskUuidMap.set(t.outlineNumber, t.id);
            taskNumberToUuidMap.set(t.taskNumber, t.id);
        }
    }

    // B. Crear Tareas nuevas
    if (tasksToCreate.length > 0) {
        const taskRows = tasksToCreate.map(t => {
            let initialStatus = 'pending';
            if (t.percentComplete >= 1.0) {
                initialStatus = 'completed';
            }

            const milestoneId = outlineToMilestoneUuidMap.get(t.parentOutlineNumber) || null;

            return {
                project_id: projectId,
                title: t.name,
                description: t.notes || '',
                status: initialStatus,
                priority: t.priority || 'medium',
                assigned_to: t.assignedUserId || null,
                estimated_hours: t.estimatedHours || null,
                planned_start_date: t.plannedStartDate || null,
                planned_end_date: t.plannedEndDate || null,
                percent_complete: Math.round((t.percentComplete || 0) * 100),
                milestone_id: milestoneId,
                show_in_gantt: true,
                sort_order: t.taskNumber,
                created_by: userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        });

        const { data: createdTasks, error: tInsErr } = await supabase
            .from('tasks')
            .insert(taskRows)
            .select('id, title');

        if (tInsErr) throw new Error(`Error insertando tareas nuevas: ${tInsErr.message}`);

        if (createdTasks && createdTasks.length > 0) {
            const createdByName = new Map();
            createdTasks.forEach(ct => {
                createdByName.set(normalizeKey(ct.title), ct.id);
            });

            tasksToCreate.forEach(t => {
                const uuid = createdByName.get(normalizeKey(t.name));
                if (uuid) {
                    outlineToTaskUuidMap.set(t.outlineNumber, uuid);
                    taskNumberToUuidMap.set(t.taskNumber, uuid);
                }
            });
        }
    }

    // C. Mapear cualquier tarea del proyecto en Supabase que no estuviera en los arrays pero sí en el Excel
    const { data: dbTasks } = await supabase
        .from('tasks')
        .select('id, title')
        .eq('project_id', projectId);

    if (dbTasks && dbTasks.length > 0) {
        const dbTasksByName = new Map();
        dbTasks.forEach(dt => {
            dbTasksByName.set(normalizeKey(dt.title), dt.id);
        });

        rawTasks.forEach(t => {
            if (!outlineToTaskUuidMap.has(t.outlineNumber)) {
                const uuid = dbTasksByName.get(normalizeKey(t.name));
                if (uuid) {
                    outlineToTaskUuidMap.set(t.outlineNumber, uuid);
                    taskNumberToUuidMap.set(t.taskNumber, uuid);
                }
            }
        });
    }

    // ============================================================
    // 3. PROCESAR SUBTAREAS (NIVEL 3+)
    // ============================================================
    if (subtasksToCreate.length > 0) {
        // Cargar subtareas existentes en las tareas de este proyecto para evitar duplicación
        const taskIds = Array.from(outlineToTaskUuidMap.values());
        let dbSubtasks = [];
        
        if (taskIds.length > 0) {
            const { data: subData } = await supabase
                .from('subtasks')
                .select('id, task_id, title')
                .in('task_id', taskIds);
            dbSubtasks = subData || [];
        }

        const existingSubtasksMap = new Set();
        dbSubtasks.forEach(s => {
            existingSubtasksMap.add(`${s.task_id}_${normalizeKey(s.title)}`);
        });

        const subtaskRows = [];
        subtasksToCreate.forEach(st => {
            const parentTaskUuid = outlineToTaskUuidMap.get(st.parentOutlineNumber);
            if (!parentTaskUuid) {
                console.warn(`[PlannerSync] No se encontró la tarea padre "${st.parentOutlineNumber}" para la subtarea "${st.name}"`);
                return;
            }

            const key = `${parentTaskUuid}_${normalizeKey(st.name)}`;
            if (existingSubtasksMap.has(key)) {
                // Ya existe, omitir para no duplicar
                return;
            }

            subtaskRows.push({
                task_id: parentTaskUuid,
                title: st.name,
                completed: st.percentComplete >= 1.0,
                completed_at: st.percentComplete >= 1.0 ? new Date().toISOString() : null,
                sort_order: st.taskNumber
            });
        });

        if (subtaskRows.length > 0) {
            const { error: subErr } = await supabase
                .from('subtasks')
                .insert(subtaskRows);

            if (subErr) {
                console.warn('[PlannerSync] Error al insertar subtareas:', subErr.message);
            } else {
                console.log(`[PlannerSync] Insertadas ${subtaskRows.length} subtareas nuevas.`);
            }
        }
    }

    // ============================================================
    // 4. ELIMINAR DEPENDENCIAS EXISTENTES Y CREAR LAS NUEVAS
    // ============================================================
    const dependenciesToInsert = [];
    rawTasks.forEach(excelTask => {
        const successorUuid = taskNumberToUuidMap.get(excelTask.taskNumber);
        if (!successorUuid) return;

        excelTask.dependencies.forEach(dep => {
            const predecessorUuid = taskNumberToUuidMap.get(dep.predecessorTaskNumber);
            if (!predecessorUuid) {
                console.warn(`[PlannerSync] No se encontró el UUID para la tarea predecesora #${dep.predecessorTaskNumber} en el Excel.`);
                return;
            }

            dependenciesToInsert.push({
                project_id: projectId,
                predecessor_task_id: predecessorUuid,
                successor_task_id: successorUuid,
                type: dep.type || 'FS',
                lag_hours: dep.lagHours || 0,
                created_by: userId || null,
                created_at: new Date().toISOString()
            });
        });
    });

    // Eliminar todas las dependencias anteriores del proyecto
    const { error: deleteDepsError } = await supabase
        .from('task_dependencies')
        .delete()
        .eq('project_id', projectId);

    if (deleteDepsError) {
        throw new Error(`Error eliminando dependencias antiguas de Gantt: ${deleteDepsError.message}`);
    }

    // Insertar las nuevas dependencias en lote
    if (dependenciesToInsert.length > 0) {
        const { error: insertDepsError } = await supabase
            .from('task_dependencies')
            .insert(dependenciesToInsert);

        if (insertDepsError) {
            throw new Error(`Error insertando nuevas dependencias de Gantt: ${insertDepsError.message}`);
        }
    }

    return {
        milestonesCreated: milestonesToCreate.length,
        tasksCreated: tasksToCreate.length,
        tasksUpdated: tasksToUpdate.length,
        dependenciesCreated: dependenciesToInsert.length,
        subtasksCreated: subtasksToCreate.length
    };
}

function normalizeKey(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
}
