/**
 * Snapshot Generator — Backend (CJS)
 * =====================================
 * Persists KPI results to Firestore collections:
 * - operationalKpiSnapshots (global)
 * - userOperationalScores (per user)
 * - routineOperationalScores (per routine)
 * - teamOperationalSummaries (team rollup)
 */

const paths = require("../automation/firestorePaths");
const { PERIOD_TYPE, ENTITY_TYPE } = require("./analyticsConstants");

/**
 * Persist all KPI results from the engine.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {Object} kpiResults - Output of runKpiEngine()
 * @param {string} periodType - 'daily' | 'weekly' | 'monthly'
 * @returns {Object} Summary of writes
 */
async function persistSnapshots(adminDb, kpiResults, periodType = PERIOD_TYPE.DAILY) {
    const now = new Date().toISOString();
    const { period, dataCounts } = kpiResults.metadata;
    const snapshotBase = {
        periodType,
        periodStart: period.startDate,
        periodEnd: period.endDate,
        generatedAt: now,
        engineVersion: "4.4",
    };

    const writes = { global: 0, users: 0, routines: 0, team: 0 };

    // 1. Global KPI snapshot
    const globalDocId = `${period.startDate}_${period.endDate}_${periodType}_global`;
    await adminDb.collection(paths.OPERATIONAL_KPI_SNAPSHOTS).doc(globalDocId).set({
        ...snapshotBase,
        entityType: ENTITY_TYPE.GLOBAL,
        entityId: "global",
        metrics: serializeKpis(kpiResults.global),
        dataCounts,
    });
    writes.global = 1;

    // 2. Per-user scores
    const batch1 = adminDb.batch();
    let userCount = 0;
    for (const [userId, userData] of Object.entries(kpiResults.byUser)) {
        const docId = `${period.startDate}_${periodType}_${userId}`;
        const ref = adminDb.collection(paths.USER_OPERATIONAL_SCORES).doc(docId);
        batch1.set(ref, {
            ...snapshotBase,
            entityType: ENTITY_TYPE.USER,
            entityId: userId,
            userName: userData.userName,
            userRole: userData.userRole,
            metrics: serializeKpis(userData.kpis),
        });
        userCount++;
        if (userCount >= 400) break; // Batch limit safety
    }
    if (userCount > 0) {
        await batch1.commit();
        writes.users = userCount;
    }

    // 3. Per-routine scores
    const batch2 = adminDb.batch();
    let routineCount = 0;
    for (const [routineKey, routineData] of Object.entries(kpiResults.byRoutine)) {
        const docId = `${period.startDate}_${periodType}_${routineKey}`;
        const ref = adminDb.collection(paths.ROUTINE_OPERATIONAL_SCORES).doc(docId);
        batch2.set(ref, {
            ...snapshotBase,
            entityType: ENTITY_TYPE.ROUTINE,
            entityId: routineKey,
            routineName: routineData.routineName,
            totalRuns: routineData.totalRuns,
            enabled: routineData.enabled,
            metrics: serializeKpis(routineData.kpis),
        });
        routineCount++;
    }
    if (routineCount > 0) {
        await batch2.commit();
        writes.routines = routineCount;
    }

    // 4. Team/role summaries
    const batch3 = adminDb.batch();
    let roleCount = 0;
    for (const [role, roleData] of Object.entries(kpiResults.byRole)) {
        const docId = `${period.startDate}_${periodType}_role_${role}`;
        const ref = adminDb.collection(paths.TEAM_OPERATIONAL_SUMMARIES).doc(docId);
        batch3.set(ref, {
            ...snapshotBase,
            entityType: ENTITY_TYPE.ROLE,
            entityId: role,
            userCount: roleData.userCount,
            metrics: serializeKpis(roleData.kpis),
        });
        roleCount++;
    }
    if (roleCount > 0) {
        await batch3.commit();
        writes.team = roleCount;
    }

    console.log(`[snapshotGenerator] Persisted: ${JSON.stringify(writes)}`);
    return writes;
}

/**
 * Serialize KPI results for Firestore storage.
 * Strips functions, ensures no undefined values.
 */
function serializeKpis(kpis) {
    const result = {};
    for (const [key, val] of Object.entries(kpis)) {
        if (typeof val === "object" && val !== null && "value" in val) {
            result[key] = {
                value: val.value ?? 0,
                numerator: val.numerator ?? 0,
                denominator: val.denominator ?? 0,
                source: val.source || "unknown",
            };
        } else if (typeof val === "number") {
            result[key] = { value: val };
        } else {
            result[key] = val;
        }
    }
    return result;
}

/**
 * Load a previous snapshot for trend comparison.
 */
async function loadPreviousSnapshot(adminDb, periodStart, periodEnd, periodType, entityType, entityId) {
    const docId = `${periodStart}_${periodEnd}_${periodType}_${entityId || entityType}`;
    const doc = await adminDb.collection(paths.OPERATIONAL_KPI_SNAPSHOTS).doc(docId).get();
    return doc.exists ? doc.data() : null;
}

module.exports = { persistSnapshots, serializeKpis, loadPreviousSnapshot };
