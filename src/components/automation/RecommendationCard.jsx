import React from 'react';
import { Lightbulb } from 'lucide-react';
import { getPriorityColor } from '../../automation/analyticsService';

export default function RecommendationCard({ recommendations }) {
    const recs = recommendations || [];

    if (recs.length === 0) {
        return (
            <div style={{
                background: '#1e293b', borderRadius: '16px', padding: '20px',
                border: '1px solid rgba(99,102,241,0.15)',
            }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>
                    <Lightbulb size={16} style={{ marginRight: '8px', color: '#6366f1' }} />
                    Recomendaciones
                </h3>
                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>
                    Sin recomendaciones para este período.
                </div>
            </div>
        );
    }

    return (
        <div style={{
            background: '#1e293b', borderRadius: '16px', padding: '20px',
            border: '1px solid rgba(99,102,241,0.15)',
        }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>
                <Lightbulb size={16} style={{ marginRight: '8px', color: '#f59e0b' }} />
                Recomendaciones ({recs.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recs.slice(0, 6).map((rec, i) => (
                    <div key={i} style={{
                        background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                        padding: '14px', borderLeft: `3px solid ${getPriorityColor(rec.priority)}`,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>
                                {rec.title}
                            </span>
                            <span style={{
                                fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                                background: getPriorityColor(rec.priority) + '22',
                                color: getPriorityColor(rec.priority),
                                textTransform: 'uppercase', whiteSpace: 'nowrap', marginLeft: '8px',
                            }}>
                                {rec.priority}
                            </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                            {rec.description}
                        </div>
                        {rec.metricBacking && (
                            <div style={{ fontSize: '10px', color: '#6366f1', marginBottom: '8px', fontFamily: 'monospace' }}>
                                📊 {rec.metricBacking}
                            </div>
                        )}
                        {rec.suggestedActions && rec.suggestedActions.length > 0 && (
                            <div style={{ marginTop: '6px' }}>
                                {rec.suggestedActions.map((action, j) => (
                                    <div key={j} style={{ fontSize: '11px', color: '#cbd5e1', marginBottom: '3px' }}>
                                        → {action}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
