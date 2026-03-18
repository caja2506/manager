/**
 * ScoreExplainer — V5 Phase 4E
 * ==============================
 * Interactive panel showing why a score is what it is.
 * Uses explainScore() output.
 */

import React from 'react';
import { Info, AlertTriangle, TrendingUp, Shield } from 'lucide-react';

export default function ScoreExplainer({ explanation }) {
    if (!explanation) return null;

    const { summary, reasons, improvements, blockers } = explanation;

    return (
        <div style={{
            background: 'rgba(15,23,42,0.5)',
            border: '1px solid rgba(148,163,184,0.1)',
            borderRadius: '10px',
            padding: '16px',
        }}>
            {/* Summary */}
            <div style={{
                color: '#f1f5f9',
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
            }}>
                <Info size={14} color="#818cf8" />
                {summary}
            </div>

            {/* Reasons */}
            {reasons?.length > 0 && (
                <Section icon={<Shield size={11} />} title="¿Por qué este score?" color="#818cf8">
                    {reasons.map((r, i) => (
                        <div key={i} style={{ color: '#c7d2fe', fontSize: '12px', padding: '2px 0' }}>
                            {r}
                        </div>
                    ))}
                </Section>
            )}

            {/* Improvements */}
            {improvements?.length > 0 && (
                <Section icon={<TrendingUp size={11} />} title="¿Cómo mejorar?" color="#22c55e">
                    {improvements.map((imp, i) => (
                        <div key={i} style={{ color: '#86efac', fontSize: '12px', padding: '2px 0' }}>
                            → {imp}
                        </div>
                    ))}
                </Section>
            )}

            {/* Blockers */}
            {blockers?.length > 0 && (
                <Section icon={<AlertTriangle size={11} />} title="¿Qué impide verde?" color="#f59e0b">
                    {blockers.map((b, i) => (
                        <div key={i} style={{ color: '#fde68a', fontSize: '12px', padding: '2px 0' }}>
                            ⚠ {b}
                        </div>
                    ))}
                </Section>
            )}
        </div>
    );
}

function Section({ icon, title, color, children }) {
    return (
        <div style={{ marginBottom: '10px' }}>
            <div style={{
                color,
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
            }}>
                {icon} {title}
            </div>
            {children}
        </div>
    );
}
