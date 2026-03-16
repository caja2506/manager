import React from 'react';
import { Brain, Zap, Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatKpiValue, getKpiColor } from '../../automation/analyticsService';

export default function AIAnalyticsCard({ globalKpis }) {
    const kpis = globalKpis || {};

    const aiMetrics = [
        { key: 'aiAssistedRate', label: 'Procesado con IA', icon: Brain, polarity: 'higher' },
        { key: 'confirmationRequestRate', label: 'Tasa de Confirmación', icon: CheckCircle, polarity: 'neutral' },
        { key: 'audioUsageRate', label: 'Uso de Audio', icon: Zap, polarity: 'neutral' },
    ];

    return (
        <div style={{
            background: '#1e293b', borderRadius: '16px', padding: '20px',
            border: '1px solid rgba(139,92,246,0.2)',
        }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>
                <Brain size={16} style={{ marginRight: '8px', color: '#8b5cf6' }} />
                Analítica de IA
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {aiMetrics.map(m => {
                    const kpi = kpis[m.key];
                    const value = kpi?.value ?? (typeof kpi === 'number' ? kpi : null);
                    const Icon = m.icon;

                    return (
                        <div key={m.key} style={{
                            background: 'rgba(139,92,246,0.06)', borderRadius: '12px',
                            padding: '16px', textAlign: 'center',
                        }}>
                            <Icon size={20} style={{ color: '#8b5cf6', marginBottom: '8px' }} />
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
                                {m.label}
                            </div>
                            <div style={{
                                fontSize: '22px', fontWeight: 800,
                                color: value !== null ? getKpiColor(value, m.polarity) : '#475569',
                            }}>
                                {formatKpiValue(value)}
                            </div>
                            {kpi?.numerator !== undefined && (
                                <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px' }}>
                                    {kpi.numerator}/{kpi.denominator}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
