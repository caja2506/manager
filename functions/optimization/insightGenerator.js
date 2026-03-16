/**
 * Insight Generator — Backend (CJS)
 * ====================================
 * AI-powered narrative generation using Gemini.
 * Generates explanations, summaries, and briefings.
 *
 * NOTE: The AI generates NARRATIVES, not metrics.
 * Metrics are always from the KPI engine.
 */

/**
 * Generate a narrative explanation for a KPI trend.
 * Can be called with or without Gemini — falls back to template.
 */
function explainTrend(kpiName, trendData) {
    if (!trendData || !trendData.hasHistory) {
        return `No hay historial suficiente para ${formatKpiName(kpiName)}.`;
    }

    const direction = trendData.direction === "up" ? "subió" : trendData.direction === "down" ? "bajó" : "se mantuvo estable";
    const delta = Math.abs(trendData.deltaPercent || 0);
    const improving = trendData.isImproving;

    return improving
        ? `📈 ${formatKpiName(kpiName)} ${direction} ${delta}% — tendencia positiva. Mantener las acciones actuales.`
        : `📉 ${formatKpiName(kpiName)} ${direction} ${delta}% — requiere atención. Revisar cambios recientes que puedan explicar el deterioro.`;
}

/**
 * Summarize optimization opportunities into an executive narrative.
 */
function summarizeOptimizations(opportunities) {
    if (!opportunities || opportunities.length === 0) {
        return "✅ No se detectaron oportunidades de optimización significativas. La operación funciona dentro de parámetros aceptables.";
    }

    const byType = {};
    for (const opp of opportunities) {
        byType[opp.type] = (byType[opp.type] || 0) + 1;
    }

    const lines = [`Se detectaron **${opportunities.length} oportunidades** de mejora:`];

    const typeLabels = {
        schedule: "📅 Ajuste de horarios",
        process: "🔧 Mejora de procesos",
        workload: "👤 Distribución de carga",
        format: "📝 Simplificación de formato",
        frequency: "🔄 Ajuste de frecuencia",
        elimination: "🗑️ Eliminación de rutinas",
        ai_tuning: "🤖 Optimización de IA",
        escalation: "🚨 Gestión de escalaciones",
    };

    for (const [type, count] of Object.entries(byType)) {
        const label = typeLabels[type] || type;
        lines.push(`- ${label}: ${count}`);
    }

    const topOpp = opportunities[0];
    if (topOpp) {
        lines.push("");
        lines.push(`**Prioridad máxima:** ${topOpp.problemDetected}`);
        lines.push(`→ ${topOpp.suggestedAction}`);
    }

    return lines.join("\n");
}

/**
 * Generate a role-specific daily briefing.
 */
function generateBriefing(planData, role) {
    const { criticalRoutines, riskWatchlist, userLoads, focusAreas } = planData;

    const lines = [`## Briefing Operativo — ${planData.date || "Hoy"}`];
    lines.push("");

    // Focus
    if (focusAreas && focusAreas.length > 0) {
        lines.push("### Enfoque del Día");
        for (const area of focusAreas) {
            lines.push(`- ${area}`);
        }
        lines.push("");
    }

    // Role-specific content
    if (role === "manager" || role === "admin") {
        // Manager sees everything
        if (riskWatchlist.length > 0) {
            lines.push("### Riesgos Activos");
            for (const risk of riskWatchlist) {
                lines.push(`- **${risk.severity.toUpperCase()}** — ${risk.kpi}: ${risk.justification}`);
            }
            lines.push("");
        }
        if (criticalRoutines.length > 0) {
            lines.push("### Rutinas Críticas");
            for (const r of criticalRoutines) {
                lines.push(`- ${r.routineName}: ${r.reason} (${(r.successRate * 100).toFixed(0)}% éxito)`);
            }
            lines.push("");
        }
    } else if (role === "team_lead") {
        // Team lead sees team load
        const highLoad = (userLoads || []).filter(u => u.loadLevel === "high");
        if (highLoad.length > 0) {
            lines.push("### Equipo con Carga Alta");
            for (const u of highLoad) {
                lines.push(`- ${u.userName}: respuesta ${((u.responseRate || 0) * 100).toFixed(0)}%, puntualidad ${((u.onTimeRate || 0) * 100).toFixed(0)}%`);
            }
            lines.push("");
        }
    } else {
        // Engineers/technicians see their own load
        lines.push("### Tu Enfoque");
        lines.push("- Completar reportes pendientes a tiempo");
        lines.push("- Responder a rutinas activas dentro de la ventana de gracia");
        lines.push("");
    }

    return lines.join("\n");
}

// ── Helper ──
function formatKpiName(name) {
    const labels = {
        responseRate: "Tasa de Respuesta",
        onTimeResponseRate: "Puntualidad",
        lateResponseRate: "Respuestas Tardías",
        escalationRate: "Escalaciones",
        incidentRate: "Incidentes",
        reportCompletionRate: "Completitud de Reportes",
        routineSuccessRate: "Éxito de Rutinas",
        aiAssistedRate: "Asistencia IA",
        deliveryFailureRate: "Fallas de Envío",
        activeParticipationRate: "Participación Activa",
    };
    return labels[name] || name;
}

module.exports = { explainTrend, summarizeOptimizations, generateBriefing };
