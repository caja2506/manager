/**
 * Rule Evaluator
 * ==============
 * 
 * Orchestrates rule evaluation across all domains (tasks, projects, planner, discipline).
 * Collects and returns all findings from the rule engine.
 */

import { evaluateAllTaskRules } from './taskRules';
import {
    evaluateUserOverCapacity,
    evaluateUserUnderutilized,
    evaluateCriticalTaskNotPlanned,
    evaluatePlannerIncompleteWeek,
} from './plannerRules';
import {
    evaluateProjectOverdueTasks,
    evaluateProjectHighDelayRate,
    evaluateProjectCriticalDependencyExpired,
} from './projectRules';
import {
    evaluateUserMissingTimelogs,
    evaluateUserLowUpdateDiscipline,
    evaluateTaskReopenedTooManyTimes,
} from './userDisciplineRules';

// ============================================================
// SINGLE ENTITY EVALUATORS
// ============================================================

/**
 * Evaluate all rules against a single task.
 * 
 * @param {Object} task
 * @param {Object} context - { timeLogs, delays, subtasks }
 * @returns {Array} findings
 */
export function evaluateTask(task, context = {}) {
    return evaluateAllTaskRules(task, context);
}

/**
 * Evaluate all rules against a single project.
 * 
 * @param {Object} project
 * @param {Object} context - { tasks, delays, dependencies }
 * @returns {Array} findings
 */
export function evaluateProject(project, context = {}) {
    const { tasks = [], delays = [], dependencies = [] } = context;
    const projectTasks = tasks.filter(t => t.projectId === project.id);
    const projectDelays = delays.filter(d => d.projectId === project.id);
    const projectDeps = dependencies.filter(d => d.projectId === project.id);

    const findings = [];

    const overdue = evaluateProjectOverdueTasks(project, projectTasks);
    if (overdue) findings.push(overdue);

    const delayRate = evaluateProjectHighDelayRate(project, projectTasks, projectDelays);
    if (delayRate) findings.push(delayRate);

    const depExpired = evaluateProjectCriticalDependencyExpired(project, projectTasks, projectDeps);
    if (depExpired) {
        // This can return an array
        if (Array.isArray(depExpired)) {
            findings.push(...depExpired);
        } else {
            findings.push(depExpired);
        }
    }

    return findings;
}

/**
 * Evaluate all rules for a user (planner + discipline).
 * 
 * @param {string} userId
 * @param {Object} context - { tasks, timeLogs, plannerSlots, userProfile, auditEvents }
 * @returns {Array} findings
 */
export function evaluateUser(userId, context = {}) {
    const {
        tasks = [],
        timeLogs = [],
        plannerSlots = [],
        userProfile = null,
        auditEvents = [],
    } = context;

    const findings = [];
    const userTasks = tasks.filter(t => t.assignedTo === userId);
    const userSlots = plannerSlots.filter(s => s.assignedTo === userId || s.createdBy === userId);
    const userLogs = timeLogs.filter(l => l.userId === userId);

    // Planner rules
    const overCap = evaluateUserOverCapacity(userId, userSlots, userProfile);
    if (overCap) findings.push(overCap);

    const underUtil = evaluateUserUnderutilized(userId, userSlots, userProfile);
    if (underUtil) findings.push(underUtil);

    const incompWeek = evaluatePlannerIncompleteWeek(userId, userSlots);
    if (incompWeek) findings.push(incompWeek);

    // Critical tasks not planned
    const criticalTasks = userTasks.filter(t =>
        ['high', 'critical'].includes(t.priority) &&
        !['completed', 'cancelled', 'backlog'].includes(t.status)
    );
    for (const task of criticalTasks) {
        const notPlanned = evaluateCriticalTaskNotPlanned(task, userSlots);
        if (notPlanned) findings.push(notPlanned);
    }

    // Discipline rules
    const missingLogs = evaluateUserMissingTimelogs(userId, userTasks, userLogs);
    if (missingLogs) findings.push(missingLogs);

    const lowUpdate = evaluateUserLowUpdateDiscipline(userId, userTasks);
    if (lowUpdate) findings.push(lowUpdate);

    // Task reopen check
    for (const task of userTasks) {
        const reopened = evaluateTaskReopenedTooManyTimes(task, auditEvents);
        if (reopened) findings.push(reopened);
    }

    return findings;
}

// ============================================================
// FULL EVALUATION
// ============================================================

/**
 * Evaluate ALL rules across the entire dataset.
 * 
 * @param {Object} data - All data from AppDataContext
 * @param {Array} data.tasks - Engineering tasks
 * @param {Array} data.projects - Engineering projects
 * @param {Array} data.timeLogs - Time logs
 * @param {Array} data.delays - Delay records
 * @param {Array} data.subtasks - Subtasks
 * @param {Array} data.plannerSlots - Weekly planner slots
 * @param {Array} data.teamMembers - Team member profiles
 * @param {Array} [data.dependencies=[]] - Task dependencies
 * @param {Array} [data.auditEvents=[]] - Audit events
 * @returns {Object} { findings, summary }
 */
export function evaluateAll(data) {
    const {
        tasks = [],
        projects = [],
        timeLogs = [],
        delays = [],
        subtasks = [],
        plannerSlots = [],
        teamMembers = [],
        dependencies = [],
        auditEvents = [],
    } = data;

    const allFindings = [];

    // ── 1. Task rules ──
    for (const task of tasks) {
        const context = {
            timeLogs: timeLogs.filter(l => l.taskId === task.id),
            delays: delays.filter(d => d.taskId === task.id),
            subtasks: subtasks.filter(s => s.taskId === task.id),
        };
        const taskFindings = evaluateTask(task, context);
        allFindings.push(...taskFindings);
    }

    // ── 2. Project rules ──
    for (const project of projects) {
        const projectFindings = evaluateProject(project, {
            tasks,
            delays,
            dependencies,
        });
        allFindings.push(...projectFindings);
    }

    // ── 3. User rules (planner + discipline) ──
    const uniqueUserIds = [...new Set(
        teamMembers.map(m => m.uid || m.id).filter(Boolean)
    )];

    for (const userId of uniqueUserIds) {
        const userProfile = teamMembers.find(m => (m.uid || m.id) === userId);
        const userFindings = evaluateUser(userId, {
            tasks,
            timeLogs,
            plannerSlots,
            userProfile,
            auditEvents,
        });
        allFindings.push(...userFindings);
    }

    // ── Build summary ──
    const summary = {
        totalFindings: allFindings.length,
        bySeverity: {
            critical: allFindings.filter(f => f.severity === 'critical').length,
            warning: allFindings.filter(f => f.severity === 'warning').length,
            info: allFindings.filter(f => f.severity === 'info').length,
        },
        byCategory: {
            task: allFindings.filter(f => f.entityType === 'task').length,
            project: allFindings.filter(f => f.entityType === 'project').length,
            user: allFindings.filter(f => f.entityType === 'user').length,
        },
        totalScoreImpact: allFindings.reduce((sum, f) => sum + (f.scoreImpact || 0), 0),
        evaluatedAt: new Date().toISOString(),
    };

    return { findings: allFindings, summary };
}
