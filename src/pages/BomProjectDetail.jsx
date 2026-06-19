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
    GitMerge, ShoppingCart, ChevronDown, ChevronUp, CornerDownRight
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
    const [expandedParts, setExpandedParts] = useState({});
    const [activeBomTab, setActiveBomTab] = useState('general'); // 'general' | 'electric_pneumatic' | 'mechanical'

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

    // ── Helper rendering functions for BOM table cells ──
    const renderVisualCell = (item) => {
        const masterPart = item.masterPartRef ? catalogo.find(p => p.id === item.masterPartRef.id) : null;
        const imgUrl = masterPart?.imageUrl || item.imageUrl;
        const openImagePicker = () => {
            if (masterPart) {
                setImagePickerItem({ id: masterPart.id, name: masterPart.name, partNumber: masterPart.partNumber });
            } else {
                setImagePickerItem({ id: item.id, name: item.name, partNumber: item.partNumber, _isBomItem: true });
            }
        };
        return (
            <div className="w-[80px] h-[80px] mx-auto relative" onDoubleClick={openImagePicker} title="Doble clic para cambiar">
                {imgUrl ? (
                    <>
                        <img
                            src={imgUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            onClick={() => setZoomedImageUrl(imgUrl)}
                            className="w-full h-full object-contain rounded-xl border border-slate-700 bg-white transition-all duration-300 cursor-zoom-in hover:border-indigo-400 hover:shadow-lg p-1"
                            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                        <div style={{ display: 'none' }} className="absolute inset-0 items-center justify-center bg-slate-800 border border-dashed border-slate-700 rounded-xl"><Camera className="w-5 h-5 text-slate-500" /></div>
                    </>
                ) : (
                    <button
                        onClick={openImagePicker}
                        className="w-full h-full rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-900 transition-all flex items-center justify-center text-slate-600 hover:text-indigo-400"
                        title="Agregar imagen"
                    >
                        <Camera className="w-5 h-5" />
                    </button>
                )}
            </div>
        );
    };

    const renderQtyCell = (item) => {
        return canEdit ? (
            <InlineEditCell
                value={item.quantity}
                onSave={v => handleUpdateBomItem(item.id, { quantity: v, unitPrice: item.unitPrice, prcr: item.prcr, leadTimeWeeks: item.leadTimeWeeks, stationId: item.stationId, isCustomMechanical: item.isCustomMechanical })}
                placeholder="0"
                className="font-black text-lg"
                inputClassName="w-20 font-black text-lg"
            />
        ) : item.quantity;
    };

    const renderDescriptionCell = (item, details, providerName) => {
        return (
            <div>
                <div className="font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>{details.name || 'Sin nombre'}</div>
                <div className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>{details.partNumber || 'S/N'}</div>
                <div className="flex items-center flex-wrap gap-2 mt-2">
                    {details.brandName && <div className="flex items-center justify-center h-6 px-2 rounded-full border text-[9px] font-black uppercase tracking-tighter text-slate-400 bg-slate-800 border-slate-700"><Tag className="w-3 h-3 mr-1.5 flex-shrink-0" />{details.brandName}</div>}
                    {details.categoryName && <div className="flex items-center justify-center h-6 px-2 rounded-full border text-[9px] font-black uppercase tracking-tighter text-purple-400 bg-purple-950/20 border-purple-800/30"><Tag className="w-3 h-3 mr-1.5 flex-shrink-0" />{details.categoryName}</div>}
                    {providerName && <div className="flex items-center justify-center h-6 px-2 rounded-full border text-[9px] font-black uppercase tracking-tighter text-indigo-400 bg-indigo-950/20 border-indigo-900/30">Prov: {providerName}</div>}
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
                                    stationId: item.stationId,
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
                </div>
            </div>
        );
    };

    const renderPrcrCell = (item) => {
        return (
            <div className="flex flex-col gap-1.5">
                {canEdit ? (
                    <InlineEditCell
                        value={item.prcr || ''}
                        type="text"
                        onSave={v => handleUpdateBomItem(item.id, { quantity: item.quantity, unitPrice: item.unitPrice, prcr: v, leadTimeWeeks: item.leadTimeWeeks, stationId: item.stationId, isCustomMechanical: item.isCustomMechanical })}
                        placeholder="—"
                        className="text-xs font-bold font-mono text-amber-500"
                        inputClassName="w-full text-xs font-mono uppercase"
                    />
                ) : (
                    item.prcr ? <span className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg text-xs font-bold font-mono w-max">{item.prcr}</span> : <span className="text-slate-500 text-xs">—</span>
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
                                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' 
                                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            }`}
                            title={isManualMatch ? "Asociación manual de PO" : "Emparejado por PRCR automático"}
                        >
                            <ShoppingCart className="w-2.5 h-2.5" />
                            PO: {matchedPO.po_number || 'S/N'}
                        </span>
                    );
                })()}
            </div>
        );
    };

    const renderStationCell = (item) => {
        return isBomEditMode && canEdit ? (
            <select
                value={item.stationId || ''}
                onChange={e => handleUpdateBomItem(item.id, { 
                    quantity: item.quantity, 
                    unitPrice: item.unitPrice, 
                    prcr: item.prcr, 
                    leadTimeWeeks: item.leadTimeWeeks, 
                    isCustomMechanical: item.isCustomMechanical,
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
        })();
    };

    const renderLeadCell = (item) => {
        const masterPart = item.masterPartRef ? catalogo.find(p => p.id === item.masterPartRef.id) : null;
        const catalogLT = masterPart?.leadTimeWeeks;
        const bomLT = item.leadTimeWeeks;
        const changed = bomLT != null && catalogLT != null && bomLT !== catalogLT;
        if (bomLT != null) return <span className="text-sm font-bold text-teal-400">{bomLT} sem {changed && <span title={`Catálogo: ${catalogLT} sem`} className="text-amber-500 cursor-help">⚡</span>}</span>;
        if (catalogLT != null) return <span className="text-sm text-slate-500">{catalogLT} sem</span>;
        return <span className="text-slate-600 text-xs">—</span>;
    };

    const renderCostCell = (item) => {
        return (
            <div className="text-right">
                <div className="font-black text-lg" style={{ color: 'var(--text-primary)' }}>${(item.totalPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                {canEdit ? (
                    <InlineEditCell
                        value={item.unitPrice}
                        onSave={v => handleUpdateBomItem(item.id, { quantity: item.quantity, unitPrice: v, prcr: item.prcr, leadTimeWeeks: item.leadTimeWeeks, stationId: item.stationId, isCustomMechanical: item.isCustomMechanical })}
                        prefix="$"
                        suffix="/u"
                        placeholder="$0"
                        className="text-[10px] text-slate-500"
                        inputClassName="w-20 text-[11px]"
                    />
                ) : (
                    <div className="text-[10px] text-slate-500">${item.unitPrice}/u</div>
                )}
            </div>
        );
    };

    const renderActionsCell = (item, details) => {
        return (
            <div className='flex justify-center items-center gap-2'>
                {canEdit && item.masterPartRef && (() => {
                    const masterPart = catalogo.find(p => p.id === item.masterPartRef.id);
                    return masterPart ? (
                        <button onClick={() => handleEditClick(masterPart)} className="p-2 text-amber-500 bg-amber-500/10 rounded-lg hover:bg-amber-500/20 transition-all active:scale-90" title="Editar pieza en catálogo">
                            <Edit3 className="w-4 h-4" />
                        </button>
                    ) : null;
                })()}
                {canDelete && <button onClick={() => setConfirmDelete({ isOpen: true, title: 'Quitar ítem', message: `¿Quitar "${details.name}" de la lista?`, onConfirm: () => handleDeleteBomItem(item.id) })} className="p-2 text-red-500 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-all active:scale-90"><Trash2 className="w-4 h-4" /></button>}
            </div>
        );
    };

    // Reset on project change
    useEffect(() => {
        setSelectedBomItems([]);
        setBomFilters({ search: '', brand: [], category: [], provider: [], prcr: '', station: '' });
        setIsBomEditMode(false);
        setActiveBomTab('general');
    }, [resolvedProjectId]);

    const resolveIsMechanical = useCallback((item) => {
        if (item.isCustomMechanical) return true;
        
        // Robust retrieval of providerId
        let providerId = item.proveedor?.id || item.proveedor_id || null;
        
        if (!providerId && item.masterPartRef) {
            const masterPart = catalogo.find(p => p.id === item.masterPartRef.id);
            if (masterPart) {
                providerId = masterPart.defaultProvider?.id || masterPart.default_provider_id || null;
            }
        }
        
        if (providerId) {
            const prov = managedLists.providers.find(p => p.id === providerId);
            console.log(`[resolveIsMechanical] Item: ${item.partNumber || 'S/N'}, providerId: ${providerId}, Found Provider: ${prov ? prov.name : 'NO'}, is_workshop: ${prov ? prov.is_workshop : 'N/A'}`);
            if (prov && prov.is_workshop) return true;
        }
        return false;
    }, [catalogo, managedLists.providers]);


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

            // Tab filtering (General, Eléctrico & Neumático, Mecánico)
            const isMechanical = resolveIsMechanical(item);
            if (activeBomTab === 'mechanical' && !isMechanical) return false;
            if (activeBomTab === 'electric_pneumatic' && isMechanical) return false;

            const s = bomFilters.search.toLowerCase();
            const matchesSearch = !s || 
                String(details.name || '').toLowerCase().includes(s) || 
                String(details.partNumber || '').toLowerCase().includes(s) ||
                String(item.prcr || '').toLowerCase().includes(s);
            const matchesBrand = bomFilters.brand.length === 0 || bomFilters.brand.includes(details.brandId);
            const matchesCategory = bomFilters.category.length === 0 || bomFilters.category.includes(details.categoryId);
            const matchesProvider = bomFilters.provider.length === 0 || bomFilters.provider.includes(details.providerId);
            const matchesPrcr = !bomFilters.prcr || (item.prcr || '') === bomFilters.prcr;
            const matchesStation = !bomFilters.station || item.stationId === bomFilters.station;

            return matchesSearch && matchesBrand && matchesCategory && matchesProvider && matchesPrcr && matchesStation;
        });
    }, [activeBomItems, catalogo, bomFilters, activeBomTab, resolveIsMechanical]);

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
                        <button onClick={() => setCatalogPickerOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-11 px-4 rounded-xl font-bold flex items-center shadow-lg active:scale-95 transition-all text-sm">
                            <PackagePlus className="w-4 h-4 mr-1.5" /> Catálogo
                        </button>
                        <div className="relative">
                            <input type="file" ref={pdfInputRef} onChange={(e) => handlePdfUpload(e, activeProject)} accept=".pdf" className="hidden" />
                            <button onClick={() => pdfInputRef.current.click()} disabled={isProcessing} className="bg-slate-800 hover:bg-slate-700 text-white h-11 px-4 rounded-xl font-bold flex items-center shadow-lg active:scale-95 transition-all disabled:bg-slate-600 text-sm border border-slate-700">
                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5 text-yellow-400 fill-yellow-400" />}
                                {isProcessing ? "..." : "PDF"}
                            </button>
                        </div>
                    </>
                )}
                <button
                    onClick={() => handleExportBomToExcel()}
                    disabled={!activeBomItems || activeBomItems.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-4 rounded-xl font-bold flex items-center shadow-lg active:scale-95 transition-all text-sm disabled:opacity-40"
                >
                    <Download className="w-4 h-4 mr-1.5" /> Excel
                </button>
                <div className="bg-emerald-500/15 border border-emerald-500/30 h-11 px-3 rounded-xl text-right flex items-center gap-2">
                    <span className="text-[10px] font-black text-green-600 uppercase tracking-widest leading-none">
                        {activeBomTab === 'general' ? 'Inv. Total' : activeBomTab === 'mechanical' ? 'Inv. Mecánico' : 'Inv. Eléc & Neum'}
                    </span>
                    <span className="text-base font-black text-green-500 tracking-tighter leading-none">
                        ${(activeBomItems || [])
                            .filter(i => activeBomTab === 'general' || (activeBomTab === 'mechanical' ? resolveIsMechanical(i) : !resolveIsMechanical(i)))
                            .reduce((s, i) => s + (i.totalPrice || 0), 0)
                            .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            {/* Pestañas de Disciplina / Vista (General, Eléctrico & Neumático, Mecánico) */}
            <div className="flex bg-slate-950/40 p-1 rounded-xl border border-slate-800/80 gap-1.5 self-start mt-1.5 shrink-0">
                {[
                    { id: 'general', label: 'General', count: activeBomItems.length },
                    { id: 'electric_pneumatic', label: 'Eléctrico & Neumático', count: activeBomItems.filter(i => !resolveIsMechanical(i)).length },
                    { id: 'mechanical', label: 'Mecánico', count: activeBomItems.filter(i => resolveIsMechanical(i)).length }
                ].map(tab => {
                    const isActive = activeBomTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveBomTab(tab.id);
                                setSelectedBomItems([]);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 active:scale-95 ${
                                isActive
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                            }`}
                        >
                            {tab.label}
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                                isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-500'
                            }`}>
                                {tab.count}
                            </span>
                        </button>
                    );
                })}
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
                                className="pl-12 pr-4 h-11 w-full border border-slate-700 rounded-xl text-sm shadow-inner outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-white"
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
                                    <SearchableDropdown 
                                        compact 
                                        options={[{ value: '', label: 'Todos los PRCR' }, ...pcrValues.map(p => ({ value: p, label: p }))]} 
                                        value={bomFilters.prcr} 
                                        onChange={val => setBomFilters({ ...bomFilters, prcr: val })} 
                                        placeholder="#PRCR"
                                        className="w-full h-11 px-3 text-left flex items-center justify-between border border-slate-700 rounded-xl bg-slate-800 text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                                    />
                                </div>
                            );
                            return null;
                        })()}
                        {stations.length > 0 && (
                            <div className="w-full sm:w-auto sm:min-w-[160px]">
                                <select
                                    value={bomFilters.station || ''}
                                    onChange={e => setBomFilters({ ...bomFilters, station: e.target.value })}
                                    className="px-3 h-11 w-full border border-slate-700 rounded-xl text-sm bg-slate-800 text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
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
                                className={`h-11 px-3 rounded-xl border flex items-center gap-1.5 transition-all text-sm font-bold ${groupBy !== 'none' ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                title="Agrupar por..."
                            >
                                <Layers className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{groupBy === 'none' ? 'Agrupar' : groupBy === 'brand' ? 'Marca' : 'Categoría'}</span>
                            </button>
                        </div>
                        {canEdit && (
                            <button
                                onClick={() => { setIsBomEditMode(!isBomEditMode); setSelectedBomItems([]); }}
                                className={`h-11 px-4 rounded-xl border flex items-center gap-2 transition-all ${isBomEditMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
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

                    {/* Visual grouping is active by default. No separate merge banner needed. */}

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
                                                {!isCollapsed && (() => {
                                                    // Helper to group by Part Number
                                                    const getPartNumberGroupedRows = (itemsList) => {
                                                        const norm = (pn) => String(pn || '').trim().replace(/\s+/g, '').toUpperCase();
                                                        const grouped = {};
                                                        const standalones = [];
                                                        itemsList.forEach(item => {
                                                            let pn = '';
                                                            if (item.masterPartRef) {
                                                                const mp = catalogo.find(p => p.id === item.masterPartRef.id);
                                                                if (mp) pn = mp.partNumber;
                                                            } else {
                                                                pn = item.partNumber;
                                                            }
                                                            const key = norm(pn);
                                                            if (!key || key === 'S/N' || key === '') {
                                                                standalones.push(item);
                                                            } else {
                                                                if (!grouped[key]) grouped[key] = [];
                                                                grouped[key].push(item);
                                                            }
                                                        });

                                                        const rows = [];
                                                        Object.keys(grouped).forEach(key => {
                                                            const items = grouped[key];
                                                            if (items.length > 1) {
                                                                rows.push({
                                                                    isParent: true,
                                                                    partNumberKey: key,
                                                                    items: items,
                                                                    representativeItem: items[0]
                                                                });
                                                            } else {
                                                                rows.push({
                                                                    isParent: false,
                                                                    item: items[0]
                                                                });
                                                            }
                                                        });
                                                        standalones.forEach(item => {
                                                            rows.push({
                                                                isParent: false,
                                                                item: item
                                                            });
                                                        });
                                                        return rows;
                                                    };

                                                    const groupedRows = getPartNumberGroupedRows(group.items);

                                                    return groupedRows.map((row) => {
                                                        if (row.isParent) {
                                                            const resolved = resolveDetails(row.representativeItem);
                                                            if (!resolved) return null;
                                                            const { details, providerName } = resolved;
                                                            const isExpanded = !!expandedParts[row.partNumberKey];
                                                            const toggleExpand = () => setExpandedParts(prev => ({ ...prev, [row.partNumberKey]: !isExpanded }));

                                                            const totalQty = row.items.reduce((s, i) => s + (i.quantity || 0), 0);
                                                            const totalCost = row.items.reduce((s, i) => s + (i.totalPrice || 0), 0);
                                                            const areAllPrcrSame = row.items.every(i => (i.prcr || '') === (row.items[0].prcr || ''));
                                                            const areAllStationsSame = row.items.every(i => i.stationId === row.items[0].stationId);
                                                            const arePricesSame = row.items.every(i => i.unitPrice === row.items[0].unitPrice);
                                                            const priceSummary = arePricesSame 
                                                                ? `$${(row.items[0].unitPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}/u` 
                                                                : 'Precios varían';

                                                            const allIds = row.items.map(i => i.id);
                                                            const isAllSelected = allIds.every(id => selectedBomItems.includes(id));
                                                            const handleToggleSelectParent = () => {
                                                                if (isAllSelected) {
                                                                    setSelectedBomItems(prev => prev.filter(id => !allIds.includes(id)));
                                                                } else {
                                                                    setSelectedBomItems(prev => [...new Set([...prev, ...allIds])]);
                                                                }
                                                            };

                                                            return (
                                                                <React.Fragment key={row.partNumberKey}>
                                                                    <tr 
                                                                        className="group border-l-4 border-l-indigo-500/60 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors cursor-pointer select-none"
                                                                        onDoubleClick={(e) => {
                                                                            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
                                                                                return;
                                                                            }
                                                                            if (canEdit && row.representativeItem.masterPartRef) {
                                                                                const masterPart = catalogo.find(p => p.id === row.representativeItem.masterPartRef.id);
                                                                                if (masterPart) {
                                                                                    handleEditClick(masterPart);
                                                                                }
                                                                            }
                                                                        }}
                                                                    >
                                                                        {isBomEditMode && (
                                                                            <td className="p-5 text-center">
                                                                                <input 
                                                                                    type="checkbox" 
                                                                                    className="w-4 h-4" 
                                                                                    checked={isAllSelected} 
                                                                                    onChange={handleToggleSelectParent} 
                                                                                />
                                                                            </td>
                                                                        )}
                                                                        <td className="p-3 text-center">
                                                                            {renderVisualCell(row.representativeItem)}
                                                                        </td>
                                                                        <td className="p-5 font-black text-lg text-slate-300">
                                                                            <div className="flex flex-col">
                                                                                <span>{totalQty}</span>
                                                                                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Total</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="p-5">
                                                                            <div className="font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>{details.name || 'Sin nombre'}</div>
                                                                            <div className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>{details.partNumber || 'S/N'}</div>
                                                                            <div className="flex items-center flex-wrap gap-2 mt-2">
                                                                                {details.brandName && <div className="flex items-center justify-center h-6 px-2 rounded-full border text-[9px] font-black uppercase tracking-tighter text-slate-400 bg-slate-800 border-slate-700"><Tag className="w-3 h-3 mr-1.5 flex-shrink-0" />{details.brandName}</div>}
                                                                                {details.categoryName && <div className="flex items-center justify-center h-6 px-2 rounded-full border text-[9px] font-black uppercase tracking-tighter text-purple-400 bg-purple-950/20 border-purple-800/30"><Tag className="w-3 h-3 mr-1.5 flex-shrink-0" />{details.categoryName}</div>}
                                                                                {providerName && <div className="flex items-center justify-center h-6 px-2 rounded-full border text-[9px] font-black uppercase tracking-tighter text-indigo-400 bg-indigo-950/20 border-indigo-900/30">Prov: {providerName}</div>}
                                                                                <button
                                                                                    onClick={toggleExpand}
                                                                                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-950/30 border-indigo-500/30 hover:bg-indigo-500/20 transition-all select-none"
                                                                                >
                                                                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                                                    {isExpanded ? 'Ocultar compras' : `Ver compras (${row.items.length})`}
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                        <td className="p-5">
                                                                            <div className="flex flex-col gap-1">
                                                                                {areAllPrcrSame && row.items[0].prcr ? (
                                                                                    <span className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg text-xs font-bold font-mono w-max">{row.items[0].prcr}</span>
                                                                                ) : (
                                                                                    <span className="text-slate-400 text-xs font-bold font-mono">
                                                                                        {row.items.map(i => i.prcr).filter(Boolean).length > 0 
                                                                                            ? `Múltiples (${[...new Set(row.items.map(i => i.prcr).filter(Boolean))].length})`
                                                                                            : '—'
                                                                                        }
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="p-5">
                                                                            {areAllStationsSame ? (
                                                                                renderStationCell(row.representativeItem)
                                                                            ) : (
                                                                                <span className="inline-flex items-center px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold">
                                                                                    Varios
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-5 text-center">
                                                                            {renderLeadCell(row.representativeItem)}
                                                                        </td>
                                                                        <td className="p-5 text-right">
                                                                            <div className="font-black text-lg" style={{ color: 'var(--text-primary)' }}>
                                                                                ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                                            </div>
                                                                            <div className="text-[10px] text-slate-500">
                                                                                {priceSummary}
                                                                            </div>
                                                                        </td>
                                                                        {isBomEditMode && (
                                                                            <td className="p-5 text-center">
                                                                                {renderActionsCell(row.representativeItem, details)}
                                                                            </td>
                                                                        )}
                                                                    </tr>

                                                                    {isExpanded && row.items.map(childItem => {
                                                                        const isChildSelected = selectedBomItems.includes(childItem.id);
                                                                        const childResolved = resolveDetails(childItem);
                                                                        const childDetails = childResolved?.details || details;
                                                                        return (
                                                                            <tr 
                                                                                key={childItem.id} 
                                                                                className="group border-l-4 border-l-slate-700 bg-slate-950/40 hover:bg-slate-900/30 transition-colors border-b border-b-slate-900/20 cursor-pointer select-none"
                                                                                onDoubleClick={(e) => {
                                                                                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
                                                                                        return;
                                                                                    }
                                                                                    if (canEdit && childItem.masterPartRef) {
                                                                                        const masterPart = catalogo.find(p => p.id === childItem.masterPartRef.id);
                                                                                        if (masterPart) {
                                                                                            handleEditClick(masterPart);
                                                                                        }
                                                                                    }
                                                                                }}
                                                                            >
                                                                                {isBomEditMode && (
                                                                                    <td className="p-5 text-center">
                                                                                        <input 
                                                                                            type="checkbox" 
                                                                                            className="w-4 h-4" 
                                                                                            checked={isChildSelected} 
                                                                                            onChange={() => handleToggleSelectBomItem(childItem.id)} 
                                                                                        />
                                                                                    </td>
                                                                                )}
                                                                                <td className="p-3 text-center text-slate-600">
                                                                                    <CornerDownRight className="w-4 h-4 mx-auto" />
                                                                                </td>
                                                                                <td className="p-5 font-black text-lg" style={{ color: 'var(--text-primary)' }}>
                                                                                    {renderQtyCell(childItem)}
                                                                                </td>
                                                                                <td className="p-5">
                                                                                    <div className="text-xs font-bold text-slate-400">
                                                                                        Requisición / Línea de Compra
                                                                                    </div>
                                                                                    {childItem.isCustomMechanical ? (
                                                                                        <div className="mt-1 text-[9px] font-black uppercase text-amber-400 bg-amber-950/40 border border-amber-500/30 w-max px-2 py-0.5 rounded-full">
                                                                                            🛠️ Pieza Custom
                                                                                        </div>
                                                                                    ) : null}
                                                                                </td>
                                                                                <td className="p-5">
                                                                                    {renderPrcrCell(childItem)}
                                                                                </td>
                                                                                <td className="p-5">
                                                                                    {renderStationCell(childItem)}
                                                                                </td>
                                                                                <td className="p-5 text-center">
                                                                                    {renderLeadCell(childItem)}
                                                                                </td>
                                                                                <td className="p-5 text-right">
                                                                                    {renderCostCell(childItem)}
                                                                                </td>
                                                                                {isBomEditMode && (
                                                                                    <td className="p-5 text-center">
                                                                                        <button 
                                                                                            onClick={() => setConfirmDelete({ 
                                                                                                isOpen: true, 
                                                                                                title: 'Quitar ítem', 
                                                                                                message: `¿Quitar esta compra con PRCR "${childItem.prcr || '—'}" de la lista?`, 
                                                                                                onConfirm: () => handleDeleteBomItem(childItem.id) 
                                                                                            })} 
                                                                                            className="p-2 text-red-500 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-all active:scale-90"
                                                                                        >
                                                                                            <Trash2 className="w-4 h-4" />
                                                                                        </button>
                                                                                    </td>
                                                                                )}
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </React.Fragment>
                                                            );
                                                        } else {
                                                            // Standalone item
                                                            const item = row.item;
                                                            const resolved = resolveDetails(item);
                                                            if (!resolved) return <tr key={item.id}><td colSpan={colCount} className="p-4 text-center text-slate-400">Ítem obsoleto o borrado del catálogo.</td></tr>;
                                                            const { details, providerName } = resolved;
                                                            const isSelected = selectedBomItems.includes(item.id);
                                                            return (
                                                                <tr
                                                                    key={item.id}
                                                                    className={`group transition-colors border-l-4 cursor-pointer select-none ${
                                                                        isSelected
                                                                            ? 'bg-indigo-500/10 hover:bg-indigo-500/15 border-l-indigo-500'
                                                                            : 'border-l-transparent hover:bg-slate-800/30'
                                                                    }`}
                                                                    onDoubleClick={(e) => {
                                                                        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
                                                                            return;
                                                                        }
                                                                        if (canEdit && item.masterPartRef) {
                                                                            const masterPart = catalogo.find(p => p.id === item.masterPartRef.id);
                                                                            if (masterPart) {
                                                                                handleEditClick(masterPart);
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    {isBomEditMode && <td className="p-5 text-center"><input type="checkbox" className="w-4 h-4" checked={isSelected} onChange={() => handleToggleSelectBomItem(item.id)} /></td>}
                                                                    <td className="p-3 text-center">
                                                                        {renderVisualCell(item)}
                                                                    </td>
                                                                    <td className="p-5 font-black text-lg" style={{ color: 'var(--text-primary)' }}>
                                                                        {renderQtyCell(item)}
                                                                    </td>
                                                                    <td className="p-5">
                                                                        {renderDescriptionCell(item, details, providerName)}
                                                                    </td>
                                                                    <td className="p-5">
                                                                        {renderPrcrCell(item)}
                                                                    </td>
                                                                    <td className="p-5">
                                                                        {renderStationCell(item)}
                                                                    </td>
                                                                    <td className="p-5 text-center">
                                                                        {renderLeadCell(item)}
                                                                    </td>
                                                                    <td className="p-5 text-right">
                                                                        {renderCostCell(item)}
                                                                    </td>
                                                                    {isBomEditMode && (
                                                                        <td className="p-5 text-center">
                                                                            {renderActionsCell(item, details)}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            );
                                                        }
                                                    });
                                                })()}
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
