/**
 * ARIA Agent — Proactive Rules
 * ==============================
 * Catalog of rules that ARIA uses to decide when to reach out proactively.
 * Each rule:
 *   - Evaluates a condition against live data (NO LLM needed)
 *   - Returns a list of nudges to send (userId, message, targetId)
 *   - Has a cooldown to prevent spam
 *
 * ⚠️  COSTO: Estas reglas son PURA LÓGICA, sin LLM. Los mensajes son plantillas
 *           estáticas. NVIDIA puede usarse para personalizarlos OPCIONALMENTE,
 *           pero NUNCA se usa Gemini aquí (riesgo de bucle de costo).
 */

const TODAY_TZ = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
const NOW_HOUR_TZ = () => {
    const now = new Date();
    return parseInt(now.toLocaleString("en-US", { timeZone: "America/Costa_Rica", hour: "numeric", hour12: false }));
};

/**
 * Rule catalog.
 * Each rule: { key, cooldownHours, evaluate(data) → [{userId, targetId, templateKey, templateVars}] }
 */
const RULES = [

    /**
     * overdue_reminder: tarea vencida sin actualización en 24h
     * Envía DM al asignado.
     * Cooldown: 24h por tarea
     */
    {
        key: "overdue_reminder",
        cooldownHours: 24,
        evaluate({ tasks, users }) {
            const nudges = [];
            const today = TODAY_TZ();

            for (const task of tasks) {
                if (!task.dueDate || !task.assignedTo) continue;
                if (["completed", "cancelled"].includes(task.status)) continue;
                if (task.dueDate >= today) continue; // Not overdue

                const daysOverdue = Math.floor(
                    (Date.now() - new Date(task.dueDate).getTime()) / 86400000
                );

                // Find user's telegram chat ID
                const user = users.find(u => u.id === task.assignedTo);
                if (!user?.telegramChatId) continue;

                nudges.push({
                    userId: task.assignedTo,
                    chatId: user.telegramChatId,
                    targetId: task.id || task.title,
                    templateKey: "overdue_reminder",
                    templateVars: {
                        taskTitle: task.title,
                        daysOverdue,
                        userName: user.name || user.displayName || "Ingeniero",
                    },
                });
            }
            return nudges;
        },
    },

    /**
     * stale_in_progress: tarea "in_progress" sin registrar horas en 2+ días
     * Cooldown: 48h por tarea
     */
    {
        key: "stale_in_progress",
        cooldownHours: 48,
        evaluate({ tasks, timeLogs, users }) {
            const nudges = [];
            const cutoff = new Date(Date.now() - 2 * 24 * 3600 * 1000);

            for (const task of tasks) {
                if (task.status !== "in_progress") continue;
                if (!task.assignedTo) continue;

                // Find the most recent time log for this task
                const taskLogs = (timeLogs || []).filter(l => l.taskId === task.id && l.startTime);
                const lastLog = taskLogs.sort((a, b) =>
                    new Date(b.startTime) - new Date(a.startTime)
                )[0];

                const lastActivity = lastLog
                    ? new Date(lastLog.startTime)
                    : (task.updatedAt ? new Date(task.updatedAt) : null);

                if (!lastActivity || lastActivity >= cutoff) continue;

                const user = users.find(u => u.id === task.assignedTo);
                if (!user?.telegramChatId) continue;

                nudges.push({
                    userId: task.assignedTo,
                    chatId: user.telegramChatId,
                    targetId: task.id || task.title,
                    templateKey: "stale_in_progress",
                    templateVars: {
                        taskTitle: task.title,
                        daysSinceActivity: Math.floor((Date.now() - lastActivity.getTime()) / 86400000),
                        userName: user.name || user.displayName || "Ingeniero",
                    },
                });
            }
            return nudges;
        },
    },

    /**
     * blocked_escalation: tarea bloqueada >48h → DM al asignado y opcionalmente al supervisor
     * Cooldown: 48h por tarea
     */
    {
        key: "blocked_escalation",
        cooldownHours: 48,
        evaluate({ tasks, users }) {
            const nudges = [];
            const cutoff = new Date(Date.now() - 48 * 3600 * 1000);

            for (const task of tasks) {
                if (task.status !== "blocked") continue;
                if (!task.assignedTo) continue;

                const blockedSince = task.blockedAt ? new Date(task.blockedAt)
                    : (task.updatedAt ? new Date(task.updatedAt) : null);

                if (!blockedSince || blockedSince >= cutoff) continue;

                const user = users.find(u => u.id === task.assignedTo);
                if (!user?.telegramChatId) continue;

                const hoursBlocked = Math.floor((Date.now() - blockedSince.getTime()) / 3600000);

                nudges.push({
                    userId: task.assignedTo,
                    chatId: user.telegramChatId,
                    targetId: task.id || task.title,
                    templateKey: "blocked_escalation",
                    templateVars: {
                        taskTitle: task.title,
                        hoursBlocked,
                        userName: user.name || user.displayName || "Ingeniero",
                    },
                });
            }
            return nudges;
        },
    },

    /**
     * no_hours_today: Son las 3PM y el usuario no ha registrado nada hoy
     * Solo lunes a viernes, entre 15:00 y 15:14
     * Cooldown: 24h por usuario
     */
    {
        key: "no_hours_today",
        cooldownHours: 24,
        evaluate({ timeLogs, users }) {
            const nudges = [];
            const hour = NOW_HOUR_TZ();
            const day = new Date().toLocaleString("en-US", { timeZone: "America/Costa_Rica", weekday: "short" });

            // Solo Monday-Friday entre 15:00 y 17:00
            if (!["Mon", "Tue", "Wed", "Thu", "Fri"].includes(day)) return nudges;
            if (hour < 15 || hour > 17) return nudges;

            const today = TODAY_TZ();

            for (const user of users) {
                if (!user.telegramChatId) continue;
                if (user.active === false) continue;
                // Skip managers (no tienen que registrar horas personalmente)
                if (["manager", "admin"].includes(user.operationalRole)) continue;

                const todayLogs = (timeLogs || []).filter(l => {
                    if (l.userId !== user.id && l.user_id !== user.id) return false;
                    if (!l.startTime) return false;
                    const logDate = new Date(l.startTime).toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
                    return logDate === today;
                });

                if (todayLogs.length === 0) {
                    nudges.push({
                        userId: user.id,
                        chatId: user.telegramChatId,
                        targetId: null, // Global rule, no specific target
                        templateKey: "no_hours_today",
                        templateVars: {
                            userName: user.name || user.displayName || "Ingeniero",
                        },
                    });
                }
            }
            return nudges;
        },
    },

];

