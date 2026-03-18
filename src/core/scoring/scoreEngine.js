/**
 * Score Engine — V5 Phase 3
 * ===========================
 * Pure-function engine for computing area scores, milestone scores,
 * penalties, logical locks, traffic lights, and explainability.
 *
 * ALL functions are PURE — no Firestore reads/writes.
 * This module is the single source of truth for scoring logic.
 *
 * @module core/scoring/scoreEngine
 */

import {
    TASK_STATUS,
    TRAFFIC_LIGHT,
    SCORE_LOCK_REASON,
} from '../../models/schemas.js';

// ============================================================
// SCORING FACTORS — WEIGHTS & DEFINITIONS
// ============================================================

/**
 * Factor weights (must sum to 100).
 * Configurable — stored here as defaults, overridable via settings.
 */
export const FACTOR_WEIGHTS = {
    TASK_COMPLETION: 30,    // F1: % critical tasks completed
    RECENT_ACTIVITY: 15,    // F2: Tasks updated within window
    BLOCKER_RESOLUTION: 20, // F3: Absence of blocked tasks
    SCHEDULE_HEALTH: 20,    // F4: Time remaining vs. progress
    CONSISTENCY: 10,        // F5: Status matches real progress
    ISSUE_RESOLUTION: 5,    // F6: Delays/risks resolved
};

/**
 * Penalty definitions — point deductions for critical events.
 */
export const PENALTIES = {
    CRITICAL_OVERDUE_3D: { key: 'critical_overdue_3d', deduction: -15, label: 'Tarea crítica vencida >3 días' },
    STALE_AREA_5D:       { key: 'stale_area_5d',       deduction: -10, label: 'Área sin actualización >5 días' },
    DEADLINE_CRISIS:     { key: 'deadline_crisis',     deduction: -20, label: 'Cercanía extrema de fecha con bajo avance' },
    EXCESSIVE_BLOCKERS:  { key: 'excessive_blockers',  deduction: -10, label: '>30% de tareas bloqueadas' },
};

/**
 * Activity window in days for "recent activity" factor.
 */
