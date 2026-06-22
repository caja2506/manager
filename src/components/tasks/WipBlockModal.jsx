/**
 * WIP Block Modal
 * ===============
 * Shown when a user tries to move a task to "in_progress"
 * but already has another task in that status.
 *
 * Collects:
 *  - Block reason (dropdown from delayCauses)
 *  - Responsible person for the delay (dropdown)
 */
import React, { useState } from 'react';
import { AlertTriangle, Pause, Play, X, User, MessageSquare, ArrowRight, ChevronDown, Zap } from 'lucide-react';

export default function WipBlockModal({
    isOpen,
    onClose,
    onConfirm,
    currentTask,      // { id, title } — the task currently in_progress
    newTask,           // { id, title } — the task the user wants to start
    teamMembers = [],  // [{ uid, displayName }]
    delayCauses = [],  // [{ id, name, active }]
    isLoading = false,
}) {
    const [selectedCauseId, setSelectedCauseId] = useState('');
    const [blockedByUserId, setBlockedByUserId] = useState('');
    const [blockedByName, setBlockedByName] = useState('');

    if (!isOpen) return null;

    const activeCauses = delayCauses.filter(c => c.active);
    const selectedCause = delayCauses.find(c => c.id === selectedCauseId);
    const canSubmit = selectedCauseId && blockedByUserId;

    const handleConfirm = () => {
        if (!canSubmit) return;
        onConfirm({
            blockedReason: selectedCause?.name || '',
            causeId: selectedCauseId,
            causeName: selectedCause?.name || '',
            blockedByUserId,
            blockedByName,
        });
    };

    const handleSelectResponsible = (uid) => {
        setBlockedByUserId(uid);
        if (uid === '__external__') {
            setBlockedByName('Externo');
        } else if (uid === '__na__') {
            setBlockedByName('No aplica');
        } else {
            const member = teamMembers.find(m => (m.uid || m.id) === uid);
            setBlockedByName(member?.displayName || member?.name || member?.email?.split('@')[0] || uid);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center animate-in fade-in duration-200">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl shadow-amber-500/10 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center gap-3 p-5 pb-3 border-b border-slate-800">
                    <div className="w-10 h-10 bg-violet-500/15 border border-violet-500/30 rounded-xl flex items-center justify-center">
                        <Zap className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-black text-lg text-white">Tarea en Progreso Activa</h3>
                        <p className="text-xs text-slate-400 font-bold">Solo puedes tener una tarea activa a la vez</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {/* Current Task Info */}
                    <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 space-y-3">
                        <div className="flex items-start gap-3">
                            <Pause className="w-4 h-4 text-amber-500 shrink-0 mt-1" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] uppercase tracking-wider text-amber-500/80 font-black">Se suspenderá (en pausa)</p>
                                <p className="text-xs font-bold text-slate-200 mt-0.5 whitespace-normal break-words leading-relaxed">{currentTask?.title || 'Tarea actual'}</p>
                            </div>
                        </div>
                        <div className="border-t border-slate-700/30 my-1" />
                        <div className="flex items-start gap-3">
                            <Play className="w-4 h-4 text-emerald-500 shrink-0 mt-1 fill-emerald-500/20" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] uppercase tracking-wider text-emerald-400 font-black">Se activará (en progreso)</p>
                                <p className="text-xs font-bold text-emerald-300 mt-0.5 whitespace-normal break-words leading-relaxed">{newTask?.title || 'Nueva tarea'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Block Reason — Dropdown */}
                    <div>
                        <label className="flex items-center gap-2 text-xs font-black text-slate-300 mb-2">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                            Razón del cambio <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <select
                                value={selectedCauseId}
                                onChange={(e) => setSelectedCauseId(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all appearance-none cursor-pointer"
                            >
                                <option value="" className="text-slate-500">Seleccionar causa...</option>
                                {activeCauses.map(cause => (
                                    <option key={cause.id} value={cause.id}>{cause.name}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>
                    </div>

                    {/* Responsible Person */}
                    <div>
                        <label className="flex items-center gap-2 text-xs font-black text-slate-300 mb-2">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            ¿Quién decidió el cambio? <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <select
                                value={blockedByUserId}
                                onChange={(e) => handleSelectResponsible(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all appearance-none cursor-pointer"
                            >
                                <option value="" className="text-slate-500">Seleccionar persona...</option>
                                {teamMembers
                                    .filter(m => m.uid || m.id)
                                    .sort((a, b) => (a.displayName || a.name || '').localeCompare(b.displayName || b.name || ''))
                                    .map(m => {
                                        const uid = m.uid || m.id;
                                        const name = m.displayName || m.name || m.email?.split('@')[0] || uid;
                                        return <option key={uid} value={uid}>{name}</option>;
                                    })
                                }
                                <option value="__external__">🌐 Externo (proveedor/cliente)</option>
                                <option value="__na__">— No aplica</option>
                            </select>
                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-5 pt-3 border-t border-slate-800">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2.5 text-sm font-bold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!canSubmit || isLoading}
                        className="px-5 py-2.5 text-sm font-black bg-violet-500 hover:bg-violet-600 text-white rounded-xl shadow-lg shadow-violet-500/20 transition-all disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none active:scale-[0.97] flex items-center gap-2"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                        ) : (
                            <Pause className="w-4 h-4" />
                        )}
                        Suspender e Iniciar
                    </button>
                </div>
            </div>
        </div>
    );
}

