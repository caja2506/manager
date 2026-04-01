/**
 * Telegram Templates — Backend (CJS)
 * =====================================
 * Deterministic message templates in Spanish.
 * Designed for easy Gemini replacement in Phase 3.
 * All functions return plain strings (HTML parse mode).
 */

// ── Morning Digest Templates ──

function morningDigestTechnician({ name, tasks = [], overdueTasks = [] }) {
    const greeting = `🌅 <b>Buenos días, ${name}</b>\n`;
    const header = "Aquí está tu resumen del día:\n\n";

    let body = "";
    if (tasks.length > 0) {
        body += `📋 <b>Tareas activas:</b> ${tasks.length}\n`;
        tasks.slice(0, 5).forEach((t, i) => {
            body += `  ${i + 1}. ${t.title}${t.dueDate ? ` (vence: ${t.dueDate})` : ""}\n`;
        });
        if (tasks.length > 5) body += `  ... y ${tasks.length - 5} más\n`;
    } else {
        body += "📋 No tienes tareas activas asignadas.\n";
    }

    if (overdueTasks.length > 0) {
        body += `\n⚠️ <b>Tareas vencidas:</b> ${overdueTasks.length}\n`;
        overdueTasks.slice(0, 3).forEach((t) => {
            body += `  ❗ ${t.title} (vencida desde ${t.dueDate})\n`;
        });
    }

    body += "\n💡 Si necesitas reportar un avance, usa /report";
    return greeting + header + body;
}

function morningDigestEngineer({ name, teamTasks = [], blockedTasks = [], riskCount = 0 }) {
    let msg = `🌅 <b>Buenos días, ${name}</b>\n`;
    msg += "Resumen de ingeniería para hoy:\n\n";
    msg += `📋 Tareas del equipo: <b>${teamTasks.length}</b>\n`;
    msg += `🚫 Bloqueadas: <b>${blockedTasks.length}</b>\n`;
    msg += `⚠️ Riesgos activos: <b>${riskCount}</b>\n`;

    if (blockedTasks.length > 0) {
        msg += "\n<b>Tareas bloqueadas:</b>\n";
        blockedTasks.slice(0, 5).forEach((t) => {
            msg += `  🔴 ${t.title}${t.blockedReason ? ` — ${t.blockedReason}` : ""}\n`;
        });
    }

    msg += "\n📊 Revisa el panel para más detalles.";
    return msg;
}

function morningDigestManager({ name, totalTasks = 0, overdueTasks = 0, blockedTasks = 0, teamCount = 0 }) {
    let msg = `🌅 <b>Buenos días, ${name}</b>\n`;
    msg += "Resumen ejecutivo del equipo:\n\n";
    msg += `👥 Miembros activos: <b>${teamCount}</b>\n`;
    msg += `📋 Tareas activas: <b>${totalTasks}</b>\n`;
    msg += `⏰ Vencidas: <b>${overdueTasks}</b>\n`;
    msg += `🚫 Bloqueadas: <b>${blockedTasks}</b>\n`;

    if (overdueTasks > 0 || blockedTasks > 0) {
        msg += "\n⚡ <b>Acción requerida:</b> Revisa las tareas vencidas y bloqueadas.";
    } else {
        msg += "\n✅ Todo dentro de parámetros normales.";
    }

    return msg;
}

/**
 * Team-level Daily Scrum summary for managers/engineers.
 * Uses same logic as Equipo Hoy page.
 * Shows actual task names, not just counts.
 */
