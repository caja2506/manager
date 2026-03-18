/**
 * User Settings Helpers — V5 Phase 2B
 * =====================================
 * Pure functions that extract automation and channel settings from
 * user data, handling both V5 nested structure and legacy flat fields.
 *
 * These are PURE FUNCTIONS — no Firestore reads. They normalize
 * user documents whether they use old flat fields or new V5 structure.
 *
 * @module services/userSettingsHelpers
 */

/**
 * Extract automation settings from user data.
 * Handles both V5 nested `automation.*` and legacy flat fields.
 *
 * @param {Object} userData - User document data
 * @returns {{ isParticipant: boolean, shift: string|null, schedule: Object|null }}
 */
export function getUserAutomationSettings(userData) {
    if (!userData) {
        return { isParticipant: false, shift: null, schedule: null };
    }

    // V5 nested structure takes priority
    if (userData.automation) {
        return {
            isParticipant: userData.automation.isParticipant ?? false,
            shift: userData.automation.shift ?? null,
            schedule: userData.automation.schedule ?? null,
        };
    }

    // Legacy flat field fallback
    return {
        isParticipant: userData.isAutomationParticipant ?? false,
        shift: null,
        schedule: null,
    };
}

/**
 * Extract channel settings from user data.
 * Handles both V5 nested `channels.*` and legacy flat fields.
 *
 * @param {Object} userData - User document data
 * @returns {{ telegram: { chatId: string|null, linkedAt: string|null, active: boolean } }}
 */
export function getUserChannelSettings(userData) {
    if (!userData) {
        return { telegram: { chatId: null, linkedAt: null, active: false } };
    }

    // V5 nested structure takes priority
    if (userData.channels?.telegram) {
        return {
            telegram: {
                chatId: userData.channels.telegram.chatId ?? null,
                linkedAt: userData.channels.telegram.linkedAt ?? null,
                active: userData.channels.telegram.active ?? false,
            },
        };
    }

    // Legacy: check providerLinks then flat field
    const legacyChatId = userData.providerLinks?.telegram?.chatId
        || userData.telegramChatId
        || null;

    return {
        telegram: {
            chatId: legacyChatId,
            linkedAt: userData.providerLinks?.telegram?.linkedAt || null,
            active: !!legacyChatId,
        },
    };
}

/**
 * Extract the canonical team role from user data.
 * V5: teamRole > legacy: operationalRole
 *
 * @param {Object} userData
 * @returns {string|null}
 */
export function getUserTeamRole(userData) {
    if (!userData) return null;
    return userData.teamRole || userData.operationalRole || null;
}

/**
 * Extract the canonical display name from user data.
 * V5: displayName > legacy: name
 *
 * @param {Object} userData
 * @returns {string}
 */
export function getUserDisplayName(userData) {
    if (!userData) return '';
    return userData.displayName || userData.name || userData.email || '';
}

/**
 * Check if a user has a specific legacy field that should be migrated.
 *
 * @param {Object} userData
 * @returns {string[]} List of legacy field names still present
 */
export function detectLegacyFields(userData) {
    if (!userData) return [];

    const legacy = [];
    if (userData.operationalRole !== undefined) legacy.push('operationalRole');
    if (userData.isAutomationParticipant !== undefined) legacy.push('isAutomationParticipant');
    if (userData.telegramChatId !== undefined) legacy.push('telegramChatId');
    if (userData.name !== undefined && userData.displayName !== undefined) legacy.push('name');
    if (userData.providerLinks !== undefined) legacy.push('providerLinks');
    if (userData.role !== undefined) legacy.push('role');
    return legacy;
}
