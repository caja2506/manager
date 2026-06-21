/**
 * ARIA Agent — Proactive Engine (Heartbeat)
 * ===========================================
 * Runs every 15 minutes via the unified scheduler.
 * Evaluates all proactive rules against live data and sends
 * targeted nudge messages to users via Telegram.
 *
 * ═══ REGLA DE COSTO ═══════════════════════════════════════════════
 *  ✅ NVIDIA NIM  — gratis, usado OPCIONALMENTE para personalizar
 *  ❌ Gemini      — NUNCA en el heartbeat (riesgo de bucle de costo)
 * ══════════════════════════════════════════════════════════════════
 *
 * Flow per tick:
 * 1. Load all active users, tasks, timeLogs from Supabase
 * 2. Evaluate each rule → generate candidate nudges
 * 3. For each candidate: check nudge tracker (cooldown/anti-spam)
 * 4. Optionally personalize message with NVIDIA (timeout 8s)
 *    → If NVIDIA fails/slow: use static template (never Gemini)
 * 5. Send via Telegram Bot API
 * 6. Record nudge in tracker
 */

const { RULES, buildNudgeMessage } = require("./proactiveRules");
const { wasSentRecently, recordNudge, getDailyNudgeCount } = require("./nudgeTracker");

// Max nudges per user per day to prevent overwhelming people
const MAX_NUDGES_PER_USER_PER_DAY = 3;

// DeepSeek-only timeout for heartbeat personalization (short, no Gemini fallback)
const DEEPSEEK_PERSONALIZATION_TIMEOUT_MS = 8000;

/**
 * Send a message to a Telegram chat ID.
 * Reuses the proven telegramClient module that works in the rest of the app.
 * @param {string} token
 * @param {string} chatId
 * @param {string} text - HTML formatted
 */
async function sendTelegramMessage(token, chatId, text) {
    const { sendMessage } = require("../telegram/telegramClient");
    const result = await sendMessage(token, chatId, text, { parseMode: "HTML" });
    if (!result.ok) {
        throw new Error(`Telegram sendMessage failed: ${result.error}`);
    }
    return result;
}

/**
 * OPTIONAL: Use DeepSeek to add a personal touch to the nudge.
 * Short timeout — if DeepSeek doesn't respond in time, return null and use static template.
 * NEVER falls back to Gemini.
 *
 * @param {string} deepseekKey
 * @param {string} baseMessage - Static template message
 * @param {Object} context - { userName, taskTitle, etc. }
 * @returns {Promise<string|null>} Personalized message, or null if DeepSeek unavailable
 */
async function personalizeWithAI(deepseekKey, baseMessage, context) {
    // Note: deepseekKey can fall back to our hardcoded fallback if not provided
    const key = deepseekKey || require("../ai/deepseekClient").DEEPSEEK_API_KEY_FALLBACK;
    if (!key) return null;

    try {
        const { callDeepSeek } = require("../ai/deepseekClient");

        const result = await callDeepSeek(key, {
            messages: [
                {
                    role: "system",
                    content: `Eres ARIA, asistente de AutoBOM Pro. Toma este recordatorio y hazlo más humano y natural en español. 
REGLAS ESTRICTAS:
- Máximo 3 oraciones. No agregar información nueva.
- Mantén el mismo significado y datos del mensaje original.
- Usa formato HTML de Telegram: solo <b>, <i>. Nunca uses *.
- Tono: directo, amable, profesional. No infantil.
- Al final incluye siempre esta línea: <i>🤖 ARIA — AutoBOM Pro</i>`,
                },
                {
                    role: "user",
                    content: `Mensaje original:\n${baseMessage}`,
                },
            ],
            maxTokens: 300,
            temperature: 0.3,
            timeoutMs: DEEPSEEK_PERSONALIZATION_TIMEOUT_MS,
        });

        if (result.ok && result.text && result.text.trim().length > 20) {
            return result.text.trim();
        }
        return null;
    } catch (err) {
        // Silent fail — caller will use static template
        console.warn("[proactiveEngine] DeepSeek personalization failed (using static):", err.message);
        return null;
    }
}

