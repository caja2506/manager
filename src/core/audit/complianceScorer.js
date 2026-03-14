/**
 * Compliance Scorer
 * =================
 * 
 * Computes compliance and health scores from audit findings.
 * Scores range from 0 to 100 (100 = perfect compliance).
 */

// ============================================================
// SCORE CALCULATORS
// ============================================================

/**
 * Calculate a compliance score for an entity based on its findings.
 * Starts at 100 and subtracts score impacts from findings.
 * 
 * @param {Array} findings - Findings for this entity
 * @returns {number} Score 0-100
 */
export function calculateEntityScore(findings) {
    const totalImpact = findings.reduce((sum, f) => sum + Math.abs(f.scoreImpact || 0), 0);
    return Math.max(0, Math.min(100, 100 - totalImpact));
}

/**
 * Calculate Methodology Compliance Score.
 * Based on: task rules compliance across all tasks.
 * 
 * @param {Array} taskFindings - All task-related findings
 * @param {number} totalTasks - Total number of active tasks
 * @returns {number} Score 0-100
 */
export function calculateMethodologyCompliance(taskFindings, totalTasks) {
    if (totalTasks === 0) return 100;

    const tasksWithIssues = new Set(taskFindings.map(f => f.entityId)).size;
    const complianceRate = 1 - (tasksWithIssues / totalTasks);
    return Math.round(complianceRate * 100);
}

/**
 * Calculate Planning Reliability Score.
 * Based on: planner completeness and capacity utilization.
 * 
 * @param {Array} plannerFindings - All planner-related findings
 * @param {number} totalUsers - Total team members
 * @returns {number} Score 0-100
 */
export function calculatePlanningReliability(plannerFindings, totalUsers) {
    if (totalUsers === 0) return 100;

    const usersWithIssues = new Set(plannerFindings.map(f => f.entityId)).size;
    const reliabilityRate = 1 - (usersWithIssues / totalUsers);
    return Math.round(reliabilityRate * 100);
}

/**
 * Calculate Estimation Accuracy Score.
 * Based on: ratio of actual hours vs estimated hours for completed tasks.
 * 
 * @param {Array} completedTasks - Completed tasks with estimatedHours and actualHours
 * @returns {number} Score 0-100
 */
export function calculateEstimationAccuracy(completedTasks) {
    if (completedTasks.length === 0) return 100;

    const tasksWithEstimates = completedTasks.filter(
        t => t.estimatedHours > 0 && t.actualHours > 0
    );

    if (tasksWithEstimates.length === 0) return 50; // No data = neutral

    // Calculate accuracy: 1 - avg(abs(actual - estimated) / estimated)
    const accuracies = tasksWithEstimates.map(t => {
        const ratio = t.actualHours / t.estimatedHours;
        // Perfect accuracy = 1.0. Penalize both over and under estimation.
        const deviation = Math.abs(1 - ratio);
        return Math.max(0, 1 - deviation);
    });

    const avgAccuracy = accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length;
    return Math.round(avgAccuracy * 100);
}

/**
 * Calculate Data Discipline Score.
 * Based on: discipline-related findings (missing timelogs, stale tasks, low updates).
 * 
 * @param {Array} disciplineFindings - User discipline findings
 * @param {number} totalUsers - Total team members
 * @returns {number} Score 0-100
 */
export function calculateDataDiscipline(disciplineFindings, totalUsers) {
    if (totalUsers === 0) return 100;

    const usersWithIssues = new Set(disciplineFindings.map(f => f.entityId)).size;
    const disciplineRate = 1 - (usersWithIssues / totalUsers);
    return Math.round(disciplineRate * 100);
}

/**
 * Calculate Project Health Score.
 * Combines risk, overdue, and delay factors.
 * 
 * @param {Array} projectFindings - All project-related findings
 * @param {number} totalProjects - Total active projects
 * @returns {number} Score 0-100
 */
export function calculateProjectHealth(projectFindings, totalProjects) {
    if (totalProjects === 0) return 100;

    const projectsWithIssues = new Set(projectFindings.map(f => f.entityId)).size;
    const healthRate = 1 - (projectsWithIssues / totalProjects);
    return Math.round(healthRate * 100);
}

// ============================================================
// AGGREGATE SCORE
// ============================================================

/**
 * Calculate all compliance scores from a full evaluation result.
 * 
 * @param {Object} evaluationResult - Output from ruleEvaluator.evaluateAll()
 * @param {Object} context - { totalTasks, totalProjects, totalUsers, completedTasks }
 * @returns {Object} All compliance scores
 */
export function calculateAllScores(evaluationResult, context) {
    const { findings } = evaluationResult;
    const {
        totalTasks = 0,
        totalProjects = 0,
        totalUsers = 0,
        completedTasks = [],
    } = context;

    const taskFindings = findings.filter(f => f.entityType === 'task');
    const projectFindings = findings.filter(f => f.entityType === 'project');
    const userFindings = findings.filter(f => f.entityType === 'user');

    // Separate planner and discipline findings from user findings
    const plannerRuleIds = ['USER_OVER_CAPACITY', 'USER_UNDERUTILIZED', 'CRITICAL_TASK_NOT_PLANNED', 'PLANNER_INCOMPLETE_WEEK'];
    const disciplineRuleIds = ['USER_MISSING_TIMELOGS', 'USER_LOW_UPDATE_DISCIPLINE', 'TASK_REOPENED_TOO_MANY_TIMES'];

    const plannerFindings = userFindings.filter(f => plannerRuleIds.includes(f.ruleId));
    const disciplineFindings = userFindings.filter(f => disciplineRuleIds.includes(f.ruleId));

    return {
        methodologyCompliance: calculateMethodologyCompliance(taskFindings, totalTasks),
        planningReliability: calculatePlanningReliability(plannerFindings, totalUsers),
        estimationAccuracy: calculateEstimationAccuracy(completedTasks),
        dataDiscipline: calculateDataDiscipline(disciplineFindings, totalUsers),
        projectHealth: calculateProjectHealth(projectFindings, totalProjects),
        calculatedAt: new Date().toISOString(),
    };
}
