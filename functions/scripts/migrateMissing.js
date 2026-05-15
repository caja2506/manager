/**
 * Firestore → Supabase REMEDIATION Script
 * =========================================
 * Migrates collections that were MISSED in the original migration:
 *   1. project_stations (subcollections from each project)
 *   2. work_areas (8 records)
 *   3. milestones (3 records)
 *   4. task_dependencies (8 records)
 *   5. audit_events (340 records)
 *   6. audit_findings (1,262 records)
 *   7. analytics_snapshots (61 records)
 *
 * Then FIXES references in tasks:
 *   - station_id: remap Firestore IDs to new Supabase IDs
 *   - area_id: remap using work_areas (not work_area_types)
 *   - Clean empty strings → NULL
 *
 * USAGE:
 *   cd functions
 *   node scripts/migrateMissing.js --dry-run
 *   node scripts/migrateMissing.js
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// ── Config ──
const PROJECT_ID = "bom-ame-cr";
const SUPABASE_URL = "https://mkymgptfmtlqpdswvywo.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_SERVICE_KEY) throw new Error("Missing SUPABASE_SERVICE_KEY env var.");

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Auth ──
async function getAccessToken() {
    const credPath = path.join(
        process.env.APPDATA || process.env.HOME,
        "firebase",
        "caja2506_gmail_com_application_default_credentials.json"
    );
    if (!fs.existsSync(credPath)) throw new Error("Firebase CLI creds not found.");
    const creds = JSON.parse(fs.readFileSync(credPath, "utf8"));
    const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: creds.client_id, client_secret: creds.client_secret,
            refresh_token: creds.refresh_token, grant_type: "refresh_token",
        }),
    });
    const data = await resp.json();
    if (!data.access_token) throw new Error("Token failed: " + JSON.stringify(data));
    return data.access_token;
}

// ── Firestore helpers ──
async function readCollection(collectionPath, accessToken) {
    const docs = [];
    let pageToken = null;
    do {
        let url = `${FIRESTORE_BASE}/${collectionPath}?pageSize=300`;
        if (pageToken) url += `&pageToken=${pageToken}`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!resp.ok) { console.error(`  ⚠️  Read ${collectionPath} failed: ${resp.status}`); break; }
        const body = await resp.json();
        if (body.documents) {
            for (const doc of body.documents) {
                const id = doc.name.split("/").pop();
                docs.push({ ...parseDoc(doc.fields || {}), _firestoreId: id });
            }
        }
        pageToken = body.nextPageToken || null;
    } while (pageToken);
    return docs;
}

function parseDoc(fields) {
    const r = {};
    for (const [k, v] of Object.entries(fields)) r[k] = parseVal(v);
    return r;
}

function parseVal(v) {
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return v.doubleValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.nullValue !== undefined) return null;
    if (v.timestampValue !== undefined) return v.timestampValue;
    if (v.arrayValue) return (v.arrayValue.values || []).map(parseVal);
    if (v.mapValue) return parseDoc(v.mapValue.fields || {});
    return null;
}

// ── ID mapping (load existing from Supabase) ──
const idMap = {}; // { tableName: { firestoreId: supabaseId } }

function cacheId(table, fsId, sbId) {
    if (!idMap[table]) idMap[table] = {};
    idMap[table][fsId] = sbId;
}
function lookupId(table, fsId) {
    return fsId ? (idMap[table]?.[fsId] || null) : null;
}

async function loadExistingIdMaps() {
    console.log("\n📦 Loading existing ID mappings from Supabase...");
    const tables = ["projects", "tasks", "task_types", "milestone_types",
        "work_area_types", "delay_causes", "users", "milestones", "work_areas"];
    for (const t of tables) {
        const { data, error } = await supabase.from(t).select("id, firestore_id");
        if (error) { console.log(`  ⚠️  ${t}: ${error.message}`); continue; }
        if (data) {
            for (const r of data) {
                if (r.firestore_id) cacheId(t, r.firestore_id, r.id);
            }
            console.log(`  ✅ ${t}: ${data.length} IDs cached`);
        }
    }
    // Also cache users by their raw ID (users.id = Firebase UID)
    const { data: users } = await supabase.from("users").select("id");
    if (users) for (const u of users) cacheId("users", u.id, u.id);
}

// ── Upsert helper ──
async function upsertRows(table, rows, conflictCol = "firestore_id") {
    if (rows.length === 0) { console.log(`  ⏭️  ${table}: 0 rows`); return 0; }
    if (DRY_RUN) {
        console.log(`  [DRY] ${table}: would insert ${rows.length}`);
        console.log(`  Sample:`, JSON.stringify(rows[0], null, 2).substring(0, 300));
        return rows.length;
    }

    let inserted = 0, errors = 0;
    const BATCH = 200;
    for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { data, error } = await supabase
            .from(table).upsert(batch, { onConflict: conflictCol }).select("id, firestore_id");
        if (error) {
            console.error(`  ❌ Batch error: ${error.message}`);
            // Fallback: insert one by one
            for (const row of batch) {
                const { data: s, error: e } = await supabase
                    .from(table).upsert(row, { onConflict: conflictCol }).select("id, firestore_id").single();
                if (e) { console.error(`    ✗ ${row.firestore_id}: ${e.message}`); errors++; }
                else if (s) { if (s.firestore_id) cacheId(table, s.firestore_id, s.id); inserted++; }
            }
        } else if (data) {
            for (const r of data) { if (r.firestore_id) cacheId(table, r.firestore_id, r.id); }
            inserted += data.length;
        }
    }
    console.log(`  ✅ ${table}: ${inserted} ok | ${errors} err`);
    return inserted;
}

// ══════════════════════════════════════════════
// PHASE 1: Migrate project_stations (subcollections)
// ══════════════════════════════════════════════
async function migrateStations(accessToken) {
    console.log("\n═══════════════════════════════════════");
    console.log("  PHASE 1: project_stations (subcollections)");
    console.log("═══════════════════════════════════════");

    const projects = await readCollection("projects", accessToken);
    console.log(`  Found ${projects.length} projects`);

    const allStations = [];
    for (const p of projects) {
        const projectFsId = p._firestoreId;
        const projectSbId = lookupId("projects", projectFsId);
        const stations = await readCollection(`projects/${projectFsId}/stations`, accessToken);
        console.log(`  Project "${p.name}" (${projectFsId}): ${stations.length} stations`);

        for (const s of stations) {
            allStations.push({
                firestore_id: s._firestoreId,
                project_id: projectSbId,
                indx: s.stn ? parseInt(s.stn) : (s.index || s.indx || 0),
                stn: s.stn || "",
                abbreviation: s.abbreviation || "",
                description: s.description || "",
                sort_order: s.sortOrder || s.order || 0,
                active: s.active !== false,
                created_by: s.createdBy || null,
            });
        }
    }

    console.log(`  Total stations: ${allStations.length}`);
    return upsertRows("project_stations", allStations);
}

// ══════════════════════════════════════════════
// PHASE 2: Migrate milestones
// ══════════════════════════════════════════════
async function migrateMilestones(accessToken) {
    console.log("\n═══════════════════════════════════════");
    console.log("  PHASE 2: milestones");
    console.log("═══════════════════════════════════════");

    const docs = await readCollection("milestones", accessToken);
    console.log(`  Firestore docs: ${docs.length}`);

    const rows = docs.map(d => ({
        firestore_id: d._firestoreId,
        project_id: lookupId("projects", d.projectId),
        name: d.name || "",
        description: d.description || "",
        status: d.status || "planning",
        due_date: d.dueDate || null,
        start_date: d.startDate || null,
        completed_date: d.completedDate || null,
        score: d.scoreGeneral || d.score || 0,
        traffic_light: d.trafficLight || "gray",
        traffic_light_override: d.trafficLightOverride || null,
        traffic_light_override_reason: d.trafficLightOverrideReason || "",
        traffic_light_override_by: d.trafficLightOverrideBy || null,
        traffic_light_override_at: d.trafficLightOverrideAt || null,
        traffic_light_override_expires: d.trafficLightOverrideExpires || null,
        created_by: d.createdBy || null,
        created_at: d.createdAt || new Date().toISOString(),
    }));

    return upsertRows("milestones", rows);
}

// ══════════════════════════════════════════════
// PHASE 3: Migrate work_areas
// ══════════════════════════════════════════════
async function migrateWorkAreas(accessToken) {
    console.log("\n═══════════════════════════════════════");
    console.log("  PHASE 3: work_areas");
    console.log("═══════════════════════════════════════");

    const docs = await readCollection("workAreas", accessToken);
    console.log(`  Firestore docs: ${docs.length}`);

    const rows = docs.map(d => ({
        firestore_id: d._firestoreId,
        milestone_id: lookupId("milestones", d.milestoneId),
        project_id: lookupId("projects", d.projectId),
        name: d.name || "",
        description: d.description || "",
        task_filter: d.taskFilter || {},
        task_type_ids: d.taskTypeIds || [],
        score: d.score || 0,
        traffic_light: d.trafficLight || "gray",
        traffic_light_override: d.trafficLightOverride || null,
        traffic_light_override_reason: d.trafficLightOverrideReason || null,
        traffic_light_override_by: d.trafficLightOverrideBy || null,
        traffic_light_override_at: d.trafficLightOverrideAt || null,
        traffic_light_override_expires: d.trafficLightOverrideExpires || null,
        sort_order: d.order || d.sortOrder || 0,
        created_by: d.createdBy || null,
    }));

    return upsertRows("work_areas", rows);
}

// ══════════════════════════════════════════════
// PHASE 4: Migrate task_dependencies
// ══════════════════════════════════════════════
async function migrateTaskDependencies(accessToken) {
    console.log("\n═══════════════════════════════════════");
    console.log("  PHASE 4: task_dependencies");
    console.log("═══════════════════════════════════════");

    const docs = await readCollection("taskDependencies", accessToken);
    console.log(`  Firestore docs: ${docs.length}`);

    const rows = [];
    for (const d of docs) {
        const pred = lookupId("tasks", d.predecessorId || d.from);
        const succ = lookupId("tasks", d.successorId || d.to);
        if (!pred || !succ) {
            console.log(`  ⚠️  Skip dep ${d._firestoreId}: pred=${pred}, succ=${succ}`);
            continue;
        }
        // Normalize type
        let depType = d.type || "FS";
        if (depType === "finish_to_start") depType = "FS";
        if (depType === "start_to_start") depType = "SS";
        if (depType === "finish_to_finish") depType = "FF";
        if (depType === "start_to_finish") depType = "SF";

        rows.push({
            firestore_id: d._firestoreId,
            predecessor_task_id: pred,
            successor_task_id: succ,
            type: depType,
            project_id: lookupId("projects", d.projectId) || null,
        });
    }

    return upsertRows("task_dependencies", rows);
}

// ══════════════════════════════════════════════
// PHASE 5: Migrate audit_events
// ══════════════════════════════════════════════
async function migrateAuditEvents(accessToken) {
    console.log("\n═══════════════════════════════════════");
    console.log("  PHASE 5: audit_events");
    console.log("═══════════════════════════════════════");

    const docs = await readCollection("auditEvents", accessToken);
    console.log(`  Firestore docs: ${docs.length}`);

    const rows = docs.map(d => ({
        firestore_id: d._firestoreId,
        event_type: d.eventType || d.type || "",
        entity_type: d.entityType || "",
        entity_id: d.entityId || "",
        user_id: d.userId || null,
        timestamp: d.timestamp || d.createdAt || new Date().toISOString(),
        source: d.source || "system",
        correlation_id: d.correlationId || null,
        details: d.details || {},
    }));

    return upsertRows("audit_events", rows);
}

// ══════════════════════════════════════════════
// PHASE 6: Migrate audit_findings
// ══════════════════════════════════════════════
async function migrateAuditFindings(accessToken) {
    console.log("\n═══════════════════════════════════════");
    console.log("  PHASE 6: audit_findings");
    console.log("═══════════════════════════════════════");

    const docs = await readCollection("auditFindings", accessToken);
    console.log(`  Firestore docs: ${docs.length}`);

    const rows = docs.map(d => ({
        firestore_id: d._firestoreId,
        audit_run_id: d.auditRunId || null,
        rule: d.ruleId || d.rule || "",
        severity: d.severity || "info",
        status: d.status || "open",
        title: d.title || "",
        description: d.message || d.description || "",
        entity_type: d.entityType || "",
        entity_id: d.entityId || "",
        entity_name: d.entityName || null,
        resolved_at: d.resolvedAt || null,
        resolved_by: d.resolvedBy || null,
        created_at: d.createdAt || new Date().toISOString(),
    }));

    return upsertRows("audit_findings", rows);
}

// ══════════════════════════════════════════════
// PHASE 7: Migrate analytics_snapshots
// ══════════════════════════════════════════════
async function migrateAnalyticsSnapshots(accessToken) {
    console.log("\n═══════════════════════════════════════");
    console.log("  PHASE 7: analytics_snapshots");
    console.log("═══════════════════════════════════════");

    const docs = await readCollection("analyticsSnapshots", accessToken);
    console.log(`  Firestore docs: ${docs.length}`);

    const rows = docs.map(d => ({
        firestore_id: d._firestoreId,
        scope: d.scope || "general",
        snapshot_date: d.snapshotDate || null,
        metrics: d.metrics || {},
        created_at: d.createdAt || new Date().toISOString(),
    }));

    return upsertRows("analytics_snapshots", rows);
}

// ══════════════════════════════════════════════
// PHASE 8: Fix references in tasks
// ══════════════════════════════════════════════
async function fixTaskReferences(accessToken) {
    console.log("\n═══════════════════════════════════════");
    console.log("  PHASE 8: Fix task references");
    console.log("═══════════════════════════════════════");

    // 8a. Clean empty strings → NULL
    if (!DRY_RUN) {
        console.log("  Cleaning empty strings...");
        for (const col of ["project_id", "station_id", "task_type_id", "area_id", "milestone_id"]) {
            const { data, error } = await supabase.from("tasks")
                .update({ [col]: null }).eq(col, "");
            if (error) console.log(`  ⚠️  Clean ${col}: ${error.message}`);
            else console.log(`  ✅ Cleaned empty ${col}`);
        }
    }

    // 8b. Re-read tasks from Firestore to get original IDs
    console.log("  Re-reading tasks from Firestore for ID remapping...");
    const fsTasks = await readCollection("tasks", accessToken);
    console.log(`  ${fsTasks.length} tasks read from Firestore`);

    let stationFixed = 0, areaFixed = 0, milestoneFixed = 0;

    for (const fsTask of fsTasks) {
        const sbTaskId = lookupId("tasks", fsTask._firestoreId);
        if (!sbTaskId) continue;

        const updates = {};

        // Fix station_id: remap Firestore station ID to Supabase station ID
        if (fsTask.stationId) {
            const sbStationId = lookupId("project_stations", fsTask.stationId);
            if (sbStationId) {
                updates.station_id = sbStationId;
                stationFixed++;
            }
        }

        // Fix area_id: remap using work_areas (not work_area_types)
        if (fsTask.areaId) {
            const sbAreaId = lookupId("work_areas", fsTask.areaId);
            if (sbAreaId) {
                updates.area_id = sbAreaId;
                areaFixed++;
            }
        }

        // Fix milestone_id: remap using milestones (not milestone_types)
        if (fsTask.milestoneId) {
            const sbMilestoneId = lookupId("milestones", fsTask.milestoneId);
            if (sbMilestoneId) {
                updates.milestone_id = sbMilestoneId;
                milestoneFixed++;
            }
        }

        if (Object.keys(updates).length > 0 && !DRY_RUN) {
            const { error } = await supabase.from("tasks").update(updates).eq("id", sbTaskId);
            if (error) console.error(`  ✗ Task ${sbTaskId}: ${error.message}`);
        } else if (Object.keys(updates).length > 0 && DRY_RUN) {
            console.log(`  [DRY] Task ${fsTask._firestoreId} → ${JSON.stringify(updates)}`);
        }
    }

    console.log(`  ✅ Stations remapped: ${stationFixed}`);
    console.log(`  ✅ Areas remapped: ${areaFixed}`);
    console.log(`  ✅ Milestones remapped: ${milestoneFixed}`);
}

// ══════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════
async function main() {
    console.log("╔══════════════════════════════════════════════╗");
    console.log("║  Supabase Migration REMEDIATION Script      ║");
    console.log("╚══════════════════════════════════════════════╝");
    console.log(`  Mode: ${DRY_RUN ? "DRY RUN 🔍" : "LIVE ⚡"}`);

    const accessToken = await getAccessToken();
    console.log("  ✅ Token obtained");

    await loadExistingIdMaps();

    const t0 = Date.now();
    const results = [];

    // Phase 1-7: Migrate missing collections
    results.push({ phase: "Stations",      count: await migrateStations(accessToken) });
    results.push({ phase: "Milestones",     count: await migrateMilestones(accessToken) });
    results.push({ phase: "WorkAreas",      count: await migrateWorkAreas(accessToken) });
    results.push({ phase: "TaskDeps",       count: await migrateTaskDependencies(accessToken) });
    results.push({ phase: "AuditEvents",    count: await migrateAuditEvents(accessToken) });
    results.push({ phase: "AuditFindings",  count: await migrateAuditFindings(accessToken) });
    results.push({ phase: "AnalyticSnaps",  count: await migrateAnalyticsSnapshots(accessToken) });

    // Phase 8: Fix references
    await fixTaskReferences(accessToken);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n${"═".repeat(50)}`);
    console.log(`  SUMMARY (${elapsed}s)`);
    console.log(`${"═".repeat(50)}\n`);

    for (const r of results) {
        console.log(`  ✅ ${r.phase.padEnd(16)} ${r.count} rows`);
    }
    const total = results.reduce((s, r) => s + (r.count || 0), 0);
    console.log(`\n  Total: ${total} rows migrated`);
}

main()
    .then(() => { console.log("\n✅ Remediation complete."); process.exit(0); })
    .catch(e => { console.error("\n❌ Failed:", e.message); process.exit(1); });
