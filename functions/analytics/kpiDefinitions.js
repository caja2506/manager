/**
 * KPI Definitions — Backend (CJS)
 * ==================================
 * Formal registry of all operational KPIs.
 * Each definition includes name, description, formula,
 * data source, aggregation, and caveats.
 *
 * These are CODE-LEVEL definitions (not Firestore docs)
 * for versioning and type safety.
 */

const { KPI_NAME } = require("./analyticsConstants");

const KPI_DEFINITIONS = {
    [KPI_NAME.RESPONSE_RATE]: {
        name: "Response Rate",
        description: "Porcentaje de deliveries que recibieron respuesta del usuario.",
        formula: "responses_received / deliveries_sent",
        dataSource: ["telegramDeliveries"],
        periodicity: "daily",
        aggregationLevels: ["user", "role", "channel", "global"],
        polarity: "higher",
        unit: "percentage",
        caveats: "Solo cuenta deliveries de tipo outbound con expectativa de respuesta.",
    },

    [KPI_NAME.ON_TIME_RESPONSE_RATE]: {
        name: "On-Time Response Rate",
        description: "Porcentaje de respuestas recibidas dentro del período de gracia.",
        formula: "on_time_responses / total_responses",
        dataSource: ["telegramReports", "telegramDeliveries"],
        periodicity: "daily",
        aggregationLevels: ["user", "role", "global"],
        polarity: "higher",
        unit: "percentage",
        caveats: "Depende de que el gracePeriod esté configurado en cada rutina.",
    },

    [KPI_NAME.LATE_RESPONSE_RATE]: {
        name: "Late Response Rate",
        description: "Porcentaje de respuestas que llegaron fuera del período de gracia.",
        formula: "late_responses / total_responses",
        dataSource: ["telegramReports", "telegramDeliveries"],
        periodicity: "daily",
        aggregationLevels: ["user", "role", "global"],
        polarity: "lower",
        unit: "percentage",
        caveats: "Complemento de onTimeResponseRate. late + onTime ≈ 100%.",
    },

    [KPI_NAME.ESCALATION_RATE]: {
        name: "Escalation Rate",
        description: "Porcentaje de deliveries que resultaron en escalación.",
        formula: "escalations / deliveries_sent",
        dataSource: ["telegramEscalations", "telegramDeliveries"],
        periodicity: "daily",
        aggregationLevels: ["user", "role", "routine", "global"],
        polarity: "lower",
        unit: "percentage",
        caveats: "Una escalación alta puede indicar problemas de adopción o horarios inadecuados.",
    },

    [KPI_NAME.INCIDENT_RATE]: {
        name: "Incident Rate",
        description: "Incidentes reportados por cada usuario activo en el período.",
        formula: "incidents / active_users",
        dataSource: ["operationIncidents", "users"],
        periodicity: "daily",
        aggregationLevels: ["user", "role", "global"],
        polarity: "lower",
        unit: "ratio",
        caveats: "Más incidentes puede significar mejor detección, no necesariamente peor operación.",
    },

    [KPI_NAME.REPORT_COMPLETION_RATE]: {
        name: "Report Completion Rate",
        description: "Porcentaje de reportes esperados que fueron completados.",
        formula: "reports_submitted / reports_expected",
        dataSource: ["telegramReports", "automationRuns"],
        periodicity: "daily",
        aggregationLevels: ["user", "role", "global"],
        polarity: "higher",
        unit: "percentage",
        caveats: "'Esperados' se estima desde runs de rutinas de reporte activas.",
    },

    [KPI_NAME.ROUTINE_SUCCESS_RATE]: {
        name: "Routine Success Rate",
        description: "Porcentaje de ejecuciones de rutina que terminaron exitosamente.",
        formula: "successful_runs / total_runs",
        dataSource: ["automationRuns"],
        periodicity: "daily",
        aggregationLevels: ["routine", "channel", "global"],
        polarity: "higher",
        unit: "percentage",
        caveats: "Incluye dry-run como exitosos si completan sin error.",
    },

    [KPI_NAME.AI_ASSISTED_RATE]: {
        name: "AI-Assisted Processing Rate",
        description: "Porcentaje de reportes procesados con asistencia de IA.",
        formula: "ai_processed_reports / total_reports",
        dataSource: ["telegramReports", "aiExecutions"],
        periodicity: "daily",
        aggregationLevels: ["global"],
        polarity: "higher",
        unit: "percentage",
        caveats: "Incluye tanto extracción por texto como por audio. Fallbacks no cuentan.",
    },

    [KPI_NAME.CONFIRMATION_REQUEST_RATE]: {
        name: "Confirmation Request Rate",
        description: "Porcentaje de ejecuciones IA que requirieron confirmación del usuario.",
        formula: "confirm_actions / total_ai_executions",
        dataSource: ["aiExecutions"],
        periodicity: "daily",
        aggregationLevels: ["global"],
        polarity: "neutral",
        unit: "percentage",
        caveats: "Una tasa muy alta puede indicar prompts que necesitan ajuste.",
    },

    [KPI_NAME.AUDIO_USAGE_RATE]: {
        name: "Audio Usage Rate",
        description: "Porcentaje de reportes enviados como nota de voz.",
        formula: "audio_reports / total_reports",
        dataSource: ["telegramReports"],
        periodicity: "daily",
        aggregationLevels: ["user", "global"],
        polarity: "neutral",
        unit: "percentage",
        caveats: "Dato de adopción. No implica mejor o peor calidad.",
    },

    [KPI_NAME.DELIVERY_FAILURE_RATE]: {
        name: "Delivery Failure Rate",
        description: "Porcentaje de deliveries que fallaron en su envío.",
        formula: "failed_deliveries / total_deliveries",
        dataSource: ["telegramDeliveries"],
        periodicity: "daily",
        aggregationLevels: ["channel", "global"],
        polarity: "lower",
        unit: "percentage",
        caveats: "Fallas pueden ser de red, token, o chatId inválido.",
    },

    [KPI_NAME.ACTIVE_PARTICIPATION_RATE]: {
        name: "Active Participation Rate",
        description: "Porcentaje de usuarios participantes que tuvieron actividad en el período.",
        formula: "users_with_activity / total_participants",
        dataSource: ["telegramDeliveries", "telegramReports", "users"],
        periodicity: "daily",
        aggregationLevels: ["role", "global"],
        polarity: "higher",
        unit: "percentage",
        caveats: "Actividad = al menos un delivery o report en el período.",
    },
};

/**
 * Get all KPI definitions as an array.
 */
function getAllKpiDefinitions() {
    return Object.entries(KPI_DEFINITIONS).map(([key, def]) => ({
        key,
        ...def,
    }));
}

/**
 * Get a specific KPI definition by key.
 */
function getKpiDefinition(kpiKey) {
    return KPI_DEFINITIONS[kpiKey] || null;
}

module.exports = { KPI_DEFINITIONS, getAllKpiDefinitions, getKpiDefinition };
