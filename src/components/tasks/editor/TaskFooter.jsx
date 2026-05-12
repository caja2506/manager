import React from 'react';
import { Save, Zap } from 'lucide-react';

/**
 * TaskFooter — sticky bottom bar with Cancel + Save buttons.
 * MOBILE: Two rows — children on top, then Cancel + Save side-by-side (Save is wider).
 * DESKTOP: Single row — children left, Cancel + Save right.
 */
export default function TaskFooter({
    isNew, isSaving, canSave, canEdit, willAutoPlan,
    onSave, onClose, children
}) {
    if (!canEdit) return null;

    const label = isSaving
        ? 'Guardando...'
        : isNew
            ? (willAutoPlan ? 'Crear y Planificar' : 'Crear Tarea')
            : 'Guardar Cambios';

    return (
        <div className="border-t border-slate-800 bg-slate-900 flex-shrink-0 p-3 lg:py-5 lg:px-8 space-y-2 lg:space-y-0">
            {/* MOBILE: stacked layout | DESKTOP: single row */}
            <div className="lg:flex lg:items-center lg:justify-between lg:gap-3">
                
                {/* Children row (planner, activity) */}
                {children && (
                    <div className="w-full lg:flex-1 lg:max-w-xl mb-2 lg:mb-0">
                        {children}
                    </div>
                )}
                
                {/* Action buttons — always side-by-side, Save gets more space */}
                <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 border border-slate-700 bg-slate-800 rounded-xl font-bold text-sm text-white hover:bg-slate-700 hover:text-slate-200 transition-all whitespace-nowrap"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onSave}
                        disabled={isSaving || !canSave}
                        className="flex-1 lg:flex-none lg:w-48 px-4 py-2.5 rounded-xl font-black text-sm text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2 whitespace-nowrap"
                        style={{
                            background: isSaving || !canSave
                                ? '#374151'
                                : willAutoPlan
                                    ? 'linear-gradient(135deg, #06b6d4 0%, #6366f1 50%, #8b5cf6 100%)'
                                    : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
                        }}
                    >
                        {willAutoPlan ? <Zap className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        {label}
                    </button>
                </div>
            </div>
        </div>
    );
}
