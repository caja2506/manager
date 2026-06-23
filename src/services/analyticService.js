// Archivo: src/services/analyticService.js
// ===================================
// Stateless service for PDF text extraction, Gemini AI analysis,
// Excel catalog import, and AI connectivity testing.
// All UI-state side effects (loading, status messages) are injected
// via a `callbacks` parameter to keep this module React-free.

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { supabase } from '../supabase';
import { findSimilarProviders } from '../utils/normalizers';
import { recordAiTrace } from './analyticTraceService';

import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';

// Initialize PDF.js worker using jsDelivr matching the dependency version
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.5.207/build/pdf.worker.min.mjs';

// Cloud Function references (with extended client timeouts to match server config)
const analyzeQuotePdfFn = httpsCallable(functions, 'analyzeQuotePdf', { timeout: 180000 });
const analyzeQuoteImageFn = httpsCallable(functions, 'analyzeQuoteImage', { timeout: 180000 });
const testGeminiConnectionFn = httpsCallable(functions, 'testGeminiConnection', { timeout: 30000 });

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

    console.log('[PDF Extract] Iniciando extracción de texto:', file.name, '| Tamaño:', (file.size / 1024).toFixed(1), 'KB');

    const arrayBuffer = await file.arrayBuffer();

    let pdf;
    try {
        pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch (loadError) {
        console.error('[PDF Extract] Error al cargar el documento PDF:', loadError);
        throw new Error(`No se pudo abrir el archivo PDF. Asegúrate de que sea un PDF válido y no esté corrupto. (${loadError.message})`);
    }

    console.log('[PDF Extract] Documento abierto. Páginas:', pdf.numPages);

    let text = '';
    let totalItems = 0;
    let hasImageContent = false;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        totalItems += content.items.length;
        text += pageText + '\n';

        console.log(`[PDF Extract] Página ${i}/${pdf.numPages}: ${content.items.length} elementos de texto, ${pageText.trim().length} caracteres`);

        // Check if the page has image operators (indicates scanned PDF)
        if (content.items.length === 0) {
            try {
                const ops = await page.getOperatorList();
                const paintImageOps = ops.fnArray.filter(fn => fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintJpegXObject);
                if (paintImageOps.length > 0) {
                    hasImageContent = true;
                    console.log(`[PDF Extract] Página ${i} contiene ${paintImageOps.length} imagen(es) pero ningún texto.`);
                }
            } catch { /* ignore operator list errors */ }
        }
    }

    console.log('[PDF Extract] Extracción completa. Total items:', totalItems, '| Caracteres:', text.trim().length, '| Tiene imágenes:', hasImageContent);

    if (!text.trim()) {
        if (hasImageContent) {
            throw new Error(
                'Este PDF parece ser un documento escaneado (imágenes). ' +
                'La herramienta solo puede procesar PDFs con texto digital seleccionable. ' +
                'Intenta usar un PDF generado directamente desde el sistema del proveedor, no una copia escaneada.'
            );
        }
        throw new Error(
            'No pudimos extraer texto de este PDF. ' +
            'Verifica que el archivo sea un PDF válido con texto seleccionable (no escaneado).'
        );
    }

    return text;
}

// ============================================================
// PDF — AI Analysis
// ============================================================

/**
 * Send extracted text to the Gemini Cloud Function for analysis.
 * @param {string} text — plain text extracted from PDF
 * @returns {Promise<object>} — JSON object returned by Gemini
 */
export async function analyzePdfWithAI(text) {
    const result = await analyzeQuotePdfFn({ text });
    if (!result.data || result.data.error) {
        throw new Error(result.data?.error || 'Error al analizar el PDF con IA.');
    }
    return result.data?.data || result.data;
}

// ============================================================
// Image — AI Vision Analysis
// ============================================================

/**
 * Send image(s) to the Gemini Vision Cloud Function for analysis.
 * @param {Array<{base64: string, mimeType: string}>} images — array of base64 images
 * @returns {Promise<object>} — JSON object returned by Gemini Vision
 */
export async function analyzeImageWithAI(images) {
    try {
        console.log(`[Image AI] Enviando ${images.length} imagen(es) a Cloud Function. Tamaño total base64: ${images.reduce((s, i) => s + (i.base64?.length || 0), 0)} chars`);
        const result = await analyzeQuoteImageFn({ images });
        if (!result.data || result.data.error) {
            throw new Error(result.data?.error || 'Error al analizar la imagen con IA.');
        }
        console.log('[Image AI] Respuesta exitosa:', result.data);
        return result.data?.data || result.data;
    } catch (err) {
        // Firebase httpsCallable errors have .code, .message, and .details
        const detail = err.details || err.message || err.code || 'Error desconocido';
        const code = err.code || '';
        console.error('[Image AI] Error completo:', { code, message: err.message, details: err.details, err });
        throw new Error(`[${code}] ${detail}`);
    }
}

