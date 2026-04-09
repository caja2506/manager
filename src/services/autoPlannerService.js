/**
 * Auto-Planner Service
 * ====================
 * Intelligent task scheduling algorithm that distributes tasks
 * into weekly planner blocks based on priority, availability,
 * and configurable distribution modes.
 *
 * ARCHITECTURE:
 *   - Pure calculation service (no Firestore writes)
 *   - Returns planItem data ready for plannerService.createPlanItem()
 *   - Respects break bands from breakTimeUtils
 *   - Permission-aware (role-based access)
 *
 * DISTRIBUTION MODES:
 *   - front-loaded (default): fill earliest days first
 *   - uniform: split equally across all working days
 */

import { getBreakBands } from '../utils/breakTimeUtils';

// ── Constants ──────────────────────────────────────────────────
const WORK_START = 8;     // 8:00 AM
const WORK_END = 17;      // 5:00 PM
const OVERTIME_START = 17; // 5:00 PM
const OVERTIME_END = 19;   // 7:00 PM
const DEFAULT_HOURS_PER_DAY = 1;
const DEFAULT_SPREAD_DAYS = 5;
const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];

// ── Permission Check ───────────────────────────────────────────

/**
 * Check if a user can auto-schedule tasks for a target user.
 *
 * @param {string} currentTeamRole — 'manager' | 'team_lead' | 'engineer' | 'technician'
 * @param {string} currentUserId
 * @param {string} targetUserId
 * @param {Array}  [supervisorAssignments] — resource assignments for engineer→technician
 * @returns {boolean}
 */
export function canAutoScheduleFor(currentTeamRole, currentUserId, targetUserId, supervisorAssignments = []) {
    // Manager & Team Lead can plan for anyone
    if (['manager', 'team_lead'].includes(currentTeamRole)) return true;

    // Engineer can plan for their assigned technicians
    if (currentTeamRole === 'engineer') {
        return supervisorAssignments.some(a =>
            (a.engineerId === currentUserId || a.supervisorId === currentUserId)
            && (a.technicianId === targetUserId || a.userId === targetUserId)
        );
    }

    // Technician: no access
    return false;
}


// ── Strategy Detection ─────────────────────────────────────────

/**
 * Determine the scheduling strategy based on available task data.
 *
 * @param {Object} task
 * @returns {{ strategy: string, message: string, startDate: Date|null, endDate: Date|null, hours: number }}
 */
