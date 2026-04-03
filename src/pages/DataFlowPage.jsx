import React, { useState } from 'react';
import {
    Database, ArrowRight, Timer, FileText, CheckSquare, AlertTriangle,
    FolderGit2, Users, Settings, ChevronDown, ChevronUp, Info,
    Zap, Shield, Eye, EyeOff, Layers, GitBranch, Clock,
    BarChart3, PieChart, TrendingUp, List, Activity
} from 'lucide-react';

// ===========================
// DATA ARCHITECTURE
// ===========================
const COLLECTIONS = [
    {
        id: 'timeLogs',
        name: 'timeLogs',
        icon: Timer,
        color: '#f59e0b',
        badge: '✅ Fuente de Verdad — Horas',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        description: 'Registros de tiempo: timers automáticos, entradas manuales, y auto-cierre nocturno.',
        fields: ['taskId', 'projectId', 'userId', 'startTime', 'endTime', 'totalHours', 'displayName', 'isManual'],
        writtenBy: ['Timer (auto)', 'Entrada manual', 'Auto-cierre nocturno'],
        usedBy: ['Proyección de Horas', 'KPI Horas', 'Correlación', 'Timeline (Sesiones)', 'Trend Chart', 'Reporte Diario/Semanal'],
        rules: [
            { type: 'do', text: 'SIEMPRE usar para calcular horas trabajadas' },
            { type: 'do', text: 'Incluye TODAS las fuentes de tiempo (auto + manual)' },
            { type: 'dont', text: 'No confundir con activityLog timer events' },
        ],
    },
    {
        id: 'activityLog',
        name: 'activityLog',
        icon: Activity,
        color: '#6366f1',
        badge: '✅ Fuente de Verdad — Eventos',
        badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        description: 'Sub-colección de cada tarea. Registra eventos discretos: subtareas, cambios de estado, etc.',
        fields: ['type', 'description', 'timestamp', 'userId', 'userName', 'meta'],
        writtenBy: ['Completar subtarea', 'Cambiar estado', 'Timer start/stop (legacy)', 'Reportar retraso'],
        usedBy: ['Timeline (eventos)', 'Pie chart', 'Top tareas', 'Progreso %', 'Línea de Vida'],
        rules: [
            { type: 'do', text: 'Usar para eventos: subtareas, status, progreso' },
            { type: 'do', text: 'Confiable para % de avance (meta.percentComplete)' },
            { type: 'dont', text: 'NUNCA usar timer_started/stopped para calcular horas' },
            { type: 'warn', text: 'timer events solo existen desde que se implementó logging' },
        ],
    },
    {
        id: 'tasks',
        name: 'tasks',
        icon: CheckSquare,
        color: '#22c55e',
        badge: 'Entidad principal',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        description: 'Tareas de ingeniería con estado, asignación, fechas planeadas y horas estimadas.',
        fields: ['title', 'status', 'priority', 'assigneeId', 'projectId', 'estimatedHours', 'actualHours', 'plannedStartDate', 'plannedEndDate', 'dueDate'],
        writtenBy: ['Editor de tarea', 'Cambio de estado', 'Timer stop (recalcula actualHours)'],
        usedBy: ['Task Manager', 'Gráficos de proyección', 'KPIs', 'Gantt', 'Planner'],
        rules: [
            { type: 'do', text: 'Usar estimatedHours, plannedStartDate, plannedEndDate para proyecciones' },
            { type: 'warn', text: 'actualHours es CACHE derivado — puede desincronizarse' },
            { type: 'do', text: 'Siempre verificar horas contra timeLogs directamente' },
        ],
    },
    {
        id: 'subtasks',
        name: 'subtasks',
        icon: List,
        color: '#06b6d4',
        badge: 'Sub-entidad',
        badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
        description: 'Ítems de checklist dentro de cada tarea. Al completarse generan eventos en activityLog.',
        fields: ['title', 'completed', 'taskId', 'order'],
        writtenBy: ['UI (crear/completar/eliminar subtarea)'],
        usedBy: ['Task Manager', 'Progreso %', 'KPI subtareas'],
        rules: [
            { type: 'do', text: 'Cada toggle genera un evento en activityLog con percentComplete' },
        ],
    },
    {
        id: 'projects',
        name: 'projects',
        icon: FolderGit2,
        color: '#3b82f6',
        badge: 'Entidad raíz',
        badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        description: 'Proyectos de ingeniería. Agrupa tareas, timeLogs y recursos.',
        fields: ['name', 'status', 'client', 'startDate', 'endDate', 'createdAt'],
        writtenBy: ['UI (crear/editar proyecto)'],
        usedBy: ['Dashboard', 'Task Manager', 'Gantt', 'Filtros globales'],
        rules: [],
    },
    {
        id: 'users',
        name: 'users',
        icon: Users,
        color: '#8b5cf6',
        badge: 'Perfiles de equipo',
        badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
        description: 'Perfiles operacionales del equipo: rol, nombre, capacidad.',
        fields: ['displayName', 'email', 'teamRole', 'weeklyCapacity', 'photoURL'],
        writtenBy: ['Admin (UserAdminPanel)', 'Perfil de usuario'],
        usedBy: ['Sidebar', 'Asignaciones', 'Daily Scrum', 'Filtros'],
        rules: [],
    },
    {
        id: 'config',
        name: 'taskTypes / workAreaTypes / milestoneTypes',
        icon: Settings,
        color: '#64748b',
        badge: 'Configuración',
        badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        description: 'Listas configurables para clasificar tareas, áreas y milestones.',
        fields: ['name', 'color', 'icon', 'order'],
        writtenBy: ['Admin (Settings)'],
        usedBy: ['Task Manager', 'Filtros', 'Analytics'],
        rules: [],
    },
    {
        id: 'delays',
        name: 'delays / delayCauses',
        icon: AlertTriangle,
        color: '#ef4444',
        badge: 'Gestión de riesgos',
        badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30',
        description: 'Registro de retrasos y causas predefinidas para análisis de riesgo.',
        fields: ['taskId', 'causeId', 'description', 'severity', 'reportedAt'],
        writtenBy: ['UI (reportar retraso)', 'Admin (causas)'],
        usedBy: ['Control Tower', 'Analytics', 'Task Detail'],
        rules: [],
    },
];

