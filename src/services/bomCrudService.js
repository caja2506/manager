/**
 * bomCrudService.js
 * =================
 * [Phase M.2] BOM CRUD operations for pages.
 * Dual-backend: Supabase or Firebase.
 */

import { USE_SUPABASE } from './_backend';
import { supabase } from '../supabase';

/**
 * Delete a BOM project.
 */
export async function deleteBomProject(projectId) {
    if (USE_SUPABASE) {
        await supabase.from('proyectos_bom').delete().eq('id', projectId);
    } else {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        await deleteDoc(doc(db, 'proyectos_bom', projectId));
    }
}

/**
 * Delete a BOM item.
 */
export async function deleteBomItem(itemId) {
    if (USE_SUPABASE) {
        await supabase.from('items_bom').delete().eq('id', itemId);
    } else {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        await deleteDoc(doc(db, 'items_bom', itemId));
    }
}

/**
 * Delete a catalog record.
 */
export async function deleteCatalogRecord(recordId) {
    if (USE_SUPABASE) {
        await supabase.from('catalogo_maestro').delete().eq('id', recordId);
    } else {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        await deleteDoc(doc(db, 'catalogo_maestro', recordId));
    }
}

/**
 * Delete multiple catalog records in a batch.
 */
export async function deleteCatalogRecordsBatch(recordIds) {
    if (USE_SUPABASE) {
        await supabase.from('catalogo_maestro').delete().in('id', recordIds);
    } else {
        const { doc, writeBatch } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const batch = writeBatch(db);
        recordIds.forEach(id => batch.delete(doc(db, 'catalogo_maestro', id)));
        await batch.commit();
    }
}

/**
 * Duplicate BOM items from one project to another.
 */
export async function duplicateBomItems(items, targetProjectId) {
    if (USE_SUPABASE) {
        const rows = items.map(item => {
            const { id, ...data } = item;
            return { ...data, project_id: targetProjectId, added_at: new Date().toISOString() };
        });
        await supabase.from('items_bom').insert(rows);
    } else {
        const { doc, writeBatch } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const batch = writeBatch(db);
        items.forEach(item => {
            const newRef = doc(db, 'items_bom', `${targetProjectId}_${Date.now()}_${Math.random().toString(36).slice(2)}`);
            const { id, ...data } = item;
            batch.set(newRef, { ...data, projectId: targetProjectId, addedAt: new Date().toISOString() });
        });
        await batch.commit();
    }
}

/**
 * Delete multiple BOM items in a batch.
 */
export async function deleteBomItemsBatch(itemIds) {
    if (USE_SUPABASE) {
        await supabase.from('items_bom').delete().in('id', itemIds);
    } else {
        const { doc, writeBatch } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const batch = writeBatch(db);
        itemIds.forEach(id => batch.delete(doc(db, 'items_bom', id)));
        await batch.commit();
    }
}