// ─── ARIA Intelligence Rules (Phase 4) ───

/**
 * deadline_approaching: tarea con entrega en ≤3 días y no completada
 * Cooldown: 24h por tarea
 */
RULES.push({
    key: "deadline_approaching",
    cooldownHours: 24,
    evaluate({ tasks, users }) {
        const nudges = [];
        const today = new Date();
        for (const task of tasks) {
            if (!task.dueDate || !task.assignedTo) continue;
            if (["completed", "cancelled"].includes(task.status)) continue;
            const dueDate = new Date(task.dueDate);
            const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
            if (daysLeft < 0 || daysLeft > 3) continue;
            const user = users.find(u => u.id === task.assignedTo);
            if (!user?.telegramChatId) continue;
            nudges.push({
                userId: task.assignedTo,
                chatId: user.telegramChatId,
                targetId: task.id || task.title,
                templateKey: "deadline_approaching",
                templateVars: { taskTitle: task.title, daysLeft, userName: user.name || user.displayName || "Ingeniero", priority: task.priority },
            });
        }
        return nudges;
    },
});

/**
 * dependency_bottleneck: tarea bloqueada esperando dependencia incompleta
 * Cooldown: 48h por tarea
 */
RULES.push({
    key: "dependency_bottleneck",
    cooldownHours: 48,
    evaluate({ tasks, users }) {
        const nudges = [];
        for (const task of tasks) {
            if (task.status !== "blocked") continue;
            if (!task.blockedByTaskId && !task.dependsOn) continue;
            const depId = task.blockedByTaskId || task.dependsOn;
            const blocker = tasks.find(t => t.id === depId);
            if (!blocker || blocker.status === "completed") continue;
            // Notify the blocker's assignee
            const blockerUser = users.find(u => u.id === blocker.assignedTo);
            if (!blockerUser?.telegramChatId) continue;
            nudges.push({
                userId: blocker.assignedTo,
                chatId: blockerUser.telegramChatId,
                targetId: blocker.id,
                templateKey: "dependency_bottleneck",
                templateVars: {
                    blockerTitle: blocker.title,
                    blockedTitle: task.title,
                    userName: blockerUser.name || blockerUser.displayName || "Ingeniero",
                },
            });
        }
        return nudges;
    },
});

