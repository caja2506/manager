import React, { useState, useEffect } from 'react';
import { Brain, Save, Sunset, Sunrise, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_TIMEZONE } from '../../utils/timezoneConfig';

/**
 * ProactiveAgentSettings
 * Admin panel to configure ARIA proactive nudges (Heartbeat).
 * Stored in Firestore/Supabase: settings/proactiveAgent
 */
export default function ProactiveAgentSettings() {
    const { user } = useAuth();
    const [config, setConfig] = useState(null);
    const [enabled, setEnabled] = useState(true);
    const [startTime, setStartTime] = useState('08:00');
    const [endTime, setEndTime] = useState('18:00');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    // Subscribe to database
    useEffect(() => {
        let mounted = true;

        (async () => {
            const { data } = await supabase.from('settings').select('*').eq('key', 'proactiveAgent').single();
            if (mounted && data?.value) {
                const d = data.value;
                setConfig(d);
                setEnabled(d.enabled !== false);
                setStartTime(d.startTime || '08:00');
                setEndTime(d.endTime || '18:00');
            }
            if (mounted) setLoading(false);
        })();

        return () => {
            mounted = false;
        };
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const payload = {
                enabled,
                startTime,
                endTime,
                timezone: DEFAULT_TIMEZONE,
                updatedAt: new Date().toISOString(),
                updatedBy: user?.uid || null,
            };
            
            await supabase.from('settings').upsert({ 
                key: 'proactiveAgent', 
                value: payload, 
                category: 'ai', 
                updated_at: payload.updatedAt, 
                updated_by: payload.updatedBy 
            }, { onConflict: 'key' });
            
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            console.error('Error saving proactive agent settings:', e);
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex justify-center shadow-sm">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                        ARIA: Agente Proactivo
                    </h3>
                    <p className="text-[10px] text-slate-500">
                        Configuración de mensajes automáticos (Nudges)
                    </p>
                </div>
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
                <div>
                    <p className="text-sm font-bold text-slate-700">Activación Global</p>
                    <p className="text-xs text-slate-500">
                        Permitir que la IA envíe mensajes a los usuarios.
                    </p>
                </div>
                <button
                    onClick={() => setEnabled(!enabled)}
                    className={`relative w-12 h-7 rounded-full transition-all flex items-center shadow-inner ${
                        enabled ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                >
                    <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-sm ${
                        enabled ? 'left-6' : 'left-1'
                    }`} />
                </button>
            </div>

            {/* Time inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 mb-2">
                        <Sunrise className="w-3.5 h-3.5" /> Hora de Inicio (Apertura)
                    </label>
                    <input
                        type="time"
                        value={startTime}
                        onChange={e => setStartTime(e.target.value)}
                        disabled={!enabled}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 transition-all"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                        ARIA empezará a mandar mensajes después de esta hora.
                    </p>
                </div>
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 mb-2">
                        <Sunset className="w-3.5 h-3.5" /> Hora de Fin (Cierre)
                    </label>
                    <input
                        type="time"
                        value={endTime}
                        onChange={e => setEndTime(e.target.value)}
                        disabled={!enabled}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 transition-all"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                        ARIA se silenciará después de esta hora.
                    </p>
                </div>
            </div>

            {/* Info */}
            <div className="bg-indigo-50/50 rounded-xl p-3 mb-4 border border-indigo-100">
                <p className="text-[11px] text-indigo-800/80">
                    <strong className="text-indigo-900">Nota:</strong> El motor proactivo evalúa reglas cada 15 minutos. Si el "Heartbeat" ocurre fuera del horario definido, ARIA no evaluará ni enviará notificaciones a los ingenieros y técnicos. (Zona horaria: UTC-6).
                </p>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Guardar Ajustes
                </button>
                {saved && (
                    <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md animate-pulse">
                        ✓ Guardado
                    </span>
                )}
            </div>
        </div>
    );
}
