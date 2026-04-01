/**
 * backfill-timelog-names.cjs
 * =========================
 * One-time migration using Firebase Client SDK (same config as the app).
 * Adds taskTitle, projectName, displayName to existing timeLogs.
 *
 * Usage: node scripts/backfill-timelog-names.cjs
 *
 * Uses GOOGLE_APPLICATION_CREDENTIALS or falls back to firebase-admin
 * with Application Default Credentials.
 */

// Use the firebase-admin SDK with ADC (gcloud auth)
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let app;
try {
    app = initializeApp({
        credential: applicationDefault(),
        projectId: 'bom-ame-cr',
    });
} catch (e) {
    console.error('❌ Could not initialize Firebase Admin.');
    console.error('   Run: gcloud auth application-default login');
    console.error('   Or set GOOGLE_APPLICATION_CREDENTIALS env var.');
    console.error('   Error:', e.message);
    process.exit(1);
}

const db = getFirestore(app);

async function main() {
    console.log('🔄 Backfilling timeLogs with taskTitle, projectName, displayName...\n');

    // 1. Load all tasks
    const tasksSnap = await db.collection('tasks').get();
    const taskMap = {};
    tasksSnap.forEach(doc => {
        const d = doc.data();
        taskMap[doc.id] = { title: d.title || '', projectId: d.projectId || '' };
    });
    console.log(`   📋 Loaded ${Object.keys(taskMap).length} tasks`);

    // 2. Load all projects
    const projectsSnap = await db.collection('projects').get();
    const projectMap = {};
    projectsSnap.forEach(doc => {
        const d = doc.data();
        projectMap[doc.id] = d.name || d.title || '';
    });
    console.log(`   📁 Loaded ${Object.keys(projectMap).length} projects`);

    // 3. Load all users
    const userMap = {};
    const usersRolesSnap = await db.collection('users_roles').get();
    usersRolesSnap.forEach(doc => {
        const d = doc.data();
        userMap[doc.id] = d.displayName || d.name || d.email?.split('@')[0] || '';
    });
    const usersSnap = await db.collection('users').get();
    usersSnap.forEach(doc => {
        const d = doc.data();
        if (!userMap[doc.id]) {
            userMap[doc.id] = d.displayName || d.name || d.email?.split('@')[0] || '';
        }
    });
    console.log(`   👥 Loaded ${Object.keys(userMap).length} users`);

    // 4. Read all timeLogs
    const timeLogsSnap = await db.collection('timeLogs').get();
    console.log(`   ⏱️  Found ${timeLogsSnap.size} timeLogs total\n`);

    let updated = 0;
    let skipped = 0;

    let batch = db.batch();
    let batchCount = 0;

    for (const docSnap of timeLogsSnap.docs) {
        const data = docSnap.data();
        const updates = {};

        if (data.taskId && (!data.taskTitle || data.taskTitle === '')) {
            const taskTitle = taskMap[data.taskId]?.title || '';
            if (taskTitle) updates.taskTitle = taskTitle;
        }

        if (data.projectId && (!data.projectName || data.projectName === '')) {
            const projectName = projectMap[data.projectId] || '';
            if (projectName) updates.projectName = projectName;
        }

        if (data.userId && (!data.displayName || data.displayName === '' || data.displayName === 'Usuario')) {
            const displayName = userMap[data.userId] || '';
            if (displayName) updates.displayName = displayName;
        }

        if (Object.keys(updates).length > 0) {
            batch.update(docSnap.ref, updates);
            batchCount++;
            updated++;

            const taskInfo = updates.taskTitle ? ` task="${updates.taskTitle}"` : '';
            const projInfo = updates.projectName ? ` proj="${updates.projectName}"` : '';
            const userInfo = updates.displayName ? ` user="${updates.displayName}"` : '';
            console.log(`   ✏️  ${docSnap.id}:${taskInfo}${projInfo}${userInfo}`);

            if (batchCount >= 400) {
                await batch.commit();
                console.log(`   💾 Committed batch of ${batchCount}`);
                batch = db.batch();
                batchCount = 0;
            }
        } else {
            skipped++;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
        console.log(`   💾 Committed final batch of ${batchCount}`);
    }

    console.log('\n✅ Done!');
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped (already had names): ${skipped}`);
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
