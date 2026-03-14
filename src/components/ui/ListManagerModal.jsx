import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Loader2 } from 'lucide-react';

// ========================================================
// COMPONENTE: GESTOR DE LISTAS (MODAL)
// ========================================================
const ListManagerModal = ({ title, items: initialItems, onSave, onClose }) => {
    const [managedItems, setManagedItems] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setManagedItems(
            (initialItems || []).map((name, index) => ({
                id: `existing-${index}`,
                name: name,
                originalName: name,
            }))
        );
    }, [initialItems]);

    const handleItemChange = (id, newName) => {
        setManagedItems(managedItems.map(item => item.id === id ? { ...item, name: newName } : item));
    };

    const handleAddItem = () => {
        setManagedItems([...managedItems, { id: `new-${Date.now()}`, name: '', originalName: null }]);
    };

    const handleRemoveItem = (id) => {
        setManagedItems(managedItems.filter(item => item.id !== id));
    };

    const handleSave = async () => {
        setIsSaving(true);

        const renames = managedItems
            .filter(item => item.originalName && item.name.trim() && item.originalName !== item.name.trim())
            .map(item => ({ oldName: item.originalName, newName: item.name.trim() }));

        const added = managedItems
            .filter(item => !item.originalName && item.name.trim())
            .map(item => item.name.trim());

        const remainingOriginalNames = managedItems.map(i => i.originalName).filter(Boolean);
        const deleted = initialItems.filter(originalName => !remainingOriginalNames.includes(originalName));

        await onSave({ renames, deleted, added });
        setIsSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md p-6 animate-in zoom-in duration-200">
                <h2 className="font-black text-xl mb-6 flex items-center"><Tag className="mr-2" /> {title}</h2>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                    {managedItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-2">
                            <input
                                value={item.name}
                                onChange={e => handleItemChange(item.id, e.target.value)}
                                placeholder="Nuevo valor..."
                                className="w-full p-3 border rounded-xl bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                            />
                            <button onClick={() => handleRemoveItem(item.id)} className="p-3 text-red-500 hover:bg-red-500/15 rounded-lg">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
                <button onClick={handleAddItem} className="w-full mt-4 p-2 text-sm font-bold text-indigo-400 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <Plus className="w-4 h-4 mr-1" /> Agregar otro
                </button>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 p-3.5 bg-slate-800 text-slate-600 rounded-xl font-bold">Cancelar</button>
                    <button onClick={handleSave} disabled={isSaving} className="flex-1 p-3.5 bg-indigo-600 text-white rounded-xl font-black disabled:bg-slate-400">
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ListManagerModal;
