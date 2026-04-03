/**
 * Email Templates — Daily Performance Report (CJS)
 * ==================================================
 * Professional HTML email template for team performance reports.
 * Uses inline CSS for maximum Gmail/Outlook compatibility.
 *
 * @module email/emailTemplates
 */

/**
 * Generate the full HTML for the daily performance report email.
 *
 * @param {Object} data - Report data object from buildReportData()
 * @returns {string} Complete HTML string
 */
function dailyPerformanceReport(data) {
    const { date, executiveSummary, risks, kpis, scorecards, overdueTasks, recommendations } = data;

    const formattedDate = formatDateES(date);

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:20px 0;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.3);">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;">
  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">📊 Reporte de Rendimiento</h1>
  <p style="margin:8px 0 0;color:#c7d2fe;font-size:14px;">${formattedDate} — AnalyzeOps</p>
</td></tr>

<!-- Executive Summary -->
<tr><td style="padding:28px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;border-bottom:1px solid #334155;padding-bottom:8px;">📋 Resumen Ejecutivo</h2>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      ${summaryCard("⏱️", "Horas Hoy", `${executiveSummary.totalHoursToday.toFixed(1)}h`, "#3b82f6")}
      ${summaryCard("✅", "Completadas", executiveSummary.tasksCompletedToday, "#22c55e")}
      ${summaryCard("📌", "Activas", executiveSummary.activeTasks, "#f59e0b")}
    </tr>
    <tr>
      ${summaryCard("🚫", "Bloqueadas", executiveSummary.blockedTasks, "#ef4444")}
      ${summaryCard("⚠️", "Delays", executiveSummary.delaysReportedToday, "#f97316")}
      ${summaryCard("👥", "Equipo", executiveSummary.teamSize, "#8b5cf6")}
    </tr>
  </table>
</td></tr>

<!-- Risks -->
${risks && risks.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;border-bottom:1px solid #334155;padding-bottom:8px;">⚠️ Riesgos Operacionales</h2>
  ${risks.map(r => riskRow(r)).join("")}
</td></tr>
` : ""}

<!-- KPIs -->
${kpis ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;border-bottom:1px solid #334155;padding-bottom:8px;">📈 KPIs del Equipo</h2>
  <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
    <tr style="background:#334155;border-radius:8px;">
      <td style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;padding:10px 12px;border-radius:6px 0 0 0;">Métrica</td>
      <td style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;text-align:center;padding:10px 12px;">Valor</td>
      <td style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;text-align:center;padding:10px 12px;border-radius:0 6px 0 0;">Trend</td>
    </tr>
    ${Object.entries(kpis).map(([key, kpi]) => kpiRow(key, kpi)).join("")}
  </table>
</td></tr>
` : ""}

<!-- Individual Scorecards -->
${scorecards && scorecards.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;border-bottom:1px solid #334155;padding-bottom:8px;">👥 Rendimiento Individual</h2>
  <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
    <tr style="background:#334155;">
      <td style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;padding:10px 12px;border-radius:6px 0 0 0;">Nombre</td>
      <td style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;text-align:center;">Horas</td>
      <td style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;text-align:center;">Tareas</td>
      <td style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;text-align:center;">Score</td>
      <td style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;text-align:center;border-radius:0 6px 0 0;">Grade</td>
    </tr>
    ${scorecards.map(s => scorecardRow(s)).join("")}
  </table>
</td></tr>
` : ""}

<!-- Overdue Tasks -->
${overdueTasks && overdueTasks.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;border-bottom:1px solid #334155;padding-bottom:8px;">📋 Tareas Vencidas (${overdueTasks.length})</h2>
  ${overdueTasks.slice(0, 8).map(t => overdueRow(t)).join("")}
  ${overdueTasks.length > 8 ? `<p style="color:#64748b;font-size:13px;margin:8px 0;">... y ${overdueTasks.length - 8} más</p>` : ""}
</td></tr>
` : ""}

