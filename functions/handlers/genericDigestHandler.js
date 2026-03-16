/**
 * Generic Digest Handler — Backend (CJS)
 * ========================================
 * Handles digest & alert routines with real Firestore data.
 * Works for: engineer_risk_digest, block_incident_alert, and future digests.
 */

const { sendToTargets } = require("../telegram/telegramProvider");
const paths = require("../automation/firestorePaths");

/**
 * Pre-load task & delay data from Firestore.
 */
async function loadDigestData(adminDb) {
    const [tasksSnap, delaysSnap] = await Promise.all([
        adminDb.collection(paths.TASKS).get(),
        adminDb.collection(paths.DELAYS).get(),
    ]);

    const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allDelays = delaysSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const now = new Date();
    const activeTasks = allTasks.filter(t => !["completed", "cancelled"].includes(t.status));
    const blockedTasks = allTasks.filter(t => t.status === "blocked");
    const overdueTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
    const activeDelays = allDelays.filter(d => d.status === "active" || !d.resolvedAt);

    return { allTasks, activeTasks, blockedTasks, overdueTasks, activeDelays, now };
}

// ── Engineer Risk Digest ──

const engineerRiskDigest = {
    async execute(adminDb, token, targets, context) {
        const data = await loadDigestData(adminDb);

        const messageBuilder = async (target) => {
            const uid = target.uid;
            const myTasks = data.activeTasks.filter(t => t.assignedTo === uid);
            const myBlocked = myTasks.filter(t => t.status === "blocked");
            const myOverdue = myTasks.filter(t => t.dueDate && new Date(t.dueDate) < data.now);
            const name = target.name || "Ingeniero";

            // Build task list previews
            const blockedList = data.blockedTasks.slice(0, 5).map(t =>
                `  • <b>${t.title || t.name || "Sin título"}</b> — ${t.assignedToName || "sin asignar"}`
            ).join("\n") || "  Ninguna 🎉";

            const overdueList = data.overdueTasks.slice(0, 5).map(t =>
                `  • <b>${t.title || t.name || "Sin título"}</b> — vence ${t.dueDate || "?"}`
            ).join("\n") || "  Ninguna ✅";

            const delayList = data.activeDelays.slice(0, 3).map(d =>
                `  • ${d.cause || d.description || "Causa no especificada"}`
            ).join("\n") || "  Ninguno registrado";

            return (
                `⚠️ <b>Digest de Riesgo</b>\n\n` +
                `Hola ${name},\n\n` +
                `📊 <b>Resumen del equipo:</b>\n` +
                `  • Tareas activas: <b>${data.activeTasks.length}</b>\n` +
                `  • Bloqueadas: <b>${data.blockedTasks.length}</b>\n` +
                `  • Vencidas: <b>${data.overdueTasks.length}</b>\n` +
                `  • Delays activos: <b>${data.activeDelays.length}</b>\n\n` +
                `🔴 <b>Tareas bloqueadas:</b>\n${blockedList}\n\n` +
                `⏰ <b>Tareas vencidas:</b>\n${overdueList}\n\n` +
                `🐢 <b>Delays activos:</b>\n${delayList}\n\n` +
                `📋 <b>Tus tareas:</b> ${myTasks.length} activas` +
                (myBlocked.length > 0 ? `, ${myBlocked.length} bloqueadas` : "") +
                (myOverdue.length > 0 ? `, ${myOverdue.length} vencidas` : "") +
                `\n\nUsa /report para enviar tu reporte diario.`
            );
        };

        return sendToTargets(adminDb, token, targets, messageBuilder, context);
    },
};

// ── Block Incident Alert ──

const blockIncidentAlert = {
    async execute(adminDb, token, targets, context) {
        const data = await loadDigestData(adminDb);

        const messageBuilder = async (target) => {
            const name = target.name || "Usuario";

            if (data.blockedTasks.length === 0) {
                return (
                    `✅ <b>Sin bloqueos activos</b>\n\n` +
                    `Hola ${name}, no se detectan tareas bloqueadas en este momento. ¡Buen trabajo!`
                );
            }

            const blockedList = data.blockedTasks.slice(0, 8).map(t => {
                const assignee = t.assignedToName || "sin asignar";
                const project = t.projectName || "";
                return `  • <b>${t.title || t.name || "Sin título"}</b>\n    👤 ${assignee}${project ? ` | 📁 ${project}` : ""}`;
            }).join("\n\n");

            return (
                `🚨 <b>Alerta de Bloqueos</b>\n\n` +
                `Hola ${name},\n\n` +
                `Se detectan <b>${data.blockedTasks.length}</b> tarea(s) bloqueada(s):\n\n` +
                `${blockedList}\n\n` +
                `📌 Revisa y actualiza el estado de los bloqueos lo antes posible.\n` +
                `Usa /report para enviar tu reporte con los avances.`
            );
        };

        return sendToTargets(adminDb, token, targets, messageBuilder, context);
    },
};

module.exports = {
    engineerRiskDigest,
    blockIncidentAlert,
    loadDigestData,
};
