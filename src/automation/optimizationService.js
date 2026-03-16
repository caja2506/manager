/**
 * Optimization Service — Frontend
 * ==================================
 * Cloud Function client for optimization engine operations:
 * scan, simulate, dashboard retrieval.
 *
 * @module automation/optimizationService
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

// ── Cloud Function references ──
const scanFn = httpsCallable(functions, 'runOptimizationScan');
const simulateFn = httpsCallable(functions, 'simulateChange');
const dashboardFn = httpsCallable(functions, 'getOptimizationDashboard');

// ── Cache ──
let cachedDashboard = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Fetch optimization dashboard data.
 * @param {boolean} forceRefresh - bypass cache
 */
export async function fetchOptimizationDashboard(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedDashboard && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return cachedDashboard;
    }

    try {
        const result = await dashboardFn();
        cachedDashboard = result.data;
        cacheTimestamp = Date.now();
        return result.data;
    } catch (error) {
        console.error('[OptimizationService] Dashboard error:', error.message);
        throw error;
    }
}

/**
 * Trigger an optimization scan (admin only).
 */
export async function runOptimizationScan(periodType = 'daily') {
    try {
        const result = await scanFn({ periodType });
        cachedDashboard = null; // invalidate cache
        return result.data;
    } catch (error) {
        console.error('[OptimizationService] Scan error:', error.message);
        throw error;
    }
}

/**
 * Run a what-if simulation.
 * @param {string} type - simulation type (schedule_change, grace_period_change, etc.)
 * @param {Object} params - simulation parameters
 */
export async function simulateChange(type, params) {
    try {
        const result = await simulateFn({ type, params });
        return result.data;
    } catch (error) {
        console.error('[OptimizationService] Simulation error:', error.message);
        throw error;
    }
}

// ── Display helpers ──

export function getOpportunityIcon(type) {
    const icons = {
        schedule: '📅',
        process: '🔧',
        workload: '👤',
        format: '📝',
        frequency: '🔄',
        elimination: '🗑️',
        ai_tuning: '🤖',
        escalation: '🚨',
    };
    return icons[type] || '💡';
}

export function getOpportunityLabel(type) {
    const labels = {
        schedule: 'Horario',
        process: 'Proceso',
        workload: 'Carga',
        format: 'Formato',
        frequency: 'Frecuencia',
        elimination: 'Eliminación',
        ai_tuning: 'IA',
        escalation: 'Escalaciones',
    };
    return labels[type] || type;
}

export function getUrgencyColor(urgency) {
    const colors = {
        act_now: '#ef4444',
        act_soon: '#f59e0b',
        watch: '#3b82f6',
    };
    return colors[urgency] || '#6b7280';
}

export function getUrgencyLabel(urgency) {
    const labels = {
        act_now: '🔴 Actuar Ahora',
        act_soon: '🟡 Actuar Pronto',
        watch: '🔵 Monitorear',
    };
    return labels[urgency] || urgency;
}

export function getImpactStatusColor(status) {
    const colors = {
        improved: '#22c55e',
        no_change: '#6b7280',
        worsened: '#ef4444',
        pending: '#f59e0b',
        measured: '#3b82f6',
    };
    return colors[status] || '#6b7280';
}

export function getImpactStatusLabel(status) {
    const labels = {
        improved: '✅ Mejoró',
        no_change: '➖ Sin cambio',
        worsened: '❌ Empeoró',
        pending: '⏳ Pendiente',
        measured: '📊 Medido',
    };
    return labels[status] || status;
}

export function formatPercent(value) {
    if (value === null || value === undefined) return '—';
    return `${(value * 100).toFixed(1)}%`;
}

export function formatDelta(delta) {
    if (delta === null || delta === undefined) return '—';
    const sign = delta > 0 ? '+' : '';
    return `${sign}${(delta * 100).toFixed(1)}%`;
}

export function getConfidenceColor(confidence) {
    if (confidence >= 0.7) return '#22c55e';
    if (confidence >= 0.5) return '#f59e0b';
    return '#ef4444';
}

export function getConfidenceLabel(confidence) {
    if (confidence >= 0.7) return 'Alta';
    if (confidence >= 0.5) return 'Media';
    return 'Baja';
}
