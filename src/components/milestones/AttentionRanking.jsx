/**
 * AttentionRanking — V5 Phase 4D
 * =================================
 * Priority attention list showing areas that need immediate review.
 * Sorted by traffic light (RED first), trend (declining first), then score.
 */

import React from 'react';
import { AlertOctagon, TrendingDown, Lock, AlertTriangle } from 'lucide-react';

const TRAFFIC_DOTS = {
    red:    '#ef4444',
    yellow: '#f59e0b',
    green:  '#22c55e',
};

export default function AttentionRanking({ ranking }) {
    if (!ranking || ranking.length === 0) return null;

    // Only show items that actually need attention (not green + stable)
    const needsAttention = ranking.filter(r =>
        r.trafficLight !== 'green' || r.trend === 'declining' || r.locks?.length > 0
    );

    if (needsAttention.length === 0) {
        return (
            <div style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#86efac',
                fontSize: '13px',
            }}>
                <span style={{ fontSize: '16px' }}>✓</span>
                Todas las áreas en buen estado — sin atención urgente requerida.
            </div>
        );
    }

    return (
        <div style={{
            background: 'rgba(239,68,68,0.04)',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: '10px',
            padding: '12px 16px',
        }}>
            <div style={{
                color: '#fca5a5',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
            }}>
                <AlertOctagon size={12} />
                Atención Prioritaria
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {needsAttention.map(item => (
                    <div
                        key={item.areaId}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            background: 'rgba(15,23,42,0.4)',
                            fontSize: '13px',
                        }}
                    >
                        {/* Traffic dot */}
                        <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: TRAFFIC_DOTS[item.trafficLight] || '#94a3b8',
                            boxShadow: `0 0 6px ${TRAFFIC_DOTS[item.trafficLight] || '#94a3b8'}44`,
                            flexShrink: 0,
                        }} />

                        {/* Area name */}
                        <span style={{ color: '#e2e8f0', fontWeight: 500, flex: 1 }}>
                            {item.name}
                        </span>

                        {/* Indicators */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {item.locks?.length > 0 && (
                                <Lock size={11} color="#ef4444" />
                            )}
                            {item.trend === 'declining' && (
                                <TrendingDown size={11} color="#ef4444" />
                            )}
                        </div>

                        {/* Short reason */}
                        <span style={{
                            color: '#94a3b8',
                            fontSize: '11px',
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}>
                            {item.topBlocker || item.topImprovement || `Score ${item.score}`}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
