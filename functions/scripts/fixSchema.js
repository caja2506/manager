/**
 * Fix Schema - Use Supabase's internal SQL execution  
 * Approach: Create an RPC function, then use it to run DDL
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://mkymgptfmtlqpdswvywo.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) throw new Error("Missing SUPABASE_SERVICE_KEY env var.");

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    console.log("Attempting to workaround UUID constraint...\n");
    
    // Strategy: Instead of changing the column type (which requires DDL),
    // we'll change our migration script to map Firestore IDs to the 
    // Supabase UUIDs that were already inserted for task_types, etc.
    
    // Let's read what task_types are in Supabase and build the mapping
    const { data: taskTypes } = await sb.from("task_types").select("id, firestore_id");
    const { data: milestones } = await sb.from("milestone_types").select("id, firestore_id");
    const { data: areas } = await sb.from("work_area_types").select("id, firestore_id");
    const { data: projects } = await sb.from("projects").select("id, firestore_id");
    
    console.log("Task Types mapping:");
    for (const t of taskTypes || []) {
        console.log(`  ${t.firestore_id} -> ${t.id}`);
    }
    
    console.log(`\nProjects: ${(projects||[]).length}`);
    console.log(`Milestones: ${(milestones||[]).length}`);
    console.log(`Work Areas: ${(areas||[]).length}`);
    
    // Now get the 24 failing tasks from Firestore to see what taskTypeIds they use
    const fs = require("fs");
    const path = require("path");
    
    const credPath = path.join(process.env.APPDATA, "firebase", "caja2506_gmail_com_application_default_credentials.json");
    const creds = JSON.parse(fs.readFileSync(credPath, "utf8"));
    
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: creds.client_id,
            client_secret: creds.client_secret,
            refresh_token: creds.refresh_token,
            grant_type: "refresh_token",
        }),
    });
    const { access_token } = await tokenResp.json();
    
    // Get all tasks
    const taskResp = await fetch(
        "https://firestore.googleapis.com/v1/projects/bom-ame-cr/databases/(default)/documents/tasks?pageSize=300",
        { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const taskData = await taskResp.json();
    
    // Find the 24 that have taskTypeId not matching
    const existing = await sb.from("tasks").select("firestore_id");
    const existingIds = new Set((existing.data || []).map(t => t.firestore_id));
    
    const ttMap = {};
    for (const t of taskTypes || []) ttMap[t.firestore_id] = t.id;
    
    let missing = 0;
    const missingTaskTypes = new Set();
    
    for (const doc of taskData.documents || []) {
        const id = doc.name.split("/").pop();
        if (!existingIds.has(id)) {
            missing++;
            const fields = doc.fields || {};
            const taskTypeId = fields.taskTypeId?.stringValue;
            if (taskTypeId) {
                const mapped = ttMap[taskTypeId];
                if (mapped) {
                    console.log(`  Missing task ${id}: taskTypeId=${taskTypeId} -> UUID=${mapped} ✅`);
                } else {
                    console.log(`  Missing task ${id}: taskTypeId=${taskTypeId} -> NOT FOUND ❌`);
                    missingTaskTypes.add(taskTypeId);
                }
            } else {
                console.log(`  Missing task ${id}: no taskTypeId`);
            }
        }
    }
    
    console.log(`\nTotal missing: ${missing}`);
    console.log(`Missing task type IDs: ${[...missingTaskTypes].join(", ")}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
