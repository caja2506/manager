/**
 * Metrics Updater — Backend (CJS)
 * =================================
 * Atomic daily metrics management using FieldValue.increment.
 */

const { FieldValue } = require("firebase-admin/firestore");
const paths = require("./firestorePaths");
const { AUTOMATION_CHANNELS, AUTOMATION_PROVIDERS } = require("./constants");

/**
 * Get metrics document ID for a date/channel.
 */
function getMetricsDocId(date, channel = AUTOMATION_CHANNELS.TELEGRAM) {
    return `${date}_${channel}`;
}

/**
 * Get today's date string in YYYY-MM-DD format (Mexico City timezone).
 */
function getTodayDate() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

/**
 * Increment one or more daily metrics atomically.
 * Creates the document if it doesn't exist (merge: true).
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} date - YYYY-MM-DD
 * @param {string} channel
 * @param {Object} increments - { messagesSent: 1, responsesReceived: 2, ... }
 */
async function incrementMetrics(adminDb, date, channel, increments) {
    const docId = getMetricsDocId(date, channel);
    const ref = adminDb.collection(paths.AUTOMATION_METRICS_DAILY).doc(docId);

    const update = { updatedAt: new Date().toISOString() };
    for (const [field, amount] of Object.entries(increments)) {
        if (typeof amount === "number" && amount !== 0) {
            update[field] = FieldValue.increment(amount);
        }
    }

    // merge:true creates doc if missing, merges fields if existing
    await ref.set({
        date,
        channel,
        provider: AUTOMATION_PROVIDERS.TELEGRAM_BOT,
        ...update,
    }, { merge: true });
}

/**
 * Shorthand: increment today's metrics.
 */
async function incrementTodayMetrics(adminDb, channel, increments) {
    return incrementMetrics(adminDb, getTodayDate(), channel, increments);
}

module.exports = { incrementMetrics, incrementTodayMetrics, getMetricsDocId, getTodayDate };
