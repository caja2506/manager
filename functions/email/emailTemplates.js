/**
 * Email Templates - V2 "Manager Briefing"
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
<table width="800" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.3);max-width:100%;">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;">
  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Briefing del Equipo</h1>
  <p style="margin:8px 0 0;color:#c7d2fe;font-size:14px;">${datePretty} - AnalyzeOps</p>
</td></tr>

<!-- SECTION 1: PULSO DEL DIA -->
<tr><td style="padding:28px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;font-weight:700;border-bottom:2px solid #334155;padding-bottom:8px;">Pulso del Dia</h2>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      ${pulseCard("", "Horas Reales", pulseOfDay.hoursReal + "h", pulseOfDay.hoursPct >= 80 ? "#22c55e" : pulseOfDay.hoursPct >= 60 ? "#f59e0b" : "#ef4444", "de " + pulseOfDay.hoursExpected + "h (" + pulseOfDay.hoursPct + "%)")}
      ${pulseCard("", "Planificadas", pulseOfDay.hoursPlanned + "h", "#3b82f6", "en el planner")}
      ${pulseCard("", "Completadas", pulseOfDay.tasksCompletedToday, "#22c55e", "de " + pulseOfDay.activeTasks + " activas")}
    </tr>
    <tr>
      ${pulseCard("", "Subtareas Hoy", "+" + (pulseOfDay.subtasksCompletedToday || 0), (pulseOfDay.subtasksCompletedToday || 0) > 0 ? "#22c55e" : "#f59e0b", pulseOfDay.subtasksCompleted + "/" + pulseOfDay.subtasksTotal + " total (" + pulseOfDay.subtasksPct + "%)")}
      ${pulseCard("", "Bloqueadas", pulseOfDay.blockedTasks, pulseOfDay.blockedTasks > 0 ? "#ef4444" : "#22c55e", "")}
      ${pulseCard("", "Vencidas", pulseOfDay.newOverdue, pulseOfDay.newOverdue > 0 ? "#ef4444" : "#22c55e", overdueTasks.length + " total")}
    </tr>
  </table>
</td></tr>

<!-- SECTION 2: EQUIPO (Narrativa) -->
${teamNarratives.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;font-weight:700;border-bottom:2px solid #334155;padding-bottom:8px;">Quien Hizo Que?</h2>
  ${teamNarratives.map(n => narrativeCard(n)).join("")}
</td></tr>
` : ""}

<!-- SECTION 3: PRODUCTIVIDAD -->
${productivityAlerts.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#fca5a5;font-size:18px;font-weight:700;border-bottom:2px solid #7f1d1d;padding-bottom:8px;">Alertas de Productividad</h2>
  <p style="color:#94a3b8;font-size:11px;margin:0 0 12px;font-style:italic;">Personas con muchas horas registradas pero sin resultados medibles</p>
  ${productivityAlerts.map(a => productivityCard(a)).join("")}
</td></tr>
` : ""}

<!-- SECTION 4: ALERTAS ACCIONABLES -->
${actionableAlerts.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;font-weight:700;border-bottom:2px solid #334155;padding-bottom:8px;">Alertas Accionables</h2>
  ${actionableAlerts.slice(0, 8).map(a => alertCard(a)).join("")}
</td></tr>
` : ""}

<!-- SECTION 5: LOGROS -->
${achievements.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;font-weight:700;border-bottom:2px solid #334155;padding-bottom:8px;">Logros del Dia</h2>
  ${achievements.map(a => `
    <div style="background:#064e3b;border-radius:8px;padding:10px 14px;margin-bottom:6px;border-left:3px solid #22c55e;">
      <p style="margin:0;color:#d1fae5;font-size:13px;"><strong>${a.title}</strong></p>
      <p style="margin:4px 0 0;color:#6ee7b7;font-size:11px;">Completada por ${a.completedBy}</p>
    </div>
  `).join("")}
</td></tr>
` : ""}

<!-- SECTION 6: VISTA DEL MANANA -->
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;font-weight:700;border-bottom:2px solid #334155;padding-bottom:8px;">Vista del Manana</h2>
  <div style="background:#0f172a;border-radius:8px;padding:16px;border-left:3px solid #818cf8;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:4px 0;color:#c7d2fe;font-size:13px;">Personas planificadas</td>
        <td align="right" style="color:#f1f5f9;font-size:14px;font-weight:700;">${tomorrowView.plannedUsers}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#c7d2fe;font-size:13px;">Horas programadas</td>
        <td align="right" style="color:#f1f5f9;font-size:14px;font-weight:700;">${tomorrowView.totalHours}h</td>
      </tr>
      ${tomorrowView.unassignedTasks > 0 ? `
      <tr>
        <td style="padding:4px 0;color:#fbbf24;font-size:13px;">Tareas sin asignar</td>
        <td align="right" style="color:#fbbf24;font-size:14px;font-weight:700;">${tomorrowView.unassignedTasks}</td>
      </tr>
      ` : ""}
    </table>
    ${tomorrowView.tasksDueTomorrow.length > 0 ? `
      <div style="margin-top:12px;border-top:1px solid #334155;padding-top:10px;">
        <p style="margin:0 0 6px;color:#fca5a5;font-size:12px;font-weight:600;">Tareas que vencen manana:</p>
        ${tomorrowView.tasksDueTomorrow.slice(0, 5).map(t => `
          <p style="margin:2px 0;color:#e2e8f0;font-size:12px;">- ${t.title} <span style="color:#94a3b8;">(${t.assignedTo})</span></p>
        `).join("")}
      </div>
    ` : ""}
  </div>
</td></tr>

<!-- OVERDUE -->
${overdueTasks.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#e2e8f0;font-size:18px;font-weight:700;border-bottom:2px solid #334155;padding-bottom:8px;">Tareas Vencidas (${overdueTasks.length})</h2>
  ${overdueTasks.slice(0, 8).map(t => `
    <div style="background:#0f172a;border-radius:6px;padding:10px 14px;margin-bottom:6px;border-left:3px solid #ef4444;">
      <p style="margin:0;color:#f1f5f9;font-size:13px;font-weight:500;">${t.title}</p>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">${t.assignedTo} - vencio hace ${t.daysOverdue} dia${t.daysOverdue !== 1 ? "s" : ""}</p>
    </div>
  `).join("")}
  ${overdueTasks.length > 8 ? `<p style="color:#64748b;font-size:12px;margin:8px 0;">... y ${overdueTasks.length - 8} mas</p>` : ""}
</td></tr>
` : ""}

<!-- Footer -->
<tr><td style="padding:24px 40px;background:#0f172a;border-top:1px solid #334155;">
  <table width="100%"><tr>
    <td style="color:#64748b;font-size:12px;">
      Generado automaticamente por <strong style="color:#818cf8;">AnalyzeOps</strong>
    </td>
    <td align="right">
      <a href="https://analyzeops.com" style="color:#818cf8;font-size:12px;text-decoration:none;">Ver Dashboard</a>
    </td>
  </tr></table>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

// ===================================
// Helper components
// ===================================

function pulseCard(icon, label, value, color, subtitle) {
    return `<td width="33%" style="padding:6px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:10px;border-left:4px solid ${color};">
    <tr><td style="padding:14px 16px;">
      <p style="margin:0;color:${color};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${label}</p>
      <p style="margin:6px 0 0;color:#ffffff;font-size:26px;font-weight:800;line-height:1;">${value}</p>
      ${subtitle ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">${subtitle}</p>` : ""}
    </td></tr>
  </table>
</td>`;
}

function narrativeCard(n) {
    const borderColor = getBorderColor(n.statusEmoji);
    const reportedBadge = n.reported
        ? '<span style="background:#22c55e;color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:6px;font-weight:700;">REPORTO</span>'
        : "";

    // Header: Name + role + active hours | Hours big on right
    let header = '<table width="100%" cellpadding="0" cellspacing="0"><tr>';
    header += '<td><p style="margin:0;color:#ffffff;font-size:15px;font-weight:800;">' + n.name + reportedBadge + '</p>';
    header += '<p style="margin:2px 0 0;color:#94a3b8;font-size:11px;">' + n.role + (n.activeHoursStr ? ' | Activo: ' + n.activeHoursStr : '') + '</p></td>';
    header += '<td align="right" style="vertical-align:top;">';
    header += '<p style="margin:0;color:#ffffff;font-size:22px;font-weight:800;line-height:1;">' + n.hours + 'h</p>';
    header += '<p style="margin:2px 0 0;color:#94a3b8;font-size:10px;">registradas</p></td>';
    header += '</tr></table>';

    // Subtask summary with percentage
    var subtasksPctVal = n.subtasksPct || 0;
    var subtaskColor = subtasksPctVal >= 80 ? '#22c55e' : subtasksPctVal >= 50 ? '#f59e0b' : '#ef4444';
    var subtaskSummary = n.subtasksTotal > 0
        ? '<p style="margin:6px 0 0;color:#c7d2fe;font-size:12px;">Sub: <strong style="color:#fff;">' + n.subtasksCompleted + '/' + n.subtasksTotal + '</strong> <span style="color:' + subtaskColor + ';font-weight:700;">(' + subtasksPctVal + '%)</span></p>'
        : "";

    // Tasks worked on - each with hours, score bar, subtask info
    var tasksHtml = "";
    if (n.workedOnTasks && n.workedOnTasks.length > 0) {
        var taskRows = "";
        n.workedOnTasks.slice(0, 5).forEach(function(t) {
            var sc = t.score || 50;
            var scoreColor = sc >= 80 ? "#22c55e" : sc >= 60 ? "#f59e0b" : "#ef4444";

            var subInfo = (t.subtasksTotal || 0) > 0 ? t.subtasksCompleted + "/" + t.subtasksTotal + " (" + t.subtasksPct + "%)" : "-";
            taskRows += '<tr>';
            taskRows += '<td style="padding:4px 0;color:#e2e8f0;font-size:12px;font-weight:500;">' + t.title + '</td>';
            taskRows += '<td align="center" style="padding:4px 8px;color:#ffffff;font-size:12px;font-weight:700;">' + t.hours + 'h</td>';
            taskRows += '<td align="center" style="padding:4px 4px;color:#94a3b8;font-size:10px;">' + subInfo + '</td>';
            taskRows += '<td align="center" style="padding:4px 4px;width:50px;">';
            taskRows += '<span style="color:' + scoreColor + ';font-size:12px;font-weight:800;">' + sc + '</span>';
            taskRows += '</td>';
            taskRows += '</tr>';
        });
        tasksHtml = '<div style="margin-top:8px;">';
        tasksHtml += '<p style="margin:0 0 4px;color:#64748b;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">TAREAS TRABAJADAS</p>';
        tasksHtml += '<table width="100%" cellpadding="0" cellspacing="0">';
        tasksHtml += '<tr><td style="padding:2px 0;color:#64748b;font-size:9px;">Tarea</td><td align="center" style="padding:2px 8px;color:#64748b;font-size:9px;">Horas</td><td align="center" style="padding:2px 4px;color:#64748b;font-size:9px;">Sub</td><td align="center" style="padding:2px 4px;color:#64748b;font-size:9px;">Score</td></tr>';
        tasksHtml += taskRows;
        tasksHtml += '</table></div>';
    } else {
        tasksHtml = '<p style="margin:8px 0 0;color:#f87171;font-size:12px;">Sin registro de trabajo</p>';
    }

    // Completed tasks
    var completedList = n.completedTasks.length > 0
        ? '<div style="margin-top:6px;padding:6px 8px;background:#064e3b;border-radius:6px;"><p style="margin:0;color:#86efac;font-size:11px;font-weight:600;">Tareas completadas: ' + n.completedTasks.join(", ") + '</p></div>'
        : "";

    // Plan vs Real bar
    var planBar = "";
    if (n.plannedHours > 0) {
        var planColor = n.planPct >= 80 ? "#22c55e" : n.planPct >= 60 ? "#f59e0b" : "#ef4444";
        var planWidth = Math.min(100, n.planPct);
        planBar = '<div style="margin-top:8px;">';
        planBar += '<table width="100%" cellpadding="0" cellspacing="0"><tr>';
        planBar += '<td style="color:#94a3b8;font-size:10px;white-space:nowrap;">Plan: ' + n.plannedHours + 'h</td>';
        planBar += '<td style="padding:0 8px;width:100%;"><div style="background:#1e293b;border-radius:4px;height:8px;overflow:hidden;"><div style="background:' + planColor + ';height:100%;width:' + planWidth + '%;border-radius:4px;"></div></div></td>';
        planBar += '<td style="color:' + planColor + ';font-size:11px;font-weight:700;white-space:nowrap;">' + n.planPct + '%</td>';
        planBar += '</tr></table></div>';
    }

    // Subtasks completed today - grouped by parent task
    var subtasksTodayHtml = "";
    if (n.subtasksCompletedTodayList && n.subtasksCompletedTodayList.length > 0) {
        var grouped = {};
        n.subtasksCompletedTodayList.forEach(function(st) {
            if (!grouped[st.parentTaskTitle]) grouped[st.parentTaskTitle] = [];
            grouped[st.parentTaskTitle].push(st.title);
        });
        var items = "";
        for (var parentTitle in grouped) {
            items += '<p style="margin:3px 0 0;color:#a5b4fc;font-size:11px;font-weight:600;">' + parentTitle + '</p>';
            grouped[parentTitle].forEach(function(sub) {
                items += '<p style="margin:1px 0 0 12px;color:#86efac;font-size:11px;">&#10003; ' + sub + '</p>';
            });
        }
        subtasksTodayHtml = '<div style="margin-top:8px;padding:8px 10px;background:#1e293b;border-radius:6px;border-left:2px solid #22c55e;">';
        subtasksTodayHtml += '<p style="margin:0;color:#22c55e;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">AVANCE HOY: +' + n.subtasksCompletedTodayList.length + ' subtareas</p>';
        subtasksTodayHtml += items + '</div>';
    }

    return '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;margin-bottom:10px;border-left:4px solid ' + borderColor + ';">'
        + header + subtaskSummary + tasksHtml + completedList + planBar + subtasksTodayHtml
        + '</div>';
}

function getBorderColor(emoji) {
    if (!emoji) return "#ef4444";
    if (emoji.indexOf("\uD83D\uDFE2") >= 0) return "#22c55e";
    if (emoji.indexOf("\uD83D\uDFE1") >= 0) return "#f59e0b";
    if (emoji.indexOf("\uD83D\uDFE0") >= 0) return "#f97316";
    return "#ef4444";
}

function productivityCard(a) {
    var borderColor = a.severity === "critical" ? "#dc2626" : "#f97316";
    var detailsHtml = a.details.map(function(d) { return '<p style="margin:3px 0 0 12px;color:#e2e8f0;font-size:12px;">' + d + '</p>'; }).join("");
    var workedOnHtml = a.workedOn ? '<p style="margin:4px 0 0 12px;color:#94a3b8;font-size:11px;">Trabajo en: ' + a.workedOn + '</p>' : "";
    return '<div style="background:#1c1917;border-radius:8px;padding:12px 16px;margin-bottom:8px;border-left:3px solid ' + borderColor + ';">'
        + '<p style="margin:0;color:#fca5a5;font-size:14px;font-weight:600;">' + a.name + ' <span style="color:#94a3b8;font-size:12px;font-weight:400;">(' + a.hours + 'h registradas)</span></p>'
        + detailsHtml + workedOnHtml
        + '<p style="margin:6px 0 0;color:#818cf8;font-size:11px;font-weight:600;">--> ' + a.action + '</p>'
        + '</div>';
}

function alertCard(a) {
    var colors = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b" };
    var color = colors[a.severity] || "#64748b";
    return '<div style="background:#0f172a;border-radius:8px;padding:12px 16px;margin-bottom:8px;border-left:3px solid ' + color + ';">'
        + '<p style="margin:0;color:#f1f5f9;font-size:13px;font-weight:600;">' + (a.icon || '') + ' ' + a.text + '</p>'
        + (a.detail ? '<p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">' + a.detail + '</p>' : '')
        + (a.action ? '<p style="margin:4px 0 0;color:#818cf8;font-size:11px;font-weight:600;">--> ' + a.action + '</p>' : '')
        + '</div>';
}

module.exports = { dailyPerformanceReport };
