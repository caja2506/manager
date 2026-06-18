import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRole } from '../contexts/RoleContext';
import { useAppData } from '../contexts/AppDataContext';
import SearchableDropdown from '../components/ui/SearchableDropdown';
import FilterPopover from '../components/ui/FilterPopover';
import CatalogPickerModal from '../components/catalog/CatalogPickerModal';
import * as XLSX from 'xlsx';
import { getPOsByProject } from '../services/poService';
import { getProjectStations } from '../services/stationService';
import { supabase } from '../supabase';
import {
    Search, Trash2, ArrowLeft, PackagePlus, X,
    Loader2, Sparkles, SlidersHorizontal, Check,
    Tag, Camera, Download, Edit3, Layers, AlertTriangle,
    GitMerge, ShoppingCart
} from 'lucide-react';

// ============================================================
// INLINE EDIT CELL — click to edit, blur/enter to save
// ============================================================
function InlineEditCell({ value, onSave, type = 'number', placeholder = '—', prefix = '', suffix = '', className = '', inputClassName = '' }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const inputRef = useRef(null);

    useEffect(() => { setDraft(value); }, [value]);
    useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

    const handleSave = () => {
        setEditing(false);
        const parsed = type === 'number' ? (parseFloat(draft) || 0) : String(draft || '').trim();
        if (parsed !== value) onSave(parsed);
    };

    if (!editing) {
        const display = type === 'number'
            ? (value ? `${prefix}${Number(value).toLocaleString('en-US', { minimumFractionDigits: type === 'number' && prefix === '$' ? 2 : 0 })}${suffix}` : placeholder)
            : (value || placeholder);
        return (
            <span
                onClick={e => { e.stopPropagation(); setDraft(value ?? ''); setEditing(true); }}
                className={`cursor-text hover:bg-indigo-500/10 rounded-lg px-2 py-1 -mx-1 transition-all duration-150 ${!value && value !== 0 ? 'text-slate-600 italic' : ''} ${className}`}
                title="Click para editar"
            >
                {display}
            </span>
        );
    }

    return (
        <input
            ref={inputRef}
            type={type === 'number' ? 'number' : 'text'}
            step={type === 'number' ? '0.01' : undefined}
            min={type === 'number' ? '0' : undefined}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
            onClick={e => e.stopPropagation()}
            placeholder={placeholder}
            className={`bg-slate-800 border-2 border-indigo-500 rounded-xl px-3 py-2 text-base text-white outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-lg shadow-indigo-500/20 ${inputClassName}`}
        />
    );
}

