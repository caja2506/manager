/**
 * Daily Performance Report Handler — V2 "Manager Briefing"
 * =========================================================
 * Generates a USEFUL daily report that answers 5 questions:
 *   1. ¿Quién trabajó y quién no? (presencia efectiva)
 *   2. ¿Se avanzó lo planificado? (plan vs realidad)
 *   3. ¿Dónde están los problemas? (alertas accionables)
 *   4. ¿Qué se logró concretamente? (logros del día)
 *   5. ¿Qué debo decidir mañana? (vista del mañana)
 *
 * @module handlers/dailyPerformanceReportHandler
 */

const paths = require("../automation/firestorePaths");
const { OPERATIONAL_ROLES } = require("../automation/constants");
const { sendAndLogEmail } = require("../email/emailProvider");
const { dailyPerformanceReport } = require("../email/emailTemplates");
const { sendToUser } = require("../telegram/telegramProvider");

// ── Break bands (must match frontend breakTimeUtils.js) ──
const BREAK_BANDS = [
    { start: 8, end: 8.5 },   // Desayuno 30min
    { start: 12, end: 13 },   // Almuerzo 60min
    { start: 15.5, end: 16 }, // Café 30min
];
const DAILY_AVAILABLE_HOURS = 8; // 7:00-17:00 minus 2h breaks = 8h effective

/**
 * Execute the daily performance report routine.
 */
