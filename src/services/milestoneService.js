/**
 * Milestone Service — V5 Phase 3
 * =================================
 * CRUD + score computation via scoreEngine + snapshot capture.
 * Delegates all scoring to src/core/scoring/scoreEngine.js
 *
 * @module services/milestoneService
 */

import {
    collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc,
    query, where, orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import {
    COLLECTIONS,
    createMilestoneDocument,
    createScoreSnapshotDocument,
} from '../models/schemas';
import {
    computeAreaScore as engineComputeAreaScore,
    computeMilestoneScore as engineComputeMilestoneScore,
    explainScore,
} from '../core/scoring/scoreEngine';
import { computeTrend, computeAreaTrends, generateChangeReason } from '../core/scoring/trendCalculator';

// ── Re-export engine functions for backward compat ──
export { explainScore } from '../core/scoring/scoreEngine';
export { computeTrend, computeAreaTrends } from '../core/scoring/trendCalculator';

// ── CRUD ──

/**
 * Create a new milestone for a project.
 */
export async function createMilestone(projectId, data, userId) {
    const milestoneData = createMilestoneDocument({
        ...data,
        projectId,
        createdBy: userId,
        updatedBy: userId,
    });
    const ref = await addDoc(collection(db, COLLECTIONS.MILESTONES), milestoneData);
    return ref.id;
}

/**
 * Update a milestone.
 */
export async function updateMilestone(milestoneId, updates, userId) {
    const ref = doc(db, COLLECTIONS.MILESTONES, milestoneId);
    await updateDoc(ref, {
        ...updates,
        updatedBy: userId,
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Delete a milestone.
 */
export async function deleteMilestone(milestoneId) {
    await deleteDoc(doc(db, COLLECTIONS.MILESTONES, milestoneId));
}

/**
 * Get all milestones for a project.
 */
export async function getMilestonesByProject(projectId) {
    const q = query(
        collection(db, COLLECTIONS.MILESTONES),
        where('projectId', '==', projectId)
    );
    const snap = await getDocs(q);
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort client-side to avoid composite index requirement
    return results.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
}

// ── Score Computation (delegates to scoreEngine) ──

/**
 * Full score computation for a milestone.
 * Orchestrates area scoring, milestone aggregation, trend, and explanation.
 *
 * @param {Object} milestone - Milestone document data
 * @param {Array} workAreas - Work area documents (with areaId)
 * @param {Object} tasksByArea - { [areaId]: Task[] }
 * @param {Object} [options]
 * @param {Object} [options.delaysByArea] - { [areaId]: Delay[] }
 * @param {Object} [options.risksByArea] - { [areaId]: Risk[] }
 * @param {Array}  [options.snapshots] - Historical snapshots for trend
 * @returns {{ milestone: MilestoneScoreResult, areas: Object, explanation: Object }}
 */
export function computeFullScore(milestone, workAreas, tasksByArea, options = {}) {
    const {
        delaysByArea = {},
        risksByArea = {},
        snapshots = [],
    } = options;

    // 1. Compute each area
    const areaResults = {};
    const areaResultsArray = [];

    for (const area of workAreas) {
        const areaTasks = tasksByArea[area.id] || [];
        const areaDelays = delaysByArea[area.id] || [];
        const areaRisks = risksByArea[area.id] || [];

        const override = area.trafficLightOverride ? {
            value: area.trafficLightOverride,
            reason: area.trafficLightOverrideReason,
            expiresAt: area.trafficLightOverrideExpires,
        } : null;

        const result = engineComputeAreaScore(areaTasks, {
            milestoneDueDate: milestone.dueDate,
            delays: areaDelays,
            risks: areaRisks,
            override,
        });

        areaResults[area.id] = {
            ...result,
            areaId: area.id,
            areaName: area.name,
            explanation: explainScore(result),
        };
        areaResultsArray.push(result);
    }

    // 2. Compute milestone score
    const milestoneOverride = milestone.trafficLightOverride ? {
        value: milestone.trafficLightOverride,
        reason: milestone.trafficLightOverrideReason,
        expiresAt: milestone.trafficLightOverrideExpires,
    } : null;

    const milestoneResult = engineComputeMilestoneScore(areaResultsArray, {
        override: milestoneOverride,
    });

    // 3. Compute trends
    const milestoneTrend = computeTrend(milestoneResult.score, snapshots);
    const currentAreaScores = Object.entries(areaResults).map(([areaId, r]) => ({
        areaId,
        score: r.score,
    }));
    const areaTrends = computeAreaTrends(currentAreaScores, snapshots);

    return {
        milestone: {
            ...milestoneResult,
            trend: milestoneTrend,
        },
        areas: Object.fromEntries(
            Object.entries(areaResults).map(([areaId, r]) => [areaId, {
                ...r,
                trend: areaTrends[areaId] || 'stable',
            }])
        ),
    };
}

// ── Override (E) ──

/**
 * Apply a traffic light override (auditable).
 * Only manager, team_lead, or admin should call this.
 */
export async function applyTrafficLightOverride(milestoneId, override, userId) {
    await updateMilestone(milestoneId, {
        trafficLightOverride: override.value,
        trafficLightOverrideReason: override.reason,
        trafficLightOverrideBy: userId,
        trafficLightOverrideAt: new Date().toISOString(),
        trafficLightOverrideExpires: override.expiresAt,
    }, userId);
}

// ── Snapshots (G) ──

/**
 * Capture an enhanced score snapshot with trend and change reason.
 */
export async function captureScoreSnapshot(milestoneId, projectId, fullScoreResult, options = {}) {
    const {
        triggeredBy = 'system',
        snapshotType = 'scheduled',
        previousSnapshots = [],
        comment = null,
    } = options;

    const prevScore = previousSnapshots.length > 0
        ? previousSnapshots[0].milestoneScore
        : null;

    const changeReason = prevScore !== null
        ? generateChangeReason(
            prevScore,
            fullScoreResult.milestone.score,
            fullScoreResult.milestone.locks,
            [] // penalties are at area level
        )
        : 'Snapshot inicial';

    const snapshot = createScoreSnapshotDocument({
        milestoneId,
        projectId,
        snapshotType,
        milestoneScore: fullScoreResult.milestone.score,
        milestoneTrafficLight: fullScoreResult.milestone.trafficLight.value,
        milestoneStatus: 'active',
        areaScores: Object.entries(fullScoreResult.areas).map(([areaId, r]) => ({
            areaId,
            name: r.areaName || '',
            score: r.score,
            trafficLight: r.trafficLight.value,
            trend: r.trend,
        })),
        activeLocks: fullScoreResult.milestone.locks,
        activePenalties: {},
        triggeredBy,
    });

    // Add enhanced fields
    snapshot.changeReason = changeReason;
    snapshot.trend = fullScoreResult.milestone.trend;
    snapshot.comment = comment;

    await addDoc(collection(db, COLLECTIONS.SCORE_SNAPSHOTS), snapshot);
}

/**
 * Get historical snapshots for a milestone.
 */
export async function getScoreSnapshots(milestoneId, limit = 100) {
    const q = query(
        collection(db, COLLECTIONS.SCORE_SNAPSHOTS),
        where('milestoneId', '==', milestoneId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.capturedAt || '').localeCompare(a.capturedAt || ''))
        .slice(0, limit);
}
