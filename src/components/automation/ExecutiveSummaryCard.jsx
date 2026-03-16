import React from 'react';
import { TrendingUp, TrendingDown, Minus, Activity, AlertTriangle, Shield } from 'lucide-react';
import { formatKpiValue, getKpiColor } from '../../automation/analyticsService';

export default function ExecutiveSummaryCard({ globalKpis, trendSummary, riskFlags, lastRefresh }) {
    const keyMetrics = [
        { key: 'responseRate', label: 'Respuesta', polarity: 'higher' },
        { key: 'onTimeResponseRate', label: 'Puntualidad', polarity: 'higher' },
        { key: 'escalationRate', label: 'Escalaciones', polarity: 'lower' },
        { key: 'routineSuccessRate', label: 'Rutinas OK', polarity: 'higher' },
    ];

    const criticalFlags = (riskFlags || []).filter(f => f.severity === 'critical' || f.severity === 'high');

    return (
        <div style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            borderRadius: '16px', padding: '24px', color: '#fff',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                        <Activity size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                        Resumen Ejecutivo
                    </h3>
                    {lastRefresh && (
                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                            Último cálculo: {new Date(lastRefresh.completedAt).toLocaleString('es-MX')}
                        </p>
                    )}
                </div>
                {trendSummary && (
                    <div style={{
                        display: 'flex', gap: '12px', fontSize: '12px',
                        background: 'rgba(255,255,255,0.1)', padding: '8px 14px', borderRadius: '10px',
                    }}>
                        <span style={{ color: '#22c55e' }}>
                            <TrendingUp size={14} /> {trendSummary.improving} mejorando
                        </span>
                        <span style={{ color: '#ef4444' }}>
                            <TrendingDown size={14} /> {trendSummary.deteriorating} empeorando
                        </span>
                        <span style={{ color: '#94a3b8' }}>
                            <Minus size={14} /> {trendSummary.stable} estable
                        </span>
                    </div>
                )}
            </div>

            {/* Key metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                {keyMetrics.map(m => {
                    const kpi = globalKpis?.[m.key];
                    const value = kpi?.value ?? (typeof kpi === 'number' ? kpi : null);
                    return (
                        <div key={m.key} style={{
                            background: 'rgba(255,255,255,0.08)', borderRadius: '12px',
                            padding: '14px', textAlign: 'center',
                        }}>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                                {m.label}
                            </div>
                            <div style={{
                                fontSize: '24px', fontWeight: 800,
                                color: value !== null ? getKpiColor(value, m.polarity) : '#94a3b8',
                            }}>
                                {formatKpiValue(value)}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Risk alerts */}
            {criticalFlags.length > 0 && (
                <div style={{
                    background: 'rgba(239,68,68,0.15)', borderRadius: '10px',
                    padding: '12px 16px', borderLeft: '3px solid #ef4444',
                }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#fca5a5', marginBottom: '6px' }}>
                        <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                        {criticalFlags.length} alerta(s) crítica(s)
                    </div>
                    {criticalFlags.slice(0, 3).map((f, i) => (
                        <div key={i} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                            • {f.justification}
                        </div>
                    ))}
                </div>
            )}

            {!globalKpis || Object.keys(globalKpis).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                    <Shield size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                    <br />Sin datos de analítica. Ejecuta un refresh para generar snapshots.
                </div>
            ) : null}
        </div>
    );
}
