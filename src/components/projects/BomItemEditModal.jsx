import React, { useState, useEffect } from 'react';
import { Loader2, Clock } from 'lucide-react';

const BomItemEditModal = ({ item, onClose, onSave, catalogLeadTime }) => {
    const [formData, setFormData] = useState({ quantity: 0, unitPrice: 0, prcr: '', leadTimeWeeks: '' });
    const [updateCatalogLT, setUpdateCatalogLT] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (item) {
            setFormData({
                quantity: item.quantity || 1,
                unitPrice: item.unitPrice || 0,
                prcr: item.prcr || '',
                leadTimeWeeks: item.leadTimeWeeks ?? '',
            });
            setUpdateCatalogLT(false);
        }
    }, [item]);

    if (!item) return null;

    const handleSave = async () => {
        setIsSaving(true);
        const ltValue = formData.leadTimeWeeks === '' ? null : Number(formData.leadTimeWeeks);
        await onSave(item.id, {
            quantity: formData.quantity,
            unitPrice: formData.unitPrice,
            prcr: formData.prcr,
            leadTimeWeeks: ltValue,
        }, updateCatalogLT ? ltValue : undefined);
        setIsSaving(false);
        onClose();
    };

    const ltChanged = formData.leadTimeWeeks !== '' && catalogLeadTime != null && Number(formData.leadTimeWeeks) !== catalogLeadTime;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-sm p-6 animate-in zoom-in duration-200">
                <h2 className="font-black text-xl mb-6">Editar Ítem del BOM</h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">Cantidad</label>
                        <input type="number" value={formData.quantity}
                            onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                            className="w-full p-3 border rounded-xl bg-slate-800 font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">Precio Unitario</label>
                        <input type="number" step="0.01" value={formData.unitPrice}
                            onChange={e => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                            className="w-full p-3 border rounded-xl bg-slate-800 font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">#PRCR</label>
                        <input type="text" value={formData.prcr}
                            onChange={e => setFormData({ ...formData, prcr: e.target.value })}
                            placeholder="Ej: PRCR-2025-001"
                            className="w-full p-3 border rounded-xl bg-slate-800 font-bold outline-none focus:ring-2 focus:ring-amber-500 font-mono uppercase" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1" /> Lead Time (semanas)
                        </label>
                        <input type="number" min="1" step="1" value={formData.leadTimeWeeks}
                            onChange={e => setFormData({ ...formData, leadTimeWeeks: e.target.value })}
                            placeholder="Ej: 4"
                            className="w-full p-3 border rounded-xl bg-slate-800 font-bold outline-none focus:ring-2 focus:ring-teal-500" />
                        {catalogLeadTime != null && (
                            <p className="text-xs text-slate-400 mt-1">Catálogo actual: <strong>{catalogLeadTime} sem</strong></p>
                        )}
                        {ltChanged && (
                            <label className="flex items-center gap-2 mt-2 p-2 bg-amber-500/15 rounded-lg border border-amber-200 cursor-pointer">
                                <input type="checkbox" checked={updateCatalogLT} onChange={e => setUpdateCatalogLT(e.target.checked)}
                                    className="w-4 h-4 accent-amber-600" />
                                <span className="text-xs font-bold text-amber-400">¿Actualizar también en el catálogo maestro?</span>
                            </label>
                        )}
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 p-3.5 bg-slate-800 text-slate-600 rounded-xl font-bold">Cancelar</button>
                    <button onClick={handleSave} disabled={isSaving} className="flex-1 p-3.5 bg-indigo-600 text-white rounded-xl font-black">
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BomItemEditModal;
