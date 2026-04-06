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
    const today = options.reportDate || now.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    const startOfDay = new Date(today + "T00:00:00-06:00");
    const endOfDay = new Date(today + "T23:59:59-06:00");

    // Tomorrow (relative to report date)
    const tomorrowDate = new Date(startOfDay);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toLocaleDateString("en-CA");

    console.log(`[perfReport] Building V2 report for ${today} (override: ${!!options.reportDate})...`);

    // ══════════════════════════════════════════
    // 1. LOAD ALL DATA
    // ══════════════════════════════════════════
    const [
        tasksSnap, timeLogsSnap, delaysSnap, usersSnap,
        subtasksSnap, planItemsTodaySnap, planItemsTomorrowSnap,
        telegramReportsSnap,
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
    ]);

    const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allTimeLogs = timeLogsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allDelays = delaysSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allUsers = usersSnap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }));
    const allSubtasks = subtasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const planItemsToday = planItemsTodaySnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const planItemsTomorrow = planItemsTomorrowSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const telegramReportsToday = telegramReportsSnap.docs.map(d => d.data());

    console.log(`[perfReport] Loaded: ${allTasks.length} tasks, ${allTimeLogs.length} timeLogs, ${allSubtasks.length} subtasks, ${planItemsToday.length} planItems today, ${planItemsTomorrow.length} tomorrow`);

    // ══════════════════════════════════════════
    // 2. BUILD REPORT DATA
    // ══════════════════════════════════════════
    const reportData = buildReportData({
        today, tomorrow, now, startOfDay, endOfDay,
        allTasks, allTimeLogs, allDelays, allUsers, allSubtasks,
        planItemsToday, planItemsTomorrow, telegramReportsToday,
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
                    subject: `📊 Briefing del Equipo — ${reportData.date}`,
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
}) {
    // ── Active team: users with operational roles ──
    const teamUsers = allUsers.filter(u =>
        u.operationalRole && !["none", "viewer"].includes(u.operationalRole)
    );

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
        hoursPct: totalExpectedHours > 0 ? Math.round((totalHoursReal / totalExpectedHours) * 100) : 0,
        tasksCompletedToday: completedToday.length,
        activeTasks: activeTasks.length,
        blockedTasks: blockedTasks.length,
        delaysToday: delaysToday.length,
        subtasksTotal: totalSubtasks,
        subtasksCompleted: completedSubtasks,
        subtasksPct: totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0,
        subtasksCompletedToday: subtasksCompletedToday.length,
        teamSize,
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
                actionableAlerts.push({
                    severity: "critical",
                    icon: "🔴",
                    text: `"${t.title}" lleva ${daysBlocked} días bloqueada`,
                    detail: `Responsable: ${user?.displayName || "Sin asignar"}${t.blockedReason ? ` | Razón: ${t.blockedReason}` : ""}`,
                    action: "Desbloquear o reasignar",
                });
            }
        }
    });

    // Overdue > 5 days
    overdueTasks.filter(t => t.daysOverdue >= 5).forEach(t => {
        actionableAlerts.push({
            severity: "high",
            icon: "🟠",
            text: `"${t.title}" venció hace ${t.daysOverdue} días`,
            detail: `Responsable: ${t.assignedTo}`,
            action: "Cerrar, reprogramar o cancelar",
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

    return {
        date: today,
        datePretty: formatDateES(today),
        generatedAt: now.toISOString(),
        pulseOfDay,
        teamNarratives,
        actionableAlerts,
        productivityAlerts,
        overdueTasks: overdueTasks.slice(0, 10),
        tomorrowView,
        achievements,
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
