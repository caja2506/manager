import { supabase } from '../supabase';

/**
 * PO Service
 * ==========
 * Supabase service for managing project purchase orders and their associations with BOM items.
 */

export async function getPOsByProject(projectId) {
    if (!projectId) return [];
    const { data, error } = await supabase
        .from('project_pos')
        .select('*')
        .eq('project_id', projectId)
        .order('po_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

    if (error) {
        console.error("[poService] Error fetching POs:", error);
        throw error;
    }
    return data || [];
}

export async function syncProjectPOs(projectId, poRows) {
    if (!projectId) throw new Error("projectId is required");

    // 1. Fetch existing POs for this project
    const { data: existingPOs, error: fetchError } = await supabase
        .from('project_pos')
        .select('*')
        .eq('project_id', projectId);

    if (fetchError) {
        console.error("[poService] Error fetching existing POs:", fetchError);
        throw fetchError;
    }

    const toUpdate = [];
    const toInsert = [];
    const matchedIds = new Set();

    // 2. Classify rows into updates and inserts
    for (const row of poRows) {
        // Find if there is a match in existing POs
        // Match by PRCR, supplier, and amount to ensure it is the same record
        const match = existingPOs.find(epo => 
            !matchedIds.has(epo.id) &&
            String(epo.prcr || '') === String(row.prcr || '') &&
            String(epo.supplier || '').toLowerCase() === String(row.supplier || '').toLowerCase() &&
            Number(epo.amount || 0) === Number(row.amount || 0)
        );

        const mappedRow = {
            project_id: projectId,
            supplier: row.supplier || null,
            project_code: row.project_code || null,
            cap_id: row.cap_id ? String(row.cap_id) : null,
            prcr: row.prcr ? String(row.prcr) : null,
            type_code: row.type_code ? String(row.type_code) : null,
            prcr_start_date: row.prcr_start_date || null,
            po_date: row.po_date || null,
            amount: row.amount !== undefined ? Number(row.amount) : null,
            comments: row.comments || null,
            expected_date: row.expected_date || null,
            received_date: row.received_date || null,
            po_number: row.po_number ? String(row.po_number) : null,
            status: row.status || null,
            made_by: row.made_by || null,
            updated_at: new Date().toISOString()
        };

        if (match) {
            matchedIds.add(match.id);
            toUpdate.push({ id: match.id, ...mappedRow });
        } else {
            toInsert.push(mappedRow);
        }
    }

    // 3. Perform updates
    for (const item of toUpdate) {
        const { id, ...updates } = item;
        const { error: updateError } = await supabase
            .from('project_pos')
            .update(updates)
            .eq('id', id);
        if (updateError) {
            console.error(`[poService] Error updating PO ${id}:`, updateError);
            throw updateError;
        }
    }

    // 4. Perform inserts
    if (toInsert.length > 0) {
        const { error: insertError } = await supabase
            .from('project_pos')
            .insert(toInsert);
        if (insertError) {
            console.error("[poService] Error inserting POs:", insertError);
            throw insertError;
        }
    }

    // 5. Delete old POs that were not present in the new sync
    const unmatchedPOs = existingPOs.filter(epo => !matchedIds.has(epo.id));
    if (unmatchedPOs.length > 0) {
        const idsToDelete = unmatchedPOs.map(epo => epo.id);
        const { error: deleteError } = await supabase
            .from('project_pos')
            .delete()
            .in('id', idsToDelete);
        if (deleteError) {
            console.error("[poService] Error deleting unmatched POs:", deleteError);
            throw deleteError;
        }
    }

    return { updatedCount: toUpdate.length, insertedCount: toInsert.length, deletedCount: unmatchedPOs.length };
}

export async function updatePO(poId, updates) {
    if (!poId) throw new Error("poId is required");
    const { data, error } = await supabase
        .from('project_pos')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', poId)
        .select()
        .single();

    if (error) {
        console.error("[poService] Error updating PO:", error);
        throw error;
    }
    return data;
}

export async function deletePO(poId) {
    if (!poId) throw new Error("poId is required");
    const { error } = await supabase
        .from('project_pos')
        .delete()
        .eq('id', poId);

    if (error) {
        console.error("[poService] Error deleting PO:", error);
        throw error;
    }
    return true;
}

export async function associateItemWithPO(itemId, poId) {
    if (!itemId) throw new Error("itemId is required");
    const { data, error } = await supabase
        .from('items_bom')
        .update({ po_id: poId })
        .eq('id', itemId)
        .select()
        .single();

    if (error) {
        console.error("[poService] Error associating item with PO:", error);
        throw error;
    }
    return data;
}

export async function disassociateItemFromPO(itemId) {
    if (!itemId) throw new Error("itemId is required");
    const { data, error } = await supabase
        .from('items_bom')
        .update({ po_id: null })
        .eq('id', itemId)
        .select()
        .single();

    if (error) {
        console.error("[poService] Error disassociating item from PO:", error);
        throw error;
    }
    return data;
}
