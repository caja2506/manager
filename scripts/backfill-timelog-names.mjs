/**
 * backfill-timelog-names.mjs
 * =========================
 * One-time migration using Firebase Web SDK + signInWithEmailAndPassword.
 * Adds taskTitle, projectName, displayName to existing timeLogs.
 *
 * Usage: node scripts/backfill-timelog-names.mjs
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyDGUTnCBWhPpyOrjAf5eQbQaQz0Dm18NXc",
    authDomain: "bom-ame-cr.firebaseapp.com",
    projectId: "bom-ame-cr",
    storageBucket: "bom-ame-cr.firebasestorage.app",
    messagingSenderId: "865326401984",
    appId: "1:865326401984:web:ebad6ca9ee666eaec3a025",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Authenticate as admin
const EMAIL = process.env.FIREBASE_EMAIL || 'caja2506@gmail.com';
const PASSWORD = process.env.FIREBASE_PASSWORD;

if (!PASSWORD) {
    console.error('❌ Set FIREBASE_PASSWORD env var to run this script.');
    console.error('   Example: $env:FIREBASE_PASSWORD="yourpass"; node scripts/backfill-timelog-names.mjs');
    process.exit(1);
}

async function main() {
    console.log(`🔐 Signing in as ${EMAIL}...`);
    await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
    console.log('✅ Signed in!\n');

    console.log('🔄 Backfilling timeLogs with taskTitle, projectName, displayName...\n');

    // 1. Load tasks
    const tasksSnap = await getDocs(collection(db, 'tasks'));
    const taskMap = {};
    tasksSnap.forEach(doc => {
        const d = doc.data();
        taskMap[doc.id] = { title: d.title || '', projectId: d.projectId || '' };
    });
    console.log(`   📋 Loaded ${Object.keys(taskMap).length} tasks`);

    // 2. Load projects
    const projectsSnap = await getDocs(collection(db, 'projects'));
    const projectMap = {};
    projectsSnap.forEach(doc => {
        const d = doc.data();
        projectMap[doc.id] = d.name || d.title || '';
    });
    console.log(`   📁 Loaded ${Object.keys(projectMap).length} projects`);

    // 3. Load users
    const userMap = {};
    const usersRolesSnap = await getDocs(collection(db, 'users_roles'));
    usersRolesSnap.forEach(doc => {
        const d = doc.data();
        userMap[doc.id] = d.displayName || d.name || d.email?.split('@')[0] || '';
    });
    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.forEach(doc => {
        const d = doc.data();
        if (!userMap[doc.id]) {
            userMap[doc.id] = d.displayName || d.name || d.email?.split('@')[0] || '';
        }
    });
    console.log(`   👥 Loaded ${Object.keys(userMap).length} users`);

    // 4. Read all timeLogs
    const timeLogsSnap = await getDocs(collection(db, 'timeLogs'));
    console.log(`   ⏱️  Found ${timeLogsSnap.size} timeLogs total\n`);

    let updated = 0;
    let skipped = 0;

    let batch = writeBatch(db);
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
                batch = writeBatch(db);
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

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
});
