/**
 * AI Governance Service — V5 Phase 2G
 * =====================================
 * Manages AI capability registration, governance checks,
 * and admin control over what AI can and cannot do.
 *
 * @module services/aiGovernanceService
 */

import { supabase } from '../supabase';
import {
    AI_GOVERNANCE_TYPE,
    createAiGovernanceDocument,
} from '../models/schemas';

/**
 * AI_PROHIBITED_ACTIONS — hardcoded, cannot be overridden from UI.
 * These are absolute restrictions that no admin can bypass.
 */
export const AI_PROHIBITED_ACTIONS = {
    CHANGE_TASK_STATUS: 'change_task_status',
    CHANGE_USER_ROLE: 'change_user_role',
    DELETE_DATA: 'delete_data',
    FINANCIAL_OPERATIONS: 'financial_operations',
    MODIFY_PERMISSIONS: 'modify_permissions',
    CHANGE_DATES: 'change_dates',
    CHANGE_OWNERS: 'change_owners',
    CLOSE_MILESTONES: 'close_milestones',
};

/**
 * Default AI capabilities to seed into governance collection.
 */
const DEFAULT_CAPABILITIES = [
    {
        key: 'smart_briefings',
        name: 'Smart Briefings',
        description: 'Genera briefings diarios personalizados por rol',
        type: AI_GOVERNANCE_TYPE.RECOMMENDER,
        settingsFlag: 'allowSmartBriefings',
        constraints: { maxTokens: 2000, rateLimit: '10/hour' },
    },
    {
        key: 'smart_escalation_hints',
        name: 'Smart Escalation Hints',
        description: 'Sugiere a quién escalar y por qué',
        type: AI_GOVERNANCE_TYPE.RECOMMENDER,
        settingsFlag: 'allowSmartEscalationHints',
        constraints: { maxTokens: 500, rateLimit: '20/hour' },
    },
    {
        key: 'audio_processing',
        name: 'Audio Processing',
        description: 'Transcribe y analiza mensajes de voz',
        type: AI_GOVERNANCE_TYPE.EXECUTOR_CONTROLLED,
        settingsFlag: 'allowAudioProcessing',
        constraints: { maxDurationSeconds: 120, rateLimit: '10/hour' },
    },
    {
        key: 'pdf_extraction',
        name: 'PDF/Quote Extraction',
        description: 'Extrae datos de PDFs y cotizaciones',
        type: AI_GOVERNANCE_TYPE.EXECUTOR_CONTROLLED,
        settingsFlag: null, // Always available
        constraints: { maxPages: 50, rateLimit: '5/hour' },
    },
    {
        key: 'weekly_summary',
        name: 'Weekly Summary',
        description: 'Genera resumen semanal ejecutivo',
        type: AI_GOVERNANCE_TYPE.RECOMMENDER,
        settingsFlag: 'allowSmartBriefings',
        constraints: { maxTokens: 3000, rateLimit: '2/day' },
    },
    {
        key: 'risk_assessment',
        name: 'Risk Assessment',
        description: 'Evalúa riesgos en proyectos y tareas',
        type: AI_GOVERNANCE_TYPE.RECOMMENDER,
        settingsFlag: null,
        constraints: { maxTokens: 1500, rateLimit: '10/hour' },
    },
];

const mapGovernance = (r) => ({
    id: r.capability,
    capability: r.capability,
    name: r.name,
    description: r.description,
    type: r.type,
    constraints: r.constraints,
    enabled: r.enabled,
    settingsFlag: r.settings_flag,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
});

/**
 * Seed governance capabilities (idempotent).
 * Creates capability records if they don't exist.
 *
 * @returns {{ created: string[], skipped: string[] }}
 */
export async function seedGovernanceCapabilities() {
    const created = [];
    const skipped = [];

    for (const cap of DEFAULT_CAPABILITIES) {
        const { data, error } = await supabase
            .from('ai_governance')
            .select('*')
            .eq('capability', cap.key)
            .maybeSingle();

        if (error) {
            console.error('[aiGovernanceService] Error checking governance capability:', error);
            continue;
        }

        if (!data) {
            const govDoc = createAiGovernanceDocument({
                capability: cap.key,
                name: cap.name,
                description: cap.description,
                type: cap.type,
                constraints: cap.constraints,
                enabled: true,
                settingsFlag: cap.settingsFlag,
            });

            // Map frontend document fields to snake_case table columns
            const sbDoc = {
                capability: govDoc.capability,
                name: govDoc.name,
                description: govDoc.description || '',
                type: govDoc.type,
                constraints: govDoc.constraints || {},
                enabled: govDoc.enabled !== false,
                settings_flag: govDoc.settingsFlag || null,
            };

            const { error: insErr } = await supabase.from('ai_governance').insert(sbDoc);
            if (insErr) {
                console.error('[aiGovernanceService] Error inserting capability:', insErr);
            } else {
                created.push(cap.key);
            }
        } else {
            skipped.push(cap.key);
        }
    }

    return { created, skipped };
}

/**
 * Check if an AI capability is allowed.
 * Checks:
 *   1. Is it in AI_PROHIBITED_ACTIONS? → always NO
 *   2. Does the governance record exist and is enabled?
 *   3. Is the settings flag set (if applicable)?
 *
 * @param {string} capabilityKey
 * @param {Object} [aiSettings] - Current automationAI settings document
 * @returns {Promise<{ allowed: boolean, reason: string }>}
 */
export async function isCapabilityAllowed(capabilityKey, aiSettings = null) {
    // 1. Check prohibitions (hardcoded)
    const prohibited = Object.values(AI_PROHIBITED_ACTIONS);
    if (prohibited.includes(capabilityKey)) {
        return { allowed: false, reason: 'Prohibited action — cannot be overridden' };
    }

    // 2. Check governance record
    const { data, error } = await supabase
        .from('ai_governance')
        .select('*')
        .eq('capability', capabilityKey)
        .maybeSingle();

    if (error || !data) {
        return { allowed: false, reason: 'Capability not registered in governance' };
    }

    const gov = mapGovernance(data);
    if (!gov.enabled) {
        return { allowed: false, reason: 'Capability disabled by admin' };
    }

    // 3. Check settings flag (if applicable)
    if (gov.settingsFlag && aiSettings) {
        if (!aiSettings[gov.settingsFlag]) {
            return { allowed: false, reason: `Settings flag '${gov.settingsFlag}' is disabled` };
        }
    }

    return { allowed: true, reason: 'OK' };
}

/**
 * Get all registered AI capabilities with their status.
 * @returns {Promise<Array>}
 */
export async function getCapabilities() {
    const { data, error } = await supabase
        .from('ai_governance')
        .select('*')
        .order('capability');

    if (error) {
        console.error('[aiGovernanceService] error loading capabilities:', error);
        return [];
    }
    return (data || []).map(mapGovernance);
}