async function execute(adminDb, token, targets, context) {
    const { dryRun, runId, options = {} } = context;
    const now = new Date();

    // Allow manual date override for testing
    const today = options.reportDate || now.toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
    const startOfDay = new Date(today + "T00:00:00-06:00");
    const endOfDay = new Date(today + "T23:59:59-06:00");

    // Tomorrow (relative to report date)
    const tomorrowDate = new Date(startOfDay);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toLocaleDateString("en-CA");

    // Yesterday range (for comments)
    const ydDate = new Date(startOfDay);
    ydDate.setDate(ydDate.getDate() - 1);
    if (ydDate.getDay() === 0) ydDate.setDate(ydDate.getDate() - 2);
    if (ydDate.getDay() === 6) ydDate.setDate(ydDate.getDate() - 1);
    const yesterdayStart = new Date(ydDate.toLocaleDateString("en-CA") + "T00:00:00-06:00");
    const yesterdayEnd = new Date(ydDate.toLocaleDateString("en-CA") + "T23:59:59-06:00");

    console.log(`[perfReport] Building V2 report for ${today} (override: ${!!options.reportDate})...`);

    // ══════════════════════════════════════════
    // 1. LOAD ALL DATA
    // ══════════════════════════════════════════
    const [
        tasksSnap, timeLogsSnap, delaysSnap, usersSnap,
        subtasksSnap, planItemsTodaySnap, planItemsTomorrowSnap,
        telegramReportsSnap, commentsSnap, yesterdayCommentsSnap,
        projectsSnap,
    ] = await Promise.all([
        adminDb.collection(paths.TASKS).get(),
        adminDb.collection(paths.TIME_LOGS).get(),
        adminDb.collection(paths.DELAYS).get(),
        adminDb.collection(paths.USERS).get(),
        adminDb.collection(paths.SUBTASKS).get(),
        adminDb.collection("weeklyPlanItems").where("date", "==", today).get(),
        adminDb.collection("weeklyPlanItems").where("date", "==", tomorrow).get(),
        adminDb.collection(paths.TELEGRAM_REPORTS)
            .where("reportDate", "==", today).get(),
        // Fetch today's comments
        adminDb.collectionGroup("comments")
            .where("createdAt", ">=", startOfDay.toISOString())
            .where("createdAt", "<=", endOfDay.toISOString())
            .get(),
        // Fetch yesterday's comments
        adminDb.collectionGroup("comments")
            .where("createdAt", ">=", yesterdayStart.toISOString())
            .where("createdAt", "<=", yesterdayEnd.toISOString())
            .get(),
        adminDb.collection(paths.PROJECTS).get(),
    ]);

    const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allTimeLogs = timeLogsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allDelays = delaysSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allUsers = usersSnap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }));
    const allSubtasks = subtasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const planItemsToday = planItemsTodaySnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const planItemsTomorrow = planItemsTomorrowSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const telegramReportsToday = telegramReportsSnap.docs.map(d => d.data());
    const todayComments = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const yesterdayComments = yesterdayCommentsSnap.docs.map(d => {
        // Extract taskId from the doc path: tasks/{taskId}/comments/{commentId}
        const pathParts = d.ref.path.split('/');
        const taskId = pathParts.length >= 2 ? pathParts[pathParts.length - 3] : null;
        return { id: d.id, taskId, ...d.data() };
    });
    const allProjects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`[perfReport] Loaded: ${allTasks.length} tasks, ${allTimeLogs.length} timeLogs, ${allSubtasks.length} subtasks, ${allProjects.length} projects, ${planItemsToday.length} planItems today, ${planItemsTomorrow.length} tomorrow, ${todayComments.length} comments today, ${yesterdayComments.length} comments yesterday`);

    // ══════════════════════════════════════════
    // 2. BUILD REPORT DATA
    // ══════════════════════════════════════════
    const reportData = buildReportData({
        today, tomorrow, now, startOfDay, endOfDay,
        allTasks, allTimeLogs, allDelays, allUsers, allSubtasks,
        planItemsToday, planItemsTomorrow, telegramReportsToday,
        todayComments, yesterdayComments, allProjects,
    });

    console.log(`[perfReport] Report built: ${reportData.pulseOfDay.hoursReal}h real / ${reportData.pulseOfDay.hoursPlanned}h planned, ${reportData.teamNarratives.length} members, ${reportData.productivityAlerts.length} alerts`);

    // ══════════════════════════════════════════
    // 3. LOAD REPORT CONFIG
    // ══════════════════════════════════════════
    let config = {
        channels: { email: true, telegramPdf: true },
        recipients: [],
    };

    try {
        const configSnap = await adminDb.collection(paths.SETTINGS).doc("emailReportConfig").get();
        if (configSnap.exists) config = { ...config, ...configSnap.data() };
    } catch (err) {
        console.warn("[perfReport] No config found:", err.message);
    }

    // ══════════════════════════════════════════
    // 4. DELIVER: Email
    // ══════════════════════════════════════════
    let emailResult = { ok: false, skipped: true };

    if (config.channels?.email && config.recipients?.length > 0) {
        if (dryRun) {
            console.log(`[perfReport] DRY-RUN: Would email to ${config.recipients.join(", ")}`);
            emailResult = { ok: true, dryRun: true };
        } else {
            const resendApiKey = options.resendApiKey;
            if (resendApiKey) {
                const html = dailyPerformanceReport(reportData);
                emailResult = await sendAndLogEmail(adminDb, resendApiKey, {
                    to: config.recipients,
                    subject: `📊 Passdown AME CR — ${reportData.datePretty}`,
                    html,
                }, { routineKey: "daily_performance_report", runId });
            } else {
                emailResult = { ok: false, error: "No API key" };
            }
        }
    }

    // ══════════════════════════════════════════
    // 5. DELIVER: Telegram
    // ══════════════════════════════════════════
    let telegramResult = { sentCount: 0, failedCount: 0, errors: [] };

    if (config.channels?.telegramPdf !== false) {
        const managersAndLeads = targets.filter(t =>
            [OPERATIONAL_ROLES.MANAGER, OPERATIONAL_ROLES.TEAM_LEAD].includes(t.operationalRole)
        );

        const summaryMsg = buildTelegramSummary(reportData);

        for (const mgr of managersAndLeads) {
            if (dryRun) {
                console.log(`[perfReport] DRY-RUN: Would send Telegram to ${mgr.name}`);
                telegramResult.sentCount++;
                continue;
            }
            try {
                const result = await sendToUser(adminDb, token, mgr.uid, mgr.chatId, summaryMsg, {
                    runId, routineKey: "daily_performance_report", dryRun: false,
                });
                if (result.ok) telegramResult.sentCount++;
                else {
                    telegramResult.failedCount++;
                    telegramResult.errors.push(`${mgr.name}: ${result.error}`);
                }
            } catch (err) {
                telegramResult.failedCount++;
                telegramResult.errors.push(`${mgr.name}: ${err.message}`);
            }
        }
    }

    // ══════════════════════════════════════════
    // 5.5 PERSIST NOTIFICATIONS TO FIRESTORE
    // ══════════════════════════════════════════
    if (!dryRun) {
        try {
            const notifBatch = adminDb.batch();
            let notifCount = 0;
            const notifCollection = adminDb.collection(paths.NOTIFICATIONS);
            const todayStr = now.toISOString().substring(0, 10);

            // Helper: create a notification doc
            const addNotif = (userId, type, title, message, metadata = {}) => {
                if (!userId) return;
                const ref = notifCollection.doc();
                notifBatch.set(ref, {
                    userId,
                    type,
                    title,
                    message,
                    read: false,
                    createdAt: now.toISOString(),
                    ruleKey: `${type}_${todayStr}`,
                    ...metadata,
                });
                notifCount++;
            };

            // A) Overdue tasks → notify assignee
            for (const t of reportData.overdueTasks) {
                const task = allTasks.find(tk => tk.title === t.title);
                if (task?.assignedTo) {
                    addNotif(
                        task.assignedTo,
                        'risk_alert',
                        `Tarea vencida: ${t.title}`,
                        `Venció hace ${t.daysOverdue} día${t.daysOverdue !== 1 ? 's' : ''}. Actualiza el estado o solicita extensión.`,
                        { taskId: task.id, entityId: task.id }
                    );
                }
            }

            // B) Blocked tasks → notify assignee
            if (reportData.pulseOfDay.blockedTasks > 0) {
                const blocked = allTasks.filter(t => t.status === 'blocked');
                for (const task of blocked) {
                    if (task.assignedTo) {
                        addNotif(
                            task.assignedTo,
                            'task_blocked',
                            `Tarea bloqueada: ${task.title}`,
                            'Registra la causa del bloqueo y solicita apoyo si es necesario.',
                            { taskId: task.id, entityId: task.id }
                        );
                    }
                }
            }

            // C) Productivity alerts → notify the person
            for (const alert of reportData.productivityAlerts) {
                const userDoc = allUsers.find(u => u.displayName === alert.name);
                if (userDoc?.id) {
                    addNotif(
                        userDoc.id,
                        alert.severity === 'critical' ? 'audit_critical' : 'audit_warning',
                        `Revisión de productividad`,
                        `${alert.hours}h registradas. ${alert.details.join(' ')}`,
                        { entityId: userDoc.id }
                    );
                }
            }

            // D) Tasks with no hours in 3 days → notify assignee
            const threeDaysAgo = new Date(now);
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            const inProgressTasks = allTasks.filter(t => t.status === 'in_progress');
            
            for (const task of inProgressTasks) {
                if (!task.assignedTo) continue;
                const hasRecentLog = allTimeLogs.some(log =>
                    log.taskId === task.id &&
                    log.userId === task.assignedTo &&
                    log.startTime &&
                    new Date(log.startTime) >= threeDaysAgo
                );
                if (!hasRecentLog) {
                    addNotif(
                        task.assignedTo,
                        'reminder',
                        `Sin registro de horas: ${task.title}`,
                        'Llevas 3+ días sin registrar horas en esta tarea. Actualiza tu progreso.',
                        { taskId: task.id, entityId: task.id }
                    );
                }
            }

            if (notifCount > 0) {
                await notifBatch.commit();
                console.log(`[perfReport] Persisted ${notifCount} notifications to Firestore`);
            }
        } catch (err) {
            console.warn("[perfReport] Failed to persist notifications:", err.message);
        }
    }

    // ══════════════════════════════════════════
    // 6. LOG
    // ══════════════════════════════════════════
    if (!dryRun) {
        try {
            await adminDb.collection(paths.SETTINGS).doc("emailReportConfig").set({
                lastSentAt: now.toISOString(),
            }, { merge: true });
        } catch (err) {
            console.warn("[perfReport] Failed to update lastSentAt:", err.message);
        }
    }

    return {
        sentCount: telegramResult.sentCount + (emailResult.ok ? 1 : 0),
        failedCount: telegramResult.failedCount + (emailResult.ok ? 0 : (emailResult.skipped ? 0 : 1)),
        errors: telegramResult.errors,
        emailSent: emailResult.ok,
        telegramSent: telegramResult.sentCount,
    };
}

