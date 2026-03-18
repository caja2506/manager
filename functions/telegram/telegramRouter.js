/**
 * Telegram Router — Backend (CJS) — Phase 3
 * =============================================
 * Routes inbound messages by session state and commands.
 * Now supports AI-powered text extraction, audio processing,
 * and confidence-based confirmation flows.
 */

const { sendMessage, sendMessageWithKeyboard, sendMessageWithReplyKeyboard, answerCallbackQuery } = require("./telegramClient");
const { parseReportText, parseCommand } = require("./telegramParsers");
const templates = require("./telegramTemplates");
const {
    getOrCreateSession,
    transitionState,
    findUserByChatId,
    logBotEvent,
} = require("./telegramSessionService");
const { createDelivery, markResponded } = require("./telegramDeliveryTracker");
const { incrementTodayMetrics } = require("../automation/metricsUpdater");
const paths = require("../automation/firestorePaths");
const {
    TELEGRAM_SESSION_STATE,
    TELEGRAM_SESSION_EVENT,
    TELEGRAM_BOT_LOG_EVENT,
    REPORT_STATUS,
    AUTOMATION_CHANNELS,
} = require("../automation/constants");

// AI services
const { extractFromText } = require("../ai/aiExtractionService");
const { classifyIncident } = require("../ai/aiIncidentClassifier");
const { processVoiceMessage } = require("./telegramVoiceHandler");
const { CONFIRMATION_MESSAGE } = require("../ai/aiPromptRegistry");
const { loadAIConfig } = require("../ai/aiBriefingService");

/**
 * Main routing function for inbound Telegram messages.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} token - Bot token
 * @param {string|number} chatId
 * @param {string|null} text - Message text (null for audio)
 * @param {Object} rawMessage - Original Telegram message object
 * @param {Object} [extras] - { inputType, apiKey }
 */
async function routeInboundMessage(adminDb, token, chatId, text, rawMessage, extras = {}) {
    const chatIdStr = String(chatId);
    const isAudio = extras.inputType === "audio";

    // Log inbound
    await logBotEvent(adminDb, chatIdStr, TELEGRAM_BOT_LOG_EVENT.MESSAGE_RECEIVED, {
        text: text?.substring(0, 200),
        messageId: rawMessage?.message_id,
        inputType: isAudio ? "audio" : "text",
    });

    // Create inbound delivery record
    await createDelivery(adminDb, {
        chatId: chatIdStr,
        direction: "inbound",
        messageText: isAudio ? "[audio]" : (text?.substring(0, 500) || ""),
        routineKey: "webhook_inbound",
    });

    // Get session + user
    const session = await getOrCreateSession(adminDb, chatIdStr);
    const userId = session.userId || await findUserByChatId(adminDb, chatIdStr);

    // ── Map persistent keyboard button text to commands ──
    if (text) {
        const buttonMap = {
            "📝 Reportar": "/report",
            "📊 Status": "/status",
            "❓ Ayuda": "/help",
            "🔄 Reiniciar": "/reset",
            "⚡ Quick Report": "/quickreport",
        };
        const mappedText = buttonMap[text.trim()] || text;

        const cmd = parseCommand(mappedText);
        if (cmd.isCommand) {
            await handleCommand(adminDb, token, chatIdStr, userId, cmd, session);
            return;
        }
    }

    // ── Route by session state ──
    if (!userId) {
        await sendMessage(token, chatIdStr, templates.unknownUserMessage());
        return;
    }

    switch (session.currentState) {
        case TELEGRAM_SESSION_STATE.AWAITING_DAILY_REPORT:
            if (isAudio) {
                await handleAudioReport(adminDb, token, chatIdStr, userId, rawMessage, session, extras);
            } else {
                await handleReportSubmission(adminDb, token, chatIdStr, userId, text, session, extras);
            }
            break;

        case TELEGRAM_SESSION_STATE.AWAITING_REPORT_CONFIRMATION:
            await handleReportConfirmation(adminDb, token, chatIdStr, userId, text, session);
            break;

        case TELEGRAM_SESSION_STATE.AWAITING_BLOCK_CAUSE:
            await handleBlockCause(adminDb, token, chatIdStr, userId, text, session, extras);
            break;

        // ── Task-linked report flow states ──
        case TELEGRAM_SESSION_STATE.CREATING_TASK:
            await handleCreateTask(adminDb, token, chatIdStr, userId, text, session, isAudio ? rawMessage : null, extras);
            break;

        case TELEGRAM_SESSION_STATE.AWAIT_REPORT_FOR_TASK:
            if (isAudio) {
                await handleTaskReportAudio(adminDb, token, chatIdStr, userId, rawMessage, session, extras);
            } else {
                await handleTaskReportText(adminDb, token, chatIdStr, userId, text, session, extras);
            }
            break;

        case TELEGRAM_SESSION_STATE.ASKING_MORE_TASKS: {
            const answer = text?.toLowerCase().trim();
            if (answer === "sí" || answer === "si" || answer === "s") {
                await transitionState(adminDb, chatIdStr, TELEGRAM_SESSION_EVENT.MORE_TASKS_YES);
                await showTaskSelectionKeyboard(adminDb, token, chatIdStr, userId);
            } else if (answer === "no" || answer === "n") {
                await transitionState(adminDb, chatIdStr, TELEGRAM_SESSION_EVENT.MORE_TASKS_NO);
                await showDaySummaryAndAskOvertime(adminDb, token, chatIdStr, userId, session);
            } else {
                await sendMessage(token, chatIdStr, "Responde <b>Sí</b> o <b>No</b> 🙂");
            }
            break;
        }

        case TELEGRAM_SESSION_STATE.ASKING_OVERTIME: {
            const otAnswer = text?.toLowerCase().trim();
            if (otAnswer === "sí" || otAnswer === "si" || otAnswer === "s") {
                await transitionState(adminDb, chatIdStr, TELEGRAM_SESSION_EVENT.OVERTIME_YES);
                await sendMessage(token, chatIdStr, "⏱️ ¿Cuántas horas extra trabajaste?\n\nEjemplo: <b>2</b> o <b>1.5</b>");
            } else if (otAnswer === "no" || otAnswer === "n") {
                await transitionState(adminDb, chatIdStr, TELEGRAM_SESSION_EVENT.OVERTIME_NO);
                await sendMessage(token, chatIdStr, "✅ ¡Reporte del día completo! Buen trabajo 💪");
            } else {
                await sendMessage(token, chatIdStr, "Responde <b>Sí</b> o <b>No</b> 🙂");
            }
            break;
        }

        case TELEGRAM_SESSION_STATE.AWAIT_OVERTIME_HOURS: {
            const otHours = parseFloat(text?.trim());
            if (isNaN(otHours) || otHours <= 0 || otHours > 24) {
                await sendMessage(token, chatIdStr, "⚠️ Ingresa un número válido de horas (ej: <b>2</b> o <b>1.5</b>)");
            } else {
                // Save overtime hours in session metadata and show task selection
                await adminDb.collection(paths.TELEGRAM_SESSIONS).doc(session.id).update({
                    "metadata.overtimeHours": otHours,
                    updatedAt: new Date().toISOString(),
                });
                await transitionState(adminDb, chatIdStr, TELEGRAM_SESSION_EVENT.OVERTIME_HOURS_ENTERED);
                await showOvertimeTaskKeyboard(adminDb, token, chatIdStr, session);
            }
            break;
        }

        case TELEGRAM_SESSION_STATE.SELECTING_TASK:
        case TELEGRAM_SESSION_STATE.SELECTING_OVERTIME_TASK:
            // These states expect button presses (callback_query), not text
            await sendMessage(token, chatIdStr, "👆 Selecciona una tarea tocando uno de los botones de arriba.");
            break;

        case TELEGRAM_SESSION_STATE.IDLE:
        default:
            if (isAudio) {
                await sendMessageWithReplyKeyboard(token, chatIdStr,
                    "🎙️ Recibí tu nota de voz, pero no estoy esperando un reporte.\nToca <b>📝 Reportar</b> para iniciar."
                );
            } else {
                await sendMessageWithReplyKeyboard(token, chatIdStr,
                    "📬 Mensaje recibido. Usa los botones del menú para interactuar."
                );
            }
            break;
    }

    // Update metrics
    try {
        await incrementTodayMetrics(adminDb, AUTOMATION_CHANNELS.TELEGRAM, {
            responsesReceived: 1,
        });
    } catch (e) {
        console.warn("[telegramRouter] Metrics error:", e.message);
    }
}

