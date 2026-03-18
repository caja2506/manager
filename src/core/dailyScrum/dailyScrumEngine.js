/**
 * dailyScrumEngine.js — Pure detection functions
 * ================================================
 * All functions are PURE — no Firestore, no side effects.
 * Receives pre-loaded data and returns computed results.
 * 
 * Used by DailyScrumPage to show operational status per person.
 */

// ── Helper: date comparison ──

function toDateStr(d) {
    if (!d) return null;
    if (typeof d === 'string') return d.substring(0, 10);
    return new Date(d).toISOString().substring(0, 10);
}

function getToday() {
    return new Date().toISOString().substring(0, 10);
}

function getYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    // Skip weekends: if today is Monday, yesterday = Friday
    if (d.getDay() === 0) d.setDate(d.getDate() - 2); // Sunday → Friday
    if (d.getDay() === 6) d.setDate(d.getDate() - 1); // Saturday → Friday
    return d.toISOString().substring(0, 10);
}

// ── Status constants ──

export const PERSON_STATUS = {
    OK: 'ok',
    NO_TASKS: 'sin_tareas',
    NO_REPORT: 'sin_reporte',
    BLOCKED: 'bloqueado',
    NO_PLAN: 'sin_plan',
};

export const STATUS_CONFIG = {
    [PERSON_STATUS.OK]: {
        label: 'OK', color: '#10b981', bgColor: 'rgba(16,185,129,0.12)',
        borderColor: 'rgba(16,185,129,0.3)', emoji: '🟢',
    },
    [PERSON_STATUS.NO_TASKS]: {
        label: 'Sin tareas', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.12)',
        borderColor: 'rgba(245,158,11,0.3)', emoji: '🟡',
    },
    [PERSON_STATUS.NO_REPORT]: {
        label: 'Sin reporte', color: '#ef4444', bgColor: 'rgba(239,68,68,0.12)',
        borderColor: 'rgba(239,68,68,0.3)', emoji: '🔴',
    },
    [PERSON_STATUS.BLOCKED]: {
        label: 'Bloqueado', color: '#ef4444', bgColor: 'rgba(239,68,68,0.12)',
        borderColor: 'rgba(239,68,68,0.3)', emoji: '⛔',
    },
    [PERSON_STATUS.NO_PLAN]: {
        label: 'Sin plan', color: '#f97316', bgColor: 'rgba(249,115,22,0.12)',
        borderColor: 'rgba(249,115,22,0.3)', emoji: '🟠',
    },
};

// ── Core detection functions ──

/**
 * Get tasks assigned to a person for today (active, not completed/cancelled)
 */
export function getTasksToday(personId, tasks) {
    const today = getToday();
    const TERMINAL = ['completed', 'cancelled'];

    return tasks.filter(t => {
        if (t.assignedTo !== personId) return false;
        if (TERMINAL.includes(t.status)) return false;

        // Task is "today" if:
        // 1. It has a planned date for today, OR
        // 2. It's in_progress / backlog with no future start date
        const startDate = toDateStr(t.plannedStartDate);
        const dueDate = toDateStr(t.dueDate);

        if (startDate && startDate > today) return false; // future task
        if (dueDate && dueDate < today) return true; // overdue
        if (startDate && startDate <= today) return true;
        if (!startDate) return true; // no start date = assume active now

        return false;
    });
}

/**
 * Get evidence of work yesterday: tasks + time logs
 */
export function getEvidenceYesterday(personId, tasks, timeLogs) {
    const yesterday = getYesterday();

    // Time logs from yesterday
    const yesterdayLogs = timeLogs.filter(log => {
        if (log.userId !== personId) return false;
        const logDate = toDateStr(log.date || log.createdAt);
        return logDate === yesterday;
    });

    // Tasks that were in_progress or completed yesterday
    const yesterdayTasks = tasks.filter(t => {
        if (t.assignedTo !== personId) return false;
        const updatedDate = toDateStr(t.updatedAt);
        return updatedDate === yesterday;
    });

    return {
        timeLogs: yesterdayLogs,
        tasks: yesterdayTasks,
        hasEvidence: yesterdayLogs.length > 0 || yesterdayTasks.length > 0,
        totalHours: yesterdayLogs.reduce((sum, l) => sum + (l.totalHours || 0), 0),
    };
}

