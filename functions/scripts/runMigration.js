/**
 * Quick migration runner — calls the Cloud Function migrateBreakHours
 */
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getEffectiveHours } = require("../utils/breakTimeUtils");

initializeApp({ projectId: "bom-ame-cr" });
const db = getFirestore();

async function run() {
    console.log("Starting break hours migration...\n");
    
    const logsSnap = await db.collection("timeLogs").get();
    console.log(`Total timeLogs: ${logsSnap.size}`);

    let updated = 0;
    let skipped = 0;
    let unchanged = 0;
    const affectedTaskIds = new Set();

    for (const doc of logsSnap.docs) {
        const data = doc.data();

        if (!data.startTime || !data.endTime) { skipped++; continue; }
        if (data.totalHoursGross !== undefined) { skipped++; continue; }

        try {
            const start = new Date(data.startTime);
            const end = new Date(data.endTime);
            const grossHours = (end - start) / 3_600_000;
            const netHours = getEffectiveHours(start, end);
            const breakDeducted = parseFloat((grossHours - netHours).toFixed(4));

            if (breakDeducted <= 0) {
                await doc.ref.update({
                    totalHoursGross: parseFloat(grossHours.toFixed(6)),
                    breakHoursDeducted: 0,
                });
                unchanged++;
            } else {
                await doc.ref.update({
                    totalHours: parseFloat(netHours.toFixed(6)),
                    totalHoursGross: parseFloat(grossHours.toFixed(6)),
                    breakHoursDeducted: breakDeducted,
                });
                updated++;
                if (data.taskId) affectedTaskIds.add(data.taskId);
                console.log(`  fix ${doc.id}: ${grossHours.toFixed(2)}h -> ${netHours.toFixed(2)}h (-${breakDeducted.toFixed(2)}h)`);
            }
        } catch (err) {
            console.error(`  err ${doc.id}:`, err.message);
        }
    }

    // Recalculate affected tasks
    console.log(`\nRecalculating ${affectedTaskIds.size} tasks...`);
    for (const taskId of affectedTaskIds) {
        try {
            const snap = await db.collection("timeLogs").where("taskId", "==", taskId).get();
            let total = 0;
            snap.docs.forEach(d => { 
                const dd = d.data(); 
                if (dd.totalHours && dd.endTime) total += dd.totalHours; 
            });
            await db.collection("tasks").doc(taskId).update({
                actualHours: parseFloat(total.toFixed(4)),
                updatedAt: new Date().toISOString(),
            });
            console.log(`  task ${taskId}: actualHours = ${total.toFixed(2)}`);
        } catch (err) {
            console.error(`  task err ${taskId}:`, err.message);
        }
    }

    console.log(`\n=== DONE ===`);
    console.log(`Updated: ${updated} | Unchanged: ${unchanged} | Skipped: ${skipped}`);
    console.log(`Tasks recalculated: ${affectedTaskIds.size}`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
