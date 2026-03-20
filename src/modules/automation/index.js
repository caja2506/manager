/**
 * Automation Domain Module
 * ========================
 * [Phase M.3] Ownership barrel for AI automation, monitoring,
 * AI governance, and the Telegram bot integration.
 *
 * NOTE: aiService.js is NOT re-exported here because it is
 * BOM-domain (PDF/Excel import). This module focuses on the
 * automation orchestration layer, not AI import.
 */

// --- Services ---
export {
    loadRecentAIExecutions,
    loadTodayAIMetrics,
} from '../../services/automationDataService';

export {
    getGovernanceConfig,
    updateGovernanceConfig,
} from '../../services/aiGovernanceService';

export {
    getAITrace,
    listAITraces,
} from '../../services/aiTraceService';

// --- Automation Core ---
export { bootstrapAutomation } from '../../automation/bootstrapAutomation';
export { AUTOMATION_CONSTANTS } from '../../automation/constants';
