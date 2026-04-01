/**
 * Daily Scrum Engine — Backend (CJS)
 * ====================================
 * Port of src/core/dailyScrum/dailyScrumEngine.js for Cloud Functions.
 * 
 * Pure functions — no Firestore, no side effects.
 * Receives pre-loaded data arrays and returns computed results.
 * 
 * IMPORTANT: This MUST mirror the frontend logic exactly.
 * Any change here must be reflected in the frontend engine and vice versa.
 */

// ── Date helpers (uses LOCAL timezone, not UTC) ──

function formatLocalDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function toDateStr(d) {
    if (!d) return null;
    if (typeof d === 'string') {
        if (d.length === 10) return d;
        return formatLocalDate(new Date(d));
    }
    // Firestore Timestamp
    if (d.toDate) return formatLocalDate(d.toDate());
    return formatLocalDate(new Date(d));
}

function getYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    if (d.getDay() === 0) d.setDate(d.getDate() - 2); // Sunday → Friday
    if (d.getDay() === 6) d.setDate(d.getDate() - 1); // Saturday → Friday
    return formatLocalDate(d);
}

// ── Status constants ──

const PERSON_STATUS = {
    OK: 'ok',
    NO_TASKS: 'sin_tareas',
    NO_REPORT: 'sin_reporte',
    BLOCKED: 'bloqueado',
};

// ── Core detection (mirrors frontend) ──

function getTasksToday(personId, tasks) {
    return tasks.filter(t => {
        if (t.assignedTo !== personId) return false;
        if (t.status !== 'in_progress') return false;
        return true;
    });
}

function getEvidenceYesterday(personId, tasks, timeLogs) {
    const yesterday = getYesterday();

    const yesterdayLogs = timeLogs.filter(log => {
        if (log.userId !== personId) return false;
        const logDate = toDateStr(log.date || log.createdAt);
        return logDate === yesterday;
    });

    // Tasks that had time logged yesterday (derive from logs)
    const loggedTaskIds = new Set(yesterdayLogs.map(l => l.taskId).filter(Boolean));
    const yesterdayTasks = tasks.filter(t => loggedTaskIds.has(t.id));

    return {
        timeLogs: yesterdayLogs,
        tasks: yesterdayTasks,
        hasEvidence: yesterdayLogs.length > 0,
        totalHours: yesterdayLogs.reduce((sum, l) => sum + (l.totalHours || 0), 0),
    };
}

function getActiveBlockers(personId, tasks, delays) {
    const personTaskIds = new Set(
        tasks.filter(t => t.assignedTo === personId).map(t => t.id)
    );
    return delays.filter(d => personTaskIds.has(d.taskId) && !d.resolved);
}

function getPersonStatus(personId, tasks, timeLogs, delays) {
    const todayTasks = getTasksToday(personId, tasks);
    const yesterday = getEvidenceYesterday(personId, tasks, timeLogs);
    const blockers = getActiveBlockers(personId, tasks, delays);

    const allBlocked = todayTasks.length > 0 && todayTasks.every(t => t.status === 'blocked');
    if (blockers.length > 0 || allBlocked) return PERSON_STATUS.BLOCKED;
    if (!yesterday.hasEvidence) return PERSON_STATUS.NO_REPORT;
    if (todayTasks.length === 0) return PERSON_STATUS.NO_TASKS;
    return PERSON_STATUS.OK;
}

/**
 * Build full Daily Scrum data for all team members.
 * This is the SAME logic as the frontend buildDailyScrumData.
 */
function buildDailyScrumData(teamMembers, tasks, timeLogs, delays, assignments) {
    const assignmentMap = {};
    for (const a of (assignments || [])) {
        if (a.active) assignmentMap[a.technicianId] = a;
    }

    return teamMembers.map(member => {
        const uid = member.uid || member.id;
        const todayTasks = getTasksToday(uid, tasks);
        const yesterday = getEvidenceYesterday(uid, tasks, timeLogs);
        const blockers = getActiveBlockers(uid, tasks, delays);
        const status = getPersonStatus(uid, tasks, timeLogs, delays);
        const assignment = assignmentMap[uid] || null;

        return {
            uid,
            displayName: member.displayName || member.email || uid,
            role: member.teamRole || member.operationalRole || 'engineer',
            status,
            todayTasks,
            yesterdayEvidence: yesterday,
            blockers,
            engineerId: assignment?.engineerId || null,
        };
    });
}

function buildSummary(scrumData) {
    const counts = { ok: 0, sin_tareas: 0, sin_reporte: 0, bloqueado: 0 };
    for (const p of scrumData) {
        counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return {
        total: scrumData.length,
        ...counts,
        needsAttention: counts.sin_tareas + counts.sin_reporte + counts.bloqueado,
    };
}

module.exports = {
    PERSON_STATUS,
    getTasksToday,
    getEvidenceYesterday,
    getActiveBlockers,
    getPersonStatus,
    buildDailyScrumData,
    buildSummary,
};
