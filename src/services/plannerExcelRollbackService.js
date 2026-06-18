import { supabase } from '../supabase';

/**
 * Realiza un fetch completo del estado actual del proyecto en Supabase y lo
 * guarda en el localStorage como una copia de seguridad temporal.
 *
 * @param {string} projectId - ID del proyecto.
 * @returns {Promise<boolean>} Retorna true si se creó el backup con éxito.
 */
export async function createProjectBackup(projectId) {
    if (!projectId) return false;
    
    try {
        console.log(`[RollbackService] Generando snapshot de respaldo para el proyecto ${projectId}...`);
        
        // 1. Fetch de Milestones
        const { data: milestones, error: mError } = await supabase
            .from('milestones')
            .select('*')
            .eq('project_id', projectId);
            
        if (mError) throw new Error(`Error al respaldar hitos: ${mError.message}`);
        
        // 2. Fetch de Tareas
        const { data: tasks, error: tError } = await supabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId);
            
        if (tError) throw new Error(`Error al respaldar tareas: ${tError.message}`);
        
        // 3. Fetch de Dependencias
        const { data: dependencies, error: dError } = await supabase
            .from('task_dependencies')
            .select('*')
            .eq('project_id', projectId);
            
        if (dError) throw new Error(`Error al respaldar dependencias: ${dError.message}`);
        
        const backup = {
            projectId,
            timestamp: Date.now(),
            milestones: milestones || [],
            tasks: tasks || [],
            dependencies: dependencies || []
        };
        
        localStorage.setItem(`planner_import_backup_${projectId}`, JSON.stringify(backup));
        console.log(`[RollbackService] Snapshot guardado con éxito. Hitos: ${backup.milestones.length}, Tareas: ${backup.tasks.length}, Dependencias: ${backup.dependencies.length}`);
        return true;
    } catch (err) {
        console.error('[RollbackService] Error al crear copia de seguridad de Gantt:', err);
        return false;
    }
}

/**
 * Restaura el estado de hitos, tareas y dependencias en Supabase a partir del snapshot.
 *
 * @param {string} projectId - ID del proyecto.
 * @returns {Promise<Object>} Resumen de registros restaurados.
 */
