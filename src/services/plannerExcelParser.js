import * as XLSX from 'xlsx';

/**
 * Convierte un número de fecha serial de Excel a una cadena de fecha YYYY-MM-DD en hora local.
 */
export function excelDateToISO(val) {
    if (val === undefined || val === null || val === '') return null;
    
    if (typeof val === 'string') {
        const cleaned = val.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
        if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) return cleaned.substring(0, 10);
        
        const dateParsed = Date.parse(cleaned);
        if (!isNaN(dateParsed)) {
            const d = new Date(dateParsed);
            return toLocalISOString(d);
        }
        
        const num = parseFloat(cleaned);
        if (!isNaN(num)) {
            return serialToISO(num);
        }
        
        return null;
    }
    
    if (typeof val === 'number') {
        return serialToISO(val);
    }
    
    if (val instanceof Date) {
        return toLocalISOString(val);
    }
    
    return null;
}

function serialToISO(serial) {
    if (serial < 1.0) return null;
    const date = new Date((serial - 25569) * 86400 * 1000);
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() + offset);
    return toLocalISOString(localDate);
}

function toLocalISOString(date) {
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

export function normalizeName(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function getSimilarity(str1, str2) {
    const s1 = normalizeName(str1);
    const s2 = normalizeName(str2);
    
    if (s1 === s2) return 1.0;
    if (s1.length < 2 || s2.length < 2) return 0.0;
    
    const getBigrams = (str) => {
        const bigrams = new Set();
        for (let i = 0; i < str.length - 1; i++) {
            bigrams.add(str.substring(i, i + 2));
        }
        return bigrams;
    };
    
    const b1 = getBigrams(s1);
    const b2 = getBigrams(s2);
    
    let intersection = 0;
    for (const bigram of b1) {
        if (b2.has(bigram)) intersection++;
    }
    
    return (2.0 * intersection) / (b1.size + b2.size);
}

export function matchUser(assignedName, teamMembers, threshold = 0.75) {
    if (!assignedName || typeof assignedName !== 'string' || !assignedName.trim()) return null;
    
    let bestMatch = null;
    let maxSim = 0.0;
    
    teamMembers.forEach(user => {
        const name1 = user.displayName || user.name || '';
        const name2 = user.email ? user.email.split('@')[0] : '';
        
        const sim1 = getSimilarity(assignedName, name1);
        const sim2 = getSimilarity(assignedName, name2);
        
        const bestUserSim = Math.max(sim1, sim2);
        
        if (bestUserSim > maxSim) {
            maxSim = bestUserSim;
            bestMatch = user;
        }
    });
    
    if (maxSim >= threshold) {
        return {
            user: bestMatch,
            similarity: maxSim
        };
    }
    
    return null;
}

export function parseDependsOn(dependsOnStr) {
    if (!dependsOnStr || typeof dependsOnStr !== 'string' || !dependsOnStr.trim()) return [];
    
    const parts = dependsOnStr.split(',');
    const deps = [];
    
    parts.forEach(part => {
        const cleaned = part.trim().toUpperCase();
        if (!cleaned) return;
        
        const match = cleaned.match(/^(\d+)([F|S]{2})?(?:[+-](\d+))?$/);
        if (match) {
            const predecessorTaskNumber = parseInt(match[1], 10);
            const type = match[2] || 'FS';
            let lagHours = 0;
            if (match[3]) {
                const isNegative = cleaned.includes('-');
                lagHours = parseInt(match[3], 10) * (isNegative ? -24 : 24);
            }
            deps.push({ predecessorTaskNumber, type, lagHours });
        }
    });
    
    return deps;
}

export function parseEffortToHours(effortVal) {
    if (effortVal === undefined || effortVal === null || effortVal === '') return null;
    if (typeof effortVal === 'number') return effortVal;
    
    const cleaned = String(effortVal).toLowerCase().trim();
    if (!cleaned) return null;
    
    const hourMatch = cleaned.match(/^([\d.]+)\s*(?:hour|hr|h|hora)s?$/);
    if (hourMatch) return parseFloat(hourMatch[1]);
    
    const dayMatch = cleaned.match(/^([\d.]+)\s*(?:day|d|dia)s?$/);
    if (dayMatch) return parseFloat(dayMatch[1]) * 8;
    
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
    
}

/**
 * Busca si una tarea del Excel ya existe en Supabase usando similitud >= 75%.
 */
export function matchExistingTask(excelTaskName, existingTasks, threshold = 0.75) {
    if (!excelTaskName) return null;
    let bestMatch = null;
    let maxSim = 0.0;
    
    existingTasks.forEach(t => {
        const title = t.title || '';
        const sim = getSimilarity(excelTaskName, title);
        if (sim > maxSim) {
            maxSim = sim;
            bestMatch = t;
        }
    });
    
    if (maxSim >= threshold) {
        return bestMatch;
    }
    return null;
}

/**
 * Busca si un milestone del Excel ya existe en Supabase usando similitud >= 75%.
 */
export function matchExistingMilestone(excelMilestoneName, existingMilestones, threshold = 0.75) {
    if (!excelMilestoneName) return null;
    let bestMatch = null;
    let maxSim = 0.0;
    
    existingMilestones.forEach(m => {
        const name = m.name || '';
        const sim = getSimilarity(excelMilestoneName, name);
        if (sim > maxSim) {
            maxSim = sim;
            bestMatch = m;
        }
    });
    
    if (maxSim >= threshold) {
        return bestMatch;
    }
    return null;
}

/**
 * Procesa el archivo Excel de Planner y clasifica los items en Milestones, Tareas y Subtareas
 * según los niveles del WBS en 'Outline number'.
 */
export function parsePlannerExcel(arrayBuffer, existingTasks, teamMembers, existingMilestones = []) {
    const workbook = XLSX.read(arrayBuffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 9) {
        throw new Error('El archivo no tiene el formato de Planner estructurado válido (menos de 9 filas).');
    }
    
    const projectHeader = jsonData[0];
    const projectName = projectHeader && projectHeader[0]?.toLowerCase().includes('project') ? projectHeader[1] : 'Proyecto importado';
    
    let projectStartDate = null;
    let projectFinishDate = null;

    for (let r = 0; r < 8; r++) {
        const row = jsonData[r];
        if (!row || row.length < 2) continue;
        const col0 = String(row[0] || '').toLowerCase();
        if (col0.includes('start date')) {
            projectStartDate = excelDateToISO(row[1]);
        } else if (col0.includes('finish date')) {
            projectFinishDate = excelDateToISO(row[1]);
        }
    }
    
    const headers = jsonData[8]?.map(h => String(h || '').trim());
    if (!headers || !headers.includes('Task number') || !headers.includes('Name')) {
        throw new Error('No se encontró la fila de cabeceras en la fila 9 o faltan columnas esenciales.');
    }
    
    const getIndex = (name) => headers.indexOf(name);
    const idxTaskNum = getIndex('Task number');
    const idxOutline = getIndex('Outline number');
    const idxPctComplete = getIndex('% complete');
    const idxName = getIndex('Name');
    const idxDependsOn = getIndex('Depends on');
    const idxAssignedTo = getIndex('Assigned to');
    const idxStart = getIndex('Start');
    const idxFinish = getIndex('Finish');
    const idxMilestone = getIndex('Milestone');
    const idxNotes = getIndex('Notes');
    const idxEffort = getIndex('Effort');
    const idxPriority = getIndex('Priority');
    
    const rawMilestones = [];
    const rawTasks = [];
    const rawSubtasks = [];
    const userMappingsSet = new Map();
    
    // 1. PRIMERA PASADA: Analizar filas y clasificar por nivel jerárquico
    for (let i = 9; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0 || row[idxTaskNum] === undefined || row[idxTaskNum] === '') continue;
        
        const taskNum = parseInt(row[idxTaskNum], 10);
        const name = String(row[idxName] || '').trim();
        if (!name) continue;
        
        const outlineNumber = String(row[idxOutline] || '').trim();
        const outlineParts = outlineNumber.split('.').filter(Boolean);
        const level = outlineParts.length;
        
        // Mapear asignado si existe
        const rawAssigned = row[idxAssignedTo] ? String(row[idxAssignedTo]).trim() : '';
        let mappedUser = null;
        let simScore = 0;
        
        if (rawAssigned) {
            const match = matchUser(rawAssigned, teamMembers);
            if (match) {
                mappedUser = match.user;
                simScore = match.similarity;
            }
            userMappingsSet.set(rawAssigned, {
                excelName: rawAssigned,
                mappedUserId: mappedUser?.id || null,
                mappedUserName: mappedUser?.displayName || mappedUser?.email || null,
                similarity: simScore,
                matched: !!mappedUser
            });
        }
        
        const dependsOnRaw = row[idxDependsOn] ? String(row[idxDependsOn]).trim() : '';
        const parsedDependencies = parseDependsOn(dependsOnRaw);
        
        const parsedItem = {
            taskNumber: taskNum,
            outlineNumber: outlineNumber,
            name: name,
            percentComplete: row[idxPctComplete] !== undefined ? parseFloat(row[idxPctComplete]) : 0,
            assignedNameRaw: rawAssigned,
            assignedUserId: mappedUser?.id || null,
            assignedUserName: mappedUser?.displayName || null,
            plannedStartDate: excelDateToISO(row[idxStart]),
            plannedEndDate: excelDateToISO(row[idxFinish]),
            milestoneColumn: String(row[idxMilestone] || '').toLowerCase() === 'yes',
            notes: row[idxNotes] ? String(row[idxNotes]).trim() : '',
            estimatedHours: parseEffortToHours(row[idxEffort]),
            priority: normalizePriority(row[idxPriority]),
            rawDependsOn: dependsOnRaw,
            dependencies: parsedDependencies
        };
        
        if (level === 1) {
            // Nivel 1 (ej. "1"): Milestone
            rawMilestones.push(parsedItem);
        } else if (level === 2) {
            // Nivel 2 (ej. "1.1"): Tarea
            const parentOutline = outlineParts[0]; // ej. "1"
            parsedItem.parentOutlineNumber = parentOutline;
            rawTasks.push(parsedItem);
        } else if (level >= 3) {
            // Nivel 3+ (ej. "1.1.1"): Subtarea
            const parentOutline = outlineParts.slice(0, 2).join('.'); // ej. "1.1"
            parsedItem.parentOutlineNumber = parentOutline;
            rawSubtasks.push(parsedItem);
        }
    }
    
    // 2. SEGUNDA PASADA: Comparar hitos (Milestones) con los existentes en la base de datos usando similitud >= 75%
    const milestonesToCreate = [];
    const milestonesToUpdate = [];
    
    rawMilestones.forEach(m => {
        const existing = matchExistingMilestone(m.name, existingMilestones, 0.75);
        if (existing) {
            milestonesToUpdate.push({ ...m, id: existing.id });
        } else {
            milestonesToCreate.push(m);
        }
    });
    
    // 3. TERCERA PASADA: Clasificar Tareas (Crear vs Actualizar) usando similitud >= 75%
    const tasksToCreate = [];
    const tasksToUpdate = [];
    
    rawTasks.forEach(t => {
        const existing = matchExistingTask(t.name, existingTasks, 0.75);
        if (existing) {
            tasksToUpdate.push({
                ...t,
                id: existing.id,
                existingStatus: existing.status,
                existingPercentComplete: existing.percentComplete
            });
        } else {
            tasksToCreate.push(t);
        }
    });
    
    return {
        projectName,
        projectStartDate,
        projectFinishDate,
        stats: {
            totalExcel: rawMilestones.length + rawTasks.length + rawSubtasks.length,
            totalMilestones: rawMilestones.length,
            totalNewMilestones: milestonesToCreate.length,
            totalTasks: rawTasks.length,
            totalNewTasks: tasksToCreate.length,
            totalUpdateTasks: tasksToUpdate.length,
            totalSubtasks: rawSubtasks.length
        },
        milestonesToCreate,
        milestonesToUpdate,
        tasksToCreate,
        tasksToUpdate,
        subtasksToCreate: rawSubtasks, // Las subtareas las listamos y las creamos si no existen
        userMappings: Array.from(userMappingsSet.values()),
        rawMilestones,
        rawTasks,
        rawSubtasks
    };
}

function normalizePriority(priVal) {
    if (!priVal) return 'medium';
    const p = String(priVal).toLowerCase().trim();
    if (p.includes('high') || p.includes('alta') || p.includes('urgente')) return 'high';
    if (p.includes('low') || p.includes('baja')) return 'low';
    return 'medium';
}
