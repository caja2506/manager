/**
 * Performance Score Engine — Individual Performance Score (IPS)
 * =============================================================
 * 
 * Calculates a composite 0–100 score per team member, differentiated by role.
 * 
 * DESIGN PRINCIPLES:
 *   1. Pure functions — no Firestore, no side effects
 *   2. Role-differentiated — weights and dimensions vary by role
 *   3. Reuses existing data — consumes teamUtilization, timeLogs, tasks
 *   4. Deterministic — same inputs → same output
 *   5. Auditable — each dimension visible with raw data
 * 
 * DIMENSIONS BY ROLE:
 *   Engineer:   velocity(20%) + discipline(20%) + capacity(15%) + precision(15%) + collaboration(10%) + leadership(20%)
 *   Team Lead:  velocity(15%) + discipline(20%) + capacity(15%) + precision(10%) + collaboration(10%) + oversight(30%)
 *   Technician: velocity(30%) + discipline(35%) + capacity(25%) + collaboration(10%)
 *   Manager:    N/A (department-level scores exist in complianceScorer)
 * 
 * DATA SOURCES (source of truth: timeLogs per data-sources-guide.md):
 *   - engTasks        → velocity, precision, collaboration
 *   - timeLogs        → capacity (via calculateMemberUtilization)
 *   - delays          → collaboration
 *   - assignments     → leadership (engineer → technician link)
 *   - plannerSlots    → leadership (technician planning check)
 *   - auditFindings   → discipline, oversight
 */

import { calculateMemberUtilization } from './teamUtilization';

// ============================================================
// SCORE LEVELS
// ============================================================

export const IPS_LEVEL = {
    EXCELLENT: 'excellent',
    GOOD: 'good',
    REGULAR: 'regular',
    NEEDS_ATTENTION: 'needs_attention',
};

export const IPS_LEVEL_CODE = {
    [IPS_LEVEL.NEEDS_ATTENTION]: 1,
    [IPS_LEVEL.REGULAR]: 2,
    [IPS_LEVEL.GOOD]: 3,
    [IPS_LEVEL.EXCELLENT]: 4,
};

export const IPS_LEVEL_CONFIG = {
    [IPS_LEVEL.EXCELLENT]:       { label: 'Excelente',         color: 'emerald', emoji: '⭐', min: 90, max: 100, code: 4 },
    [IPS_LEVEL.GOOD]:            { label: 'Bueno',             color: 'indigo',  emoji: '✅', min: 75, max: 89,  code: 3 },
    [IPS_LEVEL.REGULAR]:         { label: 'Regular',           color: 'amber',   emoji: '⚠️', min: 60, max: 74,  code: 2 },
    [IPS_LEVEL.NEEDS_ATTENTION]: { label: 'Necesita Atención', color: 'rose',    emoji: '🔴', min: 0,  max: 59,  code: 1 },
};

// ============================================================
// DEFAULT WEIGHTS BY ROLE
// ============================================================

export const DEFAULT_WEIGHTS = {
    engineer: {
        velocity: 0.20,
        discipline: 0.20,
        capacity: 0.15,
        precision: 0.15,
        collaboration: 0.10,
        leadership: 0.20,
    },
    team_lead: {
        velocity: 0.15,
        discipline: 0.20,
        capacity: 0.15,
        precision: 0.10,
        collaboration: 0.10,
        oversight: 0.30,
    },
    technician: {
        velocity: 0.30,
        discipline: 0.30,
        precision: 0.25,
        collaboration: 0.15,
    },
};

// ============================================================
// DIMENSION CALCULATORS
// ============================================================

/**
 * Velocity: Composite of completion rate AND active-task progress.
 * 
 * Two sub-scores (weighted 50/50):
 *   A) Completion ratio — how many tasks completed this week vs expected
 *   B) Progress quality — avg subtask % on in-progress tasks, penalized by time overrun
 *   
 * If user has NO active tasks and NO completions → 100 (nothing to do).
 * If user has active tasks but 0 completions → completion part = 0.
 * Time overrun penalty: if actual hours > estimated * 1.5, apply a multiplier.
 */
