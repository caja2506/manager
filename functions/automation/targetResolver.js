/**
 * Target Resolver — Backend (CJS)
 * =================================
 * Centralized resolution of automation targets (users).
 * Determines who should receive messages based on role, channel, and provider link.
 */

const paths = require("./firestorePaths");
const { OPERATIONAL_ROLES } = require("./constants");

/**
 * Resolve targets by operational role(s).
 * Returns users who:
 *  - have isAutomationParticipant === true
 *  - have matching operationalRole
 *  - have active providerLinks.telegram.chatId
 *  - are active (active !== false)
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string[]} roles - Array of OPERATIONAL_ROLES values
 * @param {string} [channel="telegram"]
 * @returns {Promise<Array<{uid: string, name: string, email: string, operationalRole: string, chatId: string}>>}
 */
async function resolveTargetsByRole(adminDb, roles, channel = "telegram") {
    const usersSnap = await adminDb.collection(paths.USERS)
        .where("isAutomationParticipant", "==", true)
        .get();

    const targets = [];
    for (const doc of usersSnap.docs) {
        const u = doc.data();
        if (u.active === false) continue;
        if (!roles.includes(u.operationalRole)) continue;

        const chatId = u.providerLinks?.[channel]?.chatId || u.telegramChatId;
        if (!chatId) continue;

        targets.push({
            uid: doc.id,
            name: u.name || u.email || doc.id,
            email: u.email || "",
            operationalRole: u.operationalRole,
            chatId: String(chatId),
            reportsTo: u.reportsTo || null,
        });
    }
    return targets;
}

/**
 * Resolve a single user target by UID.
 */
async function resolveTargetById(adminDb, userId, channel = "telegram") {
    const doc = await adminDb.collection(paths.USERS).doc(userId).get();
    if (!doc.exists) return null;

    const u = doc.data();
    const chatId = u.providerLinks?.[channel]?.chatId || u.telegramChatId;
    if (!chatId) return null;

    return {
        uid: doc.id,
        name: u.name || u.email || doc.id,
        email: u.email || "",
        operationalRole: u.operationalRole || null,
        chatId: String(chatId),
        reportsTo: u.reportsTo || null,
    };
}

/**
 * Resolve all active automation participants for a channel.
 */
async function resolveAllParticipants(adminDb, channel = "telegram") {
    const usersSnap = await adminDb.collection(paths.USERS)
        .where("isAutomationParticipant", "==", true)
        .get();

    const targets = [];
    for (const doc of usersSnap.docs) {
        const u = doc.data();
        if (u.active === false) continue;
        const chatId = u.providerLinks?.[channel]?.chatId || u.telegramChatId;
        if (!chatId) continue;

        targets.push({
            uid: doc.id,
            name: u.name || u.email || doc.id,
            email: u.email || "",
            operationalRole: u.operationalRole || null,
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
async function resolveSupervisor(adminDb, userId, channel = "telegram") {
    const userDoc = await adminDb.collection(paths.USERS).doc(userId).get();
    if (!userDoc.exists) return null;
    const user = userDoc.data();

    // Direct reportsTo
    if (user.reportsTo) {
        const sup = await resolveTargetById(adminDb, user.reportsTo, channel);
        if (sup) return sup;
    }

    // Fallback: find any user with the next-level role
    const roleChain = {
        [OPERATIONAL_ROLES.TECHNICIAN]: OPERATIONAL_ROLES.ENGINEER,
        [OPERATIONAL_ROLES.ENGINEER]: OPERATIONAL_ROLES.TEAM_LEAD,
        [OPERATIONAL_ROLES.TEAM_LEAD]: OPERATIONAL_ROLES.MANAGER,
    };
    const targetRole = roleChain[user.operationalRole];
    if (!targetRole) return null;

    const supervisors = await resolveTargetsByRole(adminDb, [targetRole], channel);
    return supervisors.length > 0 ? supervisors[0] : null;
}

module.exports = {
    resolveTargetsByRole,
    resolveTargetById,
    resolveAllParticipants,
    resolveSupervisor,
};