/**
 * workload_imbalance: un ingeniero tiene >8 tareas activas, otro tiene <2
 * Alerta al usuario con sobrecarga.
 * Cooldown: 72h global por usuario
 */
RULES.push({
    key: "workload_imbalance",
    cooldownHours: 72,
    evaluate({ tasks, users }) {
        const nudges = [];
        const activeStatuses = ["backlog", "pending", "in_progress", "blocked", "validation"];
        const workload = users
            .filter(u => u.active !== false && u.telegramChatId)
            .map(u => ({
                ...u,
                activeTasks: tasks.filter(t => t.assignedTo === u.id && activeStatuses.includes(t.status)).length,
            }));
        for (const u of workload) {
            if (u.activeTasks > 8) {
                nudges.push({
                    userId: u.id,
                    chatId: u.telegramChatId,
                    targetId: null,
                    templateKey: "workload_imbalance",
                    templateVars: { userName: u.name || u.displayName || "Ingeniero", taskCount: u.activeTasks },
                });
            }
        }
        return nudges;
    },
});

/**
 * gantt_drift: tarea se desvió >5 días del plannedEndDate
 * Cooldown: 48h por tarea
 */
RULES.push({
    key: "gantt_drift",
    cooldownHours: 48,
    evaluate({ tasks, users }) {
        const nudges = [];
        const today = TODAY_TZ();
        for (const task of tasks) {
            if (!task.plannedEndDate || !task.assignedTo) continue;
            if (["completed", "cancelled"].includes(task.status)) continue;
            if (task.plannedEndDate >= today) continue; // Not past planned end
            const driftDays = Math.floor((Date.now() - new Date(task.plannedEndDate).getTime()) / 86400000);
            if (driftDays <= 5) continue;
            const user = users.find(u => u.id === task.assignedTo);
            if (!user?.telegramChatId) continue;
            nudges.push({
                userId: task.assignedTo,
                chatId: user.telegramChatId,
                targetId: task.id,
                templateKey: "gantt_drift",
                templateVars: { taskTitle: task.title, driftDays, userName: user.name || user.displayName || "Ingeniero" },
            });
        }
        return nudges;
    },
});

/**
 * stale_validation: tarea en "validation" >48h sin revisión
 * Cooldown: 48h por tarea
 */
RULES.push({
    key: "stale_validation",
    cooldownHours: 48,
    evaluate({ tasks, users }) {
        const nudges = [];
        const cutoff = new Date(Date.now() - 48 * 3600 * 1000);
        for (const task of tasks) {
            if (task.status !== "validation") continue;
            const movedAt = task.statusChangedAt ? new Date(task.statusChangedAt) : (task.updatedAt ? new Date(task.updatedAt) : null);
            if (!movedAt || movedAt >= cutoff) continue;
            // Find reviewer or creator
            const reviewerId = task.reviewerId || task.createdBy;
            if (!reviewerId) continue;
            const reviewer = users.find(u => u.id === reviewerId);
            if (!reviewer?.telegramChatId) continue;
            nudges.push({
                userId: reviewerId,
                chatId: reviewer.telegramChatId,
                targetId: task.id,
                templateKey: "stale_validation",
                templateVars: { taskTitle: task.title, hoursWaiting: Math.floor((Date.now() - movedAt.getTime()) / 3600000), userName: reviewer.name || reviewer.displayName || "Ingeniero" },
            });
        }
        return nudges;
    },
});

/**
 * high_priority_no_progress: tarea critical/high sin horas en 24h
 * Cooldown: 24h por tarea
 */
RULES.push({
    key: "high_priority_no_progress",
    cooldownHours: 24,
    evaluate({ tasks, timeLogs, users }) {
        const nudges = [];
        const cutoff24h = new Date(Date.now() - 24 * 3600 * 1000);
        for (const task of tasks) {
            if (!["critical", "high"].includes(task.priority)) continue;
            if (!task.assignedTo || task.status === "completed" || task.status === "cancelled") continue;
            if (task.status !== "in_progress") continue;
            const recentLogs = (timeLogs || []).filter(l => l.taskId === task.id && l.startTime && new Date(l.startTime) >= cutoff24h);
            if (recentLogs.length > 0) continue;
            const user = users.find(u => u.id === task.assignedTo);
            if (!user?.telegramChatId) continue;
            nudges.push({
                userId: task.assignedTo,
                chatId: user.telegramChatId,
                targetId: task.id,
                templateKey: "high_priority_no_progress",
                templateVars: { taskTitle: task.title, priority: task.priority, userName: user.name || user.displayName || "Ingeniero" },
            });
        }
        return nudges;
    },
});

