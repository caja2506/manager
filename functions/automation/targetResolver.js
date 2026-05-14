/**
 * Target Resolver — Backend (CJS)
 * =================================
 * Centralized resolution of automation targets (users).
 * Determines who should receive messages based on role, channel, and provider link.
 *
 * [SUPABASE MIGRATION] Now reads user data from Supabase via coreDataReader.
 * Firestore `adminDb` is no longer needed for user lookups.
 */

const { OPERATIONAL_ROLES } = require("./constants");
const { loadAllUsers, loadUser, loadAutomationParticipants } = require("../db/coreDataReader");

/**
 * V5 (O3): Resolve the team role from user data.
 * Reads `teamRole` (V5 standard) first, falls back to `operationalRole` (legacy).
 * @param {Object} userData - User data (camelCase)
 * @returns {string|null}
 */
function resolveTeamRole(userData) {
    return userData.teamRole || userData.operationalRole || null;
}

/**
 * Resolve targets by operational role(s).
 * Returns users who:
 *  - have isAutomationParticipant === true
 *  - have matching operationalRole
 *  - have active providerLinks.telegram.chatId
 *  - are active (active !== false)
 *
 * @param {Object} _adminDb - UNUSED (kept for backward compat signature)
 * @param {string[]} roles - Array of OPERATIONAL_ROLES values
 * @param {string} [channel="telegram"]
 * @returns {Promise<Array<{uid: string, name: string, email: string, operationalRole: string, chatId: string}>>}
 */
async function resolveTargetsByRole(_adminDb, roles, channel = "telegram") {
    const allUsers = await loadAutomationParticipants();

    const targets = [];
    for (const u of allUsers) {
        if (u.active === false) continue;
        const role = resolveTeamRole(u);
        if (!roles.includes(role)) continue;

        const chatId = u.providerLinks?.[channel]?.chatId || u.telegramChatId;
        if (!chatId) continue;

        targets.push({
            uid: u.id,
            name: u.displayName || u.name || u.email || u.id,
            email: u.email || "",
            teamRole: role,                   // V5 name
            operationalRole: role,            // backward compat alias
            chatId: String(chatId),
            reportsTo: u.reportsTo || null,
        });
    }
    return targets;
}

/**
 * Resolve a single user target by UID.
 */
async function resolveTargetById(_adminDb, userId, channel = "telegram") {
    const u = await loadUser(userId);
    if (!u) return null;

    const chatId = u.providerLinks?.[channel]?.chatId || u.telegramChatId;
    if (!chatId) return null;

    return {
        uid: u.id,
        name: u.displayName || u.name || u.email || u.id,
        email: u.email || "",
        teamRole: resolveTeamRole(u),          // V5 name
        operationalRole: resolveTeamRole(u),   // backward compat alias
        chatId: String(chatId),
        reportsTo: u.reportsTo || null,
    };
}

/**
 * Resolve all active automation participants for a channel.
 */
async function resolveAllParticipants(_adminDb, channel = "telegram") {
    const allUsers = await loadAutomationParticipants();

    const targets = [];
    for (const u of allUsers) {
        if (u.active === false) continue;
        const chatId = u.providerLinks?.[channel]?.chatId || u.telegramChatId;
        if (!chatId) continue;

        targets.push({
            uid: u.id,
            name: u.displayName || u.name || u.email || u.id,
            email: u.email || "",
            teamRole: resolveTeamRole(u),          // V5 name
            operationalRole: resolveTeamRole(u),   // backward compat alias
            chatId: String(chatId),
            reportsTo: u.reportsTo || null,
        });
    }
    return targets;
}

/**
 * Find user's supervisor (escalation target).
 * Uses reportsTo field, then falls back to role chain.
 */
async function resolveSupervisor(_adminDb, userId, channel = "telegram") {
    const user = await loadUser(userId);
    if (!user) return null;

    // Direct reportsTo
    if (user.reportsTo) {
        const sup = await resolveTargetById(_adminDb, user.reportsTo, channel);
        if (sup) return sup;
    }

    // Fallback: find any user with the next-level role
    const roleChain = {
        [OPERATIONAL_ROLES.TECHNICIAN]: OPERATIONAL_ROLES.ENGINEER,
        [OPERATIONAL_ROLES.ENGINEER]: OPERATIONAL_ROLES.TEAM_LEAD,
        [OPERATIONAL_ROLES.TEAM_LEAD]: OPERATIONAL_ROLES.MANAGER,
    };
    const targetRole = roleChain[resolveTeamRole(user)];
    if (!targetRole) return null;

    const supervisors = await resolveTargetsByRole(_adminDb, [targetRole], channel);
    return supervisors.length > 0 ? supervisors[0] : null;
}

module.exports = {
    resolveTargetsByRole,
    resolveTargetById,
    resolveAllParticipants,
    resolveSupervisor,
};
