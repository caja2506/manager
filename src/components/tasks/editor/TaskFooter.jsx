import React from 'react';
import { Save } from 'lucide-react';

/**
 * TaskFooter — sticky bottom bar with Cancel + Save buttons.
 * Cancel: dark outlined button on the left.
 * Save: gradient purple button spanning most of the width.
 */
export default function TaskFooter({
    isNew, isSaving, canSave, canEdit,
    onSave, onClose,
}) {
    if (!canEdit) return null;

    return (
        <div className="p-3 lg:p-4 border-t border-slate-800 flex gap-3 bg-slate-800/50 rounded-b-2xl flex-shrink-0">
            <button
                onClick={onClose}
                className="lg:w-32 px-4 py-2.5 border border-slate-700 bg-slate-900 rounded-xl font-bold text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all flex-shrink-0"
            >
                Cancelar
            </button>
            <button
                onClick={onSave}
                disabled={isSaving || !canSave}
                className="flex-1 px-4 py-2.5 rounded-xl font-black text-sm text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2"
                style={{
                    background: isSaving || !canSave
                        ? '#374151'
                        : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
                }}
            >
                <Save className="w-4 h-4" />
                {isSaving ? 'Guardando...' : isNew ? 'Crear Tarea' : 'Guardar Cambios'}
            </button>
        </div>
    );
}
