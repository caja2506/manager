import React, { useState, useEffect, useRef } from 'react';
import { Search, Check, ChevronDown } from 'lucide-react';

export default function SearchableInlineSelect({
    icon,
    options = [],
    value,
    onChange,
    placeholder = 'Seleccionar...',
    disabled = false,
    allowAddExternal = false,
    onAddExternal,
    alignRight = false,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const safeOptions = Array.isArray(options) ? options : [];
    const selectedOption = safeOptions.find(opt => opt.value === value);
    const displayLabel = selectedOption ? selectedOption.label : placeholder;

    // Filter options
    const filteredOptions = safeOptions.filter(opt =>
        String(opt.label || '').toLowerCase().includes(search.toLowerCase())
    );

    // Check if the search term matches an option exactly
    const hasExactMatch = safeOptions.some(opt =>
        String(opt.label || '').toLowerCase().trim() === search.toLowerCase().trim()
    );

    const handleToggle = (e) => {
        e.stopPropagation();
        if (disabled) return;
        setIsOpen(!isOpen);
        if (!isOpen) {
            setSearch('');
        }
    };

    const handleSelect = (val, e) => {
        if (e) e.stopPropagation();
        onChange(val);
        setIsOpen(false);
        setSearch('');
    };

    const handleAdd = async (e) => {
        if (e) e.stopPropagation();
        if (!onAddExternal || !search.trim()) return;
        
        const newName = search.trim();
        setIsOpen(false);
        setSearch('');
        
        try {
            await onAddExternal(newName);
        } catch (err) {
            console.error('Error adding external item:', err);
            alert('Error al agregar: ' + err.message);
        }
    };

    return (
        <div className="relative flex-shrink-0 min-w-0" ref={containerRef}>
            <button
                type="button"
                onClick={handleToggle}
                className={`flex items-center gap-1.5 bg-slate-800 rounded-lg px-2.5 py-2 lg:py-1.5 border transition-all min-w-0 select-none ${
                    disabled 
                        ? 'opacity-65 cursor-not-allowed border-slate-700/50' 
                        : 'border-slate-700 hover:border-slate-600 active:scale-[0.98] cursor-pointer'
                }`}
                disabled={disabled}
            >
                {icon}
                <span 
                    className={`text-xs font-bold truncate pr-3 max-w-[120px] lg:max-w-[200px] ${
                        !value ? 'text-slate-400 font-medium' : 'text-slate-200'
                    }`}
                    title={displayLabel}
                >
                    {displayLabel}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto" />
            </button>

            {isOpen && (
                <div 
                    className={`absolute top-full mt-1.5 w-64 bg-slate-900 rounded-xl border border-slate-800 shadow-2xl z-[350] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 ${
                        alignRight ? 'right-0' : 'left-0'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Search bar */}
                    <div className="p-2 border-b border-slate-800 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 text-white placeholder-slate-500"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Options list */}
                    <div className="max-h-48 overflow-y-auto py-1">
                        {filteredOptions.map(opt => {
                            const active = opt.value === value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={(e) => handleSelect(opt.value, e)}
                                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                                        active 
                                            ? 'bg-indigo-500/10 text-indigo-400 font-bold' 
                                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                                    }`}
                                >
                                    <span className="truncate pr-2">{opt.label}</span>
                                    {active && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                                </button>
                            );
                        })}

                        {filteredOptions.length === 0 && !allowAddExternal && (
                            <p className="px-3 py-2 text-center text-xs text-slate-500">Sin resultados</p>
                        )}
                    </div>

                    {/* Quick creation of external resource */}
                    {allowAddExternal && search.trim().length > 0 && !hasExactMatch && (
                        <div className="border-t border-slate-800 bg-slate-900/50 p-1 shrink-0">
                            <button
                                type="button"
                                onClick={handleAdd}
                                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors truncate"
                                title={`Agregar "${search.trim()}" como externo`}
                            >
                                + Agregar "{search.trim()}" como externo
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
