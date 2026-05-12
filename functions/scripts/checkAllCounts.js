// Quick check: row counts for all tables in Supabase
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
    "https://mkymgptfmtlqpdswvywo.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reW1ncHRmbXRscXBkc3d2eXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE4MjEwMiwiZXhwIjoyMDkzNzU4MTAyfQ.IzegMIzSgWNXALkiHrsFRBJW2wmS6aG7YP5TJ02FYRY"
);

const TABLES = [
    "users", "projects", "task_types", "work_area_types", "milestone_types",
    "delay_causes", "task_type_categories", "tasks", "subtasks", "time_logs",
    "delays", "weekly_plan_items", "project_risks", "task_dependencies",
    // New tables
    "settings", "peer_review_templates", "resource_assignments", "peer_reviews", "notifications",
    "milestones", "work_areas", "score_snapshots", "daily_score_logs", "task_comments",
];

async function main() {
    console.log("╔══════════════════════════════════════════╗");
    console.log("║  Supabase Table Row Counts               ║");
    console.log("╚══════════════════════════════════════════╝\n");

    let total = 0;
    for (const t of TABLES) {
        const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
        const c = error ? `❌ ${error.message}` : count;
        const icon = error ? "❌" : (count > 0 ? "✅" : "⚪");
        console.log(`  ${icon} ${t.padEnd(25)} ${c}`);
        if (!error) total += count;
    }
    console.log(`\n  Total: ${total} rows`);
}

main();
