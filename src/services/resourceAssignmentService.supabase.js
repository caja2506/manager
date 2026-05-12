/**
 * Resource Assignment Service — Supabase Implementation
 * ======================================================
 * Drop-in replacement for resourceAssignmentService.js (Firestore version).
 *
 * RULES:
 * - One active assignment per technician at a time
 * - Reassignment closes the previous and creates new
 * - Does NOT affect task.assignedTo
 * - Full audit trail via created_at/updated_at
 *
 * @module services/resourceAssignmentService.supabase
 */

import { supabase } from '../supabase';

/**
 * Get all active assignments
 * @returns {Promise<Array>}
 */
export async function getActiveAssignments() {
    const { data, error } = await supabase
        .from('resource_assignments')
        .select('*')
        .eq('active', true);

    if (error) throw new Error(`[resourceAssignment.sb] getActive: ${error.message}`);

    return (data || []).map(mapRow);
}

/**
 * Get assignment history for a specific technician (audit trail)
 * @param {string} technicianId
 * @returns {Promise<Array>}
 */
export async function getAssignmentHistory(technicianId) {
    const { data, error } = await supabase
        .from('resource_assignments')
        .select('*')
        .eq('technician_id', technicianId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`[resourceAssignment.sb] getHistory: ${error.message}`);

    return (data || []).map(mapRow);
}

/**
 * Create initial assignment (first time a technician is assigned)
 * @param {string} technicianId
 * @param {string} engineerId
 * @param {string} userId - who performed the action
 * @returns {Promise<string>} new document ID
 */
export async function createInitialAssignment(technicianId, engineerId, userId) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from('resource_assignments')
        .insert({
            technician_id: technicianId,
            engineer_id: engineerId,
            start_date: now,
            end_date: null,
            active: true,
            reason: 'default',
            created_by: userId,
            updated_by: userId,
        })
        .select('id')
        .single();

    if (error) throw new Error(`[resourceAssignment.sb] create: ${error.message}`);
    return data.id;
}

/**
 * Reassign a technician to a new engineer.
 * Closes the previous active assignment and creates a new one.
 *
 * @param {string} technicianId
 * @param {string} newEngineerId
 * @param {string} reason - 'préstamo' | 'soporte' | 'temporal' | 'default'
 * @param {string} userId - who performed the action
 * @returns {Promise<{ closedId: string|null, newId: string }>}
 */
export async function reassignTechnician(technicianId, newEngineerId, reason, userId) {
    const now = new Date().toISOString();

    // 1. Close active assignments for this technician
    const { data: activeRows, error: findErr } = await supabase
        .from('resource_assignments')
        .select('id')
        .eq('technician_id', technicianId)
        .eq('active', true);

    if (findErr) throw new Error(`[resourceAssignment.sb] find active: ${findErr.message}`);

    let closedId = null;
    for (const row of (activeRows || [])) {
        const { error: closeErr } = await supabase
            .from('resource_assignments')
            .update({
                active: false,
                end_date: now,
                updated_by: userId,
            })
            .eq('id', row.id);

        if (closeErr) console.warn('[resourceAssignment.sb] close failed:', closeErr.message);
        closedId = row.id;
    }

    // 2. Create new active assignment
    const { data: newRow, error: createErr } = await supabase
        .from('resource_assignments')
        .insert({
            technician_id: technicianId,
            engineer_id: newEngineerId,
            start_date: now,
            end_date: null,
            active: true,
            reason: reason || 'default',
            created_by: userId,
            updated_by: userId,
        })
        .select('id')
        .single();

    if (createErr) throw new Error(`[resourceAssignment.sb] create new: ${createErr.message}`);

    return { closedId, newId: newRow.id };
}

// ── Mapper: snake_case → camelCase ──
function mapRow(row) {
    return {
        id: row.id,
        technicianId: row.technician_id,
        engineerId: row.engineer_id,
        startDate: row.start_date,
        endDate: row.end_date,
        active: row.active,
        reason: row.reason,
        createdAt: row.created_at,
        createdBy: row.created_by,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
    };
}
