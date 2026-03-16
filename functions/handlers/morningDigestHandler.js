/**
 * Morning Digest Handler — Backend (CJS) — Phase 3
 * ====================================================
 * Sends role-appropriate morning briefings to all participants.
 * Queries real task data from Firestore for each target.
 */

const { sendToTargets } = require("../telegram/telegramProvider");
const { fallbackBriefing } = require("../ai/aiFallbacks");
const paths = require("../automation/firestorePaths");

/**
 * Load task stats for a specific user from Firestore.
 */
async function loadUserTaskStats(adminDb, userId) {
    const tasksSnap = await adminDb.collection(paths.TASKS).get();
    const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const userTasks = allTasks.filter(t => t.assignedTo === userId);
    const activeTasks = userTasks.filter(t => !["completed", "cancelled"].includes(t.status));
    const blockedTasks = allTasks.filter(t => t.status === "blocked");
    const userBlockedTasks = userTasks.filter(t => t.status === "blocked");

    // Overdue: dueDate < today and not completed
    const now = new Date();
    const overdueTasks = activeTasks.filter(t => {
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < now;
    });

    return {
        allTasks,
        userTasks,
        activeTasks,
        blockedTasks,        // All blocked tasks (team-level)
        userBlockedTasks,    // This user's blocked tasks
        overdueTasks,
        totalTasks: allTasks.length,
        activeCount: activeTasks.length,
        blockedCount: blockedTasks.length,
        overdueCount: overdueTasks.length,
        teamSize: new Set(allTasks.map(t => t.assignedTo).filter(Boolean)).size,
    };
}

/**
 * Execute morning digest routine.
 */
async function execute(adminDb, token, targets, context) {
    // Pre-load all tasks once (avoid N queries)
    const tasksSnap = await adminDb.collection(paths.TASKS).get();
    const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const now = new Date();
    const blockedTasks = allTasks.filter(t => t.status === "blocked");
    const teamSize = new Set(allTasks.map(t => t.assignedTo).filter(Boolean)).size;

    const messageBuilder = async (target) => {
        const uid = target.uid;
        const userTasks = allTasks.filter(t => t.assignedTo === uid);
        const activeTasks = userTasks.filter(t => !["completed", "cancelled"].includes(t.status));
        const userBlocked = userTasks.filter(t => t.status === "blocked");
        const overdueTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);

        // Build data object for templates
        const data = {
            userName: target.name,
            userTasks: activeTasks,
            teamTasks: allTasks.filter(t => !["completed", "cancelled"].includes(t.status)),
            blockedTasks: userBlocked,
            overdueTasks,
            overdueCount: overdueTasks.length,
            blockedCount: blockedTasks.length,
            totalTasks: allTasks.length,
            teamSize,
        };

        return fallbackBriefing(target.operationalRole, data);
    };

    return sendToTargets(adminDb, token, targets, messageBuilder, context);
}

module.exports = { execute };
