/**
 * Daily Performance Report Handler — Backend (CJS)
 * ===================================================
 * Generates a comprehensive daily team performance report and delivers
 * it through two channels:
 *   1. Email via Resend (analyzeops.com)
 *   2. PDF via Telegram to managers/leads
 *
 * Leverages existing analytics engines:
 *   - kpiEngine → KPI calculations
 *   - riskFlagEngine → risk assessment
 *   - scorecardService → individual scores
 *   - trendEngine → trend vs previous period
 *   - recommendationEngine → suggested actions
 *
 * @module handlers/dailyPerformanceReportHandler
 */

const paths = require("../automation/firestorePaths");
const { OPERATIONAL_ROLES } = require("../automation/constants");
const { sendAndLogEmail } = require("../email/emailProvider");
const { dailyPerformanceReport } = require("../email/emailTemplates");
const { sendToUser } = require("../telegram/telegramProvider");

/**
 * Execute the daily performance report routine.
 */
async function execute(adminDb, token, targets, context) {
    const { dryRun, runId, options = {} } = context;
    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    const startOfDay = new Date(today + "T00:00:00-06:00");
    const endOfDay = new Date(today + "T23:59:59-06:00");

    console.log(`[perfReport] Building report for ${today}...`);

    // ══════════════════════════════════════════
    // 1. LOAD ALL DATA
    // ══════════════════════════════════════════
    const [tasksSnap, timeLogsSnap, delaysSnap, usersSnap] = await Promise.all([
        adminDb.collection(paths.TASKS).get(),
        adminDb.collection(paths.TIME_LOGS).get(),
        adminDb.collection(paths.DELAYS).get(),
        adminDb.collection(paths.USERS).get(),
    ]);

    const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allTimeLogs = timeLogsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allDelays = delaysSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allUsers = usersSnap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }));

    // Load analytics snapshots (latest)
    let latestKpiSnapshot = null;
    let latestRiskFlags = [];
    let latestRecommendations = [];
    let latestUserScores = [];

    try {
        const [kpiSnap, riskSnap, recsSnap, userScoresSnap] = await Promise.all([
            adminDb.collection(paths.OPERATIONAL_KPI_SNAPSHOTS)
                .orderBy("generatedAt", "desc").limit(1).get(),
            adminDb.collection(paths.OPERATIONAL_RISK_FLAGS)
                .orderBy("createdAt", "desc").limit(20).get(),
            adminDb.collection(paths.OPERATIONAL_RECOMMENDATIONS)
                .orderBy("createdAt", "desc").limit(10).get(),
            adminDb.collection(paths.USER_OPERATIONAL_SCORES)
                .orderBy("generatedAt", "desc").limit(20).get(),
        ]);

        latestKpiSnapshot = kpiSnap.docs[0]?.data() || null;
        latestRiskFlags = riskSnap.docs.map(d => d.data());
        latestRecommendations = recsSnap.docs.map(d => d.data());
        latestUserScores = userScoresSnap.docs.map(d => d.data());
    } catch (err) {
        console.warn("[perfReport] Error loading analytics data:", err.message);
    }

    // ══════════════════════════════════════════
    // 2. BUILD REPORT DATA
    // ══════════════════════════════════════════
    const reportData = buildReportData({
        today,
        now,
        startOfDay,
        endOfDay,
        allTasks,
        allTimeLogs,
        allDelays,
        allUsers,
        latestKpiSnapshot,
        latestRiskFlags,
        latestRecommendations,
        latestUserScores,
    });

    console.log(`[perfReport] Report built: ${reportData.executiveSummary.totalHoursToday.toFixed(1)}h, ${reportData.scorecards.length} users, ${reportData.risks.length} risks`);

    // ══════════════════════════════════════════
    // 3. LOAD REPORT CONFIG
    // ══════════════════════════════════════════
    let config = {
        channels: { email: true, telegramPdf: true },
        recipients: [],
        sections: {
            executiveSummary: true, risks: true, kpis: true,
            individualScores: true, overdueTasks: true, recommendations: true,
        },
    };

    try {
        const configSnap = await adminDb.collection(paths.SETTINGS).doc("emailReportConfig").get();
        if (configSnap.exists) {
            config = { ...config, ...configSnap.data() };
        }
    } catch (err) {
        console.warn("[perfReport] No config found, using defaults:", err.message);
    }

    // ══════════════════════════════════════════
    // 4. DELIVER: Channel A — Email via Resend
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
                    subject: `📊 Reporte de Rendimiento — ${reportData.date}`,
                    html,
                }, { routineKey: "daily_performance_report", runId });

                console.log(`[perfReport] Email result: ${emailResult.ok ? "sent" : "failed"} ${emailResult.error || ""}`);
            } else {
                console.warn("[perfReport] No Resend API Key available, skipping email channel");
                emailResult = { ok: false, error: "No API key" };
            }
        }
    }

    // ══════════════════════════════════════════
    // 5. DELIVER: Channel B — Telegram summary
    // ══════════════════════════════════════════
    let telegramResult = { sentCount: 0, failedCount: 0, errors: [] };

    if (config.channels?.telegramPdf !== false) {
        const managersAndLeads = targets.filter(t =>
            [OPERATIONAL_ROLES.MANAGER, OPERATIONAL_ROLES.TEAM_LEAD].includes(t.operationalRole)
        );

        const summaryMsg = buildTelegramSummary(reportData);

        for (const mgr of managersAndLeads) {
            if (dryRun) {
                console.log(`[perfReport] DRY-RUN: Would send Telegram summary to ${mgr.name}`);
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
    // 6. LOG REPORT GENERATION
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
// DATA BUILDER
// ═══════════════════════════════════════════════

function buildReportData({ today, now, startOfDay, endOfDay, allTasks, allTimeLogs, allDelays, allUsers, latestKpiSnapshot, latestRiskFlags, latestRecommendations, latestUserScores }) {
    // Tasks
    const activeTasks = allTasks.filter(t => !["completed", "cancelled"].includes(t.status));
    const blockedTasks = allTasks.filter(t => t.status === "blocked");
    const completedToday = allTasks.filter(t => {
        if (t.status !== "completed" || !t.completedDate) return false;
        const cd = new Date(t.completedDate);
        return cd >= startOfDay && cd <= endOfDay;
    });
    const overdueTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < now)
        .map(t => {
            const daysOverdue = Math.ceil((now - new Date(t.dueDate)) / 86400000);
            const user = allUsers.find(u => u.id === t.assignedTo);
            return {
                title: t.title,
                assignedTo: user?.displayName || user?.name || t.assignedTo || "Sin asignar",
                dueDate: t.dueDate,
                daysOverdue,
            };
        })
        .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // Time logs today
    const todayTimeLogs = allTimeLogs.filter(log => {
        if (!log.startTime) return false;
        const logStart = new Date(log.startTime);
        return logStart >= startOfDay && logStart <= endOfDay;
    });

    // Hours by user
    const userHoursMap = {};
    todayTimeLogs.forEach(log => {
        const uid = log.userId;
        if (!uid) return;
        if (!userHoursMap[uid]) userHoursMap[uid] = 0;
        userHoursMap[uid] += (log.totalHours || 0);
    });

    const totalHoursToday = Object.values(userHoursMap).reduce((sum, h) => sum + h, 0);
    const teamSize = new Set(activeTasks.map(t => t.assignedTo).filter(Boolean)).size;

    // Delays today
    const delaysToday = allDelays.filter(d => {
        if (!d.createdAt) return false;
        const cd = new Date(d.createdAt);
        return cd >= startOfDay && cd <= endOfDay;
    });

    // Completed tasks by user
    const completedByUser = {};
    completedToday.forEach(t => {
        if (t.assignedTo) completedByUser[t.assignedTo] = (completedByUser[t.assignedTo] || 0) + 1;
    });

    // Build KPIs from snapshot
    const kpis = {};
    if (latestKpiSnapshot?.metrics) {
        for (const [key, metric] of Object.entries(latestKpiSnapshot.metrics)) {
            kpis[key] = {
                value: typeof metric === "object" ? metric.value : metric,
                trend: "stable", // Would need previous snapshot for real trend
            };
        }
    }

    // Build scorecards
    const scorecards = [];
    const processedUsers = new Set();

    // From analytics user scores
    for (const score of latestUserScores) {
        if (processedUsers.has(score.entityId)) continue;
        processedUsers.add(score.entityId);

        const userActiveTasks = activeTasks.filter(t => t.assignedTo === score.entityId).length;
        const compositeScore = score.metrics?.compositeScore?.value ||
            calculateSimpleScore(score.metrics);

        scorecards.push({
            userName: score.userName || score.entityId,
            role: score.userRole || "unknown",
            hours: parseFloat((userHoursMap[score.entityId] || 0).toFixed(1)),
            tasksCompleted: completedByUser[score.entityId] || 0,
            activeTasks: userActiveTasks,
            score: Math.round(compositeScore * 100) || 0,
            grade: scoreToGrade(Math.round(compositeScore * 100) || 0),
        });
    }

    // Fill in users that have hours today but no analytics score
    for (const [uid, hours] of Object.entries(userHoursMap)) {
        if (processedUsers.has(uid)) continue;
        const user = allUsers.find(u => u.id === uid);
        const userActiveTasks = activeTasks.filter(t => t.assignedTo === uid).length;

        scorecards.push({
            userName: user?.displayName || user?.name || uid,
            role: user?.operationalRole || "unknown",
            hours: parseFloat(hours.toFixed(1)),
            tasksCompleted: completedByUser[uid] || 0,
            activeTasks: userActiveTasks,
            score: 0,
            grade: "-",
        });
    }

    scorecards.sort((a, b) => b.score - a.score);

    // Recommendations
    const recommendations = latestRecommendations
        .slice(0, 5)
        .map(r => ({
            text: r.text || r.recommendation || r.description || JSON.stringify(r),
            priority: r.priority || "medium",
            type: r.type || "general",
        }));

    return {
        date: today,
        generatedAt: now.toISOString(),
        executiveSummary: {
            totalHoursToday,
            tasksCompletedToday: completedToday.length,
            activeTasks: activeTasks.length,
            blockedTasks: blockedTasks.length,
            delaysReportedToday: delaysToday.length,
            teamSize,
        },
        risks: latestRiskFlags.slice(0, 10),
        kpis,
        scorecards,
        overdueTasks,
        recommendations,
    };
}

function scoreToGrade(score) {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    if (score > 0) return "F";
    return "-";
}

function calculateSimpleScore(metrics) {
    if (!metrics) return 0;
    const values = Object.values(metrics)
        .map(m => typeof m === "object" ? m.value : m)
        .filter(v => typeof v === "number" && v >= 0 && v <= 1);
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ═══════════════════════════════════════════════
// TELEGRAM SUMMARY BUILDER
// ═══════════════════════════════════════════════

function buildTelegramSummary(data) {
    const { date, executiveSummary: es, risks, scorecards, overdueTasks, recommendations } = data;

    let msg = `📊 <b>Reporte de Rendimiento</b>\n`;
    msg += `📅 ${date}\n\n`;

    // Executive Summary
    msg += `━━━━ RESUMEN ━━━━\n`;
    msg += `⏱️ Horas: <b>${es.totalHoursToday.toFixed(1)}h</b>\n`;
    msg += `✅ Completadas: <b>${es.tasksCompletedToday}</b>\n`;
    msg += `📌 Activas: <b>${es.activeTasks}</b>\n`;
    msg += `🚫 Bloqueadas: <b>${es.blockedTasks}</b>\n`;
    msg += `⚠️ Delays: <b>${es.delaysReportedToday}</b>\n`;
    msg += `👥 Equipo: <b>${es.teamSize}</b>\n\n`;

    // Risks
    if (risks.length > 0) {
        msg += `━━━━ RIESGOS ━━━━\n`;
        risks.slice(0, 5).forEach(r => {
            const icon = r.severity === "critical" ? "🔴" : r.severity === "high" ? "🟠" : "🟡";
            msg += `${icon} ${r.justification || r.kpiName}\n`;
        });
        msg += `\n`;
    }

    // Scorecards
    if (scorecards.length > 0) {
        msg += `━━━━ EQUIPO ━━━━\n`;
        scorecards.slice(0, 8).forEach(s => {
            const gradeEmoji = s.grade === "A" ? "🟢" : s.grade === "B" ? "🔵" : s.grade === "C" ? "🟡" : "🔴";
            msg += `${gradeEmoji} ${s.userName}: ${s.hours}h | ${s.tasksCompleted} comp | ${s.score}pts (${s.grade})\n`;
        });
        msg += `\n`;
    }

    // Overdue
    if (overdueTasks.length > 0) {
        msg += `━━━━ VENCIDAS (${overdueTasks.length}) ━━━━\n`;
        overdueTasks.slice(0, 5).forEach(t => {
            msg += `🔴 "${t.title}" — ${t.daysOverdue}d (${t.assignedTo})\n`;
        });
        if (overdueTasks.length > 5) msg += `... y ${overdueTasks.length - 5} más\n`;
        msg += `\n`;
    }

    // Recommendations
    if (recommendations.length > 0) {
        msg += `━━━━ ACCIONES ━━━━\n`;
        recommendations.slice(0, 3).forEach((r, i) => {
            msg += `${i + 1}. ${r.text}\n`;
        });
    }

    msg += `\n🔗 <a href="https://bom-ame-cr.web.app">Ver Dashboard</a>`;
    msg += `\n<i>— AnalyzeOps</i>`;

    return msg;
}

module.exports = { execute, buildReportData };
