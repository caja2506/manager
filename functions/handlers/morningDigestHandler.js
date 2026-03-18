/**
 * Morning Digest Handler — Backend (CJS) — Phase 3 + Daily Scrum
 * ================================================================
 * Sends role-appropriate morning briefings to all participants.
 * Queries real task data from Firestore for each target.
 * 
 * V5 Enhancement: Managers/Engineers/Team Leads get the Daily Scrum 
 * team summary using the SAME logic as the Equipo Hoy page.
 * Technicians get their individual briefing (unchanged).
 */

const { sendToTargets } = require("../telegram/telegramProvider");
const { fallbackBriefing } = require("../ai/aiFallbacks");
const templates = require("../telegram/telegramTemplates");
const paths = require("../automation/firestorePaths");
const { OPERATIONAL_ROLES } = require("../automation/constants");
const { buildDailyScrumData, buildSummary } = require("../dailyScrum/dailyScrumEngine");

/**
 * Execute morning digest routine.
 * 
 * For managers/engineers/team leads → sends the team-level Daily Scrum summary
 * For technicians → sends individual briefing (existing behavior)
 */
async function execute(adminDb, token, targets, context) {
    // ── Pre-load ALL data once (avoid N queries) ──
    const [tasksSnap, timeLogsSnap, delaysSnap, usersSnap, assignmentsSnap] = await Promise.all([
        adminDb.collection(paths.TASKS).get(),
        adminDb.collection(paths.TIME_LOGS).get(),
        adminDb.collection(paths.DELAYS).get(),
        adminDb.collection(paths.USERS).get(),
        adminDb.collection("resourceAssignments").where("active", "==", true).get(),
    ]);

    const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allTimeLogs = timeLogsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allDelays = delaysSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const teamMembers = usersSnap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }));
    const activeAssignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const now = new Date();
    const blockedTasks = allTasks.filter(t => t.status === "blocked");
    const teamSize = new Set(allTasks.map(t => t.assignedTo).filter(Boolean)).size;

    // ── Build Daily Scrum data (same logic as Equipo Hoy page) ──
    const scrumData = buildDailyScrumData(teamMembers, allTasks, allTimeLogs, allDelays, activeAssignments);
    const summary = buildSummary(scrumData);

    const messageBuilder = async (target) => {
        const uid = target.uid;
        const role = target.operationalRole;

        // ── Managers / Engineers / Team Leads → team scrum summary ──
        if ([OPERATIONAL_ROLES.MANAGER, OPERATIONAL_ROLES.TEAM_LEAD, OPERATIONAL_ROLES.ENGINEER].includes(role)) {
            const teamScrumMsg = templates.morningDigestTeamScrum({
                name: target.name,
                summary,
                scrumData,
                teamMembers,
            });

            // Append individual section if they have personal tasks
            const userTasks = allTasks.filter(t => t.assignedTo === uid);
            const activeTasks = userTasks.filter(t => !["completed", "cancelled"].includes(t.status));

            if (activeTasks.length > 0) {
                let personal = `\n\n━━━━━━━━━━━━━━━━\n`;
                personal += `📋 <b>Tus tareas hoy:</b> ${activeTasks.length}\n`;
                activeTasks.slice(0, 5).forEach((t, i) => {
                    personal += `  ${i + 1}. ${t.title}\n`;
                });
                if (activeTasks.length > 5) personal += `  ... y ${activeTasks.length - 5} más\n`;
                return teamScrumMsg + personal;
            }

            return teamScrumMsg;
        }

        // ── Technicians → individual briefing (unchanged) ──
        const userTasks = allTasks.filter(t => t.assignedTo === uid);
        const activeTasks = userTasks.filter(t => !["completed", "cancelled"].includes(t.status));
        const userBlocked = userTasks.filter(t => t.status === "blocked");
        const overdueTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);

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

    const result = await sendToTargets(adminDb, token, targets, messageBuilder, context);

    // ── Send Quick Report button to technicians (follow-up message) ──
    if (!context.dryRun) {
        const { sendMessageWithKeyboard } = require("../telegram/telegramClient");
        const WEBAPP_URL = "https://bom-ame-cr.web.app/tg-report";

        for (const target of targets) {
            if (target.operationalRole !== OPERATIONAL_ROLES.TECHNICIAN) continue;
            if (!target.chatId) continue;

            try {
                await sendMessageWithKeyboard(token, target.chatId,
                    "⚡ Reporta tu avance rápidamente:",
                    [[{ text: "📝 Quick Report", web_app: { url: WEBAPP_URL } }]]
                );
            } catch (err) {
                console.warn(`[morningDigest] Quick Report button failed for ${target.name}:`, err.message);
            }
        }
    }

    return result;
}

module.exports = { execute };
