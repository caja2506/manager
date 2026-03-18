/**
 * Team Management Handler — Backend (CJS)
 * ==========================================
 * Manages team members, Telegram link codes, and
 * operational role assignments.
 */

const paths = require("../automation/firestorePaths");
const crypto = require("crypto");

// ── Link Code Generation ──

/**
 * Generate a unique 6-character link code for Telegram onboarding.
 * Code is stored in telegramLinkCodes collection with 24h expiry.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} userId - Firebase Auth UID
 * @returns {{ code: string, expiresAt: string }}
 */
async function generateLinkCode(adminDb, userId) {
    // Validate user exists
    const userDoc = await adminDb.collection(paths.USERS).doc(userId).get();
    if (!userDoc.exists) {
        throw new Error(`User ${userId} not found in users collection`);
    }
    const userData = userDoc.data();

    // Invalidate any existing unused codes for this user
    const existingSnap = await adminDb.collection("telegramLinkCodes")
        .where("userId", "==", userId)
        .where("used", "==", false)
        .get();

    const batch = adminDb.batch();
    for (const doc of existingSnap.docs) {
        batch.update(doc.ref, { used: true, invalidatedAt: new Date().toISOString() });
    }
    if (!existingSnap.empty) await batch.commit();

    // Generate unique code
    const code = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 hex chars
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    await adminDb.collection("telegramLinkCodes").add({
        code,
        userId,
        userName: userData.displayName || userData.name || userData.email || userId,
        userEmail: userData.email || "",
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        used: false,
        usedAt: null,
        usedByChatId: null,
    });

    return {
        code,
        expiresAt: expiresAt.toISOString(),
        userName: userData.displayName || userData.name || userData.email,
    };
}

// ── Link Code Validation (used by bot) ──

/**
 * Validate and consume a link code. Called when bot receives /link CODE.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} code - The 6-char code
 * @param {string} chatId - Telegram chat ID
 * @returns {{ valid: boolean, userId?: string, userName?: string, userRole?: string, error?: string }}
 */
async function validateAndConsumeLinkCode(adminDb, code, chatId) {
    const codeUpper = code.toUpperCase().trim();

    // Find the code
    const snap = await adminDb.collection("telegramLinkCodes")
        .where("code", "==", codeUpper)
        .limit(1)
        .get();

    if (snap.empty) {
        return { valid: false, error: "code_not_found" };
    }

    const codeDoc = snap.docs[0];
    const codeData = codeDoc.data();

    // Check if already used
    if (codeData.used) {
        return { valid: false, error: "code_already_used" };
    }

    // Check expiry
    if (new Date() > new Date(codeData.expiresAt)) {
        // Mark as expired
        await codeDoc.ref.update({ used: true, invalidatedAt: new Date().toISOString() });
        return { valid: false, error: "code_expired" };
    }

    const chatIdStr = String(chatId);

    // ── Link the user ──

    // 1. Update user doc
    const userRef = adminDb.collection(paths.USERS).doc(codeData.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        return { valid: false, error: "user_not_found" };
    }

    const now = new Date().toISOString();
    await userRef.update({
        telegramChatId: chatIdStr,
        isAutomationParticipant: true,
        updatedAt: now,
    });

    // 2. Create/update Telegram session
    const sessSnap = await adminDb.collection("telegramSessions")
        .where("chatId", "==", chatIdStr)
        .limit(1)
        .get();

    if (!sessSnap.empty) {
        await sessSnap.docs[0].ref.update({
            userId: codeData.userId,
            isActive: true,
            currentState: "idle",
            updatedAt: now,
        });
    } else {
        await adminDb.collection("telegramSessions").add({
            chatId: chatIdStr,
            userId: codeData.userId,
            currentState: "idle",
            isActive: true,
            metadata: {},
            createdAt: now,
            updatedAt: now,
        });
    }

    // 3. Mark code as used
    await codeDoc.ref.update({
        used: true,
        usedAt: now,
        usedByChatId: chatIdStr,
    });

    const userData = userSnap.data();
    return {
        valid: true,
        userId: codeData.userId,
        userName: userData.displayName || userData.name || userData.email || codeData.userId,
        userRole: userData.operationalRole || "Sin rol asignado",
    };
}

// ── Unlink Telegram ──

/**
 * Remove Telegram link from a user.
 */
async function unlinkTelegramUser(adminDb, userId) {
    const userRef = adminDb.collection(paths.USERS).doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error(`User ${userId} not found`);

    const userData = userSnap.data();
    const chatId = userData.telegramChatId ||
        userData.providerLinks?.telegram?.chatId;

    // Clear both possible locations of the Telegram link
    const updatePayload = {
        telegramChatId: null,
        updatedAt: new Date().toISOString(),
    };
    // Also clear providerLinks.telegram if it exists
    if (userData.providerLinks?.telegram) {
        updatePayload["providerLinks.telegram"] = null;
    }
    await userRef.update(updatePayload);

    // Deactivate Telegram session if exists
    if (chatId) {
        const sessSnap = await adminDb.collection("telegramSessions")
            .where("chatId", "==", String(chatId))
            .limit(1)
            .get();
        if (!sessSnap.empty) {
            await sessSnap.docs[0].ref.update({ isActive: false, updatedAt: new Date().toISOString() });
        }
    }

    return { unlinked: true, userId };
}

// ── Update Team Member ──

/**
 * Update operational fields for a team member.
 * Syncs operationalRole → users_roles.teamRole for consistency.
 */