<!-- Recommendations -->
${recommendations && recommendations.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;border-bottom:1px solid #334155;padding-bottom:8px;">💡 Recomendaciones</h2>
  ${recommendations.slice(0, 5).map((r, i) => recommendationRow(r, i)).join("")}
</td></tr>
` : ""}

<!-- Footer -->
<tr><td style="padding:24px 40px;background:#0f172a;border-top:1px solid #334155;">
  <table width="100%"><tr>
    <td style="color:#64748b;font-size:12px;">
      Generado automáticamente por <strong style="color:#818cf8;">AnalyzeOps</strong>
    </td>
    <td align="right">
      <a href="https://bom-ame-cr.web.app" style="color:#818cf8;font-size:12px;text-decoration:none;">Ver Dashboard →</a>
    </td>
  </tr></table>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

// ═══════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════

function summaryCard(icon, label, value, color) {
    return `<td width="33%" style="padding:6px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;border-left:3px solid ${color};">
    <tr><td style="padding:12px 14px;">
      <p style="margin:0;color:#94a3b8;font-size:11px;">${icon} ${label}</p>
      <p style="margin:4px 0 0;color:#f1f5f9;font-size:20px;font-weight:700;">${value}</p>
    </td></tr>
  </table>
</td>`;
}

function riskRow(risk) {
    const colors = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#64748b" };
    const icons = { critical: "🔴", high: "🟠", medium: "🟡", low: "⚪" };
    const color = colors[risk.severity] || "#64748b";
    const icon = icons[risk.severity] || "⚪";

    return `<div style="background:#0f172a;border-radius:8px;padding:12px 16px;margin-bottom:8px;border-left:3px solid ${color};">
  <p style="margin:0;color:#f1f5f9;font-size:14px;font-weight:600;">${icon} ${risk.justification || risk.kpiName}</p>
  ${risk.suggestedAction ? `<p style="margin:6px 0 0;color:#94a3b8;font-size:12px;">💡 ${risk.suggestedAction}</p>` : ""}
</div>`;
}

function kpiRow(key, kpi) {
    const label = KPI_LABELS[key] || key;
    const value = typeof kpi.value === "number" ? `${(kpi.value * 100).toFixed(0)}%` : "N/A";
    const trendIcon = kpi.trend === "up" ? "↑" : kpi.trend === "down" ? "↓" : "→";
    const trendColor = kpi.trend === "up" ? "#22c55e" : kpi.trend === "down" ? "#ef4444" : "#94a3b8";

    return `<tr style="border-bottom:1px solid #1e293b;">
  <td style="color:#e2e8f0;font-size:13px;padding:10px 12px;">${label}</td>
  <td style="color:#f1f5f9;font-size:14px;font-weight:600;text-align:center;padding:10px 12px;">${value}</td>
  <td style="color:${trendColor};font-size:16px;font-weight:700;text-align:center;padding:10px 12px;">${trendIcon}</td>
</tr>`;
}

function scorecardRow(s) {
    const gradeColors = { A: "#22c55e", B: "#3b82f6", C: "#f59e0b", D: "#f97316", F: "#ef4444" };
    const color = gradeColors[s.grade] || "#94a3b8";

    return `<tr style="border-bottom:1px solid #1e293b;">
  <td style="color:#e2e8f0;font-size:13px;padding:10px 12px;">${s.userName}</td>
  <td style="color:#94a3b8;font-size:13px;text-align:center;">${s.hours.toFixed(1)}h</td>
  <td style="color:#94a3b8;font-size:13px;text-align:center;">${s.tasksCompleted}/${s.activeTasks}</td>
  <td style="color:#f1f5f9;font-size:14px;font-weight:600;text-align:center;">${s.score}</td>
  <td style="text-align:center;"><span style="background:${color};color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;">${s.grade}</span></td>
</tr>`;
}

function overdueRow(task) {
    return `<div style="background:#0f172a;border-radius:6px;padding:10px 14px;margin-bottom:6px;border-left:3px solid #ef4444;">
  <p style="margin:0;color:#f1f5f9;font-size:13px;font-weight:500;">${task.title}</p>
  <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">${task.assignedTo || "Sin asignar"} — venció hace ${task.daysOverdue} día${task.daysOverdue !== 1 ? "s" : ""}</p>
</div>`;
}

function recommendationRow(rec, index) {
    return `<div style="background:#0f172a;border-radius:6px;padding:10px 14px;margin-bottom:6px;">
  <p style="margin:0;color:#f1f5f9;font-size:13px;"><span style="color:#818cf8;font-weight:700;">${index + 1}.</span> ${rec.text || rec}</p>
</div>`;
}

function formatDateES(dateStr) {
    try {
        const d = new Date(dateStr + "T12:00:00");
        const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        return `${d.getDate()} de ${months[d.getMonth()]}, ${d.getFullYear()}`;
    } catch {
        return dateStr;
    }
}

const KPI_LABELS = {
    responseRate: "Response Rate",
    onTimeResponseRate: "On-Time Response",
    lateResponseRate: "Late Response",
    escalationRate: "Escalation Rate",
    incidentRate: "Incident Rate",
    reportCompletionRate: "Report Completion",
    routineSuccessRate: "Routine Success",
    aiAssistedRate: "AI-Assisted Rate",
    audioUsageRate: "Audio Usage",
    deliveryFailureRate: "Delivery Failure",
    activeParticipationRate: "Active Participation",
};

module.exports = { dailyPerformanceReport, KPI_LABELS };