/**
 * Handle bot commands.
 */
async function handleCommand(adminDb, token, chatId, userId, cmd, session) {
    switch (cmd.command) {
        case "start":
            await sendMessageWithReplyKeyboard(token, chatId, templates.welcomeMessage());
            break;

        case "help":
            await sendMessage(token, chatId, templates.helpMessage());
            break;

        case "status": {
            if (!userId) {
                await sendMessage(token, chatId, templates.unknownUserMessage());
                return;
            }
            const userDoc = await adminDb.collection(paths.USERS).doc(userId).get();
            const user = userDoc.exists ? userDoc.data() : {};
            await sendMessage(token, chatId, templates.statusMessage({
                name: user.name || "Usuario",
                role: user.operationalRole || user.teamRole || "No asignado",
                sessionState: session.currentState,
                lastReport: null,
            }));
            break;
        }

        case "report": {
            if (!userId) {
                await sendMessage(token, chatId, templates.unknownUserMessage());
                return;
            }

            // Force reset if stuck in any state
            if (session.currentState !== TELEGRAM_SESSION_STATE.IDLE) {
                await forceResetSession(adminDb, chatId);
            }

            // Fetch user's active tasks
            await showTaskSelectionKeyboard(adminDb, token, chatId, userId);
            break;
        }

        case "reset":
        case "cancel": {
            await forceResetSession(adminDb, chatId);
            await sendMessage(token, chatId,
                "🔄 Sesión reiniciada. Ya puedes usar /report para iniciar un nuevo reporte."
            );
            break;
        }

        case "link": {
            if (!cmd.args) {
                await sendMessage(token, chatId,
                    "📎 Para vincular tu cuenta, escribe:\n\n<code>/link TU_CÓDIGO</code>\n\nPide el código a tu administrador."
                );
                return;
            }
            try {
                const { validateAndConsumeLinkCode } = require("../handlers/teamManagementHandler");
                const result = await validateAndConsumeLinkCode(adminDb, cmd.args, chatId);
                if (result.valid) {
                    await sendMessage(token, chatId, templates.linkSuccess({
                        name: result.userName,
                        role: result.userRole,
                    }));
                    await logBotEvent(adminDb, chatId, TELEGRAM_BOT_LOG_EVENT.IDENTITY_LINKED, {
                        userId: result.userId,
                        method: "link_code",
                    });
                } else {
                    const errorMsgs = {
                        code_not_found: "❌ Código no encontrado. Verifica que esté escrito correctamente.",
                        code_already_used: "⚠️ Este código ya fue utilizado. Pide uno nuevo a tu administrador.",
                        code_expired: "⏰ Este código ha expirado (24h). Pide uno nuevo a tu administrador.",
                        user_not_found: "❌ Error interno: usuario no encontrado. Contacta al administrador.",
                    };
                    await sendMessage(token, chatId, errorMsgs[result.error] || `❌ Error: ${result.error}`);
                }
            } catch (err) {
                console.error("[router] /link error:", err);
                await sendMessage(token, chatId, "❌ Error al vincular. Intenta de nuevo o contacta al administrador.");
            }
            break;
        }

        case "quickreport": {
            // Send inline button that opens as Mini App inside Telegram
            const WEBAPP_URL = "https://bom-ame-cr.web.app/tg-report";
            const reportUrl = `${WEBAPP_URL}?chatId=${chatId}`;
            await sendMessageWithKeyboard(token, chatId,
                "⚡ <b>Quick Report</b>\n\nToca el botón para reportar tu avance:",
                [[{ text: "📝 Abrir Quick Report", web_app: { url: reportUrl } }]]
            );
            break;
        }

        default:
            await sendMessage(token, chatId,
                `❌ Comando /${cmd.command} no reconocido. Usa /help para ver los comandos disponibles.`
            );
            break;
    }
}

