/**
 * AreaScoreCard — V5 Phase 4B/C
 * ================================
 * Expandable card showing area score, trend, traffic light, and detail.
 * Config of task types is now done via the shared AreaTaskTypeRelationModal.
 */

import React, { useState } from 'react';
import {
    ChevronDown, ChevronUp, AlertTriangle, TrendingUp,
    TrendingDown, Minus, Lock, Clock, User, Trash2
} from 'lucide-react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { COLLECTIONS } from '../../models/schemas';

const TRAFFIC_COLORS = {
    green:  { bg: 'rgba(34,197,94,0.15)',  border: '#22c55e', text: '#22c55e', label: 'Verde' },
    yellow: { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#f59e0b', label: 'Amarillo' },
    red:    { bg: 'rgba(239,68,68,0.15)',   border: '#ef4444', text: '#ef4444', label: 'Rojo' },
};

const TREND_ICONS = {
    improving: { Icon: TrendingUp,   color: '#22c55e', label: 'Subiendo' },
    stable:    { Icon: Minus,        color: '#94a3b8', label: 'Estable' },
    declining: { Icon: TrendingDown, color: '#ef4444', label: 'Bajando' },
};

export default function AreaScoreCard({ areaId, areaName, result, workArea, onDeleted }) {
    const [expanded, setExpanded] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    if (!result) return null;

    const { score, trafficLight, trend, locks, penalties, factors, explanation } = result;
    const tl = TRAFFIC_COLORS[trafficLight?.value] || TRAFFIC_COLORS.green;
    const trendInfo = TREND_ICONS[trend] || TREND_ICONS.stable;
    const TrendIcon = trendInfo.Icon;

    const hasOverride = workArea?.trafficLightOverride;
    const currentFilter = workArea?.taskFilter?.typeMatch || [];

    const handleDelete = async () => {
        try {
            await deleteDoc(doc(db, COLLECTIONS.WORK_AREAS, areaId));
            if (onDeleted) onDeleted();
        } catch (err) {
            console.error('Error deleting area:', err);
        }
    };

    return (
        <div style={{
            background: 'rgba(15,23,42,0.6)',
            border: `1px solid ${tl.border}33`,
            borderRadius: '12px',
            padding: '16px',
            transition: 'all 0.2s ease',
            borderLeft: `4px solid ${tl.border}`,
        }}>
            {/* ── Header ── */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
            }}>
                <div onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, cursor: 'pointer' }}>
                    {/* Traffic light dot */}
                    <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: tl.border,
                        boxShadow: `0 0 8px ${tl.border}66`,
                        flexShrink: 0,
                    }} />

                    <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {areaName}
                            {currentFilter.length > 0 && (
                                <span style={{ color: '#14b8a6', fontSize: '10px', fontWeight: 600, background: 'rgba(20,184,166,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                                    {currentFilter.length} tipo{currentFilter.length > 1 ? 's' : ''}
                                </span>
                            )}
                            {currentFilter.length === 0 && (
                                <span style={{ color: '#f59e0b', fontSize: '10px', fontWeight: 600, background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                                    todas
                                </span>
                            )}
                        </div>
                        {workArea?.responsibleId && (
                            <div style={{ color: '#64748b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                <User size={10} /> {workArea.responsibleId}
                            </div>
                        )}
                    </div>
                </div>

                {/* Score + Trend + Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {/* Locks indicator */}
                    {locks?.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontSize: '12px' }}>
                            <Lock size={12} />
                            <span>{locks.length}</span>
                        </div>
                    )}

                    {/* Override badge */}
                    {hasOverride && (
                        <div style={{
                            background: 'rgba(139,92,246,0.15)',
                            color: '#a78bfa',
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600,
                        }}>OVERRIDE</div>
                    )}

                    {/* Trend */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <TrendIcon size={14} color={trendInfo.color} />
                    </div>

                    {/* Score */}
                    <div style={{
                        background: tl.bg,
                        color: tl.text,
                        fontWeight: 700,
                        fontSize: '16px',
                        padding: '4px 12px',
                        borderRadius: '8px',
                        minWidth: '48px',
                        textAlign: 'center',
                    }}>
                        {score}
                    </div>

                    {/* Expand chevron */}
                    <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b' }}>
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {/* ── Short reason (always visible) ── */}
            {explanation?.blockers?.[0] && (
                <div style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    paddingLeft: '24px',
                }}>
                    <AlertTriangle size={12} />
                    {explanation.blockers[0]}
                </div>
            )}

            {/* ── Expanded Detail ── */}
            {expanded && (
                <div style={{
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '1px solid rgba(148,163,184,0.1)',
                }}>
                    {/* Factors */}
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
                            Factores del Score
                        </div>
                        {factors?.map(f => (
                            <div key={f.key} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '4px 0',
                                fontSize: '12px',
                            }}>
                                <span style={{ color: '#cbd5e1' }}>{f.key.replace(/_/g, ' ')}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                        width: '80px', height: '4px',
                                        background: 'rgba(148,163,184,0.15)',
                                        borderRadius: '2px', overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            width: `${(f.ratio || 0) * 100}%`,
                                            height: '100%',
                                            background: f.ratio >= 0.7 ? '#22c55e' : f.ratio >= 0.4 ? '#f59e0b' : '#ef4444',
                                            borderRadius: '2px',
                                            transition: 'width 0.3s ease',
                                        }} />
                                    </div>
                                    <span style={{ color: '#94a3b8', minWidth: '40px', textAlign: 'right' }}>
                                        {f.points}/{f.weight}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Penalties */}
                    {penalties?.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                                Penalizaciones
                            </div>
                            {penalties.map((p, i) => (
                                <div key={i} style={{ color: '#fca5a5', fontSize: '12px', padding: '2px 0', display: 'flex', gap: '6px' }}>
                                    <span style={{ fontWeight: 600 }}>{p.deduction}</span>
                                    <span>{p.detail || p.label}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Improvements */}
                    {explanation?.improvements?.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ color: '#22c55e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                                ¿Cómo subir score?
                            </div>
                            {explanation.improvements.map((imp, i) => (
                                <div key={i} style={{ color: '#86efac', fontSize: '12px', padding: '2px 0' }}>
                                    → {imp}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Override info */}
                    {hasOverride && (
                        <div style={{
                            background: 'rgba(139,92,246,0.08)',
                            border: '1px solid rgba(139,92,246,0.2)',
                            borderRadius: '8px',
                            padding: '10px',
                            marginTop: '8px',
                        }}>
                            <div style={{ color: '#a78bfa', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                                Override Manual Activo
                            </div>
                            <div style={{ color: '#c4b5fd', fontSize: '12px' }}>
                                <div>Valor: <strong>{workArea.trafficLightOverride}</strong></div>
                                {workArea.trafficLightOverrideReason && <div>Razón: {workArea.trafficLightOverrideReason}</div>}
                                {workArea.trafficLightOverrideBy && <div>Por: {workArea.trafficLightOverrideBy}</div>}
                                {workArea.trafficLightOverrideExpires && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                        <Clock size={10} />
                                        Vence: {new Date(workArea.trafficLightOverrideExpires).toLocaleDateString('es-MX')}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Delete area */}
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(148,163,184,0.05)' }}>
                        {confirmDelete ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#fca5a5', fontSize: '11px' }}>¿Eliminar esta área del milestone?</span>
                                <button onClick={handleDelete} style={{
                                    padding: '4px 10px', background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                                }}>Sí, eliminar</button>
                                <button onClick={() => setConfirmDelete(false)} style={{
                                    padding: '4px 8px', background: 'none', color: '#64748b',
                                    border: 'none', cursor: 'pointer', fontSize: '11px',
                                }}>Cancelar</button>
                            </div>
                        ) : (
                            <button onClick={() => setConfirmDelete(true)} style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                padding: '4px 8px', background: 'none', border: 'none',
                                color: '#64748b', cursor: 'pointer', fontSize: '11px',
                            }}>
                                <Trash2 size={12} /> Eliminar área
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
