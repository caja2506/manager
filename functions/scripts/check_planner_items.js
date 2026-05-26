const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

let app;
try {
    const serviceAccount = require("../serviceAccountKey.json");
    app = initializeApp({ credential: cert(serviceAccount) }, "check_planner");
} catch {
    app = initializeApp({ projectId: "bom-ame-cr" }, "check_planner");
}

const db = getFirestore(app);

async function check() {
    console.log("Checking weeklyPlanItems...");
    const snap = await db.collection("weeklyPlanItems").orderBy("startDateTime", "desc").limit(5).get();
    if (snap.empty) {
        console.log("No weeklyPlanItems found.");
    } else {
        snap.forEach(doc => {
            console.log(`Doc ID: ${doc.id}`);
            console.log(JSON.stringify(doc.data(), null, 2));
            console.log("---");
        });
    }
    process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
