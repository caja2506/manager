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
    };

    const builder = templates[templateKey];
    if (!builder) return `📌 Recordatorio de AutoBOM Pro — ${templateKey}`;
    return builder(vars);
}

module.exports = { RULES, buildNudgeMessage };
