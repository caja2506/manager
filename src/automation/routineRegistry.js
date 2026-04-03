/**
 * Automation Routine Registry
 * ============================
 * 
 * Defines the default set of automation routines that are seeded
 * during bootstrap. Each routine is a well-known operation that
 * can be individually controlled from the Automation Control Center.
 * 
 * @module automation/routineRegistry
 */

import {
    AUTOMATION_CHANNELS,
    AUTOMATION_PROVIDERS,
    SCHEDULE_TYPE,
    OPERATIONAL_ROLES,
    PERSONALITY_MODES,
    ROUTINE_KEYS,
} from './constants.js';
import { createAutomationRoutineDocument } from './schemas.js';

/**
 * Default routine definitions.
 * Used by bootstrap to seed the automationRoutines collection.
 * Document ID = routine key.
 */
export const DEFAULT_ROUTINES = [
    createAutomationRoutineDocument({
        key: ROUTINE_KEYS.MORNING_DIGEST_ALL,
        name: 'Briefing Matutino General',
        description: 'Envía briefing personalizado por rol a todos los participantes activos cada mañana laboral.',
        channel: AUTOMATION_CHANNELS.TELEGRAM,
        provider: AUTOMATION_PROVIDERS.TELEGRAM_BOT,
        enabled: false,
        scheduleType: SCHEDULE_TYPE.DAILY,
        scheduleConfig: { cron: '0 7 * * 1-5', timezone: 'America/Mexico_City' },
        delayMinutes: 0,
        gracePeriodMinutes: 0,
        personalityMode: PERSONALITY_MODES.PROFESSIONAL,
        allowedRoles: [
            OPERATIONAL_ROLES.MANAGER,
            OPERATIONAL_ROLES.TEAM_LEAD,
            OPERATIONAL_ROLES.ENGINEER,
            OPERATIONAL_ROLES.TECHNICIAN,
        ],
        priority: 1,
    }),

    createAutomationRoutineDocument({
        key: ROUTINE_KEYS.TECHNICIAN_EVENING_CHECK,
        name: 'Reporte de Avance — Equipo',
        description: 'Solicita reporte de avance diario a técnicos, ingenieros y team leads activos por la tarde.',
        channel: AUTOMATION_CHANNELS.TELEGRAM,
        provider: AUTOMATION_PROVIDERS.TELEGRAM_BOT,
        enabled: false,
        scheduleType: SCHEDULE_TYPE.DAILY,
        scheduleConfig: { cron: '0 16 * * 1-5', timezone: 'America/Mexico_City' },
        delayMinutes: 0,
        gracePeriodMinutes: 30,
        personalityMode: PERSONALITY_MODES.FRIENDLY,
        allowedRoles: [
            OPERATIONAL_ROLES.TEAM_LEAD,
            OPERATIONAL_ROLES.ENGINEER,
            OPERATIONAL_ROLES.TECHNICIAN,
        ],
        priority: 2,
    }),

    createAutomationRoutineDocument({
        key: ROUTINE_KEYS.MISSING_REPORT_ESCALATION,
        name: 'Escalación — Reporte No Recibido',
        description: 'Escala automáticamente si un miembro del equipo no envía su reporte de avance dentro del período de gracia.',
        channel: AUTOMATION_CHANNELS.TELEGRAM,
        provider: AUTOMATION_PROVIDERS.TELEGRAM_BOT,
        enabled: false,
        scheduleType: SCHEDULE_TYPE.EVENT_DRIVEN,
        gracePeriodMinutes: 30,
        personalityMode: PERSONALITY_MODES.DIRECT,
        allowedRoles: [
            OPERATIONAL_ROLES.TEAM_LEAD,
            OPERATIONAL_ROLES.ENGINEER,
            OPERATIONAL_ROLES.TECHNICIAN,
        ],
        priority: 1,
    }),

    createAutomationRoutineDocument({
        key: ROUTINE_KEYS.BLOCK_INCIDENT_ALERT,
        name: 'Alerta de Bloqueo',
        description: 'Notifica al grupo de alertas y al ingeniero responsable cuando un usuario reporta un bloqueo.',
        channel: AUTOMATION_CHANNELS.TELEGRAM,
        provider: AUTOMATION_PROVIDERS.TELEGRAM_BOT,
        enabled: false,
        scheduleType: SCHEDULE_TYPE.EVENT_DRIVEN,
        gracePeriodMinutes: 0,
        personalityMode: PERSONALITY_MODES.DIRECT,
        allowedRoles: [
            OPERATIONAL_ROLES.ENGINEER,
            OPERATIONAL_ROLES.TECHNICIAN,
        ],
        priority: 1,
    }),

    createAutomationRoutineDocument({
        key: ROUTINE_KEYS.MANAGER_SUMMARY,
        name: 'Resumen Ejecutivo — Manager',
        description: 'Envía resumen ejecutivo diario al manager con estado general del equipo y proyectos.',
        channel: AUTOMATION_CHANNELS.TELEGRAM,
        provider: AUTOMATION_PROVIDERS.TELEGRAM_BOT,
        enabled: false,
        scheduleType: SCHEDULE_TYPE.DAILY,
        scheduleConfig: { cron: '0 17 * * 1-5', timezone: 'America/Mexico_City' },
        delayMinutes: 0,
        gracePeriodMinutes: 0,
        personalityMode: PERSONALITY_MODES.PROFESSIONAL,
        allowedRoles: [OPERATIONAL_ROLES.MANAGER],
        priority: 3,
    }),

    createAutomationRoutineDocument({
        key: ROUTINE_KEYS.ENGINEER_RISK_DIGEST,
        name: 'Digest de Riesgo — Ingenieros',
        description: 'Envía alertas de carga, riesgos y utilización a cada ingeniero.',
        channel: AUTOMATION_CHANNELS.TELEGRAM,
        provider: AUTOMATION_PROVIDERS.TELEGRAM_BOT,
        enabled: false,
        scheduleType: SCHEDULE_TYPE.DAILY,
        scheduleConfig: { cron: '30 7 * * 1-5', timezone: 'America/Mexico_City' },
        delayMinutes: 0,
        gracePeriodMinutes: 0,
        personalityMode: PERSONALITY_MODES.PROFESSIONAL,
        allowedRoles: [OPERATIONAL_ROLES.ENGINEER],
        priority: 2,
    }),

    createAutomationRoutineDocument({
        key: ROUTINE_KEYS.MANUAL_TEST_MESSAGE,
        name: 'Mensaje de Prueba Manual',
        description: 'Envía un mensaje de prueba a un usuario específico para verificar la conectividad de Telegram.',
        channel: AUTOMATION_CHANNELS.TELEGRAM,
        provider: AUTOMATION_PROVIDERS.TELEGRAM_BOT,
        enabled: true,
        scheduleType: SCHEDULE_TYPE.MANUAL,
        gracePeriodMinutes: 0,
        personalityMode: PERSONALITY_MODES.FRIENDLY,
        allowedRoles: [
            OPERATIONAL_ROLES.MANAGER,
            OPERATIONAL_ROLES.TEAM_LEAD,
            OPERATIONAL_ROLES.ENGINEER,
            OPERATIONAL_ROLES.TECHNICIAN,
        ],
        priority: 10,
    }),

    createAutomationRoutineDocument({
        key: ROUTINE_KEYS.CLOSE_DAY_REPORT,
        name: 'Cierre de Día — Detener Timers',
        description: 'Detiene todos los timers activos, genera reporte individual y resumen de equipo por Telegram. Horario controlado por settings/daySchedule.',
        channel: AUTOMATION_CHANNELS.TELEGRAM,
        provider: AUTOMATION_PROVIDERS.TELEGRAM_BOT,
        enabled: true,
        scheduleType: SCHEDULE_TYPE.DAILY,
        scheduleConfig: { cron: '0 18 * * 1-5', timezone: 'America/Costa_Rica' },
        delayMinutes: 0,
        gracePeriodMinutes: 0,
        personalityMode: PERSONALITY_MODES.PROFESSIONAL,
        allowedRoles: [
            OPERATIONAL_ROLES.MANAGER,
            OPERATIONAL_ROLES.TEAM_LEAD,
            OPERATIONAL_ROLES.ENGINEER,
            OPERATIONAL_ROLES.TECHNICIAN,
        ],
        priority: 1,
    }),

    createAutomationRoutineDocument({
        key: ROUTINE_KEYS.OPEN_DAY,
        name: 'Apertura de Día — Reactivar Timers',
        description: 'Reactiva timers de tareas en progreso que fueron auto-cerrados el día anterior. Horario controlado por settings/daySchedule.',
        channel: AUTOMATION_CHANNELS.TELEGRAM,
        provider: AUTOMATION_PROVIDERS.TELEGRAM_BOT,
        enabled: true,
        scheduleType: SCHEDULE_TYPE.DAILY,
        scheduleConfig: { cron: '0 8 * * 1-5', timezone: 'America/Costa_Rica' },
        delayMinutes: 0,
        gracePeriodMinutes: 0,
        personalityMode: PERSONALITY_MODES.PROFESSIONAL,
        allowedRoles: [
            OPERATIONAL_ROLES.MANAGER,
            OPERATIONAL_ROLES.TEAM_LEAD,
            OPERATIONAL_ROLES.ENGINEER,
            OPERATIONAL_ROLES.TECHNICIAN,
        ],
        priority: 1,
    }),

    createAutomationRoutineDocument({
        key: ROUTINE_KEYS.DAILY_PERFORMANCE_REPORT,
        name: 'Reporte de Rendimiento — Email + Telegram',
        description: 'Genera reporte completo del equipo con KPIs, riesgos, scorecards y recomendaciones. Envía por email (Resend/AnalyzeOps) y resumen por Telegram.',
        channel: AUTOMATION_CHANNELS.EMAIL,
        provider: 'resend',
        enabled: false,
        scheduleType: SCHEDULE_TYPE.DAILY,
        scheduleConfig: { cron: '15 18 * * 1-5', timezone: 'America/Mexico_City' },
        delayMinutes: 0,
        gracePeriodMinutes: 0,
        personalityMode: PERSONALITY_MODES.PROFESSIONAL,
        allowedRoles: [
            OPERATIONAL_ROLES.MANAGER,
            OPERATIONAL_ROLES.TEAM_LEAD,
        ],
        priority: 3,
    }),
];

/**
 * Get a routine definition by its key.
 * @param {string} key - ROUTINE_KEYS value
 * @returns {Object|undefined}
 */
export function getRoutineByKey(key) {
    return DEFAULT_ROUTINES.find(r => r.key === key);
}

/**
 * Get all routine keys.
 * @returns {string[]}
 */
export function getAllRoutineKeys() {
    return DEFAULT_ROUTINES.map(r => r.key);
}