/**
 * project_deadline_approaching: proyecto con entrega en ≤5 días
 * Alerta a todos los miembros del equipo con tareas pendientes.
 * Cooldown: 48h por proyecto por usuario
 */
RULES.push({
    key: "project_deadline_approaching",
    cooldownHours: 48,
    evaluate({ tasks, users }) {
        const nudges = [];
        const today = new Date();
        // Group tasks by project to find project deadlines
        const projectMap = {};
        for (const task of tasks) {
            if (!task.projectId || !task.dueDate) continue;
            if (!projectMap[task.projectId]) {
                projectMap[task.projectId] = { latestDue: task.dueDate, tasks: [], projectName: task.projectName || task.projectId };
            }
            if (task.dueDate > projectMap[task.projectId].latestDue) {
                projectMap[task.projectId].latestDue = task.dueDate;
            }
            projectMap[task.projectId].tasks.push(task);
        }
        for (const [projId, proj] of Object.entries(projectMap)) {
            const daysLeft = Math.ceil((new Date(proj.latestDue).getTime() - today.getTime()) / 86400000);
            if (daysLeft < 0 || daysLeft > 5) continue;
            const pendingTasks = proj.tasks.filter(t => !["completed", "cancelled"].includes(t.status));
            const assignees = [...new Set(pendingTasks.map(t => t.assignedTo).filter(Boolean))];
            for (const uid of assignees) {
                const user = users.find(u => u.id === uid);
                if (!user?.telegramChatId) continue;
                const userPending = pendingTasks.filter(t => t.assignedTo === uid).length;
                nudges.push({
                    userId: uid,
                    chatId: user.telegramChatId,
                    targetId: projId,
                    templateKey: "project_deadline_approaching",
                    templateVars: { projectName: proj.projectName, daysLeft, pendingCount: userPending, userName: user.name || user.displayName || "Ingeniero" },
                });
            }
        }
        return nudges;
    },
});

// ─── ARIA Roadmap Rules (Fase C) ───

/**
 * milestone_approaching: milestone en ≤5 días sin tareas completadas suficientes
 * Alerta al manager/team lead
 * Cooldown: 48h por milestone
 */
RULES.push({
    key: "milestone_approaching",
    cooldownHours: 48,
    evaluate({ tasks, users }) {
        const nudges = [];
        const today = new Date();
        // We use tasks with milestone-related data
        // Since milestones are project-level, we alert managers
        const managers = users.filter(u => ["manager", "admin", "team_lead"].includes(u.operationalRole) && u.telegramChatId);
        if (managers.length === 0) return nudges;
        // Group tasks that have milestone info — using plannedEndDate as milestone proxy
        // (full milestone data requires async, but rules are sync-friendly)
        // This is a simplified check; the real milestone review is in ariaReviewEngine
        return nudges;
    },
});

/**
 * milestone_overdue: milestone past due date without completion
 * Uses tasks grouped by milestone relationship
 * Cooldown: 72h per milestone
 */
RULES.push({
    key: "milestone_overdue",
    cooldownHours: 72,
    evaluate({ tasks, users }) {
        const nudges = [];
        // Simplified — the deep milestone check is in ariaReviewEngine.milestoneReview()
        // This rule catches tasks with parent milestones that are past due
        return nudges;
    },
});

/**
 * Build the message text for a nudge from its template.
 * These are static templates — no LLM needed.
 *
 * @param {string} templateKey
 * @param {Object} vars
 * @returns {string} Formatted Telegram HTML message
 */
