/**
 * AppDataContext
 * ==============
 * [Phase M.3] Reduced to thin orchestration layer.
 *
 * Engineering data subscriptions → delegated to useEngineeringData
 * BOM data (projects, catalog, items, managed lists) → delegated to useAutoBomData
 * AI/PDF/Excel operations → delegated to aiService
 * Managed list CRUD → delegated to managedListService
 *
 * This context retains ONLY:
 * - Processing/modal state shared across pages
 * - PDF review modal orchestration
 * - Wiring between AI service and UI callbacks
 * - Re-export of delegated data for backward compatibility
 */

import React, { createContext, useContext, useState } from 'react';

// --- Extracted modules ---
import { useAutoBomData } from '../hooks/useAutoBomData';
import { useEngineeringData } from '../hooks/useEngineeringData';
import {
    handlePdfUpload as aiHandlePdfUpload,
    executePdfImport,
    executeExcelImport,
    testGeminiConnection as aiTestConnection,
} from '../services/aiService';
import { saveManagedList } from '../services/managedListService';

// --- Version ---
export const APP_VERSION = "4.5";

const AppDataContext = createContext(null);

export function useAppData() {
    const context = useContext(AppDataContext);
    if (!context) throw new Error('useAppData must be used within an AppDataProvider');
    return context;
}

export function AppDataProvider({ children }) {
    // ============================================================
    // DATA — Delegated to domain hooks
    // ============================================================
    const bomData = useAutoBomData();
    const engineeringData = useEngineeringData();

    // ============================================================
    // PROCESSING STATE
    // ============================================================
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState("");
    const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
    const [lastError, setLastError] = useState(null);

    // ============================================================
    // MODAL STATE (shared across pages)
    // ============================================================
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [listManager, setListManager] = useState({ isOpen: false, type: null, title: '' });

    // PDF Review Modal
    const [isPdfReviewOpen, setIsPdfReviewOpen] = useState(false);
    const [pdfReviewData, setPdfReviewData] = useState(null);
    const [pdfSupplierAnalysis, setPdfSupplierAnalysis] = useState(null);

    // Delay Report Modal
    const [isDelayReportOpen, setIsDelayReportOpen] = useState(false);
    const [delayReportTarget, setDelayReportTarget] = useState(null);

    // ============================================================
    // HANDLERS — AI/PDF/Excel (delegated to aiService)
    // ============================================================

    const processingCallbacks = {
        setIsProcessing,
        setIsDiagnosticOpen,
        setProcessingStatus,
        setLastError,
    };

    const testConnection = () => aiTestConnection(processingCallbacks);

    const handlePdfUpload = async (e, activeProject) => {
        const file = e.target.files[0];
        await aiHandlePdfUpload(file, activeProject, bomData.managedLists.providers, {
            ...processingCallbacks,
            onReviewReady: ({ reviewData, supplierAnalysis }) => {
                setPdfReviewData(reviewData);
                setPdfSupplierAnalysis(supplierAnalysis);
                setIsPdfReviewOpen(true);
            },
        });
        if (e?.target) e.target.value = null;
    };

    const handleConfirmImport = async (reviewedData, activeProject) => {
        await executePdfImport(reviewedData, activeProject);
        setIsPdfReviewOpen(false);
        setPdfReviewData(null);
        setPdfSupplierAnalysis(null);
    };

    const handleExcelUpload = async (e) => {
        const file = e.target.files[0];
        await executeExcelImport(file, {
            ...processingCallbacks,
            onCatalogRefresh: (updatedCatalog) => bomData.setCatalogo(updatedCatalog),
        });
        if (e?.target) e.target.value = null;
    };

    // ============================================================
    // HANDLERS — Managed Lists (delegated to managedListService)
    // ============================================================
    const handleSaveManagedList = (params) => saveManagedList(params);

    // ============================================================
    // CONTEXT VALUE — backward-compatible surface
    // ============================================================

    const value = {
        // BOM Data (spread from hook)
        ...bomData,

        // Engineering Data (spread from hook — backward compatible)
        ...engineeringData,

        // Processing
        isProcessing, setIsProcessing,
        processingStatus, setProcessingStatus,
        isDiagnosticOpen, setIsDiagnosticOpen,
        lastError, setLastError,

        // Modals
        confirmDelete, setConfirmDelete,
        listManager, setListManager,
        isPdfReviewOpen, setIsPdfReviewOpen,
        pdfReviewData, setPdfReviewData,
        pdfSupplierAnalysis, setPdfSupplierAnalysis,
        isDelayReportOpen, setIsDelayReportOpen,
        delayReportTarget, setDelayReportTarget,

        // Handlers (AI/PDF/Excel — delegated)
        testConnection,
        handlePdfUpload,
        handleConfirmImport,
        handleExcelUpload,

        // Handlers (Managed Lists — delegated to managedListService)
        handleSaveManagedList,
    };

    return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