export function determineStrategy(task) {
    const hasStart = !!task.plannedStartDate;
    const hasEnd = !!task.plannedEndDate;
    const hasHours = task.estimatedHours > 0;
    const hours = task.estimatedHours || 0;

    const parseDate = (d) => d ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')) : null;
    const startDate = parseDate(task.plannedStartDate);
    const endDate = parseDate(task.plannedEndDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (hasStart && hasEnd && hasHours) {
        return {
            strategy: 'full',
            message: `${hours}h planificadas en rango ${_fmtDate(startDate)}–${_fmtDate(endDate)}`,
            startDate, endDate, hours,
        };
    }

    if (hasStart && !hasEnd && hasHours) {
        return {
            strategy: 'no_end',
            message: `Sin fecha fin — desde ${_fmtDate(startDate)} hasta agotar ${hours}h`,
            startDate, endDate: null, hours,
        };
    }

    if (hasStart && hasEnd && !hasHours) {
        const days = getWorkingDays(startDate, endDate).length;
        const defaultHours = days * DEFAULT_HOURS_PER_DAY;
        return {
            strategy: 'no_hours',
            message: `Sin horas estimadas — ${DEFAULT_HOURS_PER_DAY}h/día × ${days} días = ${defaultHours}h`,
            startDate, endDate, hours: defaultHours,
        };
    }

    if (!hasStart && !hasEnd && hasHours) {
        return {
            strategy: 'only_hours',
            message: `Sin fechas — desde hoy hasta agotar ${hours}h`,
            startDate: today, endDate: null, hours,
        };
    }

    if (hasStart && !hasEnd && !hasHours) {
        return {
            strategy: 'only_start',
            message: `Sin horas ni fecha fin — ${DEFAULT_HOURS_PER_DAY}h/día por ${DEFAULT_SPREAD_DAYS} días`,
            startDate, endDate: null, hours: DEFAULT_SPREAD_DAYS * DEFAULT_HOURS_PER_DAY,
        };
    }

    return {
        strategy: 'not_plannable',
        message: '⚠ Necesita al menos fecha de inicio u horas estimadas',
        startDate: null, endDate: null, hours: 0,
    };
}


// ── Working Days & Slots ───────────────────────────────────────

/**
 * Get all working days (Mon-Fri) between two dates inclusive.
 * If endDate is null, generates up to maxDays working days.
 *
 * @param {Date} startDate
 * @param {Date} [endDate]
 * @param {number} [maxDays=60]
 * @returns {Date[]}
 */
export function getWorkingDays(startDate, endDate, maxDays = 60) {
    const days = [];
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);

    const limit = endDate ? new Date(endDate) : null;
    if (limit) limit.setHours(23, 59, 59, 999);

    let count = 0;
    while (count < maxDays) {
        const dow = cursor.getDay();
        if (dow >= 1 && dow <= 5) { // Mon-Fri
            days.push(new Date(cursor));
            count++;
        }
        if (limit && cursor >= limit) break;
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
}

/**
 * Get the net working slots for a given date, minus break bands.
 * Returns an array of { start, end, hours } in decimal hours.
 *
 * @param {Array} [breakBands] — from getBreakBands()
 * @returns {Array<{ start: number, end: number, hours: number }>}
 */
export function getWorkingSlots(breakBands = null) {
    const bands = breakBands || getBreakBands();

    // Start with the full work window
    let slots = [{ start: WORK_START, end: WORK_END }];

    // Cut each break band out of the slots
    for (const br of bands) {
        const newSlots = [];
        for (const slot of slots) {
            // Break doesn't overlap this slot
            if (br.end <= slot.start || br.start >= slot.end) {
                newSlots.push(slot);
                continue;
            }
            // Left fragment
            if (br.start > slot.start) {
                newSlots.push({ start: slot.start, end: br.start });
            }
            // Right fragment
            if (br.end < slot.end) {
                newSlots.push({ start: br.end, end: slot.end });
            }
        }
        slots = newSlots;
    }

    return slots.map(s => ({
        start: s.start,
        end: s.end,
        hours: parseFloat((s.end - s.start).toFixed(2)),
    }));
}

/**
 * Get available time slots for a user on a specific date,
 * subtracting existing plan items.
 *
 * @param {string} dateStr — 'YYYY-MM-DD'
 * @param {Array}  existingItems — all weeklyPlanItems for the relevant period
 * @param {string} userId — the assignedTo user
 * @param {Array}  [breakBands]
 * @returns {Array<{ start: number, end: number, hours: number }>}
 */
export function getAvailableSlots(dateStr, existingItems, userId, breakBands = null) {
    // Start with net working slots (after breaks)
    let slots = getWorkingSlots(breakBands);

    // Find existing blocks for this user on this date
    const userBlocks = existingItems.filter(item =>
        item.assignedTo === userId && item.date === dateStr
    );

    // Convert existing blocks to decimal ranges
    const occupied = userBlocks.map(item => {
        const start = new Date(item.startDateTime);
        const end = new Date(item.endDateTime);
        return {
            start: start.getHours() + start.getMinutes() / 60,
            end: end.getHours() + end.getMinutes() / 60,
        };
    }).sort((a, b) => a.start - b.start);

    // Subtract occupied ranges from available slots
    for (const occ of occupied) {
        const newSlots = [];
        for (const slot of slots) {
            if (occ.end <= slot.start || occ.start >= slot.end) {
                newSlots.push(slot);
                continue;
            }
            if (occ.start > slot.start) {
                newSlots.push({ start: slot.start, end: occ.start });
            }
            if (occ.end < slot.end) {
                newSlots.push({ start: occ.end, end: slot.end });
            }
        }
        slots = newSlots;
    }

    return slots
        .filter(s => s.end - s.start > 0.08) // ignore <5 min fragments
        .map(s => ({
            start: s.start,
            end: s.end,
            hours: parseFloat((s.end - s.start).toFixed(2)),
        }));
}

/**
 * Get total available hours for a user on a date.
 */
export function getAvailableHoursForDay(dateStr, existingItems, userId, breakBands = null) {
    return getAvailableSlots(dateStr, existingItems, userId, breakBands)
        .reduce((sum, s) => sum + s.hours, 0);
}


// ── Single Task Scheduler ──────────────────────────────────────

/**
 * Auto-schedule a single task into planner blocks.
 *
 * @param {Object} task — task document with id, title, assignedTo, projectId, etc.
 * @param {Array}  existingPlanItems — existing weeklyPlanItems
 * @param {Object} [options]
 * @param {string} [options.mode='front-loaded'] — 'front-loaded' | 'uniform'
 * @param {string} [options.createdBy] — uid of the person executing the auto-plan
 * @param {Array}  [options.breakBands]
 * @param {Object} [options.projectColorMap] — { projectId: colorKey }
 * @param {Array}  [options.projects] — for snapshot fields
 * @param {Array}  [options.teamMembers] — for snapshot fields
 * @returns {{ blocks: Object[], warnings: string[], strategy: Object }}
 */
export function autoScheduleTask(task, existingPlanItems, options = {}) {
    const {
        mode = 'front-loaded',
        createdBy = null,
        breakBands = null,
        projectColorMap = {},
        projects = [],
        teamMembers = [],
    } = options;

    const strategy = determineStrategy(task);

    // Not plannable
    if (strategy.strategy === 'not_plannable') {
        return { blocks: [], warnings: [strategy.message], strategy };
    }

    const warnings = [strategy.message];
    const userId = task.assignedTo;
    if (!userId) {
        return { blocks: [], warnings: ['⚠ Tarea sin assignedTo — no se puede planificar'], strategy };
    }

    // Generate working days
    const workDays = getWorkingDays(strategy.startDate, strategy.endDate);
    if (workDays.length === 0) {
        return { blocks: [], warnings: ['⚠ No hay días hábiles en el rango'], strategy };
    }

    // Calculate already-planned hours for this task
    const alreadyPlanned = existingPlanItems
        .filter(pi => pi.taskId === task.id)
        .reduce((sum, pi) => sum + (pi.plannedHours || 0), 0);

    const remainingHours = Math.max(0, strategy.hours - alreadyPlanned);
    if (remainingHours <= 0) {
        return { blocks: [], warnings: ['✅ Tarea ya está 100% planificada'], strategy };
    }

    // Build a mutable copy of existing items (to track as we allocate)
    const mutableExisting = [...existingPlanItems];
    const blocks = [];

    if (mode === 'uniform') {
        _distributeUniform(task, workDays, remainingHours, mutableExisting, blocks, {
            userId, createdBy, breakBands, projectColorMap, projects, teamMembers,
        });
    } else {
        _distributeFrontLoaded(task, workDays, remainingHours, mutableExisting, blocks, {
            userId, createdBy, breakBands, projectColorMap, projects, teamMembers,
        });
    }

    const totalAllocated = blocks.reduce((s, b) => s + b.plannedHours, 0);
    const overtime = [];

    if (totalAllocated < remainingHours - 0.01) {
        const deficit = remainingHours - totalAllocated;

        // Determine deadline for overtime decision
        const deadline = _getDeadline(task);

        if (deadline) {
            // Check if the last block goes beyond the deadline
            const lastBlock = blocks[blocks.length - 1];
            const lastBlockDate = lastBlock ? new Date(lastBlock.date + 'T00:00:00') : strategy.startDate;

            if (lastBlockDate >= deadline || totalAllocated < remainingHours - 0.01) {
                // Generate overtime suggestions
                const overtimeBlocks = _generateOvertimeBlocks(
                    task, workDays, deficit, existingPlanItems, {
                        ...{ userId, createdBy, breakBands, projectColorMap, projects, teamMembers },
                    }
                );
                overtime.push(...overtimeBlocks);

                const overtimeHours = overtimeBlocks.reduce((s, b) => s + b.plannedHours, 0);
                warnings.push(
                    `⏱ No alcanzan las horas regulares antes del deadline (${_fmtDate(deadline)}). ` +
                    `Se necesitan ${deficit.toFixed(1)}h extras. ` +
                    `Se sugieren ${overtimeHours.toFixed(1)}h de overtime.`
                );
            }
        } else {
            // No deadline — just warn about deficit, no overtime
            warnings.push(`⚠ Solo se pudieron asignar ${totalAllocated.toFixed(1)}h de ${remainingHours.toFixed(1)}h — faltan ${deficit.toFixed(1)}h de disponibilidad (sin deadline, no se sugiere overtime)`);
        }
    }

    return { blocks, warnings, strategy, overtime };
}


// ── Batch Scheduler ────────────────────────────────────────────

/**
 * Auto-schedule multiple tasks, ordered by priority.
 * Higher priority tasks get the best slots first.
 *
 * @param {Array}  tasks — array of task documents
 * @param {Array}  existingPlanItems
 * @param {Object} [options] — same as autoScheduleTask options
 * @returns {{ results: Array<{ task, blocks, warnings, strategy }>, globalWarnings: string[] }}
 */
export function autoScheduleAll(tasks, existingPlanItems, options = {}) {
    // Sort by priority (critical first)
    const sorted = [...tasks].sort((a, b) => {
        const ai = PRIORITY_ORDER.indexOf(a.priority || 'medium');
        const bi = PRIORITY_ORDER.indexOf(b.priority || 'medium');
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const globalWarnings = [];
    const results = [];
    const mutableExisting = [...existingPlanItems];

    for (const task of sorted) {
        const result = autoScheduleTask(task, mutableExisting, options);
        results.push({ task, ...result });

        // Add generated blocks to mutableExisting so next tasks see them as occupied
        for (const block of result.blocks) {
            mutableExisting.push(block);
        }
    }

    const totalBlocks = results.reduce((s, r) => s + r.blocks.length, 0);
    const notPlannable = results.filter(r => r.strategy.strategy === 'not_plannable');

    if (notPlannable.length > 0) {
        globalWarnings.push(`⚠ ${notPlannable.length} tarea(s) sin datos suficientes para planificar`);
    }

    globalWarnings.push(`📊 ${totalBlocks} bloques generados para ${results.length - notPlannable.length} tarea(s)`);

    return { results, globalWarnings };
}


// ── Internal Distribution Functions ────────────────────────────

function _distributeFrontLoaded(task, workDays, totalHours, existingItems, blocks, ctx) {
    let remaining = totalHours;

    for (const day of workDays) {
        if (remaining <= 0.01) break;

        const dateStr = _dateToStr(day);
        const slots = getAvailableSlots(dateStr, existingItems, ctx.userId, ctx.breakBands);

        for (const slot of slots) {
            if (remaining <= 0.01) break;

            const allocate = Math.min(slot.hours, remaining);
            if (allocate < 0.08) continue; // skip <5 min

            const block = _createBlock(task, dateStr, day, slot.start, allocate, ctx);
            blocks.push(block);
            existingItems.push(block); // mark as occupied for subsequent slots
            remaining -= allocate;
        }
    }
}

function _distributeUniform(task, workDays, totalHours, existingItems, blocks, ctx) {
    const hoursPerDay = totalHours / workDays.length;
    let carryOver = 0;

    for (const day of workDays) {
        const targetHours = hoursPerDay + carryOver;
        const dateStr = _dateToStr(day);
        const slots = getAvailableSlots(dateStr, existingItems, ctx.userId, ctx.breakBands);

        let allocated = 0;
        for (const slot of slots) {
            const needed = targetHours - allocated;
            if (needed <= 0.01) break;

            const allocate = Math.min(slot.hours, needed);
            if (allocate < 0.08) continue;

            const block = _createBlock(task, dateStr, day, slot.start, allocate, ctx);
            blocks.push(block);
            existingItems.push(block);
            allocated += allocate;
        }

        carryOver = targetHours - allocated; // carry unallocated to next day
    }
}


// ── Block Factory ──────────────────────────────────────────────

function _createBlock(task, dateStr, dayDate, slotStartDecimal, hours, ctx) {
    const startHour = Math.floor(slotStartDecimal);
    const startMin = Math.round((slotStartDecimal - startHour) * 60);
    const endDecimal = slotStartDecimal + hours;
    const endHour = Math.floor(endDecimal);
    const endMin = Math.round((endDecimal - endHour) * 60);

    const startDt = new Date(`${dateStr}T${_pad(startHour)}:${_pad(startMin)}:00`);
    const endDt = new Date(`${dateStr}T${_pad(endHour)}:${_pad(endMin)}:00`);

    // Calculate weekStartDate (Monday of the week)
    const weekStart = _getMonday(dayDate);

    const project = ctx.projects?.find(p => p.id === task.projectId);
    const member = ctx.teamMembers?.find(m => m.uid === ctx.userId);

    return {
        // ── Required scheduling fields ──
        taskId: task.id,
        weekStartDate: _dateToStr(weekStart),
        date: dateStr,
        dayOfWeek: dayDate.getDay(),
        startDateTime: startDt.toISOString(),
        endDateTime: endDt.toISOString(),
        plannedHours: parseFloat(hours.toFixed(2)),
        createdBy: ctx.createdBy,

        // ── Filtering fields ──
        assignedTo: ctx.userId,
        projectId: task.projectId,

        // ── Snapshot fields (transitional) ──
        taskTitleSnapshot: task.title || '',
        projectNameSnapshot: project?.name || '',
        assignedToName: member?.displayName || member?.email || '',
        statusSnapshot: task.status || 'pending',
        priority: task.priority || 'medium',
        colorKey: ctx.projectColorMap?.[task.projectId] || 'indigo',

        // ── Auto-planner metadata ──
        _autoPlanned: true,
        _autoPlannedAt: new Date().toISOString(),
    };
}


// ── Helpers ────────────────────────────────────────────────────

function _dateToStr(d) {
    return `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`;
}

function _pad(n) {
    return String(n).padStart(2, '0');
}

function _getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
}

function _fmtDate(d) {
    if (!d) return '?';
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${d.getDate()}-${months[d.getMonth()]}`;
}

/**
 * Get the effective deadline for overtime decisions.
 * Priority: task.dueDate > task.plannedEndDate
 */
function _getDeadline(task) {
    const parse = (d) => d ? new Date(d + (typeof d === 'string' && !d.includes('T') ? 'T23:59:59' : '')) : null;
    return parse(task.dueDate) || parse(task.plannedEndDate) || null;
}

/**
 * Generate overtime blocks (OVERTIME_START to OVERTIME_END) for days
 * that are within the deadline range.
 */
function _generateOvertimeBlocks(task, workDays, deficitHours, existingItems, ctx) {
    const blocks = [];
    let remaining = deficitHours;

    for (const day of workDays) {
        if (remaining <= 0.01) break;

        const dateStr = _dateToStr(day);
        const overtimeHours = OVERTIME_END - OVERTIME_START; // 2h max
        const allocate = Math.min(overtimeHours, remaining);

        if (allocate < 0.08) continue;

        const block = _createBlock(task, dateStr, day, OVERTIME_START, allocate, ctx);
        block._isOvertime = true; // flag for UI
        blocks.push(block);
        remaining -= allocate;
    }

    return blocks;
}
