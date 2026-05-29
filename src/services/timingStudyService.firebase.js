/**
 * Timing Study Service — Firebase Implementation
 * ===============================================
 * CRUD operations for timing studies and timing steps in Firestore.
 * 
 * Path:
 *   - projects/{projectId}/timingStudies/{studyId}
 *   - projects/{projectId}/timingStudies/{studyId}/steps/{stepId}
 */

import { db } from '../firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    orderBy,
    onSnapshot,
    writeBatch
} from 'firebase/firestore';
import { COLLECTIONS } from '../models/schemas';
import {
    createTimingStudyDocument,
    createTimingStepDocument,
    normalizeTimingStudy,
    normalizeTimingStep,
    calculateTimingStudyMetrics
} from '../modules/planning/domain/timingStudyModel';

// ── Helpers ──

function studiesRef(projectId) {
    return collection(db, COLLECTIONS.PROJECTS, projectId, COLLECTIONS.TIMING_STUDIES);
}

function stepsRef(projectId, studyId) {
    return collection(db, COLLECTIONS.PROJECTS, projectId, COLLECTIONS.TIMING_STUDIES, studyId, COLLECTIONS.TIMING_STEPS);
}

/**
 * Validate that a station belongs to the given project and format its label.
 */
async function validateAndFormatStationLabel(projectId, stationId) {
    if (!stationId) return '';
    const stationsCol = collection(db, COLLECTIONS.PROJECTS, projectId, COLLECTIONS.PROJECT_STATIONS);
    const snap = await getDocs(stationsCol);
    const stations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const station = stations.find(s => s.id === stationId);
    if (!station) {
        throw new Error(`La estación con ID ${stationId} no pertenece a este proyecto.`);
    }
    const indexers = new Set(stations.map(s => s.indx || 1));
    const multiIdx = indexers.size > 1;
    const stnNum = String(station.stn || '').padStart(2, '0');
    return multiIdx ? `${station.indx || 1}-STN${stnNum}` : `STN${stnNum}`;
}

// ── CRUD Timing Studies ──

export async function getTimingStudiesByProject(projectId) {
    if (!projectId) throw new Error('projectId es requerido.');
    const snap = await getDocs(studiesRef(projectId));
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.active !== false);
}

export function onProjectTimingStudies(projectId, callback) {
    if (!projectId) {
        callback([]);
        return () => {};
    }
    const q = studiesRef(projectId);
    return onSnapshot(q, snap => {
        const studies = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(s => s.active !== false);
        callback(studies);
    }, err => {
        console.error('[timingStudyService.fb] error in onProjectTimingStudies:', err);
        callback([]);
    });
}

export async function getTimingStudy(projectId, timingStudyId) {
    if (!projectId) throw new Error('projectId es requerido.');
    if (!timingStudyId) throw new Error('timingStudyId es requerido.');
    const ref = doc(db, COLLECTIONS.PROJECTS, projectId, COLLECTIONS.TIMING_STUDIES, timingStudyId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.active === false) return null;
    return { id: snap.id, ...data };
}

export async function createTimingStudy(projectId, data, userId = null) {
    if (!projectId) throw new Error('projectId es requerido.');
    
    // Normalize using model factory
    const studyDoc = createTimingStudyDocument({
        ...data,
        projectId,
        createdBy: userId
    });
    
    // Check constraints
    if (studyDoc.targetPPM <= 0) {
        throw new Error('targetPPM debe ser mayor a 0.');
    }
    
    const docRef = doc(studiesRef(projectId));
    await setDoc(docRef, studyDoc);
    return docRef.id;
}

export async function updateTimingStudy(projectId, timingStudyId, updates, userId = null) {
    if (!projectId) throw new Error('projectId es requerido.');
    if (!timingStudyId) throw new Error('timingStudyId es requerido.');
    
    const ref = doc(db, COLLECTIONS.PROJECTS, projectId, COLLECTIONS.TIMING_STUDIES, timingStudyId);
    
    const cleanUpdates = {
        ...updates,
        updatedBy: userId,
        updatedAt: new Date().toISOString()
    };
    
    if (cleanUpdates.targetPPM !== undefined && cleanUpdates.targetPPM <= 0) {
        throw new Error('targetPPM debe ser mayor a 0.');
    }
    
    await updateDoc(ref, cleanUpdates);
}

