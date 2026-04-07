import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRole } from '../contexts/RoleContext';
import { useAppData } from '../contexts/AppDataContext';
import { deleteBomItem } from '../services/bomCrudService';
import SearchableDropdown from '../components/ui/SearchableDropdown';
import FilterPopover from '../components/ui/FilterPopover';
import CatalogPickerModal from '../components/catalog/CatalogPickerModal';
import BomItemEditModal from '../components/projects/BomItemEditModal';
import {
    Search, Trash2, ArrowLeft, PackagePlus, X,
    Loader2, Sparkles, SlidersHorizontal, Edit3,
    Tag, Camera
} from 'lucide-react';

export default function BomProjectDetail() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const { canEdit, canDelete } = useRole();
    const {
        proyectos, catalogo, bomItems, managedLists,
        brandOptions, categoryOptions, providerOptions,
        isProcessing, handlePdfUpload, handleConfirmImport,
        handleUpdateBomItem, handleAddFromCatalog,
        setConfirmDelete, setImagePickerItem, setZoomedImageUrl,
        pdfInputRef,
    } = useAppData();

    const activeProject = proyectos.find(p => p.id === projectId);

    // Store active project reference for PdfReviewModal callback
    useEffect(() => {
        window.__activeProject__ = activeProject;
        return () => { window.__activeProject__ = null; };
    }, [activeProject]);

    const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
    const [editingBomItem, setEditingBomItem] = useState(null);
    const [isBomEditMode, setIsBomEditMode] = useState(false);
    const [selectedBomItems, setSelectedBomItems] = useState([]);
    const [bomFilters, setBomFilters] = useState({ search: '', brand: [], category: [], provider: [], prcr: '' });

    // Reset on project change
    useEffect(() => {
        setSelectedBomItems([]);
        setBomFilters({ search: '', brand: [], category: [], provider: [], prcr: '' });
        setIsBomEditMode(false);
    }, [projectId]);

    const activeBomItems = activeProject
        ? bomItems.filter(i => i.projectId === activeProject.id).sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt))
        : [];

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
                    providerId: item.proveedor?.id || ''
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

            return matchesSearch && matchesBrand && matchesCategory && matchesProvider && matchesPrcr;
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
                // Dynamic import for one-shot batch delete
                const { deleteBomItemsBatch } = await import('../services/bomCrudService');
                await deleteBomItemsBatch(selectedBomItems);
                setSelectedBomItems([]);
            }
        });
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
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
            {editingBomItem && (
                <BomItemEditModal
                    item={editingBomItem}
                    onClose={() => setEditingBomItem(null)}
                    onSave={(itemId, updatedData, catalogLeadTimeUpdate) => {
                        handleUpdateBomItem(itemId, updatedData, catalogLeadTimeUpdate);
                        setEditingBomItem(null);
                    }}
                    catalogLeadTime={editingBomItem?.masterPartRef ? catalogo.find(p => p.id === editingBomItem.masterPartRef.id)?.leadTimeWeeks : null}
                />
            )}

            {catalogPickerOpen && (
                <CatalogPickerModal
                    catalogo={catalogo}
                    managedLists={managedLists}
                    onClose={() => setCatalogPickerOpen(false)}
                    onAddItems={(items) => handleAddFromCatalog(items, activeProject)}
                />
            )}

            {/* Header */}
            <div className="bg-slate-900/70 backdrop-blur-sm p-6 md:p-8 rounded-2xl border border-slate-800 shadow-lg flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
                <div className="text-center md:text-left">
                    <button onClick={() => navigate('/bom/projects')} className="text-indigo-600 font-bold text-sm flex items-center mb-1 hover:underline"><ArrowLeft className="w-4 h-4 mr-1" /> Volver</button>
                    <h2 className="text-3xl font-black text-white tracking-tight">{activeProject.name}</h2>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    {canEdit && (
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button onClick={() => setCatalogPickerOpen(true)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3.5 rounded-2xl font-black flex items-center justify-center shadow-xl active:scale-95 transition-all text-sm">
                                <PackagePlus className="w-5 h-5 mr-2" /> <span className="hidden sm:inline">Desde </span>Catálogo
                            </button>
                            <div className="relative flex-1">
                                <input type="file" ref={pdfInputRef} onChange={(e) => handlePdfUpload(e, activeProject)} accept=".pdf" className="hidden" />
                                <button onClick={() => pdfInputRef.current.click()} disabled={isProcessing} className="w-full h-full bg-slate-900 text-white px-5 py-3.5 rounded-2xl font-black flex items-center justify-center shadow-xl active:scale-95 transition-all disabled:bg-slate-400 text-sm">
                                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2 text-yellow-400 fill-yellow-400" />}
                                    {isProcessing ? "Procesando..." : <><span className="hidden sm:inline">Importar </span>PDF</>}
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="bg-emerald-500/15 border border-emerald-500/30 px-4 py-3 rounded-2xl text-right w-full sm:w-auto sm:min-w-[140px] flex flex-col justify-center">
                        <div className="text-[10px] font-black text-green-800 uppercase tracking-widest leading-none mb-1">Inversión</div>
                        <div className="text-2xl font-black text-green-700 tracking-tighter leading-none">
                            ${(activeBomItems || []).reduce((s, i) => s + (i.totalPrice || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 gap-8">
                <div className="col-span-1 space-y-4">
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={bomFilters.search}
                                onChange={e => setBomFilters({ ...bomFilters, search: e.target.value })}
                                placeholder="Buscar en BOM..."
                                className="pl-12 pr-4 py-3 w-full border border-slate-700 rounded-2xl text-sm shadow-inner outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-white"
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
                        {canEdit && (
                            <button
                                onClick={() => { setIsBomEditMode(!isBomEditMode); setSelectedBomItems([]); }}
                                className={`px-4 py-3 rounded-xl border flex items-center gap-2 transition-all ${isBomEditMode ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
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

                    {/* BOM Table */}
                    <div className="bg-slate-900/70 rounded-2xl border border-slate-800 shadow-lg overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-800/80 border-b border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10">
                                <tr>
                                    {isBomEditMode && <th className="p-5 w-10 text-center"><input type="checkbox" className="w-4 h-4" onChange={() => handleToggleSelectAllBomItems(filteredActiveBomItems)} checked={filteredActiveBomItems.length > 0 && selectedBomItems.length === filteredActiveBomItems.length} /></th>}
                                    <th className="p-5 w-32 text-center">Visual</th>
                                    <th className="p-5 w-16">Cant</th>
                                    <th className="p-5">Descripción del Ítem</th>
                                    <th className="p-5 w-28">#PRCR</th>
                                    <th className="p-5 w-24 text-center">⏱️ Lead</th>
                                    <th className="p-5 text-right">Costo</th>
                                    {isBomEditMode && <th className="p-5 text-center w-28">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {(filteredActiveBomItems || []).map(item => {
                                    let details = {}; let providerName = '';
                                    const isSelected = selectedBomItems.includes(item.id);
                                    if (item.masterPartRef) {
                                        const masterPart = catalogo.find(p => p.id === item.masterPartRef.id);
                                        if (!masterPart) return <tr key={item.id}><td colSpan="5" className="p-4 text-center text-slate-400">Ítem obsoleto o borrado del catálogo.</td></tr>;
                                        details = { name: masterPart.name, partNumber: masterPart.partNumber, brandName: managedLists.brands.find(b => b.id === masterPart.brand?.id)?.name || '', categoryName: managedLists.categories.find(c => c.id === masterPart.category?.id)?.name || '' };
                                        providerName = managedLists.providers.find(p => p.id === item.proveedor?.id)?.name || '';
                                    } else {
                                        details = { name: item.name, partNumber: item.partNumber };
                                        providerName = item.proveedor ? (typeof item.proveedor === 'string' ? item.proveedor : managedLists.providers.find(p => p.id === item.proveedor.id)?.name) : '';
                                    }
                                    return (
                                        <tr key={item.id} className={`group transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50/50'}`}>
                                            {isBomEditMode && <td className="p-5 text-center"><input type="checkbox" className="w-4 h-4" checked={isSelected} onChange={() => handleToggleSelectBomItem(item.id)} /></td>}
                                            <td className="p-3 text-center">
                                                {(() => {
                                                    const masterPart = item.masterPartRef ? catalogo.find(p => p.id === item.masterPartRef.id) : null;
                                                    const imgUrl = masterPart?.imageUrl;
                                                    return (
                                                        <div className="w-[120px] h-[120px] mx-auto relative" onDoubleClick={() => masterPart && setImagePickerItem({ id: masterPart.id, name: masterPart.name, partNumber: masterPart.partNumber })} title="Doble clic para cambiar">
                                                            {imgUrl ? (
                                                                <>
                                                                    <img
                                                                        src={imgUrl}
                                                                        alt=""
                                                                        onClick={() => setZoomedImageUrl(imgUrl)}
                                                                        className="w-full h-full object-contain rounded-xl border-2 border-slate-200 bg-white transition-all duration-300 cursor-zoom-in hover:border-indigo-400 hover:shadow-lg p-1"
                                                                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                                                    />
                                                                    <div style={{ display: 'none' }} className="absolute inset-0 items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl"><Camera className="w-6 h-6 text-slate-300" /></div>
                                                                </>
                                                            ) : (
                                                                <button
                                                                    onClick={() => masterPart && setImagePickerItem({ id: masterPart.id, name: masterPart.name, partNumber: masterPart.partNumber })}
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
                                            <td className="p-5 font-black text-lg" style={{ color: 'var(--text-primary)' }}>{item.quantity}</td>
                                            <td className="p-5">
                                                <div className="font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>{details.name || 'Sin nombre'}</div>
                                                <div className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>{details.partNumber || 'S/N'}</div>
                                                <div className="flex items-center flex-wrap gap-2 mt-2">
                                                    {details.brandName && <div className="flex items-center justify-center h-6 px-2 rounded-full border text-[9px] font-black uppercase tracking-tighter text-gray-600 bg-gray-100 border-gray-200"><Tag className="w-3 h-3 mr-1.5 flex-shrink-0" />{details.brandName}</div>}
                                                    {details.categoryName && <div className="flex items-center justify-center h-6 px-2 rounded-full border text-[9px] font-black uppercase tracking-tighter text-purple-600 bg-purple-50 border-purple-100"><Tag className="w-3 h-3 mr-1.5 flex-shrink-0" />{details.categoryName}</div>}
                                                    {providerName && <div className="flex items-center justify-center h-6 px-2 rounded-full border text-[9px] font-black uppercase tracking-tighter text-indigo-500 bg-indigo-50 border-indigo-100">Prov: {providerName}</div>}
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                {item.prcr ? <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold font-mono">{item.prcr}</span> : <span className="text-slate-300 text-xs">—</span>}
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
                                                <div className="text-[10px] text-slate-400">${item.unitPrice}/u</div>
                                            </td>
                                            {isBomEditMode && (
                                                <td className="p-5 text-center">
                                                    <div className='flex justify-center items-center gap-2'>
                                                        {canEdit && <button onClick={() => setEditingBomItem(item)} className="p-2 text-amber-500 bg-amber-50 rounded-lg hover:bg-amber-100 transition-all active:scale-90"><Edit3 className="w-4 h-4" /></button>}
                                                        {canDelete && <button onClick={() => setConfirmDelete({ isOpen: true, title: 'Quitar ítem', message: `¿Quitar "${details.name}" de la lista?`, onConfirm: () => deleteBomItem(item.id) })} className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-all active:scale-90"><Trash2 className="w-4 h-4" /></button>}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
