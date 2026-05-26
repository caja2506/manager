/**
 * Supabase Admin Client — Backend (CJS)
 * =======================================
 * Server-side Supabase client using the service_role key.
 * Bypasses RLS for Cloud Functions that need full data access.
 *
 * USAGE:
 *   const { getSupabase } = require("../db/supabaseAdmin");
 *   const sb = getSupabase();
 *   const { data } = await sb.from("tasks").select("*");
 *
 * SECRETS:
 *   - SUPABASE_URL: Set via `firebase functions:secrets:set SUPABASE_URL`
 *   - SUPABASE_SERVICE_ROLE_KEY: Set via `firebase functions:secrets:set SUPABASE_SERVICE_ROLE_KEY`
 *
 * FIELD MAPPING:
 *   Supabase uses snake_case. Frontend/handlers expect camelCase.
 *   This module provides toSnake/toCamel utilities for transparent mapping.
 */

const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");

let _client = null;

/**
 * Get or create the Supabase admin client.
 * Must be called INSIDE a function handler (after secrets are resolved).
 *
 * @param {string} [url] - Override URL (for testing)
 * @param {string} [key] - Override service_role key (for testing)
 * @returns {import("@supabase/supabase-js").SupabaseClient}
 */
function getSupabase(url, key) {
    if (_client) return _client;

    const supabaseUrl = url || process.env.SUPABASE_URL;
    const supabaseKey = key || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error(
            "[supabaseAdmin] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
            "Set them via: firebase functions:secrets:set SUPABASE_URL"
        );
    }

    _client = createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        realtime: {
            transport: WebSocket,
        },
    });

    console.log("[supabaseAdmin] ✅ Client initialized");
    return _client;
}

// ── Field Mapping Utilities ──

/**
 * Map for Firestore camelCase → Supabase snake_case field names.
 * Only includes fields that differ between the two schemas.
 */
const CAMEL_TO_SNAKE = {
    // tasks
    assignedTo: "assigned_to",
    projectId: "project_id",
    parentTaskId: "parent_task_id",
    taskTypeId: "task_type_id",
    dueDate: "due_date",
    startDate: "start_date",
    completedDate: "completed_date",
    estimatedHours: "estimated_hours",
    actualHours: "actual_hours",
    sortOrder: "sort_order",
    createdAt: "created_at",
    updatedAt: "updated_at",
    createdBy: "created_by",
    stationId: "station_id",
    workAreaId: "work_area_id",
    milestoneId: "milestone_id",
    peerReviewRequired: "peer_review_required",
    peerReviewStatus: "peer_review_status",
    peerReviewDiscipline: "peer_review_discipline",
    peerReviewerId: "peer_reviewer_id",

    // time_logs
    taskId: "task_id",
    userId: "user_id",
    startTime: "start_time",
    endTime: "end_time",
    totalHours: "total_hours",
    totalHoursGross: "total_hours_gross",
    breakHoursDeducted: "break_hours_deducted",
    autoStopped: "auto_stopped",
    manualEntry: "manual_entry",
    overtimeHours: "overtime_hours",

    // users
    displayName: "display_name",
    teamRole: "team_role",
    operationalRole: "operational_role",
    rbacRole: "rbac_role",
    telegramChatId: "telegram_chat_id",
    isAutomationParticipant: "is_automation_participant",
    reportsTo: "reports_to",
    providerLinks: "provider_links",

    // projects
    totalBudget: "total_budget",

    // subtasks
    completedAt: "completed_at",
    completedBy: "completed_by",

    // delays
    causeName: "cause_name",
    causeId: "cause_id",

    // weekly_plan_items
    weekStartDate: "week_start_date",
    dayOfWeek: "day_of_week",
    startDateTime: "start_date_time",
    endDateTime: "end_date_time",
    plannedHours: "planned_hours",
    projectId: "project_id",
    taskTitle: "task_title",
    projectName: "project_name",
    taskTitleSnapshot: "task_title_snapshot",
    projectNameSnapshot: "project_name_snapshot",
    assignedToName: "assigned_to_name",
    statusSnapshot: "status_snapshot",
    colorKey: "color_key",
};

// Build reverse map
const SNAKE_TO_CAMEL = {};
for (const [camel, snake] of Object.entries(CAMEL_TO_SNAKE)) {
    SNAKE_TO_CAMEL[snake] = camel;
}

/**
 * Convert a Supabase row (snake_case) to handler-compatible (camelCase) object.
 * Preserves the `id` field and any fields not in the map.
 */
function toCamel(row) {
    if (!row) return row;
    const result = {};
    for (const [key, value] of Object.entries(row)) {
        const camelKey = SNAKE_TO_CAMEL[key] || key;
        result[camelKey] = value;
    }
    return result;
}

/**
 * Convert a handler object (camelCase) to Supabase format (snake_case).
 * Only maps known fields; unknown keys pass through unchanged.
 */
function toSnake(obj) {
    if (!obj) return obj;
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = CAMEL_TO_SNAKE[key] || key;
        result[snakeKey] = value;
    }
    return result;
}

/**
 * Convert an array of Supabase rows to camelCase.
 */
function mapRows(rows) {
    return (rows || []).map(toCamel);
}

module.exports = {
    getSupabase,
    toCamel,
    toSnake,
    mapRows,
    CAMEL_TO_SNAKE,
    SNAKE_TO_CAMEL,
};
