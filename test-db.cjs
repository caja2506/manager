const { getSupabase } = require("./functions/db/supabaseAdmin");
const coreReader = require("./functions/db/coreDataReader");

async function test() {
    process.env.SUPABASE_URL = "https://mkymgptfmtlqpdswvywo.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reW1ncHRmbXRscXBkc3d2eXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE4MjEwMiwiZXhwIjoyMDkzNzU4MTAyfQ.IzegMIzSgWNXALkiHrsFRBJW2wmS6aG7YP5TJ02FYRY";
    
    try {
        console.log("Loading tasks for f7jhLgYoXmTKOVKadbhcR5cuGSQ2...");
        const tasks = await coreReader.loadUserTasks("f7jhLgYoXmTKOVKadbhcR5cuGSQ2");
        console.log("Tasks found:", tasks.length);
        console.log("First task:", tasks[0]?.title);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
