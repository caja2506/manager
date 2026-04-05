import React, { useState, useEffect } from 'react';
import { Clock, Sunset, Sunrise, Save, Coffee, Plus, Trash2 } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

const DEFAULTS_BREAKS = [
    { id: 'desayuno', label: 'Desayuno', start: '08:00', end: '08:30' },
    { id: 'almuerzo', label: 'Almuerzo', start: '12:00', end: '13:00' },
    { id: 'cafe',     label: 'Café',     start: '15:30', end: '16:00' },
];

/**
 * DayScheduleSettings
 * Admin panel to configure automatic day close/open times and break bands.
 * Stored in Firestore: settings/daySchedule
 */
export default function DayScheduleSettings() {
    const { user } = useAuth();
    const [config, setConfig] = useState(null);
    const [closeTime, setCloseTime] = useState('18:00');
    const [openTime, setOpenTime] = useState('08:00');
    const [enabled, setEnabled] = useState(true);
    const [breakBands, setBreakBands] = useState(DEFAULTS_BREAKS);
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
                if (data.breakBands?.length) {
                    setBreakBands(data.breakBands);
                }
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
                breakBands,
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

    // Break band helpers
    const updateBreak = (idx, field, value) => {
        setBreakBands(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
    };

    const addBreak = () => {
        setBreakBands(prev => [...prev, {
            id: `break_${Date.now()}`,
            label: 'Nuevo break',
            start: '10:00',
            end: '10:15',
        }]);
    };

    const removeBreak = (idx) => {
        setBreakBands(prev => prev.filter((_, i) => i !== idx));
    };

    // Calculate total break minutes
    const totalBreakMinutes = breakBands.reduce((sum, b) => {
        const [sh, sm] = b.start.split(':').map(Number);
        const [eh, em] = b.end.split(':').map(Number);
        return sum + ((eh * 60 + em) - (sh * 60 + sm));
    }, 0);

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

            {/* ═══ Break Bands ═══ */}
            <div className="mb-5 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Coffee className="w-4 h-4 text-amber-400" />
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-300">
                            Franjas de Break
                        </h4>
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                            {totalBreakMinutes} min/día
                        </span>
                    </div>
                    <button
                        onClick={addBreak}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-700/80 hover:bg-slate-600 text-slate-300 rounded-lg text-[10px] font-bold transition-colors"
                    >
                        <Plus className="w-3 h-3" /> Agregar
                    </button>
                </div>

                <div className="space-y-2">
                    {breakBands.map((band, idx) => (
                        <div
                            key={band.id}
                            className="flex items-center gap-2 bg-slate-800/60 rounded-xl px-3 py-2 border border-slate-700/40"
                        >
                            <input
                                type="text"
                                value={band.label}
                                onChange={e => updateBreak(idx, 'label', e.target.value)}
                                className="w-28 bg-transparent text-xs font-bold text-amber-300 outline-none border-b border-transparent focus:border-amber-500"
                                placeholder="Nombre"
                            />
                            <input
                                type="time"
                                value={band.start}
                                onChange={e => updateBreak(idx, 'start', e.target.value)}
                                className="bg-slate-900/60 border border-slate-600/50 rounded-lg px-2 py-1 text-xs text-white font-bold outline-none focus:ring-1 focus:ring-amber-500 w-24"
                            />
                            <span className="text-slate-600 text-xs">→</span>
                            <input
                                type="time"
                                value={band.end}
                                onChange={e => updateBreak(idx, 'end', e.target.value)}
                                className="bg-slate-900/60 border border-slate-600/50 rounded-lg px-2 py-1 text-xs text-white font-bold outline-none focus:ring-1 focus:ring-amber-500 w-24"
                            />
                            <span className="text-[10px] text-slate-500 ml-1">
                                {(() => {
                                    const [sh, sm] = band.start.split(':').map(Number);
                                    const [eh, em] = band.end.split(':').map(Number);
                                    return `${(eh * 60 + em) - (sh * 60 + sm)} min`;
                                })()}
                            </span>
                            <button
                                onClick={() => removeBreak(idx)}
                                className="ml-auto text-slate-600 hover:text-red-400 transition-colors p-1"
                                title="Eliminar break"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>

                <p className="text-[10px] text-slate-500 mt-2">
                    Los timers se congelan durante estas franjas. Afecta: planner, reportes, y cálculo de horas.
                </p>
            </div>

            {/* Info */}
            <div className="bg-slate-800/50 rounded-xl p-3 mb-4 border border-slate-700/50">
                <p className="text-[11px] text-slate-400">
                    <strong className="text-slate-300">Zona horaria:</strong> America/Costa_Rica (UTC-6)<br />
                    <strong className="text-slate-300">Cierre:</strong> Detiene timers + envía reportes Telegram<br />
                    <strong className="text-slate-300">Apertura:</strong> Reactiva timers para tareas en progreso<br />
                    <strong className="text-slate-300">Breaks:</strong> Los timers se pausan automáticamente durante estas franjas
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
