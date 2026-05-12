import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('c:/Users/CJ00083620/.gemini/antigravity/scratch/autobom-pro/service-account.json', 'utf8'));

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
    const taskIds = ['PXvO9hr6LB', '63fv42eOmd'];
    
    for (const taskId of taskIds) {
        console.log(`\n============ TASK: ${taskId} ============`);
        
        // 1. Get task doc
        const taskDoc = await db.collection('tasks').doc(taskId).get();
        if (taskDoc.exists) {
            const data = taskDoc.data();
            console.log(`Task title: ${data.title}`);
            console.log(`Task status: ${data.status}`);
            console.log(`AssignedTo: ${data.assignedTo}`);
            // Check if there are assignee history or something
            let assignedName = 'Unknown';
            if (data.assignedTo) {
                const userDoc = await db.collection('users').doc(data.assignedTo).get();
                if (userDoc.exists) assignedName = userDoc.data().displayName;
            }
            console.log(`AssignedTo Name: ${assignedName}`);
        } else {
            console.log('Task not found');
        }

        // 2. Get time logs
        const timeLogs = await db.collection('timeLogs').where('taskId', '==', taskId).get();
        console.log(`\nTime logs for ${taskId}: ${timeLogs.size}`);
        timeLogs.forEach(doc => {
            const d = doc.data();
            console.log(` - ID: ${doc.id}`);
            console.log(`   userId: ${d.userId}`);
            console.log(`   date: ${d.date}`);
            console.log(`   startTime: ${d.startTime}`);
            console.log(`   endTime: ${d.endTime}`);
            console.log(`   totalHours: ${d.totalHours}`);
        });

        // 3. Get subtasks
        const subtasks = await db.collection('subtasks').where('taskId', '==', taskId).get();
        console.log(`\nSubtasks for ${taskId}: ${subtasks.size}`);
        subtasks.forEach(doc => {
            const d = doc.data();
            const cAt = d.completedAt ? (d.completedAt.toDate ? d.completedAt.toDate().toISOString() : d.completedAt) : null;
            console.log(` - ${doc.id}: ${d.title} (completed: ${d.completed}, completedAt: ${cAt})`);
        });
    }
}

run().catch(console.error).finally(() => process.exit());
