/**
 * Insight Generator
 * =================
 * 
 * Generates prompt templates and parses Gemini responses for
 * Management Intelligence insights.
 */

// ============================================================
// PROMPT TEMPLATES
// ============================================================

/**
 * Generate a prompt for analyzing audit findings.
 */
export function buildAuditAnalysisPrompt(auditResult, snapshot) {
    const findingsSummary = auditResult.findings
        .slice(0, 30)  // Limit to top 30 for token management
        .map(f => `- [${f.severity.toUpperCase()}] ${f.title}: ${f.message}`)
        .join('\n');

    const scoresText = auditResult.scores
        ? `Scores de cumplimiento:
  - Metodología: ${auditResult.scores.methodologyCompliance}%
  - Planificación: ${auditResult.scores.planningReliability}%
  - Estimación: ${auditResult.scores.estimationAccuracy}%
  - Disciplina: ${auditResult.scores.dataDiscipline}%
  - Salud de Proyectos: ${auditResult.scores.projectHealth}%`
        : 'Scores no disponibles';

    const dataContext = snapshot
        ? `Contexto:
  - Tareas activas: ${snapshot.metrics?.activeTasks || 'N/A'}
  - Tareas bloqueadas: ${snapshot.metrics?.blockedTasks || 'N/A'}
  - Proyectos activos: ${snapshot.metrics?.activeProjects || 'N/A'}
  - Delays activos: ${snapshot.metrics?.activeDelays || 'N/A'}
  - Velocidad semanal: ${snapshot.metrics?.weeklyVelocity || 'N/A'} tareas/semana`
        : '';

    return `Eres un consultor de gestión de ingeniería de automatización industrial.
Analiza los siguientes hallazgos de auditoría de un departamento de ingeniería y proporciona insights accionables.

${scoresText}

${dataContext}

Hallazgos detectados (${auditResult.summary.totalFindings} total, mostrando los más relevantes):
${findingsSummary}

Proporciona tu análisis en formato JSON con esta estructura exacta:
{
  "overallAssessment": "Evaluación general en 2-3 oraciones",
  "topRisks": [
    { "risk": "Descripción del riesgo", "impact": "alto|medio|bajo", "recommendation": "Acción recomendada" }
  ],
  "quickWins": [
    { "action": "Acción concreta para mejorar rápido", "expectedImpact": "Impacto esperado" }
  ],
  "weeklyFocus": "Área principal de enfoque para esta semana",
  "teamRecommendations": "Recomendaciones para el equipo"
}

Responde ÚNICAMENTE con el JSON, sin markdown ni comentarios adicionales.`;
}

/**
 * Generate a prompt for team performance analysis.
 */
export function buildTeamAnalysisPrompt(teamUtilization) {
    if (!teamUtilization?.members?.length) return null;

    const membersText = teamUtilization.members
        .map(m => `- ${m.displayName} (${m.teamRole}): ${m.activeTasks} tareas, ${m.weeklyHours}h logueadas, ${m.utilizationPercent}% utilización, ${m.blockedTasks} bloqueadas`)
        .join('\n');

    return `Eres un líder técnico de ingeniería de automatización industrial.
Analiza la utilización del equipo y sugiere mejoras en la distribución de carga.

Equipo (${teamUtilization.teamSize} miembros):
${membersText}

Promedio de utilización: ${teamUtilization.avgUtilization}%
Sobrecargados: ${teamUtilization.byLevel?.overloaded || 0}
Subutilizados: ${(teamUtilization.byLevel?.idle || 0) + (teamUtilization.byLevel?.underloaded || 0)}

Proporciona tu análisis en formato JSON:
{
  "teamHealthSummary": "Resumen en 2 oraciones",
  "balancingActions": [
    { "from": "nombre", "to": "nombre", "suggestion": "Qué reasignar" }
  ],
  "capacityAlerts": ["Alerta 1", "Alerta 2"],
  "recommendation": "Recomendación principal"
}

Responde ÚNICAMENTE con el JSON.`;
}

/**
 * Generate a weekly management brief prompt.
 */
