/**
 * Seed the planner_timer_sync routine doc in automationRoutines.
 * Run with: npx firebase-tools firestore:delete automationRoutines/planner_timer_sync --force 2>/dev/null; node scripts/seedPlannerRoutine.js
 * Or use the Firebase Console directly.
 */
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Use service account if available, otherwise default credentials
let app;
try {
    const serviceAccount = require("../serviceAccountKey.json");
    app = initializeApp({ credential: cert(serviceAccount) });
} catch {
    app = initializeApp({ projectId: "bom-ame-cr" });
}

const db = getFirestore(app);

async function seed() {
    const ref = db.collection("automationRoutines").doc("planner_timer_sync");
    const snap = await ref.get();
    if (snap.exists) {
        console.log("Doc already exists, skipping.");
    } else {
        await ref.set({
            key: "planner_timer_sync",
            name: "Planner Timer Sync",
            description: "Auto-starts/stops timers based on planner schedule",
            enabled: true,
            scheduleType: "interval",
            scheduleConfig: { intervalMinutes: 15 },
            channel: "none",
            targetRole: "all",
            dryRun: false,
            debugMode: false,
            createdAt: new Date().toISOString(),
        });
        console.log("✅ automationRoutines/planner_timer_sync created!");
    }
    process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
