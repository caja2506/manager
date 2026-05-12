/**
 * Quick Report Handler — Backend (CJS)
 * ======================================
 * Cloud Function APIs for the Telegram Quick Report Mini App.
 * 
 * getQuickReportData: returns user's active tasks + subtasks for today
 * submitQuickReport: saves progress reports and updates task/subtask data
 */

const paths = require("../automation/firestorePaths");

/**
 * Load active tasks + subtasks for a user identified by Telegram chatId.
 */
async function getQuickReportData(adminDb, chatId) {
    const chatIdStr = String(chatId);

    // ── 1. Try direct field: users.telegramChatId ──
    let usersSnap = await adminDb.collection(paths.USERS)
        .where("telegramChatId", "==", chatIdStr)
        .limit(1)
        .get();

    if (!usersSnap.empty) {
        const userDoc = usersSnap.docs[0];
        return await buildReportData(adminDb, userDoc.id, userDoc.data());
    }

    // ── 2. Try providerLinks.telegram.chatId (scan automation participants) ──
    const participantsSnap = await adminDb.collection(paths.USERS)
        .where("isAutomationParticipant", "==", true)
        .get();

    for (const doc of participantsSnap.docs) {
        const u = doc.data();
        const linkedChatId = u.providerLinks?.telegram?.chatId;
        if (linkedChatId && String(linkedChatId) === chatIdStr) {
            return await buildReportData(adminDb, doc.id, u);
        }
    }

    // ── 3. Try telegramSessions ──
    const sessionSnap = await adminDb.collection(paths.TELEGRAM_SESSIONS)
        .where("chatId", "==", chatIdStr)
        .limit(1)
        .get();

    if (!sessionSnap.empty) {
        const session = sessionSnap.docs[0].data();
        if (session.userId) {
            const userDoc = await adminDb.collection(paths.USERS).doc(session.userId).get();
            if (userDoc.exists) {
                return await buildReportData(adminDb, userDoc.id, userDoc.data());
            }
        }
    }

    console.warn(`[quickReport] User not found for chatId: ${chatIdStr}`);
    return { error: "user_not_found", tasks: [] };
}

