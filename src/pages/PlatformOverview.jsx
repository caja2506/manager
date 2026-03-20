import React, { useState, useEffect, useRef, useCallback } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useNavigate } from 'react-router-dom';
import {
    BrainCircuit, LayoutDashboard, ListTodo, Clock, BarChart3, Users,
    FolderGit2, CalendarDays, GanttChartSquare, Shield, Radar, FileText,
    Zap, Target, ArrowRight, CheckCircle, TrendingUp, AlertTriangle,
    Play, Eye, Briefcase, Database, ChevronDown, Workflow, Star,
    Layers, ArrowDown, Sparkles, Timer, Award, LineChart,
    MessageCircle, Send, Bot, Bell
} from 'lucide-react';

// ─── Hook: Intersection Observer para animaciones por scroll ───
function useScrollReveal(options = {}) {
    const ref = useRef(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.unobserve(el);
                }
            },
            { threshold: 0.15, rootMargin: '0px 0px -50px 0px', ...options }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return [ref, isVisible];
}

// ─── Hook: Contador animado ───
function useCountUp(end, duration = 2000, start = false) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!start) return;
        let startTime = null;
        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            setValue(Math.floor(progress * end));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [start, end, duration]);
    return value;
}

// ─── Datos: Metodologías ───
const METHODOLOGIES = [
    {
        id: 'kanban',
        title: 'Kanban',
        subtitle: 'Flujo Continuo',
        icon: Layers,
        color: 'indigo',
        description: 'Visualiza todo tu trabajo en un tablero con columnas de estado. Controla el flujo de tareas y elimina cuellos de botella.',
        features: ['Tablero visual', 'Límites de WIP', 'Flujo continuo', 'Métricas de rendimiento'],
    },
    {
        id: 'scrumban',
        title: 'Scrumban Semanal',
        subtitle: 'Planificación Iterativa',
        icon: CalendarDays,
        color: 'violet',
        description: 'Planifica cada semana con reuniones de lunes. Asigna tareas, revisa prioridades y ajusta la carga del equipo.',
        features: ['Sprint semanal', 'Reunión de lunes', 'Planificación por capacidad', 'Revisión continua'],
    },
    {
        id: 'lean',
        title: 'Lean Engineering',
        subtitle: 'Eliminación de Desperdicios',
        icon: Target,
        color: 'emerald',
        description: 'Identifica retrasos, causas raíz y riesgos automáticamente. Reduce tiempos muertos y maximiza valor.',
        features: ['Detección de riesgos', 'Análisis de retrasos', 'Mejora continua', 'Eficiencia operativa'],
    },
    {
        id: 'obeya',
        title: 'Sala Obeya Digital',
        subtitle: 'Visibilidad Total',
        icon: LayoutDashboard,
        color: 'amber',
        description: 'Un dashboard estilo Obeya con KPIs en vivo, salud de proyectos, carga del equipo y alertas críticas.',
        features: ['KPIs en tiempo real', 'Salud de proyectos', 'Carga del equipo', 'Alertas automáticas'],
    },
];

// ─── Datos: Flujo de Trabajo ───
const WORKFLOW_STEPS = [
    { status: 'Backlog', label: 'Backlog', color: 'slate', icon: Database, desc: 'Todo el trabajo pendiente por priorizar' },
    { status: 'Planificado', label: 'Planificado', color: 'blue', icon: CalendarDays, desc: 'Tareas asignadas y programadas para la semana' },
    { status: 'En Progreso', label: 'En Progreso', color: 'indigo', icon: Play, desc: 'Trabajo activo con timer de horas en tiempo real' },
    { status: 'En Revisión', label: 'En Revisión', color: 'amber', icon: Eye, desc: 'Validación por el ingeniero responsable' },
    { status: 'Completado', label: 'Completado', color: 'emerald', icon: CheckCircle, desc: 'Tarea terminada y registrada en métricas' },
];

