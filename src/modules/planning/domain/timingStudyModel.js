/**
 * Timing Study Domain Model & Calculation Engine
 * =================================================
 * Pure logic, helper catalogs, factories, normalizers and metrics calculations.
 */

// ============================================================
// 1. HELPERS & CATALOGS
// ============================================================

export const TIMING_DEVICE_TYPES = {
    CAM: 'CAM',
    CYL_PNEU: 'CYL PNEU',
    CYL_ELEC: 'CYL ELEC',
    CYL_HYD: 'CYL HYD',
    DISP: 'DISP',
    FEEDER: 'FEEDER',
    GPR: 'GPR',
    GPR_SO: 'GPR SO',
    GPR_SC: 'GPR SC',
    HEAT_CRT: 'HEAT CRT',
    INDEXER: 'INDEXER',
    IONIZER: 'IONIZER',
    LASER: 'LASER',
    LT_CURT: 'LT CURT',
    SV: 'SV',
    ST: 'ST',
    ROBOT: 'ROBOT',
    ROD_LOCK: 'ROD LOCK',
    ROT_PNEU: 'ROT PNEU',
    ROT_ELEC: 'ROT ELEC',
    MAN: 'MAN',
    MTR: 'MTR',
    VAC_GEN: 'VAC GEN',
    VAC_PMP: 'VAC PMP',
    VFD: 'VFD',
    VIB: 'VIB',
    VISN_LT: 'VISN LT',
    WELDER: 'WELDER',
    LIGHT: 'LIGHT',
    HORN: 'HORN',
    MISC: 'MISC',
    VAL: 'VAL',
};

export const TIMING_ACTIONS = {
    EXT: 'EXT',
    RET: 'RET',
    CW: 'CW',
    CCW: 'CCW',
    OPN: 'OPN',
    CLS: 'CLS',
    UP: 'UP',
    DWN: 'DWN',
    ADV: 'ADV',
    RTN: 'RTN',
    HOR: 'HOR',
    ON: 'ON',
    OFF: 'OFF',
    READ: 'READ',
    WAIT: 'WAIT',
    DELAY: 'DELAY',
    INSPECT: 'INSPECT',
};

export const TIMING_SENSOR_TYPES = {
    ANLG: 'ANLG',
    CNTRL: 'CNTRL',
    ENC: 'ENC',
    FO: 'FO',
    HS: 'HS',
    HS_AM: 'HS AM',
    LS: 'LS',
    LVDT: 'LVDT',
    LC: 'LC',
    PE: 'PE',
    PLC: 'PLC',
    PS: 'PS',
    PX: 'PX',
    PX_AM: 'PX AM',
    RF: 'RF',
    TC: 'TC',
    VS: 'VS',
    VISN: 'VISN',
    PB: 'PB',
    FRC_DIST: 'FRC/DIST',
};

export const TIMING_CYLINDER_ATTITUDES = {
    HORIZONTAL: 'horizontal',
    VERTICAL: 'vertical',
};

export const TIMING_VALVE_TYPES = {
    SINGLE_SOLENOID: 'single_solenoid',
    DOUBLE_SOLENOID: 'double_solenoid',
};

