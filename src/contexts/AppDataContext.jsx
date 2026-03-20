/**
 * AppDataContext
 * ==============
 * 
 * Centralized data layer for the Engineering Management Platform.
 * 
 * BOM data (projects, catalog, items, managed lists) is delegated to
 * useAutoBomData hook. AI/PDF/Excel operations are delegated to aiService.
 * 
 * This context retains:
 * - Engineering Firestore subscriptions (tasks, projects, team, etc.)
 * - Managed list handlers (taskType, workAreaType, milestoneType, categories, etc.)
 * - Processing/modal state shared across pages
 * - PDF review modal orchestration
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
    collection, onSnapshot, doc, getDocs,
    writeBatch, query, where
} from 'firebase/firestore';
import { COLLECTIONS } from '../models/schemas';
import { db } from '../firebase';

// --- Extracted modules ---
import { useAutoBomData } from '../hooks/useAutoBomData';
import {
    handlePdfUpload as aiHandlePdfUpload,
    executePdfImport,
    executeExcelImport,
    testGeminiConnection as aiTestConnection,
} from '../services/aiService';

// --- Version ---
export const APP_VERSION = "4.5";

const AppDataContext = createContext(null);

export function useAppData() {
    const context = useContext(AppDataContext);
    if (!context) throw new Error('useAppData must be used within an AppDataProvider');
    return context;
}

const safeLocaleCompare = (a, b, field) => String(a[field] || '').localeCompare(String(b[field] || ''));

export function AppDataProvider({ children }) {
    // ============================================================
    // BOM DATA — Delegated to useAutoBomData hook
    // ============================================================
    const bomData = useAutoBomData();

    // ============================================================
    // ENGINEERING DATA — Firestore Subscriptions
    // ============================================================
    const [engProjects, setEngProjects] = useState([]);
    const [engTasks, setEngTasks] = useState([]);
    const [engSubtasks, setEngSubtasks] = useState([]);
    const [taskTypes, setTaskTypes] = useState([]);
    const [workAreaTypes, setWorkAreaTypes] = useState([]);
    const [milestoneTypes, setMilestoneTypes] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [timeLogs, setTimeLogs] = useState([]);
    const [delayCauses, setDelayCauses] = useState([]);
    const [delays, setDelays] = useState([]);

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
    // ENGINEERING FIRESTORE SUBSCRIPTIONS
    // ============================================================
    useEffect(() => {
        const unsubEngProjects = onSnapshot(collection(db, COLLECTIONS.PROJECTS), s =>
            setEngProjects(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)))
        );
        const unsubEngTasks = onSnapshot(collection(db, COLLECTIONS.TASKS), s =>
            setEngTasks(s.docs.map(d => ({ ...d.data(), id: d.id })))
        );
        const unsubEngSubtasks = onSnapshot(collection(db, COLLECTIONS.SUBTASKS), s =>
            setEngSubtasks(s.docs.map(d => ({ ...d.data(), id: d.id })))
        );
        const unsubTaskTypes = onSnapshot(collection(db, COLLECTIONS.TASK_TYPES), s =>
            setTaskTypes(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => safeLocaleCompare(a, b, 'name')))
        );
        const unsubWorkAreaTypes = onSnapshot(collection(db, COLLECTIONS.WORK_AREA_TYPES), s =>
            setWorkAreaTypes(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => safeLocaleCompare(a, b, 'name')))
        );
        const unsubMilestoneTypes = onSnapshot(collection(db, COLLECTIONS.MILESTONE_TYPES), s =>
            setMilestoneTypes(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => safeLocaleCompare(a, b, 'name')))
        );
        // ── Team Members ──
        // IMPORTANT: Loads from `users` collection (operational profiles),
        // NOT from `users_roles` (RBAC only). This ensures teamRole and
        // weeklyCapacityHours are available to dashboards, analytics,
        // and planner. Profile docs are bootstrapped by RoleContext on login.
        const unsubTeamMembers = onSnapshot(collection(db, COLLECTIONS.USERS), s =>
            setTeamMembers(s.docs.map(d => ({ ...d.data(), uid: d.id })))
        );
        const unsubTimeLogs = onSnapshot(collection(db, COLLECTIONS.TIME_LOGS), s =>
            setTimeLogs(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0)))
        );
        const unsubDelayCauses = onSnapshot(collection(db, COLLECTIONS.DELAY_CAUSES), s =>
            setDelayCauses(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => (a.order || 0) - (b.order || 0)))
        );
        const unsubDelays = onSnapshot(collection(db, COLLECTIONS.DELAYS), s =>
            setDelays(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)))
        );

        return () => {
            unsubEngProjects(); unsubEngTasks(); unsubEngSubtasks();
            unsubTaskTypes(); unsubWorkAreaTypes(); unsubMilestoneTypes();
            unsubTeamMembers(); unsubTimeLogs();
            unsubDelayCauses(); unsubDelays();
        };
    }, []);

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
    // HANDLERS — Managed Lists
    // ============================================================

    const handleSaveManagedList = async ({ type, data }) => {
        const { renames, deleted, added } = data;
        const batch = writeBatch(db);

        // ── Task Types: simple add/rename/delete ──
        if (type === 'taskType') {
            const snap = await getDocs(collection(db, COLLECTIONS.TASK_TYPES));
            const existing = snap.docs.map(d => ({ id: d.id, name: d.data()?.name })).filter(d => d.name);
            deleted.forEach(name => {
                const found = existing.find(d => d.name === name);
                if (found) batch.delete(doc(db, COLLECTIONS.TASK_TYPES, found.id));
            });
            renames.forEach(({ oldName, newName }) => {
                const found = existing.find(d => d.name === oldName);
                if (found) batch.update(doc(db, COLLECTIONS.TASK_TYPES, found.id), { name: newName });
            });
            added.forEach(name => {
                if (!existing.some(d => d.name.toLowerCase() === name.toLowerCase()))
                    batch.set(doc(collection(db, COLLECTIONS.TASK_TYPES)), { name });
            });
            await batch.commit();
            return;
        }

        // ── Work Area Types ──
        if (type === 'workAreaType') {
            const snap = await getDocs(collection(db, COLLECTIONS.WORK_AREA_TYPES));
            const existing = snap.docs.map(d => ({ id: d.id, name: d.data()?.name })).filter(d => d.name);
            deleted.forEach(name => {
                const found = existing.find(d => d.name === name);
                if (found) batch.delete(doc(db, COLLECTIONS.WORK_AREA_TYPES, found.id));
            });
            renames.forEach(({ oldName, newName }) => {
                const found = existing.find(d => d.name === oldName);
                if (found) batch.update(doc(db, COLLECTIONS.WORK_AREA_TYPES, found.id), { name: newName });
            });
            added.forEach(name => {
                if (!existing.some(d => d.name.toLowerCase() === name.toLowerCase()))
                    batch.set(doc(collection(db, COLLECTIONS.WORK_AREA_TYPES)), { name });
            });
            await batch.commit();
            return;
        }

        // ── Milestone Types ──
        if (type === 'milestoneType') {
            const snap = await getDocs(collection(db, COLLECTIONS.MILESTONE_TYPES));
            const existing = snap.docs.map(d => ({ id: d.id, name: d.data()?.name })).filter(d => d.name);
            deleted.forEach(name => {
                const found = existing.find(d => d.name === name);
                if (found) batch.delete(doc(db, COLLECTIONS.MILESTONE_TYPES, found.id));
            });
            renames.forEach(({ oldName, newName }) => {
                const found = existing.find(d => d.name === oldName);
                if (found) batch.update(doc(db, COLLECTIONS.MILESTONE_TYPES, found.id), { name: newName });
            });
            added.forEach(name => {
                if (!existing.some(d => d.name.toLowerCase() === name.toLowerCase()))
                    batch.set(doc(collection(db, COLLECTIONS.MILESTONE_TYPES)), { name });
            });
            await batch.commit();
            return;
        }

        // ── BOM Managed Lists (category, provider, brand) ──
        const masterCatalogRef = collection(db, 'catalogo_maestro');
        let collectionName = '', fieldName = '';
        if (type === 'category') { collectionName = 'categorias'; fieldName = 'category'; }
        else if (type === 'provider') { collectionName = 'proveedores'; fieldName = 'defaultProvider'; }
        else if (type === 'brand') { collectionName = 'marcas'; fieldName = 'brand'; }
        else return;

        const collectionRef = collection(db, collectionName);
        const listQuerySnapshot = await getDocs(collectionRef);
        const existingDocs = listQuerySnapshot.docs.map(d => ({ id: d.id, name: d.data()?.name })).filter(d => d.name);

        for (const name of deleted) {
            const docToDelete = existingDocs.find(d => d.name === name);
            if (docToDelete) {
                const refToDelete = doc(db, collectionName, docToDelete.id);
                batch.delete(refToDelete);
                const q = query(masterCatalogRef, where(fieldName, "==", refToDelete));
                const snapshot = await getDocs(q);
                snapshot.forEach(docToUpdate => batch.update(docToUpdate.ref, { [fieldName]: null }));
            }
        }

        renames.forEach(({ oldName, newName }) => {
            const docToUpdate = existingDocs.find(d => d.name === oldName);
            if (docToUpdate) batch.update(doc(collectionRef, docToUpdate.id), { name: newName });
        });

        added.forEach(name => {
            if (!existingDocs.some(d => d.name.toLowerCase() === name.toLowerCase())) {
                batch.set(doc(collectionRef), { name });
            }
        });

        await batch.commit();
    };

    // ============================================================
    // CONTEXT VALUE
    // ============================================================

    const value = {
        // BOM Data (spread from hook)
        ...bomData,

        // Engineering Data
        engProjects,
        engTasks,
        engSubtasks,
        taskTypes,
        teamMembers,
        timeLogs,
        delayCauses,
        delays,

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

        // Handlers (Managed Lists — kept here due to mixed engineering/BOM scope)
        workAreaTypes,
        milestoneTypes,
        handleSaveManagedList,
    };

    return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