/**
 * Handle text report submission with AI extraction.
 */
async function handleReportSubmission(adminDb, token, chatId, userId, text, session, extras = {}) {
    const now = new Date().toISOString();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    const userName = await getUserName(adminDb, userId);

    // Check if AI is enabled
    const aiConfig = await loadAIConfig(adminDb);
    const useAI = aiConfig?.enabled && extras.apiKey;

    let extracted, action, source;

    if (useAI) {
        // AI-powered extraction
        const result = await extractFromText(adminDb, extras.apiKey, text, { userId });
        extracted = result.extracted;
        action = result.action;
        source = result.source;
    } else {
        // Deterministic fallback (Phase 2 parser)
        const parsed = parseReportText(text);
        if (!parsed.valid) {
            await sendMessage(token, chatId, templates.reportFormatError());
            return;
        }
        extracted = {
            progressPercent: parsed.data.progressPercent,
            hoursWorked: parsed.data.hoursWorked,
            blockerPresent: !!parsed.data.blocker,
            blockerSummary: parsed.data.blocker || null,
            normalizedSummary: `Avance: ${parsed.data.progressPercent}%, Horas: ${parsed.data.hoursWorked}`,
            confidenceScore: 0.95,
            needsConfirmation: false,
        };
        action = "accept";
        source = "deterministic";
    }

    // ── Confidence gating ──
    if (action === "confirm") {
        // Store pending data in session metadata and ask for confirmation
        await adminDb.collection(paths.TELEGRAM_SESSIONS).doc(session.id).update({
            metadata: { pendingExtraction: extracted, rawText: text, inputType: "text" },
            updatedAt: now,
        });
        await transitionState(adminDb, chatId, TELEGRAM_SESSION_EVENT.REPORT_SUBMITTED);

        const confirmMsg = CONFIRMATION_MESSAGE.buildMessage(extracted);
        await sendMessage(token, chatId, confirmMsg);
        return;
    }

    if (action === "fallback" && source === "fallback") {
        // Fallback couldn't extract either → ask for structured format
        if (!extracted.progressPercent && !extracted.hoursWorked) {
            await sendMessage(token, chatId,
                "⚠️ No pude interpretar tu reporte. Por favor usa el formato:\n\n" +
                "<b>Avance: 75%</b>\n<b>Horas: 8</b>\n<b>Bloqueo: ninguno</b>"
            );
            return;
        }
    }

    // ── Accept: save report ──
    await saveReport(adminDb, token, chatId, userId, userName, {
        inputType: source === "ai" ? "text_ai" : "text",
        rawText: text,
        extracted,
        today,
        now,
    });
}

/**
 * Handle audio report — transcription + extraction.
 */
async function handleAudioReport(adminDb, token, chatId, userId, message, session, extras = {}) {
    const now = new Date().toISOString();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    const userName = await getUserName(adminDb, userId);

    // Check AI config
    const aiConfig = await loadAIConfig(adminDb);
    if (!aiConfig?.enabled || !aiConfig?.allowAudioProcessing || !extras.apiKey) {
        await sendMessage(token, chatId,
            "🎙️ El procesamiento de audio no está habilitado en este momento.\nPor favor envía tu reporte como texto."
        );
        return;
    }

    // Send processing indicator
    await sendMessage(token, chatId, "🔄 <i>Procesando tu nota de voz...</i>");

    // Process audio
    const result = await processVoiceMessage(
        token, extras.apiKey, adminDb, message,
        { userId, chatId }
    );

    if (result.action === "fallback" || result.error) {
        await sendMessage(token, chatId,
            "⚠️ No pude procesar tu nota de voz. Por favor envía tu reporte como texto:\n\n" +
            "<b>Avance: 75%</b>\n<b>Horas: 8</b>\n<b>Bloqueo: ninguno</b>"
        );
        return;
    }

    // Show transcript preview if available
    if (result.transcript) {
        await sendMessage(token, chatId,
            `🎙️ <b>Transcripción:</b>\n<i>${result.transcript.substring(0, 300)}</i>`
        );
    }

    // Confidence gating
    if (result.action === "confirm") {
        await adminDb.collection(paths.TELEGRAM_SESSIONS).doc(session.id).update({
            metadata: {
                pendingExtraction: result.extracted,
                rawText: result.transcript || "[audio]",
                inputType: "audio",
            },
            updatedAt: now,
        });
        await transitionState(adminDb, chatId, TELEGRAM_SESSION_EVENT.REPORT_SUBMITTED);

        const confirmMsg = CONFIRMATION_MESSAGE.buildMessage(result.extracted);
        await sendMessage(token, chatId, confirmMsg);
        return;
    }

    // Accept
    await saveReport(adminDb, token, chatId, userId, userName, {
        inputType: "audio_ai",
        rawText: result.transcript || "[audio]",
        extracted: result.extracted,
        today,
        now,
    });

    // Audio metrics
    await incrementTodayMetrics(adminDb, AUTOMATION_CHANNELS.TELEGRAM, {
        audioProcessedCount: 1,
    }).catch(() => { });
}

/**
 * Handle confirmation response (Sí/No).
 */
