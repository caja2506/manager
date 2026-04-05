/**
 * Email Templates — V2 "Manager Briefing"
 * ==========================================
 * Professional HTML email with 5 actionable sections.
 * Uses inline CSS for Gmail/Outlook compatibility.
 *
 * @module email/emailTemplates
 */

function dailyPerformanceReport(data) {
    const {
        datePretty, pulseOfDay, teamNarratives, actionableAlerts,
        productivityAlerts, overdueTasks, tomorrowView, achievements,
    } = data;

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:20px 0;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.3);">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;">
  <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">📊 Briefing del Equipo</h1>
  <p style="margin:8px 0 0;color:#c7d2fe;font-size:14px;">${datePretty} — AnalyzeOps</p>
</td></tr>

<!-- ══════════════════════════════════════ -->
<!-- SECTION 1: PULSO DEL DÍA             -->
<!-- ══════════════════════════════════════ -->
<tr><td style="padding:28px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;border-bottom:1px solid #334155;padding-bottom:8px;">📊 Pulso del Día</h2>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      ${pulseCard("⏱️", "Horas Reales", `${pulseOfDay.hoursReal}h`, pulseOfDay.hoursPct >= 80 ? "#22c55e" : pulseOfDay.hoursPct >= 60 ? "#f59e0b" : "#ef4444", `de ${pulseOfDay.hoursExpected}h (${pulseOfDay.hoursPct}%)`)}
      ${pulseCard("📋", "Planificadas", `${pulseOfDay.hoursPlanned}h`, "#3b82f6", "en el planner")}
      ${pulseCard("✅", "Completadas", pulseOfDay.tasksCompletedToday, "#22c55e", `de ${pulseOfDay.activeTasks} activas`)}
    </tr>
    <tr>
      ${pulseCard("📌", "Subtareas", `${pulseOfDay.subtasksCompleted}/${pulseOfDay.subtasksTotal}`, pulseOfDay.subtasksPct >= 40 ? "#22c55e" : "#f59e0b", `${pulseOfDay.subtasksPct}% avance`)}
      ${pulseCard("🚫", "Bloqueadas", pulseOfDay.blockedTasks, pulseOfDay.blockedTasks > 0 ? "#ef4444" : "#22c55e", "")}
      ${pulseCard("⚠️", "Nuevas Vencidas", pulseOfDay.newOverdue, pulseOfDay.newOverdue > 0 ? "#ef4444" : "#22c55e", `${overdueTasks.length} total`)}
    </tr>
  </table>
</td></tr>

<!-- ══════════════════════════════════════ -->
<!-- SECTION 2: EQUIPO (Narrativa)        -->
<!-- ══════════════════════════════════════ -->
${teamNarratives.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;border-bottom:1px solid #334155;padding-bottom:8px;">👥 ¿Quién Hizo Qué?</h2>
  ${teamNarratives.map(n => narrativeCard(n)).join("")}
</td></tr>
` : ""}

<!-- ══════════════════════════════════════ -->
<!-- SECTION 3: PRODUCTIVIDAD             -->
<!-- ══════════════════════════════════════ -->
${productivityAlerts.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#fca5a5;font-size:18px;border-bottom:1px solid #7f1d1d;padding-bottom:8px;">🔴 Alertas de Productividad</h2>
  <p style="color:#94a3b8;font-size:11px;margin:0 0 12px;font-style:italic;">Personas con muchas horas registradas pero sin resultados medibles</p>
  ${productivityAlerts.map(a => productivityCard(a)).join("")}
</td></tr>
` : ""}

<!-- ══════════════════════════════════════ -->
<!-- SECTION 4: ALERTAS ACCIONABLES       -->
<!-- ══════════════════════════════════════ -->
${actionableAlerts.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;border-bottom:1px solid #334155;padding-bottom:8px;">🚨 Alertas Accionables</h2>
  ${actionableAlerts.slice(0, 8).map(a => alertCard(a)).join("")}
</td></tr>
` : ""}

<!-- ══════════════════════════════════════ -->
<!-- SECTION 5: LOGROS                    -->
<!-- ══════════════════════════════════════ -->
${achievements.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;border-bottom:1px solid #334155;padding-bottom:8px;">🎉 Logros del Día</h2>
  ${achievements.map(a => `
    <div style="background:#064e3b;border-radius:8px;padding:10px 14px;margin-bottom:6px;border-left:3px solid #22c55e;">
      <p style="margin:0;color:#d1fae5;font-size:13px;">✅ <strong>${a.title}</strong></p>
      <p style="margin:4px 0 0;color:#6ee7b7;font-size:11px;">Completada por ${a.completedBy}</p>
    </div>
  `).join("")}
</td></tr>
` : ""}

