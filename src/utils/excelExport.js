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