function calcVelocity(userId, tasks) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const userTasks = tasks.filter(t => t.assignedTo === userId);
    const activeTasks = userTasks.filter(t => !['completed', 'cancelled'].includes(t.status));
    const inProgress = userTasks.filter(t => t.status === 'in_progress');
    const completedThisWeek = userTasks.filter(t =>
        t.status === 'completed' &&
        (t.completedDate || t.updatedAt) &&
        new Date(t.completedDate || t.updatedAt) >= sevenDaysAgo
    );

    // Nothing assigned at all → perfect (nothing to evaluate)
    if (userTasks.length === 0) {
        return { score: 100, raw: { tasksCompleted: 0, expected: 0, activeTasks: 0, avgProgress: 0, avgOverrun: 0 } };
    }

    // ── A) Completion ratio (50% weight) ──
    const expected = Math.max(1, Math.ceil(activeTasks.length * 0.3));
    const completionRatio = expected > 0 ? Math.min(completedThisWeek.length / expected, 1.0) : 1.0;
    const completionScore = completionRatio * 100;

    // ── B) Progress quality on in-progress tasks (50% weight) ──
    let progressScore = 100;
    let avgProgress = 0;
    let avgOverrun = 0;

    if (inProgress.length > 0) {
        // Subtask progress: average % of subtasks completed
        const progresses = inProgress.map(t => {
            const subs = t.subtasks || [];
            if (subs.length === 0) return 0.5; // No subtasks = assume 50%
            const done = subs.filter(s => s.completed || s.done).length;
            return done / subs.length;
        });
        avgProgress = progresses.reduce((a, b) => a + b, 0) / progresses.length;

        // Time overrun: actual hours / estimated hours
        const overruns = inProgress
            .filter(t => t.estimatedHours > 0 && t.actualHours > 0)
            .map(t => t.actualHours / t.estimatedHours);
        avgOverrun = overruns.length > 0
            ? overruns.reduce((a, b) => a + b, 0) / overruns.length
            : 1.0;

        // Progress score = subtask % * overrun penalty
        // Overrun penalty: 1.0 if ratio ≤ 1.0, drops linearly after that
        const overrunPenalty = avgOverrun <= 1.0 ? 1.0 : Math.max(0.2, 1.0 - (avgOverrun - 1.0) * 0.4);
        progressScore = avgProgress * overrunPenalty * 100;
    }

    // If user has active tasks but ZERO completions → completion weight is dominant
    const hasActive = activeTasks.length > 0;
    const compWeight = hasActive ? 0.5 : 0.0;
    const progWeight = hasActive ? 0.5 : 0.0;

    const rawScore = hasActive
        ? completionScore * compWeight + progressScore * progWeight
        : 100; // no active tasks at all

    return {
        score: clamp(Math.round(rawScore)),
        raw: {
            tasksCompleted: completedThisWeek.length,
            expected,
            activeTasks: activeTasks.length,
            avgProgress: parseFloat((avgProgress * 100).toFixed(1)),
            avgOverrun: parseFloat(avgOverrun.toFixed(2)),
        },
    };
}

/**
 * Discipline: Penalized by audit findings (missing timelogs, stale updates).
 * Starts at 100, subtracts per finding.
 */
