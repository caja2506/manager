/**
 * riskService.supabase.js
 * ========================
 * Supabase implementation: project risk calculation and management.
 */

import { supabase } from '../supabase';
import { RISK_LEVEL, TASK_STATUS } from '../models/schemas';

/**
 * Recalculate and update the risk score of a given project.
 */
export async function calculateProjectRisk(projectId) {
    if (!projectId) return;

    try {
        // 1. Fetch related data in parallel
        const [tasksRes, delaysRes, timeLogsRes, allTasksRes] = await Promise.all([
            supabase.from('tasks').select('status, assigned_to').eq('project_id', projectId),
            supabase.from('delays').select('resolved').eq('project_id', projectId),
            supabase.from('time_logs').select('overtime, overtime_hours').eq('project_id', projectId),
            supabase.from('tasks').select('assigned_to, status'),
        ]);

        const tasks = tasksRes.data || [];
        const delays = delaysRes.data || [];
        const timeLogs = timeLogsRes.data || [];
        const allTasks = allTasksRes.data || [];

        // 2. Compute metrics
        const delayedTasks = tasks.filter(t => t.status === TASK_STATUS.BLOCKED).length;
        const tasksInValidation = tasks.filter(t => t.status === TASK_STATUS.VALIDATION).length;
        const activeDelays = delays.filter(d => !d.resolved).length;

        let overtimeHours = 0;
        timeLogs.forEach(log => {
            if (log.overtime && log.overtime_hours) {
                overtimeHours += Number(log.overtime_hours);
            }
        });

        const projectAssignees = [...new Set(tasks.map(t => t.assigned_to).filter(Boolean))];
        const ownerOverloaded = projectAssignees.some(uid => {
            const activeTaskCount = allTasks.filter(
                t => t.assigned_to === uid && !['completed', 'cancelled'].includes(t.status)
            ).length;
            return activeTaskCount > 8;
        });

        // 3. Risk formula
        let score = (delayedTasks * 20) + (overtimeHours * 2) + (activeDelays * 15) + (tasksInValidation * 10) + (ownerOverloaded ? 15 : 0);

        let level = RISK_LEVEL.LOW;
        if (score >= 30 && score <= 59) level = RISK_LEVEL.MEDIUM;
        else if (score >= 60) level = RISK_LEVEL.HIGH;

        // 4. Factors
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
        const { error } = await supabase
            .from('projects')
            .update({
                risk_score: score,
                risk_level: level,
                risk_factors: factors,
                risk_summary: summary,
                risk_updated_at: new Date().toISOString(),
            })
            .eq('id', projectId);

        if (error) console.error('[riskService] Error updating project risk:', error.message);

    } catch (error) {
        console.error('Error calculating project risk:', error);
    }
}
