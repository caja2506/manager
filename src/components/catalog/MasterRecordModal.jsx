import React, { useState, useEffect } from 'react';
import { Database, X, Plus, Loader2, Clock, Image as ImageIcon, Tag, DollarSign, Truck, Hash, FileText } from 'lucide-react';
import SearchableDropdown from '../ui/SearchableDropdown';

// ========================================================
// COMPONENTE: MODAL DE REGISTRO MAESTRO (CREAR/EDITAR)
// Layout: Descripción full-width + 3 columnas
// ========================================================
const MasterRecordModal = ({ isOpen, onClose, onSave, initialData, managedLists, onOpenManager }) => {
    const [formData, setFormData] = useState({ name: '', partNumber: '', lastPrice: '', defaultProvider: '', category: '', brand: '', leadTimeWeeks: '', imageUrl: '' });
    const [isSaving, setIsSaving] = useState(false);

    const brandOptions = [{ value: '', label: 'Sin Marca' }, ...managedLists.brands.map(b => ({ value: b.id, label: b.name }))];
    const categoryOptions = [{ value: '', label: 'Sin Categoría' }, ...managedLists.categories.map(c => ({ value: c.id, label: c.name }))];
    const providerOptions = [{ value: '', label: 'Sin Proveedor' }, ...managedLists.providers.map(p => ({ value: p.id, label: p.name }))];

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    name: initialData.name || '',
                    partNumber: initialData.partNumber || '',
                    lastPrice: initialData.lastPrice || 0,
                    defaultProvider: initialData.defaultProvider?.id || '',
                    category: initialData.category?.id || '',
                    brand: initialData.brand?.id || '',
                    leadTimeWeeks: initialData.leadTimeWeeks ?? '',
                    imageUrl: initialData.imageUrl || ''
                });
            } else {
                setFormData({ name: '', partNumber: '', lastPrice: '', defaultProvider: '', category: '', brand: '', leadTimeWeeks: '', imageUrl: '' });
            }
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(formData);
        setIsSaving(false);
    };

    if (!isOpen) return null;

    const imagePreview = formData.imageUrl && (formData.imageUrl.startsWith('http') || formData.imageUrl.startsWith('data:'));

    return (
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <div className="relative w-full max-w-[1050px] max-h-[92vh] bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl shadow-black/50 flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900 shrink-0">
                    <h2 className="font-black text-sm flex items-center text-white uppercase tracking-tight">
                        <Database className="mr-2 text-indigo-400 w-4 h-4" />
                        {initialData ? 'Editar Maestro' : 'Nuevo Registro'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="p-5 space-y-4 pb-40">

                        {/* Row 1: Descripción — full width */}
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center ml-0.5">
                                <FileText className="w-2.5 h-2.5 mr-1" /> Descripción
                            </label>
                            <input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Nombre del repuesto..."
                                className="w-full px-3 py-2 border border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-slate-800 text-white font-bold placeholder-slate-500 text-xs"
                                required
                            />
                        </div>

                        {/* Row 2: 3 columns — Marca, Categoría, Proveedor */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center ml-0.5">
                                    <Tag className="w-2.5 h-2.5 mr-1" /> Marca
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <div className="flex-grow"><SearchableDropdown compact options={brandOptions} value={formData.brand} onChange={val => setFormData({ ...formData, brand: val })} placeholder="Marca..." /></div>
                                    <button type="button" onClick={() => onOpenManager('brand')} className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 transition-all border border-slate-700 shrink-0"><Plus className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center ml-0.5">
                                    <Tag className="w-2.5 h-2.5 mr-1" /> Categoría
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <div className="flex-grow"><SearchableDropdown compact options={categoryOptions} value={formData.category} onChange={val => setFormData({ ...formData, category: val })} placeholder="Categoría..." /></div>
                                    <button type="button" onClick={() => onOpenManager('category')} className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 transition-all border border-slate-700 shrink-0"><Plus className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center ml-0.5">
                                    <Truck className="w-2.5 h-2.5 mr-1" /> Proveedor
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <div className="flex-grow"><SearchableDropdown compact options={providerOptions} value={formData.defaultProvider} onChange={val => setFormData({ ...formData, defaultProvider: val })} placeholder="Proveedor..." /></div>
                                    <button type="button" onClick={() => onOpenManager('provider')} className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 transition-all border border-slate-700 shrink-0"><Plus className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                        </div>

                        {/* Row 3: 3 columns — Precio, Lead Time, Part Number */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center ml-0.5">
                                    <DollarSign className="w-2.5 h-2.5 mr-1" /> Precio Base
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.lastPrice}
                                    onChange={e => setFormData({ ...formData, lastPrice: e.target.value })}
                                    placeholder="$0.00"
                                    className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white text-sm font-black outline-none focus:ring-2 focus:ring-green-500 placeholder-slate-500"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center ml-0.5">
                                    <Clock className="w-2.5 h-2.5 mr-1" /> Lead Time (semanas)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={formData.leadTimeWeeks}
                                    onChange={e => setFormData({ ...formData, leadTimeWeeks: e.target.value })}
                                    placeholder="Ej: 4"
                                    className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white outline-none focus:ring-2 focus:ring-teal-500 placeholder-slate-500 text-xs"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center ml-0.5">
                                    <Hash className="w-2.5 h-2.5 mr-1" /> Part Number
                                </label>
                                <input
                                    value={formData.partNumber}
                                    onChange={e => setFormData({ ...formData, partNumber: e.target.value })}
                                    placeholder="Ej: 5069RTB64SCREW"
                                    className="w-full px-3 py-2 border border-slate-700 rounded-lg font-mono uppercase focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-slate-800 text-white font-bold placeholder-slate-500 text-xs"
                                    required
                                />
                            </div>
                        </div>

                        {/* Row 4: URL de imagen — full width */}
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center ml-0.5">
                                <ImageIcon className="w-2.5 h-2.5 mr-1" /> URL de Imagen
                            </label>
                            <input
                                type="url"
                                value={formData.imageUrl}
                                onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                                placeholder="https://ejemplo.com/imagen.jpg"
                                className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-500 text-xs"
                            />
                        </div>

                        {/* Row 5: Large Image Preview */}
                        {imagePreview && (
                            <div className="flex flex-col items-center justify-center p-3 border border-slate-800 rounded-xl bg-slate-950/40">
                                <label className="self-start text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center ml-0.5">
                                    <ImageIcon className="w-2.5 h-2.5 mr-1" /> Vista Previa de Imagen
                                </label>
                                <div className="relative max-w-sm max-h-60 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 flex items-center justify-center p-3 shadow-lg">
                                    <img
                                        src={formData.imageUrl}
                                        alt="Vista previa del repuesto"
                                        className="max-h-52 object-contain rounded"
                                        onError={e => { e.target.style.display = 'none'; }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-900 shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className={`px-5 py-2 text-white rounded-lg font-black shadow-lg transition-all text-xs flex items-center gap-1.5 active:scale-95 ${initialData ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                            {initialData ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MasterRecordModal;