function calcDiscipline(userId, tasks, timeLogs) {
    let score = 100;
    const raw = { findingsCount: 0, missedTimelogs: 0, staleUpdates: 0 };

    const userTasks = tasks.filter(t => t.assignedTo === userId && t.status === 'in_progress');
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Check: in_progress tasks with no timeLogs in 3 days
    const recentLogTaskIds = new Set(
        timeLogs
            .filter(l => l.userId === userId && l.startTime && new Date(l.startTime) >= threeDaysAgo)
            .map(l => l.taskId)
    );
    const tasksWithoutLogs = userTasks.filter(t => !recentLogTaskIds.has(t.id));
    if (tasksWithoutLogs.length > 0) {
        score -= 15 * Math.min(tasksWithoutLogs.length, 3); // max -45
        raw.missedTimelogs = tasksWithoutLogs.length;
        raw.findingsCount++;
    }

    // Check: active tasks not updated in 5+ days
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const allActive = tasks.filter(t =>
        t.assignedTo === userId &&
        !['completed', 'cancelled', 'backlog'].includes(t.status)
    );
    const staleTasks = allActive.filter(t => {
        const updated = t.updatedAt ? new Date(t.updatedAt) : null;
        return !updated || updated < fiveDaysAgo;
    });
    if (staleTasks.length > 0) {
        score -= 10 * Math.min(staleTasks.length, 3); // max -30
        raw.staleUpdates = staleTasks.length;
        raw.findingsCount++;
    }

    return { score: clamp(score), raw };
}

/**
 * Capacity: Parabolic curve centered at 80% utilization.
 * Both idle (0%) and overloaded (150%) are penalized.
 * Uses calculateMemberUtilization from teamUtilization.js.
 */
function calcCapacity(userId, tasks, timeLogs, profile) {
    const util = calculateMemberUtilization(userId, tasks, timeLogs, profile);
    const pct = util.utilizationPercent;

    // Parabolic: optimal at 80%, drops off on both sides
    const optimal = 80;
    const deviation = Math.abs(pct - optimal);
    const score = Math.round(Math.max(0, 100 * (1 - deviation / optimal)));

    return {
        score: clamp(score),
        raw: {
            utilizationPct: pct,
            hoursLogged: util.weeklyHours,
            capacity: util.capacity,
        },
    };
}

/**
 * Precision: How close actual hours are to estimated hours.
 * Evaluates BOTH completed AND in-progress tasks with estimates.
 * Perfect ratio (actual/estimated = 1.0) = 100 score.
 * 257% overrun = score ~0. Under-budget is mildly penalized (indicates bad estimates).
 */
function calcPrecision(userId, tasks) {
    // Include completed AND in_progress tasks with time data
    const evaluated = tasks.filter(t =>
        t.assignedTo === userId &&
        ['completed', 'in_progress', 'validation'].includes(t.status) &&
        t.estimatedHours > 0 &&
        t.actualHours > 0
    );

    if (evaluated.length === 0) {
        return { score: 100, raw: { estimationRatio: 0, tasksEvaluated: 0, worstOverrun: 0 } };
    }

    const ratios = evaluated.map(t => t.actualHours / t.estimatedHours);
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const worstOverrun = Math.max(...ratios);

    // Accuracy: 1.0 is perfect. Deviation in either direction penalizes.
    // Over-budget penalized more heavily than under-budget.
    const overPenalty = avgRatio > 1.0 ? Math.abs(1 - avgRatio) * 1.5 : Math.abs(1 - avgRatio);
    const accuracy = Math.max(0, 1 - overPenalty);
    const score = Math.round(accuracy * 100);

    return {
        score: clamp(score),
        raw: {
            estimationRatio: parseFloat(avgRatio.toFixed(2)),
            tasksEvaluated: evaluated.length,
            worstOverrun: parseFloat(worstOverrun.toFixed(2)),
        },
    };
}

/**
 * Collaboration: Penalized for blocked tasks and unresolved delays.
 */
function calcCollaboration(userId, tasks, delays) {
    let score = 100;
    const userTasks = tasks.filter(t => t.assignedTo === userId);
    const blockedTasks = userTasks.filter(t => t.status === 'blocked');
    const userTaskIds = new Set(userTasks.map(t => t.id));
    const unresolvedDelays = delays.filter(d => userTaskIds.has(d.taskId) && !d.resolved);

    score -= 20 * blockedTasks.length;
    score -= 15 * unresolvedDelays.length;

    return {
        score: clamp(score),
        raw: {
            blockedTasks: blockedTasks.length,
            unresolvedDelays: unresolvedDelays.length,
        },
    };
}

