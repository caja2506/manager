/**
 * Timing Study Service — Supabase Implementation
 * ===============================================
 * CRUD operations for timing studies and timing steps in Supabase.
 * Maps camelCase internally to snake_case in PostgreSQL tables.
 */

import { supabase } from '../supabase';
import {
    createTimingStudyDocument,
    createTimingStepDocument,
    normalizeTimingStudy,
    normalizeTimingStep,
    calculateTimingStudyMetrics
} from '../modules/planning/domain/timingStudyModel';

// ── Mappers ──

export function mapTimingStudyFromSupabase(row) {
    if (!row) return null;
    let notes = row.notes || '';
    let customStandards = row.custom_standards || null;
    
    // Fallback: Si la columna custom_standards no existe/es null, extraer del final de notes
    if (!customStandards && notes.includes('---METADATA---')) {
        try {
            const parts = notes.split('---METADATA---');
            notes = parts[0].trim();
            customStandards = JSON.parse(parts[1].trim());
        } catch (e) {
            console.error('[mapTimingStudyFromSupabase] Error parsing customStandards from notes:', e);
        }
    }

    return {
        id: row.id,
        firestoreId: row.firestore_id,
        projectId: row.project_id,
        name: row.name,
        customer: row.customer,
        machineName: row.machine_name,
        stationName: row.station_name,
        targetPPM: row.target_ppm !== null ? Number(row.target_ppm) : 20,
        stationQty: row.station_qty !== null ? Number(row.station_qty) : 1,
        mainIndexEnabled: row.main_index_enabled,
        mainIndexTimeMs: row.main_index_time_ms !== null ? Number(row.main_index_time_ms) : 0,
        targetPiecesPerShift: row.target_pieces_per_shift !== null ? Number(row.target_pieces_per_shift) : 0,
        shiftHours: row.shift_hours !== null ? Number(row.shift_hours) : 8,
        nestCount: row.nest_count !== null ? Number(row.nest_count) : 1,
        positionsPerNest: row.positions_per_nest !== null ? Number(row.positions_per_nest) : 1,
        cycleOutputQty: row.cycle_output_qty !== null ? Number(row.cycle_output_qty) : 1,
        dwellTimeMs: row.dwell_time_ms !== null ? Number(row.dwell_time_ms) : 0,
        machineCycleTimeMs: row.machine_cycle_time_ms !== null ? Number(row.machine_cycle_time_ms) : 0,
        machineCycleTimeSec: row.machine_cycle_time_sec !== null ? Number(row.machine_cycle_time_sec) : 0,
        calculatedPPM: row.calculated_ppm !== null ? Number(row.calculated_ppm) : 0,
        bottleneckStationId: row.bottleneck_station_id,
        bottleneckStationLabel: row.bottleneck_station_label,
        status: row.status,
        notes: notes,
        active: row.active,
        customStandards: customStandards,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export function mapTimingStudyToSupabase(study) {
    if (!study) return null;
    const mapped = {};
    if (study.id !== undefined) mapped.id = study.id;
    if (study.firestoreId !== undefined) mapped.firestore_id = study.firestoreId;
    if (study.projectId !== undefined) mapped.project_id = study.projectId;
    if (study.name !== undefined) mapped.name = study.name;
    if (study.customer !== undefined) mapped.customer = study.customer;
    if (study.machineName !== undefined) mapped.machine_name = study.machineName;
    if (study.stationName !== undefined) mapped.station_name = study.stationName;
    if (study.targetPPM !== undefined) mapped.target_ppm = study.targetPPM;
    if (study.stationQty !== undefined) mapped.station_qty = study.stationQty;
    if (study.mainIndexEnabled !== undefined) mapped.main_index_enabled = study.mainIndexEnabled;
    if (study.mainIndexTimeMs !== undefined) mapped.main_index_time_ms = study.mainIndexTimeMs;
    if (study.nestCount !== undefined) mapped.nest_count = study.nestCount;
    if (study.positionsPerNest !== undefined) mapped.positions_per_nest = study.positionsPerNest;
    if (study.cycleOutputQty !== undefined) mapped.cycle_output_qty = study.cycleOutputQty;
    if (study.targetPiecesPerShift !== undefined) mapped.target_pieces_per_shift = study.targetPiecesPerShift;
    if (study.shiftHours !== undefined) mapped.shift_hours = study.shiftHours;
    if (study.dwellTimeMs !== undefined) mapped.dwell_time_ms = study.dwellTimeMs;
    if (study.machineCycleTimeMs !== undefined) mapped.machine_cycle_time_ms = study.machineCycleTimeMs;
    if (study.machineCycleTimeSec !== undefined) mapped.machine_cycle_time_sec = study.machineCycleTimeSec;
    if (study.calculatedPPM !== undefined) mapped.calculated_ppm = study.calculatedPPM;
    if (study.bottleneckStationId !== undefined) mapped.bottleneck_station_id = study.bottleneckStationId;
    if (study.bottleneckStationLabel !== undefined) mapped.bottleneck_station_label = study.bottleneckStationLabel;
    if (study.status !== undefined) mapped.status = study.status;
    if (study.notes !== undefined) mapped.notes = study.notes;
    if (study.active !== undefined) mapped.active = study.active;
    if (study.createdBy !== undefined) mapped.created_by = study.createdBy;
    if (study.updatedBy !== undefined) mapped.updated_by = study.updatedBy;
    
    // Serializar customStandards en la columna notes y OMITIR la columna custom_standards
    // para evitar el error PGRST204 de columna inexistente en la BD de producción.
    if (study.customStandards !== undefined) {
        const cleanNotes = study.notes !== undefined ? study.notes : '';
        mapped.notes = cleanNotes.trim() + '\n\n---METADATA---\n' + JSON.stringify(study.customStandards);
    }
    
    return mapped;
}

export function mapTimingStepFromSupabase(row) {
    if (!row) return null;
    return {
        id: row.id,
        firestoreId: row.firestore_id,
        timingStudyId: row.timing_study_id,
        projectId: row.project_id,
        stationId: row.station_id,
        stationLabel: row.station_label,
        deviceLetter: row.device_letter,
        deviceType: row.device_type,
        deviceAction: row.device_action,
        deviceQty: row.device_qty !== null ? Number(row.device_qty) : 1,
        sensorLetter: row.sensor_letter,
        sensorType: row.sensor_type,
        sensorQty: row.sensor_qty !== null ? Number(row.sensor_qty) : 0,
        linearDistanceMm: row.linear_distance_mm !== null ? Number(row.linear_distance_mm) : 0,
        angularDistanceDeg: row.angular_distance_deg !== null ? Number(row.angular_distance_deg) : 0,
        taskDescription: row.task_description,
        triggerCondition: row.trigger_condition,
        dependencyStepIds: row.dependency_step_ids || [],
        lagMs: row.lag_ms !== null ? Number(row.lag_ms) : 0,
        startTimeMs: row.start_time_ms !== null ? Number(row.start_time_ms) : 0,
        durationMs: row.duration_ms !== null ? Number(row.duration_ms) : 0,
        finishTimeMs: row.finish_time_ms !== null ? Number(row.finish_time_ms) : 0,
        sequenceGroup: row.sequence_group,
        canRunInParallel: row.can_run_in_parallel,
        waitsForMainIndex: row.waits_for_main_index,
        canRunDuringIndex: row.can_run_during_index,
        isCriticalPath: row.is_critical_path,
        isBottleneck: row.is_bottleneck,
        cylinderAttitude: row.cylinder_attitude,
        actuatorMotionType: row.actuator_motion_type,
        bore: row.bore,
        rodDia: row.rod_dia,
        cushion: row.cushion,
        portSizeStyle: row.port_size_style,
        valveType: row.valve_type,
        regulator: row.regulator,
        flowControls: row.flow_controls,
        checkValves: row.check_valves,
        quickExhaust: row.quick_exhaust,
        motionProfileId: row.motion_profile_id || '',
        notes: row.notes,
        sortOrder: row.sort_order !== null ? Number(row.sort_order) : 0,
        active: row.active,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export function mapTimingStepToSupabase(step) {
    if (!step) return null;
    const mapped = {};
    if (step.id !== undefined) mapped.id = step.id;
    if (step.firestoreId !== undefined) mapped.firestore_id = step.firestoreId;
    if (step.timingStudyId !== undefined) mapped.timing_study_id = step.timingStudyId;
    if (step.projectId !== undefined) mapped.project_id = step.projectId;
    if (step.stationId !== undefined) mapped.station_id = step.stationId;
    if (step.stationLabel !== undefined) mapped.station_label = step.stationLabel;
    if (step.deviceLetter !== undefined) mapped.device_letter = step.deviceLetter;
    if (step.deviceType !== undefined) mapped.device_type = step.deviceType;
    if (step.deviceAction !== undefined) mapped.device_action = step.deviceAction;
    if (step.deviceQty !== undefined) mapped.device_qty = step.deviceQty;
    if (step.sensorLetter !== undefined) mapped.sensor_letter = step.sensorLetter;
    if (step.sensorType !== undefined) mapped.sensor_type = step.sensorType;
    if (step.sensorQty !== undefined) mapped.sensor_qty = step.sensorQty;
    if (step.linearDistanceMm !== undefined) mapped.linear_distance_mm = step.linearDistanceMm;
    if (step.angularDistanceDeg !== undefined) mapped.angular_distance_deg = step.angularDistanceDeg;
    if (step.taskDescription !== undefined) mapped.task_description = step.taskDescription;
    if (step.triggerCondition !== undefined) mapped.trigger_condition = step.triggerCondition;
    if (step.dependencyStepIds !== undefined) mapped.dependency_step_ids = step.dependencyStepIds;
    if (step.lagMs !== undefined) mapped.lag_ms = step.lagMs;
    if (step.startTimeMs !== undefined) mapped.start_time_ms = step.startTimeMs;
    if (step.durationMs !== undefined) mapped.duration_ms = step.durationMs;
    if (step.finishTimeMs !== undefined) mapped.finish_time_ms = step.finishTimeMs;
    if (step.sequenceGroup !== undefined) mapped.sequence_group = step.sequenceGroup;
    if (step.canRunInParallel !== undefined) mapped.can_run_in_parallel = step.canRunInParallel;
    if (step.waitsForMainIndex !== undefined) mapped.waits_for_main_index = step.waitsForMainIndex;
    if (step.canRunDuringIndex !== undefined) mapped.can_run_during_index = step.canRunDuringIndex;
    if (step.isCriticalPath !== undefined) mapped.is_critical_path = step.isCriticalPath;
    if (step.isBottleneck !== undefined) mapped.is_bottleneck = step.isBottleneck;
    if (step.cylinderAttitude !== undefined) mapped.cylinder_attitude = step.cylinderAttitude;
    if (step.actuatorMotionType !== undefined) mapped.actuator_motion_type = step.actuatorMotionType;
    if (step.bore !== undefined) mapped.bore = step.bore;
    if (step.rodDia !== undefined) mapped.rod_dia = step.rodDia;
    if (step.cushion !== undefined) mapped.cushion = step.cushion;
    if (step.portSizeStyle !== undefined) mapped.port_size_style = step.portSizeStyle;
    if (step.valveType !== undefined) mapped.valve_type = step.valveType;
    if (step.regulator !== undefined) mapped.regulator = step.regulator;
    if (step.flowControls !== undefined) mapped.flow_controls = step.flowControls;
    if (step.checkValves !== undefined) mapped.check_valves = step.checkValves;
    if (step.quickExhaust !== undefined) mapped.quick_exhaust = step.quickExhaust;
    if (step.motionProfileId !== undefined) mapped.motion_profile_id = step.motionProfileId || null;
    if (step.notes !== undefined) mapped.notes = step.notes;
    if (step.sortOrder !== undefined) mapped.sort_order = step.sortOrder;
    if (step.active !== undefined) mapped.active = step.active;
    if (step.createdBy !== undefined) mapped.created_by = step.createdBy;
    if (step.updatedBy !== undefined) mapped.updated_by = step.updatedBy;
    return mapped;
}

// ── Validation Helper ──

async function validateAndFormatStationLabelSupabase(projectId, stationId) {
    if (!stationId) return '';
    const { data: stations, error } = await supabase
        .from('project_stations')
        .select('*')
        .eq('project_id', projectId);
        
    if (error) throw new Error(`[timingStudyService.sb] Error al verificar estación: ${error.message}`);
    const station = (stations || []).find(s => s.id === stationId);
    if (!station) {
        throw new Error(`La estación con ID ${stationId} no pertenece al proyecto.`);
    }
    
    const indexers = new Set((stations || []).map(s => s.indx || 1));
    const multiIdx = indexers.size > 1;
    const stnNum = String(station.stn || '').padStart(2, '0');
    return multiIdx
        ? `${station.indx || 1}-STN${stnNum}`
        : `STN${stnNum}`;
}

// ── CRUD Timing Studies ──

export async function getTimingStudiesByProject(projectId) {
    if (!projectId) throw new Error('projectId es requerido.');
    const { data, error } = await supabase
        .from('timing_studies')
        .select('*')
        .eq('project_id', projectId)
        .eq('active', true)
        .order('created_at', { ascending: false });
        
    if (error) throw new Error(`[timingStudyService.sb] getStudies: ${error.message}`);
    return (data || []).map(mapTimingStudyFromSupabase);
}

export function onProjectTimingStudies(projectId, callback) {
    if (!projectId) {
        callback([]);
        return () => {};
    }
    
    // Fetch immediately
    getTimingStudiesByProject(projectId)
        .then(callback)
        .catch(err => {
            console.error('[timingStudyService.sb] onProjectTimingStudies error:', err.message);
            callback([]);
        });
        
    const channel = supabase
        .channel(`project-timing-studies-${projectId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'timing_studies',
            filter: `project_id=eq.${projectId}`
        }, () => {
            getTimingStudiesByProject(projectId)
                .then(callback)
                .catch(err => console.error('[timingStudyService.sb] onProjectTimingStudies reload error:', err.message));
        })
        .subscribe();
        
    return () => {
        supabase.removeChannel(channel);
    };
}

export async function getTimingStudy(projectId, timingStudyId) {
    if (!projectId) throw new Error('projectId es requerido.');
    if (!timingStudyId) throw new Error('timingStudyId es requerido.');
    
    const { data, error } = await supabase
        .from('timing_studies')
        .select('*')
        .eq('id', timingStudyId)
        .eq('active', true)
        .single();
        
    if (error) {
        console.warn(`[timingStudyService.sb] getStudy error or not found: ${error.message}`);
        return null;
    }
    return mapTimingStudyFromSupabase(data);
}

export async function createTimingStudy(projectId, data, userId = null) {
    if (!projectId) throw new Error('projectId es requerido.');
    
    const studyDoc = createTimingStudyDocument({
        ...data,
        projectId,
        createdBy: userId
    });
    
    if (studyDoc.targetPPM <= 0) {
        throw new Error('targetPPM debe ser mayor a 0.');
    }
    
    const row = mapTimingStudyToSupabase(studyDoc);
    const { data: inserted, error } = await supabase
        .from('timing_studies')
        .insert(row)
        .select('id')
        .single();
        
    if (error) throw new Error(`[timingStudyService.sb] createStudy: ${error.message}`);
    return inserted.id;
}

export async function updateTimingStudy(projectId, timingStudyId, updates, userId = null) {
    if (!projectId) throw new Error('projectId es requerido.');
    if (!timingStudyId) throw new Error('timingStudyId es requerido.');
    
    if (updates.targetPPM !== undefined && updates.targetPPM <= 0) {
        throw new Error('targetPPM debe ser mayor a 0.');
    }
    
    const mappedUpdates = mapTimingStudyToSupabase(updates);
    mappedUpdates.updated_by = userId;
    mappedUpdates.updated_at = new Date().toISOString();
    
    const { error } = await supabase
        .from('timing_studies')
        .update(mappedUpdates)
        .eq('id', timingStudyId);
        
    if (error) throw new Error(`[timingStudyService.sb] updateStudy: ${error.message}`);
}

export async function deleteTimingStudy(projectId, timingStudyId, userId = null) {
    // Soft delete
    await updateTimingStudy(projectId, timingStudyId, { active: false }, userId);
}

// ── CRUD Timing Steps ──

export async function getTimingStudySteps(projectId, timingStudyId) {
    if (!projectId) throw new Error('projectId es requerido.');
    if (!timingStudyId) throw new Error('timingStudyId es requerido.');
    
    const { data, error } = await supabase
        .from('timing_steps')
        .select('*')
        .eq('timing_study_id', timingStudyId)
        .eq('active', true)
        .order('sort_order', { ascending: true });
        
    if (error) throw new Error(`[timingStudyService.sb] getSteps: ${error.message}`);
    return (data || []).map(mapTimingStepFromSupabase);
}

export function onTimingStudySteps(projectId, timingStudyId, callback) {
    if (!projectId || !timingStudyId) {
        callback([]);
        return () => {};
    }
    
    // Fetch immediately
    getTimingStudySteps(projectId, timingStudyId)
        .then(callback)
        .catch(err => {
            console.error('[timingStudyService.sb] onTimingStudySteps error:', err.message);
            callback([]);
        });
        
    const channel = supabase
        .channel(`study-steps-${timingStudyId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'timing_steps',
            filter: `timing_study_id=eq.${timingStudyId}`
        }, () => {
            getTimingStudySteps(projectId, timingStudyId)
                .then(callback)
                .catch(err => console.error('[timingStudyService.sb] onTimingStudySteps reload error:', err.message));
        })
        .subscribe();
        
    return () => {
        supabase.removeChannel(channel);
    };
}

export async function addTimingStep(projectId, timingStudyId, stepData, userId = null) {
    if (!projectId) throw new Error('projectId es requerido.');
    if (!timingStudyId) throw new Error('timingStudyId es requerido.');
    
    const stepDoc = createTimingStepDocument({
        ...stepData,
        projectId,
        timingStudyId,
        createdBy: userId
    });
    
    if (stepDoc.durationMs < 0) throw new Error('durationMs no puede ser negativo.');
    if (stepDoc.linearDistanceMm < 0) throw new Error('linearDistanceMm no puede ser negativo.');
    if (stepDoc.angularDistanceDeg < 0) throw new Error('angularDistanceDeg no puede ser negativo.');
    
    if (stepDoc.stationId) {
        stepDoc.stationLabel = await validateAndFormatStationLabelSupabase(projectId, stepDoc.stationId);
    }
    
    const row = mapTimingStepToSupabase(stepDoc);
    const { data: inserted, error } = await supabase
        .from('timing_steps')
        .insert(row)
        .select('id')
        .single();
        
    if (error) throw new Error(`[timingStudyService.sb] addStep: ${error.message}`);
    return inserted.id;
}

export async function updateTimingStep(projectId, timingStudyId, stepId, updates, userId = null) {
    if (!projectId) throw new Error('projectId es requerido.');
    if (!timingStudyId) throw new Error('timingStudyId es requerido.');
    if (!stepId) throw new Error('stepId es requerido.');
    
    if (updates.durationMs !== undefined && updates.durationMs < 0) {
        throw new Error('durationMs no puede ser negativo.');
    }
    if (updates.linearDistanceMm !== undefined && updates.linearDistanceMm < 0) {
        throw new Error('linearDistanceMm no puede ser negativo.');
    }
    if (updates.angularDistanceDeg !== undefined && updates.angularDistanceDeg < 0) {
        throw new Error('angularDistanceDeg no puede ser negativo.');
    }
    if (updates.dependencyStepIds !== undefined && updates.dependencyStepIds.includes(stepId)) {
        throw new Error('Un paso no puede depender de sí mismo.');
    }
    
    if (updates.stationId) {
        updates.stationLabel = await validateAndFormatStationLabelSupabase(projectId, updates.stationId);
    }
    
    const mappedUpdates = mapTimingStepToSupabase(updates);
    mappedUpdates.updated_by = userId;
    mappedUpdates.updated_at = new Date().toISOString();
    
    const { error } = await supabase
        .from('timing_steps')
        .update(mappedUpdates)
        .eq('id', stepId);
        
    if (error) throw new Error(`[timingStudyService.sb] updateStep: ${error.message}`);
}

export async function deleteTimingStep(projectId, timingStudyId, stepId, userId = null) {
    // Soft delete
    await updateTimingStep(projectId, timingStudyId, stepId, { active: false }, userId);
}

export async function bulkCreateTimingSteps(projectId, timingStudyId, steps, userId = null) {
    if (!projectId) throw new Error('projectId es requerido.');
    if (!timingStudyId) throw new Error('timingStudyId es requerido.');
    if (!Array.isArray(steps)) throw new Error('steps debe ser un arreglo.');
    
    // Fetch project stations to validate and format
    const { data: stations, error: stationsErr } = await supabase
        .from('project_stations')
        .select('*')
        .eq('project_id', projectId);
        
    if (stationsErr) throw new Error(`Error fetching stations: ${stationsErr.message}`);
    
    const indexers = new Set((stations || []).map(s => s.indx || 1));
    const multiIdx = indexers.size > 1;
    
    const rows = steps.map(stepData => {
        const stepDoc = createTimingStepDocument({
            ...stepData,
            projectId,
            timingStudyId,
            createdBy: userId
        });
        
        if (stepDoc.stationId) {
            const station = (stations || []).find(s => s.id === stepDoc.stationId);
            if (!station) {
                throw new Error(`La estación con ID ${stepDoc.stationId} no pertenece al proyecto.`);
            }
            const stnNum = String(station.stn || '').padStart(2, '0');
            stepDoc.stationLabel = multiIdx ? `${station.indx || 1}-STN${stnNum}` : `STN${stnNum}`;
        }
        
        return mapTimingStepToSupabase(stepDoc);
    });
    
    if (rows.length > 0) {
        const { error } = await supabase
            .from('timing_steps')
            .insert(rows);
            
        if (error) throw new Error(`[timingStudyService.sb] bulkCreateSteps: ${error.message}`);
    }
}

// ── Recalculate Timing Study ──

export async function recalculateTimingStudy(projectId, timingStudyId, userId = null) {
    if (!projectId) throw new Error('projectId es requerido.');
    if (!timingStudyId) throw new Error('timingStudyId es requerido.');
    
    // 1. Fetch study
    const { data: studyRow, error: studyErr } = await supabase
        .from('timing_studies')
        .select('*')
        .eq('id', timingStudyId)
        .single();
        
    if (studyErr || !studyRow) throw new Error('El estudio de tiempos no existe.');
    const study = mapTimingStudyFromSupabase(studyRow);
    
    // 2. Fetch steps
    const { data: stepRows, error: stepsErr } = await supabase
        .from('timing_steps')
        .select('*')
        .eq('timing_study_id', timingStudyId);
        
    if (stepsErr) throw new Error(`Error fetching steps: ${stepsErr.message}`);
    const steps = (stepRows || []).map(mapTimingStepFromSupabase);
    
    // Fetch project stations
    const { data: stationRows, error: stationsErr } = await supabase
        .from('project_stations')
        .select('*')
        .eq('project_id', projectId);
        
    if (stationsErr) throw new Error(`Error fetching stations: ${stationsErr.message}`);
    
    // 3. Recalculate
    const metrics = calculateTimingStudyMetrics(study, steps, stationRows || []);
    
    // 4. Update study in database
    const studyUpdates = mapTimingStudyToSupabase({
        dwellTimeMs: metrics.dwellTimeMs,
        machineCycleTimeMs: metrics.machineCycleTimeMs,
        machineCycleTimeSec: metrics.machineCycleTimeSec,
        calculatedPPM: metrics.calculatedPPM,
        bottleneckStationId: metrics.bottleneckStationId,
        bottleneckStationLabel: metrics.bottleneckStationLabel,
        status: metrics.status,
        updatedBy: userId
    });
    studyUpdates.updated_at = new Date().toISOString();
    
    const { error: updateStudyErr } = await supabase
        .from('timing_studies')
        .update(studyUpdates)
        .eq('id', timingStudyId);
        
    if (updateStudyErr) throw new Error(`Error updating study: ${updateStudyErr.message}`);
    
    // 5. Update steps in database
    const stepsToUpsert = metrics.steps.map(step => {
        const mapped = mapTimingStepToSupabase(step);
        mapped.updated_by = userId;
        mapped.updated_at = new Date().toISOString();
        return mapped;
    });
    
    if (stepsToUpsert.length > 0) {
        const { error: upsertStepsErr } = await supabase
            .from('timing_steps')
            .upsert(stepsToUpsert);
            
        if (upsertStepsErr) throw new Error(`Error updating steps: ${upsertStepsErr.message}`);
    }
    
    return metrics;
}

export async function getGlobalMotionStandards() {
    const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'global_motion_standards')
        .maybeSingle();
    if (error) {
        console.error('[timingStudyService.sb] error fetching global_motion_standards:', error.message);
        return null;
    }
    return data ? data.value : null;
}

export async function updateGlobalMotionStandards(config) {
    const { error } = await supabase
        .from('settings')
        .upsert({
            key: 'global_motion_standards',
            value: config,
            description: 'Estándares globales de tiempos de movimientos y clasificadores para estudios de tiempos',
            category: 'timing_standards',
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
    if (error) throw new Error(`[timingStudyService.sb] updateGlobalMotionStandards: ${error.message}`);
}

// ── Actuator Groups (Grupos de Actuadores) ──

export async function getActuatorGroups() {
    const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'actuator_groups')
        .maybeSingle();
    if (error) {
        console.error('[timingStudyService.sb] getActuatorGroups:', error.message);
        return null;
    }
    return data ? data.value : null;
}

export async function updateActuatorGroups(config) {
    const { error } = await supabase
        .from('settings')
        .upsert({
            key: 'actuator_groups',
            value: config,
            description: 'Grupos de actuadores con subtipos, acciones y perfiles de velocidad',
            category: 'actuator_config',
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
    if (error) throw new Error(`[timingStudyService.sb] updateActuatorGroups: ${error.message}`);
}
