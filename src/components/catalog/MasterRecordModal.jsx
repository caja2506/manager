import React, { useState, useEffect } from 'react';
import { Database, X, Plus, Loader2, Clock, Image as ImageIcon } from 'lucide-react';
import SearchableDropdown from '../ui/SearchableDropdown';

// ========================================================
// COMPONENTE: MODAL DE REGISTRO MAESTRO (CREAR/EDITAR)
// ========================================================
const MasterRecordModal = ({ isOpen, onClose, onSave, initialData, managedLists, onOpenManager }) => {
    const [formData, setFormData] = useState({ name: '', partNumber: '', lastPrice: '', defaultProvider: '', category: '', brand: '', leadTimeWeeks: '', imageUrl: '' });
    const [isSaving, setIsSaving] = useState(false);

    // Opciones para filtros dentro del modal
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

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md p-6 animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <h2 className="font-black text-xl flex items-center text-white uppercase tracking-tighter">
                        <Database className="mr-2 text-indigo-400 w-6 h-6" />
                        {initialData ? 'Editar Maestro' : 'Nuevo Registro Maestro'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-800 rounded-full"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Descripción del repuesto..." className="w-full p-4 border rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-slate-800 font-bold" required />
                    <input value={formData.partNumber} onChange={e => setFormData({ ...formData, partNumber: e.target.value })} placeholder="P/N Referencia..." className="w-full p-4 border rounded-2xl font-mono uppercase focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-slate-800 font-bold" required />
                    <div className="flex items-center gap-2">
                        <div className="flex-grow"><SearchableDropdown options={brandOptions} value={formData.brand} onChange={val => setFormData({ ...formData, brand: val })} placeholder="🏭 Marca..." /></div>
                        <button type="button" onClick={() => onOpenManager('brand')} className="p-3.5 bg-slate-800 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"><Plus className="w-5 h-5" /></button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-grow"><SearchableDropdown options={categoryOptions} value={formData.category} onChange={val => setFormData({ ...formData, category: val })} placeholder="🏷️ Categoría..." /></div>
                        <button type="button" onClick={() => onOpenManager('category')} className="p-3.5 bg-slate-800 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"><Plus className="w-5 h-5" /></button>
                    </div>
                    <div className="border-t pt-4 border-slate-50 space-y-4">
                        <input type="number" step="0.01" value={formData.lastPrice} onChange={e => setFormData({ ...formData, lastPrice: e.target.value })} placeholder="Precio Estimado $" className="w-full p-3.5 border border-green-100 rounded-xl bg-slate-800 outline-none focus:ring-2 focus:ring-green-500" />
                        <div className="flex items-center gap-2">
                            <div className="flex-grow"><SearchableDropdown options={providerOptions} value={formData.defaultProvider} onChange={val => setFormData({ ...formData, defaultProvider: val })} placeholder="🚚 Proveedor..." /></div>
                            <button type="button" onClick={() => onOpenManager('provider')} className="p-3.5 bg-slate-800 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"><Plus className="w-5 h-5" /></button>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> Lead Time (semanas)</label>
                            <input type="number" min="1" step="1" value={formData.leadTimeWeeks} onChange={e => setFormData({ ...formData, leadTimeWeeks: e.target.value })} placeholder="Ej: 4" className="w-full p-3.5 border border-teal-100 rounded-xl bg-slate-800 outline-none focus:ring-2 focus:ring-teal-500" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 flex items-center"><ImageIcon className="w-3.5 h-3.5 mr-1" /> URL de Imagen</label>
                            <input type="url" value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} placeholder="https://ejemplo.com/imagen.jpg" className="w-full p-3.5 border border-indigo-100 rounded-xl bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                    </div>
                    <button type="submit" disabled={isSaving} className={`w-full p-4 text-white rounded-2xl font-black shadow-lg transition-all ${initialData ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-900 hover:bg-black'}`}>
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (initialData ? 'Actualizar Registro' : 'Guardar Registro')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default MasterRecordModal;
