/* eslint-disable react-refresh/only-export-components */
/**
 * AppDataContext
 * ==============
 * [Phase M.6] Reduced to BOM data + processing/modal state + AI handlers.
 *
 * Engineering data subscriptions → use useEngineeringData directly
 * BOM data (projects, catalog, items, managed lists) → useAutoBomData
 * Predictive Analytics/PDF/Excel operations → analyticService
 * Managed list CRUD → managedListService
 *
 * This context retains ONLY:
 * - BOM data (via useAutoBomData)
 * - Processing/modal state shared across pages
 * - PDF review modal orchestration
 * - Wiring between AI service and UI callbacks
 * - Managed list handler
 */

import React, { createContext, useContext, useState } from 'react';

// --- Extracted modules ---
import { useAutoBomData } from '../hooks/useAutoBomData';
import {
    executePdfUploadPipeline as aiHandlePdfUpload,
    executeImageUploadPipeline as aiHandleImageUpload,
    executePdfImport,
    executeExcelImport,
    testGeminiConnection as aiTestConnection,
} from '../services/analyticService';
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
    // DATA — BOM data only (engineering data moved to useEngineeringData)
    // ============================================================
    const bomData = useAutoBomData();

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

    // Global Task Modal
    const [isGlobalTaskModalOpen, setIsGlobalTaskModalOpen] = useState(false);

    // Global Time Log Modal
    const [isGlobalTimeLogModalOpen, setIsGlobalTimeLogModalOpen] = useState(false);

    // ============================================================
    // HANDLERS — Predictive Analytics/PDF/Excel (delegated to analyticService)
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
        await aiHandlePdfUpload(file, bomData.managedLists.providers, {
            ...processingCallbacks,
            onReviewReady: ({ reviewData, supplierAnalysis }) => {
                setPdfReviewData(reviewData);
                setPdfSupplierAnalysis(supplierAnalysis);
                setIsPdfReviewOpen(true);
            },
        }, activeProject?.id);
        if (e?.target) e.target.value = null;
    };

    const handleConfirmImport = async (reviewedData, activeProject) => {
        await executePdfImport(reviewedData, activeProject, processingCallbacks);
        setIsPdfReviewOpen(false);
        setPdfReviewData(null);
        setPdfSupplierAnalysis(null);
    };

    const handleImageUpload = async (imageFile, activeProject) => {
        await aiHandleImageUpload(imageFile, bomData.managedLists.providers, {
            ...processingCallbacks,
            onReviewReady: ({ reviewData, supplierAnalysis }) => {
                setPdfReviewData(reviewData);
                setPdfSupplierAnalysis(supplierAnalysis);
                setIsPdfReviewOpen(true);
            },
        }, activeProject?.id);
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
        isGlobalTaskModalOpen, setIsGlobalTaskModalOpen,
        isGlobalTimeLogModalOpen, setIsGlobalTimeLogModalOpen,

        // Handlers (AI/PDF/Excel/Image — delegated)
        testConnection,
        handlePdfUpload,
        handleImageUpload,
        handleConfirmImport,
        handleExcelUpload,

        // Handlers (Managed Lists — delegated to managedListService)
        handleSaveManagedList,
    };

    return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
