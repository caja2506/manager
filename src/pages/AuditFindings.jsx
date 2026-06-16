import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Shield, Filter, Download, RefreshCw, Search, ChevronDown, User, Users } from 'lucide-react';
import { useAuditData } from '../hooks/useAuditData';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import ComplianceScoresPanel from '../components/audit/ComplianceScoresPanel';
import { FindingCardList, FindingSeverityBadge } from '../components/audit/FindingCard';
import { RULE_CATALOG, RULE_CATEGORY, getRulesByCategory } from '../core/rules/ruleCatalog';
import TaskDetailModal from '../components/tasks/TaskDetailModal';

// ============================================================
// FILTER OPTIONS
// ============================================================

const SEVERITY_OPTIONS = [
    { value: 'all', label: 'Todas las severidades' },
    { value: 'critical', label: 'Crítico' },
    { value: 'warning', label: 'Advertencia' },
    { value: 'info', label: 'Información' },
];

const ENTITY_OPTIONS = [
    { value: 'all', label: 'Todas las entidades' },
    { value: 'task', label: 'Tareas' },
    { value: 'project', label: 'Proyectos' },
    { value: 'user', label: 'Usuarios' },
];

const CATEGORY_OPTIONS = [
    { value: 'all', label: 'Todas las categorías' },
    { value: 'task', label: 'Reglas de Tareas' },
    { value: 'planner', label: 'Reglas de Planner' },
    { value: 'project', label: 'Reglas de Proyecto' },
    { value: 'discipline', label: 'Reglas de Disciplina' },
];

// ============================================================
// AUDIT FINDINGS PAGE
// ============================================================

