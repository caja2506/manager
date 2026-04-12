import React, { useState } from 'react';
import {
    Clock, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
    Save, Calendar, Users as UsersIcon, Zap, AlertTriangle
} from 'lucide-react';
import { RUN_STATUS_CONFIG, RUN_STATUS } from '../../automation/constants.js';

/** Friendly cron-to-time parser for simple daily schedules */
function parseCronTime(cron) {
    if (!cron) return { hour: '07', minute: '00' };
    const parts = cron.split(' ');
    const minute = (parts[0] || '0').padStart(2, '0');
    const hour = (parts[1] || '7').padStart(2, '0');
    return { hour, minute };
}

/** Build cron from hour/minute keeping Mon-Fri */
function buildCron(hour, minute, existingCron) {
    const parts = (existingCron || '0 7 * * 1-5').split(' ');
    return `${parseInt(minute)} ${parseInt(hour)} ${parts[2] || '*'} ${parts[3] || '*'} ${parts[4] || '1-5'}`;
}

/** Friendly day labels */
const DAY_LABELS = [
    { key: '1', label: 'Lun' },
    { key: '2', label: 'Mar' },
    { key: '3', label: 'Mié' },
    { key: '4', label: 'Jue' },
    { key: '5', label: 'Vie' },
    { key: '6', label: 'Sáb' },
    { key: '0', label: 'Dom' },
];

/** Parse cron day-of-week field into array of day keys */
function parseCronDays(cron) {
    if (!cron) return ['1', '2', '3', '4', '5'];
    const parts = cron.split(' ');
    const dayField = parts[4] || '1-5';
    const days = new Set();
    dayField.split(',').forEach(segment => {
        if (segment.includes('-')) {
            const [start, end] = segment.split('-').map(Number);
            for (let i = start; i <= end; i++) days.add(String(i));
        } else {
            days.add(segment.trim());
        }
    });
    return Array.from(days);
}

/** Build day-of-week cron segment from selected days */
function buildDaysCron(selectedDays) {
    if (selectedDays.length === 0) return '1-5';
    const sorted = [...selectedDays].sort((a, b) => Number(a) - Number(b));
    return sorted.join(',');
}

/** Human-readable schedule description */
function formatSchedule(routine) {
    if (routine.scheduleType === 'event_driven') return 'Evento (automático)';
    if (routine.scheduleType === 'manual') return 'Ejecución manual';
    if (!routine.scheduleConfig?.cron) return 'Sin programar';

    const { hour, minute } = parseCronTime(routine.scheduleConfig.cron);
    const days = parseCronDays(routine.scheduleConfig.cron);
    const dayNames = days.map(d => DAY_LABELS.find(dl => dl.key === d)?.label || d).join(', ');
    return `${hour}:${minute} — ${dayNames}`;
}

/** Role label mapping */
const ROLE_LABELS = {
    manager: 'Manager',
    team_lead: 'Team Lead',
    engineer: 'Ingeniero',
    technician: 'Técnico',
};

/**
 * RoutineListCard
 * 
 * Displays automation routines with status badges, enable/disable toggles,
 * and expandable schedule configuration panel.
 */
export default function RoutineListCard({ routines = [], onToggleRoutine, onUpdateSchedule }) {
    const [expandedKey, setExpandedKey] = useState(null);

    if (routines.length === 0) {
        return (
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Rutinas</h3>
                <p className="text-sm text-slate-500 italic">No hay rutinas configuradas.</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">
                Rutinas ({routines.length})
            </h3>
            <div className="space-y-3">
                {routines.map(routine => (
                    <RoutineRow
                        key={routine.key || routine.id}
                        routine={routine}
                        isExpanded={expandedKey === (routine.key || routine.id)}
                        onToggleExpand={() => setExpandedKey(
                            expandedKey === (routine.key || routine.id) ? null : (routine.key || routine.id)
                        )}
                        onToggleRoutine={onToggleRoutine}
                        onUpdateSchedule={onUpdateSchedule}
                    />
                ))}
            </div>
        </div>
    );
}

function RoutineRow({ routine, isExpanded, onToggleExpand, onToggleRoutine, onUpdateSchedule }) {
    return (
        <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-colors overflow-hidden">
            {/* Main row */}
            <div className="flex items-center justify-between p-3">
                <button
                    onClick={onToggleExpand}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left group"
                >
                    {/* Status indicator */}
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${routine.enabled ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-600'
                        }`} />

                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">
                            {routine.name || routine.key}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] font-mono text-slate-500">
                                {routine.scheduleType}
                            </span>
                            {routine.lastStatus && (
                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${routine.lastStatus === RUN_STATUS.SUCCESS
                                    ? 'text-emerald-400 bg-emerald-400/10'
                                    : routine.lastStatus === RUN_STATUS.FAILED
                                        ? 'text-red-400 bg-red-400/10'
                                        : 'text-amber-400 bg-amber-400/10'
                                    }`}>
                                    {RUN_STATUS_CONFIG[routine.lastStatus]?.label || routine.lastStatus}
                                </span>
                            )}
                            <span className="text-[10px] text-slate-600">
                                P{routine.priority || '—'}
                            </span>
                            {/* Schedule time inline */}
                            {routine.scheduleType === 'daily' && routine.scheduleConfig?.cron && (
                                <span className="text-[10px] text-indigo-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatSchedule(routine)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Expand chevron */}
                    <div className="text-slate-500 group-hover:text-slate-300 transition-colors flex-shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </button>

                {/* Toggle */}
                <button
                    onClick={() => onToggleRoutine?.(routine)}
                    className={`flex-shrink-0 p-1 rounded-lg transition-colors ml-2 ${routine.enabled
                        ? 'text-emerald-400 hover:bg-emerald-400/10'
                        : 'text-slate-500 hover:bg-slate-700'
                        }`}
                    title={routine.enabled ? 'Desactivar' : 'Activar'}
                >
                    {routine.enabled
                        ? <ToggleRight className="w-6 h-6" />
                        : <ToggleLeft className="w-6 h-6" />
                    }
                </button>
            </div>

            {/* Expanded detail panel */}
            {isExpanded && (
                <RoutineDetailPanel
                    routine={routine}
                    onUpdateSchedule={onUpdateSchedule}
                />
            )}
        </div>
    );
}

