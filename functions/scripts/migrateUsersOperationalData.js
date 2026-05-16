/**
 * Migrate Operational User Data from Firestore → Supabase
 * ========================================================
 * Uses Firebase Web SDK (client-side approach) to read from
 * Firestore and update Supabase. This avoids the need for
 * local Admin SDK credentials.
 *
 * Usage:
 *   node functions/scripts/migrateUsersOperationalData.js
 */

const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const { createClient } = require("@supabase/supabase-js");

// ── Firebase Web Config ──
const firebaseConfig = {
    apiKey: "AIzaSyCWXnmb7bJUOzoX2e67xSoFgqHLIM0n4C4",
    authDomain: "bom-ame-cr.firebaseapp.com",
    projectId: "bom-ame-cr",
    storageBucket: "bom-ame-cr.firebasestorage.app",
    messagingSenderId: "865326401984",
    appId: "1:865326401984:web:95978c7b2d6aa92acd8ebd",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── Supabase Init ──
const SUPABASE_URL = "https://mkymgptfmtlqpdswvywo.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
    console.error("❌ Set SUPABASE_SERVICE_ROLE_KEY env var before running.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

async function migrate() {
    console.log("📥 Reading Firestore 'users' collection (Web SDK)...");

    const usersSnap = await getDocs(collection(db, "users"));
    console.log(`   Found ${usersSnap.size} documents.\n`);

    if (usersSnap.empty) {
        console.log("⚠️  No documents found. Nothing to migrate.");
        return;
    }

    let updated = 0, skipped = 0, errors = 0;

    for (const docSnap of usersSnap.docs) {
        const uid = docSnap.id;
        const d = docSnap.data();

        const updates = {};

        if (d.operationalRole) updates.operational_role = d.operationalRole;
        if (d.telegramChatId) updates.telegram_chat_id = String(d.telegramChatId);
        if (d.isAutomationParticipant !== undefined) updates.is_automation_participant = !!d.isAutomationParticipant;
        if (d.reportsTo) updates.reports_to = d.reportsTo;
        if (d.providerLinks) updates.provider_links = d.providerLinks;
        if (d.displayName || d.name) updates.display_name = d.displayName || d.name;

        if (Object.keys(updates).length === 0) {
            console.log(`   ⏭️  ${uid} — no operational data`);
            skipped++;
            continue;
        }

        updates.updated_at = new Date().toISOString();

        const { error } = await supabase.from("users").update(updates).eq("id", uid);
        if (error) {
            console.error(`   ❌ ${uid} — ${error.message}`);
            errors++;
        } else {
            const fields = Object.keys(updates).filter(k => k !== "updated_at").join(", ");
            console.log(`   ✅ ${uid} — migrated: ${fields}`);
            updated++;
        }
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors:  ${errors}`);
    console.log(`📊 Total:   ${usersSnap.size}`);
}

migrate()
    .then(() => { console.log("\n🏁 Done."); process.exit(0); })
    .catch(err => { console.error("💥 Fatal:", err); process.exit(1); });
