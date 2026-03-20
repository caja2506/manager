/**
 * BOM Domain Module
 * =================
 * [Phase M.3] Ownership barrel for Bill of Materials functionality.
 * 
 * Surfaces: BOM CRUD, catalog operations, managed lists,
 *           AI import (PDF/Excel), and the BOM data hook.
 */

// --- Data Hook ---
export { useAutoBomData } from '../../hooks/useAutoBomData';

// --- Services ---
export { bomCrudService } from '../../services/bomCrudService';
export {
    deleteBomProject,
    deleteBomItem,
    deleteCatalogRecord,
    deleteBomItemsBatch,
    deleteCatalogRecordsBatch,
    duplicateBomItems,
} from '../../services/bomCrudService';

export {
    saveManagedList,
} from '../../services/managedListService';

// --- AI Import (PDF/Excel) ---
export {
    handlePdfUpload,
    executePdfImport,
    executeExcelImport,
} from '../../services/aiService';
