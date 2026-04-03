/**
 * IPS Weight Config Panel
 * =======================
 * Admin-only component for configuring IPS dimension weights per role.
 * Persists to Firestore settings collection with key `ips_weights`.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { COLLECTIONS } from '../../models/schemas';
import { DEFAULT_WEIGHTS } from '../../core/analytics/performanceScore';
import {
    Award, Save, RotateCcw, Loader2, CheckCircle, AlertTriangle,
    Zap, Shield, Gauge, Target, Users, Star, Eye,
} from 'lucide-react';

const SETTINGS_KEY = 'ips_weights';

const DIMENSION_META = {
    velocity:      { label: 'Velocidad',      icon: Zap,    desc: 'Tareas completadas vs esperadas'  },
    discipline:    { label: 'Disciplina',      icon: Shield, desc: 'Registro de horas & update status' },
    capacity:      { label: 'Capacidad',       icon: Gauge,  desc: 'Utilización óptima (~80%)'        },
    precision:     { label: 'Precisión',       icon: Target, desc: 'Estimated vs actual hours'        },
    collaboration: { label: 'Colaboración',    icon: Users,  desc: 'Sin bloqueos ni delays activos'   },
    leadership:    { label: 'Liderazgo Téc.',  icon: Star,   desc: 'Planificación a técnicos'         },
    oversight:     { label: 'Supervisión',     icon: Eye,    desc: 'Compliance & calidad de datos'     },
};

const ROLE_META = {
    engineer:   { label: 'Engineer',   emoji: '⚙️', color: '#6366f1' },
    team_lead:  { label: 'Team Lead',  emoji: '🎯', color: '#f59e0b' },
    technician: { label: 'Technician', emoji: '🔧', color: '#10b981' },
};

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Load custom weights from Firestore settings
 */
export async function loadCustomWeights() {
    try {
        const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, SETTINGS_KEY));
        if (snap.exists()) {
            return snap.data().value || null;
        }
    } catch (e) {
        console.warn('[IPS Config] Could not load custom weights:', e.message);
    }
    return null;
}

/**
 * Merge custom weights with defaults (custom overrides, defaults fill gaps)
 */
export function mergeWeights(custom) {
    if (!custom) return deepClone(DEFAULT_WEIGHTS);
    const merged = deepClone(DEFAULT_WEIGHTS);
    for (const role of Object.keys(merged)) {
        if (custom[role]) {
            for (const dim of Object.keys(merged[role])) {
                if (typeof custom[role][dim] === 'number') {
                    merged[role][dim] = custom[role][dim];
                }
            }
        }
    }
    return merged;
}


export default function IPSWeightConfigPanel() {
    const [weights, setWeights] = useState(() => deepClone(DEFAULT_WEIGHTS));
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    // Load on mount
    useEffect(() => {
        (async () => {
            const custom = await loadCustomWeights();
            if (custom) setWeights(mergeWeights(custom));
            setLoading(false);
        })();
    }, []);

    const handleChange = useCallback((role, dim, value) => {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 1) return;
        setWeights(prev => ({
            ...prev,
            [role]: { ...prev[role], [dim]: parseFloat(num.toFixed(2)) },
        }));
        setSaved(false);
    }, []);

    const handleReset = useCallback(() => {
        setWeights(deepClone(DEFAULT_WEIGHTS));
        setSaved(false);
    }, []);

    const handleSave = useCallback(async () => {
        setSaving(true);
        setError(null);
        try {
            // Validate sums (should be ~1.0 per role)
            for (const [role, dims] of Object.entries(weights)) {
                const sum = Object.values(dims).reduce((a, b) => a + b, 0);
                if (Math.abs(sum - 1.0) > 0.02) {
                    throw new Error(`${ROLE_META[role]?.label || role}: suma = ${sum.toFixed(2)} (debe ser ≈ 1.00)`);
                }
            }
            await setDoc(doc(db, COLLECTIONS.SETTINGS, SETTINGS_KEY), {
                key: SETTINGS_KEY,
                value: weights,
                description: 'Pesos de dimensiones IPS por rol',
                category: 'performance',
                updatedAt: new Date().toISOString(),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            setError(e.message);
        }
        setSaving(false);
    }, [weights]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 py-8 justify-center text-white/30">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando configuración IPS…
            </div>
        );
    }

    return (
        <div className="bg-slate-900/70 backdrop-blur-sm p-6 rounded-2xl border border-indigo-500/20 shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center">
                        <Award className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-black text-lg text-white">Pesos IPS por Rol</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            Individual Performance Score — Configuration
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleReset}
                        className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-500 transition-all flex items-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5" /> Reset
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="px-4 py-1.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 disabled:opacity-50 active:scale-95">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {saving ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </div>

            {/* Success / Error */}
            {saved && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-400 font-bold">
                    <CheckCircle className="w-4 h-4" /> Pesos guardados correctamente
                </div>
            )}
            {error && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-400 font-bold">
                    <AlertTriangle className="w-4 h-4" /> {error}
                </div>
            )}

            {/* Role tabs */}
            <div className="space-y-4">
                {Object.entries(ROLE_META).map(([role, meta]) => {
                    const dims = weights[role] || {};
                    const sum = Object.values(dims).reduce((a, b) => a + b, 0);
                    const sumOk = Math.abs(sum - 1.0) <= 0.02;

                    return (
                        <div key={role} className="rounded-xl border p-4" style={{
                            borderColor: `${meta.color}25`,
                            background: `${meta.color}05`,
                        }}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{meta.emoji}</span>
                                    <span className="font-bold text-sm text-white">{meta.label}</span>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    sumOk ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                           : 'bg-red-500/15 text-red-400 border border-red-500/25'
                                }`}>
                                    Σ = {(sum * 100).toFixed(0)}%
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {Object.entries(dims).map(([dim, val]) => {
                                    const dimMeta = DIMENSION_META[dim] || { label: dim, icon: Target, desc: '' };
                                    const DimIcon = dimMeta.icon;
                                    return (
                                        <div key={dim} className="flex items-center gap-2">
                                            <DimIcon size={14} style={{ color: meta.color }} className="shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <label className="text-[10px] font-bold text-white/60 block truncate">{dimMeta.label}</label>
                                                <input
                                                    type="range"
                                                    min="0" max="0.5" step="0.05"
                                                    value={val}
                                                    onChange={e => handleChange(role, dim, e.target.value)}
                                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                                    style={{
                                                        background: `linear-gradient(to right, ${meta.color} 0%, ${meta.color} ${val * 200}%, rgba(255,255,255,0.1) ${val * 200}%, rgba(255,255,255,0.1) 100%)`,
                                                    }}
                                                />
                                            </div>
                                            <span className="text-xs font-black w-10 text-right" style={{ color: meta.color }}>
                                                {(val * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Disclaimer */}
            <p className="mt-4 text-[10px] text-white/20 text-center">
                La suma de pesos por cada rol debe ser ≈ 100%. Los cambios aplican al próximo cálculo.
            </p>
        </div>
    );
}
