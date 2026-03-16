import React, { useState } from 'react';
import { Beaker, ArrowRightLeft, Loader2, BarChart3 } from 'lucide-react';
import { simulateChange, formatPercent, formatDelta, getConfidenceColor, getConfidenceLabel } from '../../automation/optimizationService';

const SIMULATION_TYPES = [
    { value: 'schedule_change', label: '📅 Cambio de Horario', description: 'Mover rutina a diferente hora' },
    { value: 'grace_period_change', label: '⏱️ Grace Period', description: 'Ajustar tiempo de gracia' },
    { value: 'frequency_change', label: '🔄 Frecuencia', description: 'Cambiar frecuencia de rutina' },
    { value: 'format_change', label: '📝 Formato', description: 'Simplificar/complejizar reporte' },
    { value: 'add_checkpoint', label: '✅ Checkpoint', description: 'Agregar punto de control' },
];

export default function SimulationPanel({ routines = [] }) {
    const [selectedType, setSelectedType] = useState('');
    const [params, setParams] = useState({});
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleSimulate = async () => {
        if (!selectedType) return;
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await simulateChange(selectedType, params);
            setResult(res);
        } catch (err) {
            setError(err.message || 'Error al simular');
        } finally {
            setLoading(false);
        }
    };

    const updateParam = (key, value) => setParams(p => ({ ...p, [key]: value }));

    return (
        <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-4">
                <Beaker className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-semibold text-slate-200">Simulación What-If</h3>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {SIMULATION_TYPES.map(st => (
                    <button
                        key={st.value}
                        onClick={() => { setSelectedType(st.value); setResult(null); setParams({}); }}
                        className={`text-left p-2 rounded-lg border text-xs transition-all ${selectedType === st.value
                                ? 'bg-purple-500/20 border-purple-500/50 text-purple-200'
                                : 'bg-slate-900/50 border-slate-700/30 text-slate-400 hover:border-slate-600'
                            }`}
                    >
                        <div className="font-medium">{st.label}</div>
                        <div className="text-[10px] mt-0.5 opacity-70">{st.description}</div>
                    </button>
                ))}
            </div>

            {/* Parameters (context-dependent) */}
            {selectedType && (
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 mb-4 space-y-2">
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Parámetros</p>

                    {selectedType === 'schedule_change' && (
                        <>
                            <label className="block">
                                <span className="text-xs text-slate-400">Nueva hora (0-23)</span>
                                <input type="number" min={0} max={23} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200" value={params.newHour || ''} onChange={e => updateParam('newHour', parseInt(e.target.value) || 0)} />
                            </label>
                            {routines.length > 0 && (
                                <label className="block">
                                    <span className="text-xs text-slate-400">Rutina</span>
                                    <select className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200" value={params.routineKey || ''} onChange={e => { updateParam('routineKey', e.target.value); updateParam('routineName', routines.find(r => r.key === e.target.value)?.name || e.target.value); }}>
                                        <option value="">Seleccionar...</option>
                                        {routines.map(r => <option key={r.key || r.id} value={r.key || r.id}>{r.name || r.key}</option>)}
                                    </select>
                                </label>
                            )}
                        </>
                    )}

                    {selectedType === 'grace_period_change' && (
                        <>
                            <label className="block">
                                <span className="text-xs text-slate-400">Grace actual (min)</span>
                                <input type="number" min={5} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200" value={params.currentMinutes || 30} onChange={e => updateParam('currentMinutes', parseInt(e.target.value) || 30)} />
                            </label>
                            <label className="block">
                                <span className="text-xs text-slate-400">Nuevo grace (min)</span>
                                <input type="number" min={5} className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200" value={params.newMinutes || 60} onChange={e => updateParam('newMinutes', parseInt(e.target.value) || 60)} />
                            </label>
                        </>
                    )}

                    {selectedType === 'frequency_change' && (
                        <>
                            <label className="block">
                                <span className="text-xs text-slate-400">Frecuencia actual</span>
                                <select className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200" value={params.currentFrequency || 'daily'} onChange={e => updateParam('currentFrequency', e.target.value)}>
                                    <option value="daily">Diaria</option>
                                    <option value="weekly">Semanal</option>
                                </select>
                            </label>
                            <label className="block">
                                <span className="text-xs text-slate-400">Nueva frecuencia</span>
                                <select className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200" value={params.newFrequency || 'weekly'} onChange={e => updateParam('newFrequency', e.target.value)}>
                                    <option value="daily">Diaria</option>
                                    <option value="weekly">Semanal</option>
                                </select>
                            </label>
                        </>
                    )}

                    {selectedType === 'format_change' && (
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={params.simplify !== false} onChange={e => updateParam('simplify', e.target.checked)} className="rounded" />
                            <span className="text-xs text-slate-400">Simplificar formato</span>
                        </label>
                    )}

                    {selectedType === 'add_checkpoint' && (
                        <label className="block">
                            <span className="text-xs text-slate-400">Descripción del checkpoint</span>
                            <input type="text" className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200" value={params.checkpointDescription || ''} onChange={e => updateParam('checkpointDescription', e.target.value)} placeholder="Ej: verificar estado de componentes" />
                        </label>
                    )}

                    <button
                        onClick={handleSimulate}
                        disabled={loading}
                        className="mt-2 w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 text-white text-xs font-medium py-2 rounded-lg transition-colors"
                    >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRightLeft className="w-3 h-3" />}
                        {loading ? 'Simulando...' : 'Ejecutar Simulación'}
                    </button>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
                    <p className="text-xs text-red-400">{error}</p>
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="bg-slate-900/50 rounded-lg p-4 border border-purple-500/30">
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="w-4 h-4 text-purple-400" />
                        <h4 className="text-xs font-semibold text-slate-200">{result.scenario}</h4>
                    </div>

                    <div className="space-y-2 mb-3">
                        {Object.entries(result.estimatedImpact || {}).map(([metric, impact]) => (
                            <div key={metric} className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">{metric}</span>
                                {impact.before !== undefined ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">{formatPercent(impact.before)}</span>
                                        <span className="text-slate-600">→</span>
                                        <span className={impact.delta > 0 ? 'text-emerald-400' : impact.delta < 0 ? 'text-red-400' : 'text-slate-400'}>
                                            {formatPercent(impact.after)}
                                        </span>
                                        <span className={`text-[10px] ${impact.delta > 0 ? 'text-emerald-500' : impact.delta < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                            ({formatDelta(impact.delta)})
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-slate-400">{JSON.stringify(impact)}</span>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-slate-500">Confianza:</span>
                        <span className="text-[10px] font-medium" style={{ color: getConfidenceColor(result.confidence) }}>
                            {getConfidenceLabel(result.confidence)} ({(result.confidence * 100).toFixed(0)}%)
                        </span>
                    </div>

                    {result.assumptions?.length > 0 && (
                        <div className="mt-2">
                            <p className="text-[10px] text-slate-500 font-medium mb-1">Supuestos:</p>
                            {result.assumptions.map((a, i) => (
                                <p key={i} className="text-[10px] text-slate-500 pl-2">• {a}</p>
                            ))}
                        </div>
                    )}

                    {result.risks?.length > 0 && (
                        <div className="mt-2">
                            <p className="text-[10px] text-amber-500/70 font-medium mb-1">Riesgos:</p>
                            {result.risks.map((r, i) => (
                                <p key={i} className="text-[10px] text-amber-500/50 pl-2">⚠ {r}</p>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
