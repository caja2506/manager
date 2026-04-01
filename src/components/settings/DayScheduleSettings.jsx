import React, { useState, useEffect } from 'react';
import { Clock, Sunset, Sunrise, Save, Power, PowerOff } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

const SETTINGS_DOC = 'settings/daySchedule';

/**
 * DayScheduleSettings
 * Admin panel to configure automatic day close/open times.
 * Stored in Firestore: settings/daySchedule
 */
export default function DayScheduleSettings() {
    const { user } = useAuth();
    const [config, setConfig] = useState(null);
    const [closeTime, setCloseTime] = useState('18:00');
    const [openTime, setOpenTime] = useState('08:00');
    const [enabled, setEnabled] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Subscribe to Firestore
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'daySchedule'), snap => {
            if (snap.exists()) {
                const data = snap.data();
                setConfig(data);
                setCloseTime(data.closeTime || '18:00');
                setOpenTime(data.openTime || '08:00');
                setEnabled(data.enabled !== false);
            }
        });
        return unsub;
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await setDoc(doc(db, 'settings', 'daySchedule'), {
                closeTime,
                openTime,
                timezone: 'America/Costa_Rica',
                enabled,
                updatedAt: new Date().toISOString(),
                updatedBy: user?.uid || null,
            }, { merge: true });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            console.error('Error saving day schedule:', e);
        }
        setSaving(false);
    };

    return (
        <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5">
            {/* Header */}
            <div className="flex items-center gap-2 mb-5">
                <Clock className="w-5 h-5 text-orange-400" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">
                    Horario de Cierre / Apertura
                </h3>
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-800">
                <div>
                    <p className="text-sm font-bold text-white">Automatización activa</p>
                    <p className="text-xs text-slate-500">
                        Cierre y apertura automáticos de timers
                    </p>
                </div>
                <button
                    onClick={() => setEnabled(!enabled)}
                    className={`relative w-12 h-7 rounded-full transition-all ${
                        enabled ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                >
                    <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow ${
                        enabled ? 'left-6' : 'left-1'
                    }`} />
                </button>
            </div>

            {/* Time inputs */}
            <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-orange-400 mb-2">
                        <Sunset className="w-3.5 h-3.5" /> Hora de Cierre
                    </label>
                    <input
                        type="time"
                        value={closeTime}
                        onChange={e => setCloseTime(e.target.value)}
                        disabled={!enabled}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-40"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                        Detiene todos los timers activos
                    </p>
                </div>
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-2">
                        <Sunrise className="w-3.5 h-3.5" /> Hora de Apertura
                    </label>
                    <input
                        type="time"
                        value={openTime}
                        onChange={e => setOpenTime(e.target.value)}
                        disabled={!enabled}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-40"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                        Reactiva timers del día anterior
                    </p>
                </div>
            </div>

            {/* Info */}
            <div className="bg-slate-800/50 rounded-xl p-3 mb-4 border border-slate-700/50">
                <p className="text-[11px] text-slate-400">
                    <strong className="text-slate-300">Zona horaria:</strong> America/Costa_Rica (UTC-6)<br />
                    <strong className="text-slate-300">Cierre:</strong> Detiene timers + envía reportes Telegram<br />
                    <strong className="text-slate-300">Apertura:</strong> Reactiva timers para tareas en progreso
                </p>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg transition-all flex items-center gap-1.5 disabled:bg-slate-600"
                >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Guardando...' : 'Guardar'}
                </button>
                {saved && (
                    <span className="text-xs font-bold text-emerald-400 animate-in fade-in">
                        ✓ Guardado
                    </span>
                )}
                {config && (
                    <span className="text-[10px] text-slate-600 ml-auto">
                        Última actualización: {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : '—'}
                    </span>
                )}
            </div>
        </div>
    );
}