async function buildReportData(adminDb, userId, userData) {
    const today = new Date().toISOString().substring(0, 10);
    const TERMINAL = ["completed", "cancelled"];

    // ── Get all tasks assigned to this user ──
    const tasksSnap = await adminDb.collection(paths.TASKS)
        .where("assignedTo", "==", userId)
        .get();

    const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter to active tasks relevant for today
    const todayTasks = allTasks.filter(t => {
        if (TERMINAL.includes(t.status)) return false;
        const startDate = t.plannedStartDate ? String(t.plannedStartDate).substring(0, 10) : null;
        const dueDate = t.dueDate ? String(t.dueDate).substring(0, 10) : null;
        if (startDate && startDate > today) return false;
        return true;
    });

    // ── Get subtasks for these tasks ──
    const taskIds = todayTasks.map(t => t.id);
    let allSubtasks = [];

    // Firestore 'in' queries support max 30 values
    for (let i = 0; i < taskIds.length; i += 30) {
        const batch = taskIds.slice(i, i + 30);
        if (batch.length === 0) continue;
        const subSnap = await adminDb.collection(paths.SUBTASKS)
            .where("taskId", "in", batch)
            .get();
        allSubtasks = allSubtasks.concat(
            subSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        );
    }

    // Group subtasks by taskId
    const subtasksByTask = {};
    for (const st of allSubtasks) {
        if (!subtasksByTask[st.taskId]) subtasksByTask[st.taskId] = [];
        subtasksByTask[st.taskId].push(st);
    }

    // Sort subtasks by order
    for (const key of Object.keys(subtasksByTask)) {
        subtasksByTask[key].sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    // ── Build response ──
    const tasks = todayTasks.map(t => {
        const subtasks = (subtasksByTask[t.id] || []).map(st => ({
            id: st.id,
            title: st.title,
            completed: !!st.completed,
            order: st.order || 0,
        }));

        const hasSubtasks = subtasks.length > 0;
        const completedCount = subtasks.filter(st => st.completed).length;
        const autoProgress = hasSubtasks
            ? Math.round((completedCount / subtasks.length) * 100)
            : (t.progressPercent || 0);

        return {
            id: t.id,
            title: t.title,
            status: t.status,
            progressPercent: autoProgress,
            estimatedHours: t.estimatedHours || 0,
            subtasks,
            hasSubtasks,
        };
    });

    return {
        userId,
        userName: userData.displayName || userData.email || userId,
        date: today,
        tasks,
        error: null,
    };
}

/**
 * Submit a quick report from the Mini App.
 * 
 * @param {Object} reportData - { chatId, tasks: [{ taskId, progressPercent, hoursWorked, blocked, blockerNote, subtasks: [{id, completed}] }], note }
 */
async function submitQuickReport(adminDb, reportData) {
    const { chatId, tasks: taskReports, note } = reportData;

    if (!chatId || !taskReports || taskReports.length === 0) {
        return { error: "invalid_data", success: false };
    }

    // Resolve user
    const userData = await getQuickReportData(adminDb, chatId);
    if (userData.error) {
        return { error: userData.error, success: false };
    }

    const userId = userData.userId;
    const now = new Date();
    const todayStr = now.toISOString().substring(0, 10);
    const batch = adminDb.batch();
    let updatedCount = 0;

    for (const report of taskReports) {
        const taskRef = adminDb.collection(paths.TASKS).doc(report.taskId);

        // Update task progress
        const taskUpdate = {
            progressPercent: report.progressPercent || 0,
            updatedAt: now.toISOString(),
            updatedBy: userId,
        };

        // If reported as blocked, update status
        if (report.blocked && report.blockerNote) {
            taskUpdate.blockedReason = report.blockerNote;
        }

        batch.update(taskRef, taskUpdate);

        // Update subtasks if provided
        if (report.subtasks && report.subtasks.length > 0) {
            for (const st of report.subtasks) {
                const stRef = adminDb.collection(paths.SUBTASKS).doc(st.id);
                batch.update(stRef, { completed: !!st.completed });
            }
        }

        // Create timeLog entry — but only if no web timer already logged hours today
        if (report.hoursWorked && report.hoursWorked > 0) {
            // Check if web timer already recorded hours for this task today
            let skipTimeLog = false;
            try {
                const existingLogsSnap = await adminDb.collection(paths.TIME_LOGS)
                    .where("taskId", "==", report.taskId)
                    .where("userId", "==", userId)
                    .get();

                existingLogsSnap.forEach(doc => {
                    const log = doc.data();
                    const logSource = log.source || "web";
                    if (logSource === "telegram" || logSource === "telegram_webapp") return;
                    if (!log.startTime) return;
                    const logDate = new Date(log.startTime).toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
                    if (logDate === todayStr && (log.totalHours || log.endTime === null)) {
                        skipTimeLog = true;
                    }
                });
            } catch (err) {
                console.warn("[quickReport] Timer check error:", err.message);
            }

            if (!skipTimeLog) {
                const timeLogRef = adminDb.collection(paths.TIME_LOGS).doc();
                batch.set(timeLogRef, {
                    taskId: report.taskId,
                    userId: userId,
                    date: todayStr,
                    totalHours: report.hoursWorked,
                    description: `Quick Report: ${report.progressPercent}%`,
                    source: "telegram_webapp",
                    createdAt: now.toISOString(),
                });
            } else {
                console.log(`[quickReport] SKIP timeLog: web timer already has hours for task ${report.taskId} today.`);
            }
        }

        updatedCount++;
    }

    // Create telegram report record
    const reportRef = adminDb.collection(paths.TELEGRAM_REPORTS).doc();
    batch.set(reportRef, {
        userId,
        chatId: String(chatId),
        reportDate: todayStr,
        source: "webapp_quick_report",
        tasksReported: updatedCount,
        note: note || null,
        createdAt: now.toISOString(),
    });

    await batch.commit();

    return {
        success: true,
        updatedCount,
        userName: userData.userName,
    };
}

/**
 * Create a quick task from the Mini App.
 * @param {Object} data - { chatId, title }
 * @returns {{ success, taskId, title }}
 */
async function createQuickTask(adminDb, data) {
    const { chatId, title } = data;
    if (!chatId || !title || !title.trim()) {
        return { error: "chatId and title are required", success: false };
    }

    // Resolve user from chatId
    const userData = await getQuickReportData(adminDb, chatId);
    if (userData.error) {
        return { error: userData.error, success: false };
    }

    const userId = userData.userId;
    const now = new Date();
    const todayStr = now.toISOString().substring(0, 10);

    const taskDoc = {
        title: title.trim(),
        description: "",
        status: "in_progress",
        priority: "medium",
        assignedTo: userId,
        progressPercent: 0,
        estimatedHours: 0,
        hoursWorked: 0,
        plannedStartDate: todayStr,
        dueDate: null,
        source: "telegram_webapp",
        createdBy: userId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    };

    const ref = await adminDb.collection(paths.TASKS).add(taskDoc);
    console.log(`[quickReport] Created task ${ref.id}: "${title}" for user ${userId}`);

    return {
        success: true,
        taskId: ref.id,
        title: title.trim(),
    };
}

module.exports = { getQuickReportData, submitQuickReport, createQuickTask };
