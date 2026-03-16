import React from 'react';
import { Calendar, Filter } from 'lucide-react';

const PERIODS = [
    { key: 'daily', label: 'Hoy' },
    { key: 'weekly', label: '7 días' },
    { key: 'monthly', label: '30 días' },
];

export default function AnalyticsFiltersBar({ periodType, onPeriodChange, loading }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 16px', background: 'rgba(99,102,241,0.06)',
            borderRadius: '12px', flexWrap: 'wrap',
        }}>
            <Filter size={16} style={{ color: '#6366f1' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>Período:</span>
            <div style={{ display: 'flex', gap: '4px' }}>
                {PERIODS.map(p => (
                    <button
                        key={p.key}
                        onClick={() => onPeriodChange(p.key)}
                        disabled={loading}
                        style={{
                            padding: '6px 14px', borderRadius: '8px', border: 'none',
                            fontSize: '12px', fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
                            background: periodType === p.key ? '#6366f1' : 'rgba(99,102,241,0.1)',
                            color: periodType === p.key ? '#fff' : '#94a3b8',
                            transition: 'all 0.2s',
                        }}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
            {loading && (
                <span style={{ fontSize: '12px', color: '#6366f1', marginLeft: 'auto' }}>
                    Calculando...
                </span>
            )}
        </div>
    );
}
