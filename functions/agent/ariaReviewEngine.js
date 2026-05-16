/**
 * ARIA Review Engine
 * ===================
 * Executes ARIA's scheduled review tasks: Gantt review, risk pulse,
 * workload balance, and deadline watch.
 *
 * Each review produces findings stored in agent_nudges with rule_key
 * prefixed "aria_review_". Results are also logged for the ARIA dashboard.
 *
 * ═══ COSTO ═══
 * ✅ Data queries: Supabase (pure SQL, $0)
 * ✅ Summary generation: NVIDIA NIM (free tier, optional)
 * ❌ Gemini: NEVER used in review tasks
 */

const coreReader = require("../db/coreDataReader");

/**
 * Run all scheduled review tasks for ARIA.
 * Called from the heartbeat handler at specific hours.
 *
 * @param {Object} options
 * @param {number} options.currentHour - Current hour in Costa Rica timezone (0-23)
 * @returns {Promise<{reviews: Array<{type: string, findings: number, summary: string}>}>}
 */
async function runScheduledReviews({ currentHour }) {
    const tag = "[ariaReviewEngine]";
    const reviews = [];

    try {
        // Daily Gantt Review — 7 AM
        if (currentHour === 7) {
            const result = await ganttReview();
            reviews.push(result);
            console.log(`${tag} Gantt review: ${result.findings} findings`);
        }

        // Risk Pulse — 8 AM and 2 PM
        if (currentHour === 8 || currentHour === 14) {
            const result = await riskPulse();
            reviews.push(result);
            console.log(`${tag} Risk pulse: ${result.findings} findings`);
        }

        // Workload Balance — 8:30 AM (runs at 8)
        if (currentHour === 8) {
            const result = await workloadBalance();
            reviews.push(result);
            console.log(`${tag} Workload balance: ${result.findings} findings`);
        }

        // Deadline Watch — 9 AM
        if (currentHour === 9) {
            const result = await deadlineWatch();
            reviews.push(result);
            console.log(`${tag} Deadline watch: ${result.findings} findings`);
        }

    } catch (err) {
        console.error(`${tag} Review engine error:`, err.message);
    }

    // Store review results in settings for dashboard display
    if (reviews.length > 0) {
        try {
            const { getSupabase } = require("../db/supabaseAdmin");
            const sb = getSupabase();
            await sb.from("settings").upsert({
                key: "ariaLastReviews",
                value: { reviews, lastRun: new Date().toISOString(), hour: currentHour },
                category: "aria",
                updated_at: new Date().toISOString(),
            }, { onConflict: "key" });
        } catch (e) {
            console.warn(`${tag} Failed to store review results:`, e.message);
        }
    }

    return { reviews };
}

/**
 * Gantt Review: Detect tasks drifting from planned schedule.
 */
async function ganttReview() {
    const ganttTasks = await coreReader.loadGanttTasks();
    const today = new Date().toISOString().split("T")[0];
    const drifting = [];

    for (const t of ganttTasks) {
        if (["completed", "cancelled"].includes(t.status)) continue;
        if (!t.plannedEndDate || t.plannedEndDate >= today) continue;
        const driftDays = Math.floor((Date.now() - new Date(t.plannedEndDate).getTime()) / 86400000);
        if (driftDays >= 3) {
            drifting.push({
                taskId: t.id,
                title: t.title,
                driftDays,
                assignedTo: t.assignedTo,
                percentComplete: t.percentComplete || 0,
            });
        }
    }

    return {
        type: "gantt_review",
        findings: drifting.length,
        summary: drifting.length === 0
            ? "✅ Todas las tareas están dentro del cronograma Gantt."
            : `⚠️ ${drifting.length} tarea${drifting.length !== 1 ? "s" : ""} con desviación del Gantt (${drifting.map(d => `${d.title}: +${d.driftDays}d`).join(", ")}).`,
        details: drifting,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Risk Pulse: Check project risk levels.
 */
async function riskPulse() {
    const projects = await coreReader.loadAllProjects();
    const activeProjects = projects.filter(p => !["cancelled", "completed"].includes(p.status));
    const highRisk = activeProjects.filter(p => (p.riskScore || 0) >= 60);
    const medRisk = activeProjects.filter(p => (p.riskScore || 0) >= 30 && (p.riskScore || 0) < 60);

    return {
        type: "risk_pulse",
        findings: highRisk.length + medRisk.length,
        summary: highRisk.length === 0 && medRisk.length === 0
            ? "✅ Todos los proyectos activos tienen riesgo bajo."
            : `${highRisk.length > 0 ? `🔴 ${highRisk.length} proyecto${highRisk.length !== 1 ? "s" : ""} en riesgo ALTO. ` : ""}${medRisk.length > 0 ? `🟡 ${medRisk.length} en riesgo medio.` : ""}`,
        details: { highRisk: highRisk.map(p => ({ name: p.name, riskScore: p.riskScore })), medRisk: medRisk.map(p => ({ name: p.name, riskScore: p.riskScore })) },
        timestamp: new Date().toISOString(),
    };
}

/**
 * Workload Balance: Detect overloaded or idle team members.
 */
async function workloadBalance() {
    const workload = await coreReader.calculateTeamWorkload();
    const overloaded = workload.filter(w => w.activeTasks > 8);
    const idle = workload.filter(w => w.activeTasks <= 1 && w.role !== "manager");

    return {
        type: "workload_balance",
        findings: overloaded.length + idle.length,
        summary: overloaded.length === 0 && idle.length === 0
            ? "✅ Carga de trabajo balanceada en el equipo."
            : `${overloaded.length > 0 ? `📈 ${overloaded.length} ingeniero${overloaded.length !== 1 ? "s" : ""} sobrecargado${overloaded.length !== 1 ? "s" : ""}. ` : ""}${idle.length > 0 ? `📉 ${idle.length} con poca carga.` : ""}`,
        details: { overloaded: overloaded.map(w => ({ name: w.name, tasks: w.activeTasks })), idle: idle.map(w => ({ name: w.name, tasks: w.activeTasks })) },
        timestamp: new Date().toISOString(),
    };
}

/**
 * Deadline Watch: Scan upcoming deadlines in the next 7 days.
 */
async function deadlineWatch() {
    const upcoming = await coreReader.loadUpcomingDeadlines(7);
    const critical = upcoming.filter(t => t.dueDate && Math.ceil((new Date(t.dueDate).getTime() - Date.now()) / 86400000) <= 3);

    return {
        type: "deadline_watch",
        findings: upcoming.length,
        summary: upcoming.length === 0
            ? "✅ No hay entregas en los próximos 7 días."
            : `📅 ${upcoming.length} tarea${upcoming.length !== 1 ? "s" : ""} con entrega en 7 días${critical.length > 0 ? ` (${critical.length} en ≤3 días ⚠️)` : ""}.`,
        details: { total: upcoming.length, critical: critical.length, tasks: upcoming.slice(0, 10).map(t => ({ title: t.title, dueDate: t.dueDate, status: t.status })) },
        timestamp: new Date().toISOString(),
    };
}

module.exports = { runScheduledReviews };
