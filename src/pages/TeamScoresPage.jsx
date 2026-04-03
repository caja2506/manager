import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useNavigate } from 'react-router-dom';
import { getActiveAssignments } from '../services/resourceAssignmentService';
import {
    calculateTeamScores,
    buildRawMetrics,
} from '../core/analytics/performanceScore';
import { saveTeamScoreLogs, getScoreLogs } from '../services/scoreLogService';
import { loadCustomWeights, mergeWeights } from '../components/admin/IPSWeightConfigPanel';
import {
    Users, Target, Award, ChevronDown, TrendingUp, TrendingDown, Minus,
    ChevronRight, Zap, CheckCircle, AlertTriangle, Shield, Eye,
    Gauge, Star, ArrowLeft, Filter,
} from 'lucide-react';

// ── Scroll reveal ──
function useScrollReveal(options = {}) {
    const ref = useRef(null);
    const [isVisible, setIsVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.unobserve(el); } },
            { threshold: 0.15, rootMargin: '0px 0px -50px 0px', ...options }
        );
        observer.observe(el);
        return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return [ref, isVisible];
}

// ── Animated counter ──
function useCountUp(end, duration = 1200, start = true) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!start) return;
        const numEnd = typeof end === 'number' ? end : parseFloat(end) || 0;
        if (numEnd === 0) return;
        const isDecimal = !Number.isInteger(numEnd);
        let cancelled = false;
        let startTs = null;
        const step = (ts) => {
            if (cancelled) return;
            if (!startTs) startTs = ts;
            const p = Math.min((ts - startTs) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            const current = eased * numEnd;
            setVal(isDecimal ? parseFloat(current.toFixed(1)) : Math.round(current));
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        return () => { cancelled = true; };
    }, [end, duration, start]);
    return val;
}

// ── Role config ──
const ROLE_CONFIG = {
    manager:    { label: 'Manager',    color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: '👑' },
    team_lead:  { label: 'Team Lead',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '🎯' },
    engineer:   { label: 'Engineer',   color: '#6366f1', bg: 'rgba(99,102,241,0.12)', icon: '⚙️' },
    technician: { label: 'Technician', color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: '🔧' },
};

const DIMENSION_META = {
    velocity:      { label: 'Velocidad',     icon: Zap,           desc: 'Tareas completadas vs esperadas' },
    discipline:    { label: 'Disciplina',     icon: Shield,        desc: 'Registro de horas y actualizaciones' },
    capacity:      { label: 'Capacidad',      icon: Gauge,         desc: 'Utilización óptima (~80%)' },
    precision:     { label: 'Precisión',      icon: Target,        desc: 'Estimación vs horas reales' },
    collaboration: { label: 'Colaboración',   icon: Users,         desc: 'Sin bloqueos ni delays activos' },
    leadership:    { label: 'Liderazgo Téc.', icon: Star,          desc: 'Planificación y seguimiento de técnicos' },
    oversight:     { label: 'Supervisión',    icon: Eye,           desc: 'Compliance y calidad de datos del equipo' },
};

// ── Sparkline (mini SVG chart) ──
function Sparkline({ data, width = 100, height = 28, color = '#6366f1' }) {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="shrink-0">
            <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"
                strokeLinejoin="round" points={points} opacity="0.7" />
            {/* Last point dot */}
            {data.length > 0 && (() => {
                const lastX = width;
                const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2;
                return <circle cx={lastX} cy={lastY} r="2.5" fill={color} />;
            })()}
        </svg>
    );
}

// ── Delta Badge ──
function DeltaBadge({ delta }) {
    if (!delta || delta.score === 0) {
        return <span className="text-[9px] text-white/20 flex items-center gap-0.5"><Minus size={10} /> 0</span>;
    }
    const isUp = delta.directionCode === 1;
    const color = isUp ? '#10b981' : '#ef4444';
    const Icon = isUp ? TrendingUp : TrendingDown;
    return (
        <span className="text-[9px] font-bold flex items-center gap-0.5" style={{ color }}>
            <Icon size={10} />
            {isUp ? '+' : ''}{delta.score}
        </span>
    );
}

// ── Score ring (SVG) ──
function ScoreRing({ score, size = 80, strokeWidth = 6, color }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const animatedScore = useCountUp(score || 0, 1400);
    const progress = (animatedScore / 100) * circumference;

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={circumference - progress}
                style={{ transition: 'stroke-dashoffset 1.4s ease-out' }} />
            <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
                className="fill-white font-bold" style={{ fontSize: size * 0.28, transform: 'rotate(90deg)', transformOrigin: 'center' }}>
                {animatedScore}
            </text>
        </svg>
    );
}

