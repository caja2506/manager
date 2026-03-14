import React, { useState } from 'react';
import { Filter, X } from 'lucide-react';
import SearchableDropdown from './SearchableDropdown';

// ========================================================
// COMPONENTE: MODAL DE FILTROS (centrado, mobile-friendly)
// ========================================================
const FilterPopover = ({ filters, setFilters, options }) => {
    const [isOpen, setIsOpen] = useState(false);

    const activeFilterCount = (filters.brand?.length || 0) + (filters.category?.length || 0) + (filters.provider?.length || 0);

    return (
        <>
            <button onClick={() => setIsOpen(true)} className={`px-4 py-3 rounded-xl border flex items-center gap-2 transition-all ${activeFilterCount > 0 ? 'bg-indigo-600/20 border-indigo-300 text-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-700'}`}>
                <Filter className="w-4 h-4" />
                <span className="font-bold text-sm hidden sm:inline">Filtros</span>
                {activeFilterCount > 0 && <span className="bg-indigo-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>}
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setIsOpen(false)}>
                    <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 border border-slate-800 w-full max-w-sm p-6 space-y-4 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                <Filter className="w-4 h-4 text-indigo-400" /> Filtrar por
                            </h4>
                            <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-full transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Marca</label>
                            <SearchableDropdown multiple compact options={options.brands} value={filters.brand} onChange={val => setFilters({ ...filters, brand: val })} placeholder="Todas las Marcas" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Categoría</label>
                            <SearchableDropdown multiple compact options={options.categories} value={filters.category} onChange={val => setFilters({ ...filters, category: val })} placeholder="Todas las Categorías" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Proveedor</label>
                            <SearchableDropdown multiple compact options={options.providers} value={filters.provider} onChange={val => setFilters({ ...filters, provider: val })} placeholder="Todos los Proveedores" />
                        </div>
                        <div className="flex gap-3 pt-2">
                            {activeFilterCount > 0 && (
                                <button onClick={() => setFilters({ ...filters, brand: [], category: [], provider: [] })} className="flex-1 text-sm font-bold text-red-500 hover:bg-red-500/15 p-3 rounded-xl border border-red-100 transition-colors">
                                    Limpiar
                                </button>
                            )}
                            <button onClick={() => setIsOpen(false)} className="flex-1 bg-indigo-600 text-white p-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">
                                Aplicar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default FilterPopover;