<!-- ══════════════════════════════════════ -->
<!-- SECTION 6: VISTA DEL MAÑANA          -->
<!-- ══════════════════════════════════════ -->
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;border-bottom:1px solid #334155;padding-bottom:8px;">📅 Vista del Mañana</h2>
  <div style="background:#0f172a;border-radius:8px;padding:16px;border-left:3px solid #818cf8;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:4px 0;color:#c7d2fe;font-size:13px;">👥 Personas planificadas</td>
        <td align="right" style="color:#f1f5f9;font-size:14px;font-weight:700;">${tomorrowView.plannedUsers}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#c7d2fe;font-size:13px;">⏱️ Horas programadas</td>
        <td align="right" style="color:#f1f5f9;font-size:14px;font-weight:700;">${tomorrowView.totalHours}h</td>
      </tr>
      ${tomorrowView.unassignedTasks > 0 ? `
      <tr>
        <td style="padding:4px 0;color:#fbbf24;font-size:13px;">🆕 Tareas sin asignar</td>
        <td align="right" style="color:#fbbf24;font-size:14px;font-weight:700;">${tomorrowView.unassignedTasks}</td>
      </tr>
      ` : ""}
    </table>
    ${tomorrowView.tasksDueTomorrow.length > 0 ? `
      <div style="margin-top:12px;border-top:1px solid #334155;padding-top:10px;">
        <p style="margin:0 0 6px;color:#fca5a5;font-size:12px;font-weight:600;">⚠️ Tareas que vencen mañana:</p>
        ${tomorrowView.tasksDueTomorrow.slice(0, 5).map(t => `
          <p style="margin:2px 0;color:#e2e8f0;font-size:12px;">• ${t.title} <span style="color:#94a3b8;">(${t.assignedTo})</span></p>
        `).join("")}
      </div>
    ` : ""}
  </div>
</td></tr>