async function handleReportConfirmation(adminDb, token, chatId, userId, text, session) {
    const now = new Date().toISOString();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    const userName = await getUserName(adminDb, userId);
    const lower = (text || "").toLowerCase().trim();

    const isYes = ["sí", "si", "yes", "ok", "confirmo", "correcto", "1"].includes(lower);
    const isNo = ["no", "nope", "negativo", "incorrecto", "0"].includes(lower);

    if (isYes) {
        const pending = session.metadata?.pendingExtraction;
        if (!pending) {
            await sendMessage(token, chatId, "⚠️ No hay datos pendientes de confirmación.");
            await transitionState(adminDb, chatId, TELEGRAM_SESSION_EVENT.RESET);
            return;
        }

        // Save confirmed report
        await saveReport(adminDb, token, chatId, userId, userName, {
            inputType: session.metadata?.inputType || "text_ai",
            rawText: session.metadata?.rawText || "",
            extracted: pending,
            today,
            now,
            confirmed: true,
        });

        // Update metrics
        await incrementTodayMetrics(adminDb, AUTOMATION_CHANNELS.TELEGRAM, {
            aiExtractionsAccepted: 1,
        }).catch(() => { });

    } else if (isNo) {
        // Rejected — ask for structured format
        await transitionState(adminDb, chatId, TELEGRAM_SESSION_EVENT.REPORT_REJECTED);
        await sendMessage(token, chatId,
            "📝 Entendido. Por favor envía tu reporte en formato estructurado:\n\n" +
            "<b>Avance: 75%</b>\n<b>Horas: 8</b>\n<b>Bloqueo: ninguno</b>"
        );

        // Metrics
        await incrementTodayMetrics(adminDb, AUTOMATION_CHANNELS.TELEGRAM, {
            aiExtractionsRejected: 1,
        }).catch(() => { });

    } else {
        await sendMessage(token, chatId,
            "Por favor responde <b>Sí</b> o <b>No</b> para confirmar tu reporte."
        );
    }
}

/**
 * Handle block cause text with AI classification.
 */
async function handleBlockCause(adminDb, token, chatId, userId, text, session, extras = {}) {
    const now = new Date().toISOString();

    // Check if AI classification is available
    const aiConfig = await loadAIConfig(adminDb);
    const useAI = aiConfig?.enabled && extras.apiKey;

    let classification;
    if (useAI) {
        const result = await classifyIncident(adminDb, extras.apiKey, text, { userId });
        classification = result.classification;

        // If needs confirmation and not auto-accept
        if (result.action === "confirm" && classification.needsConfirmation) {
            await sendMessage(token, chatId,
                `🔍 <b>Detecté lo siguiente:</b>\n\n` +
                `▪️ Bloqueo: ${classification.isBlocker ? "Sí" : "No"}\n` +
                `▪️ Causa: ${classification.suggestedCause || "No identificada"}\n` +
                `▪️ Severidad: ${classification.suggestedSeverity}\n\n` +
                `¿Deseas registrar este bloqueo? Responde <b>Sí</b> o <b>No</b>.`
            );
            return;
        }
    } else {
        classification = {
            isBlocker: true,
            summary: text.substring(0, 200),
            suggestedSeverity: "medium",
        };
    }

    // Create incident
    await adminDb.collection(paths.OPERATION_INCIDENTS).add({
        incidentType: "blocker",
        channel: "telegram",
        provider: "telegram_bot",
        userId,
        title: `Bloqueo reportado por ${userId}`,
        description: text,
        cause: classification.suggestedCause || text,
        status: "open",
        severity: classification.suggestedSeverity || "medium",
        aiClassified: useAI,
        aiConfidence: classification.confidenceScore || null,
        reportedVia: "telegram",
        reportedAt: now,
        resolvedAt: null,
        createdAt: now,
        updatedAt: now,
    });

    // Transition
    await transitionState(adminDb, chatId, TELEGRAM_SESSION_EVENT.BLOCK_CAUSE_RECEIVED);

    await sendMessage(token, chatId,
        "✅ <b>Bloqueo registrado</b>\n\n" +
        "Tu reporte de bloqueo ha sido registrado en el sistema. " +
        "Tu responsable será notificado."
    );

    // Metrics
    await incrementTodayMetrics(adminDb, AUTOMATION_CHANNELS.TELEGRAM, {
        incidentsOpened: 1,
    });
}
// ── Helpers ──

async function getUserName(adminDb, userId) {
    if (!userId) return "Usuario";
    try {
        // Try 'users' collection first
        const userDoc = await adminDb.collection(paths.USERS).doc(userId).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            if (data.name) return data.name;
            if (data.displayName) return data.displayName;
            if (data.firstName) return `${data.firstName} ${data.lastName || ""}`.trim();
        }

        // Try 'users_roles' collection
        const roleDoc = await adminDb.collection(paths.USERS_ROLES).doc(userId).get();
        if (roleDoc.exists) {
            const data = roleDoc.data();
            if (data.name) return data.name;
            if (data.displayName) return data.displayName;
            if (data.email) return data.email.split("@")[0];
        }

        // Final fallback: Firebase Auth record
        const { getAuth } = require("firebase-admin/auth");
        const authUser = await getAuth().getUser(userId);
        if (authUser.displayName) return authUser.displayName;
        if (authUser.email) return authUser.email.split("@")[0];

        return "Usuario";
    } catch (err) {
        console.warn("[getUserName] Could not resolve name for userId:", userId, err.message);
        return "Usuario";
    }
}

/**
 * Legacy saveReport — used by old handleReportSubmission/Audio/Confirmation flows.
 */
