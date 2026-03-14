/**
 * Audit Module — Barrel Export
 * ============================
 */

export { runAudit, runTaskAudit, runProjectAudit } from './auditEngine';
export { buildFindingDocument, buildFindingDocuments, getFindingKey, deduplicateFindings } from './findingBuilder';
export {
    calculateEntityScore,
    calculateMethodologyCompliance,
    calculatePlanningReliability,
    calculateEstimationAccuracy,
    calculateDataDiscipline,
    calculateProjectHealth,
    calculateAllScores,
} from './complianceScorer';