/**
 * Convert a File to a base64 string (without the data:... prefix).
 * @param {File|Blob} file
 * @returns {Promise<{base64: string, mimeType: string}>}
 */
async function fileToBase64(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return { base64: btoa(binary), mimeType: file.type || 'image/png' };
}

/**
 * Render PDF pages as images using pdf.js canvas rendering.
 * Used as a fallback when a PDF has no selectable text (scanned/image PDF).
 * @param {File} file — PDF file
 * @returns {Promise<Array<{base64: string, mimeType: string}>>}
 */
async function renderPdfPagesToImages(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const images = [];
    const scale = 2.0; // High res for better OCR

    for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;

        // Convert canvas to base64 JPEG (smaller than PNG for upload)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.split(',')[1];
        images.push({ base64, mimeType: 'image/jpeg' });

        console.log(`[PDF→Image] Página ${i}/${pdf.numPages} renderizada (${viewport.width}x${viewport.height})`);
    }

    return images;
}

/**
 * Match Gemini items with local catalog to flag new/existing items.
 * Helper for UI review modal.
 */
function buildReviewItems(aiData, catalog, providers) {
    const reviewItems = (aiData.items || []).map(item => {
        const pn = String(item.pn || item.partNumber || '').trim();
        const normPn = String(pn).replace(/\s+/g, '').toUpperCase();

        const match = catalog.find(c => {
            const cPn = String(c.partNumber || c.part_number || '').trim();
            const normCPn = String(cPn).replace(/\s+/g, '').toUpperCase();
            return normCPn === normPn;
        });

        if (match) {
            return {
                id: Math.random().toString(),
                description: item.description || '',
                pn,
                quantity: Number(item.quantity) || 1,
                unitPrice: Number(item.unitPrice) || 0,
                leadTimeWeeks: item.leadTimeWeeks ?? null,
                isNew: false,
                existingPartId: match.id,
                existingPartName: match.name,
                existingPartNumber: match.partNumber || match.part_number,
                existingPrice: match.lastPrice || match.last_price || 0,
            };
        } else {
            return {
                id: Math.random().toString(),
                description: item.description || '',
                pn,
                quantity: Number(item.quantity) || 1,
                unitPrice: Number(item.unitPrice) || 0,
                leadTimeWeeks: item.leadTimeWeeks ?? null,
                isNew: true,
            };
        }
    });

    const supplierAnalysis = {
        name: aiData.supplier || '',
        matchedProvider: null,
        suggestions: [],
        exactMatch: null,
        similarMatches: []
    };

    if (aiData.supplier) {
        const matches = findSimilarProviders(aiData.supplier, providers);
        if (matches) {
            supplierAnalysis.exactMatch = matches.exactMatch;
            supplierAnalysis.similarMatches = matches.similarMatches || [];
            if (matches.exactMatch) {
                supplierAnalysis.matchedProvider = matches.exactMatch;
            } else if (matches.similarMatches?.length > 0) {
                supplierAnalysis.matchedProvider = matches.similarMatches[0];
            }
            supplierAnalysis.suggestions = matches.similarMatches || [];
        }
    }

    return { reviewItems, supplierAnalysis };
}

/**
 * Process a PDF upload: extract text, send to Gemini, map with catalog, and callback.
 * If the PDF has no selectable text (scanned), automatically falls back to
 * rendering pages as images and using Gemini Vision for OCR + analysis.
 */