async function saveReport(adminDb, token, chatId, userId, userName, data) {
    const { inputType, rawText, extracted, today, now, confirmed } = data;

    await adminDb.collection(paths.TELEGRAM_REPORTS).add({
        userId,
        chatId: String(chatId),
        date: today,
        inputType,
        rawText: rawText?.substring(0, 2000) || "",
        parsedData: extracted,
        progressPercent: extracted.progressPercent,
        hoursWorked: extracted.hoursWorked,
        blocker: extracted.blockerPresent ? (extracted.blockerSummary || "Sí") : null,
        blockerPresent: extracted.blockerPresent,
        normalizedSummary: extracted.normalizedSummary || "",
        aiConfidence: extracted.confidenceScore || null,
        status: REPORT_STATUS.RECEIVED,
        onTime: true,
        createdAt: now,
        updatedAt: now,
    });

    await transitionState(adminDb, chatId, TELEGRAM_SESSION_EVENT.REPORT_CONFIRMED);
    await markResponded(adminDb, chatId, "technician_evening_check");
    await sendMessage(token, chatId, templates.reportConfirmation({
        name: userName,
        progress: extracted.progressPercent,
        hours: extracted.hoursWorked,
        blocker: extracted.blockerPresent ? (extracted.blockerSummary || "Sí") : null,
    }));
    await transitionState(adminDb, chatId, TELEGRAM_SESSION_EVENT.RESET);
    await incrementTodayMetrics(adminDb, AUTOMATION_CHANNELS.TELEGRAM, {
        responsesOnTime: 1,
    }).catch(() => { });
}

// ── Task-linked report helpers ──

/**
 * Show task selection keyboard with inline buttons.
 */
async function showTaskSelectionKeyboard(adminDb, token, chatId, userId) {
    // Fetch active tasks for this user
    const tasksSnap = await adminDb.collection(paths.TASKS)
        .where("assignedTo", "==", userId)
        .get();

    const activeTasks = [];
    tasksSnap.forEach(doc => {
        const t = doc.data();
        const status = t.status || "pending";
        if (status !== "completed" && status !== "cancelled") {
            activeTasks.push({ id: doc.id, title: t.title || "Sin título", status });
        }
    });

    // Build inline keyboard — each task as a button row, + "Create new"
    const keyboard = activeTasks.slice(0, 8).map(task => {
        const icon = task.status === "blocked" ? "🚫" :
            task.status === "in_progress" ? "🔧" : "📋";
        return [{ text: `${icon} ${task.title.substring(0, 35)}`, callback_data: `task:${task.id}` }];
    });

    // Build keyboard with ❌ Cancelar
    keyboard.push([{ text: "➕ Crear tarea nueva", callback_data: "task:new" }]);
    keyboard.push([{ text: "❌ Cancelar", callback_data: "cancel" }]);

    const message = activeTasks.length > 0
        ? "📝 <b>¿En qué tarea trabajaste?</b>\n\nSelecciona una tarea:"
        : "📝 No tienes tareas asignadas.\n\nPuedes crear una nueva:";

    await sendMessageWithKeyboard(token, chatId, message, keyboard);
    await transitionState(adminDb, chatId, TELEGRAM_SESSION_EVENT.TASK_LIST_SHOWN);
}

/**
 * Show keyboard with today's reported tasks for overtime selection.
 */
async function showOvertimeTaskKeyboard(adminDb, token, chatId, session) {
    const reportedTasks = session.metadata?.reportedTasks || [];

    if (reportedTasks.length === 0) {
        await sendMessage(token, chatId, "⚠️ No hay tareas reportadas hoy para asignar overtime.");
        await forceResetSession(adminDb, chatId);
        return;
    }

    const keyboard = reportedTasks.map(rt => ([
        { text: `${rt.title.substring(0, 35)}`, callback_data: `overtime:${rt.taskId}` }
    ]));
    keyboard.push([{ text: "❌ Cancelar", callback_data: "cancel" }]);

    const hours = session.metadata?.overtimeHours || 0;
    await sendMessageWithKeyboard(
        token, chatId,
        `⏱️ <b>${hours}h extra</b> — ¿En qué tarea?`,
        keyboard
    );
}

/**
 * Handle callback queries from inline buttons.
 */
async function routeCallbackQuery(adminDb, token, chatId, callbackData, callbackQueryId, extras = {}) {
    const chatIdStr = String(chatId);
    const session = await getOrCreateSession(adminDb, chatIdStr);
    const userId = session.userId || await findUserByChatId(adminDb, chatIdStr);

    // Acknowledge the button press immediately
    await answerCallbackQuery(token, callbackQueryId);

    if (!userId) {
        await sendMessage(token, chatIdStr, "⚠️ No estás vinculado. Usa /link para conectar tu cuenta.");
        return;
    }

    // ── Task selection: "task:{taskId}" or "task:new" ──
    if (callbackData.startsWith("task:")) {
        const taskRef = callbackData.split(":")[1];

        if (taskRef === "new") {
            // Quick task creation
            await transitionState(adminDb, chatIdStr, TELEGRAM_SESSION_EVENT.CREATE_TASK_REQUESTED);
            await sendMessage(token, chatIdStr,
                "✏️ <b>Crear tarea nueva</b>\n\n" +
                "Escribe el nombre de la tarea por ✍️ texto o 🎤 audio:\n" +
                "Ejemplo: <i>Instalación de variador en línea 5</i>"
            );
            return;
        }

        // Selected an existing task
        const taskDoc = await adminDb.collection(paths.TASKS).doc(taskRef).get();
        if (!taskDoc.exists) {
            await sendMessage(token, chatIdStr, "⚠️ Tarea no encontrada. Intenta de nuevo.");
            return;
        }

        const taskData = taskDoc.data();

        // Store selected task in session metadata
        await adminDb.collection(paths.TELEGRAM_SESSIONS).doc(session.id).update({
            "metadata.selectedTaskId": taskRef,
            "metadata.selectedTaskTitle": taskData.title || "Sin título",
            updatedAt: new Date().toISOString(),
        });

        await transitionState(adminDb, chatIdStr, TELEGRAM_SESSION_EVENT.TASK_SELECTED);
        await sendMessage(token, chatIdStr,
            `📌 <b>Tarea:</b> ${taskData.title}\n\n` +
            "Envía tu reporte por 🎤 audio o ✍️ texto:\n" +
            "• <b>Avance</b> (%)\n" +
            "• <b>Horas</b> trabajadas\n" +
            "• ¿<b>Bloqueos</b>?"
        );
        return;
    }

    // ── More tasks: "more:yes" / "more:no" ──
    if (callbackData === "more:yes") {
        await transitionState(adminDb, chatIdStr, TELEGRAM_SESSION_EVENT.MORE_TASKS_YES);
        await showTaskSelectionKeyboard(adminDb, token, chatIdStr, userId);
        return;
    }
    if (callbackData === "more:no") {
        await transitionState(adminDb, chatIdStr, TELEGRAM_SESSION_EVENT.MORE_TASKS_NO);
        await showDaySummaryAndAskOvertime(adminDb, token, chatIdStr, userId, session);
        return;
    }

    // ── Overtime: "ot:yes" / "ot:no" ──
    if (callbackData === "ot:yes") {
        await transitionState(adminDb, chatIdStr, TELEGRAM_SESSION_EVENT.OVERTIME_YES);
        await sendMessage(token, chatIdStr, "⏱️ ¿Cuántas horas extra trabajaste?\n\nEjemplo: <b>2</b> o <b>1.5</b>");
        return;
    }
    if (callbackData === "ot:no") {
        await transitionState(adminDb, chatIdStr, TELEGRAM_SESSION_EVENT.OVERTIME_NO);
        await sendMessage(token, chatIdStr, "✅ ¡Reporte del día completo! Buen trabajo 💪");
        return;
    }

    // ── Cancel: reset to idle ──
    if (callbackData === "cancel") {
        await forceResetSession(adminDb, chatIdStr);
        await sendMessageWithReplyKeyboard(token, chatIdStr,
            "🔄 Sesión cancelada. Usa los botones del menú cuando estés listo."
        );
        return;
    }

    // ── Overtime task selection: "overtime:{taskId}" ──
    if (callbackData.startsWith("overtime:")) {
        const taskId = callbackData.split(":")[1];
        await handleOvertimeForTask(adminDb, token, chatIdStr, userId, taskId, session);
        return;
    }

    console.warn(`[callbackQuery] Unknown callback_data: ${callbackData}`);
}

