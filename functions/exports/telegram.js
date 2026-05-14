/**
 * Telegram Domain Exports — functions/exports/telegram.js
 * [Phase M.5] Webhook, user linking, delay notification trigger,
 * quick report API, menu button setup.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getUserRbacRole, requireAdmin } = require("../middleware/authGuard");

function createTelegramExports(adminDb, secrets) {
    const { telegramBotToken, geminiApiKey, supabaseUrl, supabaseServiceRoleKey, nvidiaApiKey } = secrets;

    /** Initialize Supabase admin client */
    function initSupabase() {
        const { getSupabase } = require("../db/supabaseAdmin");
        getSupabase(supabaseUrl.value(), supabaseServiceRoleKey.value());
    }

    const telegramWebhookEndpoint = onRequest(
        { secrets: [telegramBotToken, geminiApiKey, supabaseUrl, supabaseServiceRoleKey, nvidiaApiKey], cors: false, maxInstances: 10 },
        async (req, res) => {
            if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }
            try {
                initSupabase();
                const { handleWebhook } = require("../telegram/telegramWebhook");
                const token = telegramBotToken.value();
                const body = { ...req.body, _apiKey: geminiApiKey.value(), _nvidiaKey: nvidiaApiKey.value() };
                const result = await handleWebhook(adminDb, token, body);
                if (result.processed) { res.status(200).json({ ok: true }); } else { console.warn("[webhook] Not processed:", result.error); res.status(200).json({ ok: true, skipped: result.error }); }
            } catch (err) {
                console.error("[webhook] Critical error:", err);
                res.status(200).json({ ok: true, error: "internal" });
            }
        }
    );

    const linkTelegramUser = onCall(
        { timeoutSeconds: 15 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            await requireAdmin(adminDb, request);
            const { userId, chatId } = request.data;
            if (!userId || !chatId) throw new HttpsError("invalid-argument", "userId and chatId are required.");

            const chatIdStr = String(chatId);
            const now = new Date().toISOString();

            const sessSnap = await adminDb.collection("telegramSessions").where("chatId", "==", chatIdStr).limit(1).get();
            if (!sessSnap.empty) {
                await sessSnap.docs[0].ref.update({ userId, updatedAt: now });
            } else {
                await adminDb.collection("telegramSessions").add({ chatId: chatIdStr, userId, currentState: "idle", isActive: true, metadata: {}, createdAt: now, updatedAt: now });
            }

            const userRef = adminDb.collection("users").doc(userId);
            const userSnap = await userRef.get();
            if (userSnap.exists) {
                await userRef.update({ telegramChatId: chatIdStr, isAutomationParticipant: true, updatedAt: now });
            }

            const allUsers = await adminDb.collection("users").limit(20).get();
            const userList = allUsers.docs.map(d => ({ id: d.id, name: d.data().name, email: d.data().email, telegramChatId: d.data().telegramChatId || null }));
            return { linked: true, userId, chatId: chatIdStr, allUsers: userList };
        }
    );

    const onDelayCreated = onDocumentCreated(
        { document: "delays/{delayId}", secrets: [telegramBotToken, supabaseUrl, supabaseServiceRoleKey] },
        async (event) => {
            initSupabase();
            const snap = event.data;
            if (!snap) return;
            const delay = snap.data();
            const delayId = event.params.delayId;
            console.log(`[onDelayCreated] New delay: ${delayId}`, JSON.stringify(delay));

            // ── Guard: check if blocker_notification routine is enabled ──
            const paths = require("../automation/firestorePaths");
            const coreSnap = await adminDb.collection(paths.SETTINGS).doc(paths.SETTINGS_DOCS.AUTOMATION_CORE).get();
            if (coreSnap.exists && !coreSnap.data().enabled) {
                console.log("[onDelayCreated] automationCore is disabled, skipping blocker notification.");
                return;
            }
            const routineSnap = await adminDb.collection(paths.AUTOMATION_ROUTINES).doc("block_incident_alert").get();
            if (routineSnap.exists && !routineSnap.data().enabled) {
                console.log("[onDelayCreated] block_incident_alert routine is disabled, skipping notification.");
                return;
            }

            const token = telegramBotToken.value();
            if (!token) { console.warn("[onDelayCreated] No Telegram bot token configured, skipping notification."); return; }

            try {
                const { sendToUser } = require("../telegram/telegramProvider");
                let reporterName = "Alguien";
                if (delay.createdBy) { const userDoc = await adminDb.collection("users").doc(delay.createdBy).get(); if (userDoc.exists) { const u = userDoc.data(); reporterName = u.name || u.displayName || u.email || reporterName; } }
                let taskName = delay.taskId || "";
                if (delay.taskId) { const taskDoc = await adminDb.collection("tasks").doc(delay.taskId).get(); if (taskDoc.exists) taskName = taskDoc.data().title || taskName; }
                let projectName = delay.projectId || "";
                if (delay.projectId) { const projDoc = await adminDb.collection("projects").doc(delay.projectId).get(); if (projDoc.exists) projectName = projDoc.data().name || projectName; }

                const message = `🚨 *Nuevo Bloqueo Reportado*\n\n📋 *Causa:* ${delay.causeName || "Sin especificar"}\n` +
                    (taskName ? `🎯 *Tarea:* ${taskName}\n` : "") + (projectName ? `📁 *Proyecto:* ${projectName}\n` : "") +
                    (delay.notes ? `📝 *Notas:* ${delay.notes}\n` : "") +
                    `👤 *Reportado por:* ${reporterName}\n🕒 *Fecha:* ${new Date().toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })}`;

                const sessionsSnap = await adminDb.collection("telegramSessions").get();
                let sent = 0;
                for (const sessDoc of sessionsSnap.docs) {
                    const sess = sessDoc.data();
                    if (!sess.chatId && !sess.telegramChatId) continue;
                    const chatId = sess.chatId || sess.telegramChatId;
                    const uid = sess.uid || sess.userId;
                    if (!uid) continue;
                    const userRbacRole = await getUserRbacRole(adminDb, uid);
                    const userDoc = await adminDb.collection("users").doc(uid).get();
                    const userData = userDoc.exists ? userDoc.data() : {};
                    const teamRole = userData.teamRole || userData.operationalRole;
                    const isManagerOrLead = userRbacRole === "admin" || teamRole === "manager" || teamRole === "team_lead";
                    if (isManagerOrLead) {
                        try { await sendToUser(adminDb, token, uid, chatId, message, { routineKey: "blocker_notification" }); sent++; console.log(`[onDelayCreated] Notified ${uid} (chatId: ${chatId})`); }
                        catch (err) { console.error(`[onDelayCreated] Failed to notify ${uid}:`, err.message); }
                    }
                }
                console.log(`[onDelayCreated] Blocker notification sent to ${sent} users.`);
            } catch (err) {
                console.error("[onDelayCreated] Error sending blocker notification:", err);
            }
        }
    );

    const quickReportApi = onRequest(
        { cors: true, timeoutSeconds: 30 },
        async (req, res) => {
            res.set("Access-Control-Allow-Origin", "*");
            res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.set("Access-Control-Allow-Headers", "Content-Type");
            if (req.method === "OPTIONS") { res.status(204).send(""); return; }
            try {
                if (req.method === "GET") {
                    const { getQuickReportData } = require("../handlers/quickReportHandler");
                    const chatId = req.query.chatId;
                    if (!chatId) { res.status(400).json({ error: "chatId is required" }); return; }
                    const result = await getQuickReportData(adminDb, chatId);
                    res.status(200).json(result); return;
                }
                if (req.method === "POST") {
                    const { getQuickReportData, submitQuickReport, createQuickTask } = require("../handlers/quickReportHandler");
                    const body = req.body;
                    if (!body || !body.chatId) { res.status(400).json({ error: "chatId is required in body" }); return; }

                    // Route by action
                    if (body.action === "createTask") {
                        const result = await createQuickTask(adminDb, body);
                        res.status(200).json(result); return;
                    }

                    // Default: submit report
                    const result = await submitQuickReport(adminDb, body);
                    res.status(200).json(result); return;
                }
                res.status(405).json({ error: "Method not allowed" });
            } catch (err) {
                console.error("[quickReportApi] Error:", err);
                res.status(500).json({ error: err.message || "Internal error" });
            }
        }
    );

    const setupQuickReportMenuButton = onRequest(
        { secrets: [telegramBotToken], cors: false },
        async (req, res) => {
            const token = telegramBotToken.value().trim();
            const WEBAPP_URL = "https://bom-ame-cr.web.app/tg-report";
            try {
                const response = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ menu_button: { type: "web_app", text: "⚡ Quick Report", web_app: { url: WEBAPP_URL } } }),
                });
                const data = await response.json();
                res.status(200).json({ ok: data.ok, result: data.result, description: data.description });
            } catch (err) {
                console.error("[setupMenuButton] Error:", err);
                res.status(500).json({ error: err.message });
            }
        }
    );

    return { telegramWebhookEndpoint, linkTelegramUser, onDelayCreated, quickReportApi, setupQuickReportMenuButton };
}

module.exports = { createTelegramExports };
