/**
 * Risk Service
 * ============
 * Calculates and manages project risk scores based on the automation engineering blueprint.
 */

import { doc, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, RISK_LEVEL, TASK_STATUS } from '../models/schemas';

/**
 * Recalculate and update the risk score of a given project.
 * @param {string} projectId 
 */
export async function calculateProjectRisk(projectId) {
    if (!projectId) return;

    try {
        // 1. Fetch related data
        const tasksSnap = await getDocs(query(collection(db, COLLECTIONS.TASKS), where('projectId', '==', projectId)));
        const delaysSnap = await getDocs(query(collection(db, COLLECTIONS.DELAYS), where('projectId', '==', projectId)));
        const timeLogsSnap = await getDocs(query(collection(db, COLLECTIONS.TIME_LOGS), where('projectId', '==', projectId)));

        // 2. Compute metrics
        const tasks = tasksSnap.docs.map(d => d.data());
        const delays = delaysSnap.docs.map(d => d.data());
        const timeLogs = timeLogsSnap.docs.map(d => d.data());

        const delayedTasks = tasks.filter(t => t.status === TASK_STATUS.BLOCKED).length;
        const tasksInValidation = tasks.filter(t => t.status === TASK_STATUS.VALIDATION).length;
        const activeDelays = delays.filter(d => !d.resolved).length;

        let overtimeHours = 0;
        timeLogs.forEach(log => {
            if (log.overtime && log.overtimeHours) {
                overtimeHours += Number(log.overtimeHours);
            }
        });

        // ownerOverloaded: check if any project assignee has > 8 active tasks across all projects
        const allTasksSnap = await getDocs(query(collection(db, COLLECTIONS.TASKS)));
        const allTasks = allTasksSnap.docs.map(d => d.data());
        const projectAssignees = [...new Set(tasks.map(t => t.assignedTo).filter(Boolean))];

        const ownerOverloaded = projectAssignees.some(uid => {
            const activeTaskCount = allTasks.filter(
                t => t.assignedTo === uid && !['completed', 'cancelled'].includes(t.status)
            ).length;
            return activeTaskCount > 8;
        });

        // 3. Risk formula
        // delayedTasks × 20
        // overtimeHours × 2
        // activeDelays × 15
        // tasksInValidation × 10
        // ownerOverloaded ? 15 : 0
        let score = (delayedTasks * 20) + (overtimeHours * 2) + (activeDelays * 15) + (tasksInValidation * 10) + (ownerOverloaded ? 15 : 0);

        let level = RISK_LEVEL.LOW;
        if (score >= 30 && score <= 59) level = RISK_LEVEL.MEDIUM;
        else if (score >= 60) level = RISK_LEVEL.HIGH;

        // 4. Determine primary factors for summary
        const factors = [];
        if (delayedTasks > 0) factors.push(`${delayedTasks} tareas bloqueadas`);
        if (activeDelays > 0) factors.push(`${activeDelays} retrasos activos`);
        if (overtimeHours > 0) factors.push(`${overtimeHours.toFixed(1)} horas de horas extra`);
        if (tasksInValidation > 0) factors.push(`${tasksInValidation} tareas en validación`);
        if (ownerOverloaded) factors.push('Responsable(s) sobrecargado(s) (>8 tareas activas)');

        const summary = factors.length > 0
            ? `Riesgo detectado por: ${factors.join(', ')}.`
            : 'Proyecto estable sin factores de riesgo significativos.';

        // 5. Update Project record
        await updateDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
            riskScore: score,
            riskLevel: level,
            riskFactors: factors,
            riskSummary: summary,
            riskUpdatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error("Error calculating project risk:", error);
    }
}