/**
 * Backend equivalent of recalculateTaskHours:
 * Sum all timeLogs for a task and update task.actualHours.
 */
async function recalculateTaskHoursBackend(adminDb, taskId) {
    if (!taskId) return;
    try {
        const logsSnap = await adminDb.collection(paths.TIME_LOGS)
            .where("taskId", "==", taskId)
            .get();

        let totalHours = 0;
        logsSnap.forEach(doc => {
            const data = doc.data();
            if (data.totalHours && data.endTime) {
                totalHours += data.totalHours;
            }
        });

        totalHours = parseFloat(totalHours.toFixed(4));
        await adminDb.collection(paths.TASKS).doc(taskId).update({
            actualHours: totalHours,
            updatedAt: new Date().toISOString(),
        });
        console.log(`[recalculate] Task ${taskId} actualHours=${totalHours}`);
    } catch (err) {
        console.error("[recalculate] Error recalculating task hours:", err.message);
    }
}

/**
 * Handle quick task creation from text.
 */
async function handleCreateTask(adminDb, token, chatId, userId, text, session, rawMessage, extras) {
    let taskTitle = text;

    // If audio, transcribe first
    if (rawMessage && !text) {
        try {
            const result = await processVoiceMessage(
                token, extras.apiKey, adminDb, rawMessage,
                { userId, chatId }
            );
            taskTitle = result?.transcript || null;
        } catch (err) {
            console.error("[router] Audio transcription for task creation failed:", err);
        }
    }

    if (!taskTitle || taskTitle.trim().length < 3) {
        await sendMessage(token, chatId, "⚠️ Escribe un nombre válido para la tarea (mínimo 3 caracteres).");
        return;
    }

    // Create task in Firestore
    const now = new Date().toISOString();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    const taskRef = await adminDb.collection(paths.TASKS).add({
        title: taskTitle.trim(),
        assignedTo: userId,
        status: "in_progress",
        progress: 0,
        priority: "medium",
        createdAt: now,
        updatedAt: now,
        startDate: today,
        source: "telegram",
    });

    // Store in session
    await adminDb.collection(paths.TELEGRAM_SESSIONS).doc(session.id).update({
        "metadata.selectedTaskId": taskRef.id,
        "metadata.selectedTaskTitle": taskTitle.trim(),
        updatedAt: now,
    });

    await transitionState(adminDb, chatId, TELEGRAM_SESSION_EVENT.TASK_CREATED);
    await sendMessage(token, chatId,
        `✅ Tarea creada: <b>${taskTitle.trim()}</b>\n\n` +
        "Ahora envía tu reporte por 🎤 audio o ✍️ texto:\n" +
        "• <b>Avance</b> (%) • <b>Horas</b> • ¿<b>Bloqueos</b>?"
    );
}

/**
 * Handle text report for a specific task.
 */
async function handleTaskReportText(adminDb, token, chatId, userId, text, session, extras) {
    const now = new Date().toISOString();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    const userName = await getUserName(adminDb, userId);
    const taskId = session.metadata?.selectedTaskId;
    const taskTitle = session.metadata?.selectedTaskTitle || "Tarea";

    // AI or parser extraction
    const aiConfig = await loadAIConfig(adminDb);
    const useAI = aiConfig?.enabled && extras.apiKey;

    let extracted;
    if (useAI) {
        const result = await extractFromText(adminDb, extras.apiKey, text, { userId });
        extracted = result.extracted;
    } else {
        const parsed = parseReportText(text);
        if (!parsed.valid) {
            await sendMessage(token, chatId,
                "⚠️ No pude interpretar tu reporte. Usa el formato:\n\n" +
                "<b>Avance: 75%</b>\n<b>Horas: 8</b>\n<b>Bloqueo: ninguno</b>"
            );
            return;
        }
        extracted = {
            progressPercent: parsed.data.progressPercent,
            hoursWorked: parsed.data.hoursWorked,
            blockerPresent: !!parsed.data.blocker,
            blockerSummary: parsed.data.blocker || null,
            normalizedSummary: `Avance: ${parsed.data.progressPercent}%, Horas: ${parsed.data.hoursWorked}`,
            confidenceScore: 0.95,
        };
    }

    await saveTaskReport(adminDb, token, chatId, userId, userName, {
        taskId, taskTitle, inputType: useAI ? "text_ai" : "text",
        rawText: text, extracted, today, now,
    });
}

