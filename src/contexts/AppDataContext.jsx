/**
 * AppDataContext
 * ==============
 * 
 * Centralized data layer for the Engineering Management Platform.
 * Holds all Firestore subscriptions, shared state, and handlers
 * that need to be accessible across multiple pages.
 * 
 * Page-specific state (filters, selections, edit modes) stays in the pages.
 */

import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import {
    collection, onSnapshot, doc, setDoc, getDocs,
    deleteDoc, updateDoc, writeBatch, query, where, orderBy
} from 'firebase/firestore';
import { COLLECTIONS } from '../models/schemas';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { normalizePartNumber, findSimilarProviders } from '../utils/normalizers';

// --- PDF & Excel ---
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import * as XLSX from 'xlsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// --- Cloud Functions ---
const analyzeQuotePdfFn = httpsCallable(functions, 'analyzeQuotePdf');
const testGeminiConnectionFn = httpsCallable(functions, 'testGeminiConnection');

// --- Version ---
export const APP_VERSION = "4.0";

const AppDataContext = createContext(null);

export function useAppData() {
    const context = useContext(AppDataContext);
    if (!context) throw new Error('useAppData must be used within an AppDataProvider');
    return context;
}

const safeLocaleCompare = (a, b, field) => String(a[field] || '').localeCompare(String(b[field] || ''));