/**
 * Leadership (ENGINEER ONLY):
 * Penalized if assigned technicians have issues.
 * Uses resourceAssignments to find which technicians this engineer supervises.
 */
function calcLeadership(engineerId, tasks, timeLogs, assignments, plannerSlots) {
    // Find technicians assigned to this engineer
    const myTechs = assignments
        .filter(a => a.engineerId === engineerId && a.active)
        .map(a => a.technicianId);

    // If no technicians, perfect score (nothing to supervise)
    if (myTechs.length === 0) {
        return {
            score: 100,
            raw: { techniciansManaged: 0, techsWithoutTasks: 0, techsBlockedUnresolved: 0, techsWithoutPlan: 0 },
        };
    }

    let score = 100;
    const raw = {
        techniciansManaged: myTechs.length,
        techsWithoutTasks: 0,
        techsBlockedUnresolved: 0,
        techsWithoutPlan: 0,
    };

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    for (const techId of myTechs) {
        const techTasks = tasks.filter(t =>
            t.assignedTo === techId &&
            !['completed', 'cancelled'].includes(t.status)
        );
        const techInProgress = techTasks.filter(t => t.status === 'in_progress');

        // Technician has no in_progress tasks → engineer didn't assign work
        if (techInProgress.length === 0) {
            score -= 20;
            raw.techsWithoutTasks++;
        }

        // Technician has blocked tasks with no resolution
        const techBlocked = techTasks.filter(t => t.status === 'blocked');
        if (techBlocked.length > 0) {
            score -= 25;
            raw.techsBlockedUnresolved++;
        }

        // Technician has no timeLogs in 3 days (engineer didn't ensure logging)
        const recentLogs = timeLogs.filter(l =>
            l.userId === techId && l.startTime && new Date(l.startTime) >= threeDaysAgo
        );
        if (recentLogs.length === 0 && techInProgress.length > 0) {
            // Only penalize if tech has tasks but no logs
            score -= 15;
        }

        // Technician has no planner slots this week
        const techSlots = plannerSlots.filter(s =>
            s.assignedTo === techId || s.createdBy === techId
        );
        if (techSlots.length === 0 && techTasks.length > 0) {
            score -= 15;
            raw.techsWithoutPlan++;
        }
    }

    return { score: clamp(score), raw };
}

/**
 * Oversight (TEAM LEAD ONLY):
 * Penalized if the team has incomplete data or low compliance.
 */
function calcOversight(tasks, teamMembers, auditScores) {
    let score = 100;
    const activeTasks = tasks.filter(t => !['completed', 'cancelled', 'backlog'].includes(t.status));
    const raw = {
        tasksWithoutEstimate: 0,
        tasksWithoutAssignee: 0,
        complianceScore: 0,
        teamSize: teamMembers.length,
    };

    // % tasks without estimation > 25% → penalize
    const noEstimate = activeTasks.filter(t => !t.estimatedHours || t.estimatedHours <= 0);
    raw.tasksWithoutEstimate = noEstimate.length;
    if (activeTasks.length > 0 && (noEstimate.length / activeTasks.length) > 0.25) {
        score -= 15;
    }

    // % tasks without assignee > 10% → penalize
    const noAssignee = activeTasks.filter(t => !t.assignedTo);
    raw.tasksWithoutAssignee = noAssignee.length;
    if (activeTasks.length > 0 && (noAssignee.length / activeTasks.length) > 0.10) {
        score -= 15;
    }

    // Departmental compliance score < 70 → penalize
    if (auditScores) {
        const avgCompliance = Object.values(auditScores)
            .filter(v => typeof v === 'number')
            .reduce((sum, v, _, arr) => sum + v / arr.length, 0);
        raw.complianceScore = Math.round(avgCompliance);

        if (avgCompliance < 70) {
            score -= 25;
        } else if (avgCompliance < 80) {
            score -= 10;
        }
    }

    return { score: clamp(score), raw };
}