// ─── Datos: Módulos ───
const MODULES = [
    { id: 'dashboard', title: 'Dashboard Obeya', desc: 'KPIs en vivo, salud de proyectos, alertas críticas y carga del equipo', icon: LayoutDashboard, color: 'indigo', path: '/' },
    { id: 'tasks', title: 'Gestión de Tareas', desc: 'Tablero Kanban, detalle de tarea, subtareas y transiciones de estado', icon: ListTodo, color: 'violet', path: '/tasks' },
    { id: 'planner', title: 'Weekly Planner', desc: 'Planificación semanal drag-and-drop por ingeniero y capacidad', icon: CalendarDays, color: 'blue', path: '/planner' },
    { id: 'gantt', title: 'Project Gantt', desc: 'Vista Gantt con dependencias, milestones y vista semanal/mensual', icon: GanttChartSquare, color: 'cyan', path: '/gantt' },
    { id: 'time', title: 'Time Tracking', desc: 'Timer integrado, registro de horas, overtime y bitácora de trabajo', icon: Clock, color: 'amber', path: '/work-logs' },
    { id: 'analytics', title: 'Analítica', desc: 'Métricas de rendimiento, tendencias, velocidad y forecasting', icon: LineChart, color: 'emerald', path: '/analytics' },
    { id: 'control', title: 'Control Tower', desc: 'Centro de comando ejecutivo con motor de reglas e insights de IA', icon: Radar, color: 'rose', path: '/control-tower' },
    { id: 'audit', title: 'Auditoría', desc: 'Evaluación de cumplimiento, hallazgos y scoring automático', icon: Shield, color: 'orange', path: '/audit' },
    { id: 'projects', title: 'Proyectos', desc: 'Gestión de proyectos de ingeniería con riesgo, progreso y equipo', icon: Briefcase, color: 'purple', path: '/projects' },
    { id: 'reports', title: 'Reportes', desc: 'Reportes diarios y semanales autogenerados con exportación a Excel', icon: FileText, color: 'teal', path: '/reports/daily' },
    { id: 'team', title: 'Equipo', desc: 'Vista general del equipo, roles, capacidad y métricas individuales', icon: Users, color: 'sky', path: '/team' },
    { id: 'bom', title: 'AutoBOM', desc: 'Gestión de BOM con catálogo maestro, importación AI de PDF y Excel', icon: Database, color: 'slate', path: '/bom/projects' },
];

// ─── Datos: Telegram ───
const TELEGRAM_FEATURES = [
    {
        icon: FileText,
        title: 'Reportes Rápidos',
        desc: 'Recibe un resumen diario de tu trabajo, horas registradas, tareas completadas y overtime directamente en Telegram.',
        color: 'blue',
    },
    {
        icon: Bell,
        title: 'Alertas Automáticas',
        desc: 'Notificaciones instantáneas cuando se detectan retrasos, tareas bloqueadas o riesgos en tus proyectos.',
        color: 'amber',
    },
    {
        icon: Clock,
        title: 'Log de Horas por Chat',
        desc: 'Registra tus horas trabajadas y overtime enviando un simple mensaje al bot, sin abrir la app.',
        color: 'emerald',
    },
    {
        icon: AlertTriangle,
        title: 'Escalaciones',
        desc: 'Alertas de escalación automática al Manager o Team Lead cuando se cumplen reglas críticas del motor de reglas.',
        color: 'rose',
    },
    {
        icon: CalendarDays,
        title: 'Digest Programado',
        desc: 'Resúmenes semanales y briefs ejecutivos generados por IA, entregados automáticamente cada lunes.',
        color: 'violet',
    },
    {
        icon: Users,
        title: 'Linking de Usuarios',
        desc: 'Vincula tu cuenta de Telegram con la plataforma mediante un código seguro para recibir reportes personalizados.',
        color: 'indigo',
    },
];

const TELEGRAM_FLOW = [
    { label: 'Plataforma', icon: BrainCircuit, desc: 'Genera datos, métricas y alertas', color: 'indigo' },
    { label: 'Motor de Automatización', icon: Zap, desc: 'Evalúa reglas y programa entregas', color: 'violet' },
    { label: 'Bot Telegram', icon: Bot, desc: 'Formatea y entrega mensajes', color: 'blue' },
    { label: 'Tu Chat', icon: MessageCircle, desc: 'Recibes reportes y notificaciones', color: 'emerald' },
];