const ACTIVITY_WINDOW_DAYS = 5;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function daysBetween(dateA, dateB) {
    const a = dateA instanceof Date ? dateA : new Date(dateA);
    const b = dateB instanceof Date ? dateB : new Date(dateB);
    return (b - a) / (1000 * 60 * 60 * 24);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Sigmoid curve for schedule health.
 * Returns 0-1 where:
 *   1.0 = plenty of time or completed
 *   0.5 = at expected pace
 *   0.0 = past deadline with no completion
 */
function scheduleHealthSigmoid(daysRemaining, percentIncomplete) {
    if (percentIncomplete <= 0) return 1.0; // All done
    if (daysRemaining <= 0) return 0.0; // Past deadline

    // Ratio: how much time per remaining % of work
    // If ratio >= 1, we're on pace or ahead
    const totalDays = Math.max(daysRemaining / Math.max(0.01, percentIncomplete), 1);
    const ratio = daysRemaining / totalDays;

    // Smooth sigmoid: maps ratio to 0-1
    const k = 5; // steepness
    return 1 / (1 + Math.exp(-k * (ratio - 0.5)));
}

function isTerminal(status) {
    return status === TASK_STATUS.COMPLETED || status === TASK_STATUS.CANCELLED;
}

function isActive(task) {
    return !isTerminal(task.status);
}

// ============================================================
// FACTOR COMPUTATIONS (each returns 0.0 – 1.0)
// ============================================================

/**
 * F1: Task Completion — % of non-cancelled tasks completed.
 */
export function factorTaskCompletion(tasks) {
    const active = tasks.filter(t => t.status !== TASK_STATUS.CANCELLED);
    if (active.length === 0) return { ratio: 1.0, detail: 'Sin tareas activas' };

    const completed = active.filter(t => t.status === TASK_STATUS.COMPLETED).length;
    const ratio = completed / active.length;
    return {
        ratio,
        detail: `${completed}/${active.length} completadas (${Math.round(ratio * 100)}%)`,
    };
}

/**
 * F2: Recent Activity — % of active tasks updated within window.
 */
export function factorRecentActivity(tasks, now = new Date()) {
    const active = tasks.filter(isActive);
    if (active.length === 0) return { ratio: 1.0, detail: 'Sin tareas activas' };

    const cutoff = new Date(now.getTime() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recent = active.filter(t => {
        const updated = t.updatedAt ? new Date(t.updatedAt) : null;
        return updated && updated >= cutoff;
    }).length;

    const ratio = recent / active.length;
    return {
        ratio,
        detail: `${recent}/${active.length} actualizadas en últimos ${ACTIVITY_WINDOW_DAYS} días`,
    };
}

/**
 * F3: Blocker Resolution — absence of blocked tasks.
 */
export function factorBlockerResolution(tasks) {
    const active = tasks.filter(isActive);
    if (active.length === 0) return { ratio: 1.0, detail: 'Sin tareas activas' };

    const blocked = active.filter(t => t.status === TASK_STATUS.BLOCKED).length;
    const ratio = (active.length - blocked) / active.length;
    return {
        ratio,
        detail: blocked === 0
            ? 'Sin bloqueos activos'
            : `${blocked} tarea(s) bloqueada(s) de ${active.length}`,
    };
}

/**
 * F4: Schedule Health — days remaining vs. percent incomplete.
 */
export function factorScheduleHealth(tasks, milestoneDueDate, now = new Date()) {
    if (!milestoneDueDate) return { ratio: 0.5, detail: 'Sin fecha de milestone definida' };

    const active = tasks.filter(t => t.status !== TASK_STATUS.CANCELLED);
    if (active.length === 0) return { ratio: 1.0, detail: 'Sin tareas activas' };

    const completed = active.filter(t => t.status === TASK_STATUS.COMPLETED).length;
    const percentIncomplete = 1 - (completed / active.length);
    const daysRemaining = daysBetween(now, new Date(milestoneDueDate));

    const ratio = scheduleHealthSigmoid(daysRemaining, percentIncomplete);
    const daysLabel = daysRemaining > 0
        ? `${Math.round(daysRemaining)} días restantes`
        : `${Math.abs(Math.round(daysRemaining))} días vencido`;

    return {
        ratio,
        detail: `${daysLabel}, ${Math.round(percentIncomplete * 100)}% pendiente`,
    };
}

/**
 * F5: Consistency — status matches real progress.
 * Penalizes tasks marked "in_progress" with no recent time logs or updates.
 */
export function factorConsistency(tasks, now = new Date()) {
    const inProgress = tasks.filter(t => t.status === TASK_STATUS.IN_PROGRESS);
    if (inProgress.length === 0) return { ratio: 1.0, detail: 'Sin tareas en progreso para evaluar' };

    const staleWindow = 3 * 24 * 60 * 60 * 1000; // 3 days
    const cutoff = new Date(now.getTime() - staleWindow);

    const stale = inProgress.filter(t => {
        const lastUpdate = t.updatedAt ? new Date(t.updatedAt) : null;
        return !lastUpdate || lastUpdate < cutoff;
    }).length;

    const ratio = (inProgress.length - stale) / inProgress.length;
    return {
        ratio,
        detail: stale === 0
            ? 'Tareas en progreso con actividad reciente'
            : `${stale} tarea(s) "en progreso" sin actividad reciente`,
    };
}

/**
 * F6: Issue Resolution — delays and risks resolved.
 */
export function factorIssueResolution(delays = [], risks = []) {
    const totalIssues = delays.length + risks.length;
    if (totalIssues === 0) return { ratio: 1.0, detail: 'Sin issues registrados' };

    const resolvedDelays = delays.filter(d => d.resolved || d.status === 'resolved').length;
    const resolvedRisks = risks.filter(r => r.resolved || r.status === 'mitigated' || r.status === 'resolved').length;
    const resolved = resolvedDelays + resolvedRisks;

    const ratio = resolved / totalIssues;
    return {
        ratio,
        detail: `${resolved}/${totalIssues} issues resueltos`,
    };
}


// ============================================================
// PENALTY EVALUATION
// ============================================================

/**
 * Evaluate all applicable penalties.
 * @returns {{ key: string, deduction: number, label: string }[]}
 */
export function evaluatePenalties(tasks, milestoneDueDate, now = new Date()) {
    const active = tasks.filter(isActive);
    const penalties = [];

    // P1: Critical task overdue >3 days
    const criticalOverdue = active.filter(t => {
        if (t.priority !== 'critical') return false;
        if (!t.dueDate) return false;
        return daysBetween(new Date(t.dueDate), now) > 3;
    });
    if (criticalOverdue.length > 0) {
        penalties.push({
            ...PENALTIES.CRITICAL_OVERDUE_3D,
            detail: `${criticalOverdue.length} tarea(s) crítica(s) vencida(s) >3 días`,
        });
    }

    // P2: Stale area (no task updated in 5 days)
    if (active.length > 0) {
        const cutoff = new Date(now.getTime() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        const anyRecent = active.some(t => {
            const updated = t.updatedAt ? new Date(t.updatedAt) : null;
            return updated && updated >= cutoff;
        });
        if (!anyRecent) {
            penalties.push({
                ...PENALTIES.STALE_AREA_5D,
                detail: `Ninguna tarea actualizada en últimos ${ACTIVITY_WINDOW_DAYS} días`,
            });
        }
    }

    // P3: Deadline crisis (<10% time remaining + <50% complete)
    if (milestoneDueDate && active.length > 0) {
        const startDate = active.reduce((min, t) => {
            const d = t.createdAt ? new Date(t.createdAt) : now;
            return d < min ? d : min;
        }, now);
        const totalDuration = daysBetween(startDate, new Date(milestoneDueDate));
        const remaining = daysBetween(now, new Date(milestoneDueDate));
        const percentTimeRemaining = totalDuration > 0 ? remaining / totalDuration : 0;

        const completed = active.filter(t => t.status === TASK_STATUS.COMPLETED).length;
        const percentComplete = completed / active.length;

        if (percentTimeRemaining < 0.1 && percentTimeRemaining > 0 && percentComplete < 0.5) {
            penalties.push({
                ...PENALTIES.DEADLINE_CRISIS,
                detail: `${Math.round(percentTimeRemaining * 100)}% de tiempo restante, solo ${Math.round(percentComplete * 100)}% completado`,
            });
        }
    }

    // P4: Excessive blockers (>30% blocked)
    if (active.length > 0) {
        const blocked = active.filter(t => t.status === TASK_STATUS.BLOCKED).length;
        if (blocked / active.length > 0.3) {
            penalties.push({
                ...PENALTIES.EXCESSIVE_BLOCKERS,
                detail: `${blocked}/${active.length} tareas bloqueadas (${Math.round(blocked / active.length * 100)}%)`,
            });
        }
    }

    return penalties;
}


// ============================================================
// LOGICAL LOCKS
// ============================================================

/**
 * Evaluate logical locks that prevent false greens.
 * @returns {string[]} Active SCORE_LOCK_REASON values
 */
export function evaluateLocks(tasks, now = new Date()) {
    const locks = [];
    const active = tasks.filter(isActive);

    // L1: Critical task overdue >3 days → RED
    const criticalOverdue = active.some(t =>
        t.priority === 'critical' && t.dueDate && daysBetween(new Date(t.dueDate), now) > 3
    );
    if (criticalOverdue) locks.push(SCORE_LOCK_REASON.CRITICAL_OVERDUE);

    // L2: Blocked task unresolved >48h → min YELLOW
    const blockerOver48h = active.some(t => {
        if (t.status !== TASK_STATUS.BLOCKED) return false;
        const blockedAt = t.blockedAt || t.updatedAt;
        if (!blockedAt) return false;
        return daysBetween(new Date(blockedAt), now) * 24 > 48; // convert to hours
    });
    if (blockerOver48h) locks.push(SCORE_LOCK_REASON.UNRESOLVED_BLOCKER_48H);

    // L3: Stale area — no updates 5d → min YELLOW
    if (active.length > 0) {
        const cutoff = new Date(now.getTime() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        const anyRecent = active.some(t => {
            const u = t.updatedAt ? new Date(t.updatedAt) : null;
            return u && u >= cutoff;
        });
        if (!anyRecent) locks.push(SCORE_LOCK_REASON.STALE_AREA_5D);
    }

    // L4: Critical tasks without owner → RED
    const unownedCritical = active.some(t =>
        t.priority === 'critical' && !t.assignedTo
    );
    if (unownedCritical) locks.push(SCORE_LOCK_REASON.UNOWNED_CRITICAL);

    return locks;
}


// ============================================================
// TRAFFIC LIGHT
// ============================================================

/**
 * Derive traffic light from score + locks + optional override.
 */
export function deriveTrafficLight(score, locks = [], override = null) {
    // Manual override (if not expired)
    if (override?.value && override.expiresAt) {
        if (new Date(override.expiresAt) > new Date()) {
            return { value: override.value, source: 'override', reason: override.reason || '' };
        }
    }

    // Lock-forced minimums
    const hasRedLock = locks.includes(SCORE_LOCK_REASON.CRITICAL_OVERDUE)
        || locks.includes(SCORE_LOCK_REASON.UNOWNED_CRITICAL);
    if (hasRedLock) {
        return { value: TRAFFIC_LIGHT.RED, source: 'lock', reason: locks.filter(l =>
            l === SCORE_LOCK_REASON.CRITICAL_OVERDUE || l === SCORE_LOCK_REASON.UNOWNED_CRITICAL
        ).join(', ') };
    }

    const hasYellowLock = locks.includes(SCORE_LOCK_REASON.UNRESOLVED_BLOCKER_48H)
        || locks.includes(SCORE_LOCK_REASON.STALE_AREA_5D);
    if (hasYellowLock && score >= 70) {
        return { value: TRAFFIC_LIGHT.YELLOW, source: 'lock', reason: locks.filter(l =>
            l === SCORE_LOCK_REASON.UNRESOLVED_BLOCKER_48H || l === SCORE_LOCK_REASON.STALE_AREA_5D
        ).join(', ') };
    }

    // Score-based bands
    if (score >= 70) return { value: TRAFFIC_LIGHT.GREEN, source: 'score', reason: `Score ${score} ≥ 70` };
    if (score >= 40) return { value: TRAFFIC_LIGHT.YELLOW, source: 'score', reason: `Score ${score} (40-69)` };
    return { value: TRAFFIC_LIGHT.RED, source: 'score', reason: `Score ${score} < 40` };
}


// ============================================================
// AREA SCORE COMPUTATION (A + B + D combined)
// ============================================================

/**
 * Compute the full score for a work area.
 *
 * @param {Array} tasks - Tasks filtered for this area
 * @param {Object} options
 * @param {string} [options.milestoneDueDate] - ISO date
 * @param {Array}  [options.delays] - Delays related to this area
 * @param {Array}  [options.risks] - Risks related to this area
 * @param {Object} [options.override] - { value, reason, expiresAt }
 * @param {Object} [options.weights] - Custom factor weights
 * @param {Date}   [options.now] - Current time for testing
 * @returns {AreaScoreResult}
 */
export function computeAreaScore(tasks, options = {}) {
    const {
        milestoneDueDate = null,
        delays = [],
        risks = [],
        override = null,
        weights = FACTOR_WEIGHTS,
        now = new Date(),
    } = options;

    // Compute each factor
    const f1 = factorTaskCompletion(tasks);
    const f2 = factorRecentActivity(tasks, now);
    const f3 = factorBlockerResolution(tasks);
    const f4 = factorScheduleHealth(tasks, milestoneDueDate, now);
    const f5 = factorConsistency(tasks, now);
    const f6 = factorIssueResolution(delays, risks);

    const factors = [
        { key: 'TASK_COMPLETION', weight: weights.TASK_COMPLETION, ratio: f1.ratio, points: Math.round(f1.ratio * weights.TASK_COMPLETION), detail: f1.detail },
        { key: 'RECENT_ACTIVITY', weight: weights.RECENT_ACTIVITY, ratio: f2.ratio, points: Math.round(f2.ratio * weights.RECENT_ACTIVITY), detail: f2.detail },
        { key: 'BLOCKER_RESOLUTION', weight: weights.BLOCKER_RESOLUTION, ratio: f3.ratio, points: Math.round(f3.ratio * weights.BLOCKER_RESOLUTION), detail: f3.detail },
        { key: 'SCHEDULE_HEALTH', weight: weights.SCHEDULE_HEALTH, ratio: f4.ratio, points: Math.round(f4.ratio * weights.SCHEDULE_HEALTH), detail: f4.detail },
        { key: 'CONSISTENCY', weight: weights.CONSISTENCY, ratio: f5.ratio, points: Math.round(f5.ratio * weights.CONSISTENCY), detail: f5.detail },
        { key: 'ISSUE_RESOLUTION', weight: weights.ISSUE_RESOLUTION, ratio: f6.ratio, points: Math.round(f6.ratio * weights.ISSUE_RESOLUTION), detail: f6.detail },
    ];

    // Base score (sum of factor points)
    const baseScore = factors.reduce((sum, f) => sum + f.points, 0);

    // Penalties
    const activePenalties = evaluatePenalties(tasks, milestoneDueDate, now);
    const penaltyTotal = activePenalties.reduce((sum, p) => sum + p.deduction, 0);

    // Final score (clamped 0-100)
    const score = clamp(baseScore + penaltyTotal, 0, 100);

    // Locks
    const locks = evaluateLocks(tasks, now);

    // Traffic light
    const trafficLight = deriveTrafficLight(score, locks, override);

    return {
        score,
        baseScore,
        factors,
        penalties: activePenalties,
        penaltyTotal,
        locks,
        trafficLight,
    };
}


// ============================================================
// MILESTONE SCORE COMPUTATION (C)
// ============================================================

/**
 * Compute the milestone general score from area results.
 * All areas have equal weight.
 *
 * @param {AreaScoreResult[]} areaResults - Results from computeAreaScore for each area
 * @param {Object} [options]
 * @param {Object} [options.override] - Milestone-level override
 * @returns {MilestoneScoreResult}
 */
export function computeMilestoneScore(areaResults, options = {}) {
    const { override = null } = options;

    if (!areaResults || areaResults.length === 0) {
        return {
            score: 0,
            areaBreakdown: [],
            locks: [],
            trafficLight: deriveTrafficLight(0, [], override),
        };
    }

    // Equal-weight average
    const totalScore = areaResults.reduce((sum, r) => sum + r.score, 0);
    const score = Math.round(totalScore / areaResults.length);

    // Aggregate locks from all areas (unique)
    const allLocks = [...new Set(areaResults.flatMap(r => r.locks))];

    // Traffic light (with milestone-level locks)
    const trafficLight = deriveTrafficLight(score, allLocks, override);

    // Area breakdown for explainability
    const areaBreakdown = areaResults.map((r, i) => ({
        index: i,
        score: r.score,
        trafficLight: r.trafficLight.value,
        locks: r.locks,
        penaltyTotal: r.penaltyTotal,
    }));

    return {
        score,
        areaBreakdown,
        locks: allLocks,
        trafficLight,
    };
}


// ============================================================
// EXPLAINABILITY (H)
// ============================================================

/**
 * Generate human-readable explanation of a score result.
 *
 * @param {AreaScoreResult} result - From computeAreaScore
 * @returns {{ summary: string, reasons: string[], improvements: string[], blockers: string[] }}
 */
export function explainScore(result) {
    const { score, factors, penalties, locks, trafficLight } = result;

    // Summary
    const colorLabel = { green: '🟢 Verde', yellow: '🟡 Amarillo', red: '🔴 Rojo' };
    const summary = `Score: ${score}/100 — Semáforo: ${colorLabel[trafficLight.value] || trafficLight.value}`;

    // Reasons: what's driving the current score
    const reasons = [];
    if (trafficLight.source === 'lock') {
        reasons.push(`Candado activo: ${trafficLight.reason}`);
    }
    // Top positive factors
    const sorted = [...factors].sort((a, b) => b.points - a.points);
    if (sorted[0]?.points > 0) {
        reasons.push(`Factor principal: ${sorted[0].key} (+${sorted[0].points} pts) — ${sorted[0].detail}`);
    }
    // Penalties
    for (const p of penalties) {
        reasons.push(`Penalización: ${p.label} (${p.deduction} pts) — ${p.detail}`);
    }

    // Improvements: what would raise the score
    const improvements = [];
    const weakFactors = factors
        .filter(f => f.ratio < 0.7)
        .sort((a, b) => (a.ratio * a.weight) - (b.ratio * b.weight));

    for (const f of weakFactors.slice(0, 3)) {
        const possibleGain = f.weight - f.points;
        improvements.push(`Mejorar ${f.key}: ${f.detail} (potencial +${possibleGain} pts)`);
    }

    // Blockers: what prevents green
    const blockers = [];
    if (locks.includes(SCORE_LOCK_REASON.CRITICAL_OVERDUE)) {
        blockers.push('Resolver tarea(s) crítica(s) vencida(s) >3 días');
    }
    if (locks.includes(SCORE_LOCK_REASON.UNOWNED_CRITICAL)) {
        blockers.push('Asignar owner a tarea(s) crítica(s) sin asignar');
    }
    if (locks.includes(SCORE_LOCK_REASON.UNRESOLVED_BLOCKER_48H)) {
        blockers.push('Resolver bloqueo(s) abierto(s) >48 horas');
    }
    if (locks.includes(SCORE_LOCK_REASON.STALE_AREA_5D)) {
        blockers.push('Actualizar al menos una tarea del área (sin actividad >5 días)');
    }
    if (score < 70 && blockers.length === 0) {
        blockers.push(`Score de ${score}/100 — se requiere ≥70 para verde`);
    }

    return { summary, reasons, improvements, blockers };
}