const TIMER_STEPS = [
    { step: 1, action: 'Usuario presiona ▶️ Play', icon: '▶️', target: 'activeTimers/{userId}', detail: 'Se crea documento temporal con taskId, startTime', color: '#22c55e' },
    { step: 2, action: 'Se registra evento', icon: '📝', target: 'activityLog', detail: 'Evento timer_started (solo referencia, NO para horas)', color: '#6366f1' },
    { step: 3, action: 'Usuario presiona ⏹️ Stop', icon: '⏹️', target: 'Cálculo', detail: 'Se calcula duración = endTime - startTime', color: '#f59e0b' },
    { step: 4, action: 'Se guarda registro de tiempo', icon: '💾', target: 'timeLogs ← FUENTE DE VERDAD', detail: 'totalHours, startTime, endTime, userId, taskId', color: '#f59e0b', highlight: true },
    { step: 5, action: 'Se actualiza cache', icon: '🔄', target: 'tasks.actualHours', detail: 'recalculateTaskHours() suma todos los timeLogs de la tarea', color: '#64748b' },
    { step: 6, action: 'Se limpia timer activo', icon: '🗑️', target: 'activeTimers/{userId}', detail: 'Se elimina el documento temporal', color: '#64748b' },
];

const PAGE_MATRIX = [
    { page: 'Dashboard', timeLogs: true, activityLog: false, tasks: true, subtasks: false, projects: true, users: true },
    { page: 'Mi Trabajo', timeLogs: true, activityLog: false, tasks: true, subtasks: true, projects: true, users: false },
    { page: 'Task Manager', timeLogs: true, activityLog: true, tasks: true, subtasks: true, projects: true, users: true },
    { page: 'Registro Horas', timeLogs: true, activityLog: false, tasks: true, subtasks: false, projects: true, users: true },
    { page: 'Actividad', timeLogs: true, activityLog: true, tasks: true, subtasks: false, projects: true, users: true },
    { page: 'Analítica', timeLogs: true, activityLog: false, tasks: true, subtasks: true, projects: true, users: true },
    { page: 'Reporte Diario', timeLogs: true, activityLog: false, tasks: true, subtasks: false, projects: true, users: true },
    { page: 'Reporte Semanal', timeLogs: true, activityLog: false, tasks: true, subtasks: false, projects: true, users: true },
    { page: 'Daily Scrum', timeLogs: true, activityLog: false, tasks: true, subtasks: true, projects: true, users: true },
    { page: 'Gantt', timeLogs: false, activityLog: false, tasks: true, subtasks: false, projects: true, users: false },
    { page: 'Control Tower', timeLogs: true, activityLog: false, tasks: true, subtasks: false, projects: true, users: true },
    { page: 'Planner', timeLogs: false, activityLog: false, tasks: true, subtasks: false, projects: true, users: true },
];