export async function executePdfUploadPipeline(file, providers, callbacks, projectId = null) {
    const {
        setIsProcessing,
        setIsDiagnosticOpen,
        setProcessingStatus,
        setLastError,
        onReviewReady,
    } = callbacks;

    if (!file) return;

    setIsProcessing(true);
    setProcessingStatus('Extrayendo texto del PDF...');
    setLastError(null);

    const correlationId = Math.random().toString(36).substring(7);

    try {
        let aiData;
        let usedVisionFallback = false;

        // Step 1: Try text extraction first
        let text = null;
        try {
            text = await extractPdfText(file);
        } catch (textErr) {
            // If text extraction fails, it's likely a scanned PDF — use Vision fallback
            console.log('[PDF Pipeline] Extracción de texto falló, activando fallback visual:', textErr.message);
        }

        if (text && text.trim()) {
            // Normal flow — PDF has selectable text
            setProcessingStatus('Enviando texto a Cloud Function...');
            aiData = await analyzePdfWithAI(text);
        } else {
            // Fallback — Scanned/image PDF: render pages as images and use Vision
            usedVisionFallback = true;
            setProcessingStatus('📷 PDF escaneado detectado, convirtiendo páginas a imágenes...');

            const images = await renderPdfPagesToImages(file);
            if (images.length === 0) {
                throw new Error('No se pudieron renderizar las páginas del PDF.');
            }

            console.log(`[PDF Pipeline] ${images.length} página(s) renderizada(s). Enviando a Gemini Vision...`);
            setProcessingStatus(`📷 Analizando ${images.length} página(s) con IA Visual...`);

            aiData = await analyzeImageWithAI(images);
        }

        if (aiData.items) {
            setProcessingStatus('Analizando datos...');

            const { data } = await supabase.from('catalogo_maestro').select('*');
            // Map snake_case → camelCase so buildReviewItems can match on partNumber
            const currentCatalog = (data || []).map(r => ({
                ...r,
                partNumber: r.part_number || '',
            }));

            const { reviewItems, supplierAnalysis } = buildReviewItems(aiData, currentCatalog, providers);

            // Log trace for successful processing
            await recordAiTrace({
                correlationId,
                triggerSource: 'user',
                entityType: 'project',
                entityId: projectId,
                capability: usedVisionFallback ? 'image_vision_fallback' : 'pdf_extraction',
                actionExecuted: 'pdf_upload_processed',
                result: 'success',
                metadata: {
                    fileName: file.name,
                    fileSize: file.size,
                    itemsCount: reviewItems.length,
                    supplier: aiData.supplier || '',
                    usedVisionFallback,
                }
            });

            onReviewReady({
                reviewData: { supplier: aiData.supplier || '', items: reviewItems },
                supplierAnalysis,
            });

            setProcessingStatus(usedVisionFallback
                ? '✅ Datos extraídos con IA Visual — listos para revisión'
                : '✅ Datos listos para revisión');
            setTimeout(() => setIsProcessing(false), 1500);
        }
    } catch (err) {
        // Log trace for failed processing
        await recordAiTrace({
            correlationId,
            triggerSource: 'user',
            entityType: 'project',
            entityId: projectId,
            capability: 'pdf_extraction',
            actionExecuted: 'pdf_upload_processed',
            result: 'failed',
            metadata: {
                fileName: file.name,
                fileSize: file.size,
                error: err.message
            }
        });

        setLastError(err.message);
        setProcessingStatus('❌ ERROR');
        setIsProcessing(false);
        if (setIsDiagnosticOpen) setIsDiagnosticOpen(true);
    }
}

// ============================================================
// Image — Direct Image Upload Pipeline
// ============================================================

/**
 * Process an image upload: convert to base64, send to Gemini Vision, map with catalog.
 * @param {File} imageFile — image file (JPG/PNG/WEBP)
 * @param {Array} providers — managed list of providers
 * @param {object} callbacks — { setIsProcessing, setProcessingStatus, setLastError, onReviewReady }
 * @param {string|null} projectId — optional project ID for audit trail
 */
export async function executeImageUploadPipeline(imageFile, providers, callbacks, projectId = null) {
    const {
        setIsProcessing,
        setIsDiagnosticOpen,
        setProcessingStatus,
        setLastError,
        onReviewReady,
    } = callbacks;

    if (!imageFile) return;

    setIsProcessing(true);
    setProcessingStatus('📷 Preparando imagen para IA Visual...');
    setLastError(null);

    const correlationId = Math.random().toString(36).substring(7);

    try {
        const { base64, mimeType } = await fileToBase64(imageFile);

        console.log(`[Image Pipeline] Imagen: ${imageFile.name} | ${(imageFile.size / 1024).toFixed(1)} KB | ${mimeType}`);

        setProcessingStatus('📷 Analizando imagen con IA Visual...');
        const aiData = await analyzeImageWithAI([{ base64, mimeType }]);

        if (aiData.items) {
            setProcessingStatus('Analizando datos...');

            const { data } = await supabase.from('catalogo_maestro').select('*');
            const currentCatalog = (data || []).map(r => ({
                ...r,
                partNumber: r.part_number || '',
            }));

            const { reviewItems, supplierAnalysis } = buildReviewItems(aiData, currentCatalog, providers);

            await recordAiTrace({
                correlationId,
                triggerSource: 'user',
                entityType: 'project',
                entityId: projectId,
                capability: 'image_vision_direct',
                actionExecuted: 'image_upload_processed',
                result: 'success',
                metadata: {
                    fileName: imageFile.name,
                    fileSize: imageFile.size,
                    itemsCount: reviewItems.length,
                    supplier: aiData.supplier || '',
                }
            });

            onReviewReady({
                reviewData: { supplier: aiData.supplier || '', items: reviewItems },
                supplierAnalysis,
            });

            setProcessingStatus('✅ Datos extraídos con IA Visual — listos para revisión');
            setTimeout(() => setIsProcessing(false), 1500);
        }
    } catch (err) {
        await recordAiTrace({
            correlationId,
            triggerSource: 'user',
            entityType: 'project',
            entityId: projectId,
            capability: 'image_vision_direct',
            actionExecuted: 'image_upload_processed',
            result: 'failed',
            metadata: {
                fileName: imageFile.name,
                fileSize: imageFile.size,
                error: err.message,
            }
        });

        setLastError(err.message);
        setProcessingStatus('❌ ERROR');
        setIsProcessing(false);
        if (setIsDiagnosticOpen) setIsDiagnosticOpen(true);
    }
}

