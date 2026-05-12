import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    AlertTriangle, Info, ChevronRight, X, CheckCircle, AlertOctagon,
    ShieldAlert, Zap, PauseCircle, ChevronDown, User, MessageSquare, Search
} from 'lucide-react';

/**
 * TransitionConfirmModal
 * ======================
 * 
 * Enhanced modal with animated category picker + searchable comboboxes.
 * When going from in_progress → backward, shows reason picker.
 */

const PAUSE_CATEGORIES = [
    {
        id: 'impediment',
        label: 'Impedimento',
        description: 'No puedo avanzar por un bloqueo externo',
        icon: ShieldAlert,
        color: 'rose',
        targetStatus: 'blocked',
        needsDetails: true,
        needsResponsible: true,
    },
    {
        id: 'priority_change',
        label: 'Cambio de prioridad',
        description: 'Me asignaron otra tarea urgente',
        icon: Zap,
        color: 'violet',
        targetStatus: 'pending',
        logType: 'task_preempted',
        needsDetails: false,
        needsResponsible: true,
    },
    {
        id: 'normal_pause',
        label: 'Pausa normal',
        description: 'Fin de jornada, reunión, break, etc.',
        icon: PauseCircle,
        color: 'slate',
        targetStatus: 'pending',
        logType: null,
        needsDetails: false,
        needsResponsible: false,
    },
];