function RoutineDetailPanel({ routine, onUpdateSchedule }) {
    const isSchedulable = routine.scheduleType === 'daily';
    const currentCron = routine.scheduleConfig?.cron || '0 7 * * 1-5';
    const currentTz = routine.scheduleConfig?.timezone || 'America/Costa_Rica';

    const { hour: initHour, minute: initMinute } = parseCronTime(currentCron);
    const initDays = parseCronDays(currentCron);

    const [hour, setHour] = useState(initHour);
    const [minute, setMinute] = useState(initMinute);
    const [selectedDays, setSelectedDays] = useState(initDays);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const hasChanges = (() => {
        const newCron = buildCron(hour, minute, currentCron);
        const newDaysCron = buildDaysCron(selectedDays);
        const fullCron = `${parseInt(minute)} ${parseInt(hour)} * * ${newDaysCron}`;
        return fullCron !== currentCron;
    })();

    const handleSave = async () => {
        if (!onUpdateSchedule || saving) return;
        setSaving(true);
        try {
            const newDaysCron = buildDaysCron(selectedDays);
            const newCron = `${parseInt(minute)} ${parseInt(hour)} * * ${newDaysCron}`;
            await onUpdateSchedule(routine.id || routine.key, {
                cron: newCron,
                timezone: currentTz,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Schedule update error:', err);
        } finally {
            setSaving(false);
        }
    };

    const toggleDay = (dayKey) => {
        setSelectedDays(prev =>
            prev.includes(dayKey)
                ? prev.filter(d => d !== dayKey)
                : [...prev, dayKey]
        );
    };

    return (
        <div className="border-t border-slate-700/30 p-4 space-y-4 bg-slate-900/30">
            {/* Description */}
            <p className="text-xs text-slate-400 leading-relaxed">
                {routine.description || 'Sin descripción'}
            </p>

            {/* Roles */}
            {routine.allowedRoles && routine.allowedRoles.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <UsersIcon className="w-3.5 h-3.5 text-slate-500" />
                    {routine.allowedRoles.map(role => (
                        <span key={role} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                            {ROLE_LABELS[role] || role}
                        </span>
                    ))}
                </div>
            )}

            {/* Schedule editor (only for daily routines) */}
            {isSchedulable ? (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-bold text-slate-300">Programación</span>
                        <span className="text-[10px] text-slate-600 font-mono">({currentTz})</span>
                    </div>

                    {/* Time picker */}
                    <div className="flex items-center gap-3">
                        <label className="text-[11px] text-slate-400 min-w-[40px]">Hora:</label>
                        <div className="flex items-center gap-1">
                            <select
                                value={hour}
                                onChange={(e) => setHour(e.target.value)}
                                className="bg-slate-800 border border-slate-600/50 rounded-lg px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 w-[70px]"
                            >
                                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                                    <option key={h} value={h}>{h}</option>
                                ))}
                            </select>
                            <span className="text-white font-bold">:</span>
                            <select
                                value={minute}
                                onChange={(e) => setMinute(e.target.value)}
                                className="bg-slate-800 border border-slate-600/50 rounded-lg px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 w-[70px]"
                            >
                                {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            <span className="text-[10px] text-slate-500 ml-2">hrs</span>
                        </div>
                    </div>

                    {/* Day picker */}
                    <div className="flex items-center gap-3">
                        <label className="text-[11px] text-slate-400 min-w-[40px]">Días:</label>
                        <div className="flex gap-1.5">
                            {DAY_LABELS.map(day => {
                                const isSelected = selectedDays.includes(day.key);
                                return (
                                    <button
                                        key={day.key}
                                        onClick={() => toggleDay(day.key)}
                                        className={`w-9 h-8 rounded-lg text-[10px] font-bold transition-all ${isSelected
                                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/30'
                                            : 'bg-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-700 border border-slate-700/50'
                                            }`}
                                    >
                                        {day.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Grace period info */}
                    {routine.gracePeriodMinutes > 0 && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <AlertTriangle className="w-3 h-3" />
                            Periodo de gracia: {routine.gracePeriodMinutes} min después de la hora programada
                        </div>
                    )}

                    {/* Save button */}
                    {hasChanges && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                            <Save className="w-3.5 h-3.5" />
                            {saving ? 'Guardando...' : 'Guardar Horario'}
                        </button>
                    )}

                    {saved && (
                        <p className="text-[10px] text-emerald-400 font-medium">✅ Horario actualizado correctamente</p>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <Zap className="w-3 h-3" />
                    {routine.scheduleType === 'event_driven'
                        ? 'Se ejecuta automáticamente cuando ocurre el evento correspondiente.'
                        : 'Se ejecuta manualmente desde el panel de acciones.'
                    }
                </div>
            )}

            {/* Last run info */}
            {routine.lastRunAt && (
                <div className="pt-2 border-t border-slate-700/20">
                    <p className="text-[10px] text-slate-600">
                        Última ejecución: {new Date(routine.lastRunAt).toLocaleString('es-CR', {
                            dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Costa_Rica'
                        })}
                    </p>
                </div>
            )}
        </div>
    );
}
