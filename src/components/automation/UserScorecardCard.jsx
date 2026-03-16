import React from 'react';
import { Users, Award, ChevronDown, ChevronUp } from 'lucide-react';
import { formatKpiValue, getKpiColor } from '../../automation/analyticsService';

const GRADE_COLORS = {
    A: '#22c55e', B: '#84cc16', C: '#f59e0b', D: '#f97316', F: '#ef4444',
};

export default function UserScorecardCard({ userScores }) {
    const scores = userScores || [];

    if (scores.length === 0) {
        return (
            <div style={{
                background: '#1e293b', borderRadius: '16px', padding: '20px',
                border: '1px solid rgba(99,102,241,0.15)',
            }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>
                    <Users size={16} style={{ marginRight: '8px', color: '#6366f1' }} />
                    Scorecards por Usuario
                </h3>
                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>
                    Sin datos de usuarios para este período.
                </div>
            </div>
        );
    }

    // Sort by composite score descending (if available), fall back to name
    const sorted = [...scores].sort((a, b) => {
        const scoreA = a.metrics?.responseRate?.value ?? 0;
        const scoreB = b.metrics?.responseRate?.value ?? 0;
        return scoreB - scoreA;
    });

    return (
        <div style={{
            background: '#1e293b', borderRadius: '16px', padding: '20px',
            border: '1px solid rgba(99,102,241,0.15)',
        }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>
                <Users size={16} style={{ marginRight: '8px', color: '#6366f1' }} />
                Scorecards por Usuario ({sorted.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sorted.slice(0, 10).map((user, i) => {
                    const metrics = user.metrics || {};
                    const kpiEntries = Object.entries(metrics).filter(([_, v]) => v?.value !== undefined);

                    return (
                        <div key={user.entityId || i} style={{
                            background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                            padding: '12px 14px',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>
                                        {user.userName || 'Usuario'}
                                    </span>
                                    <span style={{
                                        fontSize: '10px', color: '#6366f1', marginLeft: '8px',
                                        background: 'rgba(99,102,241,0.15)', padding: '2px 6px', borderRadius: '4px',
                                    }}>
                                        {user.userRole || 'N/A'}
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {kpiEntries.slice(0, 5).map(([key, val]) => (
                                    <div key={key} style={{ fontSize: '11px' }}>
                                        <span style={{ color: '#94a3b8' }}>
                                            {key.replace(/([A-Z])/g, ' $1').trim().substring(0, 15)}:
                                        </span>
                                        <span style={{
                                            fontWeight: 700, marginLeft: '4px',
                                            color: getKpiColor(val.value, key.includes('late') || key.includes('escalation') ? 'lower' : 'higher'),
                                        }}>
                                            {formatKpiValue(val.value)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
