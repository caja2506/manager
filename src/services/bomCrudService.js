/**
 * bomCrudService.js
 * =================
 * [Phase M.2] BOM CRUD operations for pages.
 * Dual-backend: Supabase or Firebase.
 */

import { supabase } from '../supabase';

/**
 * Delete a BOM project.
 */
export async function deleteBomProject(projectId) {
    await supabase.from('proyectos_bom').delete().eq('id', projectId);
}

/**
 * Delete a BOM item.
 */
export async function deleteBomItem(itemId) {
    await supabase.from('items_bom').delete().eq('id', itemId);
}

/**
 * Delete a catalog record.
 */
export async function deleteCatalogRecord(recordId) {
    await supabase.from('catalogo_maestro').delete().eq('id', recordId);
}

/**
 * Delete multiple catalog records in a batch.
 */
export async function deleteCatalogRecordsBatch(recordIds) {
    await supabase.from('catalogo_maestro').delete().in('id', recordIds);
}

/**
 * Duplicate BOM items from one project to another.
 */
export async function duplicateBomItems(items, targetProjectId) {
    const rows = items.map(item => {
        const { id, ...data } = item;
        return { ...data, project_id: targetProjectId, added_at: new Date().toISOString() };
    });
    await supabase.from('items_bom').insert(rows);
}

/**
 * Copy (duplicate) an entire BOM project — metadata + all items.
 * Returns the new project ID.
 */
export async function copyBomProject(sourceProject, sourceItems) {
    const newName = `${sourceProject.name} (Copia)`;
    const now = new Date().toISOString();

    // 1. Create the new project
    const { data: newProj, error: projErr } = await supabase
        .from('proyectos_bom')
        .insert({ name: newName, description: sourceProject.description || '', created_at: now })
        .select('id')
        .single();
    if (projErr) throw new Error(`Error creando proyecto: ${projErr.message}`);

    // 2. Duplicate all BOM items
    console.log(`[copyBomProject] Copiando ${sourceItems.length} items al proyecto ${newProj.id}...`);
    if (sourceItems.length > 0) {
        const rows = sourceItems.map(item => ({
            project_id: newProj.id,
            master_part_ref_id: item.master_part_ref_id || item.masterPartRef?.id || null,
            quantity: Number(item.quantity || 0),
            unit_price: Number(item.unit_price ?? item.unitPrice ?? 0),
            total_price: Number(item.total_price ?? item.totalPrice ?? 0),
            proveedor_id: item.proveedor_id || item.proveedor?.id || null,
            status: item.status || 'Requerido',
            lead_time_weeks: item.lead_time_weeks ?? item.leadTimeWeeks ?? null,
            prcr: item.prcr || null,
            added_at: now,
        }));
        console.log(`[copyBomProject] Primer item a insertar:`, JSON.stringify(rows[0]));
        const { data: insertedData, error: itemsErr } = await supabase.from('items_bom').insert(rows).select('id');
        if (itemsErr) {
            console.error(`[copyBomProject] Error insertando items:`, itemsErr);
            throw new Error(`Error copiando items: ${itemsErr.message}`);
        }
        console.log(`[copyBomProject] ✅ ${insertedData?.length || 0} items insertados`);
    }

    return newProj.id;
}

/**
 * Delete multiple BOM items in a batch.
 */
export async function deleteBomItemsBatch(itemIds) {
    await supabase.from('items_bom').delete().in('id', itemIds);
}