export const DEFAULT_MOTION_TIME_VALUES = {
    CONTROLLER_SCAN_NETWORK: {
        id: 'controller_scan_network',
        label: 'Controller scan time networked',
        category: 'controller',
        valueMs: 80,
        unit: 'ms',
        notes: 'Networked PLC scan time reference',
        sourceSheet: 'MOTION TIME VALUES'
    },
    VALVE_RESPONSE: {
        id: 'valve_response',
        label: 'Valve response',
        category: 'valve',
        valueMs: 30,
        unit: 'ms',
        notes: 'Pneumatic valve response time',
        sourceSheet: 'MOTION TIME VALUES'
    },
    HANDSHAKE_RESPONSE: {
        id: 'handshake_response',
        label: 'Handshake response',
        category: 'handshake',
        valueMs: 200,
        unit: 'ms',
        notes: 'Inter-controller handshake response time',
        sourceSheet: 'MOTION TIME VALUES'
    },
    VISION_CAMERA_RESPONSE: {
        id: 'vision_camera_response',
        label: 'Vision camera response',
        category: 'sensor',
        valueMs: 15,
        unit: 'ms',
        notes: 'Vision system capture/processing response time',
        sourceSheet: 'MOTION TIME VALUES'
    },
    RF_TAG_READ: {
        id: 'rf_tag_read',
        label: 'RF tag read',
        category: 'sensor',
        valueMs: 25,
        unit: 'ms',
        notes: 'RFID tag read time',
        sourceSheet: 'MOTION TIME VALUES'
    },
    SHOCK_ABSORBER_DECELERATION: {
        id: 'shock_absorber_deceleration',
        label: 'Shock absorber deceleration',
        category: 'actuator',
        minMs: 500,
        maxMs: 1000,
        defaultMs: 1000,
        valueMs: 1000,
        unit: 'ms',
        notes: 'Deceleration time to mechanical stop',
        sourceSheet: 'MOTION TIME VALUES'
    },
    SMALL_GRIPPER: {
        id: 'small_gripper',
        label: 'Small gripper',
        category: 'actuator',
        valueMs: 150,
        unit: 'ms',
        notes: 'Small gripper open/close time',
        sourceSheet: 'MOTION TIME VALUES'
    },
    LARGE_GRIPPER: {
        id: 'large_gripper',
        label: 'Large gripper',
        category: 'actuator',
        valueMs: 200,
        unit: 'ms',
        notes: 'Large gripper open/close time',
        sourceSheet: 'MOTION TIME VALUES'
    },
    VACUUM_GRIPPER: {
        id: 'vacuum_gripper',
        label: 'Vacuum gripper',
        category: 'actuator',
        valueMs: 400,
        unit: 'ms',
        notes: 'Vacuum gripper pick/release time',
        sourceSheet: 'MOTION TIME VALUES'
    },
    GUIDED_CYLINDER: {
        id: 'guided_cylinder',
        label: 'Guided cylinder',
        category: 'cylinder',
        speedMmPerSec: 200,
        unit: 'mm/s',
        notes: 'Guided pneumatic cylinder travel speed',
        sourceSheet: 'MOTION TIME VALUES'
    },
    STANDARD_PNEUMATIC_CYLINDER: {
        id: 'standard_pneumatic_cylinder',
        label: 'Standard pneumatic cylinder',
        category: 'cylinder',
        speedMmPerSec: 300,
        unit: 'mm/s',
        notes: 'Standard pneumatic cylinder travel speed',
        sourceSheet: 'MOTION TIME VALUES'
    },
    RODLESS_CYLINDER: {
        id: 'rodless_cylinder',
        label: 'Rodless cylinder',
        category: 'cylinder',
        speedMmPerSec: 350,
        unit: 'mm/s',
        notes: 'Rodless pneumatic cylinder travel speed',
        sourceSheet: 'MOTION TIME VALUES'
    },
    SHORT_LARGE_BORE_CYLINDER: {
        id: 'short_large_bore_cylinder',
        label: 'Short large bore cylinder',
        category: 'cylinder',
        speedMmPerSec: 450,
        unit: 'mm/s',
        notes: 'Short pancake / large bore cylinder speed',
        sourceSheet: 'MOTION TIME VALUES'
    },
    SMALL_ROTARY_ACTUATOR: {
        id: 'small_rotary_actuator',
        label: 'Small rotary actuator',
        category: 'rotary',
        speedDegPerSec: 600,
        unit: 'deg/s',
        notes: 'Small rotary actuator (180 deg / 300 ms)',
        sourceSheet: 'MOTION TIME VALUES'
    },
    LARGE_ROTARY_ACTUATOR: {
        id: 'large_rotary_actuator',
        label: 'Large rotary actuator',
        category: 'rotary',
        speedDegPerSec: 2400,
        unit: 'deg/s',
        notes: 'Large rotary actuator (180 deg / 75 ms)',
        sourceSheet: 'MOTION TIME VALUES'
    },
    ESCAPEMENT_TIC_TOC: {
        id: 'escapement_tic_toc',
        label: 'Escapement tic/toc',
        category: 'actuator',
        valueMs: 500,
        unit: 'ms',
        notes: 'Escapement travel cycle',
        sourceSheet: 'MOTION TIME VALUES'
    },
    PNEUMATIC_ROTARY_CLAMP: {
        id: 'pneumatic_rotary_clamp',
        label: 'Pneumatic rotary clamp',
        category: 'actuator',
        valueMs: 1000,
        unit: 'ms',
        notes: 'Pneumatic rotary clamp time',
        sourceSheet: 'MOTION TIME VALUES'
    },
    SERVO_BELT_DRIVEN: {
        id: 'servo_belt_driven',
        label: 'Servo belt driven',
        category: 'servo',
        speedMmPerSec: 500,
        unit: 'mm/s',
        notes: 'Servo actuator belt driven travel speed',
        sourceSheet: 'MOTION TIME VALUES'
    },
    SERVO_BALLSCREW_DIRECT_COUPLED: {
        id: 'servo_ballscrew_direct_coupled',
        label: 'Servo ballscrew direct coupled',
        category: 'servo',
        speedMmPerSec: 500,
        unit: 'mm/s',
        notes: 'Servo ballscrew direct coupled travel speed',
        sourceSheet: 'MOTION TIME VALUES'
    },
    SERVO_TIMING_BELT_DRIVEN: {
        id: 'servo_timing_belt_driven',
        label: 'Servo timing belt driven',
        category: 'servo',
        speedMmPerSec: 1000,
        unit: 'mm/s',
        notes: 'Servo timing belt driven travel speed',
        sourceSheet: 'MOTION TIME VALUES'
    },
    SERVO_LINEAR_MOTOR: {
        id: 'servo_linear_motor',
        label: 'Servo linear motor estimating speed',
        category: 'servo',
        speedMmPerSec: 2000,
        unit: 'mm/s',
        notes: 'Servo linear motor travel speed reference',
        sourceSheet: 'MOTION TIME VALUES'
    },
    EPSON_T3_ROBOT: {
        id: 'epson_t3_robot',
        label: 'Epson T3 robot',
        category: 'robot',
        unit: 'ms',
        notes: 'Configurable/manual Epson T3 cycle time',
        sourceSheet: 'MOTION TIME VALUES'
    },
    C6_ROBOT: {
        id: 'c6_robot',
        label: 'C6 robot',
        category: 'robot',
        unit: 'ms',
        notes: 'Configurable/manual C6 cycle time',
        sourceSheet: 'MOTION TIME VALUES'
    }
};

// ============================================================
// 2. FACTORIES
// ============================================================

export function createTimingStudyDocument(input = {}) {
    const now = new Date().toISOString();
    return {
        name: input.name || 'Estudio de Tiempos V1',
        projectId: input.projectId || null,
        customer: input.customer || '',
        machineName: input.machineName || '',
        targetPPM: input.targetPPM !== undefined ? Number(input.targetPPM) : 20,
        stationQty: input.stationQty !== undefined ? Number(input.stationQty) : 1,
        mainIndexEnabled: input.mainIndexEnabled !== undefined ? Boolean(input.mainIndexEnabled) : true,
        mainIndexTimeMs: input.mainIndexTimeMs !== undefined ? Number(input.mainIndexTimeMs) : 0,
        nestCount: input.nestCount !== undefined ? Number(input.nestCount) : 1,
        positionsPerNest: input.positionsPerNest !== undefined ? Number(input.positionsPerNest) : 1,
        cycleOutputQty: input.cycleOutputQty !== undefined ? Number(input.cycleOutputQty) : 1,
        status: input.status || 'draft',
        notes: input.notes || '',
        active: input.active !== undefined ? Boolean(input.active) : true,
        customStandards: input.customStandards || null,
        createdAt: input.createdAt || now,
        updatedAt: input.updatedAt || now
    };
}

