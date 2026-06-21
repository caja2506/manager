/**
 * WIP Config Panel
 * ================
 * Admin panel for configuring WIP (Work In Progress) limits.
 * Stored in settings/wipConfig.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase';
import { auth } from '../../firebase';
import { ListChecks, Save, Loader2 } from 'lucide-react';

export default function WipConfigPanel() {
    const [wipLimit, setWipLimit] = useState(1);
    const [enabled, setEnabled] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [saved, setSaved] = useState(false);

    // Load current config
    useEffect(() => {
        async function load() {
            try {
                const { data } = await supabase.from('settings').select('*').eq('key', 'wipConfig').single();
                if (data?.value) {
                    setWipLimit(data.value.globalWipLimit || 1);
                    setEnabled(data.value.enabled !== false);
                }
            } catch (err) {
                console.warn('[WipConfig] Load error:', err.message);
            }
            setIsLoading(false);
        }
        load();
    }, []);

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        setSaved(false);
        try {
            const payload = {
                globalWipLimit: wipLimit,
                enabled,
                updatedAt: new Date().toISOString(),
                updatedBy: auth.currentUser?.uid || null,
            };
            await supabase.from('settings').upsert({ key: 'wipConfig', value: payload, category: 'wip', updated_at: payload.updatedAt, updated_by: payload.updatedBy }, { onConflict: 'key' });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('[WipConfig] Save error:', err);
            alert('Error guardando configuración WIP: ' + err.message);
        }
        setIsSaving(false);
    }, [wipLimit, enabled]);

    if (isLoading) {
        return (
            <div className="bg-slate-900/70 backdrop-blur-sm p-6 rounded-2xl border border-slate-800 shadow-lg">
                <div className="flex items-center gap-3 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-bold">Cargando configuración WIP...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/70 backdrop-blur-sm p-6 rounded-2xl border border-cyan-500/20 shadow-lg">
            <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-cyan-600/20 border border-cyan-500/30 rounded-xl flex items-center justify-center">
                    <ListChecks className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                    <h3 className="font-black text-lg text-white">Límite WIP (Work In Progress)</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Máximo de tareas simultáneas en progreso por persona
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Enable/Disable toggle */}
                <div className="flex items-center justify-between bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                    <div>
                        <p className="text-sm font-bold text-white">Enforcement activo</p>
                        <p className="text-xs text-slate-400">
                            {enabled
                                ? 'Las personas no pueden tener más tareas en progreso que el límite'
                                : 'Sin restricción — cualquier cantidad de tareas simultáneas'}
                        </p>
                    </div>
                    <button
                        onClick={() => setEnabled(!enabled)}
                        className={`relative w-12 h-6 rounded-full transition-all duration-300 ${enabled ? 'bg-cyan-500' : 'bg-slate-600'}`}
                    >
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${enabled ? 'left-[26px]' : 'left-0.5'}`} />
                    </button>
                </div>

                {/* WIP Limit number */}
                {enabled && (
                    <div className="flex items-center gap-4 bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                        <div className="flex-1">
                            <p className="text-sm font-bold text-white">Límite por persona</p>
                            <p className="text-xs text-slate-400">
                                Recomendado: 1 (enfoque total en una tarea)
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setWipLimit(Math.max(1, wipLimit - 1))}
                                className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-black flex items-center justify-center transition-all active:scale-90"
                            >
                                −
                            </button>
                            <div className="w-12 h-10 bg-slate-700 rounded-xl flex items-center justify-center">
                                <span className="text-xl font-black text-cyan-400">{wipLimit}</span>
                            </div>
                            <button
                                onClick={() => setWipLimit(Math.min(5, wipLimit + 1))}
                                className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-black flex items-center justify-center transition-all active:scale-90"
                            >
                                +
                            </button>
                        </div>
                    </div>
                )}

                {/* Save button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`px-5 py-2.5 text-sm font-black rounded-xl shadow-lg transition-all active:scale-[0.97] flex items-center gap-2 ${
                            saved
                                ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                : 'bg-cyan-500 hover:bg-cyan-600 text-slate-900 shadow-cyan-500/20'
                        } disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none`}
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : saved ? (
                            '✓ Guardado'
                        ) : (
                            <><Save className="w-4 h-4" /> Guardar</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