<!-- ══════════════════════════════════════ -->
<!-- OVERDUE                              -->
<!-- ══════════════════════════════════════ -->
${overdueTasks.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;border-bottom:1px solid #334155;padding-bottom:8px;">📋 Tareas Vencidas (${overdueTasks.length})</h2>
  ${overdueTasks.slice(0, 8).map(t => `
    <div style="background:#0f172a;border-radius:6px;padding:10px 14px;margin-bottom:6px;border-left:3px solid #ef4444;">
      <p style="margin:0;color:#f1f5f9;font-size:13px;font-weight:500;">${t.title}</p>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">${t.assignedTo} — venció hace ${t.daysOverdue} día${t.daysOverdue !== 1 ? "s" : ""}</p>
    </div>
  `).join("")}
  ${overdueTasks.length > 8 ? `<p style="color:#64748b;font-size:12px;margin:8px 0;">... y ${overdueTasks.length - 8} más</p>` : ""}
</td></tr>
` : ""}

<!-- Footer -->
<tr><td style="padding:24px 40px;background:#0f172a;border-top:1px solid #334155;">
  <table width="100%"><tr>
    <td style="color:#64748b;font-size:12px;">
      Generado automáticamente por <strong style="color:#818cf8;">AnalyzeOps</strong>
    </td>
    <td align="right">
      <a href="https://analyzeops.com" style="color:#818cf8;font-size:12px;text-decoration:none;">Ver Dashboard →</a>
    </td>
  </tr></table>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

// ═══════════════════════════════════════
// Helper components
// ═══════════════════════════════════════

function pulseCard(icon, label, value, color, subtitle) {
    return `<td width="33%" style="padding:6px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;border-left:3px solid ${color};">
    <tr><td style="padding:12px 14px;">
      <p style="margin:0;color:#94a3b8;font-size:11px;">${icon} ${label}</p>
      <p style="margin:4px 0 0;color:#f1f5f9;font-size:20px;font-weight:700;">${value}</p>
      ${subtitle ? `<p style="margin:2px 0 0;color:#64748b;font-size:10px;">${subtitle}</p>` : ""}
    </td></tr>
  </table>
</td>`;
}

function narrativeCard(n) {
    const planBar = n.plannedHours > 0
        ? `<div style="margin-top:6px;background:#1e293b;border-radius:4px;height:6px;overflow:hidden;"><div style="background:${n.planPct >= 80 ? "#22c55e" : n.planPct >= 60 ? "#f59e0b" : "#ef4444"};height:100%;width:${Math.min(100, n.planPct)}%;border-radius:4px;"></div></div><p style="margin:2px 0 0;color:#64748b;font-size:10px;">Plan: ${n.plannedHours}h → Real: ${n.hours}h (${n.planPct}%)</p>`
        : "";

    const tasksWorked = n.workedOnTasks.slice(0, 3).map(t =>
        `${t.title} (${t.hours}h)`
    ).join(", ");

    const completedList = n.completedTasks.length > 0
        ? `<p style="margin:4px 0 0;color:#86efac;font-size:11px;">✅ Completó: ${n.completedTasks.join(", ")}</p>`
        : "";

    const subtaskStr = n.subtasksTotal > 0
        ? `<span style="color:#94a3b8;"> | 📌 Sub: ${n.subtasksCompleted}/${n.subtasksTotal}</span>`
        : "";

    const reportedStr = n.reported
        ? `<span style="color:#86efac;font-size:10px;"> 📝</span>`
        : "";

    return `<div style="background:#0f172a;border-radius:8px;padding:12px 16px;margin-bottom:8px;border-left:3px solid ${n.statusEmoji === "🟢" ? "#22c55e" : n.statusEmoji === "🟡" ? "#f59e0b" : n.statusEmoji === "🟠" ? "#f97316" : "#ef4444"};">
  <p style="margin:0;color:#f1f5f9;font-size:14px;font-weight:600;">${n.statusEmoji} ${n.name}${reportedStr}<span style="color:#94a3b8;font-size:12px;font-weight:400;"> — ${n.role}</span></p>
  ${n.connectionStr ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">🕐 Conectado: ${n.connectionStr}</p>` : ""}
  ${tasksWorked ? `<p style="margin:4px 0 0;color:#cbd5e1;font-size:12px;">📋 ${tasksWorked}</p>` : `<p style="margin:4px 0 0;color:#f87171;font-size:12px;">📋 Sin registro de trabajo</p>`}
  ${completedList}
  <p style="margin:4px 0 0;color:#e2e8f0;font-size:12px;font-weight:600;">⏱ ${n.hours}h registradas${subtaskStr}</p>
  ${planBar}
</div>`;
}

function productivityCard(a) {
    const borderColor = a.severity === "critical" ? "#dc2626" : "#f97316";
    return `<div style="background:#1c1917;border-radius:8px;padding:12px 16px;margin-bottom:8px;border-left:3px solid ${borderColor};">
  <p style="margin:0;color:#fca5a5;font-size:14px;font-weight:600;">⚠️ ${a.name} <span style="color:#94a3b8;font-size:12px;font-weight:400;">(${a.hours}h registradas)</span></p>
  ${a.details.map(d => `<p style="margin:3px 0 0 12px;color:#e2e8f0;font-size:12px;">${d}</p>`).join("")}
  ${a.workedOn ? `<p style="margin:4px 0 0 12px;color:#94a3b8;font-size:11px;">📋 Trabajó en: ${a.workedOn}</p>` : ""}
  <p style="margin:6px 0 0;color:#818cf8;font-size:11px;font-weight:600;">→ ${a.action}</p>
</div>`;
}

function alertCard(a) {
    const colors = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b" };
    const color = colors[a.severity] || "#64748b";

    return `<div style="background:#0f172a;border-radius:8px;padding:12px 16px;margin-bottom:8px;border-left:3px solid ${color};">
  <p style="margin:0;color:#f1f5f9;font-size:13px;font-weight:600;">${a.icon} ${a.text}</p>
  ${a.detail ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">${a.detail}</p>` : ""}
  ${a.action ? `<p style="margin:4px 0 0;color:#818cf8;font-size:11px;font-weight:600;">→ ${a.action}</p>` : ""}
</div>`;
}

module.exports = { dailyPerformanceReport };
