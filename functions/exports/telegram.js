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
    const { telegramBotToken, geminiApiKey, supabaseUrl, supabaseServiceRoleKey, nvidiaApiKey, deepseekApiKey } = secrets;

    /** Initialize Supabase admin client */
    function initSupabase() {
        const { getSupabase } = require("../db/supabaseAdmin");
        getSupabase(supabaseUrl.value(), supabaseServiceRoleKey.value());
    }

    const telegramWebhookEndpoint = onRequest(
        { secrets: [telegramBotToken, geminiApiKey, supabaseUrl, supabaseServiceRoleKey, nvidiaApiKey, deepseekApiKey], cors: false, maxInstances: 10, timeoutSeconds: 120 },
        async (req, res) => {
            if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }
            try {
                initSupabase();
                const { handleWebhook } = require("../telegram/telegramWebhook");
                const token = telegramBotToken.value();
                const body = { ...req.body, _apiKey: geminiApiKey.value(), _nvidiaKey: nvidiaApiKey.value(), _deepseekKey: deepseekApiKey.value() };
                const result = await handleWebhook(adminDb, token, body);
                if (result.processed) { res.status(200).json({ ok: true }); } else { console.warn("[webhook] Not processed:", result.error); res.status(200).json({ ok: true, skipped: result.error }); }
            } catch (err) {
                console.error("[webhook] Critical error:", err);
                res.status(200).json({ ok: true, error: "internal" });
            }
        }
    );

    const linkTelegramUser = onCall(
        { secrets: [supabaseUrl, supabaseServiceRoleKey], timeoutSeconds: 15 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            await requireAdmin(adminDb, request);
            const { userId, chatId } = request.data;
            if (!userId || !chatId) throw new HttpsError("invalid-argument", "userId and chatId are required.");

            initSupabase();
            const { getSupabase } = require("../db/supabaseAdmin");
            const sb = getSupabase();
            const chatIdStr = String(chatId);
            const now = new Date().toISOString();

            // 1. Update/create Telegram session in Supabase
            const { data: sessionData } = await sb.from("telegram_sessions")
                .select("*")
                .eq("chat_id", chatIdStr)
                .maybeSingle();

            if (sessionData) {
                await sb.from("telegram_sessions")
                    .update({ user_id: userId, updated_at: now })
                    .eq("chat_id", chatIdStr);
            } else {
                await sb.from("telegram_sessions")
                    .insert({ chat_id: chatIdStr, user_id: userId, step: "idle", created_at: now, updated_at: now });
            }

            // 2. Update user doc in Supabase
            const { updateUser, loadUser, loadAllUsers } = require("../db/coreDataReader");
            const u = await loadUser(userId);
            if (u) {
                await updateUser(userId, { telegramChatId: chatIdStr, isAutomationParticipant: true });
            }

            const allUsers = await loadAllUsers();
            const userList = allUsers.map(u => ({
                id: u.id,
                name: u.displayName || u.name || u.email,
                email: u.email,
                telegramChatId: u.telegramChatId || null
            }));

            return { linked: true, userId, chatId: chatIdStr, allUsers: userList.slice(0, 20) };
        }
    );


    const notifyTelegramDelayCreated = onCall(
        { secrets: [telegramBotToken, supabaseUrl, supabaseServiceRoleKey], timeoutSeconds: 30 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            initSupabase();
            const delay = request.data;
            if (!delay) throw new HttpsError("invalid-argument", "delay data is required.");

            // ── Guard: check if blocker_notification routine is enabled ──
            const { loadSetting } = require("../db/coreDataReader");
            const coreConfig = await loadSetting("automationCore");
            if (coreConfig && !coreConfig.enabled) {
                console.log("[notifyTelegramDelayCreated] automationCore is disabled.");
                return { success: false, reason: "automationCore is disabled" };
            }

            const { getSupabase } = require("../db/supabaseAdmin");
            const sb = getSupabase();
            const { data: routine } = await sb.from("automation_routines")
                .select("enabled")
                .eq("key", "block_incident_alert")
                .maybeSingle();

            if (routine && !routine.enabled) {
                console.log("[notifyTelegramDelayCreated] block_incident_alert is disabled.");
                return { success: false, reason: "block_incident_alert is disabled" };
            }

            const token = telegramBotToken.value();
            if (!token) return { success: false, reason: "No Telegram bot token configured" };

            try {
                const { sendToUser } = require("../telegram/telegramProvider");
                let reporterName = "Alguien";
                if (delay.createdBy) {
                    const { loadUser } = require("../db/coreDataReader");
                    const u = await loadUser(delay.createdBy);
                    if (u) reporterName = u.displayName || u.name || u.email || reporterName;
                }
                let taskName = delay.taskId || "";
                if (delay.taskId) {
                    const { loadTask } = require("../db/coreDataReader");
                    const t = await loadTask(delay.taskId);
                    if (t) taskName = t.title || taskName;
                }
                let projectName = delay.projectId || "";
                if (delay.projectId) {
                    const { loadProject } = require("../db/coreDataReader");
                    const p = await loadProject(delay.projectId);
                    if (p) projectName = p.name || projectName;
                }

                const message = `🚨 *Nuevo Bloqueo Reportado*\n\n📋 *Causa:* ${delay.causeName || "Sin especificar"}\n` +
                    (taskName ? `🎯 *Tarea:* ${taskName}\n` : "") + (projectName ? `📁 *Proyecto:* ${projectName}\n` : "") +
                    (delay.comment ? `📝 *Notas:* ${delay.comment}\n` : "") +
                    `👤 *Reportado por:* ${reporterName}\n🕒 *Fecha:* ${new Date().toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })}`;

                const { loadAllUsers } = require("../db/coreDataReader");
                const allUsers = await loadAllUsers();

                let sent = 0;
                for (const u of allUsers) {
                    if (!u.telegramChatId || !u.id) continue;
                    const isManagerOrLead = u.rbacRole === "admin" || u.teamRole === "manager" || u.teamRole === "team_lead" || u.operationalRole === "manager" || u.operationalRole === "team_lead";
                    if (isManagerOrLead) {
                        try {
                            await sendToUser(adminDb, token, u.id, u.telegramChatId, message, { routineKey: "block_incident_alert" });
                            sent++;
                            console.log(`[notifyTelegramDelayCreated] Notified ${u.id} (chatId: ${u.telegramChatId})`);
                        } catch (err) {
                            console.error(`[notifyTelegramDelayCreated] Failed to notify ${u.id}:`, err.message);
                        }
                    }
                }
                console.log(`[notifyTelegramDelayCreated] Blocker notification sent to ${sent} users.`);
                return { success: true, sent };
            } catch (err) {
                console.error("[notifyTelegramDelayCreated] Error sending blocker notification:", err);
                throw new HttpsError("internal", err.message);
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

    return { telegramWebhookEndpoint, linkTelegramUser, notifyTelegramDelayCreated, quickReportApi, setupQuickReportMenuButton };
}

module.exports = { createTelegramExports };