// ============================================================
// MAIN CALCULATOR
// ============================================================

/**
 * Calculate the Individual Performance Score for one user.
 * 
 * @param {string} userId
 * @param {string} role - 'engineer' | 'team_lead' | 'technician' | 'manager'
 * @param {Object} data - All required data
 * @param {Array}  data.tasks - All engineering tasks
 * @param {Array}  data.timeLogs - All time logs (source of truth for hours)
 * @param {Array}  data.delays - All delay records
 * @param {Array}  data.teamMembers - All team member profiles
 * @param {Array}  [data.assignments=[]] - Active resourceAssignments
 * @param {Array}  [data.plannerSlots=[]] - Weekly planner slots
 * @param {Object} [data.auditScores=null] - Department compliance scores
 * @param {Object} [weights] - Custom weights (from settings). Falls back to DEFAULT_WEIGHTS.
 * @returns {Object} IPS result
 */
export function calculateIndividualScore(userId, role, data, weights = null) {
    const {
        tasks = [],
        timeLogs = [],
        delays = [],
        teamMembers = [],
        assignments = [],
        plannerSlots = [],
        auditScores = null,
    } = data;

    // Managers don't get IPS
    if (role === 'manager') {
        return {
            score: null,
            level: null,
            levelCode: null,
            levelConfig: null,
            dimensions: {},
            insufficientData: false,
            isManager: true,
        };
    }

    const profile = teamMembers.find(m => (m.uid || m.id) === userId) || {};
    const roleWeights = weights?.[role] || DEFAULT_WEIGHTS[role] || DEFAULT_WEIGHTS.engineer;

    // Check for insufficient data
    const sevenDaysAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentLogs = timeLogs.filter(l =>
        l.userId === userId && l.startTime && new Date(l.startTime) >= sevenDaysAgo
    );
    const userTasks = tasks.filter(t => t.assignedTo === userId);
    if (recentLogs.length < 1 && userTasks.length === 0) {
        return {
            score: null,
            level: null,
            levelCode: null,
            levelConfig: null,
            dimensions: {},
            insufficientData: true,
            isManager: false,
        };
    }

    // ── Calculate dimensions ──
    const dimensions = {};
    let totalScore = 0;

    // Velocity — all roles except manager
    const velocity = calcVelocity(userId, tasks);
    dimensions.velocity = { ...velocity, weight: roleWeights.velocity };
    totalScore += velocity.score * roleWeights.velocity;

    // Discipline — all roles except manager
    const discipline = calcDiscipline(userId, tasks, timeLogs);
    dimensions.discipline = { ...discipline, weight: roleWeights.discipline };
    totalScore += discipline.score * roleWeights.discipline;

    // Capacity — only roles with capacity weight (Engineer, Team Lead)
    if (roleWeights.capacity) {
        const capacity = calcCapacity(userId, tasks, timeLogs, profile);
        dimensions.capacity = { ...capacity, weight: roleWeights.capacity };
        totalScore += capacity.score * roleWeights.capacity;
    }

    // Collaboration — all roles except manager
    const collaboration = calcCollaboration(userId, tasks, delays);
    dimensions.collaboration = { ...collaboration, weight: roleWeights.collaboration };
    totalScore += collaboration.score * roleWeights.collaboration;

    // Precision — ALL roles (time overrun awareness)
    if (roleWeights.precision) {
        const precision = calcPrecision(userId, tasks);
        dimensions.precision = { ...precision, weight: roleWeights.precision };
        totalScore += precision.score * roleWeights.precision;
    }

    // Leadership — only Engineer
    if (role === 'engineer') {
        const leadership = calcLeadership(userId, tasks, timeLogs, assignments, plannerSlots);
        dimensions.leadership = { ...leadership, weight: roleWeights.leadership };
        totalScore += leadership.score * roleWeights.leadership;
    }

    // Oversight — only Team Lead
    if (role === 'team_lead') {
        const oversight = calcOversight(tasks, teamMembers, auditScores);
        dimensions.oversight = { ...oversight, weight: roleWeights.oversight };
        totalScore += oversight.score * roleWeights.oversight;
    }

    const finalScore = clamp(Math.round(totalScore * 10) / 10);
    const level = getLevel(finalScore);

    return {
        score: finalScore,
        level,
        levelCode: IPS_LEVEL_CODE[level],
        levelConfig: IPS_LEVEL_CONFIG[level],
        dimensions,
        insufficientData: false,
        isManager: false,
    };
}

