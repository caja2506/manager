// Quick check: what are the actual column types for tasks.id and projects.id?
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
    "https://mkymgptfmtlqpdswvywo.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reW1ncHRmbXRscXBkc3d2eXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE4MjEwMiwiZXhwIjoyMDkzNzU4MTAyfQ.IzegMIzSgWNXALkiHrsFRBJW2wmS6aG7YP5TJ02FYRY"
);

async function main() {
    // Get sample IDs
    const { data: t } = await sb.from("tasks").select("id").limit(1);
    const { data: p } = await sb.from("projects").select("id").limit(1);
    console.log("tasks.id sample:", t?.[0]?.id);
    console.log("projects.id sample:", p?.[0]?.id);

    // Check if tasks.milestone_id and tasks.area_id exist and their types
    const { data: cols } = await sb.rpc("exec_sql", {
        query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tasks' AND column_name IN ('id', 'milestone_id', 'area_id', 'task_type_id')`
    });
    console.log("tasks columns:", cols);
}

main().catch(e => console.error(e.message));
