// Archivo: src/services/aiService.js
// ===================================
// Stateless service for PDF text extraction, Gemini AI analysis,
// Excel catalog import, and AI connectivity testing.
// All UI-state side effects (loading, status messages) are injected
// via a `callbacks` parameter to keep this module React-free.

import {
    collection, doc, getDocs, writeBatch, updateDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { normalizePartNumber, findSimilarProviders } from '../utils/normalizers';

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import * as XLSX from 'xlsx';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Cloud Function references
const analyzeQuotePdfFn = httpsCallable(functions, 'analyzeQuotePdf');
const testGeminiConnectionFn = httpsCallable(functions, 'testGeminiConnection');

// ============================================================
// PDF — Text Extraction
// ============================================================

/**
 * Extract plain text from a PDF file using pdf.js.
 * @param {File} file — PDF file object from an <input type="file">
 * @returns {Promise<string>} — concatenated text from all pages
 */
export async function extractPdfText(file) {
    if (!pdfjsLib) throw new Error('Error cargando la herramienta PDF.');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
    }
    if (!text.trim()) throw new Error('No pudimos extraer texto de este PDF.');
    return text;
}

// ============================================================
// PDF — AI Analysis
// ============================================================

/**
 * Send extracted text to the Gemini Cloud Function for analysis.
 * @param {string} text — plain text extracted from PDF
 * @returns {Promise<object>} — parsed AI response data
 */
export async function analyzePdfWithAI(text) {
    const result = await analyzeQuotePdfFn({ text });
    return result.data.data;
}

// ============================================================
// PDF — Review Item Builder
// ============================================================

/**
 * Build review items by matching AI-extracted items against the existing catalog.
 * @param {object} aiData — data returned by `analyzePdfWithAI` (must have `.items`)
 * @param {Array}  currentCatalog — array of catalog documents with `{ id, partNumber, ... }`
 * @param {Array}  providers — array of provider documents for supplier matching
 * @returns {{ reviewItems: Array, supplierAnalysis: object }}
 */
