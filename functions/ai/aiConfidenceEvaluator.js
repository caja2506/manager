/**
 * AI Confidence Evaluator — Backend (CJS)
 * ==========================================
 * Pure utility for confidence-based decision gating.
 * Determines action based on confidence score and thresholds.
 */

const CONFIDENCE_ACTIONS = {
    ACCEPT: "accept",
    CONFIRM: "confirm",
    FALLBACK: "fallback",
};

// Default thresholds (can be overridden from config)
const DEFAULT_THRESHOLDS = {
    acceptAbove: 0.8,   // High confidence → auto-accept
    confirmAbove: 0.5,  // Medium → ask user confirmation
    // Below confirmAbove → fallback to deterministic
};

/**
 * Evaluate action based on confidence score.
 *
 * @param {number} confidenceScore - 0.0 to 1.0
 * @param {Object} [thresholds] - Custom thresholds
 * @returns {"accept"|"confirm"|"fallback"}
 */
function evaluateAction(confidenceScore, thresholds = DEFAULT_THRESHOLDS) {
    const { acceptAbove = 0.8, confirmAbove = 0.5 } = thresholds;

    if (typeof confidenceScore !== "number" || isNaN(confidenceScore)) {
        return CONFIDENCE_ACTIONS.FALLBACK;
    }

    if (confidenceScore >= acceptAbove) {
        return CONFIDENCE_ACTIONS.ACCEPT;
    }

    if (confidenceScore >= confirmAbove) {
        return CONFIDENCE_ACTIONS.CONFIRM;
    }

    return CONFIDENCE_ACTIONS.FALLBACK;
}

/**
 * Check if the extracted data has minimum required fields.
 *
 * @param {Object} extracted - Extracted data object
 * @param {string[]} requiredFields - Fields that must be non-null
 * @returns {{ complete: boolean, missingFields: string[] }}
 */
function validateCompleteness(extracted, requiredFields = ["progressPercent", "hoursWorked"]) {
    const missingFields = [];

    for (const field of requiredFields) {
        if (extracted[field] === null || extracted[field] === undefined) {
            missingFields.push(field);
        }
    }

    return {
        complete: missingFields.length === 0,
        missingFields,
    };
}

module.exports = {
    evaluateAction,
    validateCompleteness,
    CONFIDENCE_ACTIONS,
    DEFAULT_THRESHOLDS,
};
