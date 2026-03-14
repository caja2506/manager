/**
 * Audit Engine
 * ============
 * 
 * Orchestrates the full audit cycle:
 *   1. Run all rules via ruleEvaluator
 *   2. Deduplicate against existing findings
 *   3. Calculate compliance scores
 *   4. Optionally persist to Firestore
 * 
 * Designed to run client-side (Phase 3) and later server-side (Phase 9 Cloud Functions).
 */

import { evaluateAll, evaluateTask, evaluateProject } from '../rules/ruleEvaluator';
import { buildFindingDocuments, deduplicateFindings } from './findingBuilder';
import { calculateAllScores } from './complianceScorer';
import { isTerminalStatus } from '../workflow/workflowModel';

// ============================================================
// AUDIT ENGINE
// ============================================================

/**
 * Run a full audit against the current dataset.
 * Returns findings, scores, and persistence-ready data.
 * 
 * @param {Object} data - All data from AppDataContext
 * @param {Array} data.engTasks - Engineering tasks (uses 'engTasks' from context)
 * @param {Array} data.engProjects - Engineering projects
 * @param {Array} data.timeLogs - Time logs
 * @param {Array} data.delays - Delay records
 * @param {Array} data.engSubtasks - Subtasks
 * @param {Array} data.teamMembers - Team member profiles
 * @param {Array} [data.plannerSlots=[]] - Weekly planner slots
 * @param {Array} [data.existingFindings=[]] - Currently open findings in Firestore
 * @param {Array} [data.dependencies=[]] - Task dependencies
 * @param {Array} [data.auditEvents=[]] - Audit events
 * @returns {Object} AuditResult
 */
export function runAudit(data) {
    const {
        engTasks = [],
        engProjects = [],
        timeLogs = [],
        delays = [],
        engSubtasks = [],
        teamMembers = [],
        plannerSlots = [],
        existingFindings = [],
        dependencies = [],
        auditEvents = [],
    } = data;

    // ── 1. Run all rules ──
    const evaluationResult = evaluateAll({
        tasks: engTasks,
        projects: engProjects,
        timeLogs,
        delays,
        subtasks: engSubtasks,
        plannerSlots,
        teamMembers,
        dependencies,
        auditEvents,
    });

    // ── 2. Deduplicate ──
    const { toCreate, toResolve, unchanged } = deduplicateFindings(
        evaluationResult.findings,
        existingFindings
    );

    // ── 3. Build persistence-ready documents ──
    const newFindingDocs = buildFindingDocuments(toCreate);

    // ── 4. Calculate scores ──
    const activeTasks = engTasks.filter(t => !isTerminalStatus(t.status));
    const completedTasks = engTasks.filter(t => t.status === 'completed');
    const activeProjects = engProjects.filter(p =>
        !['completed', 'cancelled'].includes(p.status)
    );

    const scores = calculateAllScores(evaluationResult, {
        totalTasks: activeTasks.length,
        totalProjects: activeProjects.length,
        totalUsers: teamMembers.length,
        completedTasks,
    });

    // ── 5. Build result ──
    return {
        // Evaluation results
        findings: evaluationResult.findings,
        summary: evaluationResult.summary,

        // Persistence data
        persistence: {
            toCreate: newFindingDocs,
            toResolve: toResolve.map(f => ({
                id: f.id,
                ruleId: f.ruleId,
                entityId: f.entityId,
            })),
            unchanged: unchanged.length,
        },

        // Scores
        scores,

        // Metadata
        auditedAt: new Date().toISOString(),
        dataSnapshot: {
            totalTasks: engTasks.length,
            activeTasks: activeTasks.length,
            completedTasks: completedTasks.length,
            totalProjects: engProjects.length,
            activeProjects: activeProjects.length,
            totalUsers: teamMembers.length,
        },
    };
}

/**
 * Run a focused audit on a single task.
 * Lighter weight than a full audit — useful for real-time UI feedback.
 * 
 * @param {Object} task - The task to audit
 * @param {Object} context - { timeLogs, delays, subtasks }
 * @returns {Object} { findings, score }
 */
export function runTaskAudit(task, context = {}) {
    const findings = evaluateTask(task, context);
    const score = Math.max(0, 100 - findings.reduce((sum, f) => sum + Math.abs(f.scoreImpact || 0), 0));

    return {
        findings,
        score,
        taskId: task.id,
        auditedAt: new Date().toISOString(),
    };
}

/**
 * Run a focused audit on a single project.
 * 
 * @param {Object} project
 * @param {Object} context - { tasks, delays, dependencies }
 * @returns {Object} { findings, score }
 */
export function runProjectAudit(project, context = {}) {
    const findings = evaluateProject(project, context);
    const score = Math.max(0, 100 - findings.reduce((sum, f) => sum + Math.abs(f.scoreImpact || 0), 0));

    return {
        findings,
        score,
        projectId: project.id,
        auditedAt: new Date().toISOString(),
    };
}
