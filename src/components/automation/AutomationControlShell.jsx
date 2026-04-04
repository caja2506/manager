import React, { useState } from 'react';
import {
    Zap, Settings, Activity, AlertTriangle, BarChart3,
    Radio, ToggleLeft, ToggleRight, Bug, FlaskConical,
    Play, Send, Brain, LineChart, Sparkles, Users
} from 'lucide-react';
import RoutineListCard from './RoutineListCard';
import AutomationRunLogCard from './AutomationRunLogCard';
import MetricsSummaryCard from './MetricsSummaryCard';
import ChannelHealthCard from './ChannelHealthCard';
import ManualActionPanel from './ManualActionPanel';
import ActivityFeedCard from './ActivityFeedCard';
import AutomationAISummaryCard from './AutomationAISummaryCard';
import AIExecutionLogCard from './AIExecutionLogCard';
import ManualAIActionPanel from './ManualAIActionPanel';
// Phase 4: Analytics components
import AnalyticsFiltersBar from './AnalyticsFiltersBar';
import ExecutiveSummaryCard from './ExecutiveSummaryCard';
import KpiOverviewCard from './KpiOverviewCard';
import RiskFlagsCard from './RiskFlagsCard';
import RecommendationCard from './RecommendationCard';
import UserScorecardCard from './UserScorecardCard';
import RoutineHealthCard from './RoutineHealthCard';
import AIAnalyticsCard from './AIAnalyticsCard';
// Phase 5: Optimization components
import OptimizationFiltersBar from './OptimizationFiltersBar';
import OptimizationOpportunitiesCard from './OptimizationOpportunitiesCard';
import SimulationPanel from './SimulationPanel';
import OperationalPlanCard from './OperationalPlanCard';
import InterventionAlertsCard from './InterventionAlertsCard';
import ImpactTrackingCard from './ImpactTrackingCard';
import OptimizationInsightsCard from './OptimizationInsightsCard';
import TeamManagementPanel from './TeamManagementPanel';
import DayScheduleSettings from '../settings/DayScheduleSettings.jsx';
import EmailReportSettings from '../settings/EmailReportSettings.jsx';

const TABS = [
    { key: 'control', label: 'Control', icon: Settings },
    { key: 'actions', label: 'Acciones', icon: Play },
    { key: 'analytics', label: 'Analítica', icon: LineChart },
    { key: 'optimization', label: 'Optimización', icon: Sparkles },
    { key: 'intelligence', label: 'Inteligencia', icon: Brain },
    { key: 'routines', label: 'Rutinas', icon: Activity },
    { key: 'activity', label: 'Actividad', icon: Zap },
    { key: 'incidents', label: 'Incidentes', icon: AlertTriangle },
    { key: 'metrics', label: 'Métricas', icon: BarChart3 },
    { key: 'channels', label: 'Canales', icon: Radio },
    { key: 'team', label: 'Equipo', icon: Users },
];

/**
 * AutomationControlShell
 * 
 * Main layout shell for the Automation Control Center.
 * Contains tabbed navigation and renders appropriate content
 * for each section.
 */
