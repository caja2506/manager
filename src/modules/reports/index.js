/**
 * Reports Domain Module
 * =====================
 * [Phase M.3] Ownership barrel for daily & weekly reports.
 *
 * Surfaces: report generation, daily scrum logic,
 *           Excel export, and engineering data.
 */

// --- Data Hooks ---
export { useEngineeringData } from '../../hooks/useEngineeringData';

// --- Services ---
export {
    generateDailyReport,
    generateWeeklyReport,
    getRecentReports,
} from '../../services/reportService';

// --- Utils ---
export { exportToExcel } from '../../utils/excelExport';

// --- Core ---
export { generateDailyScrumAgenda } from '../../core/dailyScrum/scrumAgendaBuilder';