// ─── Datos: Beneficios ───
const BENEFITS = [
    { icon: TrendingUp, title: 'Visibilidad Total', desc: 'Toda la operación de ingeniería en un solo lugar, en tiempo real', stat: '100', suffix: '%', color: 'indigo' },
    { icon: Timer, title: 'Ahorro de Tiempo', desc: 'Reportes automáticos, timer integrado y métricas sin esfuerzo manual', stat: '40', suffix: '%', color: 'emerald' },
    { icon: AlertTriangle, title: 'Detección Temprana', desc: 'Riesgos y retrasos identificados automáticamente antes de que escalen', stat: '3', suffix: 'x', color: 'amber' },
    { icon: Award, title: 'Mejora Continua', desc: 'Auditoría automática y scoring de compliance para mejora iterativa', stat: '95', suffix: '%', color: 'violet' },
];

// ─── Datos: Roles ───
const ROLES = [
    { role: 'Manager', desc: 'Ve dashboard, reportes y analítica. Visión ejecutiva del departamento.', capabilities: ['Dashboard', 'Reportes', 'Analítica', 'Control Tower'], color: 'amber', icon: Star },
    { role: 'Team Lead', desc: 'Gestión completa de tareas, equipo, overtime y supervisión.', capabilities: ['Todo de Manager', 'Tareas', 'Planner', 'Overtime'], color: 'indigo', icon: Shield },
    { role: 'Ingeniero', desc: 'Gestión de tareas, time tracking, validación y completar trabajo.', capabilities: ['Tareas', 'Time Tracking', 'Validación', 'Subtareas'], color: 'emerald', icon: Briefcase },
    { role: 'Técnico', desc: 'Actualizar tareas hasta Validación, registrar tiempo y overtime.', capabilities: ['Actualizar Tareas', 'Time Tracking', 'Overtime', 'Reportar Delays'], color: 'violet', icon: Zap },
];