/**
 * Main evaluation loop. Called by the heartbeat handler every 15 minutes.
 *
 * @param {Object} options
 * @param {string} options.telegramToken
 * @param {string|null} options.nvidiaKey - Optional (compatibility only)
 * @param {string|null} options.deepseekKey - Optional, for personalization
 * @param {Object|null} [options.adminDb] - Firestore admin instance (for Telegram session lookup)
 * @returns {Promise<{sent: number, skipped: number, errors: number}>}
 */
async function evaluate({ telegramToken, nvidiaKey, deepseekKey, adminDb }) {
    const tag = "[proactiveEngine]";
    const coreReader = require("../db/coreDataReader");

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    try {
        // ── 1. Load data from Supabase via coreDataReader (returns camelCase) ──
        console.log(`${tag} Loading team data...`);

        const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });

        const [allUsers, tasks, timeLogs, plannerDailyTasks, weeklyPlanItems] = await Promise.all([
            coreReader.loadAllUsers(),
            coreReader.loadAllTasks(),
            // Last 7 days of time logs only
            (async () => {
                const { getSupabase } = require("../db/supabaseAdmin");
                const sb = getSupabase();
                const { data } = await sb.from("time_logs")
                    .select("id, task_id, user_id, start_time, end_time, total_hours")
                    .gte("start_time", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());
                const { mapRows } = require("../db/supabaseAdmin");
                return mapRows(data || []);
            })(),
            // planner_daily_tasks for today
            (async () => {
                const { getSupabase, mapRows } = require("../db/supabaseAdmin");
                const sb = getSupabase();
                const { data, error } = await sb.from("planner_daily_tasks")
                    .select("*")
                    .eq("date", todayStr);
                if (error) {
                    console.error("[proactiveEngine] Error loading planner_daily_tasks:", error.message);
                    return [];
                }
                return mapRows(data || []);
            })(),
            // weeklyPlanItems for today
            (async () => {
                try {
                    return await coreReader.loadWeeklyPlanItemsForDate(todayStr);
                } catch (e) {
                    console.warn("[proactiveEngine] Error loading weeklyPlanItems:", e.message);
                    return [];
                }
            })(),
        ]);

        // ── 2. Build userId→chatId map from Supabase telegram_sessions ──
        // This is the authoritative source for Telegram links.
        const { getSupabase } = require("../db/supabaseAdmin");
        const sb = getSupabase();
        let telegramMap = {}; // userId → chatId
        try {
            const { data: sessions, error } = await sb.from("telegram_sessions")
                .select("user_id, chat_id")
                .not("user_id", "is", null);
            if (!error && sessions) {
                for (const s of sessions) {
                    telegramMap[s.user_id] = String(s.chat_id);
                }
            }
            console.log(`${tag} ${Object.keys(telegramMap).length} users with Telegram chatId from Supabase`);
        } catch (e) {
            console.warn(`${tag} Could not load Supabase sessions:`, e.message);
        }

        // Merge telegramChatId into user objects
        const users = allUsers
            .filter(u => u.active !== false)
            .map(u => ({
                ...u,
                displayName: u.displayName || u.display_name || u.email,
                telegramChatId: telegramMap[u.id] || null,
            }))
            .filter(u => u.telegramChatId); // Only users with Telegram linked

        console.log(`${tag} ${users.length} users with Telegram, ${tasks.length} tasks, ${timeLogs.length} recent timeLogs`);

        if (users.length === 0) {
            console.log(`${tag} No users with Telegram linked — skipping evaluation`);
            return { sent: 0, skipped: 0, errors: 0 };
        }

        const data = { users, tasks, timeLogs, weeklyPlanItems, plannerDailyTasks };

        // ── 2. Evaluate all rules ──
        const allCandidates = [];
        for (const rule of RULES) {
            try {
                const candidates = rule.evaluate(data);
                for (const c of candidates) {
                    allCandidates.push({ ...c, ruleKey: rule.key, cooldownHours: rule.cooldownHours });
                }
            } catch (ruleErr) {
                console.error(`${tag} Rule ${rule.key} evaluation error:`, ruleErr.message);
                errors++;
            }
        }

        console.log(`${tag} ${allCandidates.length} candidate nudges from ${RULES.length} rules`);

        // ── 3. Filter: anti-spam and daily cap ──
        const sentUsersInThisRun = new Set();
        for (const candidate of allCandidates) {
            const { userId, chatId, ruleKey, targetId, cooldownHours, templateKey, templateVars } = candidate;

            if (!chatId) {
                skipped++;
                continue;
            }

            // Limit to at most 1 nudge per user per run to prevent flood/spam
            if (sentUsersInThisRun.has(userId)) {
                console.log(`${tag} [${ruleKey}] Skip user ${userId}: already sent a nudge in this run`);
                skipped++;
                continue;
            }

            // Daily cap per user
            const todayCount = await getDailyNudgeCount(userId);
            if (todayCount >= MAX_NUDGES_PER_USER_PER_DAY) {
                console.log(`${tag} [${ruleKey}] Skip user ${userId}: daily cap reached (${todayCount}/${MAX_NUDGES_PER_USER_PER_DAY})`);
                skipped++;
                continue;
            }

            // Cooldown check
            const alreadySent = await wasSentRecently(userId, ruleKey, targetId, cooldownHours);
            if (alreadySent) {
                console.log(`${tag} [${ruleKey}] Skip user ${userId} target ${targetId}: within cooldown (${cooldownHours}h)`);
                skipped++;
                continue;
            }

            // ── 4. Build message (static template, then optional NVIDIA personalization) ──
            let message = buildNudgeMessage(templateKey, templateVars);

            // Try DeepSeek personalization (optional, no Gemini fallback)
            const personalized = await personalizeWithAI(deepseekKey, message, templateVars);
            if (personalized) {
                message = personalized;
                console.log(`${tag} [${ruleKey}] DeepSeek personalized message for ${userId}`);
            } else {
                // Append ARIA signature to static template
                message += `\n\n<i>🤖 ARIA — AutoBOM Pro</i>`;
            }

            // ── 5. Send via Telegram ──
            try {
                console.log(`${tag} [${ruleKey}] Sending to chatId=${chatId} user=${userId} token=...${(telegramToken || "").slice(-6)}`);
                let sendResult;
                if (candidate.inlineKeyboard) {
                    const { sendMessageWithKeyboard } = require("../telegram/telegramClient");
                    sendResult = await sendMessageWithKeyboard(telegramToken, chatId, message, candidate.inlineKeyboard);
                } else {
                    sendResult = await sendTelegramMessage(telegramToken, chatId, message);
                }

                if (!sendResult.ok) {
                    throw new Error(sendResult.error || "Unknown error");
                }

                // Record nudge with Telegram messageId for reply-tracking
                await recordNudge(userId, ruleKey, targetId, message, {
                    chatId,
                    telegramMessageId: sendResult.messageId || null,
                });
                console.log(`${tag} [${ruleKey}] ✅ Sent to user ${userId} (target: ${targetId}, msgId: ${sendResult.messageId})`);
                sentUsersInThisRun.add(userId);
                sent++;
            } catch (sendErr) {
                console.error(`${tag} [${ruleKey}] Send failed for ${userId} (chatId=${chatId}):`, sendErr.message);
                errors++;
            }
        }

    } catch (err) {
        console.error(`${tag} Fatal evaluation error:`, err.message);
        errors++;
    }

    console.log(`${tag} Tick complete — sent=${sent} skipped=${skipped} errors=${errors}`);
    return { sent, skipped, errors };
}

module.exports = { evaluate };