export async function deleteTimingStudy(projectId, timingStudyId, userId = null) {
    // Soft delete matching active=false rule
    await updateTimingStudy(projectId, timingStudyId, { active: false }, userId);
}

// ── CRUD Timing Steps ──

export async function getTimingStudySteps(projectId, timingStudyId) {
    if (!projectId) throw new Error('projectId es requerido.');
    if (!timingStudyId) throw new Error('timingStudyId es requerido.');
    
    const snap = await getDocs(query(stepsRef(projectId, timingStudyId), orderBy('sortOrder')));
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.active !== false);
}

export function onTimingStudySteps(projectId, timingStudyId, callback) {
    if (!projectId || !timingStudyId) {
        callback([]);
        return () => {};
    }
    const q = query(stepsRef(projectId, timingStudyId), orderBy('sortOrder'));
    return onSnapshot(q, snap => {
        const steps = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(s => s.active !== false);
        callback(steps);
    }, err => {
        console.error('[timingStudyService.fb] error in onTimingStudySteps:', err);
        callback([]);
    });
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
    
    // Validations
    if (stepDoc.durationMs < 0) throw new Error('durationMs no puede ser negativo.');
    if (stepDoc.linearDistanceMm < 0) throw new Error('linearDistanceMm no puede ser negativo.');
    if (stepDoc.angularDistanceDeg < 0) throw new Error('angularDistanceDeg no puede ser negativo.');
    
    if (stepDoc.stationId) {
        stepDoc.stationLabel = await validateAndFormatStationLabel(projectId, stepDoc.stationId);
    }
    
    const docRef = doc(stepsRef(projectId, timingStudyId));
    stepDoc.id = docRef.id;
    await setDoc(docRef, stepDoc);
    return docRef.id;
}

export async function updateTimingStep(projectId, timingStudyId, stepId, updates, userId = null) {
    if (!projectId) throw new Error('projectId es requerido.');
    if (!timingStudyId) throw new Error('timingStudyId es requerido.');
    if (!stepId) throw new Error('stepId es requerido.');
    
    const ref = doc(db, COLLECTIONS.PROJECTS, projectId, COLLECTIONS.TIMING_STUDIES, timingStudyId, COLLECTIONS.TIMING_STEPS, stepId);
    
    const cleanUpdates = {
        ...updates,
        updatedBy: userId,
        updatedAt: new Date().toISOString()
    };
    
    if (cleanUpdates.durationMs !== undefined && cleanUpdates.durationMs < 0) {
        throw new Error('durationMs no puede ser negativo.');
    }
    if (cleanUpdates.linearDistanceMm !== undefined && cleanUpdates.linearDistanceMm < 0) {
        throw new Error('linearDistanceMm no puede ser negativo.');
    }
    if (cleanUpdates.angularDistanceDeg !== undefined && cleanUpdates.angularDistanceDeg < 0) {
        throw new Error('angularDistanceDeg no puede ser negativo.');
    }
    if (cleanUpdates.dependencyStepIds !== undefined && cleanUpdates.dependencyStepIds.includes(stepId)) {
        throw new Error('Un paso no puede depender de sí mismo.');
    }
    
    if (cleanUpdates.stationId) {
        cleanUpdates.stationLabel = await validateAndFormatStationLabel(projectId, cleanUpdates.stationId);
    }
    
    await updateDoc(ref, cleanUpdates);
}

export async function deleteTimingStep(projectId, timingStudyId, stepId, userId = null) {
    // Soft delete
    await updateTimingStep(projectId, timingStudyId, stepId, { active: false }, userId);
}

