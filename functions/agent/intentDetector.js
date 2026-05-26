/**
 * ARIA Agent — Intent Detector (Phase 5)
 * ========================================
 * Detects if a user's natural language message implies a WRITE action
 * (create task, add comment) vs. a read-only query.
 *
 * Uses keyword-based detection (no extra LLM call) to keep costs at $0.
 *
 * Returns:
 *   - type: "read" | "write"
 *   - action: specific write tool name (if write)
 *   - extractedParams: best-effort parameter extraction from the message
 */

const coreReader = require("../db/coreDataReader");

/**
 * Regex patterns that indicate a write intent.
 * Using regex instead of exact keyword matching for better coverage
 * of Spanish verb conjugations and natural phrasing.
 */
const WRITE_PATTERNS = {
    createTask: {
        // Matches: crea, créame, crear, quiero crear, necesito crear, podrías crear, etc.
        regex: /\b(?:cre(?:a|á|ar|éa(?:me|la)?)|nueva|nuevo|agrega(?:r)?|añad(?:e|ir)|haz(?:me)?|genera(?:r)?|registra(?:r)?|mete(?:r)?|pon(?:me|er)?)\b.*\btarea\b|\btarea\b.*\b(?:nueva|nuevo)\b|\b(?:create|new)\s+task\b|\b(?:quiero|necesito|podr[ií]as?|puedes?|hay\s+que)\b.*\b(?:crear?|hacer|agregar|añadir|generar|registrar)\b.*\btarea\b/i,
        extract: extractCreateTaskParams,
    },
    addTaskComment: {
        // Stricter: requires both an action verb AND "comentario/nota/comment" in the same message
        // Won't match casual follow-ups like "listo", "ok", etc.
        regex: /\b(?:agrega|añad(?:e|ir)|pon(?:er|me)?|escrib(?:e|ir)|deja(?:r)?)\b[^.]*\b(?:comentario|nota|comment)\b|\b(?:comenta(?:r)?)\s+(?:en|sobre)\s+(?:la\s+)?tarea\b|\badd\s+(?:a\s+)?comment\b|\b(?:quiero|necesito|podr[ií]as?|puedes?)\b[^.]*\b(?:comentar|agregar|añadir|dejar)\b[^.]*\b(?:comentario|nota)\b/i,
        extract: extractAddCommentParams,
    },
};

/**
 * Detect if a message contains a write intent.
 *
 * @param {string} message - The user's text message
 * @param {string} userId - The user's ID (for context)
 * @returns {Promise<{type: string, action: string|null, extractedParams: Object}>}
 */
async function detectWriteIntent(message, userId) {
    if (!message) return { type: "read", action: null, extractedParams: {} };

    for (const [action, config] of Object.entries(WRITE_PATTERNS)) {
        if (config.regex.test(message)) {
            console.log(`[intentDetector] Write intent matched: ${action}`);
            const extractedParams = await config.extract(message, userId);
            return {
                type: "write",
                action,
                extractedParams,
            };
        }
    }

    return { type: "read", action: null, extractedParams: {} };
}