export function AppDataProvider({ children }) {
    // ============================================================
    // CORE DATA — Firestore Subscriptions
    // ============================================================
    const [proyectos, setProyectos] = useState([]);
    const [catalogo, setCatalogo] = useState([]);
    const [bomItems, setBomItems] = useState([]);
    const [managedLists, setManagedLists] = useState({ categories: [], providers: [], brands: [] });

    // --- Engineering Data ---
    const [engProjects, setEngProjects] = useState([]);
    const [engTasks, setEngTasks] = useState([]);
    const [engSubtasks, setEngSubtasks] = useState([]);
    const [taskTypes, setTaskTypes] = useState([]);
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

    // Master Record Modal
    const [isMasterRecordModalOpen, setIsMasterRecordModalOpen] = useState(false);
    const [editingMasterRecord, setEditingMasterRecord] = useState(null);

    // Image Picker
    const [imagePickerItem, setImagePickerItem] = useState(null);

    // Image Lightbox
    const [zoomedImageUrl, setZoomedImageUrl] = useState(null);

    // PDF Review Modal
    const [isPdfReviewOpen, setIsPdfReviewOpen] = useState(false);
    const [pdfReviewData, setPdfReviewData] = useState(null);
    const [pdfSupplierAnalysis, setPdfSupplierAnalysis] = useState(null);

    // Delay Report Modal
    const [isDelayReportOpen, setIsDelayReportOpen] = useState(false);
    const [delayReportTarget, setDelayReportTarget] = useState(null); // { type: 'project' | 'task', id, projectId }

    // Refs
    const pdfInputRef = useRef(null);
    const excelInputRef = useRef(null);

    // ============================================================
    // FIRESTORE SUBSCRIPTIONS
    // ============================================================
    useEffect(() => {
        const unsubProyectos = onSnapshot(collection(db, 'proyectos_bom'), s =>
            setProyectos(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
        );
        const unsubCatalogo = onSnapshot(collection(db, 'catalogo_maestro'), s =>
            setCatalogo(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => safeLocaleCompare(a, b, 'name')))
        );
        const unsubBom = onSnapshot(collection(db, 'items_bom'), s =>
            setBomItems(s.docs.map(d => ({ ...d.data(), id: d.id })))
        );
        const unsubCategories = onSnapshot(collection(db, 'categorias'), s =>
            setManagedLists(prev => ({ ...prev, categories: s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.name).sort((a, b) => safeLocaleCompare(a, b, 'name')) }))
        );
        const unsubProviders = onSnapshot(collection(db, 'proveedores'), s =>
            setManagedLists(prev => ({ ...prev, providers: s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.name).sort((a, b) => safeLocaleCompare(a, b, 'name')) }))
        );
        const unsubBrands = onSnapshot(collection(db, 'marcas'), s =>
            setManagedLists(prev => ({ ...prev, brands: s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.name).sort((a, b) => safeLocaleCompare(a, b, 'name')) }))
        );

        // --- Engineering Collections ---
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
        const unsubTeamMembers = onSnapshot(collection(db, 'users_roles'), s =>
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
            unsubProyectos(); unsubCatalogo(); unsubBom();
            unsubCategories(); unsubProviders(); unsubBrands();
            unsubEngProjects(); unsubEngTasks(); unsubEngSubtasks();
            unsubTaskTypes(); unsubTeamMembers(); unsubTimeLogs();
            unsubDelayCauses(); unsubDelays();
        };
    }, []);

    // ============================================================
    // COMPUTED VALUES
    // ============================================================
    const brandOptions = useMemo(() =>
        managedLists.brands.map(b => ({ value: b.id, label: b.name })),
        [managedLists.brands]
    );
    const categoryOptions = useMemo(() =>
        managedLists.categories.map(c => ({ value: c.id, label: c.name })),
        [managedLists.categories]
    );
    const providerOptions = useMemo(() =>
        managedLists.providers.map(p => ({ value: p.id, label: p.name })),
        [managedLists.providers]
    );

    // ============================================================
    // HANDLERS — Connection & Processing
    // ============================================================

    const testConnection = async () => {
        setIsDiagnosticOpen(true);
        setProcessingStatus('Enviando prueba a Cloud Function...');
        setLastError(null);
        try {
            const result = await testGeminiConnectionFn();
            setProcessingStatus(`✅ IA RESPONDE: ${result.data.response}`);
        } catch (err) {
            setLastError(err.message);
            setProcessingStatus("❌ FALLO LA CONEXIÓN");
        }
    };

    // ============================================================
    // HANDLERS — PDF Import
    // ============================================================

    const handlePdfUpload = async (e, activeProject) => {
        const file = e.target.files[0];
        if (!file || !activeProject) return;
        if (!pdfjsLib) return alert("Error cargando la herramienta PDF.");

        setIsProcessing(true);
        setIsDiagnosticOpen(true);
        setProcessingStatus("Extrayendo texto del PDF...");
        setLastError(null);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let text = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map(item => item.str).join(" ") + "\n";
            }
            if (!text.trim()) throw new Error("No pudimos extraer texto de este PDF.");

            setProcessingStatus('Enviando texto a Cloud Function...');
            const result = await analyzeQuotePdfFn({ text });
            const data = result.data.data;

            if (data.items) {
                setProcessingStatus("Analizando datos...");
                const catalogSnapshot = await getDocs(collection(db, 'catalogo_maestro'));
                const currentCatalog = catalogSnapshot.docs.map(d => ({ ...d.data(), id: d.id }));

                const reviewItems = data.items.map(item => {
                    const normalizedPn = normalizePartNumber(item.pn);
                    const existing = currentCatalog.find(p =>
                        p.partNumber && normalizePartNumber(p.partNumber) === normalizedPn
                    );
                    return {
                        pn: normalizedPn,
                        description: String(item.description || '').trim(),
                        quantity: Number(item.quantity) || 1,
                        unitPrice: Number(item.unitPrice) || 0,
                        leadTimeWeeks: item.leadTimeWeeks != null ? Number(item.leadTimeWeeks) : null,
                        isNew: !existing,
                        existingPartId: existing?.id || null,
                    };
                });

                const supplierAnalysis = findSimilarProviders(data.supplier, managedLists.providers);

                setPdfReviewData({ supplier: data.supplier || '', items: reviewItems });
                setPdfSupplierAnalysis(supplierAnalysis);
                setIsPdfReviewOpen(true);
                setProcessingStatus("✅ Datos listos para revisión");
                setTimeout(() => setIsProcessing(false), 1500);
            }
        } catch (err) {
            setLastError(err.message);
            setProcessingStatus("❌ ERROR");
            setIsProcessing(false);
        } finally {
            if (e?.target) e.target.value = null;
        }
    };

    const handleConfirmImport = async (reviewedData, activeProject) => {
        const { items, prcr, supplierDecision } = reviewedData;
        if (items.length === 0) return;

        const batch = writeBatch(db);

        let supplierId = null;
        if (supplierDecision.action === 'use_existing' && supplierDecision.selectedProviderId) {
            supplierId = supplierDecision.selectedProviderId;
        } else if (supplierDecision.name) {
            const newProviderRef = doc(collection(db, 'proveedores'));
            batch.set(newProviderRef, { name: supplierDecision.name });
            supplierId = newProviderRef.id;
        }

        for (const item of items) {
            let partId;
            if (item.isNew) {
                const catRef = doc(collection(db, 'catalogo_maestro'));
                batch.set(catRef, {
                    name: item.description,
                    partNumber: item.pn,
                    lastPrice: item.unitPrice,
                    leadTimeWeeks: item.leadTimeWeeks,
                    defaultProvider: supplierId ? doc(db, 'proveedores', supplierId) : null,
                    brand: null, category: null
                });
                partId = catRef.id;
            } else {
                partId = item.existingPartId;
                const updateData = { lastPrice: item.unitPrice };
                if (item.leadTimeWeeks != null) updateData.leadTimeWeeks = item.leadTimeWeeks;
                if (supplierId) updateData.defaultProvider = doc(db, 'proveedores', supplierId);
                batch.update(doc(db, 'catalogo_maestro', partId), updateData);
            }

            const bomRef = doc(collection(db, 'items_bom'));
            batch.set(bomRef, {
                projectId: activeProject.id,
                masterPartRef: doc(db, 'catalogo_maestro', partId),
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.quantity * item.unitPrice,
                leadTimeWeeks: item.leadTimeWeeks,
                proveedor: supplierId ? doc(db, 'proveedores', supplierId) : null,
                prcr: prcr || '',
                status: 'En Cotización',
                addedAt: new Date().toISOString()
            });
        }

        await batch.commit();
        setIsPdfReviewOpen(false);
        setPdfReviewData(null);
        setPdfSupplierAnalysis(null);
    };

    // ============================================================
    // HANDLERS — Excel Import
    // ============================================================

    const handleExcelUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!XLSX) { alert("Error cargando la herramienta Excel."); return; }

        setIsProcessing(true);
        setIsDiagnosticOpen(true);
        setProcessingStatus("Leyendo archivo Excel...");
        setLastError(null);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[worksheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);

            if (json.length === 0) throw new Error("El archivo Excel está vacío o tiene un formato no compatible.");

            setProcessingStatus(`Procesando ${json.length} filas...`);

            const batch = writeBatch(db);

            const catalogSnapshot = await getDocs(collection(db, 'catalogo_maestro'));
            const currentCatalogMap = new Map();
            catalogSnapshot.docs.forEach(d => {
                const docData = d.data();
                if (docData.partNumber) {
                    currentCatalogMap.set(String(docData.partNumber).replace(/\s+/g, '').toUpperCase(), { id: d.id, ...docData });
                }
            });

            const [marcasSnap, categoriasSnap, proveedoresSnap] = await Promise.all([
                getDocs(collection(db, 'marcas')),
                getDocs(collection(db, 'categorias')),
                getDocs(collection(db, 'proveedores')),
            ]);

            const getListMap = (snap) => new Map(snap.docs.map(d => [d.data().name.toLowerCase(), d.ref]));

            const listRefs = {
                marcas: getListMap(marcasSnap),
                categorias: getListMap(categoriasSnap),
                proveedores: getListMap(proveedoresSnap),
            };

            const newRefs = { marcas: new Map(), categorias: new Map(), proveedores: new Map() };

            const findOrCreateRef = (collectionName, name) => {
                if (!name || typeof name !== 'string' || !name.trim()) return null;
                const trimmedName = name.trim();
                const lowerCaseName = trimmedName.toLowerCase();

                if (listRefs[collectionName].has(lowerCaseName)) return listRefs[collectionName].get(lowerCaseName);
                if (newRefs[collectionName].has(lowerCaseName)) return newRefs[collectionName].get(lowerCaseName);

                const newDocRef = doc(collection(db, collectionName));
                batch.set(newDocRef, { name: trimmedName });
                newRefs[collectionName].set(lowerCaseName, newDocRef);
                return newDocRef;
            };

            const getValue = (row, keys) => {
                const rowKeys = Object.keys(row);
                for (const key of keys) {
                    const foundRowKey = rowKeys.find(rk => rk.toLowerCase().trim() === key.toLowerCase());
                    if (foundRowKey && row[foundRowKey] !== null && row[foundRowKey] !== undefined) return row[foundRowKey];
                }
                return undefined;
            };

            for (const row of json) {
                const pn = getValue(row, ['PN', 'P/N', 'Part Number']);
                const name = getValue(row, ['Description of component', 'Description', 'name']);
                const price = getValue(row, ['Precio', 'Price', 'lastPrice', 'unitPrice']);
                const brandName = getValue(row, ['Marcas', 'Brand']);
                const categoryName = getValue(row, ['Categorías', 'Category']);
                const providerName = getValue(row, ['Proveedores', 'Supplier', 'Provider']);

                if (!pn || !name) continue;

                const brandRef = findOrCreateRef('marcas', brandName);
                const categoryRef = findOrCreateRef('categorias', categoryName);
                const providerRef = findOrCreateRef('proveedores', providerName);

                const normalizedPn = String(pn).replace(/\s+/g, '').toUpperCase();
                const existingPart = currentCatalogMap.get(normalizedPn);

                const partData = {
                    name: String(name).trim(),
                    partNumber: normalizedPn,
                    lastPrice: Number(price) || 0,
                    brand: brandRef,
                    category: categoryRef,
                    defaultProvider: providerRef
                };

                if (existingPart) {
                    batch.update(doc(db, 'catalogo_maestro', existingPart.id), partData);
                } else {
                    const newPartRef = doc(collection(db, 'catalogo_maestro'));
                    batch.set(newPartRef, partData);
                }
            }

            setProcessingStatus("Guardando en Firebase...");
            await batch.commit();
            setProcessingStatus(`✨ ¡Catálogo actualizado con ${json.length} registros!`);

            const updatedCatalogSnap = await getDocs(collection(db, 'catalogo_maestro'));
            setCatalogo(updatedCatalogSnap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => safeLocaleCompare(a, b, 'name')));

            setTimeout(() => setIsProcessing(false), 3000);
        } catch (err) {
            setLastError(err.message);
            setProcessingStatus("❌ ERROR");
            setIsProcessing(false);
        } finally {
            if (e?.target) e.target.value = null;
        }
    };

    // ============================================================
    // HANDLERS — Projects
    // ============================================================

    const handleSaveProject = async (e, projectData, editingProjectId) => {
        e.preventDefault();
        if (!projectData.name.trim()) return;
        const data = { name: projectData.name, description: projectData.description, createdAt: new Date().toISOString() };
        if (editingProjectId) {
            await updateDoc(doc(db, 'proyectos_bom', editingProjectId), data);
        } else {
            await setDoc(doc(collection(db, 'proyectos_bom')), data);
        }
    };

    // ============================================================
    // HANDLERS — Master Catalog
    // ============================================================

    const saveMasterRecord = async (formData) => {
        if (!formData.name || !formData.partNumber) return alert("Nombre y P/N obligatorios.");

        const data = {
            name: String(formData.name).trim(),
            partNumber: String(formData.partNumber).replace(/\s+/g, '').toUpperCase(),
            lastPrice: Number(formData.lastPrice) || 0,
            brand: formData.brand ? doc(db, 'marcas', formData.brand) : null,
            category: formData.category ? doc(db, 'categorias', formData.category) : null,
            defaultProvider: formData.defaultProvider ? doc(db, 'proveedores', formData.defaultProvider) : null,
            leadTimeWeeks: formData.leadTimeWeeks === '' ? null : Number(formData.leadTimeWeeks),
            imageUrl: formData.imageUrl ? String(formData.imageUrl).trim() : '',
        };

        if (editingMasterRecord) {
            await updateDoc(doc(db, 'catalogo_maestro', editingMasterRecord.id), data);
        } else {
            await setDoc(doc(collection(db, 'catalogo_maestro')), data);
        }
        setEditingMasterRecord(null);
        setIsMasterRecordModalOpen(false);
    };

    // ============================================================
    // HANDLERS — Managed Lists
    // ============================================================

    const handleSaveManagedList = async ({ type, data }) => {
        const { renames, deleted, added } = data;
        const batch = writeBatch(db);

        // ── Task Types: simple add/rename/delete (no foreign-key refs to clean) ──
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
    // HANDLERS — BOM Items
    // ============================================================

    const handleUpdateBomItem = async (itemId, updatedData, catalogLeadTimeUpdate) => {
        const itemRef = doc(db, 'items_bom', itemId);
        const newData = {
            ...updatedData,
            totalPrice: (updatedData.quantity || 0) * (updatedData.unitPrice || 0)
        };
        await updateDoc(itemRef, newData);

        if (catalogLeadTimeUpdate !== undefined) {
            const bomItem = bomItems.find(i => i.id === itemId);
            if (bomItem?.masterPartRef) {
                await updateDoc(doc(db, 'catalogo_maestro', bomItem.masterPartRef.id), { leadTimeWeeks: catalogLeadTimeUpdate });
            }
        }
    };

    const handleAddFromCatalog = async (itemsToAdd, activeProject) => {
        const batch = writeBatch(db);
        itemsToAdd.forEach(({ item, quantity }) => {
            const bomRef = doc(collection(db, 'items_bom'));
            batch.set(bomRef, {
                projectId: activeProject.id,
                masterPartRef: doc(db, 'catalogo_maestro', item.id),
                quantity: Number(quantity),
                unitPrice: Number(item.lastPrice || 0),
                totalPrice: Number(quantity) * Number(item.lastPrice || 0),
                proveedor: item.defaultProvider ? doc(db, 'proveedores', item.defaultProvider.id) : null,
                status: 'Requerido',
                addedAt: new Date().toISOString()
            });
        });
        await batch.commit();
    };

    // ============================================================
    // HANDLERS — Image
    // ============================================================

    const handleImageSelect = async (url) => {
        if (!imagePickerItem) return;
        try {
            await updateDoc(doc(db, 'catalogo_maestro', imagePickerItem.id), { imageUrl: url });
        } catch (err) {
            console.error('Error saving image:', err);
        }
        setImagePickerItem(null);
    };

    const handleEditClick = (item) => {
        setEditingMasterRecord(item);
        setIsMasterRecordModalOpen(true);
    };

    // ============================================================
    // CONTEXT VALUE
    // ============================================================

    const value = {
        // Data
        proyectos,
        catalogo,
        bomItems,
        managedLists,

        // Engineering Data
        engProjects,
        engTasks,
        engSubtasks,
        taskTypes,
        teamMembers,
        timeLogs,
        delayCauses,
        delays,

        // Computed
        brandOptions,
        categoryOptions,
        providerOptions,

        // Processing
        isProcessing, setIsProcessing,
        processingStatus, setProcessingStatus,
        isDiagnosticOpen, setIsDiagnosticOpen,
        lastError, setLastError,

        // Modals
        confirmDelete, setConfirmDelete,
        listManager, setListManager,
        isMasterRecordModalOpen, setIsMasterRecordModalOpen,
        editingMasterRecord, setEditingMasterRecord,
        imagePickerItem, setImagePickerItem,
        zoomedImageUrl, setZoomedImageUrl,
        isPdfReviewOpen, setIsPdfReviewOpen,
        pdfReviewData, setPdfReviewData,
        pdfSupplierAnalysis, setPdfSupplierAnalysis,
        isDelayReportOpen, setIsDelayReportOpen,
        delayReportTarget, setDelayReportTarget,

        // Refs
        pdfInputRef,
        excelInputRef,

        // Handlers
        testConnection,
        handlePdfUpload,
        handleConfirmImport,
        handleExcelUpload,
        handleSaveProject,
        saveMasterRecord,
        handleSaveManagedList,
        handleUpdateBomItem,
        handleAddFromCatalog,
        handleImageSelect,
        handleEditClick,
    };

    return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