// ============================================================
// PDF — Confirm Import (Batch Write)
// ============================================================

/**
 * Batch-write confirmed PDF import data to Supabase.
 * Creates new catalog entries, updates existing ones, and adds BOM items.
 *
 * @param {object} reviewedData          — `{ items, prcr, supplierDecision }`
 * @param {object} activeProject         — `{ id, ... }`
 * @returns {Promise<void>}
 */
export async function executePdfImport(reviewedData, activeProject) {
    const { items, prcr, supplierDecision, poId } = reviewedData;
    if (items.length === 0) return;

    let supplierId = null;
    if (supplierDecision.action === 'use_existing' && supplierDecision.selectedProviderId) {
        supplierId = supplierDecision.selectedProviderId;
    } else if (supplierDecision.name) {
        const { data: newProv } = await supabase.from('proveedores').insert({ name: supplierDecision.name }).select('id').single();
        supplierId = newProv?.id || null;
    }

    for (const item of items) {
        let partId;
        if (item.isNew) {
            const { data: newCat } = await supabase.from('catalogo_maestro').insert({
                name: item.description, part_number: item.pn, last_price: item.unitPrice,
                lead_time_weeks: item.leadTimeWeeks, default_provider_id: supplierId,
            }).select('id').single();
            partId = newCat?.id;
        } else {
            partId = item.existingPartId;
            const upd = { last_price: item.unitPrice };
            if (item.leadTimeWeeks != null) upd.lead_time_weeks = item.leadTimeWeeks;
            if (supplierId) upd.default_provider_id = supplierId;
            await supabase.from('catalogo_maestro').update(upd).eq('id', partId);
        }

        await supabase.from('items_bom').insert({
            project_id: activeProject.id, master_part_ref_id: partId,
            quantity: item.quantity, unit_price: item.unitPrice,
            total_price: item.quantity * item.unitPrice,
            lead_time_weeks: item.leadTimeWeeks, proveedor_id: supplierId,
            prcr: prcr || '', status: 'En Cotización', added_at: new Date().toISOString(),
            po_id: poId || null
        });
    }

    // Log trace for successful import completion
    await recordAiTrace({
        correlationId: Math.random().toString(36).substring(7),
        triggerSource: 'user',
        entityType: 'project',
        entityId: activeProject.id,
        capability: 'pdf_extraction',
        actionExecuted: 'pdf_import_confirmed',
        result: 'success',
        metadata: {
            itemsCount: items.length,
            prcr: prcr || '',
            supplierId,
            poId: poId || null
        }
    });
}

// ============================================================
// Excel — Full Import Pipeline
// ============================================================

