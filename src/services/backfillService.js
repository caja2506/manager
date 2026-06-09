/**
 * Backfill Service — Stub
 * ========================
 * Placeholder for backfill utilities referenced by Settings page.
 */

export async function backfillTimeLogNames(onProgress) {
    if (onProgress) onProgress('Backfill not implemented in current backend');
    return { updated: 0, skipped: 0 };
}
