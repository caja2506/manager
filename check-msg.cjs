const { getSupabase } = require("./functions/db/supabaseAdmin");

async function checkAndMigrate() {
    process.env.SUPABASE_URL = "https://mkymgptfmtlqpdswvywo.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reW1ncHRmbXRscXBkc3d2eXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE4MjEwMiwiZXhwIjoyMDkzNzU4MTAyfQ.IzegMIzSgWNXALkiHrsFRBJW2wmS6aG7YP5TJ02FYRY";
    
    const sb = getSupabase();
    
    // Check agent_nudges columns
    const { data, error } = await sb.from("agent_nudges").select("*").limit(1);
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("agent_nudges columns:", Object.keys(data[0] || {}));
        if (data.length > 0) console.log("Sample:", JSON.stringify(data[0], null, 2));
    }

    // Test inserting with new columns
    const { error: testErr } = await sb.from("agent_nudges").insert({
        user_id: "__test__",
        rule_key: "__test__",
        target_id: null,
        sent_at: new Date().toISOString(),
        message_preview: "test",
        chat_id: "12345",
        telegram_message_id: 99999,
    });
    if (testErr) {
        console.log("\n❌ New columns missing:", testErr.message);
        console.log("\n📋 Run this SQL in Supabase SQL Editor:");
        console.log("ALTER TABLE agent_nudges ADD COLUMN IF NOT EXISTS chat_id TEXT;");
        console.log("ALTER TABLE agent_nudges ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;");
    } else {
        console.log("\n✅ New columns work! Cleaning up test row...");
        await sb.from("agent_nudges").delete().eq("user_id", "__test__");
    }
}
checkAndMigrate();
