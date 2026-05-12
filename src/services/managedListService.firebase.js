/**
 * managedListService.js
 * =====================
 * [Phase M.2] Managed list CRUD operations.
 * Extracted from AppDataContext.jsx to reduce context size.
 *
 * Handles: taskType, workAreaType, milestoneType, category, provider, brand
 */

import {
    collection, doc, getDocs, writeBatch, query, where
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../models/schemas';

/**
 * Save managed list changes (add/rename/delete).
 * Supports engineering types (taskType, workAreaType, milestoneType)
 * and BOM lists (category, provider, brand).
 *
 * @param {{ type: string, data: { renames: Array, deleted: Array, added: Array }}} params
 */
export async function saveManagedList({ type, data }) {
    const { renames, deleted, added } = data;
    const batch = writeBatch(db);

    // ── Engineering managed lists (simple name-only docs) ──
    const simpleTypes = {
        taskType: COLLECTIONS.TASK_TYPES,
        workAreaType: COLLECTIONS.WORK_AREA_TYPES,
        milestoneType: COLLECTIONS.MILESTONE_TYPES,
    };

    if (simpleTypes[type]) {
        const collName = simpleTypes[type];
        const snap = await getDocs(collection(db, collName));
        const existing = snap.docs
            .map(d => ({ id: d.id, name: d.data()?.name }))
            .filter(d => d.name);

        deleted.forEach(name => {
            const found = existing.find(d => d.name === name);
            if (found) batch.delete(doc(db, collName, found.id));
        });
        renames.forEach(({ oldName, newName }) => {
            const found = existing.find(d => d.name === oldName);
            if (found) batch.update(doc(db, collName, found.id), { name: newName });
        });
        added.forEach(name => {
            if (!existing.some(d => d.name.toLowerCase() === name.toLowerCase()))
                batch.set(doc(collection(db, collName)), { name });
        });
        await batch.commit();
        return;
    }

    // ── BOM managed lists (category, provider, brand) ──
    const masterCatalogRef = collection(db, 'catalogo_maestro');
    let collectionName = '', fieldName = '';
    if (type === 'category') { collectionName = 'categorias'; fieldName = 'category'; }
    else if (type === 'provider') { collectionName = 'proveedores'; fieldName = 'defaultProvider'; }
    else if (type === 'brand') { collectionName = 'marcas'; fieldName = 'brand'; }
    else return;

    const collectionRef = collection(db, collectionName);
    const listQuerySnapshot = await getDocs(collectionRef);
    const existingDocs = listQuerySnapshot.docs
        .map(d => ({ id: d.id, name: d.data()?.name }))
        .filter(d => d.name);

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
}
