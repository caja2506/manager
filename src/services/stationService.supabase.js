/**
 * Station Service — Supabase Version
 * ====================================
 * CRUD operations for project stations.
 * Replaces Firestore sub-collection with flat table `project_stations`.
 */

import { supabase } from '../supabase';

// ── Helpers ──

export function hasMultipleIndexers(stations) {
    if (!stations || stations.length === 0) return false;
    const indexers = new Set(stations.map(s => s.indx || 1));
    return indexers.size > 1;
}

// ── CRUD ──

export async function getProjectStations(projectId) {
    if (!projectId) return [];
    const { data, error } = await supabase
        .from('project_stations')
        .select('*')
        .eq('project_id', projectId)
        .order('indx', { ascending: true })
        .order('sort_order', { ascending: true });
    if (error) { console.error('[stationService.sb] getProjectStations:', error.message); return []; }
    return data || [];
}

export function onProjectStations(projectId, callback) {
    if (!projectId) { callback([]); return () => {}; }

    // Just fetch — no per-row Realtime subscription needed.
    // Stations rarely change, and having N channels (one per task row) crashes Supabase.
    getProjectStations(projectId).then(callback);

    return () => {};
}

export async function addStation(projectId, stationData, userId = null) {
    const row = {
        project_id: projectId,
        indx: stationData.indx || 1,
        stn: stationData.stn || '',
        abbreviation: stationData.abbreviation || '',
        description: stationData.description || '',
        sort_order: stationData.order || 0,
        active: stationData.active !== false,
        created_by: userId,
    };
    const { data, error } = await supabase
        .from('project_stations').insert(row).select('id').single();
    if (error) throw new Error(`[stationService.sb] addStation: ${error.message}`);
    return data.id;
}

export async function updateStation(projectId, stationId, updates) {
    const mapped = {};
    if (updates.indx !== undefined) mapped.indx = updates.indx;
    if (updates.stn !== undefined) mapped.stn = updates.stn;
    if (updates.abbreviation !== undefined) mapped.abbreviation = updates.abbreviation;
    if (updates.description !== undefined) mapped.description = updates.description;
    if (updates.order !== undefined) mapped.sort_order = updates.order;
    if (updates.active !== undefined) mapped.active = updates.active;
    if (updates.updatedBy) mapped.updated_by = updates.updatedBy;

    const { error } = await supabase
        .from('project_stations').update(mapped).eq('id', stationId);
    if (error) throw new Error(`[stationService.sb] updateStation: ${error.message}`);
}

export async function deleteStation(projectId, stationId) {
    const { error } = await supabase
        .from('project_stations').delete().eq('id', stationId);
    if (error) throw new Error(`[stationService.sb] deleteStation: ${error.message}`);
}

export async function bulkImportStations(projectId, stationsArray, userId = null) {
    const rows = stationsArray.map((item, index) => ({
        project_id: projectId,
        indx: item.indx || item.INDX || 1,
        stn: item.stn || item.STN || String(index + 1),
        abbreviation: item.abbreviation || item['ABBREVIATION NAME'] || item.ABBREVIATION || '',
        description: item.description || item.DESC || '',
        sort_order: index,
        created_by: userId,
    }));
    const { data, error } = await supabase
        .from('project_stations').insert(rows).select('id');
    if (error) throw new Error(`[stationService.sb] bulkImport: ${error.message}`);
    return data?.length || 0;
}

export function getStationOptions(stations) {
    if (!stations || stations.length === 0) return [];
    const multiIdx = hasMultipleIndexers(stations);
    const { formatStationLabel } = require('../models/schemas');
    return stations
        .filter(s => s.active !== false)
        .map(s => ({
            value: s.id,
            label: `${formatStationLabel(s, multiIdx)} — ${s.abbreviation || s.description || ''}`.trim(),
        }));
}
