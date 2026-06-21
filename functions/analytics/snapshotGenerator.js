/**
 * Snapshot Generator — Backend (CJS)
 * =====================================
 * Persists KPI results to Supabase analytics_snapshots table.
 * Replaces Firestore collections (operationalKpiSnapshots, userOperationalScores, etc.).
 */

const { getSupabase } = require("../db/supabaseAdmin");

/**
 * Persist all KPI results from the engine.
 *
 * @param {any} adminDb - Deprecated, kept for signature compatibility
 * @param {Object} kpiResults - Output of runKpiEngine()
 * @param {string} periodType - 'daily' | 'weekly' | 'monthly'
 * @returns {Promise<Object>} Summary of writes
 */
async function persistSnapshots(adminDb, kpiResults, periodType = "daily") {
    const sb = getSupabase();
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
    const records = [];

    // 1. Global KPI snapshot
    records.push({
        scope: "global",
        entity_id: "global",
        snapshot_date: period.startDate,
        metrics: {
            ...snapshotBase,
            entityType: "global",
            entityId: "global",
            metrics: serializeKpis(kpiResults.global),
            dataCounts,
        }
    });
    writes.global = 1;

    // 2. Per-user scores
    for (const [userId, userData] of Object.entries(kpiResults.byUser)) {
        records.push({
            scope: "user",
            entity_id: userId,
            snapshot_date: period.startDate,
            metrics: {
                ...snapshotBase,
                entityType: "user",
                entityId: userId,
                userName: userData.userName,
                userRole: userData.userRole,
                metrics: serializeKpis(userData.kpis),
            }
        });
        writes.users++;
    }

    // 3. Per-routine scores
    for (const [routineKey, routineData] of Object.entries(kpiResults.byRoutine)) {
        records.push({
            scope: "routine",
            entity_id: routineKey,
            snapshot_date: period.startDate,
            metrics: {
                ...snapshotBase,
                entityType: "routine",
                entityId: routineKey,
                routineName: routineData.routineName,
                totalRuns: routineData.totalRuns,
                enabled: routineData.enabled,
                metrics: serializeKpis(routineData.kpis),
            }
        });
        writes.routines++;
    }

    // 4. Team/role summaries
    for (const [role, roleData] of Object.entries(kpiResults.byRole)) {
        records.push({
            scope: "role",
            entity_id: role,
            snapshot_date: period.startDate,
            metrics: {
                ...snapshotBase,
                entityType: "role",
                entityId: role,
                userCount: roleData.userCount,
                metrics: serializeKpis(roleData.kpis),
            }
        });
        writes.team++;
    }

    // Delete existing records to avoid duplicates when re-running
    const scopes = ["global", "user", "routine", "role"];
    const { error: deleteError } = await sb.from("analytics_snapshots")
        .delete()
        .eq("snapshot_date", period.startDate)
        .in("scope", scopes)
        .eq("metrics->>periodType", periodType);

    if (deleteError) {
        console.error("[snapshotGenerator] Error deleting previous snapshots:", deleteError.message);
    }

    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error: insertError } = await sb.from("analytics_snapshots").insert(batch);
        if (insertError) {
            console.error(`[snapshotGenerator] Error inserting snapshots batch [${i}]:`, insertError.message);
            throw insertError;
        }
    }

    console.log(`[snapshotGenerator] Persisted to Supabase: ${JSON.stringify(writes)}`);
    return writes;
}

/**
 * Serialize KPI results for database storage.
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
    const sb = getSupabase();
    let scope = "global";
    if (entityType === "user") scope = "user";
    if (entityType === "routine") scope = "routine";
    if (entityType === "role") scope = "role";
    if (entityType === "compliance") scope = "compliance";

    const { data, error } = await sb.from("analytics_snapshots")
        .select("*")
        .eq("scope", scope)
        .eq("entity_id", entityId || "global")
        .eq("snapshot_date", periodStart)
        .eq("metrics->>periodType", periodType)
        .maybeSingle();

    if (error) {
        console.warn("[snapshotGenerator] loadPreviousSnapshot error:", error.message);
        return null;
    }
    return data ? data.metrics : null;
}

module.exports = { persistSnapshots, serializeKpis, loadPreviousSnapshot };

