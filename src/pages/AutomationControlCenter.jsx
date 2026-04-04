import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import {
    doc, onSnapshot, updateDoc, collection,
    query, orderBy, limit, getDocs
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase.js';
import { useRole } from '../contexts/RoleContext.jsx';

// --- Automation imports ---
import {
    SETTINGS_COLLECTION,
    SETTINGS_DOCS,
    AUTOMATION_ROUTINES,
    AUTOMATION_RUNS,
    AUTOMATION_METRICS_DAILY,
    TELEGRAM_DELIVERIES,
} from '../automation/firestorePaths.js';
import { bootstrapAutomation } from '../automation/bootstrapAutomation.js';
import { getMetricsDocId } from '../automation/metricsHelper.js';
import { fetchAnalyticsDashboard } from '../automation/analyticsService.js';
import { fetchOptimizationDashboard, runOptimizationScan as scanOptimization } from '../automation/optimizationService.js';
import AutomationControlShell from '../components/automation/AutomationControlShell.jsx';

/**
 * AutomationControlCenter
 * 
 * Admin-only page that serves as the command center for the
 * Automation Operations & Accountability Foundation.
 * 
 * Reads:
 * - settings/automationCore
 * - settings/telegramOps
 * - automationRoutines (all)
 * - automationRuns (last 20)
 * - automationMetricsDaily (today)
 * 
 * Calls bootstrapAutomation() on first load (idempotent).
 */
export default function AutomationControlCenter() {
    const { isAdmin, roleLoading, isSuperAdmin } = useRole();
    const navigate = useNavigate();

    // Effective admin: either resolved admin role OR super admin email
    const hasAccess = isAdmin || isSuperAdmin;

    // --- State ---
    const [loading, setLoading] = useState(true);
    const [coreConfig, setCoreConfig] = useState(null);
    const [telegramConfig, setTelegramConfig] = useState(null);
    const [aiConfig, setAiConfig] = useState(null);
    const [routines, setRoutines] = useState([]);
    const [recentRuns, setRecentRuns] = useState([]);
    const [recentDeliveries, setRecentDeliveries] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [todayMetrics, setTodayMetrics] = useState(null);
    const [bootstrapSummary, setBootstrapSummary] = useState(null);
    const [error, setError] = useState(null);
    // Phase 4: Analytics state
    const [analyticsData, setAnalyticsData] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsPeriod, setAnalyticsPeriod] = useState('daily');
    // Phase 5: Optimization state
    const [optimizationData, setOptimizationData] = useState(null);
    const [optimizationLoading, setOptimizationLoading] = useState(false);

    // --- Access guard (waits for role to load) ---
    useEffect(() => {
        if (!roleLoading && !hasAccess) {
            navigate('/', { replace: true });
        }
    }, [hasAccess, roleLoading, navigate]);

    // --- Bootstrap + Subscriptions ---
    useEffect(() => {
        if (roleLoading || !hasAccess) return;

        let unsubCore, unsubTg, unsubAI, unsubRoutines, unsubRuns, unsubDeliveries, unsubMembers;
        let mounted = true;

        async function init() {
            try {
                // Bootstrap (idempotent)
                const summary = await bootstrapAutomation();
                if (mounted) setBootstrapSummary(summary);

                // Subscribe to automationCore
                unsubCore = onSnapshot(
                    doc(db, SETTINGS_COLLECTION, SETTINGS_DOCS.AUTOMATION_CORE),
                    snap => { if (mounted) setCoreConfig(snap.exists() ? snap.data() : null); }
                );

                // Subscribe to telegramOps
                unsubTg = onSnapshot(
                    doc(db, SETTINGS_COLLECTION, SETTINGS_DOCS.TELEGRAM_OPS),
                    snap => { if (mounted) setTelegramConfig(snap.exists() ? snap.data() : null); }
                );

                // Subscribe to automationAI settings
                unsubAI = onSnapshot(
                    doc(db, SETTINGS_COLLECTION, SETTINGS_DOCS.AUTOMATION_AI),
                    snap => { if (mounted) setAiConfig(snap.exists() ? snap.data() : null); }
                );

                // Subscribe to routines
                unsubRoutines = onSnapshot(
                    collection(db, AUTOMATION_ROUTINES),
                    snap => {
                        if (mounted) {
                            setRoutines(
                                snap.docs
                                    .map(d => ({ id: d.id, ...d.data() }))
                                    .sort((a, b) => (a.priority || 5) - (b.priority || 5))
                            );
                        }
                    }
                );

                // Subscribe to recent runs (real-time)
                const runsQuery = query(
                    collection(db, AUTOMATION_RUNS),
                    orderBy('createdAt', 'desc'),
                    limit(20)
                );
                unsubRuns = onSnapshot(runsQuery, snap => {
                    if (mounted) {
                        setRecentRuns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                    }
                });

                // Subscribe to recent deliveries
                const deliveriesQuery = query(
                    collection(db, TELEGRAM_DELIVERIES),
                    orderBy('createdAt', 'desc'),
                    limit(25)
                );
                unsubDeliveries = onSnapshot(deliveriesQuery, snap => {
                    if (mounted) {
                        setRecentDeliveries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                    }
                });

                // Subscribe to team members (for test messages)
                unsubMembers = onSnapshot(
                    collection(db, 'users'),
                    snap => {
                        if (mounted) {
                            setTeamMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                        }
                    }
                );

                // Fetch today's metrics
                const today = new Date().toISOString().split('T')[0];
                const metricsDocId = getMetricsDocId(today, 'telegram');
                const metricsRef = doc(db, AUTOMATION_METRICS_DAILY, metricsDocId);
                const directSnap = await import('firebase/firestore').then(({ getDoc }) =>
                    getDoc(metricsRef)
                ).catch(() => null);
                if (mounted && directSnap?.exists?.()) {
                    setTodayMetrics(directSnap.data());
                }

                if (mounted) setLoading(false);
            } catch (err) {
                console.error('[AutomationControlCenter] Init error:', err);
                if (mounted) {
                    setError(err.message);
                    setLoading(false);
                }
            }
        }

        init();

        return () => {
            mounted = false;
            unsubCore?.();
            unsubTg?.();
            unsubAI?.();
            unsubRoutines?.();
            unsubRuns?.();
            unsubDeliveries?.();
            unsubMembers?.();
        };
    }, [isAdmin]);

    // --- Handlers ---
    const handleToggleCoreEnabled = useCallback(async () => {
        if (!coreConfig) return;
        try {
            await updateDoc(
                doc(db, SETTINGS_COLLECTION, SETTINGS_DOCS.AUTOMATION_CORE),
                { enabled: !coreConfig.enabled, updatedAt: new Date().toISOString() }
            );
        } catch (err) {
            console.error('[AutomationControlCenter] Toggle core failed:', err);
        }
    }, [coreConfig]);

    const handleToggleRoutine = useCallback(async (routine) => {
        try {
            await updateDoc(
                doc(db, AUTOMATION_ROUTINES, routine.id),
                { enabled: !routine.enabled, updatedAt: new Date().toISOString() }
            );
        } catch (err) {
            console.error('[AutomationControlCenter] Toggle routine failed:', err);
        }
    }, []);

    const handleUpdateRoutineSchedule = useCallback(async (routineId, scheduleConfig) => {
        try {
            await updateDoc(
                doc(db, AUTOMATION_ROUTINES, routineId),
                { scheduleConfig, updatedAt: new Date().toISOString() }
            );
            console.log(`[ACC] Schedule updated for ${routineId}:`, scheduleConfig);
        } catch (err) {
            console.error('[AutomationControlCenter] Schedule update failed:', err);
            throw err;
        }
    }, []);

    const handleToggleDryRun = useCallback(async (target) => {
        try {
            if (target === 'core') {
                await updateDoc(
                    doc(db, SETTINGS_COLLECTION, SETTINGS_DOCS.AUTOMATION_CORE),
                    { dryRun: !(coreConfig?.dryRun ?? true), updatedAt: new Date().toISOString() }
                );
            } else if (target === 'telegram') {
                await updateDoc(
                    doc(db, SETTINGS_COLLECTION, SETTINGS_DOCS.TELEGRAM_OPS),
                    { dryRun: !(telegramConfig?.dryRun ?? true), updatedAt: new Date().toISOString() }
                );
            }
        } catch (err) {
            console.error('[AutomationControlCenter] Toggle dryRun failed:', err);
        }
    }, [coreConfig, telegramConfig]);

    const handleToggleDebugMode = useCallback(async (target) => {
        try {
            if (target === 'core') {
                await updateDoc(
                    doc(db, SETTINGS_COLLECTION, SETTINGS_DOCS.AUTOMATION_CORE),
                    { debugMode: !(coreConfig?.debugMode ?? false), updatedAt: new Date().toISOString() }
                );
            } else if (target === 'telegram') {
                await updateDoc(
                    doc(db, SETTINGS_COLLECTION, SETTINGS_DOCS.TELEGRAM_OPS),
                    { debugMode: !(telegramConfig?.debugMode ?? false), updatedAt: new Date().toISOString() }
                );
            }
        } catch (err) {
            console.error('[AutomationControlCenter] Toggle debugMode failed:', err);
        }
    }, [coreConfig, telegramConfig]);

    // --- Manual action handlers ---
    const handleExecuteRoutine = useCallback(async (routineKey) => {
        const fn = httpsCallable(functions, 'executeRoutineManually');
        const result = await fn({ routineKey });
        return result.data;
    }, []);

    const handleSendTestMessage = useCallback(async (userId, message) => {
        const fn = httpsCallable(functions, 'sendTestMessage');
        const result = await fn({ userId, message });
        return result.data;
    }, []);

    // --- Phase 4: Analytics data loading ---
    // MUST be declared before any conditional returns (React Rules of Hooks)
    const handlePeriodChange = useCallback(async (period) => {
        setAnalyticsPeriod(period);
        setAnalyticsLoading(true);
        try {
            const data = await fetchAnalyticsDashboard(period, true);
            setAnalyticsData({ ...data, periodType: period });
        } catch (err) {
            console.warn('[ACC] Analytics load error:', err.message);
        } finally {
            setAnalyticsLoading(false);
        }
    }, []);

    // Auto-load analytics on mount
    useEffect(() => {
        if (!hasAccess || loading) return;
        handlePeriodChange('daily');
    }, [hasAccess, loading, handlePeriodChange]);

    // --- Phase 5: Optimization data loading ---
    const handleOptimizationScan = useCallback(async () => {
        setOptimizationLoading(true);
        try {
            await scanOptimization('daily');
            // Refresh dashboard after scan
            const data = await fetchOptimizationDashboard(true);
            setOptimizationData(data);
        } catch (err) {
            console.warn('[ACC] Optimization scan error:', err.message);
        } finally {
            setOptimizationLoading(false);
        }
    }, []);

    const handleSimulateFromOpportunity = useCallback(async (opportunity) => {
        // The SimulationPanel handles its own simulation calls
        // This is for triggering simulation from opportunity cards
        console.log('[ACC] Simulate from opportunity:', opportunity.rule, opportunity.entityId);
    }, []);

    // Auto-load optimization data on mount
    useEffect(() => {
        if (!hasAccess || loading) return;
        const loadOptimization = async () => {
            try {
                const data = await fetchOptimizationDashboard();
                setOptimizationData(data);
            } catch (err) {
                console.warn('[ACC] Optimization load error:', err.message);
            }
        };
        loadOptimization();
    }, [hasAccess, loading]);

    // --- Guard renders ---
    if (roleLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                    <p className="text-sm text-slate-400">Verificando permisos...</p>
                </div>
            </div>
        );
    }
    if (!hasAccess) return null;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                    <p className="text-sm text-slate-400">Cargando Automation Control Center...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-3">
                    <ShieldAlert className="w-10 h-10 text-red-400 mx-auto" />
                    <p className="text-sm text-red-400 font-bold">Error al cargar</p>
                    <p className="text-xs text-slate-500">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <PageHeader title="" showBack={true} />
            <AutomationControlShell
                coreConfig={coreConfig}
                telegramConfig={telegramConfig}
                aiConfig={aiConfig}
                routines={routines}
                recentRuns={recentRuns}
                recentDeliveries={recentDeliveries}
                todayMetrics={todayMetrics}
                teamMembers={teamMembers}
                onToggleCoreEnabled={handleToggleCoreEnabled}
                onToggleRoutine={handleToggleRoutine}
                onUpdateSchedule={handleUpdateRoutineSchedule}
                onToggleDryRun={handleToggleDryRun}
                onToggleDebugMode={handleToggleDebugMode}
                onExecuteRoutine={handleExecuteRoutine}
                onSendTestMessage={handleSendTestMessage}
                bootstrapSummary={bootstrapSummary}
                analyticsData={analyticsData}
                analyticsLoading={analyticsLoading}
                onPeriodChange={handlePeriodChange}
                optimizationData={optimizationData}
                optimizationLoading={optimizationLoading}
                onOptimizationScan={handleOptimizationScan}
                onSimulate={handleSimulateFromOpportunity}
            />
        </div>
    );
}
