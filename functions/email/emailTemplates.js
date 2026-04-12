/**
 * Email Templates - V3 "Light Theme"
 * ==========================================
 * Light-themed email that adapts naturally to dark mode.
 * Gmail/Outlook dark mode inverts light→dark automatically.
 *
 * @module email/emailTemplates
 */

function dailyPerformanceReport(data) {
    const {
        datePretty, yesterdayPulse, actionableAlerts,
        overdueTasks, scrumTable, yesterdayDatePretty,
    } = data;

    const yp = yesterdayPulse || {};

    return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
:root { color-scheme: light dark; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;" bgcolor="#f0f2f5">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:20px 0;" bgcolor="#f0f2f5" role="presentation">
<tr><td align="center">
<table width="800" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:100%;" bgcolor="#ffffff">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;">
  <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Passdown AME CR</h1>
  <p style="margin:8px 0 0;color:#ffffff;font-size:18px;font-weight:700;">${datePretty}</p>
  <p style="margin:4px 0 0;color:#c7d2fe;font-size:12px;">AnalyzeOps</p>
</td></tr>

<!-- SECTION 1: ¿CÓMO NOS FUE AYER? -->
<tr><td style="padding:28px 40px 20px;">
  <h2 style="margin:0 0 4px;color:#1a1a2e;font-size:18px;font-weight:700;">¿Cómo nos fue ayer?</h2>
  <p style="margin:0 0 16px;color:#4f46e5;font-size:16px;font-weight:800;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">${yesterdayDatePretty || ''}</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      ${pulseCard("Horas Registradas", (yp.hoursReal || 0) + "h", (yp.hoursPct || 0) >= 80 ? "#16a34a" : (yp.hoursPct || 0) >= 60 ? "#d97706" : "#dc2626", "de " + (yp.hoursExpected || 0) + "h esperadas (" + (yp.teamSize || 0) + " x " + (yp.dailyHours || 8) + "h) - " + (yp.hoursPct || 0) + "%")}
      ${pulseCard("Personas Activas", (yp.peopleWithHours || 0) + "/" + (yp.teamSize || 0), (yp.peopleWithHours || 0) >= (yp.teamSize || 1) ? "#16a34a" : "#d97706", "con horas registradas")}
      ${pulseCard("Subtareas Completadas", "+" + (yp.subtasksCompleted || 0), (yp.subtasksCompleted || 0) > 0 ? "#16a34a" : "#d97706", "ayer")}
    </tr>
  </table>
</td></tr>

<!-- SECTION 2: DAILY SCRUM TABLE -->
${(scrumTable || []).length > 0 ? `
<tr><td style="padding:8px 24px 20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr style="background-color:#f8fafc;" bgcolor="#f8fafc">
      <th style="padding:8px 10px;text-align:left;color:#6b7280;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e5e7eb;">Miembro</th>
      <th style="padding:8px 10px;text-align:left;color:#6b7280;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e5e7eb;">Estado</th>
      <th style="padding:8px 10px;text-align:center;color:#6b7280;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e5e7eb;">Ayer (h)</th>
      <th style="padding:8px 10px;text-align:left;color:#6b7280;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e5e7eb;">Tareas de Ayer</th>
      <th style="padding:8px 10px;text-align:center;color:#6b7280;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e5e7eb;">% Avance</th>
      <th style="padding:8px 10px;text-align:left;color:#6b7280;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e5e7eb;">Tareas Hoy</th>
    </tr>
    ${scrumTable.map(p => {
        const statusCfg = {
            ok: { label: 'OK', bg: '#dcfce7', border: '#16a34a', color: '#15803d' },
            bloqueado: { label: 'BLOQUEADO', bg: '#fee2e2', border: '#dc2626', color: '#b91c1c' },
            sin_tareas: { label: 'SIN TAREAS', bg: '#fef9c3', border: '#d97706', color: '#92400e' },
            sin_reporte: { label: 'SIN REPORTE', bg: '#fee2e2', border: '#dc2626', color: '#b91c1c' },
        }[p.status] || { label: '?', bg: '#f3f4f6', border: '#9ca3af', color: '#6b7280' };

        const yesterdayEntries = Object.entries(p.yesterdayByTask || {});
        const yesterdaySubsHtml = yesterdayEntries.length > 0
            ? yesterdayEntries.map(([, group]) => {
                const hrs = group.hours ? parseFloat(group.hours.toFixed(1)) : 0;
                let html = '<div style="border-left:2px solid #16a34a;padding-left:6px;margin-bottom:6px;">';
                html += '<p style="margin:0;color:#1a1a2e;font-size:11px;font-weight:700;">' + (group.taskTitle || '?');
                if (hrs > 0) {
                    html += ' <span style="color:#16a34a;font-size:9px;font-weight:600;">' + hrs + 'h</span>';
                }
                html += '</p>';
                if (group.projectName) {
                    html += '<p style="margin:1px 0 0;color:#6366f1;font-size:9px;font-weight:600;">📁 ' + group.projectName + '</p>';
                }
                if (group.subs && group.subs.length > 0) {
                    group.subs.forEach(s => {
                        html += '<p style="margin:1px 0 0 8px;color:#15803d;font-size:10px;">&#10003; ' + s + '</p>';
                    });
                } else if (hrs > 0) {
                    html += '<p style="margin:1px 0 0 8px;color:#6b7280;font-size:10px;">&#9201; ' + hrs + 'h registradas</p>';
                }
                html += '</div>';
                return html;
            }).join('')
            : '';

        // Yesterday comments
        const yesterdayCommEntries = Object.entries(p.yesterdayCommentsByTask || {});
        const yesterdayCommHtml = yesterdayCommEntries.length > 0
            ? yesterdayCommEntries.map(([, cmts]) => {
                return cmts.map(c => '<p style="margin:1px 0;color:#4f46e5;font-size:10px;">&#128172; <strong>' + c.userName + ':</strong> ' + c.text + '</p>').join('');
            }).join('')
            : '';

        const yesterdayHtml = (yesterdaySubsHtml || yesterdayCommHtml)
            ? yesterdaySubsHtml + yesterdayCommHtml
            : '<span style="color:#d1d5db;font-size:11px;">&mdash;</span>';

        let todayHtml = '';
        if (p.todayTasksData && p.todayTasksData.length > 0) {
            todayHtml = p.todayTasksData.map(t => {
                const hasBlocker = t.blockers && t.blockers.length > 0;
                const borderColor = hasBlocker ? '#dc2626' : '#4f46e5';
                let html = '<div style="border-left:2px solid ' + borderColor + ';padding-left:6px;margin-bottom:6px;">';
                html += '<p style="margin:0;color:#1a1a2e;font-size:11px;font-weight:700;">' + t.title + ' <span style="color:' + (t.pct >= 60 ? '#16a34a' : t.pct > 0 ? '#4f46e5' : '#9ca3af') + ';font-size:10px;">' + t.pct + '%</span></p>';
                if (t.projectName) {
                    html += '<p style="margin:1px 0 0;color:#6366f1;font-size:9px;font-weight:600;">📁 ' + t.projectName + '</p>';
                }
                if (hasBlocker) {
                    t.blockers.forEach(b => {
                        html += '<p style="margin:1px 0 0 8px;color:#dc2626;font-size:10px;">&#9940; ' + b + '</p>';
                    });
                }
                if (t.pendingSubs && t.pendingSubs.length > 0) {
                    t.pendingSubs.forEach(s => {
                        html += '<p style="margin:1px 0 0 8px;color:#6b7280;font-size:10px;">&#9675; ' + s + '</p>';
                    });
                }
                html += '</div>';
                return html;
            }).join('');
        } else {
            todayHtml = '<span style="color:#d97706;font-size:11px;">&#128993; Sin tareas</span>';
        }

        const pctColor = p.avgPct >= 60 ? '#16a34a' : p.avgPct >= 30 ? '#d97706' : '#9ca3af';

        return '<tr style="border-bottom:1px solid #f3f4f6;">'
            + '<td style="padding:10px;vertical-align:top;white-space:nowrap;"><span style="color:#1a1a2e;font-size:12px;font-weight:700;">' + p.shortName + '</span></td>'
            + '<td style="padding:10px;vertical-align:top;white-space:nowrap;"><span style="background:' + statusCfg.bg + ';border:1px solid ' + statusCfg.border + ';color:' + statusCfg.color + ';font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;text-transform:uppercase;white-space:nowrap;">' + statusCfg.label + '</span></td>'
            + '<td style="padding:10px;text-align:center;vertical-align:top;white-space:nowrap;"><span style="color:' + (p.hours > 0 ? '#16a34a' : '#dc2626') + ';font-size:12px;font-weight:700;">' + (p.hours > 0 ? p.hours + 'h' : '&#9888; 0h') + '</span></td>'
            + '<td style="padding:10px;vertical-align:top;">' + yesterdayHtml + '</td>'
            + '<td style="padding:10px;text-align:center;vertical-align:top;white-space:nowrap;"><span style="color:' + pctColor + ';font-size:12px;font-weight:700;">' + p.avgPct + '%</span></td>'
            + '<td style="padding:10px;vertical-align:top;">' + todayHtml + '</td>'
            + '</tr>';
    }).join('')}
  </table>
</td></tr>
` : ""}

<!-- SECTION 3: ALERTAS -->
${actionableAlerts.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:700;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">¿Qué nos está frenando?</h2>
  ${actionableAlerts.slice(0, 8).map(a => alertCard(a)).join("")}
</td></tr>
` : ""}

<!-- SECTION 4: OVERDUE -->
${overdueTasks.length > 0 ? `
<tr><td style="padding:8px 40px 20px;">
  <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:700;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">¿Qué se nos pasó? (${overdueTasks.length})</h2>
  ${overdueTasks.slice(0, 8).map(t => `
    <div style="background-color:#fef2f2;border-radius:6px;padding:10px 14px;margin-bottom:6px;border-left:3px solid #dc2626;" bgcolor="#fef2f2">
      <p style="margin:0;color:#1a1a2e;font-size:13px;font-weight:500;">${t.title}</p>
      <p style="margin:4px 0 0;color:#6b7280;font-size:11px;">${t.assignedTo} - venció hace ${t.daysOverdue} día${t.daysOverdue !== 1 ? "s" : ""}</p>
    </div>
  `).join("")}
  ${overdueTasks.length > 8 ? `<p style="color:#9ca3af;font-size:12px;margin:8px 0;">... y ${overdueTasks.length - 8} más</p>` : ""}
</td></tr>
` : ""}

<!-- Footer -->
<tr><td style="padding:24px 40px;background-color:#f8fafc;border-top:1px solid #e5e7eb;" bgcolor="#f8fafc">
  <table width="100%"><tr>
    <td style="color:#9ca3af;font-size:12px;">
      Generado automáticamente por <strong style="color:#4f46e5;">AnalyzeOps</strong>
    </td>
    <td align="right">
      <a href="https://analyzeops.com" style="color:#4f46e5;font-size:12px;text-decoration:none;">Ver Dashboard</a>
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

function pulseCard(label, value, color, subtitle) {
    return `<td width="33%" style="padding:6px;vertical-align:top;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;border-left:4px solid ${color};height:100%;" bgcolor="#f8fafc">
    <tr><td style="padding:14px 16px;vertical-align:top;">
      <p style="margin:0;color:${color};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${label}</p>
      <p style="margin:6px 0 0;color:#1a1a2e;font-size:26px;font-weight:800;line-height:1;">${value}</p>
      ${subtitle ? `<p style="margin:4px 0 0;color:#6b7280;font-size:11px;">${subtitle}</p>` : ""}
    </td></tr>
  </table>
</td>`;
}

function alertCard(a) {
    var colors = { critical: "#dc2626", high: "#ea580c", medium: "#d97706" };
    var color = colors[a.severity] || "#9ca3af";
    var bgColors = { critical: "#fef2f2", high: "#fff7ed", medium: "#fffbeb" };
    var bgColor = bgColors[a.severity] || "#f9fafb";
    var html = '<div style="background-color:' + bgColor + ';border-radius:8px;padding:12px 16px;margin-bottom:8px;border-left:3px solid ' + color + ';" bgcolor="' + bgColor + '">';
    html += '<p style="margin:0;color:#1a1a2e;font-size:13px;font-weight:600;">' + (a.icon || '') + ' ' + a.text + '</p>';
    if (a.projectName) {
        html += '<p style="margin:2px 0 0;color:#6366f1;font-size:10px;font-weight:600;">📁 ' + a.projectName + '</p>';
    }
    if (a.detail) {
        html += '<p style="margin:4px 0 0;color:#6b7280;font-size:11px;">' + a.detail + '</p>';
    }
    // Subtasks
    if (a.subtasks && a.subtasks.total > 0) {
        html += '<p style="margin:6px 0 2px;color:#6b7280;font-size:10px;font-weight:600;">Subtareas: ' + a.subtasks.completed + '/' + a.subtasks.total + ' completadas</p>';
        if (a.subtasks.completedList && a.subtasks.completedList.length > 0) {
            a.subtasks.completedList.forEach(function(s) {
                html += '<p style="margin:1px 0 0 8px;color:#15803d;font-size:10px;">&#10003; ' + s + '</p>';
            });
        }
        if (a.subtasks.pendingList && a.subtasks.pendingList.length > 0) {
            a.subtasks.pendingList.forEach(function(s) {
                html += '<p style="margin:1px 0 0 8px;color:#9ca3af;font-size:10px;">&#9675; ' + s + '</p>';
            });
        }
    }
    if (a.action) {
        html += '<p style="margin:4px 0 0;color:#4f46e5;font-size:11px;font-weight:600;">--> ' + a.action + '</p>';
    }
    html += '</div>';
    return html;
}

module.exports = { dailyPerformanceReport };