// ─── Color helpers ───
const colorMap = {
    indigo: { bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', text: 'text-indigo-400', glow: 'shadow-indigo-500/20', solid: 'bg-indigo-600', gradient: 'from-indigo-600 to-indigo-400' },
    violet: { bg: 'bg-violet-500/15', border: 'border-violet-500/30', text: 'text-violet-400', glow: 'shadow-violet-500/20', solid: 'bg-violet-600', gradient: 'from-violet-600 to-violet-400' },
    emerald: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/20', solid: 'bg-emerald-600', gradient: 'from-emerald-600 to-emerald-400' },
    amber: { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'shadow-amber-500/20', solid: 'bg-amber-600', gradient: 'from-amber-600 to-amber-400' },
    blue: { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'shadow-blue-500/20', solid: 'bg-blue-600', gradient: 'from-blue-600 to-blue-400' },
    cyan: { bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', text: 'text-cyan-400', glow: 'shadow-cyan-500/20', solid: 'bg-cyan-600', gradient: 'from-cyan-600 to-cyan-400' },
    rose: { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-400', glow: 'shadow-rose-500/20', solid: 'bg-rose-600', gradient: 'from-rose-600 to-rose-400' },
    orange: { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', glow: 'shadow-orange-500/20', solid: 'bg-orange-600', gradient: 'from-orange-600 to-orange-400' },
    purple: { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400', glow: 'shadow-purple-500/20', solid: 'bg-purple-600', gradient: 'from-purple-600 to-purple-400' },
    teal: { bg: 'bg-teal-500/15', border: 'border-teal-500/30', text: 'text-teal-400', glow: 'shadow-teal-500/20', solid: 'bg-teal-600', gradient: 'from-teal-600 to-teal-400' },
    sky: { bg: 'bg-sky-500/15', border: 'border-sky-500/30', text: 'text-sky-400', glow: 'shadow-sky-500/20', solid: 'bg-sky-600', gradient: 'from-sky-600 to-sky-400' },
    slate: { bg: 'bg-slate-500/15', border: 'border-slate-500/30', text: 'text-slate-400', glow: 'shadow-slate-500/20', solid: 'bg-slate-600', gradient: 'from-slate-600 to-slate-400' },
};

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function PlatformOverview() {
    const navigate = useNavigate();
    const [activeMethod, setActiveMethod] = useState(null);
    const [expandedModule, setExpandedModule] = useState(null);
    const [activeWorkflowStep, setActiveWorkflowStep] = useState(-1);

    // Scroll reveal refs
    const [heroRef, heroVisible] = useScrollReveal();
    const [methRef, methVisible] = useScrollReveal();
    const [flowRef, flowVisible] = useScrollReveal();
    const [modRef, modVisible] = useScrollReveal();
    const [tgRef, tgVisible] = useScrollReveal();
    const [benRef, benVisible] = useScrollReveal();
    const [roleRef, roleVisible] = useScrollReveal();
    const [ctaRef, ctaVisible] = useScrollReveal();

    // Animate workflow steps sequentially
    useEffect(() => {
        if (!flowVisible) return;
        let step = 0;
        const interval = setInterval(() => {
            setActiveWorkflowStep(step);
            step++;
            if (step >= WORKFLOW_STEPS.length) clearInterval(interval);
        }, 400);
        return () => clearInterval(interval);
    }, [flowVisible]);

    const toggleModule = useCallback((id) => {
        setExpandedModule(prev => prev === id ? null : id);
    }, []);

    return (
        <div className="min-h-screen pb-20">
            <PageHeader title="" showBack={true} />

            {/* ═══════════════════════════════════════════════════
                SECCIÓN 1: HERO
            ═══════════════════════════════════════════════════ */}
            <section ref={heroRef} className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
                {/* Fondo decorativo */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-600/5 blur-3xl" />
                    <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-violet-600/5 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                    <div className="absolute bottom-1/4 left-1/4 w-[200px] h-[200px] rounded-full bg-emerald-600/5 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
                </div>

                {/* Iconos orbitantes */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {[LayoutDashboard, ListTodo, Clock, BarChart3, GanttChartSquare, Shield].map((Icon, i) => (
                        <div
                            key={i}
                            className={`absolute transition-all duration-1000 ${heroVisible ? 'opacity-100' : 'opacity-0'}`}
                            style={{
                                top: `${50 + 35 * Math.sin((i / 6) * 2 * Math.PI)}%`,
                                left: `${50 + 35 * Math.cos((i / 6) * 2 * Math.PI)}%`,
                                transform: 'translate(-50%, -50%)',
                                transitionDelay: `${i * 150}ms`,
                                animation: heroVisible ? `orbit-float 8s ease-in-out infinite ${i * 1.3}s` : 'none',
                            }}
                        >
                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 flex items-center justify-center shadow-lg shadow-black/20">
                                <Icon className="w-5 h-5 md:w-6 md:h-6 text-indigo-400/70" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Contenido central */}
                <div className={`relative z-10 text-center max-w-3xl mx-auto px-6 transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-bold mb-6">
                        <BrainCircuit className="w-4 h-4" />
                        Engineering Management Platform
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight mb-6">
                        Tu Centro de Operaciones
                        <span className="block bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                            de Ingeniería
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-400 font-medium mb-8 max-w-2xl mx-auto leading-relaxed">
                        Una plataforma integral que combina <strong className="text-slate-200">Kanban, Lean y Obeya</strong> para
                        gestionar proyectos, tareas, tiempo e inteligencia de ingeniería en un solo lugar.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => navigate('/')}
                            className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-indigo-600/30 flex items-center justify-center gap-2"
                        >
                            <LayoutDashboard className="w-5 h-5" /> Ir al Dashboard
                        </button>
                        <button
                            onClick={() => navigate('/my-work')}
                            className="px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 transition-all hover:scale-105 flex items-center justify-center gap-2"
                        >
                            <Sparkles className="w-5 h-5 text-violet-400" /> Mi Trabajo
                        </button>
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 transition-all duration-1000 delay-700 ${heroVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                        <span className="text-xs font-bold uppercase tracking-widest">Descubre más</span>
                        <ArrowDown className="w-4 h-4 animate-bounce" />
                    </div>
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                SECCIÓN 2: METODOLOGÍA
            ═══════════════════════════════════════════════════ */}
            <section ref={methRef} className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className={`text-center mb-14 transition-all duration-700 ${methVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400 block mb-3">Metodología</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Framework Ágil para Ingeniería</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Un enfoque híbrido diseñado específicamente para departamentos de ingeniería de automatización</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {METHODOLOGIES.map((m, i) => {
                            const c = colorMap[m.color];
                            const Icon = m.icon;
                            const isActive = activeMethod === m.id;
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => setActiveMethod(isActive ? null : m.id)}
                                    className={`group relative text-left p-6 rounded-2xl border backdrop-blur-sm transition-all duration-500 cursor-pointer
                                        ${isActive
                                            ? `${c.bg} ${c.border} shadow-xl ${c.glow}`
                                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80 shadow-lg'
                                        }
                                        ${methVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
                                    `}
                                    style={{ transitionDelay: methVisible ? `${i * 100}ms` : '0ms' }}
                                >
                                    <div className={`w-12 h-12 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                                        <Icon className={`w-6 h-6 ${c.text}`} />
                                    </div>
                                    <h3 className="text-lg font-black text-white mb-1">{m.title}</h3>
                                    <p className={`text-xs font-bold ${c.text} uppercase tracking-wider mb-3`}>{m.subtitle}</p>

                                    <div className={`overflow-hidden transition-all duration-500 ${isActive ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                        <p className="text-sm text-slate-300 mb-4 leading-relaxed">{m.description}</p>
                                        <ul className="space-y-2">
                                            {m.features.map((f, j) => (
                                                <li key={j} className="flex items-center gap-2 text-sm text-slate-400">
                                                    <CheckCircle className={`w-3.5 h-3.5 ${c.text} shrink-0`} />
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {!isActive && (
                                        <p className="text-sm text-slate-500 mt-2 line-clamp-2">{m.description}</p>
                                    )}

                                    <div className={`mt-4 flex items-center gap-1 text-xs font-bold ${c.text} transition-all`}>
                                        {isActive ? 'Menos detalles' : 'Ver detalles'}
                                        <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isActive ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Modelo operacional */}
                    <div className={`mt-12 bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 p-8 transition-all duration-700 delay-500 ${methVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                            <Workflow className="w-5 h-5 text-indigo-400" /> Modelo Operacional Semanal
                        </h3>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="flex items-start gap-4 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                                <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/25">
                                    <span className="text-xl font-black text-white">L</span>
                                </div>
                                <div>
                                    <h4 className="font-black text-white text-lg">Lunes — Planificación</h4>
                                    <p className="text-sm text-slate-400 mt-1">Reunión de ingeniería: revisar estado de proyectos, riesgos, prioridades y capacidad del equipo.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-4 rounded-xl bg-violet-500/5 border border-violet-500/10">
                                <div className="w-14 h-14 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-600/25">
                                    <span className="text-lg font-black text-white">M-V</span>
                                </div>
                                <div>
                                    <h4 className="font-black text-white text-lg">Martes–Viernes — Ejecución</h4>
                                    <p className="text-sm text-slate-400 mt-1">Flujo continuo: mover tareas, registrar tiempo, loguear overtime, reportar retrasos, actualizar progreso.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                SECCIÓN 3: FLUJO DE TRABAJO
            ═══════════════════════════════════════════════════ */}
            <section ref={flowRef} className="py-20 px-6 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-900/5 to-transparent pointer-events-none" />
                <div className="max-w-5xl mx-auto relative">
                    <div className={`text-center mb-14 transition-all duration-700 ${flowVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-violet-400 block mb-3">Flujo de Trabajo</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Pipeline de Ejecución</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Cada tarea viaja por un pipeline controlado con validaciones automáticas y registro de auditoría</p>
                    </div>

                    {/* Desktop Pipeline */}
                    <div className="hidden md:block">
                        <div className="flex items-start justify-between gap-3 relative">
                            {/* Connection line */}
                            <div className="absolute top-10 left-[10%] right-[10%] h-1 bg-slate-800 rounded-full z-0" />
                            <div
                                className="absolute top-10 left-[10%] h-1 bg-gradient-to-r from-indigo-600 to-emerald-500 rounded-full z-[1] transition-all duration-1000 ease-out"
                                style={{ width: `${Math.max(0, (activeWorkflowStep / (WORKFLOW_STEPS.length - 1)) * 80)}%` }}
                            />

                            {WORKFLOW_STEPS.map((step, i) => {
                                const isActive = i <= activeWorkflowStep;
                                const Icon = step.icon;
                                const colors = {
                                    slate: 'bg-slate-700 border-slate-600 text-slate-300',
                                    blue: 'bg-blue-600 border-blue-500 text-white',
                                    indigo: 'bg-indigo-600 border-indigo-500 text-white',
                                    amber: 'bg-amber-600 border-amber-500 text-white',
                                    emerald: 'bg-emerald-600 border-emerald-500 text-white',
                                };
                                return (
                                    <div
                                        key={step.status}
                                        className={`relative z-10 flex-1 flex flex-col items-center text-center transition-all duration-500 ${isActive ? 'opacity-100 scale-100' : 'opacity-30 scale-90'}`}
                                        style={{ transitionDelay: `${i * 100}ms` }}
                                    >
                                        <div className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center mb-4 transition-all duration-500 ${isActive ? colors[step.color] + ' shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                                            <Icon className="w-8 h-8" />
                                        </div>
                                        <h4 className={`font-black text-sm mb-1 ${isActive ? 'text-white' : 'text-slate-600'}`}>{step.label}</h4>
                                        <p className={`text-xs leading-relaxed max-w-[140px] ${isActive ? 'text-slate-400' : 'text-slate-700'}`}>{step.desc}</p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Extra: Blocked / Cancelled */}
                        <div className={`mt-10 flex justify-center gap-6 transition-all duration-700 delay-700 ${flowVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                                <AlertTriangle className="w-5 h-5 text-rose-400" />
                                <div>
                                    <span className="text-sm font-black text-rose-300">Bloqueado</span>
                                    <p className="text-xs text-rose-400/70">Puede ocurrir desde cualquier estado activo</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-500/10 border border-slate-500/20">
                                <AlertTriangle className="w-5 h-5 text-slate-400" />
                                <div>
                                    <span className="text-sm font-black text-slate-300">Cancelado</span>
                                    <p className="text-xs text-slate-400/70">Requiere aprobación del Team Lead o Manager</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Pipeline (stacked) */}
                    <div className="md:hidden space-y-4">
                        {WORKFLOW_STEPS.map((step, i) => {
                            const isActive = i <= activeWorkflowStep;
                            const Icon = step.icon;
                            return (
                                <div
                                    key={step.status}
                                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-500 ${isActive ? 'bg-slate-800/60 border-slate-700 opacity-100' : 'bg-slate-900/30 border-slate-800/50 opacity-40'}`}
                                    style={{ transitionDelay: `${i * 200}ms` }}
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className={`font-black text-sm ${isActive ? 'text-white' : 'text-slate-600'}`}>{step.label}</h4>
                                        <p className={`text-xs ${isActive ? 'text-slate-400' : 'text-slate-700'}`}>{step.desc}</p>
                                    </div>
                                    {i < WORKFLOW_STEPS.length - 1 && isActive && (
                                        <ArrowDown className="w-4 h-4 text-indigo-400 shrink-0 ml-auto" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                SECCIÓN 4: MÓDULOS
            ═══════════════════════════════════════════════════ */}
            <section ref={modRef} className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className={`text-center mb-14 transition-all duration-700 ${modVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 block mb-3">Módulos</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">12 Módulos Integrados</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Todo conectado en una sola plataforma. Haz clic en cualquier módulo para ver más detalles.</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {MODULES.map((mod, i) => {
                            const c = colorMap[mod.color];
                            const Icon = mod.icon;
                            const isExpanded = expandedModule === mod.id;
                            return (
                                <div
                                    key={mod.id}
                                    onClick={() => toggleModule(mod.id)}
                                    className={`relative group cursor-pointer rounded-2xl border backdrop-blur-sm transition-all duration-500
                                        ${isExpanded
                                            ? `${c.bg} ${c.border} shadow-xl ${c.glow} col-span-2 row-span-2 p-6`
                                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 p-5 hover:shadow-lg'
                                        }
                                        ${modVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
                                    `}
                                    style={{ transitionDelay: modVisible ? `${i * 50}ms` : '0ms' }}
                                >
                                    <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110`}>
                                        <Icon className={`w-5 h-5 ${c.text}`} />
                                    </div>
                                    <h3 className={`font-black text-white ${isExpanded ? 'text-xl mb-2' : 'text-sm mb-1'}`}>{mod.title}</h3>

                                    {isExpanded ? (
                                        <div className="animate-in fade-in duration-300">
                                            <p className="text-sm text-slate-300 leading-relaxed mb-6">{mod.desc}</p>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); navigate(mod.path); }}
                                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl ${c.solid} text-white font-bold text-sm shadow-lg transition-all hover:scale-105`}
                                            >
                                                Abrir Módulo <ArrowRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-500 line-clamp-2">{mod.desc}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                SECCIÓN 5: COMUNICACIÓN TELEGRAM
            ═══════════════════════════════════════════════════ */}
            <section ref={tgRef} className="py-20 px-6 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/5 to-transparent pointer-events-none" />
                <div className="max-w-6xl mx-auto relative">
                    <div className={`text-center mb-14 transition-all duration-700 ${tgVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 block mb-3">Comunicación</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Reportes Rápidos por Telegram</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">La plataforma se conecta con un Bot de Telegram para enviarte reportes, alertas y resúmenes sin que tengas que abrir la app</p>
                    </div>

                    {/* Flow Diagram */}
                    <div className={`mb-14 transition-all duration-700 delay-200 ${tgVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-0">
                            {TELEGRAM_FLOW.map((step, i) => {
                                const c = colorMap[step.color];
                                const Icon = step.icon;
                                return (
                                    <React.Fragment key={i}>
                                        <div className={`flex flex-col items-center text-center p-5 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-sm w-full md:w-auto md:min-w-[180px] transition-all duration-500 ${tgVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
                                            style={{ transitionDelay: `${300 + i * 150}ms` }}
                                        >
                                            <div className={`w-14 h-14 rounded-2xl ${c.bg} border ${c.border} flex items-center justify-center mb-3`}>
                                                <Icon className={`w-7 h-7 ${c.text}`} />
                                            </div>
                                            <h4 className="font-black text-white text-sm mb-1">{step.label}</h4>
                                            <p className="text-[11px] text-slate-500 leading-snug">{step.desc}</p>
                                        </div>
                                        {i < TELEGRAM_FLOW.length - 1 && (
                                            <div className="flex items-center justify-center md:px-2 py-1 md:py-0">
                                                <ArrowRight className={`w-5 h-5 text-slate-600 hidden md:block`} />
                                                <ArrowDown className={`w-5 h-5 text-slate-600 md:hidden`} />
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    {/* Feature Cards */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {TELEGRAM_FEATURES.map((f, i) => {
                            const c = colorMap[f.color];
                            const Icon = f.icon;
                            return (
                                <div
                                    key={i}
                                    className={`group p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm transition-all duration-500 hover:border-slate-700 hover:shadow-lg
                                        ${tgVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
                                    `}
                                    style={{ transitionDelay: tgVisible ? `${500 + i * 80}ms` : '0ms' }}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110`}>
                                            <Icon className={`w-5 h-5 ${c.text}`} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-white text-base mb-1.5">{f.title}</h3>
                                            <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Telegram CTA */}
                    <div className={`mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 p-6 rounded-2xl bg-blue-500/5 border border-blue-500/10 transition-all duration-700 delay-700 ${tgVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/25">
                            <Send className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-center sm:text-left">
                            <h4 className="font-black text-white text-lg">¿Cómo activarlo?</h4>
                            <p className="text-sm text-slate-400">Un administrador genera un código de vinculación desde el panel de equipo. Envíalo al bot y automáticamente recibirás reportes personalizados.</p>
                        </div>
                    </div>
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                SECCIÓN 6: BENEFICIOS
            ═══════════════════════════════════════════════════ */}
            <section ref={benRef} className="py-20 px-6 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-900/5 to-transparent pointer-events-none" />
                <div className="max-w-5xl mx-auto relative">
                    <div className={`text-center mb-14 transition-all duration-700 ${benVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-400 block mb-3">Beneficios</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Impacto Real en tu Operación</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Resultados medibles desde el primer día de uso</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {BENEFITS.map((b, i) => {
                            const c = colorMap[b.color];
                            const Icon = b.icon;
                            const count = useCountUp(parseInt(b.stat), 2000, benVisible);
                            return (
                                <div
                                    key={i}
                                    className={`p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm transition-all duration-500 hover:border-slate-700 hover:shadow-lg ${benVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                                    style={{ transitionDelay: benVisible ? `${i * 100}ms` : '0ms' }}
                                >
                                    <div className={`w-12 h-12 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center mb-4`}>
                                        <Icon className={`w-6 h-6 ${c.text}`} />
                                    </div>
                                    <div className="mb-3">
                                        <span className={`text-4xl font-black ${c.text}`}>{count}</span>
                                        <span className={`text-2xl font-black ${c.text}`}>{b.suffix}</span>
                                    </div>
                                    <h3 className="font-black text-white text-lg mb-2">{b.title}</h3>
                                    <p className="text-sm text-slate-400 leading-relaxed">{b.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                SECCIÓN 6: ROLES
            ═══════════════════════════════════════════════════ */}
            <section ref={roleRef} className="py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className={`text-center mb-14 transition-all duration-700 ${roleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-violet-400 block mb-3">Estructura</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Roles del Equipo</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Cada rol tiene acceso definido según sus responsabilidades</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {ROLES.map((r, i) => {
                            const c = colorMap[r.color];
                            const Icon = r.icon;
                            return (
                                <div
                                    key={r.role}
                                    className={`group p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm transition-all duration-500 hover:border-slate-700 hover:shadow-lg hover:shadow-black/20
                                        ${roleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
                                    `}
                                    style={{ transitionDelay: roleVisible ? `${i * 100}ms` : '0ms' }}
                                >
                                    <div className={`w-12 h-12 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                                        <Icon className={`w-6 h-6 ${c.text}`} />
                                    </div>
                                    <h3 className="text-xl font-black text-white mb-2">{r.role}</h3>
                                    <p className="text-sm text-slate-400 mb-4 leading-relaxed">{r.desc}</p>
                                    <div className="space-y-2">
                                        {r.capabilities.map((cap, j) => (
                                            <div key={j} className="flex items-center gap-2">
                                                <CheckCircle className={`w-3.5 h-3.5 ${c.text} shrink-0`} />
                                                <span className="text-xs text-slate-300 font-medium">{cap}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                SECCIÓN 7: CTA
            ═══════════════════════════════════════════════════ */}
            <section ref={ctaRef} className="py-24 px-6">
                <div className={`max-w-3xl mx-auto text-center transition-all duration-1000 ${ctaVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="relative p-12 rounded-3xl bg-gradient-to-br from-indigo-900/40 via-slate-900/80 to-violet-900/40 border border-indigo-500/20 backdrop-blur-sm shadow-2xl shadow-indigo-900/20 overflow-hidden">
                        {/* Decorative */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                        <div className="relative z-10">
                            <BrainCircuit className="w-14 h-14 text-indigo-400 mx-auto mb-6" />
                            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">¿Listo para Comenzar?</h2>
                            <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto">
                                Tu equipo de ingeniería merece las mejores herramientas. Empieza a gestionar con inteligencia hoy.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <button
                                    onClick={() => navigate('/')}
                                    className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 hover:shadow-2xl text-lg flex items-center justify-center gap-3"
                                >
                                    Comenzar Ahora <ArrowRight className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => navigate('/tasks')}
                                    className="px-10 py-4 bg-slate-800/80 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 transition-all hover:scale-105 text-lg flex items-center justify-center gap-3"
                                >
                                    <ListTodo className="w-5 h-5" /> Ver Tareas
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                CSS ANIMATIONS (injected via <style>)
            ═══════════════════════════════════════════════════ */}
            <style>{`
                @keyframes orbit-float {
                    0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
                    50% { transform: translate(-50%, -50%) translateY(-12px); }
                }
            `}</style>
        </div>
    );
}