function morningDigestTeamScrum({ name, summary, scrumData, teamMembers }) {
    const memberMap = {};
    (teamMembers || []).forEach(m => { memberMap[m.uid || m.id] = m.displayName || m.email; });

    // Helper: list tasks as indented lines (max 3)
    const listTasks = (tasks, max = 3) => {
        let out = '';
        tasks.slice(0, max).forEach(t => {
            out += `      ◦ ${t.title || 'Sin título'}\n`;
        });
        if (tasks.length > max) out += `      ... +${tasks.length - max} más\n`;
        return out;
    };

    let msg = `🌅 <b>Equipo Hoy — ${name}</b>\n`;
    msg += `📊 Daily Scrum Digital Dashboard\n\n`;

    // Summary line
    msg += `👥 <b>${summary.total}</b> personas`;
    msg += ` · 🟢 ${summary.ok} OK`;
    if (summary.sin_tareas > 0) msg += ` · 🟡 ${summary.sin_tareas} sin tareas`;
    if (summary.sin_reporte > 0) msg += ` · 🔴 ${summary.sin_reporte} sin reporte`;
    if (summary.bloqueado > 0) msg += ` · ⛔ ${summary.bloqueado} bloqueado`;
    msg += `\n`;

    // ── Blocked
    const blocked = scrumData.filter(p => p.status === 'bloqueado');
    if (blocked.length > 0) {
        msg += `\n⛔ <b>BLOQUEADOS</b>\n`;
        blocked.forEach(p => {
            const eng = p.engineerId ? memberMap[p.engineerId] : null;
            msg += `  • <b>${p.displayName}</b>`;
            if (eng) msg += ` → <i>resp: ${eng}</i>`;
            msg += `\n`;
            if (p.todayTasks.length > 0) msg += listTasks(p.todayTasks);
        });
    }

    // ── No report
    const noReport = scrumData.filter(p => p.status === 'sin_reporte');
    if (noReport.length > 0) {
        msg += `\n🔴 <b>SIN REPORTE AYER</b>\n`;
        noReport.forEach(p => {
            const eng = p.engineerId ? memberMap[p.engineerId] : null;
            msg += `  • <b>${p.displayName}</b>`;
            if (eng) msg += ` → <i>resp: ${eng}</i>`;
            msg += `\n`;
            if (p.todayTasks.length > 0) {
                msg += `    📋 Hoy:\n`;
                msg += listTasks(p.todayTasks);
            } else {
                msg += `    ⚠ Sin tareas hoy\n`;
            }
        });
    }

    // ── No tasks
    const noTasks = scrumData.filter(p => p.status === 'sin_tareas');
    if (noTasks.length > 0) {
        msg += `\n🟡 <b>SIN TAREAS HOY</b>\n`;
        noTasks.forEach(p => {
            const eng = p.engineerId ? memberMap[p.engineerId] : null;
            msg += `  • <b>${p.displayName}</b>`;
            if (eng) msg += ` → <i>resp: ${eng}</i>`;
            msg += `\n`;
        });
    }

    // ── OK — show what they're working on
    const okPeople = scrumData.filter(p => p.status === 'ok');
    if (okPeople.length > 0) {
        msg += `\n🟢 <b>EQUIPO OK</b>\n`;
        okPeople.forEach(p => {
            msg += `  • <b>${p.displayName}</b> (${p.todayTasks.length} tarea${p.todayTasks.length !== 1 ? 's' : ''})\n`;
            msg += listTasks(p.todayTasks);
        });
    }

    // ── Engineers that need to react
    const engineerAlerts = {};
    scrumData.filter(p => p.status !== 'ok' && p.engineerId).forEach(p => {
        const engName = memberMap[p.engineerId] || p.engineerId;
        if (!engineerAlerts[engName]) engineerAlerts[engName] = [];
        engineerAlerts[engName].push(p.displayName);
    });

    const engKeys = Object.keys(engineerAlerts);
    if (engKeys.length > 0) {
        msg += `\n👷 <b>INGENIEROS QUE DEBEN REVISAR</b>\n`;
        engKeys.forEach(eng => {
            msg += `  • ${eng}: ${engineerAlerts[eng].join(', ')}\n`;
        });
    }

    // ── Footer
    if (summary.needsAttention > 0) {
        msg += `\n⚡ <b>Acción requerida:</b> ${summary.needsAttention} persona(s) necesitan atención.`;
    } else {
        msg += `\n✅ Equipo completo y sin alertas.`;
    }

    return msg;
}

// ── Report Templates ──

function reportRequest({ name }) {
    return `📝 <b>Solicitud de Reporte — ${name}</b>\n\n` +
        "Es hora de registrar tu avance del día.\n\n" +
        "Por favor responde con el siguiente formato:\n\n" +
        "<code>avance: [porcentaje]\nhoras: [horas trabajadas]\nbloqueo: [sí/no y descripción]</code>\n\n" +
        "Ejemplo:\n" +
        "<code>avance: 60\nhoras: 5\nbloqueo: no</code>\n\n" +
        "O si hay bloqueo:\n" +
        "<code>avance: 30\nhoras: 3\nbloqueo: esperando materiales del proveedor</code>";
}

