/**
 * Finding Builder
 * ===============
 * 
 * Converts raw rule findings into Firestore-ready auditFinding documents.
 */

import { createAuditFindingDocument, AUDIT_FINDING_STATUS } from '../../models/schemas';

/**
 * Build a Firestore-ready auditFinding document from a rule finding.
 * 
 * @param {Object} finding - Raw finding from a rule evaluator
 * @param {Object} [overrides={}] - Additional fields to set
 * @returns {Object} Firestore-ready document
 */
export function buildFindingDocument(finding, overrides = {}) {
    return createAuditFindingDocument({
        entityType: finding.entityType,
        entityId: finding.entityId,
        ruleId: finding.ruleId,
        severity: finding.severity,
        status: AUDIT_FINDING_STATUS.OPEN,
        title: finding.title,
        message: finding.message,
        recommendedAction: finding.recommendedAction,
        scoreImpact: finding.scoreImpact || 0,
        source: 'rule_engine',
        metadata: finding.metadata || {},
        ...overrides,
    });
}

/**
 * Build a batch of Firestore-ready finding documents.
 * 
 * @param {Array} findings - Array of raw findings
 * @param {Object} [overrides={}] - Additional fields to set on all documents
 * @returns {Array} Array of Firestore-ready documents
 */
export function buildFindingDocuments(findings, overrides = {}) {
    return findings.map(f => buildFindingDocument(f, overrides));
}

/**
 * Create a finding key for deduplication.
 * Two findings with the same key are considered duplicates.
 * 
 * @param {Object} finding
 * @returns {string}
 */
export function getFindingKey(finding) {
    return `${finding.ruleId}::${finding.entityType}::${finding.entityId}`;
}

/**
 * Deduplicate findings against existing open findings.
 * Only returns findings that don't already exist as open in Firestore.
 * 
 * @param {Array} newFindings - Newly evaluated findings
 * @param {Array} existingFindings - Currently open findings from Firestore
 * @returns {Object} { toCreate, toResolve, unchanged }
 */
export function deduplicateFindings(newFindings, existingFindings) {
    const newKeys = new Set(newFindings.map(f => getFindingKey(f)));
    const existingKeys = new Set(existingFindings.map(f => getFindingKey(f)));

    // New findings that don't exist yet → create
    const toCreate = newFindings.filter(f => !existingKeys.has(getFindingKey(f)));

    // Existing findings that are no longer detected → resolve
    const toResolve = existingFindings.filter(f => !newKeys.has(getFindingKey(f)));

    // Existing findings that still match → unchanged
    const unchanged = existingFindings.filter(f => newKeys.has(getFindingKey(f)));

    return { toCreate, toResolve, unchanged };
}
