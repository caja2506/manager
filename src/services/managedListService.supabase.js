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
    category: 'categorias',
    brand: 'marcas',
    provider: 'proveedores',
};

export async function saveManagedList({ type, data }) {
    const { renames, deleted, added } = data;

    const table = TABLE_MAP[type];
    if (!table) {
        console.warn(`[managedListService.sb] Unknown list type "${type}"`);
        return;
    }

    const { data: existing } = await supabase.from(table).select('id, name');
    const items = existing || [];

    // Deletes
    for (const name of deleted) {
        const found = items.find(d => d.name === name);
        if (found) await supabase.from(table).delete().eq('id', found.id);
    }
    // Renames / Updates
    for (const item of renames) {
        const { oldName, newName, is_workshop } = item;
        const found = items.find(d => d.name === oldName);
        if (found) {
            const upd = { name: newName };
            if (is_workshop !== undefined) upd.is_workshop = is_workshop;
            await supabase.from(table).update(upd).eq('id', found.id);
        }
    }
    // Adds
    for (const item of added) {
        const name = typeof item === 'string' ? item : item.name;
        const is_workshop = typeof item === 'string' ? false : !!item.is_workshop;
        if (!items.some(d => d.name.toLowerCase() === name.toLowerCase())) {
            const ins = { name };
            if (type === 'provider') ins.is_workshop = is_workshop;
            await supabase.from(table).insert(ins);
        }
    }
}