function reportConfirmation({ name, progress, hours, blocker }) {
    let msg = `✅ <b>Reporte recibido — ${name}</b>\n\n`;
    msg += `📊 Avance: <b>${progress}%</b>\n`;
    msg += `⏱ Horas: <b>${hours}h</b>\n`;
    msg += blocker ? `🚫 Bloqueo: ${blocker}\n` : "✅ Sin bloqueos\n";
    msg += "\n¡Gracias por tu reporte! Queda registrado en el sistema.";
    return msg;
}

function reportFormatError() {
    return "⚠️ <b>Formato no reconocido</b>\n\n" +
        "No pude interpretar tu mensaje. Por favor usa este formato:\n\n" +
        "<code>avance: [número]\nhoras: [número]\nbloqueo: [sí/no]</code>\n\n" +
        "Ejemplo:\n" +
        "<code>avance: 60\nhoras: 5\nbloqueo: no</code>";
}

// ── Escalation Templates ──

function escalationToTechnician({ name, minutesLate }) {
    return `🔔 <b>Recordatorio urgente — ${name}</b>\n\n` +
        `Han pasado <b>${minutesLate} minutos</b> desde la solicitud de tu reporte diario.\n\n` +
        "⚠️ Este incumplimiento será notificado a tu responsable directo.\n\n" +
        "Por favor envía tu reporte ahora usando /report";
}

function escalationToSupervisor({ technicianName, supervisorName, minutesLate }) {
    return `⚠️ <b>Escalación — Reporte pendiente</b>\n\n` +
        `${supervisorName}, el técnico <b>${technicianName}</b> no ha enviado su reporte diario.\n\n` +
        `⏱ Tiempo transcurrido: <b>${minutesLate} min</b> después del vencimiento.\n\n` +
        "Se ha registrado esta escalación en el sistema.";
}

// ── System Templates ──

function testMessage({ name, timestamp }) {
    return `🧪 <b>Mensaje de prueba</b>\n\n` +
        `Hola ${name}, este es un mensaje de prueba del sistema AutoBOM Pro.\n\n` +
        `📡 Conexión verificada\n` +
        `🕐 ${timestamp}\n\n` +
        "Si recibes esto, tu canal Telegram está configurado correctamente.";
}

function welcomeMessage() {
    return `👋 <b>Bienvenido a AutoBOM Pro Bot</b>\n\n` +
        "Este bot es parte del sistema de automatización operativa.\n\n" +
        "Comandos disponibles:\n" +
        "/start — Ver este mensaje\n" +
        "/link CÓDIGO — Vincular tu cuenta\n" +
        "/status — Ver tu estado actual\n" +
        "/report — Enviar tu reporte diario\n" +
        "/help — Ayuda y soporte\n\n" +
        "📎 Si aún no estás vinculado, pide un <b>código de enlace</b> a tu administrador y escribe:\n" +
        "<code>/link TU_CÓDIGO</code>";
}

function statusMessage({ name, role, sessionState, lastReport }) {
    let msg = `📊 <b>Estado actual — ${name}</b>\n\n`;
    msg += `👤 Rol: <b>${role || "No asignado"}</b>\n`;
    msg += `🔄 Estado sesión: <b>${sessionState || "idle"}</b>\n`;
    if (lastReport) {
        msg += `📝 Último reporte: <b>${lastReport}</b>\n`;
    }
    msg += "\n💡 Usa /report para enviar tu reporte diario.";
    return msg;
}

function helpMessage() {
    return `❓ <b>Ayuda — AutoBOM Pro Bot</b>\n\n` +
        "<b>Comandos:</b>\n" +
        "/start — Mensaje de bienvenida\n" +
        "/link CÓDIGO — Vincular tu cuenta\n" +
        "/status — Tu estado actual en el sistema\n" +
        "/report — Iniciar reporte de avance diario\n" +
        "/reset — Reiniciar sesión\n" +
        "/help — Esta ayuda\n\n" +
        "<b>Formato de reporte:</b>\n" +
        "<code>avance: 60\nhoras: 5\nbloqueo: no</code>\n\n" +
        "<b>Vincular cuenta:</b>\n" +
        "Pide un código a tu admin y escribe <code>/link TU_CÓDIGO</code>\n\n" +
        "<b>Soporte:</b>\n" +
        "Si tienes problemas, contacta a tu administrador.";
}

function unknownUserMessage() {
    return "⚠️ <b>Usuario no vinculado</b>\n\n" +
        "Tu cuenta de Telegram no está vinculada al sistema AutoBOM Pro.\n\n" +
        "📎 Si tienes un código de enlace, escribe:\n" +
        "<code>/link TU_CÓDIGO</code>\n\n" +
        "Si no tienes código, pídelo a tu administrador.";
}