/**
 * Extract parameters for createTask from natural language.
 * Best-effort extraction — the user confirms/corrects via the confirmation flow.
 *
 * @param {string} message
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function extractCreateTaskParams(message, userId) {
    const params = { userId };

    // ── 1. Extract project first (so we can strip it from the title) ──
    // Matches: "en el proyecto X", "del proyecto X", "para el proyecto X",
    //          "proyecto X", "en X" (when X is a known project name)
    const projectPatterns = [
        /(?:en\s+(?:el\s+)?proyecto|del\s+proyecto|para\s+(?:el\s+)?proyecto|project)\s+[""]?(.+?)[""]?(?:\s*[,:]\s*|\s+(?:que|con|de\s+prioridad|asignada|llamada|titulada|:|una\s+tarea)|\s*$)/i,
        /\bproyecto\s+[""]?([^"",:]+?)[""]?(?:\s*[,:]\s*|\s+(?:crea|agrega|nueva|una|que|con|de)|\s*$)/i,
    ];

    let projectPhrase = "";
    for (const pattern of projectPatterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
            const projectName = match[1].trim();
            projectPhrase = match[0]; // full matched phrase to strip from title
            try {
                const projects = await coreReader.loadAllProjects();
                const found = projects.find(p =>
                    (p.name || "").toLowerCase().includes(projectName.toLowerCase())
                );
                if (found) {
                    params.projectId = found.id;
                    params.projectName = found.name;
                    console.log(`[intentDetector] Project matched: "${found.name}" (${found.id})`);
                } else {
                    // Try fuzzy match — match any word
                    const words = projectName.toLowerCase().split(/\s+/);
                    const fuzzy = projects.find(p =>
                        words.some(w => w.length > 2 && (p.name || "").toLowerCase().includes(w))
                    );
                    if (fuzzy) {
                        params.projectId = fuzzy.id;
                        params.projectName = fuzzy.name;
                        console.log(`[intentDetector] Project fuzzy-matched: "${fuzzy.name}" (${fuzzy.id})`);
                    }
                }
            } catch (err) {
                console.warn("[intentDetector] Project lookup error:", err.message);
            }
            break;
        }
    }

    // ── 2. Extract title ──
    // Strategy: remove trigger words and project reference, keep the meaningful part
    let titleCandidate = message;

    // Remove common trigger phrases
    titleCandidate = titleCandidate
        .replace(/^(?:aria[,:]?\s*)?/i, "")
        .replace(/\b(?:cre[áa](?:me|la)?\s+una?\s+tarea|crear?\s+(?:una?\s+)?tarea|nueva?\s+tarea|agrega(?:r)?\s+(?:una?\s+)?tarea|añad(?:e|ir)\s+(?:una?\s+)?tarea|haz(?:me)?\s+(?:una?\s+)?tarea|genera(?:r)?\s+(?:una?\s+)?tarea|registra(?:r)?\s+(?:una?\s+)?tarea|quiero\s+(?:crear?|hacer|que\s+crees)\s+(?:una?\s+)?tarea|necesito\s+(?:crear?|una?\s+)?tarea|pon(?:me|er)?\s+(?:una?\s+)?tarea|puedes?\s+crear?\s+(?:una?\s+)?tarea|podr[ií]as?\s+crear?\s+(?:una?\s+)?tarea|create\s+(?:a\s+)?(?:new\s+)?task|new\s+task)\s*/i, "")
        .trim();

    // Remove project reference from title
    if (projectPhrase) {
        titleCandidate = titleCandidate.replace(projectPhrase, "").trim();
    }

    // Remove leading connectors
    titleCandidate = titleCandidate
        .replace(/^(?:que\s+(?:se\s+)?llame|llamada|titulada|con\s+(?:el\s+)?(?:nombre|título)|que\s+diga|:|\s*[-–—]\s*)+\s*/i, "")
        .replace(/^[""]|[""]$/g, "")
        .trim();

    // Remove trailing context (priority, assignee, etc.)
    titleCandidate = titleCandidate
        .replace(/\s+(?:con\s+prioridad|de\s+prioridad|asignada?\s+a|para\s+el\s+\d{4}|fecha)\s+.+$/i, "")
        .trim();

    if (titleCandidate.length > 2 && titleCandidate.length < 200) {
        params.title = titleCandidate;
    }

    // ── 3. Extract priority ──
    const priorityMatch = message.match(/(?:prioridad|priority)\s+(alta|media|baja|cr[ií]tica|critical|high|medium|low)/i);
    if (priorityMatch) {
        const map = {
            "crítica": "critical", "critica": "critical", "critical": "critical",
            "alta": "high", "high": "high",
            "media": "medium", "medium": "medium",
            "baja": "low", "low": "low",
        };
        params.priority = map[priorityMatch[1].toLowerCase()] || "medium";
    }

    // ── 4. Extract assignee ──
    const assignMatch = message.match(/(?:asign(?:ada?|ar)\s+a|para\s+que\s+la\s+haga|asígnasela?\s+a)\s+(.+?)(?:\s+(?:con|en|de\s+prioridad)\s|$)/i);
    if (assignMatch) {
        const assignName = assignMatch[1].trim();
        try {
            const users = await coreReader.loadAllUsers();
            const found = users.find(u =>
                (u.name || u.displayName || "").toLowerCase().includes(assignName.toLowerCase())
            );
            if (found) {
                params.assignedTo = found.id;
                params.assignedToName = found.name || found.displayName;
            }
        } catch (err) {
            console.warn("[intentDetector] User lookup error:", err.message);
        }
    }

    // ── 5. Extract due date ──
    const dateMatch = message.match(/(?:para\s+el|fecha|due|deadline|vence)\s+(\d{4}-\d{2}-\d{2})/i);
    if (dateMatch) {
        params.dueDate = dateMatch[1];
    }

    console.log("[intentDetector] Extracted params:", JSON.stringify(params));
    return params;
}

/**
 * Extract parameters for addTaskComment from natural language.
 *
 * @param {string} message
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function extractAddCommentParams(message, userId) {
    const params = { userId };

    // Try to extract the task name/reference
    const taskPatterns = [
        /(?:en\s+(?:la\s+)?tarea|sobre\s+(?:la\s+)?tarea|task)\s+[""]?(.+?)[""]?\s*(?:que\s+diga|diciendo|con\s+(?:el\s+)?texto|:|,)/i,
        /(?:tarea)\s+[""]?(.+?)[""]?\s+(?:que\s+diga|diciendo|un\s+comentario|una\s+nota)/i,
    ];

    for (const pattern of taskPatterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
            const taskName = match[1].trim();
            try {
                const tasks = await coreReader.loadAllTasks();
                const found = tasks.find(t =>
                    (t.title || "").toLowerCase().includes(taskName.toLowerCase())
                );
                if (found) {
                    params.taskId = found.id;
                    params.taskTitle = found.title;
                }
            } catch (err) {
                console.warn("[intentDetector] Task lookup error:", err.message);
            }
            break;
        }
    }

    // Extract the comment text
    const textPatterns = [
        /(?:que\s+diga|diciendo|con\s+(?:el\s+)?texto)\s*[:\-]?\s*[""]?(.+?)[""]?\s*$/i,
        /(?:comenta(?:rio)?|nota)\s*[:\-]\s*[""]?(.+?)[""]?\s*$/i,
    ];
    for (const pattern of textPatterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
            params.text = match[1].trim();
            break;
        }
    }

    // If no explicit text found, try to get everything after the task reference
    if (!params.text) {
        const afterTask = message.match(/(?:tarea|task)\s+.+?\s+(?:que\s+diga|diciendo|:)\s*(.+)$/i);
        if (afterTask) {
            params.text = afterTask[1].trim();
        }
    }

    console.log("[intentDetector] Comment params:", JSON.stringify(params));
    return params;
}

module.exports = {
    detectWriteIntent,
    WRITE_PATTERNS,
};