export function createTimingStepDocument(input = {}) {
    const now = new Date().toISOString();
    return {
        projectId: input.projectId || null,
        timingStudyId: input.timingStudyId || null,
        stationId: input.stationId || null,
        stationLabel: input.stationLabel || '',
        deviceLetter: input.deviceLetter || '',
        deviceType: input.deviceType || '',
        deviceAction: input.deviceAction || '',
        motionProfileId: input.motionProfileId || '',
        deviceQty: input.deviceQty !== undefined ? Number(input.deviceQty) : 1,
        sensorLetter: input.sensorLetter || '',
        sensorType: input.sensorType || '',
        sensorQty: input.sensorQty !== undefined ? Number(input.sensorQty) : 0,
        linearDistanceMm: input.linearDistanceMm !== undefined ? Number(input.linearDistanceMm) : 0,
        angularDistanceDeg: input.angularDistanceDeg !== undefined ? Number(input.angularDistanceDeg) : 0,
        taskDescription: input.taskDescription || '',
        triggerCondition: input.triggerCondition || '',
        dependencyStepIds: Array.isArray(input.dependencyStepIds) ? input.dependencyStepIds : [],
        lagMs: input.lagMs !== undefined ? Number(input.lagMs) : 0,
        startTimeMs: input.startTimeMs !== undefined ? Number(input.startTimeMs) : 0,
        durationMs: input.durationMs !== undefined ? Number(input.durationMs) : 0,
        finishTimeMs: input.finishTimeMs !== undefined ? Number(input.finishTimeMs) : 0,
        sequenceGroup: input.sequenceGroup || '',
        canRunInParallel: input.canRunInParallel !== undefined ? Boolean(input.canRunInParallel) : false,
        waitsForMainIndex: input.waitsForMainIndex !== undefined ? Boolean(input.waitsForMainIndex) : false,
        canRunDuringIndex: input.canRunDuringIndex !== undefined ? Boolean(input.canRunDuringIndex) : false,
        isCriticalPath: input.isCriticalPath !== undefined ? Boolean(input.isCriticalPath) : false,
        isBottleneck: input.isBottleneck !== undefined ? Boolean(input.isBottleneck) : false,
        notes: input.notes || '',
        sortOrder: input.sortOrder !== undefined ? Number(input.sortOrder) : 0,
        active: input.active !== undefined ? Boolean(input.active) : true,
        createdAt: input.createdAt || now,
        updatedAt: input.updatedAt || now
    };
}

// ============================================================
// 3. NORMALIZERS
// ============================================================

export function normalizeTimingStudy(study) {
    if (!study) return null;
    return {
        ...study,
        targetPPM: study.targetPPM !== undefined && study.targetPPM !== null ? Number(study.targetPPM) : 20,
        stationQty: study.stationQty !== undefined && study.stationQty !== null ? Number(study.stationQty) : 1,
        mainIndexTimeMs: study.mainIndexTimeMs !== undefined && study.mainIndexTimeMs !== null ? Number(study.mainIndexTimeMs) : 0,
        nestCount: study.nestCount !== undefined && study.nestCount !== null ? Number(study.nestCount) : 1,
        positionsPerNest: study.positionsPerNest !== undefined && study.positionsPerNest !== null ? Number(study.positionsPerNest) : 1,
        cycleOutputQty: study.cycleOutputQty !== undefined && study.cycleOutputQty !== null ? Number(study.cycleOutputQty) : 1,
        mainIndexEnabled: study.mainIndexEnabled !== undefined && study.mainIndexEnabled !== null ? Boolean(study.mainIndexEnabled) : true,
        active: study.active !== undefined && study.active !== null ? Boolean(study.active) : true,
        customStandards: study.customStandards || null
    };
}

export function normalizeTimingStep(step) {
    if (!step) return null;
    return {
        ...step,
        deviceQty: step.deviceQty !== undefined && step.deviceQty !== null ? Number(step.deviceQty) : 1,
        sensorQty: step.sensorQty !== undefined && step.sensorQty !== null ? Number(step.sensorQty) : 0,
        linearDistanceMm: step.linearDistanceMm !== undefined && step.linearDistanceMm !== null ? Number(step.linearDistanceMm) : 0,
        angularDistanceDeg: step.angularDistanceDeg !== undefined && step.angularDistanceDeg !== null ? Number(step.angularDistanceDeg) : 0,
        lagMs: step.lagMs !== undefined && step.lagMs !== null ? Number(step.lagMs) : 0,
        startTimeMs: step.startTimeMs !== undefined && step.startTimeMs !== null ? Number(step.startTimeMs) : 0,
        durationMs: step.durationMs !== undefined && step.durationMs !== null ? Number(step.durationMs) : 0,
        finishTimeMs: step.finishTimeMs !== undefined && step.finishTimeMs !== null ? Number(step.finishTimeMs) : 0,
        sortOrder: step.sortOrder !== undefined && step.sortOrder !== null ? Number(step.sortOrder) : 0,
        waitsForMainIndex: step.waitsForMainIndex !== undefined && step.waitsForMainIndex !== null ? Boolean(step.waitsForMainIndex) : false,
        canRunDuringIndex: step.canRunDuringIndex !== undefined && step.canRunDuringIndex !== null ? Boolean(step.canRunDuringIndex) : false,
        canRunInParallel: step.canRunInParallel !== undefined && studyIsBoolean(step.canRunInParallel) ? Boolean(step.canRunInParallel) : false,
        isCriticalPath: step.isCriticalPath !== undefined && studyIsBoolean(step.isCriticalPath) ? Boolean(step.isCriticalPath) : false,
        isBottleneck: step.isBottleneck !== undefined && studyIsBoolean(step.isBottleneck) ? Boolean(step.isBottleneck) : false,
        active: step.active !== undefined && step.active !== null ? Boolean(step.active) : true,
        dependencyStepIds: Array.isArray(step.dependencyStepIds)
            ? step.dependencyStepIds.filter(id => id !== undefined && id !== null && id !== '')
            : []
    };
}

function studyIsBoolean(val) {
    return val !== null && val !== undefined;
}

// ============================================================
// 4. MOTOR DE CÁLCULO
// ============================================================

