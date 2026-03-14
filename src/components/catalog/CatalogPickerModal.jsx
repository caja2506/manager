import React, { useState, useMemo } from 'react';
import { ShoppingCart, X, Search, Plus, Check, Loader2, Camera } from 'lucide-react';
import SearchableDropdown from '../ui/SearchableDropdown';

// ========================================================
// COMPONENTE: MODAL "CARRITO" PARA AGREGAR DEL CATÁLOGO
// ========================================================
const CatalogPickerModal = ({ onClose, catalogo, managedLists, onAddItems }) => {
    const [selectedItems, setSelectedItems] = useState({}); // { id: quantity }
    const [filters, setFilters] = useState({ search: '', brand: '', category: '', provider: '' });
    const [isAdding, setIsAdding] = useState(false);

    // Opciones para filtros
    const brandOptions = [{ value: '', label: 'Todas las Marcas' }, ...managedLists.brands.map(b => ({ value: b.id, label: b.name }))];
    const categoryOptions = [{ value: '', label: 'Todas las Categorías' }, ...managedLists.categories.map(c => ({ value: c.id, label: c.name }))];
    const providerOptions = [{ value: '', label: 'Todos los Proveedores' }, ...managedLists.providers.map(p => ({ value: p.id, label: p.name }))];

    const filteredCatalog = useMemo(() => {
        return catalogo.filter(item => {
            const matchesSearch = !filters.search ||
                String(item.name || '').toLowerCase().includes(filters.search.toLowerCase()) ||
                String(item.partNumber || '').toLowerCase().includes(filters.search.toLowerCase());

            const matchesBrand = !filters.brand || item.brand?.id === filters.brand;
            const matchesCategory = !filters.category || item.category?.id === filters.category;
            const matchesProvider = !filters.provider || item.defaultProvider?.id === filters.provider;

            return matchesSearch && matchesBrand && matchesCategory && matchesProvider;
        });
    }, [catalogo, filters]);

    const handleToggleItem = (id) => {
        setSelectedItems(prev => {
            const next = { ...prev };
            if (next[id]) {
                delete next[id];
            } else {
                next[id] = 1; // Default quantity
            }
            return next;
        });
    };

    const handleQuantityChange = (id, newQty) => {
        if (newQty < 1) return;
        setSelectedItems(prev => ({ ...prev, [id]: newQty }));
    };

    const handleAdd = async () => {
        setIsAdding(true);
        const itemsToAdd = Object.entries(selectedItems).map(([id, qty]) => {
            const item = catalogo.find(i => i.id === id);
            return { item, quantity: qty };
        });
        await onAddItems(itemsToAdd);
        setIsAdding(false);
        onClose();
    };

    const selectedCount = Object.keys(selectedItems).length;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-5xl h-[85vh] flex flex-col animate-in zoom-in duration-200 overflow-hidden">
                {/* Header & Filters */}
                <div className="p-6 border-b border-slate-800 bg-slate-800/50">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-black text-2xl flex items-center text-white"><ShoppingCart className="mr-2 text-indigo-400" /> Catálogo de Piezas</h2>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-700 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={filters.search}
                                onChange={e => setFilters({ ...filters, search: e.target.value })}
                                placeholder="Buscar pieza o P/N..."
                                className="pl-10 pr-4 py-2.5 w-full border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-900"
                            />
                        </div>
                        <SearchableDropdown compact options={brandOptions} value={filters.brand} onChange={val => setFilters({ ...filters, brand: val })} placeholder="Marca" />
                        <SearchableDropdown compact options={categoryOptions} value={filters.category} onChange={val => setFilters({ ...filters, category: val })} placeholder="Categoría" />
                        <SearchableDropdown compact options={providerOptions} value={filters.provider} onChange={val => setFilters({ ...filters, provider: val })} placeholder="Proveedor" />
                    </div>
                </div>

                {/* List Area */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredCatalog.map(item => {
                            const isSelected = !!selectedItems[item.id];
                            const brandName = item.brand ? managedLists.brands.find(b => b.id === item.brand.id)?.name : '';

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => handleToggleItem(item.id)}
                                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer group hover:shadow-md ${isSelected ? 'bg-indigo-500/10 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-900 border-slate-700 hover:border-indigo-500/50'}`}
                                >
                                    <div className="flex justify-between items-start mb-3 gap-3">
                                        <div className="flex items-start gap-3 flex-1 overflow-hidden">
                                            <div className={`w-5 h-5 shrink-0 mt-0.5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-600 bg-slate-800'}`}>
                                                {isSelected && <Check className="w-3.5 h-3.5" />}
                                            </div>
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} className="w-16 h-16 rounded-xl object-contain border border-slate-700 bg-slate-900 shrink-0 p-0.5" alt="" onError={e => e.target.style.display = 'none'} />
                                            ) : (
                                                <div className="w-16 h-16 rounded-xl border border-dashed border-slate-700 bg-slate-800 flex items-center justify-center shrink-0">
                                                    <Camera className="w-5 h-5 text-slate-300" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-white text-sm leading-tight line-clamp-2 mb-1">{item.name}</h3>
                                                <p className="text-xs text-slate-400 font-mono mb-1 truncate">{item.partNumber}</p>
                                                <div className="flex flex-wrap gap-1 min-h-[16px]">
                                                    {brandName && <span className="px-1.5 py-0.5 bg-slate-800 text-slate-500 text-[10px] rounded font-bold uppercase">{brandName}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end shrink-0">
                                            <span className="font-black text-green-400 text-sm">${(item.lastPrice || 0).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <div className="mt-3 pt-3 border-t border-indigo-500/20 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-200" onClick={e => e.stopPropagation()}>
                                            <span className="text-xs font-bold text-indigo-400 uppercase">Cantidad</span>
                                            <input
                                                type="number"
                                                min="1"
                                                value={selectedItems[item.id]}
                                                onChange={e => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                                                className="w-20 p-1.5 text-center border border-indigo-500/30 rounded-lg text-sm font-bold text-indigo-400 bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filteredCatalog.length === 0 && (
                            <div className="col-span-full py-12 text-center text-slate-400">
                                <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No se encontraron piezas con estos filtros.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Bar */}
                <div className="p-4 border-t border-slate-700 bg-slate-900 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                    <div className="text-sm">
                        <span className="font-bold text-slate-100">{selectedCount}</span> <span className="text-slate-500">ítems seleccionados</span>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-800 transition-colors">Cancelar</button>
                        <button
                            onClick={handleAdd}
                            disabled={selectedCount === 0 || isAdding}
                            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none flex items-center transition-all active:scale-95"
                        >
                            {isAdding ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
                            {isAdding ? 'Agregando...' : 'Agregar al Proyecto'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CatalogPickerModal;