export async function rollbackProjectFromBackup(projectId) {
    if (!projectId) throw new Error('Se requiere el ID del proyecto para realizar la reversión.');
    
    const key = `planner_import_backup_${projectId}`;
    const backupRaw = localStorage.getItem(key);
    if (!backupRaw) {
        throw new Error('No se encontró ninguna copia de seguridad reciente para este proyecto.');
    }
    
    const backup = JSON.parse(backupRaw);
    console.log(`[RollbackService] Iniciando reversión para el proyecto ${projectId}.`);
    
    // 1. Eliminar dependencias actuales de Supabase
    const { error: delDepsErr } = await supabase
        .from('task_dependencies')
        .delete()
        .eq('project_id', projectId);
        
    if (delDepsErr) throw new Error(`Error al eliminar dependencias actuales: ${delDepsErr.message}`);
    
    // 2. Eliminar subtareas actuales
    // Fetch de las tareas que existen en Supabase para este proyecto para borrarlas
    const { data: currentTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', projectId);
        
    if (currentTasks && currentTasks.length > 0) {
        const currentTaskIds = currentTasks.map(t => t.id);
        const { error: delSubsErr } = await supabase
            .from('subtasks')
            .delete()
            .in('task_id', currentTaskIds);
            
        if (delSubsErr) {
            console.warn('[RollbackService] Error no crítico al eliminar subtareas actuales:', delSubsErr.message);
        }
    }
    
    // 3. Eliminar tareas actuales
    const { error: delTasksErr } = await supabase
        .from('tasks')
        .delete()
        .eq('project_id', projectId);
        
    if (delTasksErr) throw new Error(`Error al limpiar tareas del proyecto: ${delTasksErr.message}`);
    
    // 4. Eliminar hitos actuales
    const { error: delMilestonesErr } = await supabase
        .from('milestones')
        .delete()
        .eq('project_id', projectId);
        
    if (delMilestonesErr) throw new Error(`Error al limpiar hitos del proyecto: ${delMilestonesErr.message}`);
    
    // ==========================================
    // RESTAURACIÓN DE REGISTROS ORIGINALES
    // ==========================================
    
    // 5. Reinsertar Milestones
    if (backup.milestones.length > 0) {
        // Limpiamos campos autogenerados de Supabase para evitar conflictos de insert si postgres lo requiere,
        // pero mantenemos los UUIDs principales (id).
        const milestonesToRestore = backup.milestones.map(m => ({
            id: m.id,
            project_id: m.project_id,
            name: m.name,
            milestone_type: m.milestone_type || 'custom',
            description: m.description || '',
            status: m.status || 'planning',
            sort_order: m.sort_order,
            start_date: m.start_date,
            due_date: m.due_date,
            parent_milestone_id: m.parent_milestone_id || null,
            created_by: m.created_by,
            updated_by: m.updated_by,
            created_at: m.created_at,
            updated_at: m.updated_at
        }));
        
        const { error: insMError } = await supabase
            .from('milestones')
            .insert(milestonesToRestore);
            
        if (insMError) throw new Error(`Error al restaurar hitos: ${insMError.message}`);
    }
    
    // 6. Reinsertar Tareas
    if (backup.tasks.length > 0) {
        const tasksToRestore = backup.tasks.map(t => ({
            id: t.id,
            project_id: t.project_id,
            title: t.title,
            description: t.description || '',
            status: t.status || 'backlog',
            priority: t.priority || 'medium',
            assigned_to: t.assigned_to || null,
            estimated_hours: t.estimated_hours || null,
            planned_start_date: t.planned_start_date,
            planned_end_date: t.planned_end_date,
            percent_complete: t.percent_complete || 0,
            milestone_id: t.milestone_id || null,
            show_in_gantt: t.show_in_gantt ?? true,
            sort_order: t.sort_order,
            created_by: t.created_by,
            created_at: t.created_at,
            updated_at: t.updated_at
        }));
        
        const { error: insTError } = await supabase
            .from('tasks')
            .insert(tasksToRestore);
            
        if (insTError) throw new Error(`Error al restaurar tareas: ${insTError.message}`);
    }
    
    // 7. Reinsertar Dependencias
    if (backup.dependencies.length > 0) {
        const depsToRestore = backup.dependencies.map(d => ({
            project_id: d.project_id,
            predecessor_task_id: d.predecessor_task_id,
            successor_task_id: d.successor_task_id,
            type: d.type || 'FS',
            lag_hours: d.lag_hours || 0,
            created_by: d.created_by,
            created_at: d.created_at
        }));
        
        const { error: insDError } = await supabase
            .from('task_dependencies')
            .insert(depsToRestore);
            
        if (insDError) throw new Error(`Error al restaurar dependencias: ${insDError.message}`);
    }
    
    // Limpiamos el backup temporal
    localStorage.removeItem(key);
    console.log(`[RollbackService] Reversión completada con éxito. Proyecto restaurado.`);
    
    return {
        milestonesRestored: backup.milestones.length,
        tasksRestored: backup.tasks.length,
        dependenciesRestored: backup.dependencies.length
    };
}

/**
 * Comprueba si existe un backup activo y reciente para el proyecto seleccionado.
 *
 * @param {string} projectId - ID del proyecto.
 * @param {number} maxAgeMinutes - Edad máxima del backup en minutos (por defecto 60).
 * @returns {boolean} Retorna true si hay un backup listo para ser revertido.
 */
export function hasActiveProjectBackup(projectId, maxAgeMinutes = 60) {
    if (!projectId) return false;
    const key = `planner_import_backup_${projectId}`;
    const backupRaw = localStorage.getItem(key);
    if (!backupRaw) return false;
    
    try {
        const backup = JSON.parse(backupRaw);
        if (!backup.timestamp || backup.projectId !== projectId) return false;
        
        const ageMs = Date.now() - backup.timestamp;
        const maxAgeMs = maxAgeMinutes * 60 * 1000;
        return ageMs <= maxAgeMs;
    } catch {
        return false;
    }
}
