/**
 * backfillReportsTo.js
 * One-time script to sync reportsTo field on user documents
 * based on active resourceAssignments.
 *
 * Usage: node functions/scripts/backfillReportsTo.js
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

let app;
try {
    const serviceAccount = require("../serviceAccountKey.json");
    app = initializeApp({ credential: cert(serviceAccount) });
} catch {
    app = initializeApp({ projectId: "bom-ame-cr" });
}

const db = getFirestore(app);

async function backfill() {
    console.log('🔍 Loading active resource assignments...');
    const snap = await db.collection('resourceAssignments')
        .where('active', '==', true)
        .get();

    if (snap.empty) {
        console.log('❌ No active assignments found.');
        return;
    }

    console.log(`✅ Found ${snap.size} active assignments.\n`);

    for (const doc of snap.docs) {
        const { technicianId, engineerId } = doc.data();
        if (!technicianId || !engineerId) continue;

        // Check current user doc
        const userDoc = await db.collection('users').doc(technicianId).get();
        const currentReportsTo = userDoc.exists ? userDoc.data().reportsTo : null;

        console.log(`👤 Technician: ${technicianId}`);
        console.log(`   Engineer:   ${engineerId}`);
        console.log(`   Current reportsTo: ${currentReportsTo || '(not set)'}`);

        if (currentReportsTo === engineerId) {
            console.log(`   ✅ Already correct. Skipping.\n`);
            continue;
        }

        // Update
        await db.collection('users').doc(technicianId).update({
            reportsTo: engineerId,
        });
        console.log(`   🔄 Updated reportsTo → ${engineerId}\n`);
    }

    console.log('🎉 Done!');
}

backfill().catch(console.error).finally(() => process.exit(0));