async function updateTeamMember(adminDb, userId, fields) {
    const allowed = ["operationalRole", "isAutomationParticipant", "active", "reportsTo", "name"];
    const updates = {};
    for (const key of allowed) {
        if (fields[key] !== undefined) updates[key] = fields[key];
    }
    if (Object.keys(updates).length === 0) {
        throw new Error("No valid fields to update");
    }
    updates.updatedAt = new Date().toISOString();

    const userRef = adminDb.collection(paths.USERS).doc(userId);
    const snap = await userRef.get();
    if (!snap.exists) throw new Error(`User ${userId} not found`);

    await userRef.update(updates);

    // Sync operationalRole → users_roles.teamRole for consistency
    if (updates.operationalRole !== undefined) {
        const rolesRef = adminDb.collection(paths.USERS_ROLES).doc(userId);
        const rolesSnap = await rolesRef.get();
        if (rolesSnap.exists) {
            await rolesRef.update({
                teamRole: updates.operationalRole,
                updatedAt: updates.updatedAt,
            });
        }
    }

    return { updated: true, userId, fields: Object.keys(updates) };
}

// ── Get Team Members (V5: READ-ONLY — no side effect writes) ──

/**
 * Get all team members with their Telegram status.
 * Merges data from both "users" (operational) and "users_roles" (auth/RBAC)
 * so ALL registered users appear even if they haven't been set up for automation.
 *
 * V5 CHANGE (O5): This function is now READ-ONLY. It merges data in-memory
 * but NEVER writes to Firestore. Use ensureTeamMemberProfiles() separately
 * when you need to create missing user profiles.
 */
async function getTeamMembers(adminDb) {
    // 1. Load operational users
    const usersSnap = await adminDb.collection(paths.USERS).get();
    const usersMap = {};
    for (const doc of usersSnap.docs) {
        usersMap[doc.id] = { id: doc.id, ...doc.data() };
    }

    // 2. Load RBAC users (source of truth for who's registered)
    const rolesSnap = await adminDb.collection(paths.USERS_ROLES).get();

    for (const doc of rolesSnap.docs) {
        const rd = doc.data();
        if (!usersMap[doc.id]) {
            // User exists in RBAC but not in operational users — merge in-memory only
            usersMap[doc.id] = {
                id: doc.id,
                displayName: rd.displayName || rd.name || rd.email || doc.id,
                name: rd.displayName || rd.name || rd.email || doc.id,
                email: rd.email || "",
                active: true,
                isAutomationParticipant: false,
                _needsProfileCreation: true, // Flag for caller to detect
            };
        } else {
            // Merge: ensure displayName & email are current from RBAC (in-memory)
            const u = usersMap[doc.id];
            const rbacName = rd.displayName || rd.name || '';
            if (rbacName && !u.displayName) {
                usersMap[doc.id].displayName = rbacName;
                usersMap[doc.id].name = rbacName;
            }
            if (!u.email && rd.email) usersMap[doc.id].email = rd.email;
        }
        // Attach RBAC role for reference
        usersMap[doc.id].rbacRole = rd.role || null;
    }

    // 3. Build members array
    const members = Object.values(usersMap).map(d => ({
        id: d.id,
        name: d.displayName || d.name || d.email || d.id,
        displayName: d.displayName || d.name || d.email || d.id,
        email: d.email || "",
        operationalRole: d.operationalRole || null,
        teamRole: d.teamRole || d.operationalRole || null, // V5: expose both names
        rbacRole: d.rbacRole || null,
        isAutomationParticipant: d.isAutomationParticipant || false,
        active: d.active !== false,
        telegramLinked: !!d.telegramChatId,
        telegramChatId: d.telegramChatId || null,
        reportsTo: d.reportsTo || null,
        updatedAt: d.updatedAt || null,
    }));

    // 4. Get pending link codes
    const codesSnap = await adminDb.collection("telegramLinkCodes")
        .where("used", "==", false)
        .get();

    const pendingCodes = {};
    const nowDate = new Date();
    for (const doc of codesSnap.docs) {
        const c = doc.data();
        if (new Date(c.expiresAt) > nowDate) {
            pendingCodes[c.userId] = {
                code: c.code,
                expiresAt: c.expiresAt,
            };
        }
    }

    return { members, pendingCodes };
}

/**
 * Ensure all RBAC users have corresponding users/{uid} profiles.
 * This is the EXPLICIT write operation that was previously hidden
 * inside getTeamMembers() as a side effect.
 *
 * Call this intentionally (e.g., from admin panel or bootstrap flow).
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @returns {{ created: number, total: number }}
 */
async function ensureTeamMemberProfiles(adminDb) {
    const usersSnap = await adminDb.collection(paths.USERS).get();
    const existingUids = new Set(usersSnap.docs.map(d => d.id));

    const rolesSnap = await adminDb.collection(paths.USERS_ROLES).get();
    const now = new Date().toISOString();
    let created = 0;

    for (const doc of rolesSnap.docs) {
        if (!existingUids.has(doc.id)) {
            const rd = doc.data();
            await adminDb.collection(paths.USERS).doc(doc.id).set({
                displayName: rd.displayName || rd.name || rd.email || doc.id,
                name: rd.displayName || rd.name || rd.email || doc.id,
                email: rd.email || "",
                active: true,
                isAutomationParticipant: false,
                createdAt: now,
                updatedAt: now,
                createdBy: "system",
                updatedBy: "system",
            });
            created++;
        }
    }

    return { created, total: rolesSnap.size };
}

module.exports = {
    generateLinkCode,
    validateAndConsumeLinkCode,
    unlinkTelegramUser,
    updateTeamMember,
    getTeamMembers,
    ensureTeamMemberProfiles,
};
