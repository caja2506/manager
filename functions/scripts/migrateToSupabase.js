/**
 * Firestore → Supabase Data Migration Script (REST API Version)
 * ==============================================================
 * Uses Firestore REST API + Firebase CLI refresh token.
 * NO Firebase SDK needed. NO service account needed. NO password needed.
 *
 * USAGE:
 *   cd functions
 *   node scripts/migrateToSupabase.js --dry-run
 *   node scripts/migrateToSupabase.js
 *   node scripts/migrateToSupabase.js --table=tasks
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

// ── Parse CLI args ──
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const CLEAR = args.includes("--clear");
const TABLE_FILTER = args.find(a => a.startsWith("--table="))?.split("=")[1] || null;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Get access token from Firebase CLI stored credentials ──
async function getAccessToken() {
    const credPath = path.join(
        process.env.APPDATA || process.env.HOME,
        "firebase",
        "caja2506_gmail_com_application_default_credentials.json"
    );
    if (!fs.existsSync(credPath)) throw new Error("Firebase CLI creds not found. Run 'firebase login'.");

    const creds = JSON.parse(fs.readFileSync(credPath, "utf8"));

    const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: creds.client_id,
            client_secret: creds.client_secret,
            refresh_token: creds.refresh_token,
            grant_type: "refresh_token",
        }),
    });

    const data = await resp.json();
    if (!data.access_token) throw new Error("Failed to get access token: " + JSON.stringify(data));
    return data.access_token;
}

// ── Read ALL documents from a Firestore collection via REST ──
async function readFirestoreCollection(collectionName, accessToken) {
    const docs = [];
    let pageToken = null;

    do {
        let url = `${FIRESTORE_BASE}/${collectionName}?pageSize=300`;
        if (pageToken) url += `&pageToken=${pageToken}`;

        const resp = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`Firestore read '${collectionName}' failed (${resp.status}): ${err}`);
        }

        const body = await resp.json();
        if (body.documents) {
            for (const doc of body.documents) {
                const id = doc.name.split("/").pop();
                const data = parseFirestoreDoc(doc.fields || {});
                docs.push({ ...data, id });
            }
        }
        pageToken = body.nextPageToken || null;
    } while (pageToken);

    return docs;
}

// ── Parse Firestore REST format → plain JS objects ──
function parseFirestoreDoc(fields) {
    const result = {};
    for (const [key, val] of Object.entries(fields)) {
        result[key] = parseFirestoreValue(val);
    }
    return result;
}

function parseFirestoreValue(val) {
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.integerValue !== undefined) return Number(val.integerValue);
    if (val.doubleValue !== undefined) return val.doubleValue;
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.nullValue !== undefined) return null;
    if (val.timestampValue !== undefined) return val.timestampValue;
    if (val.arrayValue) return (val.arrayValue.values || []).map(parseFirestoreValue);
    if (val.mapValue) return parseFirestoreDoc(val.mapValue.fields || {});
    return null;
}

// ── ID mapping cache ──
const idMap = {};
function cacheId(table, fsId, sbId) { if (!idMap[table]) idMap[table] = {}; idMap[table][fsId] = sbId; }
function lookupId(table, fsId) { return fsId ? (idMap[table]?.[fsId] || null) : null; }

// ══════════════════════════════════════════════
// COLLECTION DEFINITIONS
// ══════════════════════════════════════════════

const COLLECTIONS = [
    // ── Pass 1: Parent tables ──
    { firestore: "users", supabase: "users", pass: 1,
        map: (d) => ({ id: d.id, firestore_id: d.id, display_name: d.displayName || "", email: d.email || "",
            team_role: d.teamRole || null, rbac_role: d.rbacRole || null, reports_to: d.reportsTo || null,
            weekly_capacity_hours: d.weeklyCapacityHours || 40, photo_url: d.photoURL || null, active: d.active !== false }),
    },
    { firestore: "projects", supabase: "projects", pass: 1,
        map: (d) => ({ firestore_id: d.id, name: d.name || "", description: d.description || "",
            status: d.status || "active", priority: d.priority || "medium",
            owner_id: d.ownerId || d.createdBy || null, start_date: d.startDate || null,
            due_date: d.dueDate || null, progress: d.progress || 0,
            created_by: d.createdBy || null, created_at: d.createdAt || new Date().toISOString() }),
    },
    { firestore: "taskTypes", supabase: "task_types", pass: 1,
        map: (d) => ({ firestore_id: d.id, name: d.name || "", icon: d.icon || null, color: d.color || null }),
    },
    { firestore: "workAreaTypes", supabase: "work_area_types", pass: 1,
        map: (d) => ({ firestore_id: d.id, name: d.name || "" }),
    },
    { firestore: "milestoneTypes", supabase: "milestone_types", pass: 1,
        map: (d) => ({ firestore_id: d.id, name: d.name || "" }),
    },
    { firestore: "delayCauses", supabase: "delay_causes", pass: 1,
        map: (d) => ({ firestore_id: d.id, name: d.name || "", description: d.description || "",
            active: d.active !== false, sort_order: d.order || d.sortOrder || 0 }),
    },
    { firestore: "taskTypeCategories", supabase: "task_type_categories", pass: 1,
        map: (d) => ({ firestore_id: d.id, name: d.name || "" }),
    },

    // ── Pass 2: Tasks ──
    { firestore: "tasks", supabase: "tasks", pass: 2,
        map: (d) => ({ firestore_id: d.id,
            project_id: lookupId("projects", d.projectId), title: d.title || "", description: d.description || "",
            status: d.status || "backlog", priority: d.priority || "medium",
            task_type_id: lookupId("task_types", d.taskTypeId),
            assigned_to: d.assignedTo || null, assigned_by: d.assignedBy || null,
            estimated_hours: d.estimatedHours || null, actual_hours: d.actualHours || 0,
            due_date: d.dueDate || null, completed_date: d.completedDate || null,
            tags: d.tags || [], station_id: d.stationId || null,
            milestone_id: lookupId("milestone_types", d.milestoneId),
            area_id: lookupId("work_area_types", d.areaId),
            counts_for_score: d.countsForScore || false,
            peer_review_required: d.peerReviewRequired || false,
            peer_review_discipline: d.peerReviewDiscipline || null,
            peer_review_status: d.peerReviewStatus || null,
            show_in_gantt: d.showInGantt !== false,
            planned_start_date: d.plannedStartDate || null, planned_end_date: d.plannedEndDate || null,
            planned_duration_hours: d.plannedDurationHours || null,
            percent_complete: d.percentComplete || 0, parent_task_id: null,
            blocked_reason: d.blockedReason || null, blocked_by_user_id: d.blockedByUserId || null,
            blocked_by_name: d.blockedByName || null,
            created_by: d.createdBy || null, created_at: d.createdAt || new Date().toISOString() }),
    },

    // ── Pass 3: Children ──
    { firestore: "subtasks", supabase: "subtasks", pass: 3,
        map: (d) => ({ firestore_id: d.id, task_id: lookupId("tasks", d.taskId),
            title: d.title || "", completed: d.completed || false,
            completed_at: d.completedAt || null, sort_order: d.order || 0,
            created_at: d.createdAt || new Date().toISOString() }),
        skipIf: (m) => !m.task_id,
    },
    { firestore: "timeLogs", supabase: "time_logs", pass: 3,
        map: (d) => ({ firestore_id: d.id, task_id: lookupId("tasks", d.taskId),
            project_id: lookupId("projects", d.projectId), user_id: d.userId || null,
            start_time: d.startTime || null, end_time: d.endTime || null,
            total_hours: d.totalHours || 0, total_hours_gross: d.totalHoursGross || null,
            break_hours_deducted: d.breakHoursDeducted || 0,
            overtime: d.overtime || false, overtime_hours: d.overtimeHours || 0,
            notes: d.notes || "", task_title: d.taskTitle || "",
            project_name: d.projectName || "", display_name: d.displayName || "",
            source: d.source || "manual", auto_stopped: d.autoStopped || false,
            created_at: d.createdAt || d.startTime || new Date().toISOString() }),
    },
    { firestore: "delays", supabase: "delays", pass: 3,
        map: (d) => ({ firestore_id: d.id, project_id: lookupId("projects", d.projectId),
            task_id: lookupId("tasks", d.taskId), cause_id: lookupId("delay_causes", d.causeId),
            cause_name: d.causeName || "", comment: d.comment || "",
            impact: d.impact || null, resolved: d.resolved || false,
            resolved_at: d.resolvedAt || null, created_by: d.createdBy || null,
            created_at: d.createdAt || new Date().toISOString() }),
    },
    { firestore: "weeklyPlanItems", supabase: "weekly_plan_items", pass: 3,
        map: (d) => ({ firestore_id: d.id, task_id: lookupId("tasks", d.taskId),
            assigned_to: d.assignedTo || null, week_start_date: d.weekStartDate || null,
            day_of_week: d.dayOfWeek || null,
            start_date_time: d.startDateTime || null, end_date_time: d.endDateTime || null,
            planned_hours: d.plannedHours || 0, notes: d.notes || "",
            status: d.status || "planned", project_id: lookupId("projects", d.projectId),
            task_title: d.taskTitle || "", project_name: d.projectName || "",
            created_by: d.createdBy || null }),
    },
    { firestore: "risks", supabase: "project_risks", pass: 3,
        map: (d) => ({ firestore_id: d.id, project_id: lookupId("projects", d.projectId),
            risk_type: d.riskType || d.type || "", level: d.level || "low",
            score: d.score || 0, details: typeof d.details === "object" ? d.details : {},
            created_at: d.createdAt || new Date().toISOString() }),
    },
    { firestore: "taskDependencies", supabase: "task_dependencies", pass: 3,
        map: (d) => ({ firestore_id: d.id,
            predecessor_task_id: lookupId("tasks", d.predecessorId || d.from),
            successor_task_id: lookupId("tasks", d.successorId || d.to),
            type: d.type || "finish_to_start" }),
        skipIf: (m) => !m.predecessor_task_id || !m.successor_task_id,
    },

    // ── Pass 1 additions ──
    { firestore: "settings", supabase: "settings", pass: 1,
        map: (d) => ({ key: d.id, value: JSON.stringify(d),
            description: d.description || "", category: d.category || "general" }),
    },
    { firestore: "peerReviewTemplates", supabase: "peer_review_templates", pass: 1,
        map: (d) => ({ firestore_id: d.id, name: d.name || "",
            discipline: d.discipline || null, active: d.active !== false,
            items: d.items || d.sections || [], created_by: d.createdBy || null }),
    },

    // ── Pass 3 additions ──
    { firestore: "resourceAssignments", supabase: "resource_assignments", pass: 3,
        map: (d) => ({ firestore_id: d.id,
            technician_id: d.technicianId || d.assigneeId || null,
            engineer_id: d.engineerId || d.supervisorId || null,
            active: d.active !== false, reason: d.reason || "default",
            start_date: d.startDate || d.createdAt || null,
            end_date: d.endDate || null,
            created_by: d.createdBy || null }),
        skipIf: (m) => !m.technician_id || !m.engineer_id,
    },
    { firestore: "peerReviews", supabase: "peer_reviews", pass: 3,
        map: (d) => ({ firestore_id: d.id,
            task_id: lookupId("tasks", d.taskId),
            project_id: lookupId("projects", d.projectId),
            cycle: d.cycle || 1,
            requested_by: d.requestedBy || null, reviewer_id: d.reviewerId || null,
            discipline: d.discipline || null, status: d.status || "requested",
            checklist_items: d.checklistItems || [], decision: d.decision || null,
            summary: d.summary || "", waived_by: d.waivedBy || null,
            waive_reason: d.waiveReason || null,
            requested_at: d.requestedAt || d.createdAt || null,
            started_at: d.startedAt || null, completed_at: d.completedAt || null,
            created_at: d.createdAt || new Date().toISOString() }),
    },
    { firestore: "notifications", supabase: "notifications", pass: 3,
        map: (d) => ({ firestore_id: d.id,
            user_id: d.userId || null, type: d.type || "info",
            title: d.title || "", message: d.message || d.body || "",
            read: d.read || false, link: d.link || "",
            task_id: lookupId("tasks", d.taskId),
            project_id: lookupId("projects", d.projectId),
            triggered_by: d.triggeredBy || d.createdBy || null,
            created_at: d.createdAt || new Date().toISOString() }),
        skipIf: (m) => !m.user_id,
    },
];

// ══════════════════════════════════════════════
// ENGINE
// ══════════════════════════════════════════════

async function migrateCollection(config, accessToken) {
    const { firestore: fsName, supabase: sbTable, map, skipIf } = config;

    if (TABLE_FILTER && TABLE_FILTER !== sbTable) return { table: sbTable, status: "skip", count: 0 };

    console.log(`\n── ${fsName} → ${sbTable} ──`);

    const docs = await readFirestoreCollection(fsName, accessToken);
    console.log(`  Firestore docs: ${docs.length}`);

    if (docs.length === 0) return { table: sbTable, status: "empty", count: 0 };

    const rows = [];
    let skipped = 0;
    for (const doc of docs) {
        const mapped = map(doc);
        if (skipIf && skipIf(mapped)) { skipped++; continue; }
        rows.push(mapped);
    }
    if (skipped) console.log(`  Skipped: ${skipped}`);
    console.log(`  Rows: ${rows.length}`);

    if (DRY_RUN) {
        console.log(`  [DRY] Would insert ${rows.length}`);
        if (rows[0]) console.log(`  Sample:`, JSON.stringify(rows[0], null, 2).substring(0, 400));
        for (const r of rows) cacheId(sbTable, r.firestore_id, r.firestore_id);
        return { table: sbTable, status: "dry-run", count: rows.length };
    }

    if (CLEAR) {
        console.log(`  ⚠️  Clearing...`);
        await supabase.from(sbTable).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    let inserted = 0, errors = 0;
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { data, error } = await supabase
            .from(sbTable).upsert(batch, { onConflict: "firestore_id" }).select("id, firestore_id");

        if (error) {
            console.error(`  ❌ Batch err:`, error.message);
            for (const row of batch) {
                const { data: s, error: e } = await supabase
                    .from(sbTable).upsert(row, { onConflict: "firestore_id" }).select("id, firestore_id").single();
                if (e) { console.error(`    ✗ ${row.firestore_id}: ${e.message}`); errors++; }
                else if (s) { cacheId(sbTable, s.firestore_id, s.id); inserted++; }
            }
        } else if (data) {
            for (const r of data) cacheId(sbTable, r.firestore_id, r.id);
            inserted += data.length;
        }
    }

    console.log(`  ✅ ${inserted} ok | ${errors} err`);
    return { table: sbTable, status: "done", count: inserted, errors };
}

async function resolveParentTaskIds(accessToken) {
    console.log("\n── Resolving parent_task_id... ──");
    const docs = await readFirestoreCollection("tasks", accessToken);
    let updated = 0;
    for (const d of docs) {
        if (!d.parentTaskId) continue;
        const sbId = lookupId("tasks", d.id);
        const sbP = lookupId("tasks", d.parentTaskId);
        if (sbId && sbP && !DRY_RUN) {
            await supabase.from("tasks").update({ parent_task_id: sbP }).eq("id", sbId);
            updated++;
        }
    }
    console.log(`  Updated: ${updated}`);
}

// ══════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════

async function main() {
    console.log("╔══════════════════════════════════════════════╗");
    console.log("║  Firestore → Supabase Migration (REST API)  ║");
    console.log("╚══════════════════════════════════════════════╝");
    console.log(`  Mode: ${DRY_RUN ? "DRY RUN 🔍" : "LIVE ⚡"}`);
    console.log(`  Filter: ${TABLE_FILTER || "All tables"}`);

    console.log("\n🔐 Getting access token from Firebase CLI...");
    const accessToken = await getAccessToken();
    console.log("  ✅ Token obtained\n");

    const results = [];
    const t0 = Date.now();

    for (const pass of [1, 2, 3]) {
        console.log(`\n${"═".repeat(50)}`);
        console.log(`  PASS ${pass}`);
        console.log(`${"═".repeat(50)}`);

        for (const c of COLLECTIONS.filter(x => x.pass === pass)) {
            try { results.push(await migrateCollection(c, accessToken)); }
            catch (e) { console.error(`  ❌ ${c.supabase}: ${e.message}`); results.push({ table: c.supabase, status: "FAILED" }); }
        }
    }

    await resolveParentTaskIds(accessToken);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n${"═".repeat(50)}`);
    console.log(`  SUMMARY (${elapsed}s)`);
    console.log(`${"═".repeat(50)}\n`);

    const pad = Math.max(...results.map(r => r.table.length)) + 2;
    for (const r of results) {
        const icon = r.status === "done" ? "✅" : r.status === "FAILED" ? "❌" : "⏭️";
        console.log(`  ${icon} ${r.table.padEnd(pad)} ${(r.status||"").padEnd(12)} ${r.count || 0} rows`);
    }

    const total = results.reduce((s, r) => s + (r.count || 0), 0);
    console.log(`\n  Total: ${total} rows`);
}

main().then(() => { console.log("\n✅ Done."); process.exit(0); })
    .catch(e => { console.error("\n❌ Failed:", e.message); process.exit(1); });
