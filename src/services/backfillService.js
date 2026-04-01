/**
 * backfillTimeLogNames
 * ====================
 * One-time migration: adds taskTitle, projectName, displayName
 * to existing timeLogs documents that are missing them.
 * Runs client-side using the authenticated user's session.
 */
import { db } from '../firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

export async function backfillTimeLogNames(onProgress) {
    const log = (msg) => {
        console.log(msg);
        onProgress?.(msg);
    };

    log('📋 Cargando tareas...');
    const tasksSnap = await getDocs(collection(db, 'tasks'));
    const taskMap = {};
    tasksSnap.forEach(d => {
        const data = d.data();
        taskMap[d.id] = { title: data.title || '', projectId: data.projectId || '' };
    });
    log(`   ${Object.keys(taskMap).length} tareas cargadas`);

    log('📁 Cargando proyectos...');
    const projectsSnap = await getDocs(collection(db, 'projects'));
    const projectMap = {};
    projectsSnap.forEach(d => {
        const data = d.data();
        projectMap[d.id] = data.name || data.title || '';
    });
    log(`   ${Object.keys(projectMap).length} proyectos cargados`);

    log('👥 Cargando usuarios...');
    const userMap = {};
    const urSnap = await getDocs(collection(db, 'users_roles'));
    urSnap.forEach(d => {
        const data = d.data();
        userMap[d.id] = data.displayName || data.name || data.email?.split('@')[0] || '';
    });
    const uSnap = await getDocs(collection(db, 'users'));
    uSnap.forEach(d => {
        const data = d.data();
        if (!userMap[d.id]) {
            userMap[d.id] = data.displayName || data.name || data.email?.split('@')[0] || '';
        }
    });
    log(`   ${Object.keys(userMap).length} usuarios cargados`);

    log('⏱️ Leyendo timeLogs...');
    const timeLogsSnap = await getDocs(collection(db, 'timeLogs'));
    log(`   ${timeLogsSnap.size} timeLogs encontrados\n`);

    let updated = 0;
    let skipped = 0;
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const docSnap of timeLogsSnap.docs) {
        const data = docSnap.data();
        const updates = {};

        if (data.taskId && (!data.taskTitle || data.taskTitle === '')) {
            const title = taskMap[data.taskId]?.title || '';
            if (title) updates.taskTitle = title;
        }

        if (data.projectId && (!data.projectName || data.projectName === '')) {
            const name = projectMap[data.projectId] || '';
            if (name) updates.projectName = name;
        }

        if (data.userId && (!data.displayName || data.displayName === '' || data.displayName === 'Usuario')) {
            const name = userMap[data.userId] || '';
            if (name) updates.displayName = name;
        }

        if (Object.keys(updates).length > 0) {
            batch.update(doc(db, 'timeLogs', docSnap.id), updates);
            batchCount++;
            updated++;

            const parts = [];
            if (updates.taskTitle) parts.push(`tarea="${updates.taskTitle}"`);
            if (updates.projectName) parts.push(`proy="${updates.projectName}"`);
            if (updates.displayName) parts.push(`user="${updates.displayName}"`);
            log(`✏️ ${docSnap.id}: ${parts.join(', ')}`);

            if (batchCount >= 400) {
                await batch.commit();
                log(`💾 Batch de ${batchCount} guardado`);
                batch = writeBatch(db);
                batchCount = 0;
            }
        } else {
            skipped++;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
        log(`💾 Batch final de ${batchCount} guardado`);
    }

    const summary = `✅ Migración completada: ${updated} actualizados, ${skipped} sin cambios`;
    log(summary);
    return { updated, skipped, summary };
}
