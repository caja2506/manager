import React from 'react';
import { AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { getSeverityColor } from '../../automation/analyticsService';

export default function RiskFlagsCard({ riskFlags }) {
    const flags = riskFlags || [];

    if (flags.length === 0) {
        return (
            <div style={{
                background: '#1e293b', borderRadius: '16px', padding: '20px',
                border: '1px solid rgba(34,197,94,0.2)',
            }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>
                    <AlertTriangle size={16} style={{ marginRight: '8px', color: '#22c55e' }} />
                    Señales de Riesgo
                </h3>
                <div style={{ textAlign: 'center', padding: '20px', color: '#22c55e', fontSize: '13px' }}>
                    ✅ Sin alertas activas. Operación saludable.
                </div>
            </div>
        );
    }

    return (
        <div style={{
            background: '#1e293b', borderRadius: '16px', padding: '20px',
            border: '1px solid rgba(239,68,68,0.2)',
        }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>
                <AlertTriangle size={16} style={{ marginRight: '8px', color: '#f59e0b' }} />
                Señales de Riesgo ({flags.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {flags.slice(0, 8).map((flag, i) => (
                    <div key={i} style={{
                        background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                        padding: '12px 14px', borderLeft: `3px solid ${getSeverityColor(flag.severity)}`,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                                {flag.kpiName?.replace(/([A-Z])/g, ' $1').trim() || 'Alerta'}
                            </span>
                            <span style={{
                                fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                                background: getSeverityColor(flag.severity) + '22',
                                color: getSeverityColor(flag.severity),
                                textTransform: 'uppercase',
                            }}>
                                {flag.severity}
                            </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                            {flag.justification}
                        </div>
                        {flag.suggestedAction && (
                            <div style={{ fontSize: '11px', color: '#6366f1', fontStyle: 'italic' }}>
                                💡 {flag.suggestedAction}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