export default function AutomationControlShell({
    coreConfig,
    telegramConfig,
    aiConfig,
    routines,
    recentRuns,
    recentDeliveries,
    todayMetrics,
    teamMembers,
    onToggleCoreEnabled,
    onToggleRoutine,
    onUpdateSchedule,
    onToggleDryRun,
    onToggleDebugMode,
    onExecuteRoutine,
    onSendTestMessage,
    bootstrapSummary,
    // Phase 4: Analytics
    analyticsData,
    analyticsLoading,
    onPeriodChange,
    // Phase 5: Optimization
    optimizationData,
    optimizationLoading,
    onOptimizationScan,
    onSimulate,
}) {
    const [activeTab, setActiveTab] = useState('control');

    const isGlobalEnabled = coreConfig?.enabled ?? false;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/30">
                        <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight">
                            Automation Control Center
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Plataforma de automatización operativa — Gobierno y observabilidad
                        </p>
                    </div>
                </div>

                {/* Global toggle */}
                <button
                    onClick={onToggleCoreEnabled}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${isGlobalEnabled
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                        : 'bg-slate-700/50 text-slate-400 border border-slate-600/30 hover:bg-slate-700'
                        }`}
                >
                    {isGlobalEnabled
                        ? <ToggleRight className="w-5 h-5" />
                        : <ToggleLeft className="w-5 h-5" />
                    }
                    {isGlobalEnabled ? 'Sistema Activo' : 'Sistema Inactivo'}
                </button>
            </div>

            {/* Bootstrap info banner */}
            {bootstrapSummary && (bootstrapSummary.totalCreated > 0 || bootstrapSummary.totalSynced > 0) && (
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm text-indigo-300">
                    <span className="font-bold">Bootstrap:</span>
                    {bootstrapSummary.totalCreated > 0 && ` Se crearon ${bootstrapSummary.totalCreated} documentos.`}
                    {bootstrapSummary.totalSynced > 0 && ` Se sincronizaron ${bootstrapSummary.totalSynced} rutinas con los cambios más recientes.`}
                </div>
            )}

            {/* Tab navigation */}
            <div className="flex items-center gap-1 bg-slate-800/50 rounded-xl p-1 border border-slate-700/30">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${isActive
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            <div className="min-h-[400px]">
                {activeTab === 'control' && (
                    <ControlPanel
                        coreConfig={coreConfig}
                        telegramConfig={telegramConfig}
                        onToggleDryRun={onToggleDryRun}
                        onToggleDebugMode={onToggleDebugMode}
                    />
                )}
                {activeTab === 'actions' && (
                    <ManualActionPanel
                        routines={routines}
                        teamMembers={teamMembers}
                        onExecuteRoutine={onExecuteRoutine}
                        onSendTestMessage={onSendTestMessage}
                    />
                )}
                {activeTab === 'intelligence' && (
                    <div className="space-y-4">
                        <AutomationAISummaryCard aiConfig={aiConfig} />
                        <AIExecutionLogCard />
                        <ManualAIActionPanel />
                    </div>
                )}
                {activeTab === 'routines' && (
                    <div className="space-y-4">
                        <RoutineListCard
                            routines={routines}
                            onToggleRoutine={onToggleRoutine}
                            onUpdateSchedule={onUpdateSchedule}
                        />
                        <DayScheduleSettings />
                        <EmailReportSettings />
                    </div>
                )}
                {activeTab === 'activity' && (
                    <div className="space-y-4">
                        <AutomationRunLogCard runs={recentRuns} />
                        <ActivityFeedCard
                            recentRuns={recentRuns}
                            recentDeliveries={recentDeliveries}
                        />
                    </div>
                )}
                {activeTab === 'incidents' && (
                    <IncidentsPlaceholder />
                )}
                {activeTab === 'analytics' && (
                    <div className="space-y-4">
                        <AnalyticsFiltersBar
                            periodType={analyticsData?.periodType || 'daily'}
                            onPeriodChange={onPeriodChange}
                            loading={analyticsLoading}
                        />
                        <ExecutiveSummaryCard
                            globalKpis={analyticsData?.globalKpis}
                            trendSummary={analyticsData?.trendSummary}
                            riskFlags={analyticsData?.riskFlags}
                            lastRefresh={analyticsData?.lastRefresh}
                        />
                        <KpiOverviewCard
                            globalKpis={analyticsData?.globalKpis}
                            trends={analyticsData?.trends}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <RiskFlagsCard riskFlags={analyticsData?.riskFlags} />
                            <RecommendationCard recommendations={analyticsData?.recommendations} />
                        </div>
                        <UserScorecardCard userScores={analyticsData?.userScores} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <RoutineHealthCard routineScores={analyticsData?.routineScores} />
                            <AIAnalyticsCard globalKpis={analyticsData?.globalKpis} />
                        </div>
                    </div>
                )}
                {activeTab === 'optimization' && (
                    <div className="space-y-4">
                        <OptimizationFiltersBar
                            onScan={onOptimizationScan}
                            scanning={optimizationLoading}
                        />
                        <OptimizationInsightsCard
                            insightSummary={optimizationData?.insightSummary}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <OptimizationOpportunitiesCard
                                opportunities={optimizationData?.opportunities}
                                onSimulate={onSimulate}
                            />
                            <InterventionAlertsCard
                                interventions={optimizationData?.interventions}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <OperationalPlanCard
                                plans={optimizationData?.plans}
                            />
                            <ImpactTrackingCard
                                applied={optimizationData?.applied}
                            />
                        </div>
                        <SimulationPanel
                            routines={routines}
                        />
                    </div>
                )}
                {activeTab === 'metrics' && (
                    <MetricsSummaryCard metrics={todayMetrics} />
                )}
                {activeTab === 'channels' && (
                    <ChannelHealthCard
                        coreConfig={coreConfig}
                        telegramConfig={telegramConfig}
                    />
                )}
                {activeTab === 'team' && (
                    <TeamManagementPanel />
                )}
            </div>
        </div>
    );
}

// ============================================================
// CONTROL PANEL (inline sub-component)
// ============================================================

function ControlPanel({ coreConfig, telegramConfig, onToggleDryRun, onToggleDebugMode }) {
    const items = [
        {
            label: 'Dry-Run Mode',
            description: 'Simula envíos sin afectar usuarios reales.',
            icon: FlaskConical,
            enabled: coreConfig?.dryRun ?? true,
            onToggle: () => onToggleDryRun?.('core'),
            color: 'text-orange-400',
        },
        {
            label: 'Debug Mode',
            description: 'Habilita logs extendidos y trazabilidad granular.',
            icon: Bug,
            enabled: coreConfig?.debugMode ?? false,
            onToggle: () => onToggleDebugMode?.('core'),
            color: 'text-yellow-400',
        },
        {
            label: 'Telegram Dry-Run',
            description: 'Simula envíos Telegram sin entregar mensajes.',
            icon: FlaskConical,
            enabled: telegramConfig?.dryRun ?? true,
            onToggle: () => onToggleDryRun?.('telegram'),
            color: 'text-sky-400',
        },
        {
            label: 'Telegram Debug',
            description: 'Logs detallados del bot Telegram.',
            icon: Bug,
            enabled: telegramConfig?.debugMode ?? false,
            onToggle: () => onToggleDebugMode?.('telegram'),
            color: 'text-sky-400',
        },
    ];

    return (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">
                Control Global
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map(item => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={item.label}
                            className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700/30"
                        >
                            <div className="flex items-center gap-3">
                                <Icon className={`w-5 h-5 ${item.color}`} />
                                <div>
                                    <p className="text-sm font-semibold text-white">{item.label}</p>
                                    <p className="text-[10px] text-slate-500">{item.description}</p>
                                </div>
                            </div>
                            <button
                                onClick={item.onToggle}
                                className={`flex-shrink-0 p-1 rounded-lg transition-colors ${item.enabled
                                    ? 'text-emerald-400 hover:bg-emerald-400/10'
                                    : 'text-slate-500 hover:bg-slate-700'
                                    }`}
                            >
                                {item.enabled
                                    ? <ToggleRight className="w-6 h-6" />
                                    : <ToggleLeft className="w-6 h-6" />
                                }
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* System info */}
            <div className="mt-4 pt-4 border-t border-slate-700/30">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <InfoBadge label="Timezone" value={coreConfig?.defaultTimezone || '—'} />
                    <InfoBadge label="Canales" value={(coreConfig?.allowedChannels || []).length} />
                    <InfoBadge label="Métricas" value={coreConfig?.metricsEnabled ? 'ON' : 'OFF'} />
                    <InfoBadge label="Consola" value={coreConfig?.opsConsoleEnabled ? 'ON' : 'OFF'} />
                </div>
            </div>
        </div>
    );
}

function InfoBadge({ label, value }) {
    return (
        <div className="bg-slate-900/40 rounded-lg px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{label}</p>
            <p className="text-xs font-bold text-slate-300 mt-0.5">{String(value)}</p>
        </div>
    );
}

function IncidentsPlaceholder() {
    return (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">
                Incidentes
            </h3>
            <div className="text-center py-12">
                <AlertTriangle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Centro de incidentes disponible en Fase 2</p>
                <p className="text-[10px] text-slate-600 mt-1">
                    Bloqueos, escalaciones, y fallos operativos se mostrarán aquí.
                </p>
            </div>
        </div>
    );
}