export default function BomProjectDetail({ forceProjectId = null, isEmbedded = false }) {
    const { projectId } = useParams();
    const resolvedProjectId = forceProjectId || projectId;
    const navigate = useNavigate();
    const { canEdit, canDelete } = useRole();
    const {
        proyectos, catalogo, bomItems, managedLists,
        brandOptions, categoryOptions, providerOptions,
        isProcessing, handlePdfUpload, handleConfirmImport,
        handleUpdateBomItem, handleAddFromCatalog,
        handleDeleteBomItem, handleDeleteBomItemsBatch,
        setConfirmDelete, setImagePickerItem, setZoomedImageUrl,
        pdfInputRef,
        handleEditClick, setEditingMasterRecord, setIsMasterRecordModalOpen,
        handleMergeAllDuplicates, handleMergeSingleDuplicate,
    } = useAppData();

    const activeProject = proyectos.find(p => p.id === resolvedProjectId);
    const activeBomItems = activeProject
        ? bomItems.filter(i => i.projectId === activeProject.id).sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt))
        : [];

    // Store active project reference for PdfReviewModal callback
    useEffect(() => {
        window.__activeProject__ = activeProject;
        return () => { window.__activeProject__ = null; };
    }, [activeProject]);

    const [pos, setPOs] = useState([]);
    const [stations, setStations] = useState([]);

    useEffect(() => {
        if (resolvedProjectId) {
            getPOsByProject(resolvedProjectId)
                .then(setPOs)
                .catch(err => console.error("Error fetching POs in BOM:", err));

            // Fetch stations of the linked engineering project
            supabase
                .from('projects')
                .select('id')
                .eq('bom_project_id', resolvedProjectId)
                .maybeSingle()
                .then(({ data }) => {
                    if (data && data.id) {
                        getProjectStations(data.id)
                            .then(setStations)
                            .catch(err => console.error("Error fetching project stations:", err));
                    } else {
                        setStations([]);
                    }
                });
        } else {
            setPOs([]);
            setStations([]);
        }
    }, [resolvedProjectId]);

    const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
    const [isBomEditMode, setIsBomEditMode] = useState(false);
    const [selectedBomItems, setSelectedBomItems] = useState([]);
    const [bomFilters, setBomFilters] = useState({ search: '', brand: [], category: [], provider: [], prcr: '', station: '' });
    const [groupBy, setGroupBy] = useState('none'); // 'none' | 'brand' | 'category'
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [isMerging, setIsMerging] = useState(false);

    const duplicatesGroup = useMemo(() => {
        const counts = {};
        const norm = (pn) => String(pn || '').trim().replace(/\s+/g, '').toUpperCase();
        activeBomItems.forEach(item => {
            let pn = '';
            if (item.masterPartRef) {
                const mp = catalogo.find(p => p.id === item.masterPartRef.id);
                if (mp) pn = mp.partNumber;
            } else {
                pn = item.partNumber;
            }
            const key = norm(pn);
            if (key && key !== 'S/N' && key !== '') {
                counts[key] = (counts[key] || 0) + 1;
            }
        });
        return counts;
    }, [activeBomItems, catalogo]);

    const hasDuplicates = useMemo(() => {
        return Object.values(duplicatesGroup).some(count => count > 1);
    }, [duplicatesGroup]);

    const getNormalizedPartNumber = (item) => {
        let pn = '';
        if (item.masterPartRef) {
            const mp = catalogo.find(p => p.id === item.masterPartRef.id);
            if (mp) pn = mp.partNumber;
        } else {
            pn = item.partNumber;
        }
        return String(pn || '').trim().replace(/\s+/g, '').toUpperCase();
    };

    const isItemDuplicate = (item) => {
        const key = getNormalizedPartNumber(item);
        return key && duplicatesGroup[key] > 1;
    };

    const handleMergeAll = async () => {
        if (!window.confirm('¿Estás seguro de que deseas unificar todos los elementos repetidos? Se sumarán las cantidades y se mantendrá un solo registro por componente.')) return;
        setIsMerging(true);
        try {
            await handleMergeAllDuplicates(resolvedProjectId);
        } finally {
            setIsMerging(false);
        }
    };

    const handleMergeSingle = async (partNumber) => {
        if (!window.confirm(`¿Deseas unificar los elementos con el número de parte "${partNumber}"?`)) return;
        setIsMerging(true);
        try {
            await handleMergeSingleDuplicate(resolvedProjectId, partNumber);
        } finally {
            setIsMerging(false);
        }
    };

    // Reset on project change
    useEffect(() => {
        setSelectedBomItems([]);
        setBomFilters({ search: '', brand: [], category: [], provider: [], prcr: '', station: '' });
        setIsBomEditMode(false);
    }, [resolvedProjectId]);

    const filteredActiveBomItems = useMemo(() => {
        return activeBomItems.filter(item => {
            let details = {};
            if (item.masterPartRef) {
                const masterPart = catalogo.find(p => p.id === item.masterPartRef.id);
                if (!masterPart) return false;
                details = {
                    name: masterPart.name,
                    partNumber: masterPart.partNumber,
                    brandId: masterPart.brand?.id || '',
                    categoryId: masterPart.category?.id || '',
                    providerId: item.proveedor?.id || masterPart.defaultProvider?.id || ''
                };
            } else {
                details = {
                    name: item.name,
                    partNumber: item.partNumber,
                    brandId: '',
                    categoryId: '',
                    providerId: item.proveedor ? (typeof item.proveedor === 'string' ? '' : item.proveedor.id) : ''
                };
            }

            const s = bomFilters.search.toLowerCase();
            const matchesSearch = !s || String(details.name || '').toLowerCase().includes(s) || String(details.partNumber || '').toLowerCase().includes(s);
            const matchesBrand = bomFilters.brand.length === 0 || bomFilters.brand.includes(details.brandId);
            const matchesCategory = bomFilters.category.length === 0 || bomFilters.category.includes(details.categoryId);
            const matchesProvider = bomFilters.provider.length === 0 || bomFilters.provider.includes(details.providerId);
            const matchesPrcr = !bomFilters.prcr || (item.prcr || '') === bomFilters.prcr;
            const matchesStation = !bomFilters.station || item.stationId === bomFilters.station;

            return matchesSearch && matchesBrand && matchesCategory && matchesProvider && matchesPrcr && matchesStation;
        });
    }, [activeBomItems, catalogo, bomFilters]);

    const handleToggleSelectAllBomItems = (items) => {
        if (selectedBomItems.length === items.length) {
            setSelectedBomItems([]);
        } else {
            setSelectedBomItems(items.map(i => i.id));
        }
    };

    const handleToggleSelectBomItem = (id) => {
        setSelectedBomItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleDeleteSelectedBomItems = () => {
        setConfirmDelete({
            isOpen: true,
            title: `¿Quitar ${selectedBomItems.length} ítems?`,
            message: `Esto quitará permanentemente los ${selectedBomItems.length} ítems seleccionados de este proyecto. No se borrarán del catálogo maestro.`,
            onConfirm: async () => {
                await handleDeleteBomItemsBatch(selectedBomItems);
                setSelectedBomItems([]);
            }
        });
    };

    // ── Excel Export ──
    const handleExportBomToExcel = () => {
        if (!filteredActiveBomItems || filteredActiveBomItems.length === 0) return;

        const rows = filteredActiveBomItems.map(item => {
            let name = '', partNumber = '', brandName = '', categoryName = '', providerName = '';
            if (item.masterPartRef) {
                const mp = catalogo.find(p => p.id === item.masterPartRef.id);
                if (mp) {
                    name = mp.name || '';
                    partNumber = mp.partNumber || '';
                    brandName = managedLists.brands.find(b => b.id === mp.brand?.id)?.name || '';
                    categoryName = managedLists.categories.find(c => c.id === mp.category?.id)?.name || '';
                    providerName = managedLists.providers.find(p => p.id === (item.proveedor?.id || mp.defaultProvider?.id))?.name || '';
                }
            } else {
                name = item.name || '';
                partNumber = item.partNumber || '';
            }
            const mp2 = item.masterPartRef ? catalogo.find(p => p.id === item.masterPartRef.id) : null;
            const leadTime = item.leadTimeWeeks ?? mp2?.leadTimeWeeks ?? '';

            return {
                'Descripción': name,
                'Part Number': partNumber,
                'Marca': brandName,
                'Categoría': categoryName,
                'Proveedor': providerName,
                'Cantidad': item.quantity || 0,
                'Precio Unitario': item.unitPrice || 0,
                'Costo Total': item.totalPrice || 0,
                '#PRCR': item.prcr || '',
                'Lead Time (sem)': leadTime,
                'Estado': item.status || '',
            };
        });

        // Totals row
        const totalInversion = rows.reduce((s, r) => s + (r['Costo Total'] || 0), 0);
        const totalQty = rows.reduce((s, r) => s + (r['Cantidad'] || 0), 0);
        rows.push({
            'Descripción': 'TOTAL',
            'Part Number': '',
            'Marca': '',
            'Categoría': '',
            'Proveedor': '',
            'Cantidad': totalQty,
            'Precio Unitario': '',
            'Costo Total': totalInversion,
            '#PRCR': '',
            'Lead Time (sem)': '',
            'Estado': '',
        });

        const wb = XLSX.utils.book_new();

        // Sheet 1: BOM Items
        const ws = XLSX.utils.json_to_sheet(rows);
        const colWidths = Object.keys(rows[0]).map(key => {
            const maxLen = Math.max(key.length, ...rows.map(r => String(r[key] || '').length));
            return { wch: Math.min(maxLen + 3, 45) };
        });
        ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, 'BOM');

        // Sheet 2: Resumen
        const summaryRows = [
            { 'Métrica': 'Proyecto', 'Valor': activeProject.name },
            { 'Métrica': 'Total Ítems', 'Valor': filteredActiveBomItems.length },
            { 'Métrica': 'Cantidad Total Piezas', 'Valor': totalQty },
            { 'Métrica': 'Inversión Total', 'Valor': `$${totalInversion.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
            { 'Métrica': 'Fecha Exportación', 'Valor': new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
        wsSummary['!cols'] = [{ wch: 25 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

        const safeName = (activeProject.name || 'BOM').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
        const today = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `BOM_${safeName}_${today}.xlsx`);
    };

    if (!activeProject) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <p className="text-lg font-bold">Proyecto no encontrado</p>
                <button onClick={() => navigate('/bom/projects')} className="mt-4 text-indigo-600 font-bold hover:underline">
                    ← Volver a Proyectos
                </button>
            </div>
        );
    }

    return (
        <div 
            className={isEmbedded ? "flex flex-col flex-1 min-h-0 overflow-hidden p-3 md:p-6" : "flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden -mt-4 md:-mt-8"} 
            style={{ height: isEmbedded ? '100%' : 'calc(100vh - 80px)' }}
        >
            {catalogPickerOpen && (
                <CatalogPickerModal
                    catalogo={catalogo}
                    managedLists={managedLists}
                    onClose={() => setCatalogPickerOpen(false)}
                    onAddItems={(items) => handleAddFromCatalog(items, activeProject)}
                    existingBomItems={activeBomItems}
                />
            )}

            {/* Header — compact single row */}
            <div className="bg-slate-900/70 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-800 shadow-md flex flex-wrap items-center gap-3 shrink-0">
                <h2 className="text-lg font-black text-white tracking-tight mr-auto truncate">{activeProject.name}</h2>

                {canEdit && (
                    <>
                        <button onClick={() => setCatalogPickerOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center shadow-lg active:scale-95 transition-all text-xs">
                            <PackagePlus className="w-4 h-4 mr-1.5" /> Catálogo
                        </button>
                        <div className="relative">
                            <input type="file" ref={pdfInputRef} onChange={(e) => handlePdfUpload(e, activeProject)} accept=".pdf" className="hidden" />
                            <button onClick={() => pdfInputRef.current.click()} disabled={isProcessing} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold flex items-center shadow-lg active:scale-95 transition-all disabled:bg-slate-600 text-xs border border-slate-700">
                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5 text-yellow-400 fill-yellow-400" />}
                                {isProcessing ? "..." : "PDF"}
                            </button>
                        </div>
                    </>
                )}
                <button
                    onClick={() => handleExportBomToExcel()}
                    disabled={!activeBomItems || activeBomItems.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold flex items-center shadow-lg active:scale-95 transition-all text-xs disabled:opacity-40"
                >
                    <Download className="w-4 h-4 mr-1.5" /> Excel
                </button>
                <div className="bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-right flex items-center gap-2">
                    <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Inv.</span>
                    <span className="text-lg font-black text-green-500 tracking-tighter leading-none">
                        ${(activeBomItems || []).reduce((s, i) => s + (i.totalPrice || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col flex-1 gap-1.5 mt-1.5 min-h-0">
                <div className="flex flex-col flex-1 gap-1.5 min-h-0">
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={bomFilters.search}
                                onChange={e => setBomFilters({ ...bomFilters, search: e.target.value })}
                                placeholder="Buscar en BOM..."
                                className="pl-12 pr-4 py-2 w-full border border-slate-700 rounded-xl text-sm shadow-inner outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-white"
                            />
                        </div>
                        <FilterPopover
                            filters={bomFilters}
                            setFilters={setBomFilters}
                            options={{ brands: brandOptions, categories: categoryOptions, providers: providerOptions }}
                        />
                        {(() => {
                            const pcrValues = [...new Set(activeBomItems.map(i => i.prcr).filter(Boolean))];
                            if (pcrValues.length > 0) return (
                                <div className="w-full sm:w-auto sm:min-w-[140px]">
                                    <SearchableDropdown compact options={[{ value: '', label: 'Todos los PRCR' }, ...pcrValues.map(p => ({ value: p, label: p }))]} value={bomFilters.prcr} onChange={val => setBomFilters({ ...bomFilters, prcr: val })} placeholder="#PRCR" />
                                </div>
                            );
                            return null;
                        })()}
                        {stations.length > 0 && (
                            <div className="w-full sm:w-auto sm:min-w-[160px]">
                                <select
                                    value={bomFilters.station || ''}
                                    onChange={e => setBomFilters({ ...bomFilters, station: e.target.value })}
                                    className="px-3 py-2 w-full border border-slate-700 rounded-xl text-sm bg-slate-800 text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Todas las Estaciones</option>
                                    {stations.map(st => (
                                        <option key={st.id} value={st.id}>STN{String(st.stn || '').padStart(2, '0')} - {st.abbreviation || st.description}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {/* Group By toggle */}
                        <div className="relative">
                            <button
                                onClick={() => setGroupBy(g => g === 'none' ? 'brand' : g === 'brand' ? 'category' : 'none')}
                                className={`px-3 py-2 rounded-xl border flex items-center gap-1.5 transition-all text-xs font-bold ${groupBy !== 'none' ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                title="Agrupar por..."
                            >
                                <Layers className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{groupBy === 'none' ? 'Agrupar' : groupBy === 'brand' ? 'Marca' : 'Categoría'}</span>
                            </button>
                        </div>
                        {canEdit && (
                            <button
                                onClick={() => { setIsBomEditMode(!isBomEditMode); setSelectedBomItems([]); }}
                                className={`px-4 py-3 rounded-xl border flex items-center gap-2 transition-all ${isBomEditMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                            >
                                <SlidersHorizontal className="w-4 h-4" />
                                <span className="font-bold text-sm hidden sm:inline">Gestionar</span>
                            </button>
                        )}
                    </div>

                    {selectedBomItems.length > 0 && isBomEditMode && canDelete && (
                        <div className="bg-red-50 border border-red-200 p-3 rounded-2xl flex items-center justify-between animate-in fade-in duration-300">
                            <span className="font-bold text-red-700 text-sm">{selectedBomItems.length} ítems seleccionados</span>
                            <button onClick={handleDeleteSelectedBomItems} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg flex items-center text-sm">
                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar Seleccionados
                            </button>
                        </div>
                    )}

                    {hasDuplicates && (
                        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-center justify-between shadow-lg animate-in fade-in duration-300">
                            <div className="flex items-center gap-3 mr-auto">
                                <div className="p-2.5 bg-red-500/20 text-red-400 rounded-xl">
                                    <AlertTriangle className="w-5 h-5 animate-pulse" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-wider text-red-400">Elementos Duplicados Detectados</h4>
                                    <p className="text-xs text-slate-400 mt-0.5">Se han encontrado componentes duplicados en este proyecto BOM (mismo número de parte).</p>
                                </div>
                            </div>
                            <button
                                onClick={handleMergeAll}
                                disabled={isMerging}
                                className="w-full sm:w-auto px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-all active:scale-95 shadow-md shadow-red-950 flex items-center justify-center gap-1.5 shrink-0"
                            >
                                {isMerging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5" />}
                                Unificar Todos los Duplicados
                            </button>
                        </div>
                    )}

                    {/* BOM Table */}
                    <div className="bg-slate-900/70 rounded-2xl border border-slate-800 shadow-lg overflow-auto flex-1">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-800/80 border-b border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10">
                                <tr>
                                    {isBomEditMode && <th className="p-5 w-10 text-center"><input type="checkbox" className="w-4 h-4" onChange={() => handleToggleSelectAllBomItems(filteredActiveBomItems)} checked={filteredActiveBomItems.length > 0 && selectedBomItems.length === filteredActiveBomItems.length} /></th>}
                                    <th className="p-5 w-32 text-center">Visual</th>
                                    <th className="p-5 w-16">Cant</th>
                                    <th className="p-5">Descripción del Ítem</th>
                                    <th className="p-5 w-28">#PRCR</th>
                                    <th className="p-5 w-44">Estación</th>
                                    <th className="p-5 w-24 text-center">⏱️ Lead</th>
                                    <th className="p-5 text-right">Costo</th>
                                    {isBomEditMode && <th className="p-5 text-center w-28">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {(() => {
                                    // Helper to resolve item details
                                    const resolveDetails = (item) => {
                                        let details = {}; let providerName = '';
                                        if (item.masterPartRef) {
                                            const masterPart = catalogo.find(p => p.id === item.masterPartRef.id);
                                            if (!masterPart) return null;
                                            details = { name: masterPart.name, partNumber: masterPart.partNumber, brandName: managedLists.brands.find(b => b.id === masterPart.brand?.id)?.name || '', categoryName: managedLists.categories.find(c => c.id === masterPart.category?.id)?.name || '', brandId: masterPart.brand?.id || '', categoryId: masterPart.category?.id || '' };
                                            providerName = managedLists.providers.find(p => p.id === (item.proveedor?.id || masterPart.defaultProvider?.id))?.name || '';
                                        } else {
                                            details = { name: item.name, partNumber: item.partNumber, brandName: '', categoryName: '', brandId: '', categoryId: '' };
                                            providerName = item.proveedor ? (typeof item.proveedor === 'string' ? item.proveedor : managedLists.providers.find(p => p.id === item.proveedor.id)?.name) : '';
                                        }
                                        return { details, providerName };
                                    };

                                    // Build groups
                                    const items = filteredActiveBomItems || [];
                                    let groups;
                                    if (groupBy === 'none') {
                                        groups = [{ key: '__all__', label: null, items }];
                                    } else {
                                        const groupMap = {};
                                        items.forEach(item => {
                                            const resolved = resolveDetails(item);
                                            let key, label;
                                            if (groupBy === 'brand') {
                                                key = resolved?.details.brandId || '__none__';
                                                label = resolved?.details.brandName || 'Sin Marca';
                                            } else {
                                                key = resolved?.details.categoryId || '__none__';
                                                label = resolved?.details.categoryName || 'Sin Categoría';
                                            }
                                            if (!groupMap[key]) groupMap[key] = { key, label, items: [] };
                                            groupMap[key].items.push(item);
                                        });
                                        groups = Object.values(groupMap).sort((a, b) => {
                                            if (a.key === '__none__') return 1;
                                            if (b.key === '__none__') return -1;
                                            return a.label.localeCompare(b.label);
                                        });
                                    }

                                    const colCount = 8 + (isBomEditMode ? 2 : 0);
                                    const toggleGroup = (key) => setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));

                                    return groups.map(group => {
                                        const isCollapsed = collapsedGroups[group.key];
                                        const groupTotal = group.items.reduce((s, i) => s + (i.totalPrice || 0), 0);
                                        const groupQty = group.items.reduce((s, i) => s + (i.quantity || 0), 0);

                                        return (
                                            <React.Fragment key={group.key}>
                                                {/* Group Header */}
                                                {group.label && (
                                                    <tr
                                                        className="bg-slate-800/60 cursor-pointer hover:bg-slate-800 transition-colors"
                                                        onClick={() => toggleGroup(group.key)}
                                                    >
                                                        <td colSpan={colCount} className="px-5 py-2.5">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`transition-transform inline-block text-slate-400 ${isCollapsed ? '' : 'rotate-90'}`}>▶</span>
                                                                <span className="font-black text-xs uppercase tracking-wider text-slate-300">{group.label}</span>
                                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">{group.items.length} items · {groupQty} pzs</span>
                                                                <span className="ml-auto text-xs font-black text-green-500">${groupTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                {/* Group Items */}
                                                {!isCollapsed && group.items.map(item => {
                                                    const resolved = resolveDetails(item);
                                                    if (!resolved) return <tr key={item.id}><td colSpan={colCount} className="p-4 text-center text-slate-400">Ítem obsoleto o borrado del catálogo.</td></tr>;
                                                    const { details, providerName } = resolved;
                                                    const isSelected = selectedBomItems.includes(item.id);
                                                    const isDup = isItemDuplicate(item);
                                                    return (
                                                        <tr
                                                            key={item.id}
                                                            className={`group transition-colors border-l-4 ${
                                                                isDup
                                                                    ? 'bg-red-500/10 hover:bg-red-500/20 border-l-red-500 text-red-100/90'
                                                                    : isSelected
                                                                        ? 'bg-indigo-500/10 hover:bg-indigo-500/15 border-l-indigo-500'
                                                                        : 'border-l-transparent hover:bg-slate-800/30'
                                                            }`}
                                                        >
                                                            {isBomEditMode && <td className="p-5 text-center"><input type="checkbox" className="w-4 h-4" checked={isSelected} onChange={() => handleToggleSelectBomItem(item.id)} /></td>}
                                                            <td className="p-3 text-center">
                                                                {(() => {
                                                                    const masterPart = item.masterPartRef ? catalogo.find(p => p.id === item.masterPartRef.id) : null;
                                                                    const imgUrl = masterPart?.imageUrl || item.imageUrl;
                                                                    
                                                                    const openImagePicker = () => {
                                                                        if (masterPart) {
                                                                            // Linked to catalog — save to catalog
                                                                            setImagePickerItem({ id: masterPart.id, name: masterPart.name, partNumber: masterPart.partNumber });
                                                                        } else {
                                                                            // Standalone BOM item — save to BOM item directly
                                                                            setImagePickerItem({ id: item.id, name: item.name, partNumber: item.partNumber, _isBomItem: true });
                                                                        }
                                                                    };
                                                                    
                                                                    return (
                                                                        <div className="w-[120px] h-[120px] mx-auto relative" onDoubleClick={openImagePicker} title="Doble clic para cambiar">
                                                                            {imgUrl ? (
                                                                                <>
                                                                                    <img
                                                                                        src={imgUrl}
                                                                                        alt=""
                                                                                        referrerPolicy="no-referrer"
                                                                                        onClick={() => setZoomedImageUrl(imgUrl)}
                                                                                        className="w-full h-full object-contain rounded-xl border-2 border-slate-200 bg-white transition-all duration-300 cursor-zoom-in hover:border-indigo-400 hover:shadow-lg p-1"
                                                                                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                                                                    />
                                                                                    <div style={{ display: 'none' }} className="absolute inset-0 items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl"><Camera className="w-6 h-6 text-slate-300" /></div>
                                                                                </>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={openImagePicker}
                                                                                    className="w-full h-full rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 transition-all flex items-center justify-center text-slate-300 hover:text-indigo-500"
                                                                                    title="Agregar imagen"
                                                                                >
                                                                                    <Camera className="w-6 h-6" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </td>
                                                            <td className="p-5 font-black text-lg" style={{ color: 'var(--text-primary)' }}>
                                                                {canEdit ? (
                                                                    <InlineEditCell
                                                                        value={item.quantity}
                                                                        onSave={v => handleUpdateBomItem(item.id, { quantity: v, unitPrice: item.unitPrice, prcr: item.prcr, leadTimeWeeks: item.leadTimeWeeks })}
                                                                        placeholder="0"
                                                                        className="font-black text-lg"
                                                                        inputClassName="w-24 font-black text-lg"
                                                                    />
                                                                ) : item.quantity}
                                                            </td>
                                                            <td className="p-5">
                                                                <div className="font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>{details.name || 'Sin nombre'}</div>
                                                                <div className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>{details.partNumber || 'S/N'}</div>
                                                                <div className="flex items-center flex-wrap gap-2 mt-2">
                                                                    {details.brandName && <div className="flex items-center justify-center h-6 px-2 rounded-full border text-[9px] font-black uppercase tracking-tighter text-gray-600 bg-gray-100 border-gray-200"><Tag className="w-3 h-3 mr-1.5 flex-shrink-0" />{details.brandName}</div>}
                                                                    {details.categoryName && <div className="flex items-center justify-center h-6 px-2 rounded-full border text-[9px] font-black uppercase tracking-tighter text-purple-600 bg-purple-50 border-purple-100"><Tag className="w-3 h-3 mr-1.5 flex-shrink-0" />{details.categoryName}</div>}
                                                                    {providerName && <div className="flex items-center justify-center h-6 px-2 rounded-full border text-[9px] font-black uppercase tracking-tighter text-indigo-500 bg-indigo-50 border-indigo-100">Prov: {providerName}</div>}
                                                                    {canEdit && isBomEditMode ? (
                                                                        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-black uppercase text-amber-400 bg-amber-950/20 hover:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-500/20 select-none">
                                                                            <input 
                                                                                type="checkbox" 
                                                                                checked={!!item.isCustomMechanical} 
                                                                                onChange={e => handleUpdateBomItem(item.id, { 
                                                                                    quantity: item.quantity, 
                                                                                    unitPrice: item.unitPrice, 
                                                                                    prcr: item.prcr, 
                                                                                    leadTimeWeeks: item.leadTimeWeeks, 
                                                                                    isCustomMechanical: e.target.checked 
                                                                                })}
                                                                                className="w-3 h-3 rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500" 
                                                                            />
                                                                            A la Medida
                                                                        </label>
                                                                    ) : item.isCustomMechanical ? (
                                                                        <div className="flex items-center justify-center h-6 px-2 rounded-full border text-[9px] font-black uppercase tracking-tighter text-amber-400 bg-amber-950/40 border-amber-500/30">
                                                                            🛠️ Pieza Custom
                                                                        </div>
                                                                    ) : null}
                                                                    {isDup && (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <div className="flex items-center justify-center h-6 px-2 rounded-full border text-[9px] font-black uppercase tracking-tighter text-red-400 bg-red-950/40 border-red-500/30 animate-pulse">
                                                                                ⚠️ Duplicado
                                                                            </div>
                                                                            {canEdit && (
                                                                                <button
                                                                                    onClick={() => handleMergeSingle(details.partNumber)}
                                                                                    disabled={isMerging}
                                                                                    className="flex items-center justify-center h-6 px-2.5 rounded-full border text-[9px] font-black uppercase tracking-tighter text-white bg-red-600 hover:bg-red-700 border-red-500 transition-all active:scale-90"
                                                                                    title="Combinar este componente con sus duplicados"
                                                                                >
                                                                                    <GitMerge className="w-2.5 h-2.5 mr-1" /> Unificar
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-5">
                                                                <div className="flex flex-col gap-1.5">
                                                                    {canEdit ? (
                                                                        <InlineEditCell
                                                                            value={item.prcr || ''}
                                                                            type="text"
                                                                            onSave={v => handleUpdateBomItem(item.id, { quantity: item.quantity, unitPrice: item.unitPrice, prcr: v, leadTimeWeeks: item.leadTimeWeeks })}
                                                                            placeholder="—"
                                                                            className="text-xs font-bold font-mono text-amber-500"
                                                                            inputClassName="w-full text-xs font-mono uppercase"
                                                                        />
                                                                    ) : (
                                                                        item.prcr ? <span className="px-2 py-1 bg-amber-100/10 border border-amber-500/20 text-amber-500 rounded-lg text-xs font-bold font-mono w-max">{item.prcr}</span> : <span className="text-slate-500 text-xs">—</span>
                                                                    )}

                                                                    {(() => {
                                                                        const matchedPO = pos.find(po => 
                                                                            (item.poId && po.id === item.poId) ||
                                                                            (!item.poId && item.prcr && String(po.prcr || '') === String(item.prcr))
                                                                        );
                                                                        if (!matchedPO) return null;
                                                                        const isManualMatch = item.poId && matchedPO.id === item.poId;
                                                                        return (
                                                                            <span 
                                                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider w-max ${
                                                                                    isManualMatch 
                                                                                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                                                                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                                                }`}
                                                                                title={isManualMatch ? "Asociación manual de PO" : "Emparejado por PRCR automático"}
                                                                            >
                                                                                <ShoppingCart className="w-2.5 h-2.5" />
                                                                                PO: {matchedPO.po_number || 'S/N'}
                                                                            </span>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </td>
                                                            <td className="p-5">
                                                                {isBomEditMode && canEdit ? (
                                                                    <select
                                                                        value={item.stationId || ''}
                                                                        onChange={e => handleUpdateBomItem(item.id, { 
                                                                            quantity: item.quantity, 
                                                                            unitPrice: item.unitPrice, 
                                                                            prcr: item.prcr, 
                                                                            leadTimeWeeks: item.leadTimeWeeks, 
                                                                            stationId: e.target.value || null 
                                                                        })}
                                                                        className="w-full text-xs bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                                                                    >
                                                                        <option value="">— Sin Estación —</option>
                                                                        {stations.map(st => (
                                                                            <option key={st.id} value={st.id}>
                                                                                STN{String(st.stn || '').padStart(2, '0')} - {st.abbreviation || st.description}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                ) : (() => {
                                                                    const st = stations.find(s => s.id === item.stationId);
                                                                    return st ? (
                                                                        <span className="inline-flex items-center px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold font-mono">
                                                                            STN{String(st.stn || '').padStart(2, '0')} - {st.abbreviation}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-500 text-xs">—</span>
                                                                    );
                                                                })()}
                                                            </td>
                                                            <td className="p-5 text-center">
                                                                {(() => {
                                                                    const masterPart = item.masterPartRef ? catalogo.find(p => p.id === item.masterPartRef.id) : null;
                                                                    const catalogLT = masterPart?.leadTimeWeeks;
                                                                    const bomLT = item.leadTimeWeeks;
                                                                    const changed = bomLT != null && catalogLT != null && bomLT !== catalogLT;
                                                                    if (bomLT != null) return <span className="text-sm font-bold text-teal-700">{bomLT} sem {changed && <span title={`Catálogo: ${catalogLT} sem`} className="text-amber-500 cursor-help">⚡</span>}</span>;
                                                                    if (catalogLT != null) return <span className="text-sm text-slate-400">{catalogLT} sem</span>;
                                                                    return <span className="text-slate-300 text-xs">—</span>;
                                                                })()}
                                                            </td>
                                                            <td className="p-5 text-right">
                                                                <div className="font-black text-lg" style={{ color: 'var(--text-primary)' }}>${(item.totalPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                                                                {canEdit ? (
                                                                    <InlineEditCell
                                                                        value={item.unitPrice}
                                                                        onSave={v => handleUpdateBomItem(item.id, { quantity: item.quantity, unitPrice: v, prcr: item.prcr, leadTimeWeeks: item.leadTimeWeeks })}
                                                                        prefix="$"
                                                                        suffix="/u"
                                                                        placeholder="$0"
                                                                        className="text-[10px] text-slate-400"
                                                                        inputClassName="w-20 text-[11px]"
                                                                    />
                                                                ) : (
                                                                    <div className="text-[10px] text-slate-400">${item.unitPrice}/u</div>
                                                                )}
                                                            </td>
                                                            {isBomEditMode && (
                                                                <td className="p-5 text-center">
                                                                    <div className='flex justify-center items-center gap-2'>
                                                                        {canEdit && item.masterPartRef && (() => {
                                                                            const masterPart = catalogo.find(p => p.id === item.masterPartRef.id);
                                                                            return masterPart ? (
                                                                                <button onClick={() => handleEditClick(masterPart)} className="p-2 text-amber-500 bg-amber-50 rounded-lg hover:bg-amber-100 transition-all active:scale-90" title="Editar pieza en catálogo">
                                                                                    <Edit3 className="w-4 h-4" />
                                                                                </button>
                                                                            ) : null;
                                                                        })()}
                                                                        {canDelete && <button onClick={() => setConfirmDelete({ isOpen: true, title: 'Quitar ítem', message: `¿Quitar "${details.name}" de la lista?`, onConfirm: () => handleDeleteBomItem(item.id) })} className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-all active:scale-90"><Trash2 className="w-4 h-4" /></button>}
                                                                    </div>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