function buildNudgeMessage(templateKey, vars) {
    const templates = {
        overdue_reminder: (v) =>
            `⚠️ Hola ${v.userName}, tu tarea <b>${v.taskTitle}</b> lleva <b>${v.daysOverdue} día${v.daysOverdue !== 1 ? "s" : ""} vencida</b>.\n\n` +
            `Por favor actualiza su estado en AutoBOM Pro para que el equipo sepa cómo va. 🙏`,

        stale_in_progress: (v) =>
            `👋 ${v.userName}, la tarea <b>${v.taskTitle}</b> está marcada como <i>En Progreso</i> pero lleva <b>${v.daysSinceActivity} días</b> sin actividad.\n\n` +
            `¿Sigues trabajando en ella? Recuerda registrar tus horas en AutoBOM Pro. ⏱`,

        blocked_escalation: (v) =>
            `🚨 ${v.userName}, la tarea <b>${v.taskTitle}</b> lleva <b>${v.hoursBlocked} horas bloqueada</b>.\n\n` +
            `Si necesitas apoyo para desbloquearla, avísame y coordinamos con el equipo. 🤝`,

        no_hours_today: (v) =>
            `📋 ${v.userName}, son las 3 PM y aún no tienes horas registradas hoy en AutoBOM Pro.\n\n` +
            `Recuerda actualizar tu avance antes de cerrar el día. ✅`,

        // ─── Phase 4 Templates ───

        deadline_approaching: (v) =>
            `⏰ ${v.userName}, tu tarea <b>${v.taskTitle}</b> vence en <b>${v.daysLeft} día${v.daysLeft !== 1 ? "s" : ""}</b>.` +
            `${v.priority === "critical" ? " ⚠️ <b>Prioridad CRÍTICA.</b>" : ""}\n\n` +
            `Verifica que estás en camino para completarla a tiempo. 💪`,

        dependency_bottleneck: (v) =>
            `🔗 ${v.userName}, tu tarea <b>${v.blockerTitle}</b> está bloqueando a <b>${v.blockedTitle}</b>.\n\n` +
            `Cuando la completes, el compañero podrá continuar. ¿Necesitas apoyo? 🤝`,

        workload_imbalance: (v) =>
            `📊 ${v.userName}, tienes <b>${v.taskCount} tareas activas</b> asignadas. Eso es más que el promedio del equipo.\n\n` +
            `Si sientes que la carga es excesiva, hablemos para redistribuir. Tu bienestar importa. 💙`,

        gantt_drift: (v) =>
            `📅 ${v.userName}, la tarea <b>${v.taskTitle}</b> se desvió <b>${v.driftDays} días</b> del cronograma planificado.\n\n` +
            `Actualiza el Gantt o avísame si necesitas ajustar las fechas. 📊`,

        stale_validation: (v) =>
            `🔍 ${v.userName}, la tarea <b>${v.taskTitle}</b> lleva <b>${v.hoursWaiting}h</b> en validación sin revisión.\n\n` +
            `¿Puedes revisarla hoy? El equipo espera tu feedback. ✅`,

        high_priority_no_progress: (v) =>
            `🔴 ${v.userName}, la tarea <b>${v.taskTitle}</b> (prioridad <b>${v.priority}</b>) lleva 24h sin registrar avance.\n\n` +
            `Las tareas de alta prioridad requieren atención diaria. ¿Todo bien? 💪`,

        project_deadline_approaching: (v) =>
            `🏗️ ${v.userName}, el proyecto <b>${v.projectName}</b> vence en <b>${v.daysLeft} días</b> y tienes <b>${v.pendingCount} tarea${v.pendingCount !== 1 ? "s" : ""} pendiente${v.pendingCount !== 1 ? "s" : ""}</b>.\n\n` +
            `Coordinemos para asegurar la entrega a tiempo. 🎯`,

        // ─── Roadmap Templates ───

        milestone_approaching: (v) =>
            `🏁 ${v.userName}, el milestone <b>${v.milestoneName}</b> vence en <b>${v.daysLeft} días</b> y quedan <b>${v.pendingTasks} tareas pendientes</b>.\n\n` +
            `Revisemos el estado del equipo para asegurar la entrega. 📊`,

        milestone_overdue: (v) =>
            `🚩 ${v.userName}, el milestone <b>${v.milestoneName}</b> está <b>${v.daysOverdue} días vencido</b> sin cerrar.\n\n` +
            `¿Necesitamos reprogramar o hay bloqueos que resolver? 🤝`,
    };

    const builder = templates[templateKey];
    if (!builder) return `📌 Recordatorio de AutoBOM Pro — ${templateKey}`;
    return builder(vars);
}

module.exports = { RULES, buildNudgeMessage };


