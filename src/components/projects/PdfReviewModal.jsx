import React, { useState, useMemo, useEffect } from 'react';
import { X, Check, Sparkles, AlertTriangle, PackagePlus, Loader2, Hash } from 'lucide-react';

// ========================================================
// COMPONENTE: MODAL DE REVISIÓN PRE-IMPORTACIÓN DE PDF
// ========================================================
const PdfReviewModal = ({ isOpen, onClose, onConfirm, extractedData, supplierAnalysis }) => {
    // Estado de cada ítem (seleccionado o no)
    const [items, setItems] = useState([]);

    // PRCR único para toda la cotización
    const [prcr, setPrcr] = useState('');

    // Decisión del proveedor
    const [supplierAction, setSupplierAction] = useState('create_new');
    const [selectedSimilarId, setSelectedSimilarId] = useState(null);

    const [isConfirming, setIsConfirming] = useState(false);

    // Sincronizar estado cuando se abren nuevos datos
    useEffect(() => {
        if (isOpen && extractedData?.items) {
            setItems(extractedData.items.map((item, idx) => ({
                ...item, isSelected: true, id: `review-${idx}`
            })));
            setPrcr('');
            setIsConfirming(false);
        }
    }, [isOpen, extractedData]);

    // Sincronizar decisión de proveedor
    useEffect(() => {
        if (isOpen && supplierAnalysis) {
            if (supplierAnalysis.exactMatch) {
                setSupplierAction('use_existing');
                setSelectedSimilarId(supplierAnalysis.exactMatch.id);
            } else if (supplierAnalysis.similarMatches?.length > 0) {
                setSupplierAction('use_existing');
                setSelectedSimilarId(supplierAnalysis.similarMatches[0].id);
            } else {
                setSupplierAction('create_new');
                setSelectedSimilarId(null);
            }
        }
    }, [isOpen, supplierAnalysis]);

    // Contadores
    const stats = useMemo(() => {
        const selected = items.filter(i => i.isSelected);
        const newItems = selected.filter(i => i.isNew);
        const existingItems = selected.filter(i => !i.isNew);
        return { total: items.length, selected: selected.length, new: newItems.length, existing: existingItems.length };
    }, [items]);

    const toggleItem = (id) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, isSelected: !item.isSelected } : item
        ));
    };

    const toggleAll = () => {
        const allSelected = items.every(i => i.isSelected);
        setItems(prev => prev.map(item => ({ ...item, isSelected: !allSelected })));
    };

    const handleConfirm = async () => {
        setIsConfirming(true);
        try {
            await onConfirm({
                items: items.filter(i => i.isSelected),
                prcr: prcr.trim(),
                supplierDecision: {
                    action: supplierAction,
                    selectedProviderId: supplierAction === 'use_existing' ? selectedSimilarId : null,
                    name: extractedData?.supplier || '',
                }
            });
        } catch (err) {
            console.error('Error confirming import:', err);
        }
        setIsConfirming(false);
    };

    if (!isOpen || !extractedData) return null;

    const supplierName = extractedData.supplier || '';
    const hasExactMatch = !!supplierAnalysis?.exactMatch;
    const hasSimilarMatches = supplierAnalysis?.similarMatches?.length > 0;

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[350] flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-5xl h-[90vh] flex flex-col animate-in zoom-in duration-200 overflow-hidden">

                {/* ===== HEADER ===== */}
                <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-50 to-indigo-50/30">
                    <div className="flex justify-between items-center">
                        <h2 className="font-black text-2xl flex items-center text-white tracking-tight">
                            <Sparkles className="mr-3 text-yellow-500 w-7 h-7 fill-yellow-400" />
                            Revisión de Cotización
                        </h2>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* ===== SCROLLABLE CONTENT ===== */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* --- SECCIÓN 1: PROVEEDOR --- */}
                    {supplierName && (
                        <div className={`rounded-2xl border p-5 ${hasExactMatch ? 'bg-green-500/15 border-green-200' : hasSimilarMatches ? 'bg-amber-500/15 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                            <h3 className="font-black text-sm uppercase tracking-widest text-slate-500 mb-3 flex items-center">
                                🚚 Proveedor Detectado
                            </h3>
                            <p className="font-bold text-lg text-white mb-3">"{supplierName}"</p>

                            {hasExactMatch && (
                                <div className="flex items-center gap-2 text-green-400 bg-green-100 px-4 py-2 rounded-xl">
                                    <Check className="w-5 h-5" />
                                    <span className="font-bold text-sm">Proveedor existente encontrado: <strong>{supplierAnalysis.exactMatch.name}</strong></span>
                                </div>
                            )}

                            {hasSimilarMatches && !hasExactMatch && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-amber-400 mb-2">
                                        <AlertTriangle className="w-5 h-5" />
                                        <span className="font-bold text-sm">Proveedores similares encontrados</span>
                                    </div>

                                    <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-lg bg-slate-900 border-slate-700"
                                        onClick={() => { setSupplierAction('use_existing'); setSelectedSimilarId(supplierAnalysis.similarMatches[0].id); }}>
                                        <input type="radio" name="supplier" checked={supplierAction === 'use_existing'} onChange={() => { }} className="w-4 h-4 accent-indigo-600" />
                                        <div>
                                            <span className="font-bold text-sm text-white">Usar existente:</span>
                                            {supplierAnalysis.similarMatches.map(s => (
                                                <button key={s.id} onClick={(e) => { e.stopPropagation(); setSelectedSimilarId(s.id); setSupplierAction('use_existing'); }}
                                                    className={`ml-2 px-3 py-1 rounded-lg text-sm font-bold transition-all ${selectedSimilarId === s.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-600 hover:bg-slate-200'}`}>
                                                    {s.name}
                                                </button>
                                            ))}
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-lg bg-slate-900 border-slate-700"
                                        onClick={() => setSupplierAction('create_new')}>
                                        <input type="radio" name="supplier" checked={supplierAction === 'create_new'} onChange={() => { }} className="w-4 h-4 accent-indigo-600" />
                                        <span className="font-bold text-sm text-white">Crear nuevo: <strong className="text-indigo-400">"{supplierName}"</strong></span>
                                    </label>
                                </div>
                            )}

                            {!hasExactMatch && !hasSimilarMatches && (
                                <div className="flex items-center gap-2 text-blue-700 bg-blue-100 px-4 py-2 rounded-xl">
                                    <PackagePlus className="w-5 h-5" />
                                    <span className="font-bold text-sm">Nuevo proveedor — se creará automáticamente</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- SECCIÓN 2: PRCR + RESUMEN --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
                            <label className="font-black text-sm uppercase tracking-widest text-amber-400 mb-2 flex items-center">
                                <Hash className="w-4 h-4 mr-2" /> PRCR
                            </label>
                            <input
                                type="text"
                                value={prcr}
                                onChange={e => setPrcr(e.target.value)}
                                placeholder="Ej: PRCR-2025-001"
                                className="w-full p-3.5 border border-amber-200 rounded-xl bg-slate-900 font-bold font-mono uppercase outline-none focus:ring-2 focus:ring-amber-400 text-lg"
                            />
                            <p className="text-xs text-amber-400 mt-2">Se aplicará a todos los ítems importados</p>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5 flex items-center justify-around">
                            <div className="text-center">
                                <div className="text-3xl font-black text-white">{stats.selected}</div>
                                <div className="text-[10px] font-black text-slate-400 uppercase">Seleccionados</div>
                            </div>
                            <div className="w-px h-12 bg-slate-200"></div>
                            <div className="text-center">
                                <div className="text-3xl font-black text-emerald-400">{stats.new}</div>
                                <div className="text-[10px] font-black text-emerald-500 uppercase">Nuevos</div>
                            </div>
                            <div className="w-px h-12 bg-slate-200"></div>
                            <div className="text-center">
                                <div className="text-3xl font-black text-blue-600">{stats.existing}</div>
                                <div className="text-[10px] font-black text-blue-500 uppercase">Existentes</div>
                            </div>
                        </div>
                    </div>

                    {/* --- SECCIÓN 3: TABLA DE ÍTEMS --- */}
                    <div className="rounded-2xl border border-slate-700 overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-800 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="p-4 w-10 text-center">
                                        <input type="checkbox" className="w-4 h-4 accent-indigo-600"
                                            checked={items.every(i => i.isSelected)}
                                            onChange={toggleAll} />
                                    </th>
                                    <th className="p-4 w-24">Status</th>
                                    <th className="p-4">P/N</th>
                                    <th className="p-4">Descripción</th>
                                    <th className="p-4 w-16 text-center">Cant</th>
                                    <th className="p-4 w-20 text-center">⏱️ Lead</th>
                                    <th className="p-4 w-28 text-right">Precio U.</th>
                                    <th className="p-4 w-28 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {items.map(item => (
                                    <tr key={item.id}
                                        className={`transition-all cursor-pointer ${item.isSelected ? 'bg-slate-900 hover:bg-slate-700' : 'bg-slate-800/50 opacity-50'}`}
                                        onClick={() => toggleItem(item.id)}>
                                        <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" className="w-4 h-4 accent-indigo-600"
                                                checked={item.isSelected}
                                                onChange={() => toggleItem(item.id)} />
                                        </td>
                                        <td className="p-4">
                                            {item.isNew ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-emerald-100 text-emerald-400 border border-emerald-200">
                                                    🆕 Nuevo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-blue-100 text-blue-700 border border-blue-200">
                                                    ✅ Existe
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 font-mono font-bold text-xs text-slate-600">{item.pn}</td>
                                        <td className="p-4 font-bold text-white leading-tight text-sm">{item.description}</td>
                                        <td className="p-4 text-center font-black text-slate-700">{item.quantity}</td>
                                        <td className="p-4 text-center">
                                            {item.leadTimeWeeks != null ? <span className="text-sm font-bold text-teal-700">{item.leadTimeWeeks} sem</span> : <span className="text-slate-300 text-xs">—</span>}
                                        </td>
                                        <td className="p-4 text-right font-bold text-slate-600">${(item.unitPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                        <td className="p-4 text-right font-black text-green-400">${((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ===== FOOTER ===== */}
                <div className="p-4 border-t border-slate-700 bg-slate-900 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="text-sm text-slate-500">
                            <span className="font-bold text-slate-100">{stats.selected}</span> de {stats.total} ítems seleccionados
                            {prcr && <span className="ml-3 px-2 py-1 bg-amber-100 text-amber-400 rounded-lg text-xs font-bold">PRCR: {prcr}</span>}
                            <div className="mt-1 text-lg font-black text-green-400">
                                Total: ${items.filter(i => i.isSelected).reduce((sum, i) => sum + (i.quantity || 0) * (i.unitPrice || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button onClick={onClose} className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-800 transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={stats.selected === 0 || isConfirming}
                                className="flex-1 sm:flex-none px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center transition-all active:scale-95"
                            >
                                {isConfirming ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Check className="w-5 h-5 mr-2" />}
                                {isConfirming ? 'Importando...' : `Confirmar (${stats.selected})`}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PdfReviewModal;
