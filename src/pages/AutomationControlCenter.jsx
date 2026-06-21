import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useRole } from '../contexts/RoleContext.jsx';
import { supabase } from '../supabase';

// --- Automation imports ---
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
 * - settings/automationCore (Supabase settings table)
 * - settings/telegramOps (Supabase settings table)
 * - settings/automationAI (Supabase settings table)
 * - automation_routines (all)
 * - automation_runs (last 20)
 * - automation_metrics_daily (today)
 * - telegram_deliveries (last 25)
 * - users (all)
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

    // Helpers to map DB records to frontend-compatible structures
    const mapRoutine = (r) => ({
        id: r.key,
        key: r.key,
        name: r.name,
        description: r.description,
        channel: r.channel,
        provider: r.provider,
        enabled: r.enabled,
        scheduleType: r.schedule_type,
        scheduleConfig: r.schedule_config,
        delayMinutes: r.delay_minutes,
        gracePeriodMinutes: r.grace_period_minutes,
        personalityMode: r.personality_mode,
        allowedRoles: r.allowed_roles,
        dryRun: r.dry_run,
        debugMode: r.debug_mode,
        priority: r.priority,
        lastRunAt: r.last_run_at,
        lastStatus: r.last_status,
        lastError: r.last_error,
        metadata: r.metadata,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    });

    const mapRun = (r) => ({
        id: r.id,
        routineKey: r.routine_key,
        status: r.status,
        triggeredBy: r.triggered_by,
        startedAt: r.started_at,
        completedAt: r.completed_at,
        durationMs: r.duration_ms,
        errorMessage: r.error_message,
        createdAt: r.created_at,
        ...(r.details || {}),
    });

    const mapDelivery = (d) => ({
        id: d.id,
        chatId: d.chat_id,
        userId: d.user_id,
        messageType: d.message_type,
        messagePreview: d.message_preview,
        status: d.status,
        errorMessage: d.error_message,
        sentAt: d.sent_at,
        createdAt: d.created_at,
    });

    // --- Bootstrap + Subscriptions ---
    useEffect(() => {
        if (roleLoading || !hasAccess) return;

        let chSettings, chRoutines, chRuns, chDeliveries, chMembers;
        let mounted = true;

        async function init() {
            try {
                // Bootstrap (idempotent)
                const summary = await bootstrapAutomation();
                if (mounted) setBootstrapSummary(summary);

                // ── 1. Fetch & Subscribe to settings ──
                const { data: settingsData } = await supabase.from('settings').select('*').in('key', ['automationCore', 'telegramOps', 'automationAI']);
                if (mounted && settingsData) {
                    const core = settingsData.find(s => s.key === 'automationCore');
                    const tg = settingsData.find(s => s.key === 'telegramOps');
                    const ai = settingsData.find(s => s.key === 'automationAI');
                    if (core) setCoreConfig(core.value);
                    if (tg) setTelegramConfig(tg.value);
                    if (ai) setAiConfig(ai.value);
                }

                chSettings = supabase.channel('acc-settings')
                    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' }, payload => {
                        if (!mounted) return;
                        const { key, value } = payload.new;
                        if (key === 'automationCore') setCoreConfig(value);
                        if (key === 'telegramOps') setTelegramConfig(value);
                        if (key === 'automationAI') setAiConfig(value);
                    })
                    .subscribe();

                // ── 2. Fetch & Subscribe to routines ──
                const { data: routinesData } = await supabase.from('automation_routines').select('*').order('priority');
                if (mounted && routinesData) {
                    setRoutines(routinesData.map(mapRoutine));
                }

                chRoutines = supabase.channel('acc-routines')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_routines' }, async () => {
                        const { data } = await supabase.from('automation_routines').select('*').order('priority');
                        if (mounted) setRoutines((data || []).map(mapRoutine));
                    })
                    .subscribe();

                // ── 3. Fetch & Subscribe to runs ──
                const { data: runsData } = await supabase.from('automation_runs').select('*').order('created_at', { ascending: false }).limit(20);
                if (mounted && runsData) {
                    setRecentRuns(runsData.map(mapRun));
                }

                chRuns = supabase.channel('acc-runs')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_runs' }, async () => {
                        const { data } = await supabase.from('automation_runs').select('*').order('created_at', { ascending: false }).limit(20);
                        if (mounted) setRecentRuns((data || []).map(mapRun));
                    })
                    .subscribe();

                // ── 4. Fetch & Subscribe to deliveries ──
                const { data: delivData } = await supabase.from('telegram_deliveries').select('*').order('created_at', { ascending: false }).limit(25);
                if (mounted && delivData) {
                    setRecentDeliveries(delivData.map(mapDelivery));
                }

                chDeliveries = supabase.channel('acc-deliveries')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'telegram_deliveries' }, async () => {
                        const { data } = await supabase.from('telegram_deliveries').select('*').order('created_at', { ascending: false }).limit(25);
                        if (mounted) setRecentDeliveries((data || []).map(mapDelivery));
                    })
                    .subscribe();

                // ── 5. Fetch & Subscribe to team members ──
                const { data: usersData } = await supabase.from('users').select('*').order('name');
                if (mounted && usersData) {
                    setTeamMembers(usersData);
                }

                chMembers = supabase.channel('acc-members')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, async () => {
                        const { data } = await supabase.from('users').select('*').order('name');
                        if (mounted) setTeamMembers(data || []);
                    })
                    .subscribe();

                // ── 6. Fetch today's metrics ──
                const today = new Date().toISOString().split('T')[0];
                const metricsDocId = getMetricsDocId(today, 'telegram');
                const { data: met } = await supabase.from('automation_metrics_daily').select('*').eq('id', metricsDocId).maybeSingle();
                if (mounted && met) {
                    setTodayMetrics({ id: met.id, date: met.date, ...(met.details || {}) });
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
            if (chSettings) supabase.removeChannel(chSettings);
            if (chRoutines) supabase.removeChannel(chRoutines);
            if (chRuns) supabase.removeChannel(chRuns);
            if (chDeliveries) supabase.removeChannel(chDeliveries);
            if (chMembers) supabase.removeChannel(chMembers);
        };
    }, [isAdmin]);

    // --- Handlers ---
    const handleToggleCoreEnabled = useCallback(async () => {
        if (!coreConfig) return;
        try {
            const nextValue = { ...coreConfig, enabled: !coreConfig.enabled, updatedAt: new Date().toISOString() };
            await supabase.from('settings').update({ value: nextValue }).eq('key', 'automationCore');
            setCoreConfig(nextValue);
        } catch (err) {
            console.error('[AutomationControlCenter] Toggle core failed:', err);
        }
    }, [coreConfig]);

    const handleToggleRoutine = useCallback(async (routine) => {
        try {
            await supabase
                .from('automation_routines')
                .update({ enabled: !routine.enabled, updated_at: new Date().toISOString() })
                .eq('key', routine.id);
        } catch (err) {
            console.error('[AutomationControlCenter] Toggle routine failed:', err);
        }
    }, []);

    const handleUpdateRoutineSchedule = useCallback(async (routineId, scheduleConfig) => {
        try {
            await supabase
                .from('automation_routines')
                .update({ schedule_config: scheduleConfig, updated_at: new Date().toISOString() })
                .eq('key', routineId);
            console.log(`[ACC] Schedule updated for ${routineId}:`, scheduleConfig);
        } catch (err) {
            console.error('[AutomationControlCenter] Schedule update failed:', err);
            throw err;
        }
    }, []);

    const handleToggleDryRun = useCallback(async (target) => {
        try {
            if (target === 'core') {
                const nextValue = { ...coreConfig, dryRun: !(coreConfig?.dryRun ?? true), updatedAt: new Date().toISOString() };
                await supabase.from('settings').update({ value: nextValue }).eq('key', 'automationCore');
                setCoreConfig(nextValue);
            } else if (target === 'telegram') {
                const nextValue = { ...telegramConfig, dryRun: !(telegramConfig?.dryRun ?? true), updatedAt: new Date().toISOString() };
                await supabase.from('settings').update({ value: nextValue }).eq('key', 'telegramOps');
                setTelegramConfig(nextValue);
            }
        } catch (err) {
            console.error('[AutomationControlCenter] Toggle dryRun failed:', err);
        }
    }, [coreConfig, telegramConfig]);

    const handleToggleDebugMode = useCallback(async (target) => {
        try {
            if (target === 'core') {
                const nextValue = { ...coreConfig, debugMode: !(coreConfig?.debugMode ?? false), updatedAt: new Date().toISOString() };
                await supabase.from('settings').update({ value: nextValue }).eq('key', 'automationCore');
                setCoreConfig(nextValue);
            } else if (target === 'telegram') {
                const nextValue = { ...telegramConfig, debugMode: !(telegramConfig?.debugMode ?? false), updatedAt: new Date().toISOString() };
                await supabase.from('settings').update({ value: nextValue }).eq('key', 'telegramOps');
                setTelegramConfig(nextValue);
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
        <div className="p-4 md:p-6 w-full h-full flex flex-col">
            
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
