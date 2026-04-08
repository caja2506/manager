/**
 * Station Service
 * ================
 * CRUD operations for project stations (subcollection).
 * 
 * Storage: projects/{projectId}/stations/{stationId}
 * 
 * Each station represents a physical point in the production line.
 * Stations belong to indexers (INDX). When a machine has multiple
 * indexers, stations are prefixed: "2-STN01". With a single indexer: "STN01".
 */

import {
    collection, doc, setDoc, updateDoc, deleteDoc,
    getDocs, query, orderBy, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../models/schemas';
import { createStationDocument, formatStationLabel } from '../models/schemas';

// ── Helpers ──

/**
 * Get a reference to the stations subcollection of a project.
 */
function stationsRef(projectId) {
    return collection(db, COLLECTIONS.PROJECTS, projectId, COLLECTIONS.PROJECT_STATIONS);
}

/**
 * Determine if a set of stations spans multiple indexers.
 * @param {Array} stations - array of station documents
 * @returns {boolean}
 */
export function hasMultipleIndexers(stations) {
    if (!stations || stations.length === 0) return false;
    const indexers = new Set(stations.map(s => s.indx || 1));
    return indexers.size > 1;
}

// ── CRUD ──

/**
 * Fetch all stations for a project (one-time read).
 */
export async function getProjectStations(projectId) {
    if (!projectId) return [];
    const snap = await getDocs(
        query(stationsRef(projectId), orderBy('order'))
    );
    return snap.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .sort((a, b) => (a.indx || 1) - (b.indx || 1) || (a.order || 0) - (b.order || 0));
}

/**
 * Subscribe to real-time station updates for a project.
 * @returns {Function} unsubscribe function
 */
export function onProjectStations(projectId, callback) {
    if (!projectId) {
        callback([]);
        return () => {};
    }
    return onSnapshot(
        query(stationsRef(projectId), orderBy('order')),
        snap => {
            const sorted = snap.docs
                .map(d => ({ ...d.data(), id: d.id }))
                .sort((a, b) => (a.indx || 1) - (b.indx || 1) || (a.order || 0) - (b.order || 0));
            callback(sorted);
        },
        (error) => {
            console.error('Station subscription error:', error);
            callback([]);
        }
    );
}

/**
 * Add a single station to a project.
 */
export async function addStation(projectId, stationData, userId = null) {
    const data = createStationDocument({ ...stationData, createdBy: userId });
    const ref = doc(stationsRef(projectId));
    await setDoc(ref, data);
    return ref.id;
}

/**
 * Update a station's fields.
 */
export async function updateStation(projectId, stationId, updates) {
    await updateDoc(
        doc(db, COLLECTIONS.PROJECTS, projectId, COLLECTIONS.PROJECT_STATIONS, stationId),
        { ...updates, updatedAt: new Date().toISOString() }
    );
}

/**
 * Delete a station from a project.
 */
export async function deleteStation(projectId, stationId) {
    await deleteDoc(
        doc(db, COLLECTIONS.PROJECTS, projectId, COLLECTIONS.PROJECT_STATIONS, stationId)
    );
}

/**
 * Bulk import stations from an array of objects.
 * Designed for future Excel/CSV import. Each item should have:
 * { indx, stn, abbreviation, description }
 * 
 * @param {string} projectId
 * @param {Array<object>} stationsArray
 * @param {string} userId
 * @returns {number} count of stations created
 */
export async function bulkImportStations(projectId, stationsArray, userId = null) {
    let count = 0;
    for (const [index, item] of stationsArray.entries()) {
        const data = createStationDocument({
            indx: item.indx || item.INDX || 1,
            stn: item.stn || item.STN || String(index + 1),
            abbreviation: item.abbreviation || item['ABBREVIATION NAME'] || item.ABBREVIATION || '',
            description: item.description || item.DESC || '',
            order: index,
            createdBy: userId,
        });
        const ref = doc(stationsRef(projectId));
        await setDoc(ref, data);
        count++;
    }
    return count;
}

/**
 * Get station display options for dropdowns.
 * Returns array of { value: stationId, label: "STN01 — BDY LD" }
 */
export function getStationOptions(stations) {
    if (!stations || stations.length === 0) return [];
    const multiIdx = hasMultipleIndexers(stations);
    return stations
        .filter(s => s.active !== false)
        .map(s => ({
            value: s.id,
            label: `${formatStationLabel(s, multiIdx)} — ${s.abbreviation || s.description || ''}`.trim(),
        }));
}