/**
 * Complete Excel import handler — read file, parse rows, upsert catalog entries.
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

        // Fetch existing lists from Supabase
        const [marcasRes, categoriasRes, proveedoresRes] = await Promise.all([
            supabase.from('marcas').select('*'),
            supabase.from('categorias').select('*'),
            supabase.from('proveedores').select('*'),
        ]);

        const listIds = {
            marcas: new Map((marcasRes.data || []).map(d => [d.name.toLowerCase().trim(), d.id])),
            categorias: new Map((categoriasRes.data || []).map(d => [d.name.toLowerCase().trim(), d.id])),
            proveedores: new Map((proveedoresRes.data || []).map(d => [d.name.toLowerCase().trim(), d.id])),
        };

        const findOrCreateId = async (tableName, name) => {
            if (!name || typeof name !== 'string' || !name.trim()) return null;
            const trimmed = name.trim();
            const key = trimmed.toLowerCase();
            if (listIds[tableName].has(key)) return listIds[tableName].get(key);

            const { data, error } = await supabase
                .from(tableName)
                .insert({ name: trimmed })
                .select('id')
                .single();
            if (error) {
                console.error(`Error inserting into ${tableName}:`, error);
                return null;
            }
            const newId = data.id;
            listIds[tableName].set(key, newId);
            return newId;
        };

        const getValue = (row, keys) => {
            const rowKeys = Object.keys(row);
            for (const key of keys) {
                const foundRowKey = rowKeys.find(rk => rk.toLowerCase().trim() === key.toLowerCase());
                if (foundRowKey && row[foundRowKey] !== null && row[foundRowKey] !== undefined) return row[foundRowKey];
            }
            return undefined;
        };

        // Extract unique entity names to insert them first
        const uniqueBrands = new Set();
        const uniqueCategories = new Set();
        const uniqueProviders = new Set();

        for (const row of json) {
            const brandName = getValue(row, ['Marcas', 'Brand']);
            const categoryName = getValue(row, ['Categorías', 'Category']);
            const providerName = getValue(row, ['Proveedores', 'Supplier', 'Provider']);
            if (brandName) uniqueBrands.add(brandName);
            if (categoryName) uniqueCategories.add(categoryName);
            if (providerName) uniqueProviders.add(providerName);
        }

        setProcessingStatus('Sincronizando marcas, categorías y proveedores...');
        for (const brand of uniqueBrands) {
            await findOrCreateId('marcas', brand);
        }
        for (const cat of uniqueCategories) {
            await findOrCreateId('categorias', cat);
        }
        for (const prov of uniqueProviders) {
            await findOrCreateId('proveedores', prov);
        }

        // Fetch current catalog to match existing rows
        const { data: catalogData } = await supabase.from('catalogo_maestro').select('*');
        const currentCatalogMap = new Map((catalogData || []).map(d => [String(d.part_number).replace(/\s+/g, '').toUpperCase(), d]));

        const rowsToUpsert = [];
        for (const row of json) {
            const pn = getValue(row, ['PN', 'P/N', 'Part Number']);
            const name = getValue(row, ['Description of component', 'Description', 'name']);
            const price = getValue(row, ['Precio', 'Price', 'lastPrice', 'unitPrice']);
            const brandName = getValue(row, ['Marcas', 'Brand']);
            const categoryName = getValue(row, ['Categorías', 'Category']);
            const providerName = getValue(row, ['Proveedores', 'Supplier', 'Provider']);

            if (!pn || !name) continue;

            const normalizedPn = String(pn).replace(/\s+/g, '').toUpperCase();
            const existing = currentCatalogMap.get(normalizedPn);

            const brand_id = brandName ? listIds.marcas.get(brandName.trim().toLowerCase()) : null;
            const category_id = categoryName ? listIds.categorias.get(categoryName.trim().toLowerCase()) : null;
            const default_provider_id = providerName ? listIds.proveedores.get(providerName.trim().toLowerCase()) : null;

            const rowData = {
                name: String(name).trim(),
                part_number: normalizedPn,
                last_price: Number(price) || 0,
                brand_id,
                category_id,
                default_provider_id
            };

            if (existing) {
                rowData.id = existing.id; // Preserve existing database ID
            }

            rowsToUpsert.push(rowData);
        }

        setProcessingStatus('Guardando catálogo en la base de datos...');
        if (rowsToUpsert.length > 0) {
            const { error: upsertError } = await supabase
                .from('catalogo_maestro')
                .upsert(rowsToUpsert, { onConflict: 'part_number' });
            if (upsertError) throw upsertError;
        }

        setProcessingStatus(`✨ ¡Catálogo actualizado con ${json.length} registros!`);

        // Refresh catalog data and map to camelCase for the frontend
        const { data: finalCatalog, error: finalError } = await supabase.from('catalogo_maestro').select('*');
        if (finalError) throw finalError;

        const updatedCatalog = (finalCatalog || []).map(r => ({
            id: r.id,
            name: r.name,
            partNumber: r.part_number,
            lastPrice: r.last_price,
            leadTimeWeeks: r.lead_time_weeks,
            imageUrl: r.image_url,
            brand: r.brand_id ? { id: r.brand_id } : null,
            category: r.category_id ? { id: r.category_id } : null,
            defaultProvider: r.default_provider_id ? { id: r.default_provider_id } : null,
        })).sort((a, b) => safeLocaleCompare(a, b, 'name'));

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
        setProcessingStatus(`✅ MOTOR ANALÍTICO RESPONDE: ${result.data.response}`);
    } catch (err) {
        setLastError(err.message);
        setProcessingStatus('❌ FALLO LA CONEXIÓN');
    }
}
