/**
 * Close Day Report Handler — Backend (CJS)
 * ==========================================
 * Automated end-of-day routine:
 *   1. Stop all active timers (autoStopped = true)
 *   2. Combine timer data + quick reports from the day
 *   3. Send individual report to each team member
 *   4. Send team summary to managers + team leads
 *
 * Triggered by: scheduledCloseDay (cron) or manual via admin panel
 */

const { sendToTargets, sendToUser } = require("../telegram/telegramProvider");
const templates = require("../telegram/telegramTemplates");
const paths = require("../automation/firestorePaths");
const { OPERATIONAL_ROLES } = require("../automation/constants");

/**
 * Execute the day close routine.
 */
async function execute(adminDb, token, targets, context) {
    const { dryRun, runId } = context;
    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
    const startOfDay = new Date(today + "T00:00:00-06:00");
    const endOfDay = new Date(today + "T23:59:59-06:00");

    // ── 1. Load all data ──
    const [timeLogsSnap, tasksSnap, projectsSnap, delaysSnap, reportsSnap] = await Promise.all([
        adminDb.collection(paths.TIME_LOGS).get(),
        adminDb.collection(paths.TASKS).get(),
        adminDb.collection(paths.PROJECTS).get(),
        adminDb.collection(paths.DELAYS).get(),
        adminDb.collection(paths.TELEGRAM_REPORTS).where("date", "==", today).get(),
    ]);

    const allTimeLogs = timeLogsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allProjects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allDelays = delaysSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const todayReports = reportsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // ── 2. Stop all active timers ──
    const activeTimers = allTimeLogs.filter(log => !log.endTime && log.startTime);
    let stoppedCount = 0;

    if (!dryRun) {
        for (const log of activeTimers) {
            try {
                const startTime = new Date(log.startTime);
                const totalMs = now - startTime;
                let totalHours = parseFloat((totalMs / 3600000).toFixed(6));
                if (totalHours < 0.016666) totalHours = 0.016666;

                await adminDb.collection(paths.TIME_LOGS).doc(log.id).update({
                    endTime: now.toISOString(),
                    totalHours,
                    autoStopped: true,
                    notes: (log.notes || "") + " [Auto-cerrado al cierre de día]",
                });

                // Recalculate task hours
                if (log.taskId) {
                    await recalculateTaskHours(adminDb, log.taskId);
                }
                stoppedCount++;
            } catch (err) {
                console.warn(`[closeDay] Error stopping timer ${log.id}:`, err.message);
            }
        }
    }

    console.log(`[closeDay] Stopped ${stoppedCount} timers`);

    // ── 3. Build per-user reports ──
    // Get all time logs for today (including just-stopped ones)
    const todayTimeLogs = allTimeLogs.filter(log => {
        if (!log.startTime) return false;
        const logStart = new Date(log.startTime);
        return logStart >= startOfDay && logStart <= endOfDay;
    });

    // Merge just-stopped timers
    for (const timer of activeTimers) {
        if (!todayTimeLogs.find(t => t.id === timer.id)) {
            todayTimeLogs.push({
                ...timer,
                endTime: now.toISOString(),
                totalHours: parseFloat(((now - new Date(timer.startTime)) / 3600000).toFixed(2)),
            });
        }
    }

    // Group time logs by user
    const userDataMap = {};
    todayTimeLogs.forEach(log => {
        const uid = log.userId;
        if (!uid) return;
        if (!userDataMap[uid]) {
            userDataMap[uid] = { totalHours: 0, overtimeHours: 0, taskMap: {}, logs: [] };
        }
        const ud = userDataMap[uid];
        ud.totalHours += (log.totalHours || 0);
        if (log.overtime) ud.overtimeHours += (log.overtimeHours || log.totalHours || 0);
        ud.logs.push(log);

        if (log.taskId) {
            if (!ud.taskMap[log.taskId]) {
                const task = allTasks.find(t => t.id === log.taskId);
                ud.taskMap[log.taskId] = { title: task?.title || "Tarea", hours: 0 };
            }
            ud.taskMap[log.taskId].hours += (log.totalHours || 0);
        }
    });

    // Count tasks completed today by user
    const completedToday = {};
    allTasks.forEach(task => {
        if (task.status === "completed" && task.completedDate) {
            const cd = new Date(task.completedDate);
            if (cd >= startOfDay && cd <= endOfDay && task.assignedTo) {
                completedToday[task.assignedTo] = (completedToday[task.assignedTo] || 0) + 1;
            }
        }
    });

    // Count delays reported today by user
    const delaysToday = {};
    allDelays.forEach(delay => {
        if (delay.createdAt) {
            const cd = new Date(delay.createdAt);
            if (cd >= startOfDay && cd <= endOfDay && delay.createdBy) {
                delaysToday[delay.createdBy] = (delaysToday[delay.createdBy] || 0) + 1;
            }
        }
    });

    // ── 4. Send individual reports ──
    const individualResults = { sentCount: 0, failedCount: 0, errors: [] };

    for (const target of targets) {
        const uid = target.uid;
        const userData = userDataMap[uid];
        const quickReport = todayReports.find(r => r.userId === uid);

        // Build tasks array for template
        const tasksList = userData ? Object.entries(userData.taskMap).map(([taskId, data]) => {
            const quickProgress = quickReport?.parsedData?.progress;
            return {
                title: data.title,
                hours: parseFloat(data.hours.toFixed(2)),
                progress: quickProgress || null,
            };
        }) : [];

        const msg = templates.closeDayIndividual({
            name: target.name,
            date: today,
            totalHours: parseFloat((userData?.totalHours || 0).toFixed(2)),
            overtimeHours: parseFloat((userData?.overtimeHours || 0).toFixed(2)),
            tasksCompleted: completedToday[uid] || 0,
            tasks: tasksList,
            delaysReported: delaysToday[uid] || 0,
            quickReport: quickReport ? {
                progress: quickReport.parsedData?.progress,
                blocker: quickReport.parsedData?.blocker || quickReport.blocker,
                notes: quickReport.rawText,
            } : null,
        });

        if (dryRun) {
            console.log(`[closeDay] DRY-RUN: Would send to ${target.name}`);
            individualResults.sentCount++;
            continue;
        }

        try {
            const result = await sendToUser(adminDb, token, uid, target.chatId, msg, {
                runId, routineKey: "close_day_report", dryRun: false,
            });
            if (result.ok) individualResults.sentCount++;
            else {
                individualResults.failedCount++;
                individualResults.errors.push(`${target.name}: ${result.error}`);
            }
        } catch (err) {
            individualResults.failedCount++;
            individualResults.errors.push(`${target.name}: ${err.message}`);
        }
    }

    // ── 5. Send team summary to managers + team leads ──
    const managersAndLeads = targets.filter(t =>
        [OPERATIONAL_ROLES.MANAGER, OPERATIONAL_ROLES.TEAM_LEAD].includes(t.operationalRole)
    );

    // Build team summary data
    const teamData = targets.map(t => {
        const ud = userDataMap[t.uid];
        const tasks = ud ? Object.values(ud.taskMap) : [];
        return {
            name: t.name,
            hours: parseFloat((ud?.totalHours || 0).toFixed(1)),
            tasksCompleted: completedToday[t.uid] || 0,
            topTasks: tasks.sort((a, b) => b.hours - a.hours).slice(0, 2).map(t => t.title),
            hasBlocker: !!allDelays.find(d => d.createdBy === t.uid && new Date(d.createdAt) >= startOfDay),
            quickReportMissing: !todayReports.find(r => r.userId === t.uid),
        };
    });

    const totalTeamHours = Object.values(userDataMap).reduce((sum, ud) => sum + ud.totalHours, 0);
    const totalTeamOT = Object.values(userDataMap).reduce((sum, ud) => sum + ud.overtimeHours, 0);
    const totalCompleted = Object.values(completedToday).reduce((sum, n) => sum + n, 0);
    const totalDelays = Object.values(delaysToday).reduce((sum, n) => sum + n, 0);
    const missingReports = targets.filter(t => !todayReports.find(r => r.userId === t.uid)).length;

    for (const mgr of managersAndLeads) {
        const msg = templates.closeDayTeamSummary({
            name: mgr.name,
            date: today,
            teamSize: targets.length,
            totalHours: parseFloat(totalTeamHours.toFixed(1)),
            overtimeHours: parseFloat(totalTeamOT.toFixed(1)),
            tasksCompleted: totalCompleted,
            delaysReported: totalDelays,
            missingReports,
            timersAutoStopped: stoppedCount,
            team: teamData,
        });

        if (!dryRun) {
            try {
                await sendToUser(adminDb, token, mgr.uid, mgr.chatId, msg, {
                    runId, routineKey: "close_day_report", dryRun: false,
                });
            } catch (err) {
                console.warn(`[closeDay] Error sending team summary to ${mgr.name}:`, err.message);
            }
        }
    }

    return {
        sentCount: individualResults.sentCount + managersAndLeads.length,
        failedCount: individualResults.failedCount,
        errors: individualResults.errors,
        stoppedTimers: stoppedCount,
    };
}

/**
 * Recalculate task actualHours from all completed time logs.
 */
async function recalculateTaskHours(adminDb, taskId) {
    try {
        const logsSnap = await adminDb.collection(paths.TIME_LOGS)
            .where("taskId", "==", taskId)
            .get();

        let totalHours = 0;
        logsSnap.docs.forEach(d => {
            const log = d.data();
            if (log.endTime && log.totalHours) {
                totalHours += log.totalHours;
            }
        });

        await adminDb.collection(paths.TASKS).doc(taskId).update({
            actualHours: parseFloat(totalHours.toFixed(2)),
        });
    } catch (err) {
        console.warn(`[closeDay] recalculate error for task ${taskId}:`, err.message);
    }
}

module.exports = { execute };
