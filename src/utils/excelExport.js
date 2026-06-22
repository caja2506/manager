import * as XLSX from 'xlsx';

/**
 * Downloads a worksheet generated from an array of objects.
 * 
 * @param {Array<Object>}  data   The objects to be turned into excel rows
 * @param {string}         fileName The name of the file (without .xlsx)
 * @param {string}         sheetName The name of the inner sheet
 */
export function exportToExcel(data, fileName, sheetName = 'Reporte') {
    if (!data || data.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Flattens the Daily Report structure to be exported as a simple sheet.
 */
export function exportDailyReport(report, displayName) {
    if (!report) return;

    // Header row with global stats
    const globalData = [{
        'Fecha': report.date,
        'Usuario': displayName,
        'Horas Totales': report.totalHours,
        'Horas Extra': report.overtimeHours,
        'Tareas Completadas': report.tasksCompleted,
        'Retrasos Reportados': report.delaysReported,
        'Notas Fijas': report.notesSummary,
    }];

    // Task rows
    const tasksData = report.tasksWorked.map(tw => ({
        'Fecha': report.date,
        'Usuario': displayName,
        'Proyecto': tw.projectName,
        'Tarea': tw.taskTitle,
        'Cantidad Registros': tw.logCount,
        'Horas Invertidas': tw.hours.toFixed(2),
    }));

    // Combine them with a spacer or export as two sheets (for simplicity we will use two sheets)
    const wb = XLSX.utils.book_new();

    const wsGlobal = XLSX.utils.json_to_sheet(globalData);
    XLSX.utils.book_append_sheet(wb, wsGlobal, 'Resumen_Diario');

    const wsTasks = XLSX.utils.json_to_sheet(tasksData);
    XLSX.utils.book_append_sheet(wb, wsTasks, 'Tareas_Diarias');

    XLSX.writeFile(wb, `Reporte_Diario_${displayName.replace(/\s+/g, '_')}_${report.date}.xlsx`);
}

/**
 * Flattens the Weekly Report structure to be exported.
 */
export function exportWeeklyReport(report, displayName) {
    if (!report) return;

    const globalData = [{
        'Semana': `${report.startDate} a ${report.endDate}`,
        'Usuario': displayName,
        'Horas Totales': report.totalHours,
        'Horas Extra': report.overtimeHours,
        'Tareas Completadas': report.tasksCompleted,
        'Retrasos Reportados': report.delaysReported,
    }];

    const dailyData = report.dailyReports.map(d => ({
        'Fecha': d.date,
        'Usuario': displayName,
        'Horas Productivas': d.totalHours,
        'Horas Extra': d.overtimeHours,
        'Tareas Completadas': d.tasksCompleted,
        'Retrasos': d.delaysReported,
    }));

    const wb = XLSX.utils.book_new();

    const wsGlobal = XLSX.utils.json_to_sheet(globalData);
    XLSX.utils.book_append_sheet(wb, wsGlobal, 'Resumen_Semanal');

    const wsDaily = XLSX.utils.json_to_sheet(dailyData);
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Desglose_Semanal');

    XLSX.writeFile(wb, `Reporte_Semanal_${displayName.replace(/\s+/g, '_')}_${report.startDate}.xlsx`);
}

/**
 * Exports the Main Table filtered tasks to a multi-sheet Excel file.
 *
 * @param {Object} opts
 * @param {Array}  opts.tasks          Filtered tasks array
 * @param {Array}  opts.engProjects    Engineering projects for lookup
 * @param {Array}  opts.teamMembers    Team members for lookup
 * @param {Array}  opts.taskTypes      Task type catalog
 * @param {Array}  opts.workAreaTypes  Work area catalog
 * @param {Array}  opts.engSubtasks    Subtasks for progress calc
 */
export function exportMainTableToExcel({ tasks, engProjects, teamMembers, taskTypes, workAreaTypes, engSubtasks }) {
    if (!tasks || tasks.length === 0) {
        alert('No hay tareas para exportar.');
        return;
    }

    // ── Lookup helpers ──
    const findName = (arr, id) => (arr || []).find(i => i.id === id)?.name || '';
    const findMember = (id) => {
        const m = (teamMembers || []).find(u => u.uid === id || u.id === id);
        return m?.displayName || m?.email || '';
    };

    const STATUS_LABELS = {
        in_progress: 'In Progress', pending: 'To Do', backlog: 'Backlog',
        validation: 'Revisión', completed: 'Completado', blocked: 'Bloqueado', cancelled: 'Cancelado',
    };
    const PRIORITY_LABELS = {
        low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica',
    };

    const fmtDate = (d) => {
        if (!d) return '';
        const date = new Date(d);
        return isNaN(date) ? '' : date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    // ── Sheet 1: Tareas ──
    const rows = tasks.map(task => {
        const subs = (engSubtasks || []).filter(s => s.taskId === task.id);
        const totalSubs = subs.length;
        const doneSubs = subs.filter(s => s.completed || s.done).length;
        const subsPct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;
        const progressPct = task.percentComplete != null ? Math.round(task.percentComplete) : (task.status === 'completed' ? 100 : subsPct);

        // Health (metodología)
        let methHealth = 0;
        if (totalSubs > 0) methHealth += 15;
        if ((task.estimatedHours || 0) > 0) methHealth += 20;
        if (task.assignedTo) methHealth += 20;
        if (task.dueDate || task.plannedEndDate) methHealth += 15;
        if (task.taskTypeId) methHealth += 10;
        if ((task.description || '').trim().length >= 10) methHealth += 10;
        if (task.priority !== 'critical' || task.milestoneId) methHealth += 10;

        // Score (operativo)
        let opScore = null;
        if (task.status !== 'cancelled') {
            opScore = task.status === 'completed' ? 100 : 100;
            if (task.status !== 'completed') {
                const startRaw = task.plannedStartDate || task.createdAt;
                const endRaw = task.dueDate || task.plannedEndDate;
                const startDate = startRaw ? new Date(startRaw) : null;
                const endDate = endRaw ? new Date(endRaw) : null;
                const now = new Date();
                let daysLeft = null;
                let timelinePct = 0;
                if (startDate && endDate) {
                    const total = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));
                    const elapsed = Math.max(0, (now - startDate) / (1000 * 60 * 60 * 24));
                    timelinePct = Math.min(100, Math.max(0, (elapsed / total) * 100));
                    daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                }
                const hoursPct = (task.estimatedHours || 0) > 0 ? Math.round(((task.actualHours || 0) / task.estimatedHours) * 100) : 0;
                if (daysLeft !== null && daysLeft < 0) opScore -= Math.min(40, Math.abs(daysLeft) * 4);
                else if (daysLeft !== null && daysLeft <= 2) opScore -= 15;
                if (hoursPct > 120) opScore -= 25;
                else if (hoursPct > 100) opScore -= 15;
                else if (hoursPct > 85) opScore -= 5;
                if (timelinePct > 70 && progressPct < 30) opScore -= 20;
                else if (timelinePct > 50 && progressPct < 20) opScore -= 10;
                opScore = Math.max(0, Math.min(100, opScore));
            }
        }

        return {
            'Tarea': task.title || '',
            'Responsable': findMember(task.assignedTo),
            'Proyecto': findName(engProjects, task.projectId),
            'Estado': STATUS_LABELS[task.status] || task.status || '',
            'Área': findName(workAreaTypes, task.workAreaTypeId),
            'Tipo': findName(taskTypes, task.taskTypeId),
            'Avance %': progressPct,
            'Health': methHealth,
            'Score': opScore ?? '',
            'Fecha Inicio': fmtDate(task.plannedStartDate),
            'Fecha Fin': fmtDate(task.dueDate || task.plannedEndDate),
            'Horas Reales': task.actualHours || 0,
            'Horas Estimadas': task.estimatedHours || 0,
            'Prioridad': PRIORITY_LABELS[task.priority] || task.priority || '',
            'Asignado Por': findMember(task.assignedBy),
            'Subtareas': totalSubs > 0 ? `${doneSubs}/${totalSubs}` : '',
        };
    });

    // ── Sheet 2: Resumen ──
    const statusCount = {};
    const priorityCount = {};
    let totalActual = 0, totalEstimated = 0;
    tasks.forEach(t => {
        const sl = STATUS_LABELS[t.status] || t.status;
        statusCount[sl] = (statusCount[sl] || 0) + 1;
        const pl = PRIORITY_LABELS[t.priority] || t.priority || 'Media';
        priorityCount[pl] = (priorityCount[pl] || 0) + 1;
        totalActual += t.actualHours || 0;
        totalEstimated += t.estimatedHours || 0;
    });

    const summaryRows = [
        { 'Métrica': 'Total Tareas', 'Valor': tasks.length },
        { 'Métrica': 'Horas Reales (total)', 'Valor': totalActual.toFixed(1) },
        { 'Métrica': 'Horas Estimadas (total)', 'Valor': totalEstimated.toFixed(1) },
        { 'Métrica': '', 'Valor': '' },
        { 'Métrica': '— Distribución por Estado —', 'Valor': '' },
        ...Object.entries(statusCount).map(([k, v]) => ({ 'Métrica': k, 'Valor': v })),
        { 'Métrica': '', 'Valor': '' },
        { 'Métrica': '— Distribución por Prioridad —', 'Valor': '' },
        ...Object.entries(priorityCount).map(([k, v]) => ({ 'Métrica': k, 'Valor': v })),
    ];

    // ── Build workbook ──
    const wb = XLSX.utils.book_new();

    const wsTasks = XLSX.utils.json_to_sheet(rows);
    // Auto-fit column widths
    const colWidths = Object.keys(rows[0] || {}).map(key => {
        const maxLen = Math.max(key.length, ...rows.map(r => String(r[key] || '').length));
        return { wch: Math.min(maxLen + 2, 40) };
    });
    wsTasks['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, wsTasks, 'Tareas');

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `MainTable_${today}.xlsx`);
}