/**
 * Handle audio report for a specific task.
 */
async function handleTaskReportAudio(adminDb, token, chatId, userId, rawMessage, session, extras) {
    const now = new Date().toISOString();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    const userName = await getUserName(adminDb, userId);
    const taskId = session.metadata?.selectedTaskId;
    const taskTitle = session.metadata?.selectedTaskTitle || "Tarea";

    try {
        const result = await processVoiceMessage(
            token, extras.apiKey, adminDb, rawMessage,
            { userId, chatId }
        );

        // Show transcript if available (even if extraction partially failed)
        if (result.transcript) {
            await sendMessage(token, chatId,
                `🎙️ <b>Transcripción:</b>\n<i>${result.transcript.substring(0, 300)}</i>`
            );
        }

        // If no extracted data at all, fall back
        if (!result?.extracted || (result.extracted.progressPercent == null && result.extracted.hoursWorked == null)) {
            await sendMessage(token, chatId,
                "⚠️ No pude extraer datos del audio. Envía tu reporte por texto:\n\n" +
                "<b>Avance: 75%</b>\n<b>Horas: 8</b>\n<b>Bloqueo: ninguno</b>"
            );
            return;
        }

        await saveTaskReport(adminDb, token, chatId, userId, userName, {
            taskId, taskTitle, inputType: "audio_ai",
            rawText: result.transcript || "[audio]", extracted: result.extracted, today, now,
        });
    } catch (err) {
        console.error("[router] Audio task report failed:", err.message, err.stack);
        await sendMessage(token, chatId,
            `⚠️ Error guardando reporte: ${err.message?.substring(0, 100) || "desconocido"}.\nIntenta por texto.`
        );
    }
}

/**
 * Save task-linked report: telegramReports + timeLog + update task progress.
 */
async function saveTaskReport(adminDb, token, chatId, userId, userName, data) {
    const { taskId, taskTitle, inputType, rawText, extracted, today, now } = data;

    // Nuclear sanitize: JSON round-trip strips ALL undefined values
    const safe = JSON.parse(JSON.stringify(extracted || {}));
    const progress = typeof safe.progressPercent === "number" ? safe.progressPercent : 0;
    const hours = typeof safe.hoursWorked === "number" ? safe.hoursWorked : 0;
    const hasBlocker = !!safe.blockerPresent;

    // 1. Create telegramReports record
    try {
        const reportDoc = JSON.parse(JSON.stringify({
            userId: userId || "unknown",
            taskId: taskId || null,
            chatId: String(chatId),
            date: today,
            inputType: inputType || "unknown",
            rawText: (rawText || "").substring(0, 2000),
            parsedData: safe,
            progressPercent: progress,
            hoursWorked: hours,
            blocker: hasBlocker ? (safe.blockerSummary || "Sí") : null,
            blockerPresent: hasBlocker,
            normalizedSummary: safe.normalizedSummary || "",
            aiConfidence: safe.confidenceScore || null,
            status: "received",
            onTime: true,
            createdAt: now,
            updatedAt: now,
        }));
        await adminDb.collection(paths.TELEGRAM_REPORTS).add(reportDoc);
    } catch (e) {
        console.error("[saveTaskReport] STEP 1 telegramReports failed:", e.message);
        throw e;
    }

    // 2. Create schema-compatible timeLog
    if (taskId && hours > 0) {
        try {
            const startHour = new Date(`${today}T08:00:00`);
            const endHour = new Date(startHour.getTime() + (hours * 3600000));

            const timeLogDoc = JSON.parse(JSON.stringify({
                taskId: taskId,
                projectId: null,
                userId: userId || "unknown",
                displayName: userName || "Usuario",
                startTime: startHour.toISOString(),
                endTime: endHour.toISOString(),
                totalHours: hours,
                overtime: false,
                overtimeHours: 0,
                notes: `Reporte vía Telegram: ${safe.normalizedSummary || ""}`.substring(0, 200),
                source: "telegram",
                createdAt: now,
            }));
            await adminDb.collection(paths.TIME_LOGS).add(timeLogDoc);
            await recalculateTaskHoursBackend(adminDb, taskId);
        } catch (e) {
            console.error("[saveTaskReport] STEP 2 timeLog failed:", e.message);
        }
    }

    // 3. Update task progress
    if (taskId && progress > 0) {
        try {
            const updateData = { progress, updatedAt: now };
            if (hasBlocker) updateData.status = "blocked";
            await adminDb.collection(paths.TASKS).doc(taskId).update(updateData);
        } catch (e) {
            console.error("[saveTaskReport] STEP 3 task update failed:", e.message);
        }
    }

    // 4. Accumulate in session for summary
    try {
        const session = await getOrCreateSession(adminDb, chatId);
        const reportedTasks = session.metadata?.reportedTasks || [];
        reportedTasks.push({ taskId, title: taskTitle, progress, hours, blocker: hasBlocker });
        await adminDb.collection(paths.TELEGRAM_SESSIONS).doc(session.id).update({
            "metadata.reportedTasks": reportedTasks,
            updatedAt: now,
        });
    } catch (e) {
        console.error("[saveTaskReport] STEP 4 session update failed:", e.message);
    }

    // 5. Transition to asking more tasks
    await transitionState(adminDb, chatId, TELEGRAM_SESSION_EVENT.TASK_REPORT_SAVED);

    // 6. Confirmation + ask "more tasks?"
    const keyboard = [
        [
            { text: "✅ Sí, otra tarea", callback_data: "more:yes" },
            { text: "❌ No, es todo", callback_data: "more:no" },
        ],
        [{ text: "🏠 Cancelar", callback_data: "cancel" }],
    ];

    await sendMessageWithKeyboard(token, chatId,
        `✅ <b>${taskTitle}</b>\n` +
        `📊 Avance: ${progress}% | ⏱ ${hours}h` +
        (hasBlocker ? ` | 🚫 ${safe.blockerSummary || "Bloqueado"}` : "") +
        "\n\n¿Trabajaste en otra tarea?",
        keyboard
    );

    // Log
    await logBotEvent(adminDb, String(chatId), TELEGRAM_BOT_LOG_EVENT.REPORT_PARSED, {
        userId, taskId, progressPercent: progress, hoursWorked: hours, blockerPresent: hasBlocker,
    });

    // Metrics
    await incrementTodayMetrics(adminDb, AUTOMATION_CHANNELS.TELEGRAM, {
        responsesOnTime: 1,
        ...(inputType?.includes("audio") ? { audioProcessedCount: 1 } : { textReportsCount: 1 }),
    }).catch(() => { });
}

