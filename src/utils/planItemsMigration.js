/**
 * planItemsMigration.js — Weekly Plan Items Migration Report Utility
 * =================================================================
 *
 * ⚠️ REPORT-ONLY: This script analyzes weeklyPlanItems documents
 * and generates a migration report. It does NOT modify any data.
 *
 * Purpose:
 *   After the snapshot-elimination refactoring, this utility helps assess
 *   the state of existing weeklyPlanItems in Firestore:
 *   - How many have a valid taskId?
 *   - How many still depend on snapshot fields?
 *   - How many are orphaned (taskId points to deleted task)?
 *
 * Usage:
 *   Import and call from browser console or a temporary admin page:
 *
 *     import { generateMigrationReport } from './utils/planItemsMigration';
 *     const report = await generateMigrationReport();
 *     console.table(report.summary);
 *     console.log(report.details);
 *
 * Future: Add a cleanup mode that removes deprecated snapshot fields
 * from documents where taskId is valid and the task exists.
 */

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../models/schemas';

// Snapshot fields that are deprecated
const SNAPSHOT_FIELDS = [
    'taskTitleSnapshot',
    'projectNameSnapshot',
    'statusSnapshot',
    'assignedToName',
    // 'priority' and 'colorKey' are also snapshots but harder to distinguish
];

/**
 * Generate a migration report for weeklyPlanItems.
 *
 * @param {Array} [tasks] — Optional: pre-loaded tasks array.
 *                          If not provided, will fetch from Firestore.
 * @returns {Promise<Object>} report with summary and details
 */
export async function generateMigrationReport(tasks = null) {
    console.log('📊 [Migration] Starting weeklyPlanItems analysis...');

    // 1. Fetch all weeklyPlanItems
    const planItemsSnap = await getDocs(collection(db, COLLECTIONS.WEEKLY_PLAN_ITEMS));
    const planItems = planItemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2. Fetch tasks if not provided
    let taskMap;
    if (tasks) {
        taskMap = new Map(tasks.map(t => [t.id, t]));
    } else {
        const tasksSnap = await getDocs(collection(db, COLLECTIONS.TASKS));
        const tasksArr = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        taskMap = new Map(tasksArr.map(t => [t.id, t]));
    }

    // 3. Analyze each plan item
    let totalItems = 0;
    let withTaskId = 0;
    let withoutTaskId = 0;
    let withValidTask = 0;
    let orphaned = 0;
    let withSnapshots = 0;
    let cleanItems = 0;

    const orphanedItems = [];
    const snapshotDependentItems = [];

    planItems.forEach(item => {
        totalItems++;

        if (!item.taskId) {
            withoutTaskId++;
            return;
        }

        withTaskId++;

        const task = taskMap.get(item.taskId);
        if (task) {
            withValidTask++;
        } else {
            orphaned++;
            orphanedItems.push({
                id: item.id,
                taskId: item.taskId,
                taskTitleSnapshot: item.taskTitleSnapshot || '(vacío)',
                weekStartDate: item.weekStartDate,
                date: item.date,
            });
        }

        // Check if item has non-empty snapshot fields
        const hasSnapshots = SNAPSHOT_FIELDS.some(field =>
            item[field] !== undefined && item[field] !== null && item[field] !== ''
        );

        if (hasSnapshots) {
            withSnapshots++;
            snapshotDependentItems.push({
                id: item.id,
                taskId: item.taskId,
                hasValidTask: !!task,
                snapshots: SNAPSHOT_FIELDS.filter(f =>
                    item[f] !== undefined && item[f] !== null && item[f] !== ''
                ),
            });
        } else {
            cleanItems++;
        }
    });

    const summary = {
        totalItems,
        withTaskId,
        withoutTaskId,
        withValidTask,
        orphaned,
        withSnapshots,
        cleanItems,
        snapshotFieldsChecked: SNAPSHOT_FIELDS,
    };

    const report = {
        summary,
        orphanedItems,
        snapshotDependentItems,
        recommendations: [],
    };

    // 4. Generate recommendations
    if (orphaned > 0) {
        report.recommendations.push(
            `⚠️ ${orphaned} plan item(s) huérfano(s) encontrados. ` +
            `Considerar eliminar o archivar estos registros.`
        );
    }
    if (withSnapshots > 0 && withSnapshots === withValidTask) {
        report.recommendations.push(
            `✅ Todos los ${withSnapshots} items con snapshots tienen taskId válido. ` +
            `Es seguro ejecutar limpieza de snapshots.`
        );
    }
    if (withoutTaskId > 0) {
        report.recommendations.push(
            `❌ ${withoutTaskId} plan item(s) sin taskId. Estos son datos inválidos ` +
            `y deberían investigarse manualmente.`
        );
    }
    if (cleanItems === totalItems) {
        report.recommendations.push(
            `🎉 Todos los items ya están limpios de snapshots. No se requiere migración.`
        );
    }

    // 5. Print report
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 WEEKLY PLAN ITEMS — MIGRATION REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.table(summary);
    if (orphanedItems.length > 0) {
        console.log('\n🔍 Items huérfanos:');
        console.table(orphanedItems);
    }
    console.log('\n📝 Recomendaciones:');
    report.recommendations.forEach(r => console.log(`  ${r}`));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return report;
}

/**
 * TODO: Future cleanup function.
 * Removes deprecated snapshot fields from plan items
 * where the taskId is valid and the task exists.
 *
 * ⚠️ NOT IMPLEMENTED — reserved for Phase 2 migration.
 *
 * Usage (future):
 *   import { cleanupSnapshots } from './utils/planItemsMigration';
 *   await cleanupSnapshots({ dryRun: true }); // preview
 *   await cleanupSnapshots({ dryRun: false }); // execute
 */
// export async function cleanupSnapshots({ dryRun = true } = {}) {
//     // TODO: Implement when ready to permanently remove snapshot fields
//     // 1. Run generateMigrationReport()
//     // 2. For each item with valid taskId and existing task:
//     //    - deleteField('taskTitleSnapshot')
//     //    - deleteField('projectNameSnapshot')
//     //    - deleteField('statusSnapshot')
//     //    - deleteField('assignedToName')
//     // 3. Report results
// }