export function calculateSuggestedDuration(step, options = {}) {
    if (!step) return 0;
    const normalized = normalizeTimingStep(step);
    
    const custom = options.customStandards || null;
    const global = options.globalStandards || null;
    const motionValues = custom?.motionTimeValues || global?.motionTimeValues || {};
    const classifiers = custom?.classifiers || global?.classifiers || [];
    
    const motionUnits = custom?.motionTimeUnits || global?.motionTimeUnits || {};
    const getUnit = (key) => {
        if (motionUnits[key]) return motionUnits[key];
        const def = DEFAULT_MOTION_TIME_VALUES[key.toUpperCase()];
        if (def) {
            if (def.speedMmPerSec !== undefined) return 'mm/s';
            if (def.speedDegPerSec !== undefined) return 'deg/s';
            return 'ms';
        }
        return 'ms';
    };

    const getValue = (key, defaultProp = 'valueMs') => {
        if (motionValues[key] !== undefined && motionValues[key] !== null) {
            return Number(motionValues[key]);
        }
        const def = DEFAULT_MOTION_TIME_VALUES[key.toUpperCase()];
        if (def) {
            if (defaultProp === 'speedMmPerSec') return def.speedMmPerSec ?? 300;
            if (defaultProp === 'speedDegPerSec') return def.speedDegPerSec ?? 600;
            return def.valueMs ?? def.defaultMs ?? 0;
        }
        return 0;
    };

    const scanTimeMs = options.controllerScanTimeMs ?? getValue('controller_scan_network');
    const valveTimeMs = getValue('valve_response');
    
    let duration = 0;
    let requiresValve = false;
    
    const deviceType = normalized.deviceType;
    const deviceAction = normalized.deviceAction;
    const notes = (normalized.notes || '').toLowerCase();
    
    // Look for matching classifier rule
    let matchedRule = null;
    if (deviceType && deviceAction) {
        // Try exact match
        matchedRule = classifiers.find(c => c.deviceType === deviceType && c.deviceAction === deviceAction);
        if (!matchedRule) {
            // Try wildcard match for action
            matchedRule = classifiers.find(c => c.deviceType === deviceType && (c.deviceAction === '*' || !c.deviceAction));
        }
    }
    
    if (matchedRule) {
        const motionValueId = matchedRule.motionValueId;
        
        if (deviceType === TIMING_DEVICE_TYPES.CYL_PNEU || 
            deviceType === TIMING_DEVICE_TYPES.GPR || 
            deviceType === TIMING_DEVICE_TYPES.GPR_SO || 
            deviceType === TIMING_DEVICE_TYPES.GPR_SC || 
            deviceType === TIMING_DEVICE_TYPES.ROT_PNEU) {
            requiresValve = true;
        }
        
        if (matchedRule.overrideValue !== undefined && matchedRule.overrideValue !== null && Number(matchedRule.overrideValue) > 0) {
            duration = Number(matchedRule.overrideValue);
        } else if (motionValueId) {
            const unit = getUnit(motionValueId);
            const val = getValue(motionValueId);
            
            if (unit === 'mm/s') {
                if (normalized.linearDistanceMm > 0 && val > 0) {
                    duration = (normalized.linearDistanceMm / val) * 1000;
                }
            } else if (unit === 'deg/s') {
                if (normalized.angularDistanceDeg > 0 && val > 0) {
                    duration = (normalized.angularDistanceDeg / val) * 1000;
                }
            } else {
                // 'ms' es un tiempo de retardo fijo
                duration = val;
            }
        }
    } else {
        // Fall back to original hardcoded logic using helper
        if (deviceType === TIMING_DEVICE_TYPES.CYL_PNEU) {
            requiresValve = true;
            const speed = getValue('standard_pneumatic_cylinder', 'speedMmPerSec');
            if (normalized.linearDistanceMm > 0) {
                duration = (normalized.linearDistanceMm / speed) * 1000;
            }
        } else if (deviceType === TIMING_DEVICE_TYPES.GPR || deviceType === TIMING_DEVICE_TYPES.GPR_SO || deviceType === TIMING_DEVICE_TYPES.GPR_SC) {
            requiresValve = true;
            const motionProfileId = options.motionProfileId || '';
            if (notes.includes('vacuum') || motionProfileId === 'vacuum_gripper' || motionProfileId === 'vacuum') {
                duration = getValue('vacuum_gripper');
            } else if (deviceType === TIMING_DEVICE_TYPES.GPR_SO || notes.includes('small') || notes.includes('so')) {
                duration = getValue('small_gripper');
            } else if (deviceType === TIMING_DEVICE_TYPES.GPR_SC || notes.includes('large') || notes.includes('sc')) {
                duration = getValue('large_gripper');
            } else {
                duration = getValue('small_gripper');
            }
        } else if (deviceType === TIMING_DEVICE_TYPES.ROT_PNEU) {
            requiresValve = true;
            const speed = getValue('small_rotary_actuator', 'speedDegPerSec');
            if (normalized.angularDistanceDeg > 0) {
                duration = (normalized.angularDistanceDeg / speed) * 1000;
            }
        } else if (deviceType === TIMING_DEVICE_TYPES.SV) {
            const speed = getValue('servo_timing_belt_driven', 'speedMmPerSec');
            if (normalized.linearDistanceMm > 0) {
                duration = (normalized.linearDistanceMm / speed) * 1000;
            }
        } else if (deviceType) {
            const matched = Object.values(DEFAULT_MOTION_TIME_VALUES).find(
                v => v.id === deviceType || v.label === deviceType
            );
            if (matched) {
                duration = getValue(matched.id);
            }
        }
    }
    
    // Add scan time if we calculated something or a device is set
    if (duration > 0 || deviceType) {
        duration += scanTimeMs;
    }
    
    // Add valve time if pneumatic
    if (requiresValve) {
        duration += valveTimeMs;
    }
    
    // Sensor type responses
    if (normalized.sensorType === TIMING_SENSOR_TYPES.VISN) {
        duration += getValue('vision_camera_response');
    } else if (normalized.sensorType === TIMING_SENSOR_TYPES.RF) {
        duration += getValue('rf_tag_read');
    }
    
    // Trigger condition responses
    const trigger = (normalized.triggerCondition || '').toLowerCase();
    if (trigger.includes('handshake')) {
        duration += getValue('handshake_response');
    }
    
    return Math.round(duration);
}

export function detectDependencyCycles(steps) {
    const activeSteps = (steps || []).filter(s => s.active !== false);
    const adj = {};
    const stepMap = {};
    
    for (const step of activeSteps) {
        adj[step.id] = step.dependencyStepIds || [];
        stepMap[step.id] = step;
    }
    
    const visited = {}; // 0: unvisited, 1: visiting, 2: visited
    const cycleNodes = new Set();
    
    function dfs(u) {
        visited[u] = 1;
        const neighbors = adj[u] || [];
        for (const v of neighbors) {
            if (!stepMap[v]) continue; // Skip missing or inactive dependency steps
            if (visited[v] === 1) {
                cycleNodes.add(u);
                cycleNodes.add(v);
                return true;
            } else if (!visited[v]) {
                if (dfs(v)) {
                    cycleNodes.add(u);
                    return true;
                }
            }
        }
        visited[u] = 2;
        return false;
    }
    
    let hasCycle = false;
    for (const step of activeSteps) {
        if (!visited[step.id]) {
            if (dfs(step.id)) {
                hasCycle = true;
            }
        }
    }
    
    return {
        hasCycle,
        cycleStepIds: Array.from(cycleNodes)
    };
}

