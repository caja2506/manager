import React, { useState, useEffect, useRef } from 'react';
import { Search, Check, ChevronDown } from 'lucide-react';

// ========================================================
// COMPONENTE: DROPDOWN DE BÚSQUEDA (SOPORTA MULTI-SELECCIÓN)
// ========================================================
const SearchableDropdown = ({ options, value, onChange, placeholder, dark = false, compact = false, multiple = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const safeOptions = Array.isArray(options) ? options : [];

    const filteredOptions = safeOptions.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    const getDisplayLabel = () => {
        if (multiple) {
            if (!value || value.length === 0) return placeholder;
            if (value.length === 1) {
                const found = safeOptions.find(o => o.value === value[0]);
                return found ? found.label : placeholder;
            }
            return `${value.length} seleccionados`;
        }
        const selectedOption = safeOptions.find(opt => opt.value === value);
        return selectedOption ? selectedOption.label : placeholder;
    };

    const handleSelect = (itemValue, e) => {
        if (e) e.stopPropagation();
        if (multiple) {
            const currentValue = value || [];
            if (currentValue.includes(itemValue)) {
                onChange(currentValue.filter(v => v !== itemValue));
            } else {
                onChange([...currentValue, itemValue]);
            }
        } else {
            onChange(itemValue);
            setIsOpen(false);
            setSearch('');
        }
    };

    const isSelected = (itemValue) => {
        if (multiple) return (value || []).includes(itemValue);
        return value === itemValue;
    };

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full text-left flex items-center justify-between transition-all ${compact
                    ? 'px-3 py-2.5 text-sm border border-slate-700 rounded-xl bg-slate-800'
                    : `p-4 border rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 ${dark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-800 border-slate-700'}`
                    }`}
            >
                <span className={`truncate font-bold ${!value || (Array.isArray(value) && value.length === 0) ? 'text-slate-400' : 'text-slate-200'}`}>{getDisplayLabel()}</span>
                <ChevronDown className={`w-4 h-4 ml-2 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${dark ? 'text-slate-400' : 'text-slate-400'}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-1 w-full bg-slate-900 rounded-xl shadow-2xl border border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-slate-800">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar..."
                                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-800 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400 bg-slate-800"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {filteredOptions.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={(e) => handleSelect(opt.value, e)}
                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-indigo-500/10 transition-colors ${isSelected(opt.value) ? 'bg-indigo-500/10 text-indigo-400 font-bold' : 'text-slate-300'}`}
                            >
                                <span>{opt.label}</span>
                                {isSelected(opt.value) && <Check className="w-4 h-4 text-indigo-400" />}
                            </button>
                        ))}
                        {filteredOptions.length === 0 && <p className="p-3 text-center text-sm text-slate-400">Sin resultados</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableDropdown;
