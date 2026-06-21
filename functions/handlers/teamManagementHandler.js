/**
 * Team Management Handler — Backend (CJS)
 * ==========================================
 * Manages team members, Telegram link codes, and
 * operational role assignments.
 */

const crypto = require("crypto");
const { loadUser, loadAllUsers, updateUser } = require("../db/coreDataReader");
const { getSupabase, toCamel } = require("../db/supabaseAdmin");
const paths = require("../automation/firestorePaths");

// ── Link Code Generation ──

/**
 * Generate a unique 6-character link code for Telegram onboarding.
 * Code is stored in telegram_link_codes table with 24h expiry.
 *
 * @param {any} adminDb - Deprecated, kept for signature compatibility
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<{ code: string, expiresAt: string }>}
 */
async function generateLinkCode(adminDb, userId) {
    const userData = await loadUser(userId);
    if (!userData) {
        throw new Error(`User ${userId} not found in users collection`);
    }

    const sb = getSupabase();

    // Invalidate (delete) any existing unused codes for this user
    const { error: deleteError } = await sb.from("telegram_link_codes")
        .delete()
        .eq("user_id", userId);

    if (deleteError) {
        console.warn("[teamManagementHandler] Error invalidating old codes:", deleteError.message);
    }

    // Generate unique code
    const code = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 hex chars
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const { error: insertError } = await sb.from("telegram_link_codes").insert({
        code,
        user_id: userId,
        email: userData.email || "",
        expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
        console.error("[teamManagementHandler] Error inserting link code:", insertError.message);
        throw insertError;
    }

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
 * @param {any} adminDb - Deprecated, kept for signature compatibility
 * @param {string} code - The 6-char code
 * @param {string} chatId - Telegram chat ID
 * @returns {Promise<{ valid: boolean, userId?: string, userName?: string, userRole?: string, error?: string }>}
 */
async function validateAndConsumeLinkCode(adminDb, code, chatId) {
    const codeUpper = code.toUpperCase().trim();
    const sb = getSupabase();

    // Find the code
    const { data: codeData, error: fetchError } = await sb.from("telegram_link_codes")
        .select("*")
        .eq("code", codeUpper)
        .maybeSingle();

    if (fetchError || !codeData) {
        return { valid: false, error: "code_not_found" };
    }

    // Check expiry
    if (new Date() > new Date(codeData.expires_at)) {
        // Delete expired code
        await sb.from("telegram_link_codes").delete().eq("code", codeUpper);
        return { valid: false, error: "code_expired" };
    }

    const chatIdStr = String(chatId);

    // ── Link the user ──

    // 1. Update user doc in Supabase
    const userData = await loadUser(codeData.user_id);
    if (!userData) {
        return { valid: false, error: "user_not_found" };
    }

    const now = new Date().toISOString();
    await updateUser(codeData.user_id, {
        telegramChatId: chatIdStr,
        isAutomationParticipant: true,
    });

    // 2. Create/update Telegram session in Supabase
    const { data: sessionData } = await sb.from("telegram_sessions")
        .select("*")
        .eq("chat_id", chatIdStr)
        .maybeSingle();

    if (sessionData) {
        await sb.from("telegram_sessions")
            .update({
                user_id: codeData.user_id,
                step: "idle",
                updated_at: now,
            })
            .eq("chat_id", chatIdStr);
    } else {
        await sb.from("telegram_sessions")
            .insert({
                chat_id: chatIdStr,
                user_id: codeData.user_id,
                step: "idle",
                created_at: now,
                updated_at: now,
            });
    }

    // 3. Delete the consumed code
    await sb.from("telegram_link_codes").delete().eq("code", codeUpper);

    return {
        valid: true,
        userId: codeData.user_id,
        userName: userData.displayName || userData.name || userData.email || codeData.user_id,
        userRole: userData.operationalRole || "Sin rol asignado",
    };
}

// ── Unlink Telegram ──

/**
 * Remove Telegram link from a user.
 */
async function unlinkTelegramUser(adminDb, userId) {
    const userData = await loadUser(userId);
    if (!userData) throw new Error(`User ${userId} not found`);

    const chatId = userData.telegramChatId;

    // Clear Telegram link in Supabase
    await updateUser(userId, {
        telegramChatId: null,
    });

    // Deactivate Telegram session if exists
    if (chatId) {
        const sb = getSupabase();
        await sb.from("telegram_sessions")
            .update({
                user_id: null,
                step: "unlinked",
                updated_at: new Date().toISOString()
            })
            .eq("chat_id", String(chatId));
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

    const existingUser = await loadUser(userId);
    if (!existingUser) throw new Error(`User ${userId} not found`);

    await updateUser(userId, updates);

    // SECURITY: users_roles is FROZEN. Do NOT write to it.
    // All operational role data lives in users/{uid} only.

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
    // 1. Load operational users from Supabase
    const allUsersList = await loadAllUsers();
    const usersMap = {};
    for (const u of allUsersList) {
        usersMap[u.id] = u;
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

    // 4. Get pending link codes from Supabase
    const sb = getSupabase();
    const { data: codesData } = await sb.from("telegram_link_codes").select("*");

    const pendingCodes = {};
    const nowDate = new Date();
    for (const c of (codesData || [])) {
        if (new Date(c.expires_at) > nowDate) {
            pendingCodes[c.user_id] = {
                code: c.code,
                expiresAt: c.expires_at,
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
    const allUsersList = await loadAllUsers();
    const existingUids = new Set(allUsersList.map(u => u.id));

    const rolesSnap = await adminDb.collection(paths.USERS_ROLES).get();
    const { upsertUser } = require("../db/coreDataReader");
    let created = 0;

    for (const doc of rolesSnap.docs) {
        if (!existingUids.has(doc.id)) {
            const rd = doc.data();
            await upsertUser(doc.id, {
                displayName: rd.displayName || rd.name || rd.email || doc.id,
                name: rd.displayName || rd.name || rd.email || doc.id,
                email: rd.email || "",
                active: true,
                isAutomationParticipant: false,
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
