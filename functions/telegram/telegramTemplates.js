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

module.exports = {
    morningDigestTechnician,
    morningDigestEngineer,
    morningDigestManager,
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
};
