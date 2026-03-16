import React from 'react';
import { Cog, CheckCircle, XCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { formatKpiValue, getKpiColor } from '../../automation/analyticsService';

export default function RoutineHealthCard({ routineScores }) {
    const routines = routineScores || [];

    if (routines.length === 0) {
        return (
            <div style={{
                background: '#1e293b', borderRadius: '16px', padding: '20px',
                border: '1px solid rgba(99,102,241,0.15)',
            }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>
                    <Cog size={16} style={{ marginRight: '8px', color: '#6366f1' }} />
                    Salud de Rutinas
                </h3>
                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>
                    Sin datos de rutinas para este período.
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
                <Cog size={16} style={{ marginRight: '8px', color: '#6366f1' }} />
                Salud de Rutinas ({routines.length})
            </h3>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <th style={{ textAlign: 'left', padding: '8px', color: '#94a3b8', fontWeight: 600 }}>Rutina</th>
                            <th style={{ textAlign: 'center', padding: '8px', color: '#94a3b8' }}>Runs</th>
                            <th style={{ textAlign: 'center', padding: '8px', color: '#94a3b8' }}>Éxito</th>
                            <th style={{ textAlign: 'center', padding: '8px', color: '#94a3b8' }}>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {routines.map((routine, i) => {
                            const successRate = routine.metrics?.routineSuccessRate?.value;
                            return (
                                <tr key={routine.entityId || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '10px 8px', color: '#e2e8f0', fontWeight: 600 }}>
                                        {routine.routineName || routine.entityId}
                                        {!routine.enabled && (
                                            <span style={{ fontSize: '9px', color: '#ef4444', marginLeft: '6px' }}>
                                                DESACTIVADA
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '8px', color: '#94a3b8' }}>
                                        {routine.totalRuns || 0}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '8px' }}>
                                        <span style={{
                                            fontWeight: 700,
                                            color: successRate !== undefined ? getKpiColor(successRate, 'higher') : '#475569',
                                        }}>
                                            {formatKpiValue(successRate)}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '8px' }}>
                                        {successRate >= 0.8 ? (
                                            <CheckCircle size={16} style={{ color: '#22c55e' }} />
                                        ) : successRate >= 0.5 ? (
                                            <TrendingDown size={16} style={{ color: '#f59e0b' }} />
                                        ) : (
                                            <XCircle size={16} style={{ color: '#ef4444' }} />
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
