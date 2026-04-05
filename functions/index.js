/**
 * Cloud Functions Entry Point — AGGREGATOR
 * =========================================
 * [Phase M.5] This file is now a THIN AGGREGATOR.
 *
 * All backend logic has been moved to domain-specific files:
 *   - functions/exports/ai.js           (7 functions: testGeminiConnection, analyzeQuotePdf, searchImages, generateInsights, testAIExtraction, testAIBriefing, reprocesarReporteConIA)
 *   - functions/exports/analytics.js    (5 functions: scheduledAudit, weeklyBriefGenerator, scheduledAnalyticsRefresh, refreshAnalyticsManual, getAnalyticsDashboard)
 *   - functions/exports/tasks.js        (1 function: transitionTaskStatus)
 *   - functions/exports/automation.js   (3 functions: unifiedRoutineScheduler, executeRoutineManually, sendTestMessage)
 *   - functions/exports/telegram.js     (5 functions: telegramWebhookEndpoint, linkTelegramUser, onDelayCreated, quickReportApi, setupQuickReportMenuButton)
 *   - functions/exports/team.js         (4 functions: getTeamMembers, generateTelegramLinkCode, unlinkTelegramMember, updateTeamMember)
 *   - functions/exports/optimization.js (3 functions: runOptimizationScan, simulateChange, getOptimizationDashboard)
 *
 * This file only initializes Firebase Admin, defines secrets, and
 * composes domain exports into the global exports object.
 */

const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// ── Firebase Admin Initialization ──
initializeApp();
const adminDb = getFirestore();

// ── Secrets (managed via: firebase functions:secrets:set <SECRET_NAME>) ──
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const googleCseKey = defineSecret("GOOGLE_CSE_KEY");
const googleCx = defineSecret("GOOGLE_CX");
const telegramBotToken = defineSecret("TELEGRAM_BOT_TOKEN");
const resendApiKey = defineSecret("RESEND_API_KEY");

const secrets = { geminiApiKey, googleCseKey, googleCx, telegramBotToken, resendApiKey };

// ── Domain: AI ──
const { createAiExports } = require("./exports/ai");
const aiExports = createAiExports(adminDb, secrets);
exports.testGeminiConnection = aiExports.testGeminiConnection;
exports.analyzeQuotePdf = aiExports.analyzeQuotePdf;
exports.searchImages = aiExports.searchImages;
exports.generateInsights = aiExports.generateInsights;
exports.testAIExtraction = aiExports.testAIExtraction;
exports.testAIBriefing = aiExports.testAIBriefing;
exports.reprocesarReporteConIA = aiExports.reprocesarReporteConIA;

// ── Domain: Analytics ──
const { createAnalyticsExports } = require("./exports/analytics");
const analyticsExports = createAnalyticsExports(adminDb, secrets);
exports.scheduledAudit = analyticsExports.scheduledAudit;
exports.weeklyBriefGenerator = analyticsExports.weeklyBriefGenerator;
exports.scheduledAnalyticsRefresh = analyticsExports.scheduledAnalyticsRefresh;
exports.refreshAnalyticsManual = analyticsExports.refreshAnalyticsManual;
exports.getAnalyticsDashboard = analyticsExports.getAnalyticsDashboard;

// ── Domain: Tasks ──
const { createTasksExports } = require("./exports/tasks");
const tasksExports = createTasksExports(adminDb);
exports.transitionTaskStatus = tasksExports.transitionTaskStatus;

// ── Domain: Automation ──
const { createAutomationExports } = require("./exports/automation");
const automationExports = createAutomationExports(adminDb, secrets);
exports.unifiedRoutineScheduler = automationExports.unifiedRoutineScheduler;
exports.executeRoutineManually = automationExports.executeRoutineManually;
exports.sendTestMessage = automationExports.sendTestMessage;
exports.executePerformanceReport = automationExports.executePerformanceReport;
exports.migrateBreakHours = automationExports.migrateBreakHours;

// ── Domain: Telegram ──
const { createTelegramExports } = require("./exports/telegram");
const telegramExports = createTelegramExports(adminDb, secrets);
exports.telegramWebhookEndpoint = telegramExports.telegramWebhookEndpoint;
exports.linkTelegramUser = telegramExports.linkTelegramUser;
exports.onDelayCreated = telegramExports.onDelayCreated;
exports.quickReportApi = telegramExports.quickReportApi;
exports.setupQuickReportMenuButton = telegramExports.setupQuickReportMenuButton;

// ── Domain: Team ──
const { createTeamExports } = require("./exports/team");
const teamExports = createTeamExports(adminDb);
exports.getTeamMembers = teamExports.getTeamMembers;
exports.generateTelegramLinkCode = teamExports.generateTelegramLinkCode;
exports.unlinkTelegramMember = teamExports.unlinkTelegramMember;
exports.updateTeamMember = teamExports.updateTeamMember;

// ── Domain: Optimization ──
const { createOptimizationExports } = require("./exports/optimization");
const optimizationExports = createOptimizationExports(adminDb);
exports.runOptimizationScan = optimizationExports.runOptimizationScan;
exports.simulateChange = optimizationExports.simulateChange;
exports.getOptimizationDashboard = optimizationExports.getOptimizationDashboard;