export function topologicalSort(steps) {
    const activeSteps = steps.filter(s => s.active !== false);
    const adj = {};
    const inDegree = {};
    const stepMap = {};
    
    for (const step of activeSteps) {
        adj[step.id] = [];
        inDegree[step.id] = 0;
        stepMap[step.id] = step;
    }
    
    for (const step of activeSteps) {
        const deps = step.dependencyStepIds || [];
        for (const depId of deps) {
            if (stepMap[depId]) {
                adj[depId].push(step.id);
                inDegree[step.id]++;
            }
        }
    }
    
    const queue = [];
    for (const step of activeSteps) {
        if (inDegree[step.id] === 0) {
            queue.push(step.id);
        }
    }
    
    queue.sort((a, b) => (stepMap[a].sortOrder || 0) - (stepMap[b].sortOrder || 0));
    
    const sortedIds = [];
    while (queue.length > 0) {
        const u = queue.shift();
        sortedIds.push(u);
        
        const neighbors = adj[u] || [];
        neighbors.sort((a, b) => (stepMap[a].sortOrder || 0) - (stepMap[b].sortOrder || 0));
        
        for (const v of neighbors) {
            inDegree[v]--;
            if (inDegree[v] === 0) {
                queue.push(v);
            }
        }
    }
    
    return sortedIds.map(id => stepMap[id]);
}

