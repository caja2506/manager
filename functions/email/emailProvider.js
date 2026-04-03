/**
 * Email Provider — Resend (CJS)
 * ===============================
 * Sends emails via Resend API and logs deliveries to Firestore.
 * Uses the Resend Node.js SDK for simplicity.
 *
 * @module email/emailProvider
 */

const DELIVERY_COLLECTION = "emailDeliveries";

/**
 * Send an email via Resend API.
 *
 * @param {string} apiKey - Resend API key
 * @param {Object} options
 * @param {string[]} options.to - Recipient email addresses
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {string} [options.from] - Sender (default: reportes@analyzeops.com)
 * @param {string} [options.replyTo] - Reply-to address
 * @returns {Promise<{ok: boolean, id?: string, error?: string}>}
 */
async function sendEmail(apiKey, options) {
    const {
        to,
        subject,
        html,
        from = "AnalyzeOps <reportes@analyzeops.com>",
        replyTo,
    } = options;

    const cleanKey = (apiKey || "").trim();
    const url = "https://api.resend.com/emails";

    try {
        const body = {
            from,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
        };
        if (replyTo) body.reply_to = replyTo;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${cleanKey}`,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("[emailProvider] Resend API error:", data);
            return {
                ok: false,
                error: data.message || `HTTP ${response.status}`,
                statusCode: response.status,
            };
        }

        console.log(`[emailProvider] Email sent successfully. ID: ${data.id}`);
        return { ok: true, id: data.id };
    } catch (err) {
        console.error("[emailProvider] Network error:", err.message);
        return { ok: false, error: `Network error: ${err.message}` };
    }
}

/**
 * Send email and log the delivery to Firestore.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} apiKey - Resend API key
 * @param {Object} emailOptions - Same as sendEmail options
 * @param {Object} [meta] - Additional metadata (routineKey, runId, etc.)
 * @returns {Promise<{ok: boolean, id?: string, error?: string}>}
 */
async function sendAndLogEmail(adminDb, apiKey, emailOptions, meta = {}) {
    const result = await sendEmail(apiKey, emailOptions);

    // Log delivery to Firestore
    try {
        await adminDb.collection(DELIVERY_COLLECTION).add({
            channel: "email",
            provider: "resend",
            to: emailOptions.to,
            subject: emailOptions.subject,
            from: emailOptions.from || "reportes@analyzeops.com",
            status: result.ok ? "sent" : "failed",
            resendId: result.id || null,
            error: result.error || null,
            routineKey: meta.routineKey || null,
            runId: meta.runId || null,
            createdAt: new Date().toISOString(),
        });
    } catch (logErr) {
        console.warn("[emailProvider] Failed to log delivery:", logErr.message);
    }

    return result;
}

module.exports = { sendEmail, sendAndLogEmail };