export default function AuditFindings() {
    const {
        runClientAudit,
        auditResult,
        isAuditing,
        scores,
        summary,
        findingsBySeverity,
        findingsByEntity,
        isReady,
    } = useAuditData();

    const { engTasks = [], engProjects = [], engSubtasks = [], taskTypes = [], teamMembers = [] } = useEngineeringData();
    const { user } = useAuth();
    const { canEdit, canDelete } = useRole();

    // Task modal state
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

    // Filters
    const [severityFilter, setSeverityFilter] = useState('all');
    const [entityFilter, setEntityFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [personFilter, setPersonFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Build a lookup: taskId -> assignedTo uid
    const taskAssigneeMap = useMemo(() => {
        const map = {};
        engTasks.forEach(t => { if (t.assignedTo) map[t.id] = t.assignedTo; });
        return map;
    }, [engTasks]);

    // Person options for the dropdown
    const personOptions = useMemo(() => {
        if (!auditResult?.findings || teamMembers.length === 0) return [];
        const personIds = new Set();
        auditResult.findings.forEach(f => {
            if (f.entityType === 'task' && f.entityId) {
                const uid = taskAssigneeMap[f.entityId];
                if (uid) personIds.add(uid);
            }
            if (f.entityType === 'user' && f.entityId) {
                personIds.add(f.entityId);
            }
        });
        return teamMembers
            .filter(m => personIds.has(m.uid))
            .sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));
    }, [auditResult, teamMembers, taskAssigneeMap]);

    // Per-person impact summary
    const personSummary = useMemo(() => {
        if (!auditResult?.findings || teamMembers.length === 0) return [];
        const summaryMap = {};
        auditResult.findings.forEach(f => {
            let uid = null;
            if (f.entityType === 'task' && f.entityId) uid = taskAssigneeMap[f.entityId];
            if (f.entityType === 'user' && f.entityId) uid = f.entityId;
            if (!uid) return;
            if (!summaryMap[uid]) {
                const member = teamMembers.find(m => m.uid === uid);
                summaryMap[uid] = {
                    uid,
                    name: member?.displayName || member?.email || uid,
                    total: 0,
                    critical: 0,
                    warning: 0,
                    info: 0,
                    scoreImpact: 0,
                };
            }
            summaryMap[uid].total++;
            if (f.severity === 'critical') summaryMap[uid].critical++;
            else if (f.severity === 'warning') summaryMap[uid].warning++;
            else summaryMap[uid].info++;
            summaryMap[uid].scoreImpact += Math.abs(f.scoreImpact || 0);
        });
        return Object.values(summaryMap).sort((a, b) => b.scoreImpact - a.scoreImpact || b.total - a.total);
    }, [auditResult, teamMembers, taskAssigneeMap]);

    // Auto-run audit when data is ready (not on mount with empty data)
    useEffect(() => {
        if (isReady && !auditResult && !isAuditing) {
            runClientAudit();
        }
    }, [isReady, auditResult, isAuditing, runClientAudit]);

    // Filtered findings
    const filteredFindings = useMemo(() => {
        if (!auditResult?.findings) return [];

        let filtered = [...auditResult.findings];

        // Severity filter
        if (severityFilter !== 'all') {
            filtered = filtered.filter(f => f.severity === severityFilter);
        }

        // Entity filter
        if (entityFilter !== 'all') {
            filtered = filtered.filter(f => f.entityType === entityFilter);
        }

        // Category filter
        if (categoryFilter !== 'all') {
            const categoryRuleIds = getRulesByCategory(categoryFilter).map(r => r.id);
            filtered = filtered.filter(f => categoryRuleIds.includes(f.ruleId));
        }

        // Person filter
        if (personFilter !== 'all') {
            filtered = filtered.filter(f => {
                if (f.entityType === 'task' && f.entityId) {
                    return taskAssigneeMap[f.entityId] === personFilter;
                }
                if (f.entityType === 'user' && f.entityId) {
                    return f.entityId === personFilter;
                }
                return false;
            });
        }

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(f =>
                f.title?.toLowerCase().includes(q) ||
                f.message?.toLowerCase().includes(q) ||
                f.ruleId?.toLowerCase().includes(q)
            );
        }

        // Sort: critical first, then warning, then info
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        filtered.sort((a, b) => (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2));

        return filtered;
    }, [auditResult, severityFilter, entityFilter, categoryFilter, personFilter, searchQuery, taskAssigneeMap]);

    // Rule statistics
    const ruleStats = useMemo(() => {
        if (!auditResult?.findings) return [];

        const statsMap = {};
        for (const f of auditResult.findings) {
            if (!statsMap[f.ruleId]) {
                const ruleMeta = RULE_CATALOG[f.ruleId];
                statsMap[f.ruleId] = {
                    ruleId: f.ruleId,
                    title: ruleMeta?.title || f.ruleId,
                    category: ruleMeta?.category || 'unknown',
                    count: 0,
                    severity: f.severity,
                };
            }
            statsMap[f.ruleId].count++;
        }

        return Object.values(statsMap).sort((a, b) => b.count - a.count);
    }, [auditResult]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Shield className="w-8 h-8 text-indigo-400" />
                        Auditoría de Cumplimiento
                    </h1>
                    <p className="text-sm font-bold text-slate-400 mt-1">
                        Motor de reglas • 18 reglas de metodología • Evaluación en tiempo real
                    </p>
                </div>
                <button
                    onClick={runClientAudit}
                    disabled={isAuditing}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-indigo-900/30"
                >
                    <RefreshCw className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
                    {isAuditing ? 'Auditando...' : 'Ejecutar Auditoría'}
                </button>
            </div>

            {/* Compliance Scores Panel */}
            <ComplianceScoresPanel
                scores={scores}
                summary={summary}
                isAuditing={isAuditing}
                onRunAudit={runClientAudit}
                findings={auditResult?.findings || []}
                tasks={engTasks} projects={engProjects} teamMembers={teamMembers}
            />

            {/* Rule Statistics Grid */}
            {ruleStats.length > 0 && (
                <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6">
                    <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400" /> Resumen por Regla
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {ruleStats.map(stat => (
                            <button
                                key={stat.ruleId}
                                onClick={() => {
                                    setSearchQuery(stat.ruleId);
                                    setSeverityFilter('all');
                                    setEntityFilter('all');
                                    setCategoryFilter('all');
                                }}
                                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-indigo-500/30 hover:bg-slate-800 transition-all text-left"
                            >
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 block truncate">{stat.title}</span>
                                </div>
                                <div className="flex items-center gap-2 ml-2 shrink-0">
                                    <FindingSeverityBadge severity={stat.severity} />
                                    <span className="text-sm font-black text-white">{stat.count}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Person Impact Summary */}
            {personSummary.length > 0 && (
                <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6">
                    <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4 text-violet-400" /> Impacto por Colaborador
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {personSummary.map(p => (
                            <button
                                key={p.uid}
                                onClick={() => {
                                    setPersonFilter(prev => prev === p.uid ? 'all' : p.uid);
                                    setSeverityFilter('all');
                                    setEntityFilter('all');
                                    setCategoryFilter('all');
                                    setSearchQuery('');
                                }}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                                    personFilter === p.uid
                                        ? 'bg-violet-500/15 border-violet-500/40 ring-1 ring-violet-500/30'
                                        : 'bg-slate-800/50 border-slate-700/50 hover:border-violet-500/30 hover:bg-slate-800'
                                }`}
                            >
                                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                                    <User className="w-4 h-4 text-violet-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-[11px] font-bold text-slate-200 block truncate">{p.name}</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        {p.critical > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">{p.critical} crít</span>}
                                        {p.warning > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">{p.warning} adv</span>}
                                        {p.info > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">{p.info} info</span>}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-sm font-black text-white block">{p.total}</span>
                                    <span className="text-[9px] font-bold text-rose-400">-{p.scoreImpact}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar hallazgos..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <select
                    value={personFilter}
                    onChange={(e) => setPersonFilter(e.target.value)}
                    className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                >
                    <option value="all">Todas las personas</option>
                    {personOptions.map(m => (
                        <option key={m.uid} value={m.uid}>{m.displayName || m.email}</option>
                    ))}
                </select>

                <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                >
                    {SEVERITY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                <select
                    value={entityFilter}
                    onChange={(e) => setEntityFilter(e.target.value)}
                    className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                >
                    {ENTITY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                >
                    {CATEGORY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

            {/* Results Count */}
            {auditResult && (
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                        {filteredFindings.length} de {auditResult.findings.length} hallazgos
                    </span>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                        >
                            Limpiar búsqueda
                        </button>
                    )}
                </div>
            )}

            {/* Findings List */}
            <FindingCardList
                findings={filteredFindings}
                emptyMessage={auditResult ? 'No se encontraron hallazgos con los filtros seleccionados' : 'Ejecuta una auditoría para ver hallazgos'}
                maxItems={100}
                onOpenTask={handleOpenTask}
                tasks={engTasks}
                projects={engProjects}
                teamMembers={teamMembers}
            />

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

            {/* Data Snapshot Footer */}
            {auditResult?.dataSnapshot && (
                <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
                    <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <span>🔍 {auditResult.dataSnapshot.totalTasks} Tareas evaluadas</span>
                        <span>•</span>
                        <span>📂 {auditResult.dataSnapshot.totalProjects} Proyectos</span>
                        <span>•</span>
                        <span>👥 {auditResult.dataSnapshot.totalUsers} Usuarios</span>
                        <span>•</span>
                        <span>🕐 Auditoría: {new Date(auditResult.auditedAt).toLocaleString('es-MX')}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
