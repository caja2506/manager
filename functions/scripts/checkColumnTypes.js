// Quick check: what are the actual column types for tasks.id and projects.id?
const { createClient } = require("@supabase/supabase-js");
const SUPABASE_URL = process.env.SUPABASE_URL || "https://mkymgptfmtlqpdswvywo.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_SERVICE_KEY) throw new Error("Missing SUPABASE_SERVICE_KEY env var.");
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
