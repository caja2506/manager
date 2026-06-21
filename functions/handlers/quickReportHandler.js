/**
 * Quick Report Handler — Backend (CJS)
 * ======================================
 * Cloud Function APIs for the Telegram Quick Report Mini App.
 * 
 * getQuickReportData: returns user's active tasks + subtasks for today
 * submitQuickReport: saves progress reports and updates task/subtask data
 */

const {
    loadAllUsers, loadUser, loadUserTasks, loadTaskSubtasks,
    loadTaskUserTimeLogs, updateTask, updateSubtask, insertTimeLog, insertTask,
    transitionTaskStatus,
} = require("../db/coreDataReader");
const { getSupabase } = require("../db/supabaseAdmin");

/**
 * Load active tasks + subtasks for a user identified by Telegram chatId.
 */
async function getQuickReportData(adminDb, chatId) {
    const chatIdStr = String(chatId);

    // ── 1. Find user by telegramChatId or providerLinks in Supabase ──
    const allUsers = await loadAllUsers();

    let foundUser = null;

    // Try direct telegramChatId match
    foundUser = allUsers.find(u => String(u.telegramChatId) === chatIdStr);

    // Try providerLinks.telegram.chatId
    if (!foundUser) {
        foundUser = allUsers.find(u => {
            const linkedChatId = u.providerLinks?.telegram?.chatId;
            return linkedChatId && String(linkedChatId) === chatIdStr;
        });
    }

    // ── 2. Fallback: try telegram_sessions (Supabase) ──
    if (!foundUser) {
        const sb = getSupabase();
        const { data: session, error } = await sb.from("telegram_sessions")
            .select("user_id")
            .eq("chat_id", chatIdStr)
            .maybeSingle();

        if (!error && session && session.user_id) {
            foundUser = await loadUser(session.user_id);
        }
    }

    if (!foundUser) {
        console.warn(`[quickReport] User not found for chatId: ${chatIdStr}`);
        return { error: "user_not_found", tasks: [] };
    }

    return await buildReportData(foundUser.id, foundUser);
}

async function buildReportData(userId, userData) {
    const today = new Date().toISOString().substring(0, 10);
    const TERMINAL = ["completed", "cancelled"];

    // ── Get all tasks assigned to this user from Supabase ──
    const allTasks = await loadUserTasks(userId);

    // Filter to active tasks relevant for today
    const todayTasks = allTasks.filter(t => {
        if (TERMINAL.includes(t.status)) return false;
        const startDate = t.plannedStartDate ? String(t.plannedStartDate).substring(0, 10) : null;
        if (startDate && startDate > today) return false;
        return true;
    });

    // ── Get subtasks for these tasks from Supabase ──
    const subtasksByTask = {};
    for (const task of todayTasks) {
        const subs = await loadTaskSubtasks(task.id);
        if (subs.length > 0) subtasksByTask[task.id] = subs;
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
        userName: userData.displayName || userData.name || userData.email || userId,
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
    let updatedCount = 0;

    for (const report of taskReports) {
        // Update task progress in Supabase
        const taskUpdate = {
            progressPercent: report.progressPercent || 0,
            updatedBy: userId,
        };

        // If reported as blocked, update status
        if (report.blocked && report.blockerNote) {
            taskUpdate.blockedReason = report.blockerNote;
        }

        await updateTask(report.taskId, taskUpdate);

        // Transition to blocked via RPC if reported as blocked
        if (report.blocked) {
            try {
                await transitionTaskStatus(
                    report.taskId,
                    "blocked",
                    userId,
                    userData.userName || "",
                    false,
                    report.blockerNote || null
                );
                console.log(`[quickReport] Transited task ${report.taskId} to blocked via RPC`);
            } catch (err) {
                console.error(`[quickReport] Error transiting task ${report.taskId} to blocked:`, err.message);
            }
        }

        // Update subtasks in Supabase if provided
        if (report.subtasks && report.subtasks.length > 0) {
            for (const st of report.subtasks) {
                await updateSubtask(st.id, { completed: !!st.completed });
            }
        }

        // Create timeLog entry in Supabase — but only if no web timer already logged hours today
        if (report.hoursWorked && report.hoursWorked > 0) {
            let skipTimeLog = false;
            try {
                const existingLogs = await loadTaskUserTimeLogs(report.taskId, userId);

                for (const log of existingLogs) {
                    const logSource = log.source || "web";
                    if (logSource === "telegram" || logSource === "telegram_webapp") continue;
                    if (!log.startTime) continue;
                    const logDate = new Date(log.startTime).toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
                    if (logDate === todayStr && (log.totalHours || log.endTime === null)) {
                        skipTimeLog = true;
                        break;
                    }
                }
            } catch (err) {
                console.warn("[quickReport] Timer check error:", err.message);
            }

            if (!skipTimeLog) {
                await insertTimeLog({
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

    // Create telegram report record in Supabase
    const sb = getSupabase();
    const reportContent = {
        source: "webapp_quick_report",
        tasksReported: updatedCount,
        note: note || null,
    };
    const { error: reportError } = await sb.from("telegram_reports").insert({
        user_id: userId,
        report_type: "quick_report",
        content: JSON.stringify(reportContent),
        sent_at: now.toISOString(),
        created_at: now.toISOString(),
    });

    if (reportError) {
        console.error("[quickReport] Error writing telegram report to Supabase:", reportError.message);
    }

    return {
        success: true,
        updatedCount,
        userName: userData.userName,
    };
}

/**
 * Create a quick task from the Mini App.
 * @param {Object} data - { chatId, title }
 * @returns {Promise<{ success: boolean, taskId?: string, title?: string, error?: string }>}
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

    // Insert task in Supabase
    const task = await insertTask({
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
    });

    if (!task) {
        return { error: "Failed to create task", success: false };
    }

    console.log(`[quickReport] Created task ${task.id}: "${title}" for user ${userId}`);

    return {
        success: true,
        taskId: task.id,
        title: title.trim(),
    };
}

module.exports = { getQuickReportData, submitQuickReport, createQuickTask };