/* ── Searchable Combobox ── */
function SearchableCombobox({ options, value, onChange, placeholder, emptyLabel, accentColor = 'indigo' }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef(null);
    const inputRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase())
    );

    const selectedLabel = options.find(o => o.value === value)?.label || '';

    const colorClasses = {
        rose: 'border-rose-500/50 ring-rose-500/30',
        violet: 'border-violet-500/50 ring-violet-500/30',
        indigo: 'border-indigo-500/50 ring-indigo-500/30',
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }}
                className={`w-full flex items-center justify-between bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-left transition-all cursor-pointer hover:bg-slate-750 ${
                    open ? `${colorClasses[accentColor] || colorClasses.indigo} ring-1` : 'border-slate-700'
                }`}
            >
                <span className={value ? 'text-white' : 'text-slate-500'}>
                    {selectedLabel || placeholder || 'Seleccionar...'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-50 mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Search input */}
                    <div className="p-2 border-b border-slate-700/50">
                        <div className="flex items-center gap-2 bg-slate-900/80 rounded-lg px-2.5 py-1.5">
                            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Buscar..."
                                className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                            />
                        </div>
                    </div>
                    {/* Options */}
                    <div className="max-h-[200px] overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-500 italic">{emptyLabel || 'Sin resultados'}</div>
                        ) : (
                            filtered.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { onChange(opt.value, opt.label); setOpen(false); setQuery(''); }}
                                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                                        opt.value === value
                                            ? 'bg-indigo-500/15 text-indigo-300 font-bold'
                                            : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                                    }`}
                                >
                                    {opt.icon && <span className="text-sm">{opt.icon}</span>}
                                    <span className="truncate">{opt.label}</span>
                                    {opt.value === value && <CheckCircle className="w-3.5 h-3.5 text-indigo-400 ml-auto shrink-0" />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function TransitionConfirmModal({
    isOpen,
    pending,
    isTransitioning,
    onConfirm,
    onCancel,
    delayCauses = [],
    teamMembers = [],
}) {
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedCauseId, setSelectedCauseId] = useState('');
    const [selectedCauseName, setSelectedCauseName] = useState('');
    const [responsibleUserId, setResponsibleUserId] = useState('');
    const [responsibleName, setResponsibleName] = useState('');

    if (!isOpen || !pending) return null;

    const { task, targetStatus, warnings, missingFields } = pending;
    const hasBlockers = missingFields?.length > 0;

    const isBackwardFromInProgress =
        task?.status === 'in_progress' &&
        (targetStatus === 'pending' || targetStatus === 'backlog');

    const category = PAUSE_CATEGORIES.find(c => c.id === selectedCategory);

    const canSubmit = (() => {
        if (hasBlockers) return false;
        if (!isBackwardFromInProgress) return true;
        if (!category) return false;
        if (category.needsResponsible && !responsibleUserId) return false;
        if (category.id === 'impediment' && !selectedCauseId) return false;
        return true;
    })();

    // Build options for comboboxes
    const causeOptions = delayCauses
        .filter(c => c.active)
        .map(c => ({ value: c.id, label: c.name }));

    const memberOptions = [
        ...teamMembers
            .filter(m => m.uid || m.id)
            .sort((a, b) => (a.displayName || a.name || '').localeCompare(b.displayName || b.name || ''))
            .map(m => ({
                value: m.uid || m.id,
                label: m.displayName || m.name || m.email?.split('@')[0] || (m.uid || m.id),
                icon: '👤',
            })),
        { value: '__external__', label: 'Externo (proveedor/cliente)', icon: '🌐' },
        { value: '__na__', label: 'No aplica', icon: '—' },
    ];

    const handleConfirm = () => {
        if (!canSubmit) return;
        if (isBackwardFromInProgress && category) {
            onConfirm({
                pauseCategory: category.id,
                targetStatus: category.targetStatus,
                logType: category.logType || null,
                reason: category.id === 'impediment' ? selectedCauseName : category.label,
                causeId: selectedCauseId || null,
                causeName: selectedCauseName || null,
                responsibleUserId: responsibleUserId || null,
                responsibleName: responsibleName || null,
            });
        } else {
            onConfirm({});
        }
    };

    const handleCancel = () => {
        setSelectedCategory(null);
        setSelectedCauseId('');
        setSelectedCauseName('');
        setResponsibleUserId('');
        setResponsibleName('');
        onCancel();
    };

    const colorMap = {
        rose: {
            bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400',
            ring: 'ring-rose-500/50', glow: 'shadow-rose-500/20', hoverBg: 'hover:bg-rose-500/5',
            iconBg: 'bg-rose-500/20', gradient: 'from-rose-500/10 to-transparent',
        },
        violet: {
            bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-400',
            ring: 'ring-violet-500/50', glow: 'shadow-violet-500/20', hoverBg: 'hover:bg-violet-500/5',
            iconBg: 'bg-violet-500/20', gradient: 'from-violet-500/10 to-transparent',
        },
        slate: {
            bg: 'bg-slate-700/20', border: 'border-slate-600/30', text: 'text-slate-400',
            ring: 'ring-slate-500/50', glow: 'shadow-slate-500/10', hoverBg: 'hover:bg-slate-700/10',
            iconBg: 'bg-slate-600/30', gradient: 'from-slate-600/10 to-transparent',
        },
    };

    return createPortal(
        <div className="fixed inset-0 z-400 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCancel} />

            <div className="relative bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl shadow-black/50 w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {hasBlockers ? (
                            <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center">
                                <AlertOctagon className="w-5 h-5 text-rose-400" />
                            </div>
                        ) : isBackwardFromInProgress ? (
                            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center animate-pulse">
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                            </div>
                        ) : (
                            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                                <Info className="w-5 h-5 text-indigo-400" />
                            </div>
                        )}
                        <div>
                            <h3 className="text-lg font-black text-white">
                                {hasBlockers ? 'Campos Requeridos' : isBackwardFromInProgress ? '¿Por qué se detiene?' : 'Confirmar Transición'}
                            </h3>
                            {isBackwardFromInProgress && !hasBlockers && (
                                <p className="text-[10px] text-slate-500 mt-0.5">Selecciona el motivo para continuar</p>
                            )}
                        </div>
                    </div>
                    <button onClick={handleCancel} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Task Info */}
                <div className="px-5 py-3 bg-slate-800/50 border-b border-slate-800">
                    <p className="text-xs font-bold text-slate-300 truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{task.status}</span>
                        <ChevronRight className="w-3 h-3 text-slate-600" />
                        <span className={`text-[10px] font-bold uppercase ${category ? colorMap[category.color]?.text || 'text-indigo-400' : 'text-indigo-400'}`}>
                            {category ? category.targetStatus : targetStatus}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                    {/* ── Category Picker ── */}
                    {isBackwardFromInProgress && !hasBlockers && (
                        <div className="space-y-2">
                            {PAUSE_CATEGORIES.map((cat, idx) => {
                                const Icon = cat.icon;
                                const colors = colorMap[cat.color];
                                const isSelected = selectedCategory === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => {
                                            setSelectedCategory(cat.id);
                                            setSelectedCauseId('');
                                            setSelectedCauseName('');
                                            setResponsibleUserId('');
                                            setResponsibleName('');
                                        }}
                                        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 text-left group ${
                                            isSelected
                                                ? `${colors.bg} ${colors.border} ring-2 ${colors.ring} shadow-lg ${colors.glow}`
                                                : `bg-slate-800/30 border-slate-700/40 ${colors.hoverBg} hover:border-slate-600/50`
                                        }`}
                                        style={{ animationDelay: `${idx * 50}ms` }}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                                            isSelected ? `${colors.iconBg} scale-110` : 'bg-slate-700/40 group-hover:bg-slate-700/60'
                                        }`}>
                                            <Icon className={`w-5 h-5 transition-colors ${isSelected ? colors.text : 'text-slate-500 group-hover:text-slate-400'}`} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-sm font-bold transition-colors ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                                                {cat.label}
                                            </p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">{cat.description}</p>
                                        </div>
                                        {isSelected && (
                                            <div className={`w-6 h-6 rounded-full ${colors.iconBg} flex items-center justify-center shrink-0 animate-in zoom-in-50 duration-200`}>
                                                <CheckCircle className={`w-4 h-4 ${colors.text}`} />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Impediment: Searchable Cause Selector ── */}
                    {isBackwardFromInProgress && selectedCategory === 'impediment' && (
                        <div className="animate-in slide-in-from-top-2 duration-200 pt-1">
                            <label className="flex items-center gap-2 text-xs font-black text-rose-400 mb-2">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                Causa del bloqueo <span className="text-red-400">*</span>
                            </label>
                            <SearchableCombobox
                                options={causeOptions}
                                value={selectedCauseId}
                                onChange={(val, label) => { setSelectedCauseId(val); setSelectedCauseName(label); }}
                                placeholder="Buscar o seleccionar causa..."
                                emptyLabel="No hay causas configuradas"
                                accentColor="rose"
                            />
                        </div>
                    )}

                    {/* ── Responsible Person (impediment + priority) ── */}
                    {isBackwardFromInProgress && category?.needsResponsible && (
                        <div className="animate-in slide-in-from-top-2 duration-200 pt-1">
                            <label className="flex items-center gap-2 text-xs font-black mb-2" style={{ color: category.color === 'rose' ? '#f43f5e' : '#a78bfa' }}>
                                <User className="w-3.5 h-3.5" />
                                {selectedCategory === 'impediment' ? 'Responsable del atraso' : '¿Quién decidió el cambio?'} <span className="text-red-400">*</span>
                            </label>
                            <SearchableCombobox
                                options={memberOptions}
                                value={responsibleUserId}
                                onChange={(val, label) => { setResponsibleUserId(val); setResponsibleName(label); }}
                                placeholder="Buscar persona..."
                                accentColor={category.color === 'rose' ? 'rose' : 'violet'}
                            />
                        </div>
                    )}

                    {/* ── Standard: Missing Fields ── */}
                    {hasBlockers && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider">
                                Campos faltantes:
                            </h4>
                            {missingFields.map(field => (
                                <div key={field.name} className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                                    <AlertOctagon className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                                    <span className="text-xs font-bold text-slate-200">{field.label || field.name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Non-backward Warnings ── */}
                    {!isBackwardFromInProgress && warnings?.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">Advertencias:</h4>
                            {warnings.map((warning, i) => (
                                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                                    <span className="text-xs text-slate-300">{warning}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-end gap-3">
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isTransitioning || !canSubmit}
                        className={`px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all shadow-lg flex items-center gap-2 active:scale-95 disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none disabled:scale-100 ${
                            category?.color === 'rose' ? 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 shadow-rose-600/25' :
                            category?.color === 'violet' ? 'bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 shadow-violet-600/25' :
                            'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-600/25'
                        }`}
                    >
                        {isTransitioning ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                {category?.id === 'impediment' && <ShieldAlert className="w-4 h-4" />}
                                {category?.id === 'priority_change' && <Zap className="w-4 h-4" />}
                                {category?.id === 'normal_pause' && <PauseCircle className="w-4 h-4" />}
                                {!category && <CheckCircle className="w-4 h-4" />}
                                {category?.id === 'impediment' ? 'Reportar Bloqueo' : category?.id === 'priority_change' ? 'Registrar Cambio' : category?.id === 'normal_pause' ? 'Pausar Tarea' : 'Confirmar Transición'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
