/**
 * Analytics Service — Frontend (ESM)
 * =====================================
 * Calls the getAnalyticsDashboard and refreshAnalyticsManual
 * Cloud Functions. Provides caching and period switching.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';

let _cachedData = null;
let _cachedPeriod = null;
let _cacheTimestamp = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch analytics dashboard data from the backend.
 * Uses cached data if available and fresh.
 *
 * @param {string} periodType - 'daily' | 'weekly' | 'monthly'
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Object>}
 */
export async function fetchAnalyticsDashboard(periodType = 'daily', forceRefresh = false) {
    const now = Date.now();

    if (!forceRefresh && _cachedData && _cachedPeriod === periodType &&
        _cacheTimestamp && (now - _cacheTimestamp) < CACHE_TTL_MS) {
        return _cachedData;
    }

    const functions = getFunctions();
    const getAnalytics = httpsCallable(functions, 'getAnalyticsDashboard');
    const result = await getAnalytics({ periodType });

    _cachedData = result.data;
    _cachedPeriod = periodType;
    _cacheTimestamp = now;

    return result.data;
}

/**
 * Trigger a manual analytics refresh (admin only).
 *
 * @param {string} periodType - 'daily' | 'weekly' | 'monthly'
 * @param {string} [startDate] - Override start date
 * @param {string} [endDate] - Override end date
 * @returns {Promise<Object>}
 */
export async function refreshAnalytics(periodType = 'daily', startDate, endDate) {
    const functions = getFunctions();
    const refreshFn = httpsCallable(functions, 'refreshAnalyticsManual');
    const result = await refreshFn({ periodType, startDate, endDate });

    // Invalidate cache after refresh
    _cachedData = null;
    _cachedPeriod = null;
    _cacheTimestamp = null;

    return result.data;
}

/**
 * Clear the analytics cache.
 */
export function clearAnalyticsCache() {
    _cachedData = null;
    _cachedPeriod = null;
    _cacheTimestamp = null;
}

/**
 * Format a KPI value for display.
 */
export function formatKpiValue(value, unit = 'percentage') {
    if (value === null || value === undefined) return '—';
    if (unit === 'percentage') return `${(value * 100).toFixed(1)}%`;
    if (unit === 'ratio') return value.toFixed(2);
    return String(value);
}

/**
 * Get color for KPI based on value and polarity.
 */
export function getKpiColor(value, polarity = 'higher') {
    if (value === null || value === undefined) return '#9ca3af';

    if (polarity === 'higher') {
        if (value >= 0.8) return '#22c55e';
        if (value >= 0.6) return '#f59e0b';
        return '#ef4444';
    }
    if (polarity === 'lower') {
        if (value <= 0.1) return '#22c55e';
        if (value <= 0.3) return '#f59e0b';
        return '#ef4444';
    }
    return '#6366f1'; // neutral
}

/**
 * Get severity badge color.
 */
export function getSeverityColor(severity) {
    const colors = {
        low: '#22c55e',
        medium: '#f59e0b',
        high: '#f97316',
        critical: '#ef4444',
    };
    return colors[severity] || '#9ca3af';
}

/**
 * Get priority badge color.
 */
export function getPriorityColor(priority) {
    const colors = {
        low: '#6366f1',
        medium: '#f59e0b',
        high: '#f97316',
        urgent: '#ef4444',
    };
    return colors[priority] || '#9ca3af';
}