/**
 * Calculate IPS for the entire team.
 * 
 * @param {Array} teamMembers
 * @param {Object} data - Same data object as calculateIndividualScore
 * @param {Object} [weights] - Custom weights from settings
 * @returns {Array} Array of { userId, displayName, role, ...IPS }
 */
export function calculateTeamScores(teamMembers, data, weights = null) {
    return teamMembers.map(member => {
        const userId = member.uid || member.id;
        const role = member.teamRole || 'engineer';
        const ips = calculateIndividualScore(userId, role, data, weights);

        return {
            userId,
            displayName: member.displayName || member.email || userId,
            email: member.email || '',
            teamRole: role,
            ...ips,
        };
    }).sort((a, b) => {
        // Managers last, then sort by score descending
        if (a.isManager && !b.isManager) return 1;
        if (!a.isManager && b.isManager) return -1;
        return (b.score || 0) - (a.score || 0);
    });
}

// ============================================================
// HELPERS
// ============================================================

function clamp(score) {
    return Math.max(0, Math.min(100, score));
}

function getLevel(score) {
    if (score >= 90) return IPS_LEVEL.EXCELLENT;
    if (score >= 75) return IPS_LEVEL.GOOD;
    if (score >= 60) return IPS_LEVEL.REGULAR;
    return IPS_LEVEL.NEEDS_ATTENTION;
}

/**
 * Get raw metrics snapshot for a user (used by daily log persistence).
 * All values are numbers or arrays — no text for queryable data.
 */
export function buildRawMetrics(userId, role, data) {
    const { tasks = [], timeLogs = [], assignments = [] } = data;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const userTasks = tasks.filter(t => t.assignedTo === userId);
    const activeTasks = userTasks.filter(t => !['completed', 'cancelled'].includes(t.status));
    const completedThisWeek = userTasks.filter(t =>
        t.status === 'completed' &&
        new Date(t.completedDate || t.updatedAt) >= sevenDaysAgo
    );

    const userLogs = timeLogs.filter(l =>
        l.userId === userId && l.startTime && new Date(l.startTime) >= sevenDaysAgo
    );
    const weeklyHoursLogged = userLogs.reduce((s, l) => s + (l.totalHours || 0), 0);
    const weeklyOvertime = userLogs.reduce((s, l) => s + (l.overtimeHours || 0), 0);

    const auditFindings = activeTasks.filter(t =>
        !t.estimatedHours || !t.assignedTo || t.status === 'blocked'
    ).length;

    const result = {
        activeTasks: activeTasks.length,
        completedThisWeek: completedThisWeek.length,
        blockedTasks: activeTasks.filter(t => t.status === 'blocked').length,
        weeklyHoursLogged: parseFloat(weeklyHoursLogged.toFixed(1)),
        weeklyOvertime: parseFloat(weeklyOvertime.toFixed(1)),
        utilizationPct: 0,
        auditFindings,
    };

    // Engineers: include assigned technicians
    if (role === 'engineer') {
        result.assignedTechnicians = assignments
            .filter(a => a.engineerId === userId && a.active)
            .map(a => a.technicianId);
    }

    return result;
}
