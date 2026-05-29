/**
 * Managed List Service — Supabase Version
 * =========================================
 * Batch CRUD for managed lists (taskType, workAreaType, milestoneType, BOM lists).
 */

import { supabase } from '../supabase';

const TABLE_MAP = {
    taskType: 'task_types',
    workAreaType: 'work_area_types',
    milestoneType: 'milestone_types',
    timingAction: 'timing_actions',
};

export async function saveManagedList({ type, data }) {
    const { renames, deleted, added } = data;

    // ── Engineering managed lists ──
    if (TABLE_MAP[type]) {
        const table = TABLE_MAP[type];
        const { data: existing } = await supabase.from(table).select('id, name');
        const items = existing || [];

        // Deletes
        for (const name of deleted) {
            const found = items.find(d => d.name === name);
            if (found) await supabase.from(table).delete().eq('id', found.id);
        }
        // Renames
        for (const { oldName, newName } of renames) {
            const found = items.find(d => d.name === oldName);
            if (found) await supabase.from(table).update({ name: newName }).eq('id', found.id);
        }
        // Adds
        for (const name of added) {
            if (!items.some(d => d.name.toLowerCase() === name.toLowerCase())) {
                await supabase.from(table).insert({ name });
            }
        }
        return;
    }

    // ── BOM managed lists (category, provider, brand) ──
    // These stay on Firebase for now (BOM module not yet migrated)
    console.warn(`[managedListService.sb] BOM list type "${type}" not yet migrated to Supabase`);
}
