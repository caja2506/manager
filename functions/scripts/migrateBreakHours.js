/**
 * Migration Script: Fix timeLogs break deduction
 * ================================================
 * Recalculates totalHours for ALL timeLogs that have startTime + endTime,
 * deducting break time overlaps. Saves original value as totalHoursGross.
 *
 * Run via: node functions/scripts/migrateBreakHours.js
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Firebase Admin SDK init.
 */

const admin = require("firebase-admin");
const { getEffectiveHours } = require("../utils/breakTimeUtils");

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

async function migrateBreakHours() {
    console.log("═══════════════════════════════════════════════");
    console.log("  MIGRATION: Fix timeLogs break deduction");
    console.log("═══════════════════════════════════════════════\n");

    const logsSnap = await db.collection("timeLogs").get();
    console.log(`Total timeLogs: ${logsSnap.size}`);

    let updated = 0;
    let skipped = 0;
    let unchanged = 0;
    let errors = 0;
    const affectedTaskIds = new Set();
    const batch = [];

    for (const doc of logsSnap.docs) {
        const data = doc.data();

        // Skip logs without start+end times (active timers or old data)
        if (!data.startTime || !data.endTime) {
            skipped++;
            continue;
        }

        // Skip if already migrated
        if (data.totalHoursGross !== undefined) {
            skipped++;
            continue;
        }

        try {
            const start = new Date(data.startTime);
            const end = new Date(data.endTime);
            const grossHours = (end - start) / 3_600_000;
            const netHours = getEffectiveHours(start, end);
            const breakDeducted = parseFloat((grossHours - netHours).toFixed(4));

            if (breakDeducted <= 0) {
                // No break overlap — just tag it as migrated
                batch.push({
                    ref: doc.ref,
                    update: {
                        totalHoursGross: parseFloat(grossHours.toFixed(6)),
                        breakHoursDeducted: 0,
                    },
                });
                unchanged++;
            } else {
                // Has break overlap — fix totalHours
                batch.push({
                    ref: doc.ref,
                    update: {
                        totalHours: parseFloat(netHours.toFixed(6)),
                        totalHoursGross: parseFloat(grossHours.toFixed(6)),
                        breakHoursDeducted: breakDeducted,
                    },
                });
                updated++;
                if (data.taskId) affectedTaskIds.add(data.taskId);

                console.log(
                    `  ✏️  ${doc.id}: ${grossHours.toFixed(2)}h → ${netHours.toFixed(2)}h (-${breakDeducted.toFixed(2)}h breaks) | ${data.startTime?.substring(0, 16)} → ${data.endTime?.substring(0, 16)}`
                );
            }
        } catch (err) {
            console.error(`  ❌ Error processing ${doc.id}:`, err.message);
            errors++;
        }
    }

    // Execute batch updates (Firestore max 500 per batch)
    console.log(`\nExecuting ${batch.length} updates...`);
    for (let i = 0; i < batch.length; i += 500) {
        const chunk = batch.slice(i, i + 500);
        const writeBatch = db.batch();
        chunk.forEach(({ ref, update }) => writeBatch.update(ref, update));
        await writeBatch.commit();
        console.log(`  Committed batch ${Math.floor(i / 500) + 1} (${chunk.length} docs)`);
    }

    // Recalculate actualHours for affected tasks
    console.log(`\nRecalculating actualHours for ${affectedTaskIds.size} tasks...`);
    for (const taskId of affectedTaskIds) {
        try {
            const taskLogsSnap = await db.collection("timeLogs")
                .where("taskId", "==", taskId)
                .get();

            let totalHours = 0;
            taskLogsSnap.docs.forEach(d => {
                const logData = d.data();
                if (logData.totalHours && logData.endTime) {
                    totalHours += logData.totalHours;
                }
            });

            totalHours = parseFloat(totalHours.toFixed(4));
            await db.collection("tasks").doc(taskId).update({
                actualHours: totalHours,
                updatedAt: new Date().toISOString(),
            });
            console.log(`  ✅ Task ${taskId}: actualHours = ${totalHours}`);
        } catch (err) {
            console.error(`  ❌ Task ${taskId} update failed:`, err.message);
        }
    }

    console.log("\n═══════════════════════════════════════════════");
    console.log(`  RESULTS:`);
    console.log(`  Updated:   ${updated}`);
    console.log(`  Unchanged: ${unchanged}`);
    console.log(`  Skipped:   ${skipped}`);
    console.log(`  Errors:    ${errors}`);
    console.log(`  Tasks recalculated: ${affectedTaskIds.size}`);
    console.log("═══════════════════════════════════════════════\n");
}

// Also export as Cloud Function callable
async function migrateBreakHoursCallable(adminDb) {
    const logsSnap = await adminDb.collection("timeLogs").get();
    let updated = 0;
    let skipped = 0;
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

            const update = {
                totalHoursGross: parseFloat(grossHours.toFixed(6)),
                breakHoursDeducted: breakDeducted,
            };
            if (breakDeducted > 0) {
                update.totalHours = parseFloat(netHours.toFixed(6));
                updated++;
                if (data.taskId) affectedTaskIds.add(data.taskId);
            }
            await doc.ref.update(update);
        } catch { skipped++; }
    }

    // Recalculate affected tasks
    for (const taskId of affectedTaskIds) {
        try {
            const snap = await adminDb.collection("timeLogs").where("taskId", "==", taskId).get();
            let total = 0;
            snap.docs.forEach(d => { const dd = d.data(); if (dd.totalHours && dd.endTime) total += dd.totalHours; });
            await adminDb.collection("tasks").doc(taskId).update({
                actualHours: parseFloat(total.toFixed(4)),
                updatedAt: new Date().toISOString(),
            });
        } catch { /* skip */ }
    }

    return { updated, skipped, tasksRecalculated: affectedTaskIds.size };
}

module.exports = { migrateBreakHours, migrateBreakHoursCallable };

// Run directly if called from command line
if (require.main === module) {
    migrateBreakHours()
        .then(() => process.exit(0))
        .catch(err => { console.error(err); process.exit(1); });
}
