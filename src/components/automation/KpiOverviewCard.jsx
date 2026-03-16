import React from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatKpiValue, getKpiColor } from '../../automation/analyticsService';

const KPI_LABELS = {
    responseRate: { label: 'Tasa de Respuesta', polarity: 'higher' },
    onTimeResponseRate: { label: 'Puntualidad', polarity: 'higher' },
    lateResponseRate: { label: 'Respuestas Tardías', polarity: 'lower' },
    escalationRate: { label: 'Escalaciones', polarity: 'lower' },
    incidentRate: { label: 'Incidentes', polarity: 'lower' },
    reportCompletionRate: { label: 'Completitud de Reportes', polarity: 'higher' },
    routineSuccessRate: { label: 'Éxito de Rutinas', polarity: 'higher' },
    aiAssistedRate: { label: 'Procesado con IA', polarity: 'higher' },
    confirmationRequestRate: { label: 'Confirmación IA', polarity: 'neutral' },
    audioUsageRate: { label: 'Uso de Audio', polarity: 'neutral' },
    deliveryFailureRate: { label: 'Fallas de Envío', polarity: 'lower' },
    activeParticipationRate: { label: 'Participación Activa', polarity: 'higher' },
};

export default function KpiOverviewCard({ globalKpis, trends }) {
    const kpis = globalKpis || {};

    return (
        <div style={{
            background: '#1e293b', borderRadius: '16px', padding: '20px',
            border: '1px solid rgba(99,102,241,0.15)',
        }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>
                <BarChart3 size={16} style={{ marginRight: '8px', verticalAlign: 'middle', color: '#6366f1' }} />
                KPIs Operativos
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {Object.entries(KPI_LABELS).map(([key, meta]) => {
                    const kpi = kpis[key];
                    const value = kpi?.value ?? (typeof kpi === 'number' ? kpi : null);
                    const trend = trends?.[key];

                    return (
                        <div key={key} style={{
                            background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                            padding: '12px', position: 'relative',
                            borderLeft: `3px solid ${value !== null ? getKpiColor(value, meta.polarity) : '#334155'}`,
                        }}>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                                {meta.label}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                <span style={{
                                    fontSize: '20px', fontWeight: 800,
                                    color: value !== null ? getKpiColor(value, meta.polarity) : '#475569',
                                }}>
                                    {formatKpiValue(value)}
                                </span>
                                {trend?.hasHistory && (
                                    <span style={{
                                        fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px',
                                        color: trend.isImproving === true ? '#22c55e'
                                            : trend.isImproving === false ? '#ef4444'
                                                : '#94a3b8',
                                    }}>
                                        {trend.direction === 'up' ? <TrendingUp size={12} /> :
                                            trend.direction === 'down' ? <TrendingDown size={12} /> :
                                                <Minus size={12} />}
                                        {trend.deltaPercent !== null ? `${trend.deltaPercent > 0 ? '+' : ''}${trend.deltaPercent}%` : ''}
                                    </span>
                                )}
                            </div>
                            {kpi?.numerator !== undefined && kpi?.denominator !== undefined && (
                                <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>
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