// ── Dimension bar ──
function DimensionBar({ dimKey, dim }) {
    const meta = DIMENSION_META[dimKey] || { label: dimKey, icon: Target, desc: '' };
    const Icon = meta.icon;
    const levelColor = dim.score >= 90 ? '#10b981' : dim.score >= 75 ? '#6366f1' : dim.score >= 60 ? '#f59e0b' : '#ef4444';

    return (
        <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                    <Icon size={13} style={{ color: levelColor }} />
                    <span className="text-xs font-medium text-white/70">{meta.label}</span>
                    <span className="text-[10px] text-white/30">({Math.round(dim.weight * 100)}%)</span>
                </div>
                <span className="text-xs font-bold" style={{ color: levelColor }}>{dim.score}</span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${dim.score}%`, background: levelColor }} />
            </div>
        </div>
    );
}

// ── Score Card ──
function ScoreCard({ person, index, isExpanded, onToggle, history }) {
    const roleCfg = ROLE_CONFIG[person.teamRole] || ROLE_CONFIG.engineer;
    const lvl = person.levelConfig || {};
    const lvlColor = lvl.color === 'emerald' ? '#10b981' : lvl.color === 'indigo' ? '#6366f1' : lvl.color === 'amber' ? '#f59e0b' : '#ef4444';

    if (person.isManager) {
        return (
            <div className="rounded-2xl p-5 border" style={{
                background: 'rgba(139,92,246,0.05)',
                borderColor: 'rgba(139,92,246,0.15)',
                animationDelay: `${index * 80}ms`,
            }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                        style={{ background: roleCfg.bg }}>{roleCfg.icon}</div>
                    <div>
                        <div className="text-white font-semibold text-sm">{person.displayName}</div>
                        <div style={{ color: roleCfg.color }} className="text-xs font-medium">{roleCfg.label}</div>
                    </div>
                </div>
                <div className="mt-3 text-xs text-white/40 italic">
                    Los managers no reciben IPS individual — su evaluación es el dashboard departamental.
                </div>
            </div>
        );
    }

    if (person.insufficientData) {
        return (
            <div className="rounded-2xl p-5 border" style={{
                background: 'rgba(255,255,255,0.02)',
                borderColor: 'rgba(255,255,255,0.08)',
                animationDelay: `${index * 80}ms`,
            }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                        style={{ background: roleCfg.bg }}>{roleCfg.icon}</div>
                    <div>
                        <div className="text-white font-semibold text-sm">{person.displayName}</div>
                        <div style={{ color: roleCfg.color }} className="text-xs font-medium">{roleCfg.label}</div>
                    </div>
                </div>
                <div className="mt-3 text-xs text-white/40 italic flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-amber-400" />
                    Datos insuficientes — necesita actividad reciente
                </div>
            </div>
        );
    }

    const dims = Object.entries(person.dimensions || {});

    return (
        <div className="rounded-2xl border overflow-hidden transition-all duration-300" style={{
            background: isExpanded ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
            borderColor: isExpanded ? `${lvlColor}33` : 'rgba(255,255,255,0.08)',
            animationDelay: `${index * 80}ms`,
        }}>
            {/* Header */}
            <button onClick={onToggle} className="w-full p-5 flex items-center gap-4 hover:bg-white/2 transition-colors">
                {/* Role icon */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ background: roleCfg.bg }}>{roleCfg.icon}</div>

                {/* Name + role */}
                <div className="text-left flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm truncate">{person.displayName}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span style={{ color: roleCfg.color }} className="text-xs font-medium">{roleCfg.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ background: `${lvlColor}20`, color: lvlColor }}>
                            {lvl.emoji} {lvl.label}
                        </span>
                    </div>
                </div>

                {/* Sparkline + delta */}
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <Sparkline
                        data={history.map(h => h.score)}
                        width={70}
                        height={22}
                        color={lvlColor}
                    />
                    {history.length > 0 && (
                        <DeltaBadge delta={history[history.length - 1]?.delta} />
                    )}
                </div>

                {/* Score ring */}
                <div className="shrink-0">
                    <ScoreRing score={person.score} size={64} strokeWidth={5} color={lvlColor} />
                </div>

                {/* Expand arrow */}
                <div className="shrink-0 text-white/30">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
                <div className="px-5 pb-5 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mt-4">
                        {dims.map(([key, dim]) => (
                            <DimensionBar key={key} dimKey={key} dim={dim} />
                        ))}
                    </div>
                    {/* Raw metrics summary */}
                    <div className="mt-4 pt-3 border-t flex flex-wrap gap-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        {dims.map(([key, dim]) => {
                            const meta = DIMENSION_META[key];
                            if (!meta) return null;
                            return (
                                <div key={key} className="text-[10px] text-white/30 flex items-center gap-1"
                                    title={JSON.stringify(dim.raw, null, 2)}>
                                    <span className="text-white/50">{meta.label}:</span>
                                    {Object.entries(dim.raw || {}).slice(0, 2).map(([k, v]) => (
                                        <span key={k} className="text-white/40">{k}={typeof v === 'number' ? v : '…'}</span>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Summary KPI Card ──
function SummaryKPI({ label, value, Icon: KpiIcon, color, visible }) {
    const animVal = useCountUp(value, 1200, visible);
    return (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{
            background: `${color}08`,
            border: `1px solid ${color}20`,
        }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
                <KpiIcon size={18} style={{ color }} />
            </div>
            <div>
                <div className="text-2xl font-bold text-white">{animVal}</div>
                <div className="text-[11px] text-white/50">{label}</div>
            </div>
        </div>
    );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function TeamScoresPage() {
    const navigate = useNavigate();
    const { engTasks, timeLogs, delays, teamMembers, isReady } = useEngineeringData();
    const [assignments, setAssignments] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const [roleFilter, setRoleFilter] = useState('all');
    const [historyMap, setHistoryMap] = useState({});   // userId -> [{score, dateKey, delta}]
    const persistDoneRef = useRef(false);
    const [customWeights, setCustomWeights] = useState(null);

    // Load assignments + custom weights
    useEffect(() => {
        getActiveAssignments().then(setAssignments).catch(console.error);
        loadCustomWeights().then(w => { if (w) setCustomWeights(mergeWeights(w)); });
    }, []);

    // Calculate scores (with custom weights if available)
    const teamScores = useMemo(() => {
        if (!isReady || teamMembers.length === 0) return [];
        return calculateTeamScores(teamMembers, {
            tasks: engTasks,
            timeLogs,
            delays,
            teamMembers,
            assignments,
            plannerSlots: [],
            auditScores: null,
        }, customWeights);
    }, [isReady, teamMembers, engTasks, timeLogs, delays, assignments, customWeights]);

    // Auto-persist daily logs (once per session)
    useEffect(() => {
        if (teamScores.length === 0 || persistDoneRef.current) return;
        persistDoneRef.current = true;
        const rawMap = {};
        for (const s of teamScores) {
            if (s.score !== null) {
                rawMap[s.userId] = buildRawMetrics(s.userId, s.teamRole, {
                    tasks: engTasks, timeLogs, delays, assignments,
                });
            }
        }
        saveTeamScoreLogs(teamScores, rawMap)
            .then(r => console.log(`[IPS] Saved ${r.saved}, skipped ${r.skipped}`))
            .catch(e => console.warn('[IPS] Persist error:', e.message));
    }, [teamScores, engTasks, timeLogs, delays, assignments]);

    // Load 14-day history for all members
    useEffect(() => {
        if (teamScores.length === 0) return;
        const loadHistory = async () => {
            const map = {};
            for (const s of teamScores) {
                if (s.score === null) continue;
                try {
                    const logs = await getScoreLogs(s.userId, 14);
                    map[s.userId] = logs;
                } catch (e) {
                    console.warn(`[IPS] History error for ${s.userId}:`, e.message);
                }
            }
            setHistoryMap(map);
        };
        loadHistory();
    }, [teamScores]);

    // Filtered
    const filtered = useMemo(() => {
        if (roleFilter === 'all') return teamScores;
        return teamScores.filter(s => s.teamRole === roleFilter);
    }, [teamScores, roleFilter]);

    // Summary
    const summary = useMemo(() => {
        const scored = teamScores.filter(s => s.score !== null);
        const avg = scored.length > 0 ? scored.reduce((s, p) => s + p.score, 0) / scored.length : 0;
        return {
            total: teamScores.length,
            scored: scored.length,
            avg: Math.round(avg * 10) / 10,
            excellent: scored.filter(s => s.level === 'excellent').length,
            good: scored.filter(s => s.level === 'good').length,
            regular: scored.filter(s => s.level === 'regular').length,
            needsAttention: scored.filter(s => s.level === 'needs_attention').length,
        };
    }, [teamScores]);

    // Scroll reveal
    const [heroRef, heroVis] = useScrollReveal();
    const [kpiRef, kpiVis] = useScrollReveal();
    const [gridRef, gridVis] = useScrollReveal();

    const roles = ['all', 'engineer', 'team_lead', 'technician', 'manager'];

    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#0c0a1a' }}>
                <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#6366f1', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-24" style={{ background: '#0c0a1a' }}>

            {/* ── Hero Header ── */}
            <div ref={heroRef} className="relative overflow-hidden" style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(16,185,129,0.05) 50%, rgba(245,158,11,0.05) 100%)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
                {/* Ambient orbs */}
                <div className="absolute -top-20 -left-20 w-60 h-60 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #6366f1, transparent)', animation: 'pulse 4s ease-in-out infinite' }} />
                <div className="absolute -bottom-20 -right-20 w-60 h-60 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #10b981, transparent)', animation: 'pulse 5s ease-in-out infinite 1s' }} />

                <div className="relative px-4 sm:px-6 py-8" style={{
                    opacity: heroVis ? 1 : 0,
                    transform: heroVis ? 'translateY(0)' : 'translateY(30px)',
                    transition: 'all 0.8s ease-out',
                }}>
                    <div className="flex items-center gap-3 mb-2">
                        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50">
                            <ArrowLeft size={18} />
                        </button>
                        <Award size={24} className="text-indigo-400" />
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">Scorecard del Equipo</h1>
                    </div>
                    <p className="text-white/50 text-sm ml-12">
                        Performance Score individual • {summary.scored} miembros evaluados
                    </p>
                </div>
            </div>

            {/* ── KPI Row ── */}
            <div ref={kpiRef} className="px-4 sm:px-6 -mt-1 mb-6" style={{
                opacity: kpiVis ? 1 : 0,
                transform: kpiVis ? 'translateY(0)' : 'translateY(20px)',
                transition: 'all 0.6s ease-out 0.15s',
            }}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <SummaryKPI label="Promedio Equipo"    value={summary.avg}            Icon={Target}         color="#6366f1" visible={kpiVis} />
                    <SummaryKPI label="Excelente"          value={summary.excellent}      Icon={Star}           color="#10b981" visible={kpiVis} />
                    <SummaryKPI label="Bueno"              value={summary.good}           Icon={CheckCircle}    color="#818cf8" visible={kpiVis} />
                    <SummaryKPI label="Necesita Atención"  value={summary.needsAttention} Icon={AlertTriangle}  color="#ef4444" visible={kpiVis} />
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="px-4 sm:px-6 mb-4 flex items-center gap-2 flex-wrap">
                <Filter size={14} className="text-white/30" />
                {roles.map(r => {
                    const active = roleFilter === r;
                    const cfg = r === 'all' ? { label: 'Todos', color: '#a78bfa' } : (ROLE_CONFIG[r] || ROLE_CONFIG.engineer);
                    return (
                        <button key={r} onClick={() => setRoleFilter(r)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{
                                background: active ? `${cfg.color}20` : 'rgba(255,255,255,0.04)',
                                color: active ? cfg.color : 'rgba(255,255,255,0.4)',
                                border: `1px solid ${active ? `${cfg.color}40` : 'rgba(255,255,255,0.06)'}`,
                            }}>
                            {cfg.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Team Grid ── */}
            <div ref={gridRef} className="px-4 sm:px-6" style={{
                opacity: gridVis ? 1 : 0,
                transform: gridVis ? 'translateY(0)' : 'translateY(20px)',
                transition: 'all 0.6s ease-out 0.3s',
            }}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {filtered.map((person, i) => (
                        <ScoreCard
                            key={person.userId}
                            person={person}
                            index={i}
                            isExpanded={expandedId === person.userId}
                            onToggle={() => setExpandedId(expandedId === person.userId ? null : person.userId)}
                            history={historyMap[person.userId] || []}
                        />
                    ))}
                </div>
                {filtered.length === 0 && (
                    <div className="text-center py-12 text-white/30 text-sm">
                        No hay miembros con el filtro seleccionado
                    </div>
                )}
            </div>

            {/* Keyframes */}
            <style>{`
                @keyframes pulse { 0%, 100% { opacity: 0.15; transform: scale(1); } 50% { opacity: 0.25; transform: scale(1.1); } }
            `}</style>
        </div>
    );
}
