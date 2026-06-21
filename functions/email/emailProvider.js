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
        from = "Passdown AME CR <reportes@analyzeops.com>",
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
 * Send email and log the delivery to Supabase.
 *
 * @param {any} _adminDb - Deprecated
 * @param {string} apiKey - Resend API key
 * @param {Object} emailOptions - Same as sendEmail options
 * @param {Object} [meta] - Additional metadata (routineKey, runId, etc.)
 * @returns {Promise<{ok: boolean, id?: string, error?: string}>}
 */
async function sendAndLogEmail(_adminDb, apiKey, emailOptions, meta = {}) {
    const result = await sendEmail(apiKey, emailOptions);
    const { getSupabase } = require("../db/supabaseAdmin");
    const sb = getSupabase();

    // Log delivery to Supabase
    try {
        const recipients = Array.isArray(emailOptions.to) ? emailOptions.to.join(", ") : emailOptions.to;
        const { error } = await sb.from("email_deliveries").insert({
            recipient: recipients,
            subject: emailOptions.subject,
            sender: emailOptions.from || "reportes@analyzeops.com",
            status: result.ok ? "sent" : "failed",
            resend_id: result.id || null,
            error_message: result.error || null,
            routine_key: meta.routineKey || null,
            run_id: meta.runId || null,
            created_at: new Date().toISOString(),
        });
        if (error) {
            console.warn("[emailProvider] Failed to log delivery to Supabase:", error.message);
        }
    } catch (logErr) {
        console.warn("[emailProvider] Failed to log delivery:", logErr.message);
    }

    return result;
}

module.exports = { sendEmail, sendAndLogEmail };

