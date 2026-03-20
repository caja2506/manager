import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    Radar, Shield, TrendingUp, TrendingDown, Minus, Users, Activity,
    AlertTriangle, Zap, Target, Clock, Calendar, BrainCircuit, RefreshCw,
    BarChart3, CheckCircle, AlertOctagon, ArrowUpRight
} from 'lucide-react';
import { useAuditData } from '../hooks/useAuditData';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import { useGeminiInsights } from '../hooks/useGeminiInsights';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import ComplianceScoresPanel from '../components/audit/ComplianceScoresPanel';
import AIInsightsPanel from '../components/audit/AIInsightsPanel';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ============================================================
// CONTROL TOWER PAGE
// ============================================================

export default function ControlTower() {
    const navigate = useNavigate();

    // ── Hooks ──
    const {
        runClientAudit, auditResult, scores, summary, isAuditing,
        findingsBySeverity, findingsByEntity, isReady: auditReady,
    } = useAuditData();

    const {
        teamUtilization, liveKPIs, generateSnapshot, snapshot, isGenerating,
        isReady: analyticsReady,
    } = useAnalyticsData();

    const {
        generateAuditInsights, generateTeamAnalysis, generateWeeklyBrief,
        insights, teamAnalysis, weeklyBrief, isGenerating: isAIGenerating, error: aiError,
    } = useGeminiInsights();

    const { engTasks = [], engProjects = [], engSubtasks = [], taskTypes = [], teamMembers = [] } = useEngineeringData();
    const { user } = useAuth();
    const { canEdit, canDelete } = useRole();

    // ── Task Edit Modal ──
    const [selectedTask, setSelectedTask] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const closeModal = () => { setIsModalOpen(false); setSelectedTask(null); };

    const handleOpenTask = useCallback((taskId) => {
        const task = engTasks.find(t => t.id === taskId);
        if (task) {
            setSelectedTask(task);
            setIsModalOpen(true);
        }
    }, [engTasks]);

    // Auto-run audit + snapshot when data is ready
    useEffect(() => {
        if (auditReady && !auditResult && !isAuditing) runClientAudit();
        if (analyticsReady && !snapshot && !isGenerating) generateSnapshot();
    }, [auditReady, analyticsReady, auditResult, isAuditing, snapshot, isGenerating, runClientAudit, generateSnapshot]);

    // ── Handlers ──
    const handleRunAll = () => {
        runClientAudit();
        generateSnapshot();
    };

    const handleAuditInsights = () => {
        if (auditResult) generateAuditInsights(auditResult, snapshot);
    };

    const handleTeamInsights = () => {
        if (teamUtilization) generateTeamAnalysis(teamUtilization);
    };

    const handleWeeklyBrief = () => {
        if (snapshot && auditResult) generateWeeklyBrief(snapshot, auditResult);
    };

    // ── Derived KPIs ──
    const utilizationLevel = teamUtilization?.teamLevel || 'unknown';

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Radar className="w-8 h-8 text-indigo-400" />
                        Control Tower
                        <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded-lg uppercase tracking-widest leading-none mt-1 border border-emerald-500/30">Live</span>
                    </h1>
                    <p className="text-sm font-bold text-slate-400 mt-1">
                        Panel ejecutivo • Management Intelligence • {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                </div>
                <button
                    onClick={handleRunAll}
                    disabled={isAuditing || isGenerating}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-indigo-900/30"
                >
                    <RefreshCw className={`w-4 h-4 ${(isAuditing || isGenerating) ? 'animate-spin' : ''}`} />
                    Actualizar Todo
                </button>
            </div>

            {/* ── EXECUTIVE KPI ROW ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                <KPICard label="Tareas Activas" value={liveKPIs.activeTasks} icon={Activity} color="indigo" onClick={() => navigate('/tasks')} />
                <KPICard label="Bloqueadas" value={liveKPIs.blockedTasks} icon={AlertOctagon} color="rose" onClick={() => navigate('/tasks')} />
                <KPICard label="Vencidas" value={liveKPIs.overdueTasks} icon={AlertTriangle} color="amber" />
                <KPICard label="Completadas/Sem" value={liveKPIs.completedThisWeek} icon={CheckCircle} color="emerald" />
                <KPICard label="Proyectos" value={liveKPIs.activeProjects} icon={Target} color="blue" onClick={() => navigate('/projects')} />
                <KPICard label="Delays" value={liveKPIs.activeDelays} icon={Clock} color="orange" />
                <KPICard label="Equipo" value={liveKPIs.teamSize} icon={Users} color="violet" onClick={() => navigate('/team')} />
                <KPICard label="Utilización" value={`${liveKPIs.avgUtilization}%`} icon={BarChart3} color={liveKPIs.avgUtilization > 85 ? 'amber' : liveKPIs.avgUtilization < 40 ? 'blue' : 'emerald'} />
            </div>

            {/* ── COMPLIANCE SCORES ── */}
            <ComplianceScoresPanel
                scores={scores}
                summary={summary}
                isAuditing={isAuditing}
                onRunAudit={runClientAudit}
            />

            {/* ── MAIN SPLIT: AI (Fibonacci left) + Issues ── */}
            <div className="grid lg:grid-cols-5 gap-6">

                {/* LEFT: AI Insights — Fibonacci proportion (~62%) */}
                <div className="lg:col-span-3">
                    <AIInsightsPanel
                        insights={insights}
                        teamAnalysis={teamAnalysis}
                        weeklyBrief={weeklyBrief}
                        isGenerating={isAIGenerating}
                        error={aiError}
                        onGenerateAudit={handleAuditInsights}
                        onGenerateTeam={handleTeamInsights}
                        onGenerateBrief={handleWeeklyBrief}
                    />
                </div>

                {/* RIGHT: Top Issues + Team Utilization (~38%) */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Top Issues */}
                    <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-400" /> Hallazgos Prioritarios
                            </h3>
                            <button onClick={() => navigate('/audit')} className="text-xs font-bold text-indigo-400 hover:underline flex items-center gap-1">
                                Ver todos <ArrowUpRight className="w-3 h-3" />
                            </button>
                        </div>

                        {auditResult?.findings?.length > 0 ? (() => {
                            const prioritized = auditResult.findings
                                .sort((a, b) => {
                                    const order = { critical: 0, warning: 1, info: 2 };
                                    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
                                })
                                .slice(0, 10);
                            return prioritized.length > 0 ? (
                                <div className="space-y-2">
                                    {prioritized.map((f, i) => (
                                        <div
                                            key={`${f.ruleId}-${f.entityId}-${i}`}
                                            onClick={() => f.entityType === 'task' && f.entityId && handleOpenTask(f.entityId)}
                                            className={`flex items-start gap-3 p-3 rounded-xl border-l-4 ${
                                                f.entityType === 'task' && f.entityId ? 'cursor-pointer hover:bg-slate-800/60' : ''
                                            } ${f.severity === 'critical' ? 'bg-rose-500/5 border-rose-500' :
                                                f.severity === 'warning' ? 'bg-amber-500/5 border-amber-500' :
                                                    'bg-blue-500/5 border-blue-500'
                                            }`}
                                        >
                                            {f.severity === 'critical'
                                                ? <AlertOctagon className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                                                : f.severity === 'warning'
                                                    ? <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                                                    : <Shield className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                                            }
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-200 truncate">{f.title}</p>
                                                <p className="text-[11px] text-slate-500 truncate">{f.message}</p>
                                            </div>
                                            <span className="text-[9px] font-mono text-slate-600 shrink-0">{f.ruleId}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : null;
                        })() : (
                            <div className="text-center py-6 border border-dashed border-slate-700 rounded-xl">
                                <Shield className="w-6 h-6 text-emerald-500 mx-auto mb-2 opacity-50" />
                                <p className="text-xs font-bold text-slate-500">Sin hallazgos prioritarios</p>
                            </div>
                        )}
                    </div>

                    {/* Team Utilization */}
                    <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                <Users className="w-4 h-4 text-violet-400" /> Utilización del Equipo
                            </h3>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${utilizationLevel === 'optimal' ? 'text-emerald-400 bg-emerald-500/15' :
                                utilizationLevel === 'overloaded' || utilizationLevel === 'heavy' ? 'text-amber-400 bg-amber-500/15' :
                                    'text-blue-400 bg-blue-500/15'
                                }`}>
                                {teamUtilization?.teamLevel || '—'}
                            </span>
                        </div>

                        {teamUtilization?.members?.length > 0 ? (
                            <div className="space-y-2.5">
                                {teamUtilization.members.slice(0, 10).map(member => {
                                    const pct = Math.min(member.utilizationPercent, 150);
                                    const barWidth = Math.min((pct / 100) * 100, 100);
                                    const barColor =
                                        member.level === 'overloaded' ? 'bg-rose-500' :
                                            member.level === 'heavy' ? 'bg-amber-500' :
                                                member.level === 'optimal' ? 'bg-emerald-500' :
                                                    member.level === 'light' ? 'bg-blue-400' :
                                                        'bg-slate-600';

                                    return (
                                        <div key={member.userId} className="flex items-center gap-3">
                                            <div className="w-28 truncate">
                                                <span className="text-xs font-bold text-slate-300 block truncate">{member.displayName}</span>
                                                <span className="text-[9px] font-bold text-slate-600 uppercase">{member.teamRole}</span>
                                            </div>
                                            <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${barColor} rounded-full transition-all duration-700`}
                                                    style={{ width: `${barWidth}%` }}
                                                />
                                            </div>
                                            <div className="w-16 text-right">
                                                <span className="text-xs font-black text-slate-300">{member.utilizationPercent}%</span>
                                                <span className="text-[9px] text-slate-600 block">{member.activeTasks}t</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 text-center py-4">Sin datos de equipo</p>
                        )}

                        {/* Team Summary */}
                        {teamUtilization && (
                            <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                                <MiniStat label="Capacidad" value={`${teamUtilization.totalCapacity}h`} />
                                <MiniStat label="Horas Log." value={`${teamUtilization.totalHoursLogged}h`} />
                                <MiniStat label="Overtime" value={`${teamUtilization.totalOvertime}h`} />
                                <MiniStat label="Utiliz." value={`${teamUtilization.avgUtilization}%`} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Task Detail Modal */}
            <TaskDetailModal
                isOpen={isModalOpen}
                onClose={closeModal}
                task={selectedTask}
                projects={engProjects}
                teamMembers={teamMembers}
                subtasks={selectedTask ? engSubtasks.filter(s => s.taskId === selectedTask.id) : []}
                taskTypes={taskTypes}
                userId={user?.uid}
                canEdit={canEdit}
                canDelete={canDelete}
            />
        </div>
    );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function KPICard({ label, value, icon: Icon, color, onClick }) {
    const colorMap = {
        indigo: 'text-indigo-400 bg-indigo-600/15 border-indigo-500/20',
        rose: 'text-rose-400 bg-rose-600/15 border-rose-500/20',
        amber: 'text-amber-400 bg-amber-600/15 border-amber-500/20',
        emerald: 'text-emerald-400 bg-emerald-600/15 border-emerald-500/20',
        blue: 'text-blue-400 bg-blue-600/15 border-blue-500/20',
        orange: 'text-orange-400 bg-orange-600/15 border-orange-500/20',
        violet: 'text-violet-400 bg-violet-600/15 border-violet-500/20',
    };

    const classes = colorMap[color] || colorMap.indigo;
    const [textColor, bgColor, borderColor] = classes.split(' ');

    return (
        <div
            onClick={onClick}
            className={`${bgColor} backdrop-blur-sm p-3 rounded-xl border ${borderColor} shadow-sm ${onClick ? 'cursor-pointer hover:scale-[1.03]' : ''} transition-all`}
        >
            <div className="flex items-center justify-between mb-1">
                <Icon className={`w-4 h-4 ${textColor}`} />
            </div>
            <span className="text-xl font-black text-white block">{value}</span>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{label}</span>
        </div>
    );
}

function MiniStat({ label, value }) {
    return (
        <div className="text-center">
            <span className="text-xs font-black text-white block">{value}</span>
            <span className="text-[9px] font-bold text-slate-600 uppercase">{label}</span>
        </div>
    );
}
