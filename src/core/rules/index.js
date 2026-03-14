/**
 * Rules Module — Barrel Export
 * ============================
 */

export { RULE_CATALOG, RULE_CATEGORY, getRulesByCategory, getRuleById, getEnabledRules, getRuleCount } from './ruleCatalog';
export { evaluateTask, evaluateProject, evaluateUser, evaluateAll } from './ruleEvaluator';
export { TASK_RULES, evaluateAllTaskRules } from './taskRules';
export { PLANNER_RULES } from './plannerRules';
export { PROJECT_RULES } from './projectRules';
export { USER_DISCIPLINE_RULES } from './userDisciplineRules';