/**
 * Get active blockers (unresolved delays) for a person
 */
export function getActiveBlockers(personId, tasks, delays) {
    const personTaskIds = new Set(
        tasks.filter(t => t.assignedTo === personId).map(t => t.id)
    );

    return delays.filter(d =>
        personTaskIds.has(d.taskId) && !d.resolved
    );
}

/**
 * Determine person status (priority order: blocked > no_report > no_tasks > ok)
 */
export function getPersonStatus(personId, tasks, timeLogs, delays) {
    const todayTasks = getTasksToday(personId, tasks);
    const yesterday = getEvidenceYesterday(personId, tasks, timeLogs);
    const blockers = getActiveBlockers(personId, tasks, delays);

    // All tasks blocked?
    const allBlocked = todayTasks.length > 0 && todayTasks.every(t => t.status === 'blocked');
    if (blockers.length > 0 || allBlocked) return PERSON_STATUS.BLOCKED;

    // No evidence from yesterday
    if (!yesterday.hasEvidence) return PERSON_STATUS.NO_REPORT;

    // No tasks today
    if (todayTasks.length === 0) return PERSON_STATUS.NO_TASKS;

    return PERSON_STATUS.OK;
}

/**
 * Build the full daily scrum data for all team members
 * 
 * @param {Array} teamMembers - from AppDataContext
 * @param {Array} tasks - engTasks from AppDataContext
 * @param {Array} timeLogs - from AppDataContext
 * @param {Array} delays - from AppDataContext
 * @param {Array} assignments - active resourceAssignments
 * @returns {Array} Person data objects sorted by status priority
 */
export function buildDailyScrumData(teamMembers, tasks, timeLogs, delays, assignments) {
    const assignmentMap = {};
    for (const a of assignments) {
        if (a.active) assignmentMap[a.technicianId] = a;
    }

    const statusPriority = {
        [PERSON_STATUS.BLOCKED]: 0,
        [PERSON_STATUS.NO_REPORT]: 1,
        [PERSON_STATUS.NO_TASKS]: 2,
        [PERSON_STATUS.NO_PLAN]: 3,
        [PERSON_STATUS.OK]: 4,
    };

    const data = teamMembers.map(member => {
        const uid = member.uid || member.id;
        const todayTasks = getTasksToday(uid, tasks);
        const yesterday = getEvidenceYesterday(uid, tasks, timeLogs);
        const blockers = getActiveBlockers(uid, tasks, delays);
        const status = getPersonStatus(uid, tasks, timeLogs, delays);
        const assignment = assignmentMap[uid] || null;

        return {
            uid,
            displayName: member.displayName || member.email || uid,
            email: member.email || '',
            role: member.teamRole || member.role || 'engineer',
            photoURL: member.photoURL || null,
            status,
            statusConfig: STATUS_CONFIG[status],
            todayTasks,
            yesterdayEvidence: yesterday,
            blockers,
            assignment,
            engineerId: assignment?.engineerId || null,
        };
    });

    // Sort by status priority (problems first)
    data.sort((a, b) =>
        (statusPriority[a.status] ?? 4) - (statusPriority[b.status] ?? 4)
    );

    return data;
}

/**
 * Build summary counts for the header
 */
export function buildSummary(scrumData) {
    const counts = { ok: 0, sin_tareas: 0, sin_reporte: 0, bloqueado: 0, sin_plan: 0 };
    for (const p of scrumData) {
        counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return {
        total: scrumData.length,
        ...counts,
        needsAttention: counts.sin_tareas + counts.sin_reporte + counts.bloqueado + counts.sin_plan,
    };
}