export function calculateTimingStudyMetrics(study, steps, stations = []) {
    const normalizedStudy = normalizeTimingStudy(study || createTimingStudyDocument());
    const activeSteps = (steps || []).filter(s => s.active !== false);
    
    const { hasCycle, cycleStepIds } = detectDependencyCycles(activeSteps);
    
    let processedSteps = [];
    
    if (hasCycle) {
        // If there's a cycle, we can't perform top-sort safely.
        // Fallback: copy times as-is and mark them, but do not propagate.
        processedSteps = activeSteps.map(s => normalizeTimingStep(s));
    } else {
        const sorted = topologicalSort(activeSteps);
        const stepsMap = {};
        
        for (const step of sorted) {
            const normalized = normalizeTimingStep(step);
            const deps = normalized.dependencyStepIds || [];
            
            let startTime = 0;
            if (deps.length === 0) {
                startTime = normalized.lagMs || 0;
            } else {
                let maxDepFinish = 0;
                for (const depId of deps) {
                    const depStep = stepsMap[depId];
                    if (depStep) {
                        maxDepFinish = Math.max(maxDepFinish, depStep.finishTimeMs || 0);
                    }
                }
                startTime = maxDepFinish + (normalized.lagMs || 0);
            }
            // No retrasamos las tareas de Dwell al inicio del ciclo (el indexador ocurre al final)
            normalized.startTimeMs = startTime;
            normalized.finishTimeMs = startTime + (normalized.durationMs || 0);
            
            stepsMap[normalized.id] = normalized;
        }
        
        // Re-align processedSteps in the order of original activeSteps (or sortOrder)
        processedSteps = activeSteps.map(s => stepsMap[s.id]).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }
    
    // Calculate Critical Path
    const criticalPathStepIds = hasCycle ? [] : calculateCriticalPath(processedSteps);
    processedSteps = processedSteps.map(step => ({
        ...step,
        isCriticalPath: criticalPathStepIds.includes(step.id)
    }));
    
    // Station Metrics (Dwell Time netos por estación)
    const stationDwellTimes = {};
    const stationLabels = {};
    const mainIndexTimeMs = normalizedStudy.mainIndexTimeMs || 0;
    const indexMs = normalizedStudy.mainIndexEnabled ? mainIndexTimeMs : 0;
    
    for (const step of processedSteps) {
        const sId = step.stationId;
        if (sId) {
            const isIndexOnly = step.canRunDuringIndex && !step.waitsForMainIndex;
            const isBoth = step.canRunDuringIndex && step.waitsForMainIndex;
            let contribution = 0;
            if (isBoth) {
                // Tareas Ambos: su contribución es el tiempo de finalización que excede al Indexador
                contribution = Math.max(0, (step.finishTimeMs || 0) - indexMs);
            } else if (!isIndexOnly) {
                // Tareas Dwell puro: toda su duración es Dwell
                contribution = step.finishTimeMs || 0;
            }
            stationDwellTimes[sId] = Math.max(stationDwellTimes[sId] || 0, contribution);
            if (step.stationLabel) {
                stationLabels[sId] = step.stationLabel;
            }
        }
    }
    
    // Determine unique stations from steps if not provided
    let stationsList = [...stations];
    if (stationsList.length === 0) {
        const uniqueStationIds = new Set(processedSteps.map(s => s.stationId).filter(Boolean));
        stationsList = Array.from(uniqueStationIds).map(id => ({
            id,
            description: stationLabels[id] || id,
            abbreviation: stationLabels[id] || id,
            stn: id
        }));
    }
    
    const stationMetrics = stationsList.map(stn => {
        const cycleTimeMs = stationDwellTimes[stn.id] || 0;
        return {
            stationId: stn.id,
            stationLabel: stn.abbreviation || stn.description || String(stn.stn || ''),
            stationCycleTimeMs: cycleTimeMs
        };
    });
    
    // Calculate Dwell Time = max station dwell time (bottleneck)
    const dwellTimeMs = stationMetrics.length > 0 
        ? Math.max(...stationMetrics.map(m => m.stationCycleTimeMs), 0)
        : Math.max(...processedSteps.map(step => {
            const isIndexOnly = step.canRunDuringIndex && !step.waitsForMainIndex;
            const isBoth = step.canRunDuringIndex && step.waitsForMainIndex;
            if (isBoth) return Math.max(0, (step.finishTimeMs || 0) - indexMs);
            if (!isIndexOnly) return step.finishTimeMs || 0;
            return 0;
          }), 0);

    // Desplazar visualmente las tareas de INDEX puro al final del ciclo (fase de Index)
    processedSteps = processedSteps.map(step => {
        const isIndexOnly = step.canRunDuringIndex && !step.waitsForMainIndex;
        if (isIndexOnly) {
            const start = Math.max(step.startTimeMs || 0, dwellTimeMs);
            return {
                ...step,
                startTimeMs: start,
                finishTimeMs: start + (step.durationMs || 0)
            };
        }
        return step;
    });

    // Machine Cycle Time = Dwell + Index (si aplica)
    const machineCycleTimeMs = dwellTimeMs + (normalizedStudy.mainIndexEnabled ? mainIndexTimeMs : 0);
        
    const machineCycleTimeSec = machineCycleTimeMs / 1000;
    
    // Target Calculations
    const calcMode = normalizedStudy.calcMode || 'pph';
    const linkOeeToStudy = !!normalizedStudy.linkOeeToStudy;
    const availability = normalizedStudy.availability !== undefined ? Number(normalizedStudy.availability) : 95;
    const yieldVal = normalizedStudy.yield !== undefined ? Number(normalizedStudy.yield) : 98;
    const shiftHours = normalizedStudy.shiftHours !== undefined ? Number(normalizedStudy.shiftHours) : 8;
    const cycleOutputQty = normalizedStudy.cycleOutputQty !== undefined ? Number(normalizedStudy.cycleOutputQty) : 1;
    const workDaysPerWeek = normalizedStudy.workDaysPerWeek !== undefined ? Number(normalizedStudy.workDaysPerWeek) : 5;
    const country = normalizedStudy.country || 'MX';
    const annualDemand = normalizedStudy.annualDemand !== undefined ? Number(normalizedStudy.annualDemand) : 18388734;

    const feriados = country === 'MX' ? 7 : (country === 'CR' ? 11 : (country === 'US' ? 11 : 0));
    const diasAnuales = (workDaysPerWeek * 52) - feriados;

    // ── OEE Factor ──
    let oeeFactor = 0.85;
    if (linkOeeToStudy) {
        const ppmReal = machineCycleTimeMs > 0 ? (60000 / machineCycleTimeMs) : 0;
        const provisionalTargetPPM = Number(normalizedStudy.targetPPM) || 10;
        const efficiency = provisionalTargetPPM > 0 ? (ppmReal / provisionalTargetPPM) * 100 : 100;
        oeeFactor = (availability / 100) * (efficiency / 100) * (yieldVal / 100);
    } else {
        const oeePenalty = normalizedStudy.oeePenalty !== undefined ? Number(normalizedStudy.oeePenalty) : 15;
        oeeFactor = (100 - oeePenalty) / 100;
    }

    let targetPPM = Number(normalizedStudy.targetPPM) || 10;

    if (calcMode === 'demand') {
        const piezasDiaReq = diasAnuales > 0 ? annualDemand / diasAnuales : 0;
        const piezasDiaBrutoReq = oeeFactor > 0 ? piezasDiaReq / oeeFactor : 0;
        const piezasHoraTarget = shiftHours > 0 ? piezasDiaBrutoReq / shiftHours : 0;
        targetPPM = cycleOutputQty > 0 ? (piezasHoraTarget / 60 / cycleOutputQty) : 0;
    } else {
        const targetPiecesPerShift = normalizedStudy.targetPiecesPerShift !== undefined ? Number(normalizedStudy.targetPiecesPerShift) : 8000;
        const piezasDiaReq = targetPiecesPerShift;
        const piezasDiaBrutoReq = oeeFactor > 0 ? piezasDiaReq / oeeFactor : 0;
        const piezasHoraTarget = shiftHours > 0 ? piezasDiaBrutoReq / shiftHours : 0;
        targetPPM = cycleOutputQty > 0 ? (piezasHoraTarget / 60 / cycleOutputQty) : 0;
    }

    const targetCycleTimeSec = targetPPM > 0 ? 60 / targetPPM : 0;
    const effectiveTargetCycleTimeSec = targetCycleTimeSec;
    
    const calculatedPPM = machineCycleTimeMs > 0 
        ? (60000 / machineCycleTimeMs) * normalizedStudy.cycleOutputQty
        : 0;
        
    // Bottleneck Station
    let bottleneckStationId = null;
    let bottleneckStationLabel = '';
    let maxStationCycleTime = 0;
    
    for (const metric of stationMetrics) {
        if (metric.stationCycleTimeMs > maxStationCycleTime) {
            maxStationCycleTime = metric.stationCycleTimeMs;
            bottleneckStationId = metric.stationId;
            bottleneckStationLabel = metric.stationLabel;
        }
    }
    
    // Flag Bottleneck on Steps
    processedSteps = processedSteps.map(step => ({
        ...step,
        isBottleneck: step.stationId && step.stationId === bottleneckStationId ? true : false
    }));
    
    // Study Status
    const status = getTimingStudyStatus(machineCycleTimeMs, effectiveTargetCycleTimeSec);
    
    return {
        steps: processedSteps,
        stationMetrics,
        dwellTimeMs,
        machineCycleTimeMs,
        machineCycleTimeSec,
        targetCycleTimeSec,
        effectiveTargetCycleTimeSec,
        calculatedPPM,
        bottleneckStationId,
        bottleneckStationLabel,
        status,
        hasDependencyCycle: hasCycle,
        cycleStepIds,
        criticalPathStepIds
    };
}

export function calculateCriticalPath(steps) {
    const activeSteps = (steps || []).filter(s => s.active !== false);
    if (activeSteps.length === 0) return [];
    
    // Find the max finish time
    const maxFinish = Math.max(...activeSteps.map(s => s.finishTimeMs || 0), 0);
    if (maxFinish === 0) return [];
    
    const criticalSet = new Set();
    const endSteps = activeSteps.filter(s => s.finishTimeMs === maxFinish);
    const queue = [...endSteps];
    
    while (queue.length > 0) {
        const curr = queue.shift();
        if (criticalSet.has(curr.id)) continue;
        criticalSet.add(curr.id);
        
        const deps = curr.dependencyStepIds || [];
        for (const depId of deps) {
            const pred = activeSteps.find(s => s.id === depId);
            if (pred) {
                // Predecessor is critical if its finishTime matches curr's startTime (with lag)
                const isCriticalTransition = Math.abs(pred.finishTimeMs + (curr.lagMs || 0) - curr.startTimeMs) <= 1;
                if (isCriticalTransition) {
                    queue.push(pred);
                }
            }
        }
    }
    
    // If no dependencies were present, the set will just have the max endSteps.
    // If that ends up being empty for some reason, fallback to marking all steps matching maxFinish.
    if (criticalSet.size === 0) {
        return endSteps.map(s => s.id);
    }
    
    return Array.from(criticalSet);
}

