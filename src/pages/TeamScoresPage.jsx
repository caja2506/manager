import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useNavigate } from 'react-router-dom';
import { getActiveAssignments } from '../services/resourceAssignmentService';
import {
    calculateTeamScores,
    buildRawMetrics,
} from '../core/analytics/performanceScore';
import { saveTeamScoreLogs, getScoreLogs, getWeeklyAverages } from '../services/scoreLogService';
import { loadCustomWeights, mergeWeights } from '../components/admin/IPSWeightConfigPanel';
import {
    Users, Target, Award, ChevronDown, TrendingUp, TrendingDown, Minus,
    ChevronRight, Zap, CheckCircle, AlertTriangle, Shield, Eye,
    Gauge, Star, ArrowLeft, Filter, BarChart3, Calendar,
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
                background: 'rgba(139,92,246,0.08)',
                borderColor: 'rgba(139,92,246,0.25)',
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
                background: 'rgba(245,158,11,0.06)',
                borderColor: 'rgba(245,158,11,0.20)',
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
                <div className="mt-3 text-xs text-amber-400/70 flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-amber-400" />
                    Datos insuficientes — necesita tareas asignadas y registros de tiempo recientes
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
// ANALYTICS — Team Overlay Chart (14-day multi-line)
// ============================================================

const MEMBER_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function TeamOverlayChart({ historyMap, teamScores }) {
    const members = teamScores.filter(s => s.score !== null);
    if (members.length === 0 || Object.keys(historyMap).length === 0) {
        return <div className="text-[10px] text-white/20 text-center py-6">Sin datos históricos — se acumulan al visitar esta página</div>;
    }

    const W = 280, H = 100, PAD = 24;
    // Find global date range
    const allDates = new Set();
    Object.values(historyMap).forEach(logs => logs.forEach(l => allDates.add(l.dateKey)));
    const sortedDates = [...allDates].sort();
    if (sortedDates.length < 2) {
        return <div className="text-[10px] text-white/20 text-center py-6">Mínimo 2 días de datos requeridos</div>;
    }

    return (
        <div className="relative">
            <svg viewBox={`0 0 ${W} ${H + PAD}`} className="w-full" style={{ maxHeight: 160 }}>
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map(v => {
                    const y = H - (v / 100) * H;
                    return (
                        <g key={v}>
                            <line x1={0} x2={W} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                            <text x={-2} y={y + 3} fill="rgba(255,255,255,0.15)" fontSize="6" textAnchor="end">{v}</text>
                        </g>
                    );
                })}

                {/* Lines per member */}
                {members.map((m, mi) => {
                    const logs = historyMap[m.userId] || [];
                    if (logs.length < 2) return null;
                    const color = MEMBER_COLORS[mi % MEMBER_COLORS.length];
                    const points = logs.map((l) => {
                        const x = (sortedDates.indexOf(l.dateKey) / (sortedDates.length - 1)) * W;
                        const y = H - (l.score / 100) * H;
                        return `${x},${y}`;
                    }).join(' ');
                    return (
                        <polyline key={m.userId} fill="none" stroke={color} strokeWidth="1.5"
                            strokeLinecap="round" strokeLinejoin="round" points={points} opacity="0.6" />
                    );
                })}

                {/* Date labels */}
                {sortedDates.filter((_, i) => i === 0 || i === sortedDates.length - 1 || i === Math.floor(sortedDates.length / 2)).map((d, i) => {
                    const x = (sortedDates.indexOf(d) / (sortedDates.length - 1)) * W;
                    return <text key={i} x={x} y={H + 12} fill="rgba(255,255,255,0.2)" fontSize="6" textAnchor="middle">{d.slice(5)}</text>;
                })}
            </svg>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 mt-2">
                {members.slice(0, 6).map((m, i) => (
                    <div key={m.userId} className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ background: MEMBER_COLORS[i % MEMBER_COLORS.length] }} />
                        <span className="text-[9px] text-white/40">{m.displayName?.split(' ')[0] || '?'}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================
// ANALYTICS — Weekly Bars Chart
// ============================================================

function WeeklyBarsChart({ weeklyData, teamScores }) {
    const members = teamScores.filter(s => s.score !== null);
    if (members.length === 0 || Object.keys(weeklyData).length === 0) {
        return <div className="text-[10px] text-white/20 text-center py-6">Sin datos semanales — se generan automáticamente</div>;
    }

    // Merge all weeks
    const allWeeks = new Set();
    Object.values(weeklyData).forEach(wks => wks.forEach(w => allWeeks.add(w.weekNumber)));
    const sortedWeeks = [...allWeeks].sort((a, b) => a - b);
    if (sortedWeeks.length === 0) {
        return <div className="text-[10px] text-white/20 text-center py-6">Sin semanas disponibles</div>;
    }

    // Team avg per week
    const weekAvgs = sortedWeeks.map(wk => {
        let total = 0, count = 0;
        Object.values(weeklyData).forEach(wks => {
            const found = wks.find(w => w.weekNumber === wk);
            if (found) { total += found.avgScore; count++; }
        });
        return { week: wk, avg: count > 0 ? parseFloat((total / count).toFixed(1)) : 0 };
    });

    const maxScore = Math.max(...weekAvgs.map(w => w.avg), 50);
    const W = 280, H = 80;
    const barW = Math.min(30, (W - 20) / sortedWeeks.length - 4);

    return (
        <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" style={{ maxHeight: 140 }}>
            {weekAvgs.map((w, i) => {
                const x = 10 + i * ((W - 20) / sortedWeeks.length);
                const barH = (w.avg / maxScore) * H;
                const color = w.avg >= 90 ? '#10b981' : w.avg >= 75 ? '#6366f1' : w.avg >= 60 ? '#f59e0b' : '#ef4444';
                return (
                    <g key={w.week}>
                        <rect x={x} y={H - barH} width={barW} height={barH} rx={3}
                            fill={color} opacity="0.5" />
                        <text x={x + barW / 2} y={H - barH - 4} fill={color} fontSize="7"
                            textAnchor="middle" fontWeight="bold">{w.avg}</text>
                        <text x={x + barW / 2} y={H + 12} fill="rgba(255,255,255,0.2)" fontSize="6"
                            textAnchor="middle">S{w.week}</text>
                    </g>
                );
            })}
        </svg>
    );
}

// ============================================================
// ANALYTICS — Role Comparison Table
// ============================================================

function RoleComparisonTable({ teamScores }) {
    const roleGroups = {};
    teamScores.forEach(s => {
        if (s.score === null || s.isManager) return;
        const r = s.teamRole || 'engineer';
        if (!roleGroups[r]) roleGroups[r] = { scores: [], dims: {} };
        roleGroups[r].scores.push(s.score);
        Object.entries(s.dimensions || {}).forEach(([dim, d]) => {
            if (!roleGroups[r].dims[dim]) roleGroups[r].dims[dim] = [];
            roleGroups[r].dims[dim].push(d.score);
        });
    });

    const roles = Object.entries(roleGroups);
    if (roles.length === 0) {
        return <div className="text-[10px] text-white/20 text-center py-4">Sin datos de roles</div>;
    }

    const avg = (arr) => arr.length > 0 ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0;
    const roleMeta = ROLE_CONFIG;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
                <thead>
                    <tr>
                        <th className="text-left py-1.5 px-2 text-white/40 font-bold">Rol</th>
                        <th className="text-center py-1.5 px-2 text-white/40 font-bold">N</th>
                        <th className="text-center py-1.5 px-2 text-white/40 font-bold">Score Prom.</th>
                        {Object.keys(DIMENSION_META).map(dim => (
                            <th key={dim} className="text-center py-1.5 px-1 text-white/30 font-medium">{DIMENSION_META[dim].label.slice(0, 5)}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {roles.map(([role, data]) => {
                        const rc = roleMeta[role] || roleMeta.engineer;
                        const avgScore = avg(data.scores);
                        const scoreColor = avgScore >= 90 ? '#10b981' : avgScore >= 75 ? '#6366f1' : avgScore >= 60 ? '#f59e0b' : '#ef4444';
                        return (
                            <tr key={role} className="border-t border-slate-800/50">
                                <td className="py-2 px-2 font-bold" style={{ color: rc.color }}>{rc.icon} {rc.label}</td>
                                <td className="text-center text-white/40">{data.scores.length}</td>
                                <td className="text-center font-black" style={{ color: scoreColor }}>{avgScore}</td>
                                {Object.keys(DIMENSION_META).map(dim => {
                                    const dimScores = data.dims[dim];
                                    if (!dimScores || dimScores.length === 0) return <td key={dim} className="text-center text-white/15">—</td>;
                                    const dimAvg = avg(dimScores);
                                    const dc = dimAvg >= 90 ? '#10b981' : dimAvg >= 75 ? '#6366f1' : dimAvg >= 60 ? '#f59e0b' : '#ef4444';
                                    return <td key={dim} className="text-center font-bold" style={{ color: dc }}>{dimAvg}</td>;
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
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
    const [analyticsRef, analyticsVis] = useScrollReveal();

    // Weekly averages for analytics section
    const [weeklyData, setWeeklyData] = useState({});   // userId -> [{weekNumber, avgScore, count}]
    useEffect(() => {
        if (teamScores.length === 0) return;
        const loadWeekly = async () => {
            const map = {};
            for (const s of teamScores) {
                if (s.score === null) continue;
                try {
                    map[s.userId] = await getWeeklyAverages(s.userId, 6);
                } catch (e) {
                    console.warn(`[IPS] Weekly error for ${s.userId}:`, e.message);
                }
            }
            setWeeklyData(map);
        };
        loadWeekly();
    }, [teamScores]);

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

            {/* ── Analytics Section ── */}
            <section ref={analyticsRef} className="px-4 sm:px-6 mt-6" style={{
                opacity: analyticsVis ? 1 : 0,
                transform: analyticsVis ? 'translateY(0)' : 'translateY(20px)',
                transition: 'all 0.6s ease-out 0.4s',
            }}>
                <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <BarChart3 size={18} className="text-indigo-400" />
                        <h3 className="font-bold text-lg text-white">Analítica Temporal</h3>
                        <span className="text-[10px] text-white/30 ml-auto">Últimas 6 semanas</span>
                    </div>

                    {/* Team Trend Overview */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                        {/* Historical Daily Chart — all members overlaid */}
                        <div className="rounded-xl border border-slate-700/50 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <Calendar size={14} className="text-indigo-400" />
                                <span className="text-xs font-bold text-white/70">Historial Diario (14 días)</span>
                            </div>
                            <TeamOverlayChart historyMap={historyMap} teamScores={teamScores} />
                        </div>

                        {/* Weekly Averages — bar chart */}
                        <div className="rounded-xl border border-slate-700/50 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <BarChart3 size={14} className="text-amber-400" />
                                <span className="text-xs font-bold text-white/70">Promedios Semanales</span>
                            </div>
                            <WeeklyBarsChart weeklyData={weeklyData} teamScores={teamScores} />
                        </div>
                    </div>

                    {/* Role Comparison Table */}
                    <div className="rounded-xl border border-slate-700/50 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <Users size={14} className="text-emerald-400" />
                            <span className="text-xs font-bold text-white/70">Comparación por Rol</span>
                        </div>
                        <RoleComparisonTable teamScores={teamScores} />
                    </div>
                </div>
            </section>

            {/* Keyframes */}
            <style>{`
                @keyframes pulse { 0%, 100% { opacity: 0.15; transform: scale(1); } 50% { opacity: 0.25; transform: scale(1.1); } }
            `}</style>
        </div>
    );
}