export async function bulkCreateTimingSteps(projectId, timingStudyId, steps, userId = null) {
    if (!projectId) throw new Error('projectId es requerido.');
    if (!timingStudyId) throw new Error('timingStudyId es requerido.');
    if (!Array.isArray(steps)) throw new Error('steps debe ser un arreglo.');
    
    // Load project stations once to validate
    const stationsCol = collection(db, COLLECTIONS.PROJECTS, projectId, COLLECTIONS.PROJECT_STATIONS);
    const snap = await getDocs(stationsCol);
    const stations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const indexers = new Set(stations.map(s => s.indx || 1));
    const multiIdx = indexers.size > 1;
    
    const batch = writeBatch(db);
    const colRef = stepsRef(projectId, timingStudyId);
    
    for (const stepData of steps) {
        const stepDoc = createTimingStepDocument({
            ...stepData,
            projectId,
            timingStudyId,
            createdBy: userId
        });
        
        if (stepDoc.stationId) {
            const station = stations.find(s => s.id === stepDoc.stationId);
            if (!station) {
                throw new Error(`La estación con ID ${stepDoc.stationId} no pertenece al proyecto.`);
            }
            const stnNum = String(station.stn || '').padStart(2, '0');
            stepDoc.stationLabel = multiIdx ? `${station.indx || 1}-STN${stnNum}` : `STN${stnNum}`;
        }
        
        const docRef = doc(colRef);
        stepDoc.id = docRef.id;
        batch.set(docRef, stepDoc);
    }
    
    await batch.commit();
}

// ── Recalculate Timing Study ──

export async function recalculateTimingStudy(projectId, timingStudyId, userId = null) {
    if (!projectId) throw new Error('projectId es requerido.');
    if (!timingStudyId) throw new Error('timingStudyId es requerido.');
    
    // 1. Fetch study
    const studyDocRef = doc(db, COLLECTIONS.PROJECTS, projectId, COLLECTIONS.TIMING_STUDIES, timingStudyId);
    const studySnap = await getDoc(studyDocRef);
    if (!studySnap.exists()) throw new Error('El estudio de tiempos no existe.');
    const study = { id: studySnap.id, ...studySnap.data() };
    
    // 2. Fetch steps
    const stepsColRef = stepsRef(projectId, timingStudyId);
    const stepsSnap = await getDocs(stepsColRef);
    const allSteps = stepsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Fetch project stations
    const stationsCol = collection(db, COLLECTIONS.PROJECTS, projectId, COLLECTIONS.PROJECT_STATIONS);
    const stationsSnap = await getDocs(stationsCol);
    const stations = stationsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // 3. Recalculate metrics
    const metrics = calculateTimingStudyMetrics(study, allSteps, stations);
    
    // 4. Update study document
    const studyUpdates = {
        machineCycleTimeMs: metrics.machineCycleTimeMs,
        machineCycleTimeSec: metrics.machineCycleTimeSec,
        calculatedPPM: metrics.calculatedPPM,
        bottleneckStationId: metrics.bottleneckStationId,
        bottleneckStationLabel: metrics.bottleneckStationLabel,
        status: metrics.status,
        updatedAt: new Date().toISOString(),
        updatedBy: userId
    };
    await updateDoc(studyDocRef, studyUpdates);
    
    // 5. Update steps document
    const batch = writeBatch(db);
    for (const step of metrics.steps) {
        const stepDocRef = doc(db, COLLECTIONS.PROJECTS, projectId, COLLECTIONS.TIMING_STUDIES, timingStudyId, COLLECTIONS.TIMING_STEPS, step.id);
        batch.update(stepDocRef, {
            startTimeMs: step.startTimeMs,
            finishTimeMs: step.finishTimeMs,
            isCriticalPath: step.isCriticalPath,
            isBottleneck: step.isBottleneck,
            updatedAt: new Date().toISOString(),
            updatedBy: userId
        });
    }
    await batch.commit();
    
    return metrics;
}

export async function getGlobalMotionStandards() {
    const snap = await getDoc(doc(db, 'settings', 'global_motion_standards'));
    return snap.exists() ? snap.data() : null;
}

export async function updateGlobalMotionStandards(config) {
    await setDoc(doc(db, 'settings', 'global_motion_standards'), {
        ...config,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

export async function getActuatorGroups() {
    const snap = await getDoc(doc(db, 'settings', 'actuator_groups'));
    return snap.exists() ? snap.data() : null;
}

export async function updateActuatorGroups(data) {
    await setDoc(doc(db, 'settings', 'actuator_groups'), {
        ...data,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