export function getTimingStudyStatus(machineCycleTimeMs, effectiveTargetCycleTimeSec) {
    if (machineCycleTimeMs === 0 || effectiveTargetCycleTimeSec === 0) {
        return 'DRAFT';
    }
    const machineSec = machineCycleTimeMs / 1000;
    if (machineSec <= effectiveTargetCycleTimeSec) {
        return 'OK';
    }
    if (machineSec <= effectiveTargetCycleTimeSec * 1.1) {
        return 'WARNING';
    }
    return 'FAIL';
}

export function validateTimingStudy(study, steps = [], stations = []) {
    const activeSteps = (steps || []).filter(s => s.active !== false);
    const issues = [];

    // ── 1. Validaciones a nivel de estudio ──
    const calcMode = study?.calcMode || 'pph';
    const linkOeeToStudy = !!study?.linkOeeToStudy;
    const availability = study?.availability !== undefined ? Number(study.availability) : 95;
    const yieldVal = study?.yield !== undefined ? Number(study.yield) : 98;
    const shiftHours = study?.shiftHours !== undefined ? Number(study.shiftHours) : 8;
    const cycleOutputQty = study?.cycleOutputQty !== undefined ? Number(study.cycleOutputQty) : 1;
    const workDaysPerWeek = study?.workDaysPerWeek !== undefined ? Number(study.workDaysPerWeek) : 5;
    const country = study?.country || 'MX';
    const annualDemand = study?.annualDemand !== undefined ? Number(study.annualDemand) : 18388734;

    const feriados = country === 'MX' ? 7 : (country === 'CR' ? 11 : (country === 'US' ? 11 : 0));
    const diasAnuales = (workDaysPerWeek * 52) - feriados;

    let oeeFactor = 0.85;
    if (linkOeeToStudy) {
        const machineCycleMs = study?.machineCycleTimeMs || 0;
        const ppmReal = machineCycleMs > 0 ? (60000 / machineCycleMs) : 0;
        const provisionalTargetPPM = Number(study?.targetPPM) || 10;
        const efficiency = provisionalTargetPPM > 0 ? (ppmReal / provisionalTargetPPM) * 100 : 100;
        oeeFactor = (availability / 100) * (efficiency / 100) * (yieldVal / 100);
    } else {
        const oeePenalty = study?.oeePenalty !== undefined ? Number(study.oeePenalty) : 15;
        oeeFactor = (100 - oeePenalty) / 100;
    }

    let targetPPM = Number(study?.targetPPM) || 10;

    if (calcMode === 'demand') {
        const piezasDiaReq = diasAnuales > 0 ? annualDemand / diasAnuales : 0;
        const piezasDiaBrutoReq = oeeFactor > 0 ? piezasDiaReq / oeeFactor : 0;
        const piezasHoraTarget = shiftHours > 0 ? piezasDiaBrutoReq / shiftHours : 0;
        targetPPM = cycleOutputQty > 0 ? (piezasHoraTarget / 60 / cycleOutputQty) : 0;
    } else {
        const targetPiecesPerShift = study?.targetPiecesPerShift !== undefined ? Number(study.targetPiecesPerShift) : 8000;
        const piezasDiaReq = targetPiecesPerShift;
        const piezasDiaBrutoReq = oeeFactor > 0 ? piezasDiaReq / oeeFactor : 0;
        const piezasHoraTarget = shiftHours > 0 ? piezasDiaBrutoReq / shiftHours : 0;
        targetPPM = cycleOutputQty > 0 ? (piezasHoraTarget / 60 / cycleOutputQty) : 0;
    }

    if (targetPPM <= 0) {
        issues.push({
            id: 'study_target_ppm_invalid',
            severity: 'error',
            scope: 'study',
            message: 'El PPM Objetivo es inválido o menor/igual a cero.',
            recommendation: 'Define un PPM objetivo mayor a 0 en la configuración general.'
        });
    }



    if (study?.mainIndexEnabled && (!study.mainIndexTimeMs || Number(study.mainIndexTimeMs) <= 0)) {
        issues.push({
            id: 'study_indexer_time_zero',
            severity: 'warning',
            scope: 'study',
            message: 'El indexador principal está habilitado pero su tiempo es 0 ms.',
            recommendation: 'Define el tiempo que toma el indexador (ej. 2500 ms) o deshabilítalo en la configuración general.'
        });
    }

    if (activeSteps.length === 0) {
        issues.push({
            id: 'study_empty_steps',
            severity: 'warning',
            scope: 'study',
            message: 'El estudio no tiene ningún paso definido.',
            recommendation: 'Agrega pasos en la grilla de secuencia o usa "Crear desde Estaciones" para iniciar.'
        });
    }

    // ── 2. Validaciones a nivel de pasos (steps) ──
    const stepIdsSet = new Set(activeSteps.map(s => s.id));
    const stationsSet = new Set((stations || []).map(s => s.id));

    activeSteps.forEach((step, idx) => {
        const indexStr = step.sortOrder ?? idx;

        // Tiempos negativos o incoherentes
        if (step.durationMs < 0) {
            issues.push({
                id: `step_duration_negative_${step.id}`,
                severity: 'error',
                scope: 'step',
                stepId: step.id,
                message: `El paso [Orden: ${indexStr}] tiene duración negativa: ${step.durationMs} ms.`,
                recommendation: 'Modifica el valor en la grilla para que sea 0 o mayor.'
            });
        }
        if (step.startTimeMs < 0) {
            issues.push({
                id: `step_start_negative_${step.id}`,
                severity: 'error',
                scope: 'step',
                stepId: step.id,
                message: `El paso [Orden: ${indexStr}] tiene un tiempo de inicio negativo.`,
                recommendation: 'Verifica los retardos (lags) y precedencias de dependencias.'
            });
        }
        if (step.finishTimeMs < step.startTimeMs) {
            issues.push({
                id: `step_finish_before_start_${step.id}`,
                severity: 'error',
                scope: 'step',
                stepId: step.id,
                message: `El paso [Orden: ${indexStr}] tiene un tiempo de fin menor que el inicio.`,
                recommendation: 'Verifica que la duración de este paso no sea negativa.'
            });
        }

        // Estaciones
        if (!step.stationId) {
            issues.push({
                id: `step_no_station_${step.id}`,
                severity: 'warning',
                scope: 'step',
                stepId: step.id,
                message: `El paso [Orden: ${indexStr}] no tiene estación vinculada.`,
                recommendation: 'Asocia el paso a una estación del proyecto para que compute en su ciclo.'
            });
        } else if (stations.length > 0 && !stationsSet.has(step.stationId)) {
            issues.push({
                id: `step_station_not_in_project_${step.id}`,
                severity: 'error',
                scope: 'step',
                stepId: step.id,
                message: `El paso [Orden: ${indexStr}] está asociado a una estación inexistente en el proyecto.`,
                recommendation: 'Selecciona una estación válida en el desplegable de estaciones.'
            });
        }

        // Descripciones y dispositivos
        if (!step.taskDescription || !step.taskDescription.trim()) {
            issues.push({
                id: `step_no_description_${step.id}`,
                severity: 'warning',
                scope: 'step',
                stepId: step.id,
                message: `El paso [Orden: ${indexStr}] no tiene descripción de actividad.`,
                recommendation: 'Escribe una breve descripción para identificar la operación (ej. "Clamp Retract").'
            });
        }
        if (!step.deviceType) {
            issues.push({
                id: `step_no_device_${step.id}`,
                severity: 'info',
                scope: 'step',
                stepId: step.id,
                message: `El paso [Orden: ${indexStr}] no tiene asignado el tipo de dispositivo.`,
                recommendation: 'Selecciona un dispositivo para habilitar la sugerencia automática de tiempos.'
            });
        }

        // Dependencias huerfanas o auto-referenciadas
        const deps = step.dependencyStepIds || [];
        deps.forEach(depId => {
            if (depId === step.id) {
                issues.push({
                    id: `step_self_dependency_${step.id}`,
                    severity: 'error',
                    scope: 'step',
                    stepId: step.id,
                    message: `El paso [Orden: ${indexStr}] no puede depender de sí mismo.`,
                    recommendation: 'Abre el menú de dependencias del paso y desmarca la auto-referencia.'
                });
            } else if (!stepIdsSet.has(depId)) {
                issues.push({
                    id: `step_orphan_dependency_${step.id}_${depId}`,
                    severity: 'error',
                    scope: 'step',
                    stepId: step.id,
                    message: `El paso [Orden: ${indexStr}] tiene una dependencia rota o inexistente en el estudio.`,
                    recommendation: 'Abre el selector de dependencias del paso y desmarca la precedencia inactiva.'
                });
            }
        });

        // Duración cero
        if (step.durationMs === 0) {
            issues.push({
                id: `step_zero_duration_${step.id}`,
                severity: 'warning',
                scope: 'step',
                stepId: step.id,
                message: `El paso [Orden: ${indexStr}] tiene duración de 0 ms.`,
                recommendation: 'Escribe una duración estimada o usa "Sugerir" si tiene un dispositivo asociado.'
            });
        }

        // sortOrder inválido
        if (step.sortOrder === undefined || step.sortOrder === null) {
            issues.push({
                id: `step_no_sort_order_${step.id}`,
                severity: 'warning',
                scope: 'step',
                stepId: step.id,
                message: `El paso [Orden: ${indexStr}] no tiene un número de ordenación definido.`,
                recommendation: 'El sistema corregirá el orden de forma interna al guardar.'
            });
        }
    });

    // ── 3. Ciclo de dependencias ──
    const { hasCycle, cycleStepIds } = detectDependencyCycles(activeSteps);
    if (hasCycle) {
        cycleStepIds.forEach(cycleId => {
            const cycleStep = activeSteps.find(s => s.id === cycleId);
            const cycleIdx = cycleStep ? (cycleStep.sortOrder ?? '') : '';
            issues.push({
                id: `step_dependency_cycle_${cycleId}`,
                severity: 'error',
                scope: 'step',
                stepId: cycleId,
                message: `El paso [Orden: ${cycleIdx}] forma parte de una dependencia circular (bucle de precedencias).`,
                recommendation: 'Modifica las precedencias asociadas para romper el bucle infinito.'
            });
        });
        issues.push({
            id: `study_dependency_cycle_global`,
            severity: 'error',
            scope: 'study',
            message: 'El estudio contiene una dependencia circular. Los cálculos de tiempos están bloqueados.',
            recommendation: 'Revisa y desmarca las dependencias circulares que impiden el flujo secuencial.'
        });
    }

    // ── 4. Ciclo excedido respecto al Target ──
    if (targetPPM > 0) {
        const targetMs = (60 / targetPPM) * 1000;
        const machineCycleMs = study?.machineCycleTimeMs || 0;
        if (machineCycleMs > targetMs && machineCycleMs > 0) {
            issues.push({
                id: 'study_cycle_time_exceeds_target',
                severity: 'warning',
                scope: 'study',
                message: `El ciclo estimado de máquina (${Math.round(machineCycleMs)} ms) excede el target (${Math.round(targetMs)} ms).`,
                recommendation: 'Optimiza los tiempos de ciclo de la estación cuello de botella o reestructura el paralelismo.'
            });
        }
    }

    // ── 5. Estaciones del proyecto sin ningún paso de secuencia ──
    if (stations.length > 0) {
        const usedStations = new Set(activeSteps.map(s => s.stationId).filter(Boolean));
        stations.forEach(stn => {
            if (!usedStations.has(stn.id)) {
                const stnPad = String(stn.stn || '').padStart(2, '0');
                const label = stations.some(s => s.indx > 1) ? `${stn.indx || 1}-STN${stnPad}` : `STN${stnPad}`;
                issues.push({
                    id: `station_no_steps_${stn.id}`,
                    severity: 'info',
                    scope: 'station',
                    stationId: stn.id,
                    message: `La estación [${label}] no tiene ningún paso de secuencia configurado en este estudio.`,
                    recommendation: 'Agrega pasos para esta estación si forma parte del ciclo secuencial de la máquina.'
                });
            }
        });
    }

    // Clasificación y conteo de issues
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    return {
        isValid: errorCount === 0,
        errorCount,
        warningCount,
        infoCount,
        issues
    };
}