// ═══════════════════════════════════════════════
// DATA BUILDER — V2
// ═══════════════════════════════════════════════

function buildReportData({
    today, tomorrow, now, startOfDay, endOfDay,
    allTasks, allTimeLogs, allDelays, allUsers, allSubtasks,
    planItemsToday, planItemsTomorrow, telegramReportsToday,
    todayComments = [],
    yesterdayComments = [],
    allProjects = [],
}) {
    // ── Active team: users with operational roles (exclude manager from report) ──
    const teamUsers = allUsers.filter(u =>
        u.operationalRole && !["none", "viewer", "manager"].includes(u.operationalRole)
    );

    // ── Project name map ──
    const projectMap = {};
    allProjects.forEach(p => { projectMap[p.id] = p.name || p.title || '?'; });

    // ── Tasks by status ──
    const activeTasks = allTasks.filter(t => !["completed", "cancelled"].includes(t.status));
    const blockedTasks = allTasks.filter(t => t.status === "blocked");
    const completedToday = allTasks.filter(t => {
        if (t.status !== "completed" || !t.completedDate) return false;
        const cd = new Date(t.completedDate);
        return cd >= startOfDay && cd <= endOfDay;
    });

    // ── Overdue tasks ──
    const overdueTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < now)
        .map(t => {
            const user = allUsers.find(u => u.id === t.assignedTo);
            return {
                title: t.title,
                assignedTo: user?.displayName || user?.name || t.assignedTo || "Sin asignar",
                dueDate: t.dueDate,
                daysOverdue: Math.ceil((now - new Date(t.dueDate)) / 86400000),
                priority: t.priority || "medium",
            };
        })
        .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // ── Subtasks by taskId ──
    const subtasksByTask = {};
    for (const st of allSubtasks) {
        if (!subtasksByTask[st.taskId]) subtasksByTask[st.taskId] = [];
        subtasksByTask[st.taskId].push(st);
    }

    // ── Subtasks completed TODAY ──
    const subtasksCompletedToday = allSubtasks.filter(st => {
        if (!st.completed || !st.completedAt) return false;
        const ca = new Date(st.completedAt);
        return ca >= startOfDay && ca <= endOfDay;
    }).map(st => {
        const parentTask = allTasks.find(t => t.id === st.taskId);
        const assignee = parentTask ? allUsers.find(u => u.id === parentTask.assignedTo) : null;
        return {
            id: st.id,
            title: st.title || st.name || 'Sin título',
            taskId: st.taskId,
            parentTaskTitle: parentTask?.title || 'Tarea desconocida',
            completedBy: assignee?.displayName || assignee?.name || 'Desconocido',
            completedByUid: parentTask?.assignedTo || null,
            completedAt: st.completedAt,
        };
    });

    // ── Time logs today ──
    const todayTimeLogs = allTimeLogs.filter(log => {
        if (!log.startTime && !log.date) return false;
        if (log.date) return log.date === today;
        const logStart = new Date(log.startTime);
        return logStart >= startOfDay && logStart <= endOfDay;
    });

    // ── Hours by user today ──
    const userHoursMap = {};
    const userTimeRanges = {}; // track first/last times
    todayTimeLogs.forEach(log => {
        const uid = log.userId;
        if (!uid) return;
        if (!userHoursMap[uid]) userHoursMap[uid] = 0;
        userHoursMap[uid] += (log.totalHours || 0);

        // Track connection times
        if (log.startTime) {
            if (!userTimeRanges[uid]) userTimeRanges[uid] = { first: log.startTime, last: log.startTime };
            if (log.startTime < userTimeRanges[uid].first) userTimeRanges[uid].first = log.startTime;
            const endTime = log.endTime || log.startTime;
            if (endTime > userTimeRanges[uid].last) userTimeRanges[uid].last = endTime;
        }
    });

    // ── Planned hours today by user ──
    const userPlannedMap = {};
    const userPlannedTasks = {}; // taskIds planned for today per user
    planItemsToday.forEach(pi => {
        const uid = pi.assignedTo;
        if (!uid) return;
        if (!userPlannedMap[uid]) userPlannedMap[uid] = 0;
        userPlannedMap[uid] += (pi.plannedHours || 0);
        if (!userPlannedTasks[uid]) userPlannedTasks[uid] = new Set();
        userPlannedTasks[uid].add(pi.taskId);
    });

    // ── Telegram reports today ──
    const usersWhoReported = new Set(telegramReportsToday.map(r => r.userId));

    // ── Delays today ──
    const delaysToday = allDelays.filter(d => {
        if (!d.createdAt) return false;
        const cd = new Date(d.createdAt);
        return cd >= startOfDay && cd <= endOfDay;
    });

    // ══════════════════════════════════════════
    // SECTION 1: PULSO DEL DÍA
    // ══════════════════════════════════════════
    const totalHoursReal = Object.values(userHoursMap).reduce((s, h) => s + h, 0);
    const totalHoursPlanned = Object.values(userPlannedMap).reduce((s, h) => s + h, 0);
    const teamSize = teamUsers.length;
    const totalExpectedHours = teamSize * DAILY_AVAILABLE_HOURS;

    // Subtask stats
    const activeTaskIds = new Set(activeTasks.map(t => t.id));
    let totalSubtasks = 0;
    let completedSubtasks = 0;
    for (const [taskId, subs] of Object.entries(subtasksByTask)) {
        if (activeTaskIds.has(taskId)) {
            totalSubtasks += subs.length;
            completedSubtasks += subs.filter(s => s.completed).length;
        }
    }

    const pulseOfDay = {
        hoursReal: parseFloat(totalHoursReal.toFixed(1)),
        hoursPlanned: parseFloat(totalHoursPlanned.toFixed(1)),
        hoursExpected: totalExpectedHours,
        teamSize: teamSize,
        dailyHours: DAILY_AVAILABLE_HOURS,
        hoursPct: totalExpectedHours > 0 ? Math.round((totalHoursReal / totalExpectedHours) * 100) : 0,
        tasksCompletedToday: completedToday.length,
        activeTasks: activeTasks.length,
        blockedTasks: blockedTasks.length,
        delaysToday: delaysToday.length,
        subtasksTotal: totalSubtasks,
        subtasksCompleted: completedSubtasks,
        subtasksPct: totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0,
        subtasksCompletedToday: subtasksCompletedToday.length,
        newOverdue: overdueTasks.filter(t => t.daysOverdue <= 1).length,
    };

    // ══════════════════════════════════════════
    // SECTION 2: NARRATIVA POR PERSONA
    // ══════════════════════════════════════════
    const teamNarratives = teamUsers.map(user => {
        const uid = user.id;
        const hours = parseFloat((userHoursMap[uid] || 0).toFixed(1));
        const plannedHours = parseFloat((userPlannedMap[uid] || 0).toFixed(1));
        const planPct = plannedHours > 0 ? Math.round((hours / plannedHours) * 100) : (hours > 0 ? 100 : 0);

        // Tasks this user worked on today (from timeLogs)
        const userTaskIds = new Set();
        todayTimeLogs.filter(l => l.userId === uid && l.taskId).forEach(l => userTaskIds.add(l.taskId));

        // Hours per task
        const hoursByTask = {};
        todayTimeLogs.filter(l => l.userId === uid && l.taskId).forEach(l => {
            hoursByTask[l.taskId] = (hoursByTask[l.taskId] || 0) + (l.totalHours || 0);
        });

        const workedOnTasks = [...userTaskIds].map(tid => {
            const task = allTasks.find(t => t.id === tid);
            const taskSubs = subtasksByTask[tid] || [];
            const taskSubsCompleted = taskSubs.filter(s => s.completed).length;
            const taskSubsPct = taskSubs.length > 0 ? Math.round((taskSubsCompleted / taskSubs.length) * 100) : null;

            // Health score calculation (0-100)
            let score = 50; // base
            if (task?.plannedStartDate) score += 5;
            if (task?.plannedEndDate) score += 5;
            if (task?.dueDate) score += 5;
            if (task?.estimatedHours > 0) score += 5;
            if (taskSubs.length > 0) {
                score += Math.round((taskSubsCompleted / taskSubs.length) * 20); // up to +20
            } else {
                score += 10; // no subtasks = neutral
            }
            if (task?.percentComplete >= 50) score += 5;
            if (task?.percentComplete >= 80) score += 5;
            if (task?.priority === 'critical' || task?.priority === 'high') score += 0; // no bonus
            if (task?.status === 'blocked') score -= 15;
            if (task?.dueDate && new Date(task.dueDate) < now) score -= 10; // overdue penalty
            score = Math.max(0, Math.min(100, score));

            return {
                id: tid,
                title: task?.title || tid,
                hours: parseFloat((hoursByTask[tid] || 0).toFixed(1)),
                score,
                percentComplete: task?.percentComplete ?? 0,
                subtasksTotal: taskSubs.length,
                subtasksCompleted: taskSubsCompleted,
                subtasksPct: taskSubsPct,
                status: task?.status || 'unknown',
            };
        }).sort((a, b) => b.hours - a.hours);

        // Completed today
        const completedByUser = completedToday.filter(t => t.assignedTo === uid);

        // Include both active tasks AND tasks completed today for accurate subtask counts
        const userActiveTasks = activeTasks.filter(t => t.assignedTo === uid);
        const userCompletedToday = completedToday.filter(t => t.assignedTo === uid);
        const userAllRelevantTasks = [...userActiveTasks, ...userCompletedToday];
        let userSubtasksTotal = 0;
        let userSubtasksCompleted = 0;
        for (const t of userAllRelevantTasks) {
            const subs = subtasksByTask[t.id] || [];
            userSubtasksTotal += subs.length;
            userSubtasksCompleted += subs.filter(s => s.completed).length;
        }
        const userSubtasksPct = userSubtasksTotal > 0 ? Math.round((userSubtasksCompleted / userSubtasksTotal) * 100) : 0;

        // Subtasks completed TODAY by this user (through their assigned tasks)
        const userSubtasksToday = subtasksCompletedToday
            .filter(st => st.completedByUid === uid)
            .slice(0, 15);

        // Active hours (first/last timer) — fixed timezone
        const timeRange = userTimeRanges[uid];
        let activeHoursStr = "";
        if (timeRange) {
            try {
                const first = new Date(timeRange.first);
                const last = new Date(timeRange.last);
                const tz = "America/Costa_Rica";
                const fmtTime = (d) => {
                    const h = d.toLocaleString("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
                    return h;
                };
                activeHoursStr = `${fmtTime(first)} - ${fmtTime(last)}`;
            } catch { /* skip */ }
        }

        // Reported via Telegram?
        const reported = usersWhoReported.has(uid);

        // Status emoji
        let statusEmoji = "⚪";
        if (hours >= 6 && planPct >= 80) statusEmoji = "🟢";
        else if (hours >= 4) statusEmoji = "🟡";
        else if (hours > 0) statusEmoji = "🟠";
        else statusEmoji = "🔴";

        return {
            uid,
            name: user.displayName || user.name || user.email || uid,
            role: user.operationalRole || "unknown",
            hours,
            plannedHours,
            planPct,
            workedOnTasks,
            completedTasks: completedByUser.map(t => t.title),
            subtasksTotal: userSubtasksTotal,
            subtasksCompleted: userSubtasksCompleted,
            subtasksPct: userSubtasksPct,
            subtasksCompletedTodayList: userSubtasksToday,
            activeHoursStr,
            reported,
            statusEmoji,
            activeTasks: userActiveTasks.length,
        };
    }).sort((a, b) => b.hours - a.hours);

    // ══════════════════════════════════════════
    // SECTION 3: ALERTAS ACCIONABLES
    // ══════════════════════════════════════════
    const actionableAlerts = [];

    // Blocked tasks > 3 days
    blockedTasks.forEach(t => {
        const blockedSince = t.blockedAt || t.updatedAt;
        if (blockedSince) {
            const daysBlocked = Math.ceil((now - new Date(blockedSince)) / 86400000);
            if (daysBlocked >= 3) {
                const user = allUsers.find(u => u.id === t.assignedTo);
                const taskSubs = subtasksByTask[t.id] || [];
                const completedSubs = taskSubs.filter(s => s.completed);
                const pendingSubs = taskSubs.filter(s => !s.completed);
                actionableAlerts.push({
                    severity: "critical",
                    icon: "🔴",
                    text: `"${t.title}" lleva ${daysBlocked} días bloqueada`,
                    detail: `Responsable: ${user?.displayName || "Sin asignar"}${t.blockedReason ? ` | Razón: ${t.blockedReason}` : ""}`,
                    action: "Desbloquear o reasignar",
                    projectName: t.projectId ? (projectMap[t.projectId] || null) : null,
                    subtasks: {
                        total: taskSubs.length,
                        completed: completedSubs.length,
                        pending: pendingSubs.length,
                        completedList: completedSubs.slice(0, 3).map(s => s.title || s.name || '?'),
                        pendingList: pendingSubs.slice(0, 5).map(s => s.title || s.name || '?'),
                    },
                });
            }
        }
    });

    // Overdue > 5 days
    overdueTasks.filter(t => t.daysOverdue >= 5).forEach(t => {
        const origTask = activeTasks.find(at => at.title === t.title);
        const taskSubs = origTask ? (subtasksByTask[origTask.id] || []) : [];
        const completedSubs = taskSubs.filter(s => s.completed);
        const pendingSubs = taskSubs.filter(s => !s.completed);
        actionableAlerts.push({
            severity: "high",
            icon: "🟠",
            text: `"${t.title}" venció hace ${t.daysOverdue} días`,
            detail: `Responsable: ${t.assignedTo}`,
            action: "Cerrar, reprogramar o cancelar",
            projectName: origTask?.projectId ? (projectMap[origTask.projectId] || null) : null,
            subtasks: {
                total: taskSubs.length,
                completed: completedSubs.length,
                pending: pendingSubs.length,
                completedList: completedSubs.slice(0, 3).map(s => s.title || s.name || '?'),
                pendingList: pendingSubs.slice(0, 5).map(s => s.title || s.name || '?'),
            },
        });
    });

    // Overloaded tomorrow
    Object.entries(userPlannedMap).forEach(([uid]) => {
        // Check tomorrow's load
        const tomorrowHours = planItemsTomorrow
            .filter(pi => pi.assignedTo === uid)
            .reduce((s, pi) => s + (pi.plannedHours || 0), 0);
        if (tomorrowHours > DAILY_AVAILABLE_HOURS) {
            const user = allUsers.find(u => u.id === uid);
            actionableAlerts.push({
                severity: "medium",
                icon: "🟡",
                text: `${user?.displayName || uid} tiene ${tomorrowHours.toFixed(1)}h planificadas mañana`,
                detail: `Capacidad: ${DAILY_AVAILABLE_HOURS}h`,
                action: "Reasignar o repriorizar",
            });
        }
    });

    actionableAlerts.sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2 };
        return (order[a.severity] || 3) - (order[b.severity] || 3);
    });

    // ══════════════════════════════════════════
    // SECTION 3.5: ALERTAS DE PRODUCTIVIDAD
    // ══════════════════════════════════════════
    const productivityAlerts = [];

    for (const narrative of teamNarratives) {
        if (narrative.hours < 6) continue; // Solo si registró muchas horas

        let flags = 0;
        const details = [];

        if (narrative.subtasksCompleted === 0 && narrative.subtasksTotal > 0) {
            flags++;
            details.push(`❌ Subtareas completadas: 0/${narrative.subtasksTotal}`);
        }
        if (narrative.completedTasks.length === 0) {
            flags++;
            details.push("❌ Tareas completadas: 0");
        }
        if (!narrative.reported) {
            flags++;
            details.push("❌ No envió reporte diario");
        }

        // Only flag if ≥2 conditions met
        if (flags >= 2) {
            productivityAlerts.push({
                name: narrative.name,
                hours: narrative.hours,
                severity: narrative.hours >= 8 && flags >= 3 ? "critical" : "high",
                details,
                workedOn: narrative.workedOnTasks.slice(0, 2).map(t => t.title).join(", ") || "Sin registro",
                action: "Verificar avance real o necesidad de apoyo",
            });
        }
    }

    // ══════════════════════════════════════════
    // SECTION 4: VISTA DEL MAÑANA
    // ══════════════════════════════════════════
    const tomorrowPlannedUsers = new Set(planItemsTomorrow.map(pi => pi.assignedTo).filter(Boolean));
    const tomorrowTotalHours = planItemsTomorrow.reduce((s, pi) => s + (pi.plannedHours || 0), 0);
    const tasksDueTomorrow = activeTasks.filter(t => {
        if (!t.dueDate) return false;
        return t.dueDate.substring(0, 10) === tomorrow;
    }).map(t => {
        const user = allUsers.find(u => u.id === t.assignedTo);
        return {
            title: t.title,
            assignedTo: user?.displayName || "Sin asignar",
        };
    });
    const unassignedTasks = activeTasks.filter(t => !t.assignedTo).length;

    const tomorrowView = {
        date: tomorrow,
        plannedUsers: tomorrowPlannedUsers.size,
        totalHours: parseFloat(tomorrowTotalHours.toFixed(1)),
        tasksDueTomorrow,
        unassignedTasks,
    };

    // ══════════════════════════════════════════
    // SECTION 5: LOGROS DEL DÍA
    // ══════════════════════════════════════════
    const achievements = completedToday.map(t => {
        const user = allUsers.find(u => u.id === t.assignedTo);
        return {
            title: t.title,
            completedBy: user?.displayName || "Desconocido",
        };
    });

    // ══════════════════════════════════════════
    // SECTION 6: COMENTARIOS DEL DÍA
    // ══════════════════════════════════════════
    const commentsByTask = [];
    if (todayComments.length > 0) {
        // Group comments by taskId
        const grouped = {};
        for (const c of todayComments) {
            if (!c.taskId) continue;
            if (!grouped[c.taskId]) grouped[c.taskId] = [];
            grouped[c.taskId].push(c);
        }
        // Map groups to { taskTitle, comments: [{ userName, text, time }] }
        for (const [taskId, cmts] of Object.entries(grouped)) {
            const task = allTasks.find(t => t.id === taskId);
            const sortedCmts = cmts.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
            commentsByTask.push({
                taskTitle: task?.title || 'Tarea desconocida',
                taskId,
                comments: sortedCmts.map(c => ({
                    userName: c.userName || 'Desconocido',
                    text: c.text || '',
                    time: c.createdAt ? new Date(c.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
                })),
            });
        }
        // Sort by number of comments desc
        commentsByTask.sort((a, b) => b.comments.length - a.comments.length);
    }

    // ══════════════════════════════════════════
    // SECTION 7: DAILY SCRUM TABLE DATA
    // ══════════════════════════════════════════
    // Yesterday (skip weekends)
    const yd = new Date(startOfDay);
    yd.setDate(yd.getDate() - 1);
    if (yd.getDay() === 0) yd.setDate(yd.getDate() - 2);
    if (yd.getDay() === 6) yd.setDate(yd.getDate() - 1);
    const yesterdayStr = yd.toLocaleDateString("en-CA");
    const ydStart = new Date(yesterdayStr + "T00:00:00-06:00");
    const ydEnd = new Date(yesterdayStr + "T23:59:59-06:00");

    // Yesterday's time logs (for Ayer (h) column)
    const yesterdayTimeLogs = allTimeLogs.filter(log => {
        if (!log.startTime && !log.date) return false;
        if (log.date) return log.date === yesterdayStr;
        const logStart = new Date(log.startTime);
        return logStart >= ydStart && logStart <= ydEnd;
    });
    const yesterdayHoursMap = {};
    yesterdayTimeLogs.forEach(log => {
        const uid = log.userId;
        if (!uid) return;
        if (!yesterdayHoursMap[uid]) yesterdayHoursMap[uid] = 0;
        yesterdayHoursMap[uid] += (log.totalHours || 0);
    });

    const activeDelays = allDelays.filter(d => !d.resolved);

    const scrumTable = teamUsers.map(user => {
        const uid = user.id;
        const yesterdayHours = parseFloat((yesterdayHoursMap[uid] || 0).toFixed(1));
        const nameParts = (user.displayName || user.name || '?').split(' ');
        const shortName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1][0]}.` : nameParts[0];
        const initials = nameParts.map(w => w[0]).join('').slice(0, 2).toUpperCase();

        // Status (based on yesterday hours — email sent in the morning)
        const userTasks = allTasks.filter(t => t.assignedTo === uid && !['completed', 'cancelled'].includes(t.status));
        const hasBlocker = activeDelays.some(d => userTasks.some(t => t.id === d.taskId));
        let status = 'ok';
        if (hasBlocker) status = 'bloqueado';
        else if (userTasks.length === 0) status = 'sin_tareas';
        else if (yesterdayHours === 0) status = 'sin_reporte';

        // Avg % avance
        const avgPct = userTasks.length > 0
            ? Math.round(userTasks.reduce((s, t) => s + (t.percentComplete || 0), 0) / userTasks.length)
            : 0;

        // Yesterday completed subtasks
        const userTaskIds = new Set(allTasks.filter(t => t.assignedTo === uid).map(t => t.id));
        const yesterdaySubs = allSubtasks.filter(st => {
            if (!st.completed || !st.completedAt || !userTaskIds.has(st.taskId)) return false;
            const d = new Date(st.completedAt);
            return d.toLocaleDateString("en-CA") === yesterdayStr;
        });
        // Group by parent task — include task title + project for context
        const yesterdayByTask = {};
        yesterdaySubs.forEach(st => {
            if (!yesterdayByTask[st.taskId]) {
                const parentTask = allTasks.find(t => t.id === st.taskId);
                yesterdayByTask[st.taskId] = {
                    taskTitle: parentTask?.title || '?',
                    projectName: parentTask?.projectId ? (projectMap[parentTask.projectId] || null) : null,
                    subs: [],
                    hours: 0,
                };
            }
            yesterdayByTask[st.taskId].subs.push(st.title || st.name || '?');
        });

        // Also include tasks with time logged yesterday (even without subtask completions)
        const userYdTimeLogs = yesterdayTimeLogs.filter(log => log.userId === uid);
        userYdTimeLogs.forEach(log => {
            const taskId = log.taskId;
            if (!taskId) return;
            if (!yesterdayByTask[taskId]) {
                const parentTask = allTasks.find(t => t.id === taskId);
                if (!parentTask) return;
                yesterdayByTask[taskId] = {
                    taskTitle: parentTask.title || '?',
                    projectName: parentTask.projectId ? (projectMap[parentTask.projectId] || null) : null,
                    subs: [],
                    hours: 0,
                };
            }
            yesterdayByTask[taskId].hours += (log.totalHours || 0);
        });

        // Yesterday comments for this person's tasks
        const userYesterdayComments = yesterdayComments.filter(c => userTaskIds.has(c.taskId));
        const yesterdayCommentsByTask = {};
        userYesterdayComments.forEach(c => {
            if (!c.taskId) return;
            if (!yesterdayCommentsByTask[c.taskId]) yesterdayCommentsByTask[c.taskId] = [];
            yesterdayCommentsByTask[c.taskId].push({
                userName: c.userName || c.userDisplayName || '?',
                text: (c.text || '').slice(0, 120),
            });
        });

        // Today tasks: same as UI — only in_progress tasks
        const todayTasksData = userTasks
            .filter(task => task.status === 'in_progress')
            .map(task => {
                const taskSubs = allSubtasks.filter(s => s.taskId === task.id);
                const pendingSubs = taskSubs.filter(s => !s.completed);
                const doneCount = taskSubs.filter(s => s.completed).length;
                const totalCount = taskSubs.length;
                const taskPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : (task.percentComplete || 0);
                const taskBlockers = activeDelays.filter(d => d.taskId === task.id);
                return {
                    title: task.title,
                    projectName: projectMap[task.projectId] || null,
                    pct: taskPct,
                    pendingSubs: pendingSubs.slice(0, 5).map(s => s.title || s.name || '?'),
                    blockers: taskBlockers.map(b => b.causeName || b.cause || 'Bloqueo'),
                };
            });

        return { uid, shortName, initials, hours: yesterdayHours, status, avgPct, yesterdayByTask, yesterdayCommentsByTask, todayTasksData };
    }).sort((a, b) => {
        const order = { ok: 0, bloqueado: 1, sin_tareas: 2, sin_reporte: 3 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });

    // DEBUG: Verify todayTasksData content
    scrumTable.forEach(p => {
        console.log(`[perfReport] scrumTable ${p.shortName}: todayTasksData=${JSON.stringify((p.todayTasksData || []).map(t => ({ title: t.title, projectName: t.projectName, pct: t.pct, subs: (t.pendingSubs || []).length })))}`);
    });

    // Build yesterday's pulse from scrumTable data
    const yesterdayTotalHours = scrumTable.reduce((s, p) => s + p.hours, 0);
    const yesterdayCompletedSubs = allSubtasks.filter(st => {
        if (!st.completed || !st.completedAt) return false;
        const d = new Date(st.completedAt);
        return d.toLocaleDateString("en-CA") === yesterdayStr;
    }).length;
    const yesterdayPeopleWithHours = scrumTable.filter(p => p.hours > 0).length;

    const yesterdayPulse = {
        hoursReal: parseFloat(yesterdayTotalHours.toFixed(1)),
        hoursExpected: teamSize * DAILY_AVAILABLE_HOURS,
        hoursPct: (teamSize * DAILY_AVAILABLE_HOURS) > 0 ? Math.round((yesterdayTotalHours / (teamSize * DAILY_AVAILABLE_HOURS)) * 100) : 0,
        teamSize,
        dailyHours: DAILY_AVAILABLE_HOURS,
        peopleWithHours: yesterdayPeopleWithHours,
        subtasksCompleted: yesterdayCompletedSubs,
        blockedTasks: blockedTasks.length,
    };

    return {
        date: today,
        datePretty: formatDateES(today),
        yesterdayDatePretty: formatDateES(yesterdayStr),
        generatedAt: now.toISOString(),
        pulseOfDay,
        yesterdayPulse,
        teamNarratives,
        actionableAlerts,
        productivityAlerts,
        overdueTasks: overdueTasks.slice(0, 10),
        tomorrowView,
        achievements,
        commentsByTask,
        scrumTable,
    };
}

// ═══════════════════════════════════════════════
// TELEGRAM SUMMARY — V2
// ═══════════════════════════════════════════════

function buildTelegramSummary(data) {
    const { datePretty, pulseOfDay: p, teamNarratives, actionableAlerts, productivityAlerts, overdueTasks, tomorrowView, achievements } = data;

    let msg = `📊 <b>Briefing del Equipo</b>\n`;
    msg += `📅 ${datePretty}\n\n`;

    // ── Pulso del Día ──
    msg += `━━━━ 📊 PULSO DEL DÍA ━━━━\n`;
    const hourIcon = p.hoursPct >= 80 ? "🟢" : p.hoursPct >= 60 ? "🟡" : "🔴";
    msg += `${hourIcon} Horas: <b>${p.hoursReal}h / ${p.hoursExpected}h</b> (${p.hoursPct}%)\n`;
    msg += `📋 Planificadas: <b>${p.hoursPlanned}h</b>\n`;
    msg += `✅ Tareas completadas: <b>${p.tasksCompletedToday}</b>\n`;
    if (p.subtasksTotal > 0) {
        msg += `📌 Subtareas: <b>${p.subtasksCompleted}/${p.subtasksTotal}</b> (${p.subtasksPct}%)\n`;
    }
    if (p.blockedTasks > 0) msg += `🚫 Bloqueadas: <b>${p.blockedTasks}</b>\n`;
    if (p.newOverdue > 0) msg += `⚠️ Nuevas vencidas: <b>${p.newOverdue}</b>\n`;
    msg += `\n`;

    // ── Equipo ──
    if (teamNarratives.length > 0) {
        msg += `━━━━ 👥 EQUIPO ━━━━\n`;
        teamNarratives.forEach(n => {
            const planStr = n.plannedHours > 0 ? ` (${n.planPct}% plan)` : "";
            const subStr = n.subtasksTotal > 0 ? ` | sub:${n.subtasksCompleted}/${n.subtasksTotal}` : "";
            const completedStr = n.completedTasks.length > 0 ? ` ✅${n.completedTasks.length}` : "";
            msg += `${n.statusEmoji} <b>${n.name}</b>: ${n.hours}h${planStr}${completedStr}${subStr}\n`;
            // Subtasks completed today
            if (n.subtasksCompletedTodayList && n.subtasksCompletedTodayList.length > 0) {
                const grouped = {};
                n.subtasksCompletedTodayList.forEach(st => {
                    if (!grouped[st.parentTaskTitle]) grouped[st.parentTaskTitle] = [];
                    grouped[st.parentTaskTitle].push(st.title);
                });
                for (const [parent, subs] of Object.entries(grouped)) {
                    msg += `   📋 ${parent}:\n`;
                    subs.slice(0, 5).forEach(s => msg += `      ✓ ${s}\n`);
                }
            }
        });
        msg += `\n`;
    }

    // ── Alertas de Productividad ──
    if (productivityAlerts.length > 0) {
        msg += `━━━━ 🔴 PRODUCTIVIDAD ━━━━\n`;
        productivityAlerts.forEach(a => {
            msg += `⚠️ <b>${a.name}</b> (${a.hours}h)\n`;
            a.details.forEach(d => msg += `   ${d}\n`);
            msg += `   → ${a.action}\n`;
        });
        msg += `\n`;
    }

    // ── Alertas Accionables ──
    if (actionableAlerts.length > 0) {
        msg += `━━━━ 🚨 ALERTAS ━━━━\n`;
        actionableAlerts.slice(0, 5).forEach(a => {
            msg += `${a.icon} ${a.text}\n`;
            if (a.action) msg += `   → ${a.action}\n`;
        });
        msg += `\n`;
    }

    // ── Logros ──
    if (achievements.length > 0) {
        msg += `━━━━ 🎉 LOGROS ━━━━\n`;
        achievements.forEach(a => {
            msg += `✅ ${a.title} (${a.completedBy})\n`;
        });
        msg += `\n`;
    }

    // ── Vista del Mañana ──
    msg += `━━━━ 📅 MAÑANA ━━━━\n`;
    msg += `👥 ${tomorrowView.plannedUsers} personas | ${tomorrowView.totalHours}h programadas\n`;
    if (tomorrowView.tasksDueTomorrow.length > 0) {
        msg += `⚠️ Vencen mañana:\n`;
        tomorrowView.tasksDueTomorrow.slice(0, 3).forEach(t => {
            msg += `   - ${t.title} (${t.assignedTo})\n`;
        });
    }
    if (tomorrowView.unassignedTasks > 0) {
        msg += `🆕 ${tomorrowView.unassignedTasks} tareas sin asignar\n`;
    }

    msg += `\n🔗 <a href="https://analyzeops.com">Ver Dashboard</a>`;
    msg += `\n<i>— AnalyzeOps</i>`;

    return msg;
}

function formatDateES(dateStr) {
    try {
        const d = new Date(dateStr + "T12:00:00");
        const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}, ${d.getFullYear()}`;
    } catch {
        return dateStr;
    }
}

module.exports = { execute, buildReportData };
