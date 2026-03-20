/**
 * Team Domain Exports — functions/exports/team.js
 * [Phase M.5] Team management: get members, link codes, unlink, update.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");

function createTeamExports(adminDb) {
    const teamMgmt = require("../handlers/teamManagementHandler");

    const getTeamMembers = onCall(
        { timeoutSeconds: 15 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
            if (!roleDoc.exists || roleDoc.data().role !== "admin") throw new HttpsError("permission-denied", "Admin access required.");
            try { return await teamMgmt.getTeamMembers(adminDb); }
            catch (err) { throw new HttpsError("internal", `Failed to get team members: ${err.message}`); }
        }
    );

    const generateTelegramLinkCode = onCall(
        { timeoutSeconds: 15 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
            if (!roleDoc.exists || roleDoc.data().role !== "admin") throw new HttpsError("permission-denied", "Admin access required.");
            const { userId } = request.data;
            if (!userId) throw new HttpsError("invalid-argument", "userId is required.");
            try { return await teamMgmt.generateLinkCode(adminDb, userId); }
            catch (err) { throw new HttpsError("internal", `Failed to generate link code: ${err.message}`); }
        }
    );

    const unlinkTelegramMember = onCall(
        { timeoutSeconds: 15 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
            if (!roleDoc.exists || roleDoc.data().role !== "admin") throw new HttpsError("permission-denied", "Admin access required.");
            const { userId } = request.data;
            if (!userId) throw new HttpsError("invalid-argument", "userId is required.");
            try { return await teamMgmt.unlinkTelegramUser(adminDb, userId); }
            catch (err) { throw new HttpsError("internal", `Failed to unlink: ${err.message}`); }
        }
    );

    const updateTeamMember = onCall(
        { timeoutSeconds: 15 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
            if (!roleDoc.exists || roleDoc.data().role !== "admin") throw new HttpsError("permission-denied", "Admin access required.");
            const { userId, fields } = request.data;
            if (!userId || !fields) throw new HttpsError("invalid-argument", "userId and fields are required.");
            try { return await teamMgmt.updateTeamMember(adminDb, userId, fields); }
            catch (err) { throw new HttpsError("internal", `Failed to update member: ${err.message}`); }
        }
    );

    return { getTeamMembers, generateTelegramLinkCode, unlinkTelegramMember, updateTeamMember };
}

module.exports = { createTeamExports };