const RULES = [
    { type: 'do', icon: '✅', title: 'timeLogs = Fuente de Verdad para Horas', desc: 'Siempre calcular horas reales sumando timeLogs.totalHours. Incluye timers automáticos, entradas manuales y auto-cierre.' },
    { type: 'do', icon: '✅', title: 'activityLog = Fuente de Verdad para Eventos', desc: 'Subtareas completadas, cambios de estado, reportes de retraso. Confiable para lo que SÍ registra.' },
    { type: 'dont', icon: '🚫', title: 'NUNCA usar activityLog para calcular horas', desc: 'Los eventos timer_started/stopped son incompletos: no incluyen entradas manuales ni registros anteriores al logging.' },
    { type: 'warn', icon: '⚠️', title: 'task.actualHours es CACHE', desc: 'Se recalcula al detener un timer, pero puede desincronizarse si se edita un timeLog manualmente.' },
    { type: 'do', icon: '✅', title: 'useEngineeringData() = Hook central', desc: '10 suscripciones Firestore en tiempo real. Todas las páginas lo usan como origen de datos.' },
];

// ===========================
// COMPONENTS
// ===========================

function CollectionCard({ col, isExpanded, onToggle }) {
    const Icon = col.icon;
    return (
        <div
            className={`rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
                isExpanded
                    ? 'border-opacity-60 shadow-lg shadow-black/20 scale-[1.01]'
                    : 'border-opacity-20 hover:border-opacity-40 hover:shadow-md hover:shadow-black/10'
            }`}
            style={{ borderColor: col.color, background: isExpanded ? `${col.color}08` : 'transparent' }}
            onClick={onToggle}
        >
            <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${col.color}20` }}>
                            <Icon className="w-5 h-5" style={{ color: col.color }} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-100 text-sm font-mono">{col.name}</h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${col.badgeColor}`}>
                                {col.badge}
                            </span>
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">{col.description}</p>
            </div>

            {isExpanded && (
                <div className="px-5 pb-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Fields */}
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Campos clave</p>
                        <div className="flex flex-wrap gap-1.5">
                            {col.fields.map(f => (
                                <code key={f} className="text-[10px] px-2 py-0.5 bg-slate-800 rounded text-slate-300 font-mono border border-slate-700">{f}</code>
                            ))}
                        </div>
                    </div>
                    {/* Written by */}
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Escrito por</p>
                        <div className="space-y-1">
                            {col.writtenBy.map(w => (
                                <div key={w} className="flex items-center gap-2 text-xs text-slate-300">
                                    <ArrowRight className="w-3 h-3 text-emerald-400 shrink-0" />{w}
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Used by */}
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Usado en</p>
                        <div className="flex flex-wrap gap-1.5">
                            {col.usedBy.map(u => (
                                <span key={u} className="text-[10px] px-2 py-0.5 bg-slate-800/60 rounded-full text-slate-300 border border-slate-700/50">{u}</span>
                            ))}
                        </div>
                    </div>
                    {/* Rules */}
                    {col.rules.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Reglas</p>
                            <div className="space-y-1.5">
                                {col.rules.map((r, i) => (
                                    <div key={i} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
                                        r.type === 'do' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' :
                                        r.type === 'dont' ? 'bg-red-500/10 text-red-300 border border-red-500/20' :
                                        'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                    }`}>
                                        <span className="shrink-0 mt-0.5">{r.type === 'do' ? '✅' : r.type === 'dont' ? '🚫' : '⚠️'}</span>
                                        <span>{r.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function FlowDiagram({ activeNode, onNodeClick }) {
    const nodes = [
        { id: 'actions', label: 'Acciones del Usuario', items: ['▶️ Timer', '⏹️ Stop', '📝 Manual', '✅ Subtarea', '🔄 Status'], x: 50, y: 0, w: 400, color: '#6366f1' },
        { id: 'timeLogs', label: 'timeLogs', subtitle: '✅ Fuente de Verdad — Horas', items: ['totalHours', 'startTime', 'endTime', 'userId'], x: 20, y: 140, w: 200, color: '#f59e0b' },
        { id: 'activityLog', label: 'activityLog', subtitle: '✅ Fuente de Verdad — Eventos', items: ['subtask_*', 'status_changed', 'delay_reported'], x: 280, y: 140, w: 200, color: '#6366f1' },
        { id: 'charts-hours', label: 'Gráficos de Horas', items: ['📊 Proyección', '📈 Correlación', '📋 KPI Horas', '📉 Trend'], x: 20, y: 300, w: 200, color: '#f59e0b' },
        { id: 'charts-events', label: 'Gráficos de Eventos', items: ['📋 Timeline', '🥧 Pie chart', '🏆 Top Tareas', '📈 Progreso %'], x: 280, y: 300, w: 200, color: '#6366f1' },
    ];

    return (
        <div className="relative w-full max-w-xl mx-auto" style={{ minHeight: 420 }}>
            {/* Connection lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 500 420">
                {/* Actions → timeLogs */}
                <line x1="150" y1="70" x2="120" y2="140" stroke="#f59e0b" strokeWidth="2" strokeDasharray="6 3" opacity="0.5">
                    <animate attributeName="stroke-dashoffset" values="0;-18" dur="1.5s" repeatCount="indefinite" />
                </line>
                {/* Actions → activityLog */}
                <line x1="350" y1="70" x2="380" y2="140" stroke="#6366f1" strokeWidth="2" strokeDasharray="6 3" opacity="0.5">
                    <animate attributeName="stroke-dashoffset" values="0;-18" dur="1.5s" repeatCount="indefinite" />
                </line>
                {/* timeLogs → charts-hours */}
                <line x1="120" y1="220" x2="120" y2="300" stroke="#f59e0b" strokeWidth="2" strokeDasharray="6 3" opacity="0.5">
                    <animate attributeName="stroke-dashoffset" values="0;-18" dur="1.5s" repeatCount="indefinite" />
                </line>
                {/* activityLog → charts-events */}
                <line x1="380" y1="220" x2="380" y2="300" stroke="#6366f1" strokeWidth="2" strokeDasharray="6 3" opacity="0.5">
                    <animate attributeName="stroke-dashoffset" values="0;-18" dur="1.5s" repeatCount="indefinite" />
                </line>
                {/* Cross: timeLogs → charts-events (work_session) */}
                <line x1="180" y1="200" x2="300" y2="300" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.3">
                    <animate attributeName="stroke-dashoffset" values="0;-16" dur="2s" repeatCount="indefinite" />
                </line>
            </svg>

            {/* Nodes */}
            {nodes.map(node => (
                <div
                    key={node.id}
                    className={`absolute rounded-xl border-2 p-3 cursor-pointer transition-all duration-300 ${
                        activeNode === node.id
                            ? 'scale-105 shadow-lg z-10'
                            : 'hover:scale-[1.02] hover:shadow-md'
                    }`}
                    style={{
                        left: node.x, top: node.y, width: node.w,
                        borderColor: activeNode === node.id ? node.color : `${node.color}40`,
                        background: activeNode === node.id ? `${node.color}15` : '#0f172a',
                        boxShadow: activeNode === node.id ? `0 0 20px ${node.color}20` : 'none',
                    }}
                    onClick={() => onNodeClick(node.id === activeNode ? null : node.id)}
                >
                    <p className="font-bold text-xs text-slate-100">{node.label}</p>
                    {node.subtitle && <p className="text-[9px] font-bold mt-0.5" style={{ color: node.color }}>{node.subtitle}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                        {node.items.map(item => (
                            <span key={item} className="text-[9px] px-1.5 py-0.5 bg-slate-800/80 rounded text-slate-400">{item}</span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ===========================
// MAIN PAGE
// ===========================
export default function DataFlowPage() {
    const [expandedCard, setExpandedCard] = useState(null);
    const [activeFlowNode, setActiveFlowNode] = useState(null);
    const [activeTimerStep, setActiveTimerStep] = useState(null);
    const [showAllPages, setShowAllPages] = useState(false);

    const visiblePages = showAllPages ? PAGE_MATRIX : PAGE_MATRIX.slice(0, 6);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            {/* ═══════ HERO ═══════ */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-transparent to-amber-500/10" />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 30% 20%, rgba(99,102,241,0.08) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(245,158,11,0.08) 0%, transparent 50%)' }} />
                <div className="relative max-w-5xl mx-auto px-6 py-16 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50 mb-6">
                        <Database className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-bold text-slate-300">Arquitectura de Datos</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">v2.0</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-indigo-400 via-purple-300 to-amber-400 bg-clip-text text-transparent leading-tight">
                        ¿De Dónde Vienen los Datos?
                    </h1>
                    <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-base leading-relaxed">
                        Guía visual interactiva del flujo de datos del sistema.
                        Entiende qué colección alimenta cada gráfico y cuáles son las reglas clave.
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-6">
                        {[
                            { label: 'Firestore', icon: Zap, color: 'text-amber-400' },
                            { label: 'Tiempo Real', icon: Activity, color: 'text-emerald-400' },
                            { label: '10 Colecciones', icon: Layers, color: 'text-indigo-400' },
                            { label: 'RBAC', icon: Shield, color: 'text-violet-400' },
                        ].map(b => (
                            <div key={b.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/40 border border-slate-700/30">
                                <b.icon className={`w-3.5 h-3.5 ${b.color}`} />
                                <span className="text-[10px] font-bold text-slate-300">{b.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 pb-20 space-y-16">

                {/* ═══════ SECTION 2: FLOW DIAGRAM ═══════ */}
                <section>
                    <SectionHeader
                        icon={GitBranch}
                        title="Flujo Principal de Datos"
                        subtitle="Click en cada nodo para ver detalles. Las líneas animadas muestran la dirección del flujo."
                        color="#6366f1"
                    />
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 mt-6">
                        <FlowDiagram activeNode={activeFlowNode} onNodeClick={setActiveFlowNode} />
                        {activeFlowNode && (
                            <div className="mt-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 animate-in fade-in duration-300">
                                <div className="flex items-center gap-2 mb-2">
                                    <Info className="w-4 h-4 text-indigo-400" />
                                    <span className="text-xs font-bold text-slate-200">
                                        {activeFlowNode === 'actions' && 'Las acciones del usuario generan datos en distintas colecciones'}
                                        {activeFlowNode === 'timeLogs' && 'timeLogs recibe TODAS las horas: timer auto, manual, auto-cierre'}
                                        {activeFlowNode === 'activityLog' && 'activityLog registra eventos discretos, NO es fuente de horas'}
                                        {activeFlowNode === 'charts-hours' && 'Todos los gráficos de horas leen exclusivamente de timeLogs'}
                                        {activeFlowNode === 'charts-events' && 'Gráficos de eventos usan activityLog + work_sessions inyectadas de timeLogs'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* ═══════ SECTION 3: GOLDEN RULES ═══════ */}
                <section>
                    <SectionHeader
                        icon={Shield}
                        title="Reglas de Oro"
                        subtitle="Las 5 reglas que todo desarrollador debe conocer."
                        color="#22c55e"
                    />
                    <div className="grid gap-3 mt-6">
                        {RULES.map((rule, i) => (
                            <div
                                key={i}
                                className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 hover:scale-[1.005] ${
                                    rule.type === 'do' ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40' :
                                    rule.type === 'dont' ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40' :
                                    'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                                }`}
                            >
                                <span className="text-2xl shrink-0">{rule.icon}</span>
                                <div>
                                    <p className={`text-sm font-bold ${
                                        rule.type === 'do' ? 'text-emerald-300' : rule.type === 'dont' ? 'text-red-300' : 'text-amber-300'
                                    }`}>{rule.title}</p>
                                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{rule.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ═══════ SECTION 4: COLLECTION CARDS ═══════ */}
                <section>
                    <SectionHeader
                        icon={Database}
                        title="Colecciones de Firestore"
                        subtitle="Click en cada card para expandir detalles: campos, reglas, y quién la usa."
                        color="#f59e0b"
                    />
                    <div className="grid md:grid-cols-2 gap-4 mt-6">
                        {COLLECTIONS.map(col => (
                            <CollectionCard
                                key={col.id}
                                col={col}
                                isExpanded={expandedCard === col.id}
                                onToggle={() => setExpandedCard(expandedCard === col.id ? null : col.id)}
                            />
                        ))}
                    </div>
                </section>

                {/* ═══════ SECTION 5: TIMER FLOW ═══════ */}
                <section>
                    <SectionHeader
                        icon={Clock}
                        title="Flujo del Timer — Paso a Paso"
                        subtitle="¿Qué pasa cuando un usuario inicia y detiene un timer?"
                        color="#f59e0b"
                    />
                    <div className="mt-6 space-y-3">
                        {TIMER_STEPS.map((step, i) => (
                            <div
                                key={i}
                                className={`flex items-stretch gap-4 cursor-pointer transition-all duration-300 ${
                                    activeTimerStep === i ? 'scale-[1.01]' : 'hover:scale-[1.005]'
                                }`}
                                onClick={() => setActiveTimerStep(activeTimerStep === i ? null : i)}
                            >
                                {/* Step number + line */}
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 border-2 transition-all ${
                                            step.highlight ? 'animate-pulse' : ''
                                        }`}
                                        style={{
                                            borderColor: activeTimerStep === i ? step.color : `${step.color}40`,
                                            background: activeTimerStep === i ? `${step.color}20` : 'transparent',
                                            color: step.color,
                                        }}
                                    >
                                        {step.step}
                                    </div>
                                    {i < TIMER_STEPS.length - 1 && (
                                        <div className="w-0.5 flex-1 min-h-[12px] bg-slate-700/50" />
                                    )}
                                </div>
                                {/* Content */}
                                <div className={`flex-1 rounded-xl border p-4 mb-1 transition-all ${
                                    step.highlight
                                        ? 'bg-amber-500/10 border-amber-500/30 shadow-md shadow-amber-500/5'
                                        : activeTimerStep === i
                                            ? 'bg-slate-800/60 border-slate-600'
                                            : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                                }`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">{step.icon}</span>
                                        <span className="text-sm font-bold text-slate-100">{step.action}</span>
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <code className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                            step.highlight ? 'bg-amber-500/20 text-amber-300 font-bold' : 'bg-slate-800 text-slate-400'
                                        }`}>
                                            → {step.target}
                                        </code>
                                    </div>
                                    {activeTimerStep === i && (
                                        <p className="text-xs text-slate-400 mt-2 animate-in fade-in duration-200">{step.detail}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ═══════ SECTION 6: PAGE × DATA MATRIX ═══════ */}
                <section>
                    <SectionHeader
                        icon={BarChart3}
                        title="¿Qué Datos Usa Cada Página?"
                        subtitle="Matriz de dependencias: qué colecciones consume cada vista."
                        color="#3b82f6"
                    />
                    <div className="mt-6 rounded-2xl border border-slate-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-900/80">
                                        <th className="py-3 px-4 text-left font-bold text-slate-300">Página</th>
                                        <th className="py-3 px-3 text-center font-bold text-amber-400">timeLogs</th>
                                        <th className="py-3 px-3 text-center font-bold text-indigo-400">activityLog</th>
                                        <th className="py-3 px-3 text-center font-bold text-emerald-400">tasks</th>
                                        <th className="py-3 px-3 text-center font-bold text-cyan-400">subtasks</th>
                                        <th className="py-3 px-3 text-center font-bold text-blue-400">projects</th>
                                        <th className="py-3 px-3 text-center font-bold text-violet-400">users</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visiblePages.map((row, i) => (
                                        <tr key={i} className={`border-t border-slate-800/50 ${i % 2 === 0 ? 'bg-slate-900/30' : ''} hover:bg-slate-800/30 transition-colors`}>
                                            <td className="py-2.5 px-4 font-bold text-slate-200">{row.page}</td>
                                            {['timeLogs', 'activityLog', 'tasks', 'subtasks', 'projects', 'users'].map(col => (
                                                <td key={col} className="py-2.5 px-3 text-center">
                                                    {row[col]
                                                        ? <span className="text-emerald-400 font-bold">●</span>
                                                        : <span className="text-slate-700">—</span>
                                                    }
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {PAGE_MATRIX.length > 6 && (
                            <div className="p-3 border-t border-slate-800/50 text-center">
                                <button
                                    onClick={() => setShowAllPages(!showAllPages)}
                                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 mx-auto"
                                >
                                    {showAllPages ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    {showAllPages ? 'Mostrar menos' : `Ver todas (${PAGE_MATRIX.length} páginas)`}
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* ═══════ FOOTER ═══════ */}
                <div className="text-center pt-8 border-t border-slate-800/50">
                    <p className="text-xs text-slate-600">
                        Documentación generada automáticamente • Última actualización: Abril 2026
                    </p>
                </div>
            </div>
        </div>
    );
}

function SectionHeader({ icon: Icon, title, subtitle, color }) {
    return (
        <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}15` }}>
                <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
                <h2 className="text-xl font-black text-slate-100">{title}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            </div>
        </div>
    );
}
