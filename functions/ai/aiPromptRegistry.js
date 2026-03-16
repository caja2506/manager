/**
 * AI Prompt Registry — Backend (CJS)
 * =====================================
 * Centralized, versioned prompt templates for all AI use cases.
 * Each prompt defines: version, systemInstruction, userPrompt builder,
 * and expected output schema description.
 *
 * Variables in prompts use {{variable}} syntax.
 */

// ── Helper ──
function fillTemplate(template, vars = {}) {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value ?? ""));
    }
    return result;
}

// ============================================================
// REPORT EXTRACTION
// ============================================================

const REPORT_EXTRACTION = {
    version: "1.0",
    featureType: "report_extraction",
    systemInstruction: `Eres un asistente de operaciones industriales. Tu trabajo es extraer datos estructurados de reportes diarios de técnicos e ingenieros. Los reportes pueden ser informales, en español, y a veces incompletos.

Reglas:
- Extrae los datos que encuentres. No inventes datos que no estén en el texto.
- Si un campo no se menciona, usa null.
- El porcentaje de avance debe ser un número entre 0 y 100.
- Las horas trabajadas deben ser un número decimal positivo.
- Detecta si hay bloqueos o problemas reportados.
- Evalúa tu confianza en la extracción de 0.0 a 1.0.
- Si faltan campos críticos (avance u horas), indica needsConfirmation: true.
- Siempre responde en JSON válido, sin texto adicional.`,

    buildUserPrompt: (rawText) => `Analiza el siguiente reporte diario y extrae los datos estructurados.

REPORTE:
"""
${rawText}
"""

Responde ÚNICAMENTE con un JSON con esta estructura exacta:
{
  "progressPercent": number | null,
  "hoursWorked": number | null,
  "blockerPresent": boolean,
  "blockerSummary": string | null,
  "taskReference": string | null,
  "normalizedSummary": string,
  "confidenceScore": number,
  "needsConfirmation": boolean,
  "missingFields": string[]
}`,
};

// ============================================================
// AUDIO TRANSCRIPTION + EXTRACTION (Multimodal)
// ============================================================

const AUDIO_REPORT_EXTRACTION = {
    version: "1.0",
    featureType: "audio_report_extraction",
    systemInstruction: `Eres un asistente de operaciones industriales. Recibes una nota de voz de un técnico o ingeniero reportando su avance diario. Debes:
1. Transcribir el contenido del audio.
2. Extraer los datos operativos estructurados.

Reglas:
- Transcribe literalmente lo que dice la persona.
- Extrae los datos igual que en un reporte de texto.
- Si el audio es poco claro, indica baja confianza.
- Siempre responde en JSON válido, sin texto adicional.`,

    buildUserPrompt: () => `Transcribe este audio y extrae los datos del reporte diario.

Responde ÚNICAMENTE con un JSON con esta estructura exacta:
{
  "transcript": string,
  "progressPercent": number | null,
  "hoursWorked": number | null,
  "blockerPresent": boolean,
  "blockerSummary": string | null,
  "taskReference": string | null,
  "normalizedSummary": string,
  "confidenceScore": number,
  "needsConfirmation": boolean,
  "missingFields": string[]
}`,
};

// ============================================================
// BRIEFING GENERATION (per role)
// ============================================================

const BRIEFING_SYSTEM = `Eres un asistente de operaciones que genera briefings claros, concisos y accionables en español. Los briefings se envían por Telegram así que usa formato HTML simple (solo <b>, <i>, \\n).

Reglas:
- Sé conciso pero completo.
- Usa bullet points con emojis para facilitar lectura.
- No uses markdown, solo HTML simple de Telegram.
- Prioriza información accionable sobre información genérica.
- Si no hay datos relevantes para una sección, omítela.`;

const BRIEFING_TECHNICIAN = {
    version: "1.0",
    featureType: "briefing_technician",
    systemInstruction: BRIEFING_SYSTEM,
    buildUserPrompt: (data) => `Genera un briefing matutino para un TÉCNICO llamado ${data.userName}.

DATOS OPERATIVOS:
- Tareas asignadas: ${JSON.stringify(data.userTasks || [])}
- Tareas vencidas: ${JSON.stringify(data.overdueTasks || [])}
- Tareas bloqueadas: ${JSON.stringify(data.blockedTasks || [])}
- Último reporte: ${data.lastReport || "Sin reporte previo"}

El briefing debe enfocarse en:
- Prioridades inmediatas del día
- Tareas vencidas que requieren atención
- Bloqueos pendientes
- Recordatorio de reporte al final del día

Máximo 600 caracteres. Formato HTML para Telegram.`,
};

const BRIEFING_ENGINEER = {
    version: "1.0",
    featureType: "briefing_engineer",
    systemInstruction: BRIEFING_SYSTEM,
    buildUserPrompt: (data) => `Genera un briefing matutino para un INGENIERO llamado ${data.userName}.

DATOS OPERATIVOS:
- Total tareas activas: ${data.totalTasks}
- Tareas del equipo: ${JSON.stringify((data.teamTasks || []).slice(0, 20))}
- Tareas bloqueadas: ${JSON.stringify(data.blockedTasks || [])}
- Tareas vencidas: ${data.overdueCount}
- Incidentes abiertos: ${data.openIncidents || 0}
- Reportes pendientes: ${data.pendingReports || 0}

El briefing debe enfocarse en:
- Carga actual y utilización
- Riesgos activos (vencimientos, bloqueos)
- Incumplimientos o reportes faltantes
- Acciones sugeridas

Máximo 800 caracteres. Formato HTML para Telegram.`,
};

