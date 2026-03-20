/**
 * bomCrudService.js
 * =================
 * [Phase M.2] BOM CRUD operations for pages.
 * Extracted from BomProjects, BomProjectDetail, and Catalog pages.
 */

import { doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Delete a BOM project.
 * @param {string} projectId
 */
export async function deleteBomProject(projectId) {
    await deleteDoc(doc(db, 'proyectos_bom', projectId));
}

/**
 * Delete a BOM item.
 * @param {string} itemId
 */
export async function deleteBomItem(itemId) {
    await deleteDoc(doc(db, 'items_bom', itemId));
}

/**
 * Delete a catalog record.
 * @param {string} recordId
 */
export async function deleteCatalogRecord(recordId) {
    await deleteDoc(doc(db, 'catalogo_maestro', recordId));
}

/**
 * Delete multiple catalog records in a batch.
 * @param {string[]} recordIds
 */
export async function deleteCatalogRecordsBatch(recordIds) {
    const batch = writeBatch(db);
    recordIds.forEach(id => {
        batch.delete(doc(db, 'catalogo_maestro', id));
    });
    await batch.commit();
}

/**
 * Duplicate BOM items from one project to another.
 * @param {Array} items - BOM items to duplicate
 * @param {string} targetProjectId
 */
export async function duplicateBomItems(items, targetProjectId) {
    const batch = writeBatch(db);
    items.forEach(item => {
        const newRef = doc(db, 'items_bom', `${targetProjectId}_${Date.now()}_${Math.random().toString(36).slice(2)}`);
        const { id, ...data } = item;
        batch.set(newRef, {
            ...data,
            projectId: targetProjectId,
            addedAt: new Date().toISOString(),
        });
    });
    await batch.commit();
}

/**
 * Delete multiple BOM items in a batch.
 * @param {string[]} itemIds
 */
export async function deleteBomItemsBatch(itemIds) {
    const batch = writeBatch(db);
    itemIds.forEach(id => {
        batch.delete(doc(db, 'items_bom', id));
    });
    await batch.commit();
}
