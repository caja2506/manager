/**
 * Telegram Parsers — Backend (CJS)
 * ===================================
 * Deterministic text parsing for Phase 2 (no AI).
 * Designed to be replaced/augmented by Gemini in Phase 3.
 */

/**
 * Parse a daily report text message.
 * Expected format:
 *   avance: 60
 *   horas: 5
 *   bloqueo: no
 *
 * Also accepts variations: progreso, progress, hours, blocker, block
 *
 * @param {string} text - Raw message text
 * @returns {{ valid: boolean, data?: { progressPercent, hoursWorked, blocker }, errors?: string[] }}
 */
function parseReportText(text) {
    if (!text || typeof text !== "string") {
        return { valid: false, errors: ["Texto vacío"] };
    }

    const lines = text.trim().toLowerCase().split(/\n/);
    const errors = [];
    let progressPercent = null;
    let hoursWorked = null;
    let blocker = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Parse progress/avance
        const progressMatch = line.match(/^(?:avance|progreso|progress)\s*[:=]\s*(\d+)/);
        if (progressMatch) {
            progressPercent = parseInt(progressMatch[1], 10);
            if (progressPercent < 0 || progressPercent > 100) {
                errors.push("El avance debe estar entre 0 y 100");
                progressPercent = null;
            }
            continue;
        }

        // Parse hours
        const hoursMatch = line.match(/^(?:horas?|hours?)\s*[:=]\s*(\d+(?:\.\d+)?)/);
        if (hoursMatch) {
            hoursWorked = parseFloat(hoursMatch[1]);
            if (hoursWorked < 0 || hoursWorked > 24) {
                errors.push("Las horas deben estar entre 0 y 24");
                hoursWorked = null;
            }
            continue;
        }

        // Parse blocker
        const blockerMatch = line.match(/^(?:bloqueo|blocker?|block)\s*[:=]\s*(.+)/);
        if (blockerMatch) {
            const val = blockerMatch[1].trim();
            if (val === "no" || val === "ninguno" || val === "none" || val === "n/a") {
                blocker = null;
            } else if (val === "sí" || val === "si" || val === "yes") {
                blocker = "Sí (sin detalle)";
            } else {
                blocker = val;
            }
            continue;
        }
    }

    // Validate required fields
    if (progressPercent === null) {
        errors.push("Falta el campo 'avance'");
    }
    if (hoursWorked === null) {
        errors.push("Falta el campo 'horas'");
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return {
        valid: true,
        data: {
            progressPercent,
            hoursWorked,
            blocker,
        },
    };
}

/**
 * Parse a bot command from message text.
 *
 * @param {string} text
 * @returns {{ isCommand: boolean, command?: string, args?: string }}
 */
function parseCommand(text) {
    if (!text || typeof text !== "string") {
        return { isCommand: false };
    }

    const trimmed = text.trim();
    if (!trimmed.startsWith("/")) {
        return { isCommand: false };
    }

    // Handle /command@botname format
    const match = trimmed.match(/^\/(\w+)(?:@\w+)?\s*(.*)?$/);
    if (!match) {
        return { isCommand: false };
    }

    return {
        isCommand: true,
        command: match[1].toLowerCase(),
        args: (match[2] || "").trim(),
    };
}

module.exports = { parseReportText, parseCommand };
