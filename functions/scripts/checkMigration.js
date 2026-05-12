/**
 * Fix Supabase Schema — Convert remaining UUID columns to TEXT
 * Uses the Supabase REST API directly to execute SQL
 */

const SUPABASE_URL = "https://mkymgptfmtlqpdswvywo.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reW1ncHRmbXRscXBkc3d2eXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE4MjEwMiwiZXhwIjoyMDkzNzU4MTAyfQ.IzegMIzSgWNXALkiHrsFRBJW2wmS6aG7YP5TJ02FYRY";

async function runSQL(sql) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: "POST",
        headers: {
            "apikey": SERVICE_KEY,
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
    });
    
    // For DDL we need to use the pg endpoint directly
    // Let's use the management API instead
    const resp2 = await fetch(`${SUPABASE_URL}/pg`, {
        method: "POST",
        headers: {
            "apikey": SERVICE_KEY,
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
    });

    // Try the SQL endpoint
    return resp2;
}

// Use the Supabase client to query and check current state
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    // First, let's see what we currently have
    console.log("=== Current Migration State ===\n");

    const tables = ["users", "projects", "task_types", "work_area_types", "milestone_types", 
                     "delay_causes", "tasks", "subtasks", "time_logs", "delays", "weekly_plan_items"];
    
    for (const table of tables) {
        const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
        if (error) {
            console.log(`  ${table}: ERROR - ${error.message}`);
        } else {
            console.log(`  ${table}: ${count} rows`);
        }
    }

    // Now let's check what we're missing vs dry-run
    console.log("\n=== Missing Data Analysis ===");
    console.log("  Expected from dry-run:");
    console.log("    tasks: 86, subtasks: 135, time_logs: 141");
    
    const { count: taskCount } = await sb.from("tasks").select("*", { count: "exact", head: true });
    const { count: subCount } = await sb.from("subtasks").select("*", { count: "exact", head: true });
    const { count: tlCount } = await sb.from("time_logs").select("*", { count: "exact", head: true });
    
    console.log(`  Current: tasks: ${taskCount}, subtasks: ${subCount}, time_logs: ${tlCount}`);
    console.log(`  Missing: tasks: ${86 - taskCount}, subtasks: ${135 - subCount}, time_logs: ${141 - tlCount}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
