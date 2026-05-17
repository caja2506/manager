/**
 * Core Data Reader — Backend (CJS)
 * ==================================
 * Centralized data access layer for reading/writing CORE data from Supabase.
 *
 * This replaces `adminDb.collection(paths.XXX).get()` calls for tables
 * that have been migrated to Supabase:
 *   tasks, subtasks, projects, users, time_logs, delays, delay_causes
 *
 * All functions return data in camelCase format for backward compatibility
 * with existing handlers.
 *
 * AUTOMATION-ONLY collections (sessions, runs, metrics, etc.) should
 * continue using `adminDb` (Firestore) directly.
 */

const { getSupabase, toCamel, toSnake, mapRows } = require("./supabaseAdmin");

// ── READ Operations ──

/**
 * Load all tasks.
 * @returns {Promise<Array>} Tasks in camelCase format
 */
async function loadAllTasks() {
    const sb = getSupabase();
    const { data, error } = await sb.from("tasks").select("*");
    if (error) { console.error("[coreDataReader] loadAllTasks:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load tasks assigned to a specific user.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function loadUserTasks(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from("tasks")
        .select("*")
        .eq("assigned_to", userId);
    if (error) { console.error("[coreDataReader] loadUserTasks:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load a single task by ID.
 * @param {string} taskId
 * @returns {Promise<Object|null>}
 */
async function loadTask(taskId) {
    const sb = getSupabase();
    const { data, error } = await sb.from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();
    if (error) { console.warn("[coreDataReader] loadTask:", error.message); return null; }
    return toCamel(data);
}

/**
 * Load all projects.
 * @returns {Promise<Array>}
 */
async function loadAllProjects() {
    const sb = getSupabase();
    const { data, error } = await sb.from("projects").select("*");
    if (error) { console.error("[coreDataReader] loadAllProjects:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load a single project by ID.
 * @param {string} projectId
 * @returns {Promise<Object|null>}
 */
async function loadProject(projectId) {
    const sb = getSupabase();
    const { data, error } = await sb.from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
    if (error) { console.warn("[coreDataReader] loadProject:", error.message); return null; }
    return toCamel(data);
}

/**
 * Load all users.
 * @returns {Promise<Array>}
 */
async function loadAllUsers() {
    const sb = getSupabase();
    const { data, error } = await sb.from("users").select("*");
    if (error) { console.error("[coreDataReader] loadAllUsers:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load a single user by ID.
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function loadUser(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from("users")
        .select("*")
        .eq("id", userId)
        .single();
    if (error) { console.warn("[coreDataReader] loadUser:", error.message); return null; }
    return toCamel(data);
}

/**
 * Load users that are automation participants.
 * @returns {Promise<Array>}
 */
async function loadAutomationParticipants() {
    const sb = getSupabase();
    const { data, error } = await sb.from("users")
        .select("*")
        .eq("is_automation_participant", true);
    if (error) { console.error("[coreDataReader] loadAutomationParticipants:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load all time logs.
 * @returns {Promise<Array>}
 */
async function loadAllTimeLogs() {
    const sb = getSupabase();
    const { data, error } = await sb.from("time_logs").select("*");
    if (error) { console.error("[coreDataReader] loadAllTimeLogs:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load time logs for a specific task.
 * @param {string} taskId
 * @returns {Promise<Array>}
 */
async function loadTaskTimeLogs(taskId) {
    const sb = getSupabase();
    const { data, error } = await sb.from("time_logs")
        .select("*")
        .eq("task_id", taskId);
    if (error) { console.error("[coreDataReader] loadTaskTimeLogs:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load time logs for a specific user.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function loadUserTimeLogs(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from("time_logs")
        .select("*")
        .eq("user_id", userId);
    if (error) { console.error("[coreDataReader] loadUserTimeLogs:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load time logs for a task and user.
 * @param {string} taskId
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function loadTaskUserTimeLogs(taskId, userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from("time_logs")
        .select("*")
        .eq("task_id", taskId)
        .eq("user_id", userId);
    if (error) { console.error("[coreDataReader] loadTaskUserTimeLogs:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load all delays.
 * @returns {Promise<Array>}
 */
async function loadAllDelays() {
    const sb = getSupabase();
    const { data, error } = await sb.from("delays").select("*");
    if (error) { console.error("[coreDataReader] loadAllDelays:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load all subtasks.
 * @returns {Promise<Array>}
 */
async function loadAllSubtasks() {
    const sb = getSupabase();
    const { data, error } = await sb.from("subtasks").select("*");
    if (error) { console.error("[coreDataReader] loadAllSubtasks:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load subtasks for a specific task.
 * @param {string} taskId
 * @returns {Promise<Array>}
 */
async function loadTaskSubtasks(taskId) {
    const sb = getSupabase();
    const { data, error } = await sb.from("subtasks")
        .select("*")
        .eq("task_id", taskId)
        .order("order", { ascending: true });
    if (error) { console.error("[coreDataReader] loadTaskSubtasks:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load a setting from the Supabase settings table.
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function loadSetting(key) {
    const sb = getSupabase();
    const { data, error } = await sb.from("settings")
        .select("value")
        .eq("key", key)
        .single();
    if (error) { console.warn(`[coreDataReader] loadSetting(${key}):`, error.message); return null; }
    return data?.value || null;
}

/**
 * Load active (running) timer for a user — endTime IS NULL.
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function loadActiveTimerForUser(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from("time_logs")
        .select("*")
        .eq("user_id", userId)
        .is("end_time", null)
        .limit(1)
        .single();
    if (error) { return null; }
    return toCamel(data);
}

/**
 * Load active (running) timer for a specific user + task + source combo.
 * @param {string} userId
 * @param {string} taskId
 * @param {string} [source] - optional source filter (e.g. "planner_auto")
 * @returns {Promise<Object|null>}
 */
async function loadActiveTimerForUserTask(userId, taskId, source) {
    const sb = getSupabase();
    let query = sb.from("time_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("task_id", taskId)
        .is("end_time", null);
    if (source) query = query.eq("source", source);
    const { data, error } = await query.limit(1).single();
    if (error) { return null; }
    return toCamel(data);
}

/**
 * Load all active (running) timers for a user.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function loadActiveTimersForUser(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from("time_logs")
        .select("*")
        .eq("user_id", userId)
        .is("end_time", null);
    if (error) { console.error("[coreDataReader] loadActiveTimersForUser:", error.message); return []; }
    return mapRows(data);
}

// ── WRITE Operations ──

/**
 * Update a time log by ID. Accepts camelCase input.
 * @param {string} logId
 * @param {Object} updates - camelCase fields
 * @returns {Promise<Object|null>}
 */
async function updateTimeLog(logId, updates) {
    const sb = getSupabase();
    const snakeUpdates = toSnake(updates);
    snakeUpdates.updated_at = new Date().toISOString();
    const { data, error } = await sb.from("time_logs")
        .update(snakeUpdates)
        .eq("id", logId)
        .select()
        .single();
    if (error) { console.error("[coreDataReader] updateTimeLog:", error.message); return null; }
    return toCamel(data);
}

/**
 * Insert a new time log. Accepts camelCase input.
 * @param {Object} logData - camelCase fields
 * @returns {Promise<Object|null>}
 */
async function insertTimeLog(logData) {
    const sb = getSupabase();
    const snakeData = toSnake(logData);
    if (!snakeData.created_at) snakeData.created_at = new Date().toISOString();
    if (!snakeData.updated_at) snakeData.updated_at = new Date().toISOString();
    const { data, error } = await sb.from("time_logs")
        .insert(snakeData)
        .select()
        .single();
    if (error) { console.error("[coreDataReader] insertTimeLog:", error.message); return null; }
    return toCamel(data);
}

/**
 * Update a task by ID. Accepts camelCase input.
 * @param {string} taskId
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
async function updateTask(taskId, updates) {
    const sb = getSupabase();
    const snakeUpdates = toSnake(updates);
    snakeUpdates.updated_at = new Date().toISOString();
    const { data, error } = await sb.from("tasks")
        .update(snakeUpdates)
        .eq("id", taskId)
        .select()
        .single();
    if (error) { console.error("[coreDataReader] updateTask:", error.message); return null; }
    return toCamel(data);
}

/**
 * Insert a new task. Accepts camelCase input.
 * @param {Object} taskData
 * @returns {Promise<Object|null>}
 */
async function insertTask(taskData) {
    const sb = getSupabase();
    const snakeData = toSnake(taskData);
    if (!snakeData.created_at) snakeData.created_at = new Date().toISOString();
    if (!snakeData.updated_at) snakeData.updated_at = new Date().toISOString();
    const { data, error } = await sb.from("tasks")
        .insert(snakeData)
        .select()
        .single();
    if (error) { console.error("[coreDataReader] insertTask:", error.message); return null; }
    return toCamel(data);
}

/**
 * Update a subtask by ID. Accepts camelCase input.
 * @param {string} subtaskId
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
async function updateSubtask(subtaskId, updates) {
    const sb = getSupabase();
    const snakeUpdates = toSnake(updates);
    snakeUpdates.updated_at = new Date().toISOString();
    const { data, error } = await sb.from("subtasks")
        .update(snakeUpdates)
        .eq("id", subtaskId)
        .select()
        .single();
    if (error) { console.error("[coreDataReader] updateSubtask:", error.message); return null; }
    return toCamel(data);
}

/**
 * Update a user by ID. Accepts camelCase input.
 * @param {string} userId
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
async function updateUser(userId, updates) {
    const sb = getSupabase();
    const snakeUpdates = toSnake(updates);
    snakeUpdates.updated_at = new Date().toISOString();
    const { data, error } = await sb.from("users")
        .update(snakeUpdates)
        .eq("id", userId)
        .select()
        .single();
    if (error) { console.error("[coreDataReader] updateUser:", error.message); return null; }
    return toCamel(data);
}

/**
 * Insert or upsert a user by ID. Accepts camelCase input.
 * Uses upsert to handle both creation and update scenarios.
 * @param {string} userId
 * @param {Object} userData
 * @returns {Promise<Object|null>}
 */
async function upsertUser(userId, userData) {
    const sb = getSupabase();
    const snakeData = toSnake(userData);
    snakeData.id = userId;
    if (!snakeData.created_at) snakeData.created_at = new Date().toISOString();
    snakeData.updated_at = new Date().toISOString();
    const { data, error } = await sb.from("users")
        .upsert(snakeData, { onConflict: "id" })
        .select()
        .single();
    if (error) { console.error("[coreDataReader] upsertUser:", error.message); return null; }
    return toCamel(data);
}

/**
 * Recalculate task actualHours from all completed time logs.
 * Replacement for the Firestore-based recalculateTaskHours pattern.
 * @param {string} taskId
 * @returns {Promise<number>} Updated total hours
 */
async function recalculateTaskHours(taskId) {
    const logs = await loadTaskTimeLogs(taskId);
    let totalHours = 0;
    logs.forEach(log => {
        if (log.endTime && log.totalHours) {
            totalHours += log.totalHours;
        }
    });
    totalHours = parseFloat(totalHours.toFixed(2));
    await updateTask(taskId, { actualHours: totalHours });
    return totalHours;
}

// ── ARIA Intelligence Readers ──

/**
 * Load tasks with Gantt data (planned dates, percent complete).
 * Only returns tasks that have plannedStartDate or plannedEndDate set.
 * @returns {Promise<Array>}
 */
async function loadGanttTasks() {
    const sb = getSupabase();
    const { data, error } = await sb.from("tasks")
        .select("id, title, status, assigned_to, project_id, priority, due_date, planned_start_date, planned_end_date, percent_complete, show_in_gantt, milestone, parent_task_id, estimated_hours, actual_hours")
        .not("planned_start_date", "is", null);
    if (error) { console.error("[coreDataReader] loadGanttTasks:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load task dependencies for a project.
 * @param {string} [projectId] - Optional. If omitted, loads all dependencies.
 * @returns {Promise<Array>}
 */
async function loadTaskDependencies(projectId) {
    const sb = getSupabase();
    let query = sb.from("task_dependencies").select("*");
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) { console.error("[coreDataReader] loadTaskDependencies:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load tasks with upcoming deadlines within N days.
 * Excludes completed/cancelled tasks.
 * @param {number} [days=7] - Number of days ahead to look
 * @returns {Promise<Array>}
 */
async function loadUpcomingDeadlines(days = 7) {
    const sb = getSupabase();
    const today = new Date().toISOString().split("T")[0];
    const future = new Date(Date.now() + days * 86400000).toISOString().split("T")[0];
    const { data, error } = await sb.from("tasks")
        .select("id, title, status, assigned_to, project_id, priority, due_date, estimated_hours, actual_hours")
        .gte("due_date", today)
        .lte("due_date", future)
        .not("status", "in", "(completed,cancelled)");
    if (error) { console.error("[coreDataReader] loadUpcomingDeadlines:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load proactive agent config from settings.
 * @returns {Promise<Object|null>}
 */
async function loadProactiveAgentConfig() {
    return loadSetting("proactiveAgent");
}

/**
 * Calculate team workload: active tasks per user vs capacity.
 * @returns {Promise<Array<{userId, name, role, activeTasks, estimatedHours, capacity}>>}
 */
async function calculateTeamWorkload() {
    const [users, tasks] = await Promise.all([loadAllUsers(), loadAllTasks()]);
    const activeStatuses = ["backlog", "pending", "in_progress", "blocked", "validation"];
    return users
        .filter(u => u.active !== false)
        .map(u => {
            const userTasks = tasks.filter(t => t.assignedTo === u.id && activeStatuses.includes(t.status));
            const estimatedHours = userTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
            return {
                userId: u.id,
                name: u.displayName || u.name || u.email,
                role: u.operationalRole || u.teamRole,
                activeTasks: userTasks.length,
                estimatedHours,
                capacity: u.capacity || 40, // weekly hours default
            };
        });
}

// ── ARIA Roadmap Readers ──

/**
 * Load milestones for a project.
 * @param {string} projectId
 * @returns {Promise<Array>}
 */
async function loadProjectMilestones(projectId) {
    const sb = getSupabase();
    const { data, error } = await sb.from("milestones")
        .select("id, project_id, name, description, status, start_date, due_date, completed_date, score, traffic_light, sort_order")
        .eq("project_id", projectId)
        .order("start_date", { ascending: true });
    if (error) { console.error("[coreDataReader] loadProjectMilestones:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load all milestones across all projects.
 * @returns {Promise<Array>}
 */
async function loadAllMilestones() {
    const sb = getSupabase();
    const { data, error } = await sb.from("milestones")
        .select("id, project_id, name, status, start_date, due_date, completed_date, score, traffic_light, sort_order")
        .order("due_date", { ascending: true });
    if (error) { console.error("[coreDataReader] loadAllMilestones:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load documented risks for a project.
 * @param {string} projectId
 * @returns {Promise<Array>}
 */
async function loadProjectRisks(projectId) {
    const sb = getSupabase();
    const { data, error } = await sb.from("risks")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
    if (error) { console.error("[coreDataReader] loadProjectRisks:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load daily planner tasks for a user on a given date.
 * @param {string} userId
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<Array>}
 */
async function loadDailyPlan(userId, date) {
    const sb = getSupabase();
    const { data, error } = await sb.from("planner_daily_tasks")
        .select("*")
        .eq("user_id", userId)
        .eq("date", date)
        .order("order", { ascending: true });
    if (error) { console.error("[coreDataReader] loadDailyPlan:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load recent comments for a project (last 20).
 * @param {string} projectId
 * @returns {Promise<Array>}
 */
async function loadRecentComments(projectId) {
    const sb = getSupabase();
    const { data, error } = await sb.from("comments")
        .select("id, task_id, user_id, content, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20);
    if (error) { console.error("[coreDataReader] loadRecentComments:", error.message); return []; }
    return mapRows(data);
}

/**
 * Load delays for a project with cause.
 * @param {string} projectId
 * @returns {Promise<Array>}
 */
async function loadDelaysByProject(projectId) {
    const sb = getSupabase();
    const { data, error } = await sb.from("delays")
        .select("*, delay_causes(*)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
    if (error) { console.error("[coreDataReader] loadDelaysByProject:", error.message); return []; }
    return mapRows(data);
}

module.exports = {
    // Reads
    loadAllTasks,
    loadUserTasks,
    loadTask,
    loadAllProjects,
    loadProject,
    loadAllUsers,
    loadUser,
    loadAutomationParticipants,
    loadAllTimeLogs,
    loadTaskTimeLogs,
    loadUserTimeLogs,
    loadTaskUserTimeLogs,
    loadActiveTimerForUser,
    loadActiveTimerForUserTask,
    loadActiveTimersForUser,
    loadAllDelays,
    loadAllSubtasks,
    loadTaskSubtasks,

    // ARIA Intelligence Reads
    loadGanttTasks,
    loadTaskDependencies,
    loadUpcomingDeadlines,
    loadProactiveAgentConfig,
    calculateTeamWorkload,

    // ARIA Roadmap Reads
    loadProjectMilestones,
    loadAllMilestones,
    loadProjectRisks,
    loadDailyPlan,
    loadRecentComments,
    loadDelaysByProject,

    // Writes
    updateTimeLog,
    insertTimeLog,
    updateTask,
    insertTask,
    updateSubtask,
    updateUser,
    upsertUser,

    // Computed
    recalculateTaskHours,

    // Settings
    loadSetting,
};