/**
 * Show day summary and ask about overtime.
 */
async function showDaySummaryAndAskOvertime(adminDb, token, chatId, userId, session) {
    // Reload session to get latest reportedTasks
    const freshSession = await getOrCreateSession(adminDb, chatId);
    const reportedTasks = freshSession.metadata?.reportedTasks || [];

    let totalHours = 0;
    let summary = "📋 <b>Resumen del día:</b>\n\n";

    reportedTasks.forEach(rt => {
        const icon = rt.blocker ? "🚫" : "✅";
        summary += `${icon} <b>${rt.title}</b> — ${rt.progress}% | ${rt.hours}h\n`;
        totalHours += (rt.hours || 0);
    });

    summary += `\n⏱ <b>Total: ${totalHours}h</b>\n\n¿Hiciste horas extra hoy?`;

    const keyboard = [
        [
            { text: "✅ Sí", callback_data: "ot:yes" },
            { text: "❌ No", callback_data: "ot:no" },
        ],
        [{ text: "🏠 Cancelar", callback_data: "cancel" }],
    ];

    await sendMessageWithKeyboard(token, chatId, summary, keyboard);
}

/**
 * Handle overtime assignment to a specific task.
 */
async function handleOvertimeForTask(adminDb, token, chatId, userId, taskId, session) {
    const freshSession = await getOrCreateSession(adminDb, chatId);
    const overtimeHours = freshSession.metadata?.overtimeHours || 0;
    const reportedTasks = freshSession.metadata?.reportedTasks || [];
    const task = reportedTasks.find(rt => rt.taskId === taskId);
    const taskTitle = task?.title || "Tarea";
    const userName = await getUserName(adminDb, userId);
    const now = new Date().toISOString();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

    // Create overtime timeLog (schema-compatible)
    const startHour = new Date(`${today}T18:00:00`);
    const endHour = new Date(startHour.getTime() + (overtimeHours * 3600000));

    await adminDb.collection(paths.TIME_LOGS).add({
        taskId,
        projectId: null,
        userId,
        displayName: userName,
        startTime: startHour.toISOString(),
        endTime: endHour.toISOString(),
        totalHours: overtimeHours,
        overtime: true,
        overtimeHours: overtimeHours,
        notes: "Horas extra vía Telegram",
        source: "telegram",
        createdAt: now,
    });

    // Recalculate task hours
    await recalculateTaskHoursBackend(adminDb, taskId);

    await transitionState(adminDb, chatId, TELEGRAM_SESSION_EVENT.OVERTIME_TASK_SELECTED);

    // Calculate total
    let totalRegular = 0;
    reportedTasks.forEach(rt => { totalRegular += (rt.hours || 0); });

    // Clean up session metadata
    const sessionDoc = await adminDb.collection(paths.TELEGRAM_SESSIONS)
        .where("chatId", "==", String(chatId)).limit(1).get();
    if (!sessionDoc.empty) {
        await sessionDoc.docs[0].ref.update({
            metadata: {},
            updatedAt: now,
        });
    }

    await sendMessageWithReplyKeyboard(token, chatId,
        `✅ <b>${overtimeHours}h extra</b> registradas en <b>${taskTitle}</b>\n\n` +
        `📊 Total del día: ${totalRegular}h + ${overtimeHours}h OT = <b>${totalRegular + overtimeHours}h</b>\n\n` +
        "¡Buen trabajo! 💪"
    );
}

/**
 * Force-reset a session to idle state.
 * Used when the session is stuck in an invalid state.
 */
async function forceResetSession(adminDb, chatId) {
    const chatIdStr = String(chatId);
    const snap = await adminDb.collection(paths.TELEGRAM_SESSIONS)
        .where("chatId", "==", chatIdStr)
        .limit(1)
        .get();

    if (!snap.empty) {
        await snap.docs[0].ref.update({
            currentState: TELEGRAM_SESSION_STATE.IDLE,
            metadata: {},
            updatedAt: new Date().toISOString(),
        });
        console.log(`[telegramRouter] Force-reset session for chatId=${chatIdStr} to idle`);
    }
}

/**
 * Sanitize an object for Firestore: replace undefined values with null.
 */
function sanitizeForFirestore(obj) {
    if (obj == null || typeof obj !== "object") return obj ?? null;
    const clean = {};
    for (const [key, val] of Object.entries(obj)) {
        if (val === undefined) {
            clean[key] = null;
        } else if (typeof val === "object" && !Array.isArray(val) && val !== null) {
            clean[key] = sanitizeForFirestore(val);
        } else {
            clean[key] = val;
        }
    }
    return clean;
}

module.exports = { routeInboundMessage, routeCallbackQuery };