export function buildReviewItems(aiData, currentCatalog, providers) {
    const reviewItems = aiData.items.map(item => {
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

    const supplierAnalysis = findSimilarProviders(aiData.supplier, providers);

    return { reviewItems, supplierAnalysis };
}

// ============================================================
// PDF — Full Upload Pipeline
// ============================================================

/**
 * Complete PDF upload handler — extract text, analyze with AI, build review items.
 * Mirrors the original `handlePdfUpload` from AppDataContext.
 *
 * @param {File}     file           — PDF file
 * @param {object}   activeProject  — current BOM project `{ id, ... }`
 * @param {Array}    providers      — managed providers list for supplier matching
 * @param {object}   callbacks      — UI state callbacks
 * @param {Function} callbacks.setIsProcessing
 * @param {Function} callbacks.setIsDiagnosticOpen
 * @param {Function} callbacks.setProcessingStatus
 * @param {Function} callbacks.setLastError
 * @param {Function} callbacks.onReviewReady — called with `{ reviewData, supplierAnalysis }`
 * @returns {Promise<void>}
 */
export async function handlePdfUpload(file, activeProject, providers, callbacks) {
    const {
        setIsProcessing,
        setIsDiagnosticOpen,
        setProcessingStatus,
        setLastError,
        onReviewReady,
    } = callbacks;

    if (!file || !activeProject) return;

    setIsProcessing(true);
    setIsDiagnosticOpen(true);
    setProcessingStatus('Extrayendo texto del PDF...');
    setLastError(null);

    try {
        const text = await extractPdfText(file);

        setProcessingStatus('Enviando texto a Cloud Function...');
        const aiData = await analyzePdfWithAI(text);

        if (aiData.items) {
            setProcessingStatus('Analizando datos...');

            const catalogSnapshot = await getDocs(collection(db, 'catalogo_maestro'));
            const currentCatalog = catalogSnapshot.docs.map(d => ({ ...d.data(), id: d.id }));

            const { reviewItems, supplierAnalysis } = buildReviewItems(aiData, currentCatalog, providers);

            onReviewReady({
                reviewData: { supplier: aiData.supplier || '', items: reviewItems },
                supplierAnalysis,
            });

            setProcessingStatus('✅ Datos listos para revisión');
            setTimeout(() => setIsProcessing(false), 1500);
        }
    } catch (err) {
        setLastError(err.message);
        setProcessingStatus('❌ ERROR');
        setIsProcessing(false);
    }
}

// ============================================================
// PDF — Confirm Import (Batch Write)
// ============================================================

/**
 * Batch-write confirmed PDF import data to Firestore.
 * Creates new catalog entries, updates existing ones, and adds BOM items.
 *
 * @param {object} reviewedData          — `{ items, prcr, supplierDecision }`
 * @param {object} activeProject         — `{ id, ... }`
 * @returns {Promise<void>}
 */
export async function executePdfImport(reviewedData, activeProject) {
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
}

// ============================================================
// Excel — Full Import Pipeline
// ============================================================

/**
 * Complete Excel import handler — read file, parse rows, upsert catalog entries.
 * Mirrors the original `handleExcelUpload` from AppDataContext.
 *
 * @param {File}     file        — Excel file
 * @param {object}   callbacks   — UI state callbacks
 * @param {Function} callbacks.setIsProcessing
 * @param {Function} callbacks.setIsDiagnosticOpen
 * @param {Function} callbacks.setProcessingStatus
 * @param {Function} callbacks.setLastError
 * @param {Function} callbacks.onCatalogRefresh — called with updated catalog array
 * @returns {Promise<void>}
 */
export async function executeExcelImport(file, callbacks) {
    const {
        setIsProcessing,
        setIsDiagnosticOpen,
        setProcessingStatus,
        setLastError,
        onCatalogRefresh,
    } = callbacks;

    if (!file) return;
    if (!XLSX) { alert('Error cargando la herramienta Excel.'); return; }

    setIsProcessing(true);
    setIsDiagnosticOpen(true);
    setProcessingStatus('Leyendo archivo Excel...');
    setLastError(null);

    const safeLocaleCompare = (a, b, field) => String(a[field] || '').localeCompare(String(b[field] || ''));

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) throw new Error('El archivo Excel está vacío o tiene un formato no compatible.');

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

        setProcessingStatus('Guardando en Firebase...');
        await batch.commit();
        setProcessingStatus(`✨ ¡Catálogo actualizado con ${json.length} registros!`);

        // Refresh catalog data
        const updatedCatalogSnap = await getDocs(collection(db, 'catalogo_maestro'));
        const updatedCatalog = updatedCatalogSnap.docs
            .map(d => ({ ...d.data(), id: d.id }))
            .sort((a, b) => safeLocaleCompare(a, b, 'name'));

        if (onCatalogRefresh) onCatalogRefresh(updatedCatalog);

        setTimeout(() => setIsProcessing(false), 3000);
    } catch (err) {
        setLastError(err.message);
        setProcessingStatus('❌ ERROR');
        setIsProcessing(false);
    }
}

// ============================================================
// Gemini — Connection Test
// ============================================================

/**
 * Test connectivity to the Gemini AI service via Cloud Function.
 *
 * @param {object}   callbacks
 * @param {Function} callbacks.setIsDiagnosticOpen
 * @param {Function} callbacks.setProcessingStatus
 * @param {Function} callbacks.setLastError
 * @returns {Promise<void>}
 */
export async function testGeminiConnection(callbacks) {
    const { setIsDiagnosticOpen, setProcessingStatus, setLastError } = callbacks;

    setIsDiagnosticOpen(true);
    setProcessingStatus('Enviando prueba a Cloud Function...');
    setLastError(null);

    try {
        const result = await testGeminiConnectionFn();
        setProcessingStatus(`✅ IA RESPONDE: ${result.data.response}`);
    } catch (err) {
        setLastError(err.message);
        setProcessingStatus('❌ FALLO LA CONEXIÓN');
    }
}
