import { describe, it, expect } from 'vitest';
import {
    createTimingStudyDocument,
    createTimingStepDocument,
    normalizeTimingStudy,
    normalizeTimingStep,
    calculateSuggestedDuration,
    detectDependencyCycles,
    calculateTimingStudyMetrics,
    calculateCriticalPath,
    getTimingStudyStatus,
    validateTimingStudy,
    TIMING_DEVICE_TYPES,
    TIMING_SENSOR_TYPES,
    DEFAULT_MOTION_TIME_VALUES
} from '../../src/modules/planning/domain/timingStudyModel';

describe('Estudio de Tiempos — Modelo de Dominio y Motor de Cálculo', () => {

    describe('Factories', () => {
        it('createTimingStudyDocument con defaults', () => {
            const doc = createTimingStudyDocument();
            expect(doc.targetPPM).toBe(20);
            expect(doc.stationQty).toBe(1);
            expect(doc.mainIndexEnabled).toBe(true);
            expect(doc.mainIndexTimeMs).toBe(0);
            expect(doc.status).toBe('draft');
            expect(doc.active).toBe(true);
            expect(doc.createdAt).toBeDefined();
        });

        it('createTimingStepDocument con defaults', () => {
            const doc = createTimingStepDocument();
            expect(doc.deviceQty).toBe(1);
            expect(doc.sensorQty).toBe(0);
            expect(doc.linearDistanceMm).toBe(0);
            expect(doc.angularDistanceDeg).toBe(0);
            expect(doc.dependencyStepIds).toEqual([]);
            expect(doc.lagMs).toBe(0);
            expect(doc.startTimeMs).toBe(0);
            expect(doc.durationMs).toBe(0);
            expect(doc.finishTimeMs).toBe(0);
            expect(doc.canRunInParallel).toBe(false);
            expect(doc.waitsForMainIndex).toBe(false);
            expect(doc.canRunDuringIndex).toBe(false);
            expect(doc.isCriticalPath).toBe(false);
            expect(doc.isBottleneck).toBe(false);
            expect(doc.active).toBe(true);
        });
    });

    describe('Normalizers', () => {
        it('normalizeTimingStep convierte strings numéricos a números', () => {
            const step = {
                deviceQty: '2',
                sensorQty: '1',
                linearDistanceMm: '120.5',
                angularDistanceDeg: '90',
                lagMs: '50',
                startTimeMs: '10',
                durationMs: '100',
                finishTimeMs: '110',
                sortOrder: '5',
                waitsForMainIndex: 1,
                active: 'true'
            };
            const norm = normalizeTimingStep(step);
            expect(norm.deviceQty).toBe(2);
            expect(norm.sensorQty).toBe(1);
            expect(norm.linearDistanceMm).toBe(120.5);
            expect(norm.angularDistanceDeg).toBe(90);
            expect(norm.lagMs).toBe(50);
            expect(norm.startTimeMs).toBe(10);
            expect(norm.durationMs).toBe(100);
            expect(norm.finishTimeMs).toBe(110);
            expect(norm.sortOrder).toBe(5);
            expect(norm.waitsForMainIndex).toBe(true);
            expect(norm.active).toBe(true);
        });
    });

    describe('calculateSuggestedDuration', () => {
        it('para cilindro neumático con distancia', () => {
            const step = {
                deviceType: TIMING_DEVICE_TYPES.CYL_PNEU,
                linearDistanceMm: 150 // standard speed 300 mm/s -> 500 ms travel
            };
            // 500ms (viaje) + 80ms (scan default) + 30ms (válvula default) = 610ms
            const duration = calculateSuggestedDuration(step);
            expect(duration).toBe(610);
        });

        it('para gripper', () => {
            const stepSmall = {
                deviceType: TIMING_DEVICE_TYPES.GPR_SO, // small open/close -> 150 ms
            };
            // 150ms + 80ms (scan) + 30ms (valve) = 260ms
            const durSmall = calculateSuggestedDuration(stepSmall);
            expect(durSmall).toBe(260);

            const stepVacuum = {
                deviceType: TIMING_DEVICE_TYPES.GPR,
                notes: 'vacuum gripper' // vacuum -> 400 ms
            };
            // 400ms + 80ms (scan) + 30ms (valve) = 510ms
            const durVacuum = calculateSuggestedDuration(stepVacuum);
            expect(durVacuum).toBe(510);
        });

        it('agregando sensor VISN', () => {
            const step = {
                deviceType: TIMING_DEVICE_TYPES.CYL_PNEU,
                linearDistanceMm: 150, // 500 ms
                sensorType: TIMING_SENSOR_TYPES.VISN // +15 ms camera response
            };
            // 500ms + 80ms (scan) + 30ms (valve) + 15ms (sensor) = 625ms
            const duration = calculateSuggestedDuration(step);
            expect(duration).toBe(625);
        });

        it('agregando handshake trigger', () => {
            const step = {
                deviceType: TIMING_DEVICE_TYPES.GPR_SO, // 150 ms
                triggerCondition: 'wait for Handshake from PLC2' // +200 ms
            };
            // 150ms + 80ms (scan) + 30ms (valve) + 200ms (handshake) = 460ms
            const duration = calculateSuggestedDuration(step);
            expect(duration).toBe(460);
        });

        it('usando customStandards para modificar velocidad', () => {
            const step = {
                deviceType: TIMING_DEVICE_TYPES.CYL_PNEU,
                linearDistanceMm: 150
            };
            // Default: 150 / 300 * 1000 = 500ms + 80 + 30 = 610ms
            // Custom: cylinder standard speed = 150 mm/s -> 150 / 150 * 1000 = 1000ms. Scan = 50ms, Valve = 20ms. Total = 1070ms.
            const customStandards = {
                motionTimeValues: {
                    standard_pneumatic_cylinder: 150,
                    controller_scan_network: 50,
                    valve_response: 20
                },
                classifiers: []
            };
            const duration = calculateSuggestedDuration(step, { customStandards });
            expect(duration).toBe(1070);
        });

        it('usando customStandards con clasificador especifico', () => {
            const step = {
                deviceType: TIMING_DEVICE_TYPES.CYL_PNEU,
                deviceAction: 'RET',
                linearDistanceMm: 200
            };
            // Custom: classifer CYL PNEU + RET -> guided_cylinder (200 mm/s)
            // 200 / 200 * 1000 = 1000ms + 80 (default scan) + 30 (default valve) = 1110ms
            const customStandards = {
                motionTimeValues: {
                    guided_cylinder: 200
                },
                classifiers: [
                    { id: '1', deviceType: TIMING_DEVICE_TYPES.CYL_PNEU, deviceAction: 'RET', motionValueId: 'guided_cylinder' }
                ]
            };
            const duration = calculateSuggestedDuration(step, { customStandards });
            expect(duration).toBe(1110);
        });

        it('usando customStandards con clasificador overrideValue directo', () => {
            const step = {
                deviceType: TIMING_DEVICE_TYPES.GPR,
                deviceAction: 'OPN'
            };
            // Custom: classifier GPR + OPN -> overrideValue = 180ms.
            // 180 + 80 (default scan) + 30 (default valve) = 290ms.
            const customStandards = {
                motionTimeValues: {},
                classifiers: [
                    { id: '1', deviceType: TIMING_DEVICE_TYPES.GPR, deviceAction: 'OPN', overrideValue: 180 }
                ]
            };
            const duration = calculateSuggestedDuration(step, { customStandards });
            expect(duration).toBe(290);
        });
    });

    describe('calculateTimingStudyMetrics', () => {
        const study = {
            targetPPM: 20, // 60 / 20 = 3.0s cycle target
            efficiencyTarget: 0.8,
            mainIndexTimeMs: 1500,
            mainIndexEnabled: false, // Desactivado para aislar el cálculo de pasos
            cycleOutputQty: 1
        };

        const stations = [
            { id: 'stn1', abbreviation: 'STN01', description: 'Carga' },
            { id: 'stn2', abbreviation: 'STN02', description: 'Ensamble' }
        ];

        it('con pasos seriales', () => {
            const steps = [
                { id: 'step1', stationId: 'stn1', stationLabel: 'STN01', durationMs: 500, sortOrder: 1, dependencyStepIds: [] },
                { id: 'step2', stationId: 'stn1', stationLabel: 'STN01', durationMs: 1000, sortOrder: 2, dependencyStepIds: ['step1'] }
            ];

            const metrics = calculateTimingStudyMetrics(study, steps, stations);
            expect(metrics.machineCycleTimeMs).toBe(1500); // 500 + 1000 = 1500 ms
            expect(metrics.steps[0].startTimeMs).toBe(0);
            expect(metrics.steps[0].finishTimeMs).toBe(500);
            expect(metrics.steps[1].startTimeMs).toBe(500);
            expect(metrics.steps[1].finishTimeMs).toBe(1500);
            expect(metrics.status).toBe('OK'); // 1.5s <= 2.4s
        });

        it('con pasos paralelos', () => {
            // Dos pasos independientes en la misma estación que corren en paralelo
            // (no tienen dependencias, sus tiempos de inicio son 0)
            const steps = [
                { id: 'step1', stationId: 'stn1', stationLabel: 'STN01', durationMs: 800, sortOrder: 1, dependencyStepIds: [] },
                { id: 'step2', stationId: 'stn1', stationLabel: 'STN01', durationMs: 1200, sortOrder: 2, dependencyStepIds: [] }
            ];

            const metrics = calculateTimingStudyMetrics(study, steps, stations);
            expect(metrics.machineCycleTimeMs).toBe(1200); // max(800, 1200) = 1200 ms
            expect(metrics.steps[0].startTimeMs).toBe(0);
            expect(metrics.steps[1].startTimeMs).toBe(0);
        });

        it('con dependencias cruzadas/múltiples', () => {
            const steps = [
                { id: 'step1', stationId: 'stn1', durationMs: 300, sortOrder: 1, dependencyStepIds: [] },
                { id: 'step2', stationId: 'stn1', durationMs: 400, sortOrder: 2, dependencyStepIds: [] },
                { id: 'step3', stationId: 'stn2', durationMs: 500, sortOrder: 3, dependencyStepIds: ['step1', 'step2'], lagMs: 100 }
            ];

            const metrics = calculateTimingStudyMetrics(study, steps, stations);
            // step1 termina a las 300
            // step2 termina a las 400
            // step3 empieza en max(300, 400) + lag(100) = 500. Termina a las 500 + 500 = 1000
            expect(metrics.machineCycleTimeMs).toBe(1000);
            expect(metrics.steps[2].startTimeMs).toBe(500);
            expect(metrics.steps[2].finishTimeMs).toBe(1000);
        });

        it('con espera de mainIndex (desplazamiento al final para INDEX puro)', () => {
            const steps = [
                { id: 'stepDwell', stationId: 'stn2', durationMs: 1000, waitsForMainIndex: true, canRunDuringIndex: false },
                { id: 'stepIndex', stationId: 'stn2', durationMs: 500, waitsForMainIndex: false, canRunDuringIndex: true }
            ];
            const metrics = calculateTimingStudyMetrics(study, steps, stations);
            // El paso de Dwell empieza en 0 y termina en 1000 ms.
            expect(metrics.steps[0].startTimeMs).toBe(0);
            expect(metrics.steps[0].finishTimeMs).toBe(1000);
            // El paso de Index se desplaza al final (después del Dwell de 1000 ms)
            expect(metrics.steps[1].startTimeMs).toBe(1000);
            expect(metrics.steps[1].finishTimeMs).toBe(1500);
        });

        it('cálculo de PPM y cuello de botella', () => {
            const steps = [
                { id: 'step1', stationId: 'stn1', stationLabel: 'STN01', durationMs: 1000, dependencyStepIds: [] },
                { id: 'step2', stationId: 'stn2', stationLabel: 'STN02', durationMs: 2500, dependencyStepIds: [] } // Bottleneck!
            ];
            const metrics = calculateTimingStudyMetrics(study, steps, stations);
            expect(metrics.machineCycleTimeMs).toBe(2500);
            expect(metrics.calculatedPPM).toBe(24); // 60000 / 2500 = 24 PPM
            expect(metrics.bottleneckStationId).toBe('stn2');
            expect(metrics.bottleneckStationLabel).toBe('STN02');
            expect(metrics.steps[1].isBottleneck).toBe(true);
            expect(metrics.steps[0].isBottleneck).toBe(false);
        });

        it('evaluación de status (OK, WARNING, FAIL)', () => {
            // Target: 3.0s (3000 ms)
            // OK: <= 3000 ms
            const stepsOk = [{ id: 's1', stationId: 'stn1', durationMs: 2000, dependencyStepIds: [] }];
            expect(calculateTimingStudyMetrics(study, stepsOk, stations).status).toBe('OK');

            // WARNING: <= 3000 * 1.1 = 3300 ms
            const stepsWarning = [{ id: 's1', stationId: 'stn1', durationMs: 3100, dependencyStepIds: [] }];
            expect(calculateTimingStudyMetrics(study, stepsWarning, stations).status).toBe('WARNING');

            // FAIL: > 3300 ms
            const stepsFail = [{ id: 's1', stationId: 'stn1', durationMs: 3500, dependencyStepIds: [] }];
            expect(calculateTimingStudyMetrics(study, stepsFail, stations).status).toBe('FAIL');
        });
    });

    describe('detectDependencyCycles', () => {
        it('detecta ciclos directos', () => {
            const steps = [
                { id: 'step1', dependencyStepIds: ['step2'], active: true },
                { id: 'step2', dependencyStepIds: ['step1'], active: true }
            ];
            const result = detectDependencyCycles(steps);
            expect(result.hasCycle).toBe(true);
            expect(result.cycleStepIds).toContain('step1');
            expect(result.cycleStepIds).toContain('step2');
        });

        it('detecta ciclos indirectos', () => {
            const steps = [
                { id: 'step1', dependencyStepIds: ['step2'], active: true },
                { id: 'step2', dependencyStepIds: ['step3'], active: true },
                { id: 'step3', dependencyStepIds: ['step1'], active: true }
            ];
            const result = detectDependencyCycles(steps);
            expect(result.hasCycle).toBe(true);
            expect(result.cycleStepIds).toContain('step1');
            expect(result.cycleStepIds).toContain('step3');
        });

        it('no detecta ciclos si es un DAG limpio', () => {
            const steps = [
                { id: 'step1', dependencyStepIds: [], active: true },
                { id: 'step2', dependencyStepIds: ['step1'], active: true },
                { id: 'step3', dependencyStepIds: ['step1', 'step2'], active: true }
            ];
            const result = detectDependencyCycles(steps);
            expect(result.hasCycle).toBe(false);
            expect(result.cycleStepIds).toHaveLength(0);
        });
    });

    describe('calculateCriticalPath', () => {
        it('ruta crítica simple con dependencias', () => {
            const steps = [
                { id: 'step1', startTimeMs: 0, durationMs: 500, finishTimeMs: 500, dependencyStepIds: [] },
                { id: 'step2', startTimeMs: 500, durationMs: 1000, finishTimeMs: 1500, dependencyStepIds: ['step1'] },
                { id: 'step3', startTimeMs: 0, durationMs: 400, finishTimeMs: 400, dependencyStepIds: [] } // No crítico
            ];
            const path = calculateCriticalPath(steps);
            expect(path).toContain('step1');
            expect(path).toContain('step2');
            expect(path).not.toContain('step3');
        });
    });

    describe('validateTimingStudy', () => {
        it('estudio sin pasos', () => {
            const study = createTimingStudyDocument({ targetPPM: 20, efficiencyTarget: 0.85, mainIndexEnabled: false });
            const result = validateTimingStudy(study, [], []);
            expect(result.isValid).toBe(true);
            expect(result.issues.some(i => i.id === 'study_empty_steps')).toBe(true);
        });

        it('targetPPM inválido (vacío o <= 0)', () => {
            const study = createTimingStudyDocument({ targetPPM: 0, efficiencyTarget: 0.85, mainIndexEnabled: false });
            const steps = [{ id: 'step1', stationId: 'stn1', taskDescription: 'Test', deviceType: 'CAM', sortOrder: 1, durationMs: 100, active: true }];
            const result = validateTimingStudy(study, steps, [{ id: 'stn1' }]);
            expect(result.isValid).toBe(false);
            expect(result.issues.some(i => i.id === 'study_target_ppm_invalid')).toBe(true);
        });

        it('main index habilitado con tiempo 0', () => {
            const study = createTimingStudyDocument({ targetPPM: 20, efficiencyTarget: 0.85, mainIndexEnabled: true, mainIndexTimeMs: 0 });
            const steps = [{ id: 'step1', stationId: 'stn1', taskDescription: 'Test', deviceType: 'CAM', sortOrder: 1, durationMs: 100, active: true }];
            const result = validateTimingStudy(study, steps, [{ id: 'stn1' }]);
            expect(result.isValid).toBe(true);
            expect(result.issues.some(i => i.id === 'study_indexer_time_zero')).toBe(true);
        });

        it('pasos con duracion negativa', () => {
            const study = createTimingStudyDocument({ targetPPM: 20, efficiencyTarget: 0.85, mainIndexEnabled: false });
            const steps = [{ id: 'step1', stationId: 'stn1', taskDescription: 'Test', deviceType: 'CAM', sortOrder: 1, durationMs: -10, active: true }];
            const result = validateTimingStudy(study, steps, [{ id: 'stn1' }]);
            expect(result.isValid).toBe(false);
            expect(result.issues.some(i => i.id === 'step_duration_negative_step1')).toBe(true);
        });

        it('pasos con startTimeMs negativo', () => {
            const study = createTimingStudyDocument({ targetPPM: 20, efficiencyTarget: 0.85, mainIndexEnabled: false });
            const steps = [{ id: 'step1', stationId: 'stn1', taskDescription: 'Test', deviceType: 'CAM', sortOrder: 1, durationMs: 100, startTimeMs: -5, active: true }];
            const result = validateTimingStudy(study, steps, [{ id: 'stn1' }]);
            expect(result.isValid).toBe(false);
            expect(result.issues.some(i => i.id === 'step_start_negative_step1')).toBe(true);
        });

        it('pasos con finishTimeMs menor que startTimeMs', () => {
            const study = createTimingStudyDocument({ targetPPM: 20, efficiencyTarget: 0.85, mainIndexEnabled: false });
            const steps = [{ id: 'step1', stationId: 'stn1', taskDescription: 'Test', deviceType: 'CAM', sortOrder: 1, durationMs: -50, startTimeMs: 100, finishTimeMs: 50, active: true }];
            const result = validateTimingStudy(study, steps, [{ id: 'stn1' }]);
            expect(result.isValid).toBe(false);
            expect(result.issues.some(i => i.id === 'step_finish_before_start_step1')).toBe(true);
        });

        it('pasos sin estación', () => {
            const study = createTimingStudyDocument({ targetPPM: 20, efficiencyTarget: 0.85, mainIndexEnabled: false });
            const steps = [{ id: 'step1', stationId: null, taskDescription: 'Test', deviceType: 'CAM', sortOrder: 1, durationMs: 100, active: true }];
            const result = validateTimingStudy(study, steps, []);
            expect(result.isValid).toBe(true);
            expect(result.issues.some(i => i.id === 'step_no_station_step1')).toBe(true);
        });

        it('pasos con stationId inexistente', () => {
            const study = createTimingStudyDocument({ targetPPM: 20, efficiencyTarget: 0.85, mainIndexEnabled: false });
            const steps = [{ id: 'step1', stationId: 'fake_stn', taskDescription: 'Test', deviceType: 'CAM', sortOrder: 1, durationMs: 100, active: true }];
            const result = validateTimingStudy(study, steps, [{ id: 'real_stn' }]);
            expect(result.isValid).toBe(false);
            expect(result.issues.some(i => i.id === 'step_station_not_in_project_step1')).toBe(true);
        });

        it('pasos con dependencyStepIds inexistente', () => {
            const study = createTimingStudyDocument({ targetPPM: 20, efficiencyTarget: 0.85, mainIndexEnabled: false });
            const steps = [{ id: 'step1', stationId: 'stn1', taskDescription: 'Test', deviceType: 'CAM', sortOrder: 1, durationMs: 100, dependencyStepIds: ['fake_step'], active: true }];
            const result = validateTimingStudy(study, steps, [{ id: 'stn1' }]);
            expect(result.isValid).toBe(false);
            expect(result.issues.some(i => i.id === 'step_orphan_dependency_step1_fake_step')).toBe(true);
        });

        it('pasos con dependencyStepIds hacia sí mismo', () => {
            const study = createTimingStudyDocument({ targetPPM: 20, efficiencyTarget: 0.85, mainIndexEnabled: false });
            const steps = [{ id: 'step1', stationId: 'stn1', taskDescription: 'Test', deviceType: 'CAM', sortOrder: 1, durationMs: 100, dependencyStepIds: ['step1'], active: true }];
            const result = validateTimingStudy(study, steps, [{ id: 'stn1' }]);
            expect(result.isValid).toBe(false);
            expect(result.issues.some(i => i.id === 'step_self_dependency_step1')).toBe(true);
        });

        it('ciclo de dependencias', () => {
            const study = createTimingStudyDocument({ targetPPM: 20, efficiencyTarget: 0.85, mainIndexEnabled: false });
            const steps = [
                { id: 'step1', stationId: 'stn1', taskDescription: 'Test1', deviceType: 'CAM', sortOrder: 1, durationMs: 100, dependencyStepIds: ['step2'], active: true },
                { id: 'step2', stationId: 'stn1', taskDescription: 'Test2', deviceType: 'CAM', sortOrder: 2, durationMs: 100, dependencyStepIds: ['step1'], active: true }
            ];
            const result = validateTimingStudy(study, steps, [{ id: 'stn1' }]);
            expect(result.isValid).toBe(false);
            expect(result.issues.some(i => i.id === 'study_dependency_cycle_global')).toBe(true);
        });

        it('pasos con duración 0', () => {
            const study = createTimingStudyDocument({ targetPPM: 20, efficiencyTarget: 0.85, mainIndexEnabled: false });
            const steps = [{ id: 'step1', stationId: 'stn1', taskDescription: 'Test', deviceType: 'CAM', sortOrder: 1, durationMs: 0, active: true }];
            const result = validateTimingStudy(study, steps, [{ id: 'stn1' }]);
            expect(result.isValid).toBe(true);
            expect(result.issues.some(i => i.id === 'step_zero_duration_step1')).toBe(true);
        });

        it('estudio con datos válidos', () => {
            const study = createTimingStudyDocument({ targetPPM: 20, efficiencyTarget: 0.85, mainIndexEnabled: false });
            const steps = [
                { id: 'step1', stationId: 'stn1', taskDescription: 'Test', deviceType: 'CAM', durationMs: 100, active: true, sortOrder: 1 }
            ];
            const result = validateTimingStudy(study, steps, [{ id: 'stn1', stn: 1 }]);
            expect(result.isValid).toBe(true);
            expect(result.errorCount).toBe(0);
        });
    });
});
