import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Shield, Filter, Download, RefreshCw, Search, ChevronDown } from 'lucide-react';
import { useAuditData } from '../hooks/useAuditData';
import { useAppData } from '../contexts/AppDataContext';
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
    } = useAuditData();

    const { engTasks = [], engProjects = [], engSubtasks = [], taskTypes = [], teamMembers = [] } = useAppData();

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
    const [searchQuery, setSearchQuery] = useState('');

    // Auto-run audit on first load
    useEffect(() => {
        if (!auditResult && !isAuditing) {
            runClientAudit();
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    }, [auditResult, severityFilter, entityFilter, categoryFilter, searchQuery]);

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
