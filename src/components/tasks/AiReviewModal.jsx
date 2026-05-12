/**
 * AiReviewModal — Review AI-improved task descriptions before applying.
 *
 * Props:
 *   isOpen        — boolean
 *   onClose       — () => void
 *   suggestions   — [{ id, originalTitle, originalDescription, improvedTitle, improvedDescription }]
 *   isLoading     — boolean (show skeleton while AI processes)
 *   onApply       — (updates: [{ id, title, description }]) => Promise<void>
 */
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Check, RotateCcw, Loader2, Pencil } from 'lucide-react';

export default function AiReviewModal({ isOpen, onClose, suggestions = [], isLoading, onApply }) {
    // Each item: { ...suggestion, checked: bool, editedTitle, editedDescription }
    const [items, setItems] = useState([]);
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        if (suggestions.length > 0) {
            setItems(suggestions.map(s => ({
                ...s,
                checked: true,
                editedTitle: s.improvedTitle,
                editedDescription: s.improvedDescription,
            })));
        }
    }, [suggestions]);

    const toggleCheck = (idx) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, checked: !it.checked } : it));

    const updateField = (idx, field, value) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

    const resetItem = (idx) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, editedTitle: it.originalTitle, editedDescription: it.originalDescription } : it));

    const checkedCount = items.filter(i => i.checked).length;

    const handleApply = useCallback(async () => {
        const updates = items.filter(i => i.checked).map(i => ({
            id: i.id,
            title: i.editedTitle,
            description: i.editedDescription,
        }));
        if (updates.length === 0) return;
        setApplying(true);
        try {
            await onApply(updates);
            onClose();
        } catch (err) {
            console.error('Apply failed:', err);
        } finally {
            setApplying(false);
        }
    }, [items, onApply, onClose]);

    if (!isOpen) return null;

    const hasChanges = items.some(i => i.checked && (i.editedTitle !== i.originalTitle || i.editedDescription !== i.originalDescription));

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop — no click-to-close to prevent losing edits */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-full max-w-5xl max-h-[85vh] flex flex-col bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700/40 bg-gradient-to-r from-violet-500/10 via-transparent to-transparent">
                    <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-base font-bold text-white">Revisión de Mejoras</h2>
                        <p className="text-[11px] text-slate-400">
                            {isLoading ? 'Analizando las tareas...' : `${items.length} sugerencia${items.length !== 1 ? 's' : ''} generada${items.length !== 1 ? 's' : ''} — edita antes de aplicar`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
                            <p className="text-sm text-slate-400">Analizando las tareas...</p>
                            <p className="text-[11px] text-slate-600">Esto puede tomar unos segundos</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <p className="text-sm">No hay sugerencias disponibles</p>
                        </div>
                    ) : items.map((item, idx) => {
                        const titleChanged = item.editedTitle !== item.originalTitle;
                        const descChanged = item.editedDescription !== item.originalDescription;
                        return (
                            <div key={item.id}
                                className={`rounded-xl border transition-all ${item.checked
                                    ? 'border-violet-500/30 bg-slate-800/80'
                                    : 'border-slate-700/30 bg-slate-800/30 opacity-50'
                                    }`}
                            >
                                {/* Card header */}
                                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/20">
                                    <input
                                        type="checkbox"
                                        checked={item.checked}
                                        onChange={() => toggleCheck(idx)}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-violet-500 focus:ring-violet-500/30 cursor-pointer"
                                    />
                                    <span className="text-[11px] font-medium text-slate-400 flex-1">
                                        Tarea #{idx + 1}
                                    </span>
                                    <button
                                        onClick={() => resetItem(idx)}
                                        className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors flex items-center gap-1"
                                        title="Restaurar original"
                                    >
                                        <RotateCcw className="w-3 h-3" /> Restaurar
                                    </button>
                                </div>

                                {/* Title comparison */}
                                <div className="px-4 py-3 space-y-2">
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Título</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div className="rounded-lg bg-slate-900/60 px-3 py-2 border border-slate-700/20">
                                            <span className="text-[10px] text-slate-600 block mb-0.5">Original</span>
                                            <p className={`text-xs whitespace-pre-wrap ${titleChanged ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                                                {item.originalTitle || '(sin título)'}
                                            </p>
                                        </div>
                                        <div className={`rounded-lg px-3 py-2 border-2 ${titleChanged ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-800/60 border-violet-500/30'}`}>
                                            <span className="text-[10px] text-emerald-500/70 flex items-center gap-1 mb-1">
                                                <Pencil className="w-2.5 h-2.5" /> Propuesta (editable)
                                            </span>
                                            <textarea
                                                value={item.editedTitle}
                                                onChange={e => updateField(idx, 'editedTitle', e.target.value)}
                                                disabled={!item.checked}
                                                rows={1}
                                                ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                                className="w-full text-xs text-white bg-slate-900/50 border border-slate-600/50 rounded px-2 py-1.5 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors resize-none overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed placeholder:text-slate-600"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Description comparison */}
                                <div className="px-4 pb-3 space-y-2">
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Descripción</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div className="rounded-lg bg-slate-900/60 px-3 py-2 border border-slate-700/20">
                                            <span className="text-[10px] text-slate-600 block mb-0.5">Original</span>
                                            <p className={`text-xs whitespace-pre-wrap ${descChanged ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                                                {item.originalDescription || '(sin descripción)'}
                                            </p>
                                        </div>
                                        <div className={`rounded-lg px-3 py-2 border-2 ${descChanged ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-800/60 border-violet-500/30'}`}>
                                            <span className="text-[10px] text-emerald-500/70 flex items-center gap-1 mb-1">
                                                <Pencil className="w-2.5 h-2.5" /> Propuesta (editable)
                                            </span>
                                            <textarea
                                                value={item.editedDescription}
                                                onChange={e => updateField(idx, 'editedDescription', e.target.value)}
                                                disabled={!item.checked}
                                                rows={2}
                                                ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                                className="w-full text-xs text-white bg-slate-900/50 border border-slate-600/50 rounded px-2 py-1.5 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors resize-none overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed placeholder:text-slate-600"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                {!isLoading && items.length > 0 && (
                    <div className="flex items-center justify-between px-6 py-3 border-t border-slate-700/40 bg-slate-900/80">
                        <p className="text-[11px] text-slate-500">
                            {checkedCount} de {items.length} seleccionada{checkedCount !== 1 ? 's' : ''}
                            {hasChanges && <span className="text-emerald-400 ml-2">• Hay cambios pendientes</span>}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700/40 rounded-lg hover:bg-slate-700/30 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleApply}
                                disabled={checkedCount === 0 || applying}
                                className="px-4 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                            >
                                {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                {applying ? 'Aplicando...' : `Aplicar ${checkedCount} cambio${checkedCount !== 1 ? 's' : ''}`}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