const BRIEFING_TEAMLEAD = {
    version: "1.0",
    featureType: "briefing_teamlead",
    systemInstruction: BRIEFING_SYSTEM,
    buildUserPrompt: (data) => `Genera un briefing matutino para un TEAM LEAD llamado ${data.userName}.

DATOS OPERATIVOS:
- Miembros del equipo: ${data.teamSize}
- Total tareas activas: ${data.totalTasks}
- Tareas bloqueadas: ${data.blockedCount}
- Tareas vencidas: ${data.overdueCount}
- Incidentes abiertos: ${data.openIncidents || 0}
- Reportes recibidos ayer: ${data.reportsReceived || 0} de ${data.teamSize}
- Escalaciones activas: ${data.activeEscalations || 0}

El briefing debe ser una síntesis táctica del equipo:
- Estado general del equipo
- Alertas de productividad
- Miembros con problemas
- Decisiones pendientes

Máximo 900 caracteres. Formato HTML para Telegram.`,
};

const BRIEFING_MANAGER = {
    version: "1.0",
    featureType: "briefing_manager",
    systemInstruction: BRIEFING_SYSTEM,
    buildUserPrompt: (data) => `Genera un digest ejecutivo para un MANAGER llamado ${data.userName}.

DATOS OPERATIVOS:
- Equipos: ${data.teamSize} personas
- Proyectos activos: ${data.activeProjects}
- Total tareas: ${data.totalTasks}
- Bloqueadas: ${data.blockedCount}
- Vencidas: ${data.overdueCount}
- Incidentes abiertos: ${data.openIncidents || 0}
- Escalaciones: ${data.activeEscalations || 0}
- Cumplimiento de reportes: ${data.reportCompliance || "N/A"}%

Genera un digest ejecutivo técnico conciso:
- Salud operativa general
- KPIs clave
- Riesgos prioritarios
- Acciones ejecutivas recomendadas

Máximo 700 caracteres. Formato HTML para Telegram.`,
};

// ============================================================
// INCIDENT CLASSIFICATION
// ============================================================

const INCIDENT_CLASSIFICATION = {
    version: "1.0",
    featureType: "incident_classification",
    systemInstruction: `Eres un asistente de operaciones que clasifica reportes de bloqueos. Debes determinar si el texto describe un bloqueo real, su severidad, y su causa probable.

Reglas:
- No inventes bloqueos que no existan en el texto.
- Si el texto es ambiguo, indica baja confianza.
- La severidad puede ser: low, medium, high, critical.
- Siempre responde en JSON válido.`,

    buildUserPrompt: (text) => `Analiza el siguiente texto y clasifica si contiene un reporte de bloqueo operativo.

TEXTO:
"""
${text}
"""

Responde ÚNICAMENTE con un JSON:
{
  "isBlocker": boolean,
  "summary": string,
  "suggestedCause": string | null,
  "suggestedSeverity": "low" | "medium" | "high" | "critical",
  "suggestedResponsible": string | null,
  "confidenceScore": number,
  "needsConfirmation": boolean
}`,
};

// ============================================================
// CONFIRMATION MESSAGE
// ============================================================

const CONFIRMATION_MESSAGE = {
    version: "1.0",
    featureType: "confirmation_message",
    buildMessage: (extracted) => {
        const parts = [];
        parts.push("📋 <b>Entendí lo siguiente de tu reporte:</b>\n");
        if (extracted.progressPercent != null) {
            parts.push(`▪️ Avance: <b>${extracted.progressPercent}%</b>`);
        }
        if (extracted.hoursWorked != null) {
            parts.push(`▪️ Horas: <b>${extracted.hoursWorked}h</b>`);
        }
        if (extracted.blockerPresent) {
            parts.push(`▪️ Bloqueo: ${extracted.blockerSummary || "Detectado"}`);
        }
        if (extracted.normalizedSummary) {
            parts.push(`\n📝 <i>${extracted.normalizedSummary}</i>`);
        }
        parts.push("\n¿Es correcto? Responde <b>Sí</b> o <b>No</b>.");
        return parts.join("\n");
    },
};

// ============================================================
// REGISTRY
// ============================================================

const PROMPT_REGISTRY = {
    report_extraction: REPORT_EXTRACTION,
    audio_report_extraction: AUDIO_REPORT_EXTRACTION,
    briefing_technician: BRIEFING_TECHNICIAN,
    briefing_engineer: BRIEFING_ENGINEER,
    briefing_teamlead: BRIEFING_TEAMLEAD,
    briefing_manager: BRIEFING_MANAGER,
    incident_classification: INCIDENT_CLASSIFICATION,
    confirmation_message: CONFIRMATION_MESSAGE,
};

function getPrompt(key) {
    return PROMPT_REGISTRY[key] || null;
}

function listPrompts() {
    return Object.entries(PROMPT_REGISTRY).map(([key, p]) => ({
        key,
        version: p.version,
        featureType: p.featureType,
    }));
}

module.exports = {
    PROMPT_REGISTRY,
    getPrompt,
    listPrompts,
    fillTemplate,
    // Direct exports for convenience
    REPORT_EXTRACTION,
    AUDIO_REPORT_EXTRACTION,
    BRIEFING_TECHNICIAN,
    BRIEFING_ENGINEER,
    BRIEFING_TEAMLEAD,
    BRIEFING_MANAGER,
    INCIDENT_CLASSIFICATION,
    CONFIRMATION_MESSAGE,
};