function linkSuccess({ name, role }) {
    return `✅ <b>¡Vinculación exitosa!</b>\n\n` +
        `Bienvenido, <b>${name}</b>\n` +
        `👤 Rol: <b>${role}</b>\n\n` +
        "Tu cuenta de Telegram ahora está conectada al sistema AutoBOM Pro.\n\n" +
        "<b>Comandos disponibles:</b>\n" +
        "/status — Ver tu estado\n" +
        "/report — Enviar reporte diario\n" +
        "/help — Ayuda\n\n" +
        "🎉 ¡Empezarás a recibir notificaciones automáticas!";
}

// ── Day Close Templates ──

function closeDayIndividual({ name, date, totalHours, overtimeHours, tasksCompleted, tasks = [], delaysReported, quickReport }) {
    const formattedDate = formatDateES(date);
    let msg = `📊 <b>Cierre de Día — ${formattedDate}</b>\n\n`;
    msg += `⏱ Horas: <b>${totalHours}h</b>`;
    if (overtimeHours > 0) msg += ` (${overtimeHours}h overtime)`;
    msg += `\n`;
    msg += `✅ Completadas: <b>${tasksCompleted}</b>\n`;

    if (tasks.length > 0) {
        msg += `\n📋 <b>Desglose:</b>\n`;
        tasks.forEach((t, i) => {
            msg += `  ${i + 1}. ${t.title} — ${t.hours}h`;
            if (t.progress) msg += ` (${t.progress}%)`;
            msg += `\n`;
        });
    }

    if (quickReport) {
        if (quickReport.blocker) {
            msg += `\n🚫 <b>Bloqueador:</b> ${quickReport.blocker}\n`;
        }
        if (quickReport.notes) {
            const truncated = quickReport.notes.length > 150
                ? quickReport.notes.substring(0, 150) + "..."
                : quickReport.notes;
            msg += `💬 <b>Tu reporte:</b> "${truncated}"\n`;
        }
    }

    if (delaysReported > 0) {
        msg += `\n⚠️ ${delaysReported} delay(s) reportado(s)\n`;
    }

    msg += `\nBuen trabajo, ${name} 💪`;
    return msg;
}

function closeDayTeamSummary({ name, date, teamSize, totalHours, overtimeHours, tasksCompleted, delaysReported, missingReports, timersAutoStopped, team = [] }) {
    const formattedDate = formatDateES(date);
    let msg = `📊 <b>Equipo — Cierre (${formattedDate})</b>\n\n`;
    msg += `👥 ${teamSize} personas · ⏱ ${totalHours}h`;
    if (overtimeHours > 0) msg += ` (${overtimeHours}h OT)`;
    msg += ` · ✅ ${tasksCompleted} completadas\n`;
    msg += `⏹ ${timersAutoStopped} timers detenidos\n\n`;

    // Per-person summary
    team.forEach(p => {
        let line = `👤 <b>${p.name}</b> — ${p.hours}h`;
        if (p.tasksCompleted > 0) line += ` ✅`;
        if (p.hasBlocker) line += ` ⚠️`;
        if (p.quickReportMissing) line += ` 🔴`;
        if (p.topTasks.length > 0) line += ` · ${p.topTasks.join(", ")}`;
        msg += line + `\n`;
    });

    // Alerts
    if (missingReports > 0) {
        msg += `\n🔴 Sin Quick Report: <b>${missingReports}</b>`;
    }
    if (delaysReported > 0) {
        msg += `\n📉 Delays nuevos: <b>${delaysReported}</b>`;
    }

    msg += `\n\n${name}, cierre de día completado. ✔️`;
    return msg;
}

/**
 * Format date string to Spanish format (31/Mar/2026)
 */
function formatDateES(dateStr) {
    try {
        const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const d = new Date(dateStr + 'T12:00:00');
        return `${d.getDate()}/${months[d.getMonth()]}/${d.getFullYear()}`;
    } catch {
        return dateStr;
    }
}

module.exports = {
    morningDigestTechnician,
    morningDigestEngineer,
    morningDigestManager,
    morningDigestTeamScrum,
    reportRequest,
    reportConfirmation,
    reportFormatError,
    escalationToTechnician,
    escalationToSupervisor,
    testMessage,
    welcomeMessage,
    statusMessage,
    helpMessage,
    unknownUserMessage,
    linkSuccess,
    closeDayIndividual,
    closeDayTeamSummary,
};