export function buildWeeklyBriefPrompt(snapshot, auditResult, previousSnapshot) {
    const metrics = snapshot?.metrics || {};
    const scores = auditResult?.scores || {};

    const trendsText = previousSnapshot?.metrics
        ? `Comparado con la semana anterior:
  - Velocidad: ${metrics.weeklyVelocity || 0} (prev: ${previousSnapshot.metrics.weeklyVelocity || 0})
  - Bloqueadas: ${metrics.blockedTasks || 0} (prev: ${previousSnapshot.metrics.blockedTasks || 0})
  - Delays: ${metrics.activeDelays || 0} (prev: ${previousSnapshot.metrics.activeDelays || 0})`
        : 'No hay datos de la semana anterior para comparar.';

    return `Eres un gerente de ingeniería de automatización industrial.
Genera un brief ejecutivo semanal para el departamento.

Métricas actuales:
- Tareas activas: ${metrics.activeTasks || 0}
- Completadas esta semana: ${metrics.weeklyVelocity || 0}
- Bloqueadas: ${metrics.blockedTasks || 0}
- Proyectos activos: ${metrics.activeProjects || 0}
- Horas logueadas: ${metrics.weeklyHoursLogged || 0}
- Horas extra: ${metrics.weeklyOvertime || 0}
- Delays activos: ${metrics.activeDelays || 0}

Scores de cumplimiento:
- Metodología: ${scores.methodologyCompliance || 'N/A'}%
- Planificación: ${scores.planningReliability || 'N/A'}%
- Estimación: ${scores.estimationAccuracy || 'N/A'}%

${trendsText}

Hallazgos de auditoría: ${auditResult?.summary?.totalFindings || 0} (${auditResult?.summary?.bySeverity?.critical || 0} críticos, ${auditResult?.summary?.bySeverity?.warning || 0} advertencias)

Proporciona el brief en formato JSON:
{
  "executiveSummary": "Resumen ejecutivo en 3-4 oraciones",
  "highlights": ["Logro 1", "Logro 2"],
  "concerns": ["Preocupación 1", "Preocupación 2"],
  "nextWeekPriorities": ["Prioridad 1", "Prioridad 2", "Prioridad 3"],
  "kpiStatus": "mejorando|estable|deteriorando",
  "overallSentiment": "positivo|neutral|negativo"
}

Responde ÚNICAMENTE con el JSON.`;
}

// ============================================================
// RESPONSE PARSER
// ============================================================

/**
 * Parse a Gemini response into structured data.
 * Handles cases where the model wraps JSON in markdown code blocks.
 */
export function parseGeminiResponse(responseText) {
    if (!responseText) return null;

    // If the response is already a JSON object, return it directly.
    if (typeof responseText === 'object') {
        console.log('[parseGeminiResponse] Response is already an object, returning directly.');
        return responseText;
    }

    console.log('[parseGeminiResponse] Attempting to parse string of length:', responseText.length);
    console.log('[parseGeminiResponse] First 200 chars:', responseText.substring(0, 200));

    // Remove trailing commas to fix invalid formatting commonly returned by Gemini 
    const sanitizeJson = (str) => {
        return str
            .replace(/,\s*([\]}])/g, '$1')  // trailing commas
            .replace(/[\x00-\x1F\x7F]/g, (ch) => ch === '\n' || ch === '\r' || ch === '\t' ? ch : '') // control chars
            .trim();
    };

    // Strategy 1: Direct parse
    try {
        const result = JSON.parse(sanitizeJson(responseText));
        console.log('[parseGeminiResponse] Strategy 1 (direct) succeeded.');
        return result;
    } catch (e) {
        console.warn('[parseGeminiResponse] Strategy 1 failed:', e.message);
    }

    // Strategy 2: Strip markdown code blocks
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
        try {
            const result = JSON.parse(sanitizeJson(jsonMatch[1]));
            console.log('[parseGeminiResponse] Strategy 2 (markdown strip) succeeded.');
            return result;
        } catch (e) {
            console.warn('[parseGeminiResponse] Strategy 2 failed:', e.message);
        }
    }

    // Strategy 3: Find JSON object in text
    const braceMatch = responseText.match(/\{[\s\S]*\}/);
    if (braceMatch) {
        try {
            const result = JSON.parse(sanitizeJson(braceMatch[0]));
            console.log('[parseGeminiResponse] Strategy 3 (brace match) succeeded.');
            return result;
        } catch (e) {
            console.warn('[parseGeminiResponse] Strategy 3 failed:', e.message);
        }
    }

    // Strategy 4: If responseText is a stringified-then-re-stringified JSON (double encoded)
    try {
        const unescaped = JSON.parse(`"${responseText.replace(/"/g, '\\"')}"`);
        if (typeof unescaped === 'string') {
            const result = JSON.parse(sanitizeJson(unescaped));
            console.log('[parseGeminiResponse] Strategy 4 (double-encoded) succeeded.');
            return result;
        }
    } catch {
        // Fall through
    }

    // Strategy 5: Truncated JSON recovery — close open strings/objects/arrays
    try {
        let truncated = responseText.trim();
        // If it looks like truncated JSON (starts with { but doesn't end with })
        if (truncated.startsWith('{') && !truncated.endsWith('}')) {
            console.warn('[parseGeminiResponse] Detected truncated JSON, attempting repair...');
            // Close any open string
            const quoteCount = (truncated.match(/(?<!\\)"/g) || []).length;
            if (quoteCount % 2 !== 0) {
                truncated += '"';
            }
            // Close open arrays and objects
            const openBraces = (truncated.match(/\{/g) || []).length;
            const closeBraces = (truncated.match(/\}/g) || []).length;
            const openBrackets = (truncated.match(/\[/g) || []).length;
            const closeBrackets = (truncated.match(/\]/g) || []).length;

            for (let i = 0; i < openBrackets - closeBrackets; i++) truncated += ']';
            for (let i = 0; i < openBraces - closeBraces; i++) truncated += '}';

            const result = JSON.parse(sanitizeJson(truncated));
            console.log('[parseGeminiResponse] Strategy 5 (truncated recovery) succeeded.');
            return result;
        }
    } catch (e) {
        console.warn('[parseGeminiResponse] Strategy 5 failed:', e.message);
    }

    console.error('[parseGeminiResponse] All strategies failed. Full response:', responseText.substring(0, 500));
    return null;
}
