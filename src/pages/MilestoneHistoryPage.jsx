/**
 * MilestoneHistoryPage — V5 Phase 5
 * ====================================
 * Historical score view styled like EngineeringAnalytics.
 * Shows score timeline, area overlay, tooltips, area cards, events.
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    Legend, ResponsiveContainer, ReferenceLine, ReferenceArea
} from 'recharts';
import {
    LineChart as LineChartIcon, ArrowLeft, Calendar as CalendarIcon,
    TrendingUp, TrendingDown, Minus, Target, Loader2, AlertTriangle,
    Eye, EyeOff, Lock, Shield, Info
} from 'lucide-react';
import { format } from 'date-fns';
import useMilestoneHistory from '../hooks/useMilestoneHistory';

const AREA_COLORS = ['#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#e879f9', '#fbbf24'];

const TRAFFIC_COLORS = {
    green: '#22c55e', yellow: '#f59e0b', red: '#ef4444',
};

const TREND_MAP = {
    improving: { Icon: TrendingUp, color: '#22c55e', label: 'Subiendo' },
    stable: { Icon: Minus, color: '#94a3b8', label: 'Estable' },
    declining: { Icon: TrendingDown, color: '#ef4444', label: 'Bajando' },
};

// ── Custom Tooltip ──
function ScoreTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    const tl = TRAFFIC_COLORS[d.trafficLight] || '#94a3b8';

    return (
        <div style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
            padding: '12px 14px', boxShadow: '0 10px 15px rgb(0 0 0/0.3)',
            maxWidth: '260px',
        }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>{d.fullDate}</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: tl, boxShadow: `0 0 6px ${tl}44` }} />
                <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '16px' }}>{d.score}</span>
                <span style={{ color: '#64748b', fontSize: '12px' }}>/ 100</span>
                {d.delta !== 0 && (
                    <span style={{ color: d.delta > 0 ? '#22c55e' : '#ef4444', fontSize: '12px', fontWeight: 600 }}>
                        {d.delta > 0 ? `↑+${d.delta}` : `↓${d.delta}`}
                    </span>
                )}
            </div>

            {d.changeReason && (
                <div style={{ color: '#cbd5e1', fontSize: '11px', marginBottom: '4px' }}>{d.changeReason}</div>
            )}
            {d.comment && (
                <div style={{ color: '#818cf8', fontSize: '11px', fontStyle: 'italic' }}>💬 {d.comment}</div>
            )}
            {d.locks?.length > 0 && (
                <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {d.locks.map(l => (
                        <span key={l} style={{
                            background: 'rgba(239,68,68,0.15)', color: '#fca5a5',
                            fontSize: '9px', padding: '2px 6px', borderRadius: '4px',
                        }}>🔒 {l.replace(/_/g, ' ')}</span>
                    ))}
                </div>
            )}
            {d.isReconstructed && (
                <div style={{ marginTop: '4px', color: '#94a3b8', fontSize: '10px' }}>
                    📎 Dato reconstruido
                </div>
            )}
        </div>
    );
}

export default function MilestoneHistoryPage() {
    const { milestoneId } = useParams();
    const navigate = useNavigate();
    const {
        milestone, chartData, areaSummaries, areaOptions, events,
        loading, error,
        dateFrom, setDateFrom, dateTo, setDateTo,
        showAreas, setShowAreas, selectedAreas, setSelectedAreas,
        applyPreset,
    } = useMilestoneHistory(milestoneId);

    // Loading
    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                    <p className="text-slate-400 mt-3 text-sm">Cargando historial...</p>
                </div>
            </div>
        );
    }

    // Error
    if (error) {
        return (
            <div className="p-10 text-center">
                <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <p className="text-red-300 text-sm">{error}</p>
                <button onClick={() => navigate(-1)}
                    className="mt-4 px-5 py-2 bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 rounded-lg text-sm cursor-pointer">
                    Volver
                </button>
            </div>
        );
    }

    const latest = chartData[chartData.length - 1];
    const first = chartData[0];
    const overallDelta = latest && first ? latest.score - first.score : 0;

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* ── HEADER / FILTER BAR (Analítica style) ── */}
            <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg relative z-20">
                {/* Title */}
                <div className="flex items-center justify-between p-4 pb-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="text-indigo-400 hover:text-indigo-300 transition">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="w-10 h-10 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center">
                            <LineChartIcon className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="font-black text-xl text-white tracking-tight">
                                Historial de Score
                            </h2>
                            <p className="text-[11px] text-slate-500 font-bold">
                                {milestone?.name || 'Milestone'} · Evolución temporal
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 flex flex-wrap items-center gap-3">
                    {/* Date range */}
                    <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl p-1 pl-3">
                        <CalendarIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-slate-200 py-1 px-1 focus:ring-0 outline-none w-[120px]" />
                        <span className="text-slate-500 text-xs font-bold">→</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            max={format(new Date(), 'yyyy-MM-dd')}
                            className="bg-transparent border-none text-sm font-bold text-slate-200 py-1 px-1 focus:ring-0 outline-none w-[120px]" />
                    </div>

                    {/* Quick presets */}
                    <div className="flex gap-1">
                        {[{ label: '7d', days: 7 }, { label: '15d', days: 15 }, { label: '30d', days: 30 }, { label: '90d', days: 90 }].map(p => (
                            <button key={p.days} onClick={() => applyPreset(p.days)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-black text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all">
                                {p.label}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-slate-700" />

                    {/* Area overlay toggle */}
                    <button
                        onClick={() => setShowAreas(!showAreas)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
                            showAreas ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                    >
                        {showAreas ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        Áreas
                    </button>

                    <div className="ml-auto text-[11px] text-slate-500 font-bold">
                        {chartData.length} snapshots
                    </div>
                </div>
            </div>

            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Score Actual" value={latest?.score ?? '—'} color="indigo" icon={<Target className="w-6 h-6" />} />
                <KpiCard label="Variación Periodo" value={overallDelta > 0 ? `+${overallDelta}` : `${overallDelta}`}
                    color={overallDelta > 0 ? 'emerald' : overallDelta < 0 ? 'rose' : 'slate'}
                    icon={overallDelta > 0 ? <TrendingUp className="w-6 h-6" /> : overallDelta < 0 ? <TrendingDown className="w-6 h-6" /> : <Minus className="w-6 h-6" />} />
                <KpiCard label="Semáforo" value={latest?.trafficLight?.toUpperCase() || '—'}
                    color={latest?.trafficLight === 'green' ? 'emerald' : latest?.trafficLight === 'red' ? 'rose' : 'amber'}
                    icon={<Shield className="w-6 h-6" />} />
                <KpiCard label="Eventos Notables" value={events.length} color="purple" icon={<AlertTriangle className="w-6 h-6" />} />
            </div>

            {/* ── MAIN CHART ── */}
            <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg relative">
                <div className="flex items-center gap-2 mb-5">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-bold text-lg text-white">Score en el Tiempo</h3>
                </div>

                {chartData.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-slate-400 font-bold">
                        No hay snapshots en el rango seleccionado.
                    </div>
                ) : (
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />

                                {/* Band references */}
                                <ReferenceArea y1={70} y2={100} fill="#22c55e" fillOpacity={0.03} />
                                <ReferenceArea y1={40} y2={70} fill="#f59e0b" fillOpacity={0.03} />
                                <ReferenceArea y1={0} y2={40} fill="#ef4444" fillOpacity={0.03} />
                                <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.3} />
                                <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.3} />

                                <RechartsTooltip content={<ScoreTooltip />} cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />

                                {/* Main score line */}
                                <Line
                                    type="monotone" name="Score General" dataKey="score"
                                    stroke="#6366f1" strokeWidth={3}
                                    dot={{ r: 3, fill: '#6366f1', stroke: '#1e293b', strokeWidth: 2 }}
                                    activeDot={{ r: 6, fill: '#818cf8', stroke: '#1e293b', strokeWidth: 2 }}
                                />

                                {/* Area overlay lines */}
                                {showAreas && areaOptions.map((area, i) => {
                                    if (selectedAreas.length > 0 && !selectedAreas.includes(area.value)) return null;
                                    return (
                                        <Line
                                            key={area.value}
                                            type="monotone"
                                            name={area.label}
                                            dataKey={`area_${area.value}`}
                                            stroke={AREA_COLORS[i % AREA_COLORS.length]}
                                            strokeWidth={1.5}
                                            strokeDasharray="5 5"
                                            dot={false}
                                        />
                                    );
                                })}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Band legend */}
                <div className="flex items-center gap-6 mt-3 text-[10px] font-bold text-slate-500">
                    <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />≥70 Verde</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />40-69 Amarillo</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />&lt;40 Rojo</span>
                </div>
            </div>

            {/* ── AREA SUMMARY CARDS ── */}
            {areaSummaries.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Target className="w-4 h-4 text-indigo-400" />
                        <h3 className="font-bold text-sm text-white">Estado por Área</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {areaSummaries.map(a => {
                            const tl = TRAFFIC_COLORS[a.trafficLight] || '#94a3b8';
                            const trendInfo = TREND_MAP[a.trend] || TREND_MAP.stable;
                            const TI = trendInfo.Icon;
                            return (
                                <div key={a.areaId} className="bg-slate-900/70 rounded-xl border border-slate-800 p-4 relative overflow-hidden" style={{ borderLeft: `3px solid ${tl}` }}>
                                    <div className="text-xs font-bold text-slate-300 mb-2 truncate">{a.name}</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-black text-white">{a.score}</span>
                                        <div className="flex items-center gap-2">
                                            {a.delta !== 0 && (
                                                <span className={`text-xs font-bold ${a.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {a.delta > 0 ? `+${a.delta}` : a.delta}
                                                </span>
                                            )}
                                            <TI size={14} color={trendInfo.color} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── EVENTS TIMELINE ── */}
            {events.length > 0 && (
                <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-lg">
                    <div className="flex items-center gap-2 mb-4">
                        <Info className="w-5 h-5 text-purple-400" />
                        <h3 className="font-bold text-lg text-white">Eventos Relevantes</h3>
                    </div>
                    <div className="space-y-2 max-h-[280px] overflow-y-auto">
                        {events.map((evt, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%', marginTop: '5px', flexShrink: 0,
                                    background: TRAFFIC_COLORS[evt.trafficLight] || '#94a3b8',
                                }} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[11px] text-slate-500 font-bold">{evt.date}</span>
                                        {evt.delta !== 0 && (
                                            <span className={`text-[11px] font-bold ${evt.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {evt.delta > 0 ? `↑+${evt.delta}` : `↓${evt.delta}`}
                                            </span>
                                        )}
                                        {evt.isReconstructed && (
                                            <span className="text-[9px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded font-bold">RECONSTRUIDO</span>
                                        )}
                                    </div>
                                    {evt.reason && <div className="text-xs text-slate-300 mt-1">{evt.reason}</div>}
                                    {evt.comment && <div className="text-xs text-indigo-300 mt-1">💬 {evt.comment}</div>}
                                    {evt.locks?.length > 0 && (
                                        <div className="flex gap-1 mt-1.5 flex-wrap">
                                            {evt.locks.map(l => (
                                                <span key={l} className="text-[9px] bg-red-500/10 text-red-300 px-1.5 py-0.5 rounded font-bold">
                                                    🔒 {l.replace(/_/g, ' ')}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── DATA SOURCE LEGEND ── */}
            <div className="flex items-center gap-6 text-[10px] text-slate-500 font-bold px-2 pb-4">
                <span>● Dato nativo (snapshot real)</span>
                <span>📎 Dato reconstruido (si aplica)</span>
            </div>
        </div>
    );
}

// ── KPI Card helper ──
function KpiCard({ label, value, color, icon }) {
    const colorClasses = {
        indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', label: 'text-indigo-400' },
        emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'text-emerald-400' },
        rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', label: 'text-rose-400' },
        amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'text-amber-400' },
        purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'text-purple-400' },
        slate: { bg: 'bg-slate-500/15', text: 'text-slate-400', label: 'text-slate-400' },
    };
    const c = colorClasses[color] || colorClasses.slate;

    return (
        <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-lg">
            <span className={`text-[10px] font-black tracking-wider uppercase ${c.label}`}>{label}</span>
            <div className="flex items-center gap-3 mt-2">
                <div className={`w-12 h-12 rounded-full ${c.bg} flex items-center justify-center ${c.text} shrink-0`}>
                    {icon}
                </div>
                <span className="text-3xl font-black text-white">{value}</span>
            </div>
        </div>
    );
}
