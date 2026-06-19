import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppData } from '../../contexts/AppDataContext';
import { useRole } from '../../contexts/RoleContext';
import { supabase } from '../../supabase';
import {
    getPOsByProject, syncProjectPOs, updatePO, deletePO,
    associateItemWithPO, disassociateItemFromPO
} from '../../services/poService';
import * as XLSX from 'xlsx';
import {
    ShoppingCart, Search, Upload, Download, ChevronDown, ChevronUp,
    AlertCircle, CheckCircle2, AlertTriangle, Link2, Unlink, Plus,
    Loader2, Check, DollarSign, X, HelpCircle
} from 'lucide-react';

export default function POControlPanel({ projectId, bomProjectId }) {
    const { canEdit } = useRole();
    const { bomItems, catalogo, managedLists } = useAppData();

    const [pos, setPOs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [associationFilter, setAssociationFilter] = useState('all');
    const [expandedPOId, setExpandedPOId] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState(null);
    const [showManualMatchPOIds, setShowManualMatchPOIds] = useState({});
    const fileInputRef = useRef(null);

    // Manual association states
    const [selectedBomItemId, setSelectedBomItemId] = useState('');

    // Fetch POs
    const loadPOs = async () => {
        setLoading(true);
        try {
            const data = await getPOsByProject(projectId);
            setPOs(data);
        } catch (e) {
            console.error("Error loading POs:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) {
            loadPOs();
        }
    }, [projectId]);

    // BOM items belonging to the associated BOM project
    const activeBomItems = useMemo(() => {
        if (!bomProjectId) return [];
        return bomItems.filter(item => item.projectId === bomProjectId || item.project_id === bomProjectId);
    }, [bomItems, bomProjectId]);

    // Helper to get part details
    const getPartDetails = (item) => {
        if (item.masterPartRef) {
            const mp = catalogo.find(p => p.id === item.masterPartRef.id);
            if (mp) {
                return {
                    name: mp.name,
                    partNumber: mp.partNumber,
                    brand: managedLists.brands.find(b => b.id === mp.brand?.id)?.name || ''
                };
            }
        }
        return {
            name: item.name || 'Sin nombre',
            partNumber: item.partNumber || 'S/N',
            brand: ''
        };
    };

    // Helper para extraer monto de control considerando que puede estar en 'comments' o en 'amount'
    const getControlPoAmount = (po) => {
        if (po.comments) {
            const cleaned = po.comments.replace(/[^0-9.]/g, '');
            const val = parseFloat(cleaned);
            if (!isNaN(val) && val > 0) {
                return val;
            }
        }
        return Number(po.amount || 0);
    };

    // Calculate Summary Stats
    const stats = useMemo(() => {
        const totalRealCost = pos.reduce((sum, po) => sum + getControlPoAmount(po), 0);
        
        // Items associated with any PO (either by po_id or by matching PRCR)
        const matchedBomItems = activeBomItems.filter(item => {
            return (
                item.poId || 
                (item.prcr && pos.some(po => String(po.prcr) === String(item.prcr)))
            );
        });
        
        const totalCotizadoCost = matchedBomItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
        const deviation = totalRealCost - totalCotizadoCost;
        const matchingRate = activeBomItems.length > 0 
            ? Math.round((matchedBomItems.length / activeBomItems.length) * 100) 
            : 0;

        return {
            totalPOCount: pos.length,
            totalRealCost,
            totalCotizadoCost,
            deviation,
            matchingRate,
            matchedCount: matchedBomItems.length,
            unmatchedCount: activeBomItems.length - matchedBomItems.length
        };
    }, [pos, activeBomItems]);

    // Filtering POs
    const filteredPOs = useMemo(() => {
        return pos.filter(po => {
            const matchesSearch = 
                !searchTerm ||
                String(po.supplier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(po.prcr || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(po.po_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(po.comments || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = !statusFilter || po.status === statusFilter;

            // Association filter matching
            let matchesAssociation = true;
            if (associationFilter !== 'all') {
                const associated = activeBomItems.filter(item => {
                    if (item.poId === po.id) return true;
                    if (!item.poId && item.prcr && String(item.prcr) === String(po.prcr)) return true;
                    return false;
                });
                
                if (associationFilter === 'no_items') {
                    matchesAssociation = associated.length === 0;
                } else if (associationFilter === 'with_items') {
                    matchesAssociation = associated.length > 0;
                }
            }

            return matchesSearch && matchesStatus && matchesAssociation;
        });
    }, [pos, searchTerm, statusFilter, associationFilter, activeBomItems]);

    // Status options
    const statusOptions = useMemo(() => {
        const statuses = pos.map(p => p.status).filter(Boolean);
        return [...new Set(statuses)];
    }, [pos]);

    // Excel Date Parser Helper
    const parseExcelDate = (val) => {
        try {
            if (!val) return null;
            let dateStr = null;

            if (val instanceof Date) {
                dateStr = val.toISOString().split('T')[0];
            } else {
                const num = Number(val);
                // 25569 es 1970-01-01. 100000 es aproximadamente el año 2173.
                if (!isNaN(num) && num > 25569 && num < 100000) {
                    const date = new Date((num - 25569) * 86400 * 1000);
                    const offset = date.getTimezoneOffset() * 60000;
                    const localDate = new Date(date.getTime() + offset);
                    dateStr = localDate.toISOString().split('T')[0];
                } else if (typeof val === 'string') {
                    const cleaned = val.trim();
                    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
                        dateStr = cleaned;
                    } else {
                        const parsed = Date.parse(cleaned);
                        if (!isNaN(parsed)) {
                            dateStr = new Date(parsed).toISOString().split('T')[0];
                        }
                    }
                }
            }

            if (dateStr) {
                // Validar que el año esté en un rango lógico (ej. 1970 a 2100)
                const parts = dateStr.split('-');
                const year = parseInt(parts[0], 10);
                if (year >= 1970 && year <= 2100) {
                    return dateStr;
                }
            }
        } catch (e) {
            console.error("Error parsing date:", val, e);
        }
        return null;
    };

    // Import Excel handler
    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsImporting(true);
        setImportError(null);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'coopy') || workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                
                // Read range
                const range = XLSX.utils.decode_range(sheet['!ref']);
                const rows = [];
                
                // Row 0 has headers: Column 1 is Supplier, 2 is Project, 3 is CAP ID, 4 is PRCR...
                // Iterate from Row 1 to end
                for (let r = 1; r <= range.e.r; r++) {
                    const rowData = {};
                    let hasContent = false;

                    const getCellValue = (c) => {
                        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
                        return cell ? cell.v : null;
                    };

                    const supplier = getCellValue(1);
                    const prcr = getCellValue(4);

                    if (supplier || prcr) {
                        hasContent = true;
                        rowData.supplier = supplier ? String(supplier).trim() : null;
                        rowData.project_code = getCellValue(2) ? String(getCellValue(2)).trim() : null;
                        rowData.cap_id = getCellValue(3) ? String(getCellValue(3)).trim() : null;
                        rowData.prcr = prcr ? String(prcr).trim() : null;
                        rowData.type_code = getCellValue(5) ? String(getCellValue(5)).trim() : null;
                        rowData.prcr_start_date = parseExcelDate(getCellValue(6));
                        rowData.po_date = parseExcelDate(getCellValue(7));
                        rowData.amount = parseFloat(getCellValue(8)) || 0;
                        rowData.comments = getCellValue(9) ? String(getCellValue(9)).trim() : null;
                        rowData.expected_date = parseExcelDate(getCellValue(10));
                        rowData.received_date = parseExcelDate(getCellValue(11));
                        rowData.po_number = getCellValue(12) ? String(getCellValue(12)).trim() : null;
                        rowData.status = getCellValue(13) ? String(getCellValue(13)).trim() : null;
                        rowData.made_by = getCellValue(14) ? String(getCellValue(14)).trim() : null;
                    }

                    if (hasContent) {
                        rows.push(rowData);
                    }
                }

                if (rows.length === 0) {
                    throw new Error("No se encontraron registros de órdenes de compra válidos en la pestaña 'coopy'.");
                }

                const result = await syncProjectPOs(projectId, rows);
                console.log("[POControlPanel] Sync result:", result);
                await loadPOs();
                alert(`Importación exitosa:\n${result.insertedCount} creadas, ${result.updatedCount} actualizadas, ${result.deletedCount} eliminadas.`);
            } catch (err) {
                console.error("Error importing PO Excel:", err);
                setImportError(err.message || String(err));
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };

        reader.onerror = () => {
            setImportError("Error al leer el archivo.");
            setIsImporting(false);
        };

        reader.readAsBinaryString(file);
    };

    // Export Excel handler
    const handleExportExcel = () => {
        if (filteredPOs.length === 0) return;

        const rows = filteredPOs.map((po, index) => ({
            'No.': index + 1,
            'Proveedor': po.supplier || '',
            'Project Code': po.project_code || '',
            'CAP ID': po.cap_id || '',
            '#PRCR': po.prcr || '',
            'Tipo': po.type_code || '',
            'Inicio PRCR': po.prcr_start_date || '',
            'Fecha PO': po.po_date || '',
            'Monto Real': getControlPoAmount(po),
            'Comentarios': po.comments || '',
            'Fecha Entrega': po.expected_date || '',
            'Recibido': po.received_date || '',
            'PO Number': po.po_number || '',
            'Estado': po.status || '',
            'Creado Por': po.made_by || ''
        }));

        const wb = XLSX.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        
        // Auto-width
        const wscols = Object.keys(rows[0] || {}).map(key => ({
            wch: Math.max(key.length + 3, ...rows.map(r => String(r[key] || '').length + 2))
        }));
        ws['!cols'] = wscols;

        XLSX.book_append_sheet(wb, ws, 'Control de POs');
        XLSX.writeFile(wb, `Control_POs_${projectId}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Get items associated with a specific PO
    const getAssociatedItems = (po) => {
        return activeBomItems.filter(item => {
            if (item.poId === po.id) return true;
            // Auto match by PRCR if no manual association is set on the item
            if (!item.poId && item.prcr && String(item.prcr) === String(po.prcr)) return true;
            return false;
        });
    };

    // Suggest matching items for a PO
    const getSuggestedItems = (po) => {
        return activeBomItems.filter(item => {
            // Must not be already associated with a PO (no poId and no matching PRCR)
            const isAssociated = item.poId || (item.prcr && pos.some(p => String(p.prcr) === String(item.prcr)));
            if (isAssociated) return false;

            // Suggestions rules:
            // 1. If it has no PRCR, but matches supplier (providerName) and amount is close (+/- 10%)
            const itemDetails = getPartDetails(item);
            const matchesSupplier = po.supplier && itemDetails.brand && String(po.supplier).toLowerCase().includes(itemDetails.brand.toLowerCase());
            
            const poAmount = getControlPoAmount(po);
            const diffPct = poAmount > 0 ? Math.abs((Number(item.totalPrice) - Number(poAmount)) / Number(poAmount)) : 1;
            const matchesAmount = diffPct <= 0.1;

            // Sugerir solo si coincide la marca/proveedor y el monto está dentro del 10%
            return matchesSupplier && matchesAmount;
        });
    };

    // Handle Manual Association
    const handleAssociate = async (poId, itemId) => {
        if (!itemId) return;
        try {
            await associateItemWithPO(itemId, poId);
            setSelectedBomItemId('');
            alert("Ítem de material asociado con éxito.");
        } catch (e) {
            alert("Error al asociar el ítem: " + e.message);
        }
    };

    // Handle Manual Disassociation
    const handleDisassociate = async (itemId) => {
        if (!window.confirm("¿Estás seguro de quitar la asociación de este ítem con la PO?")) return;
        try {
            await disassociateItemFromPO(itemId);
            alert("Asociación removida con éxito.");
        } catch (e) {
            alert("Error al quitar la asociación: " + e.message);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-3 md:p-6 space-y-4">
            
            {/* 1. FINANCIAL SUMMARY BAR */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800 shadow-md flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/15 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                        <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Real POs</div>
                        <div className="text-lg font-black text-white mt-0.5">
                            ${stats.totalRealCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{stats.totalPOCount} requisiciones</div>
                    </div>
                </div>

                <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800 shadow-md flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/15 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">BOM Conciliado</div>
                        <div className="text-lg font-black text-emerald-400 mt-0.5">
                            ${stats.totalCotizadoCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{stats.matchedCount} ítems asociados</div>
                    </div>
                </div>

                <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800 shadow-md flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        stats.deviation > 0 ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'
                    }`}>
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Desviación</div>
                        <div className={`text-lg font-black mt-0.5 ${
                            stats.deviation > 0 ? 'text-red-400' : 'text-green-400'
                        }`}>
                            {stats.deviation > 0 ? '+' : ''}
                            ${stats.deviation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Real vs Cotizado</div>
                    </div>
                </div>

                <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800 shadow-md flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/15 text-purple-400 rounded-xl flex items-center justify-center shrink-0">
                        <Link2 className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tasa de Match</div>
                        <div className="text-lg font-black text-purple-400 mt-0.5">{stats.matchingRate}%</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{stats.unmatchedCount} ítems sin conciliar</div>
                    </div>
                </div>
            </div>

            {/* 2. ACTIONS AND FILTERS ROW */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60 shrink-0">
                <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                    {/* Search Input */}
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar proveedor, PRCR, PO..."
                            className="pl-10 pr-4 py-2 w-full border border-slate-700 rounded-xl text-xs shadow-inner bg-slate-800 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Status filter dropdown */}
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="px-3 py-2 border border-slate-700 rounded-xl text-xs bg-slate-800 text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">Todos los Estados</option>
                        {statusOptions.map(st => (
                            <option key={st} value={st}>{st}</option>
                        ))}
                    </select>

                    {/* Association filter dropdown */}
                    <select
                        value={associationFilter}
                        onChange={e => setAssociationFilter(e.target.value)}
                        className="px-3 py-2 border border-slate-700 rounded-xl text-xs bg-slate-800 text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="all">Todas las POs</option>
                        <option value="with_items">Con Items Conciliados</option>
                        <option value="no_items">Sin Items Conciliados</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    {/* Import/Export buttons */}
                    {canEdit && (
                        <>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImportExcel}
                                accept=".xlsx, .xls"
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current.click()}
                                disabled={isImporting}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center shadow-lg active:scale-95 transition-all text-xs disabled:bg-slate-700 cursor-pointer"
                            >
                                {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                                {isImporting ? "Importando..." : "Importar Control de PO"}
                            </button>
                        </>
                    )}
                    <button
                        onClick={handleExportExcel}
                        disabled={filteredPOs.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold flex items-center shadow-lg active:scale-95 transition-all text-xs disabled:opacity-40 cursor-pointer"
                    >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Exportar Excel
                    </button>
                </div>
            </div>

            {/* Error display if import fails */}
            {importError && (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-start gap-3 animate-in fade-in duration-300">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-bold text-red-400 uppercase">Error al Importar</h4>
                        <p className="text-xs text-slate-400 mt-1">{importError}</p>
                    </div>
                    <button onClick={() => setImportError(null)} className="ml-auto p-1 hover:bg-red-500/20 rounded-lg text-red-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* 3. PO TABLE */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-800 shadow-lg overflow-auto flex-1">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                        <p className="text-xs text-slate-500 mt-2">Cargando control de órdenes de compra...</p>
                    </div>
                ) : filteredPOs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <ShoppingCart className="w-12 h-12 text-slate-600 mb-3" />
                        <p className="text-sm text-slate-500 font-bold">No se encontraron órdenes de compra</p>
                        <p className="text-xs text-slate-600 mt-1">
                            {pos.length === 0 
                                ? "Importa el archivo Excel de control de POs para este proyecto." 
                                : "Ajusta tus criterios de búsqueda o filtros."
                            }
                        </p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-800/80 border-b border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10">
                            <tr>
                                <th className="p-4 w-8"></th>
                                <th className="p-4">Proveedor</th>
                                <th className="p-4 w-24"># PRCR</th>
                                <th className="p-4 w-28">No. PO</th>
                                <th className="p-4 w-28 text-right">Monto Real</th>
                                <th className="p-4 w-24 text-center">F. PO</th>
                                <th className="p-4 w-28 text-center">Estado</th>
                                <th className="p-4 w-28">Solicitante</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filteredPOs.map(po => {
                                const isExpanded = expandedPOId === po.id;
                                const associatedItems = getAssociatedItems(po);
                                const suggestedItems = getSuggestedItems(po);
                                const unmatchedItems = activeBomItems.filter(item => {
                                    return !item.poId && (!item.prcr || !pos.some(p => String(p.prcr) === String(item.prcr)));
                                });

                                const associatedTotalCotizado = associatedItems.reduce((s, i) => s + Number(i.totalPrice || 0), 0);
                                const costDiff = getControlPoAmount(po) - associatedTotalCotizado;

                                const hasNoItems = associatedItems.length === 0;
                                const rowBgClass = isExpanded 
                                    ? 'bg-indigo-500/5 hover:bg-indigo-500/10 border-l-indigo-500/60' 
                                    : hasNoItems 
                                        ? 'bg-red-500/5 hover:bg-red-500/10 dark:bg-red-500/5 dark:hover:bg-red-500/10 border-l-red-500/40' 
                                        : 'border-l-transparent';

                                return (
                                    <React.Fragment key={po.id}>
                                        <tr
                                            onClick={() => setExpandedPOId(isExpanded ? null : po.id)}
                                            className={`hover:bg-slate-800/40 cursor-pointer transition-colors border-l-4 ${rowBgClass}`}
                                        >
                                            <td className="p-4 text-center">
                                                {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                                            </td>
                                            <td className="p-4 font-bold text-slate-900 dark:text-white">
                                                <div className="flex items-center gap-2">
                                                    <span>{po.supplier}</span>
                                                    {hasNoItems && (
                                                        <span 
                                                            title="Sin materiales conciliados: esta orden de compra no tiene ninguna partida asociada en el BOM."
                                                            className="p-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 cursor-help transition-colors shrink-0"
                                                        >
                                                            <AlertCircle className="w-3 h-3 animate-pulse" />
                                                        </span>
                                                    )}
                                                </div>
                                                {po.comments && (
                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-0.5 truncate max-w-xs" title={po.comments}>
                                                        {po.comments}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 font-mono text-xs text-amber-800 dark:text-amber-400 font-bold">{po.prcr || '—'}</td>
                                            <td className="p-4 font-mono text-xs text-slate-700 dark:text-slate-300">{po.po_number || '—'}</td>
                                            <td className="p-4 text-right font-black text-slate-900 dark:text-white">
                                                ${getControlPoAmount(po).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-4 text-center text-xs text-slate-700 dark:text-slate-400">
                                                {po.po_date || po.prcr_start_date || '—'}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                    String(po.status).toLowerCase().includes('approved') || String(po.status).toLowerCase().includes('aprobado')
                                                        ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                                                        : String(po.status).toLowerCase().includes('cancel') || String(po.status).toLowerCase().includes('rechaz')
                                                            ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                                }`}>
                                                    {po.status || 'Pendiente'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-xs text-slate-700 dark:text-slate-400 truncate max-w-[100px]" title={po.made_by}>
                                                {po.made_by || '—'}
                                            </td>
                                        </tr>

                                        {/* COLLAPSIBLE DETAILS FOR MATCHING */}
                                        {isExpanded && (() => {
                                            const isMatchingOk = associatedItems.length > 0 && Math.abs(costDiff) <= 5;
                                            const forceRightPanel = !!showManualMatchPOIds[po.id];
                                            const showRightPanel = !isMatchingOk || forceRightPanel;

                                            return (
                                                <tr>
                                                    <td colSpan="8" className="p-6 bg-slate-50 dark:bg-slate-950/40 border-t border-b border-slate-200 dark:border-indigo-500/20">
                                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                                            
                                                            {/* LEFT COLUMN: Associated Items */}
                                                            <div className={`${showRightPanel ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4`}>
                                                                <div className="flex items-center justify-between flex-wrap gap-2">
                                                                    <div className="flex items-center gap-3">
                                                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                                            Materiales BOM Conciliados ({associatedItems.length})
                                                                        </h4>
                                                                        {isMatchingOk && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setShowManualMatchPOIds(prev => ({ ...prev, [po.id]: !prev[po.id] }));
                                                                                }}
                                                                                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-900/30"
                                                                            >
                                                                                {forceRightPanel ? "Ocultar Herramientas" : "Editar / Agregar Componentes"}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    {associatedItems.length > 0 && (
                                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                                                                            isMatchingOk
                                                                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40'
                                                                                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40'
                                                                        }`}>
                                                                            Diferencia: {costDiff > 0 ? '+' : ''}${costDiff.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {associatedItems.length === 0 ? (
                                                                    <div className="border border-dashed border-slate-300 dark:border-slate-800 p-6 rounded-xl text-center text-slate-500 text-xs bg-white dark:bg-slate-900">
                                                                        No hay materiales asociados a esta orden de compra. Usa las sugerencias o la asociación manual de la derecha para conectarlos.
                                                                    </div>
                                                                ) : (
                                                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                                                                        <table className="w-full text-left text-xs">
                                                                            <thead className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/50 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                                                <tr>
                                                                                    <th className="p-3">Nº Parte / Componente</th>
                                                                                    <th className="p-3 w-16 text-center">Cant</th>
                                                                                    <th className="p-3 w-28 text-right">Unitario</th>
                                                                                    <th className="p-3 w-28 text-right">Cotizado Total</th>
                                                                                    <th className="p-3 w-24 text-center">Match</th>
                                                                                    {canEdit && <th className="p-3 w-16"></th>}
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                                {associatedItems.map(item => {
                                                                                    const part = getPartDetails(item);
                                                                                    const isManual = item.poId === po.id;
                                                                                    return (
                                                                                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 text-slate-700 dark:text-slate-300">
                                                                                            <td className="p-3">
                                                                                                <div className="font-bold text-slate-900 dark:text-slate-200">{part.name}</div>
                                                                                                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">{part.partNumber}</div>
                                                                                            </td>
                                                                                            <td className="p-3 text-center font-bold">{item.quantity}</td>
                                                                                            <td className="p-3 text-right">
                                                                                                ${Number(item.unitPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                                                            </td>
                                                                                            <td className="p-3 text-right font-black text-slate-900 dark:text-white">
                                                                                                ${Number(item.totalPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                                                            </td>
                                                                                            <td className="p-3 text-center">
                                                                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                                                                                    isManual 
                                                                                                        ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30' 
                                                                                                        : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30'
                                                                                                }`}>
                                                                                                    {isManual ? 'Manual' : 'Automático'}
                                                                                                </span>
                                                                                            </td>
                                                                                            {canEdit && (
                                                                                                <td className="p-3 text-center">
                                                                                                    {isManual ? (
                                                                                                        <button
                                                                                                            onClick={() => handleDisassociate(item.id)}
                                                                                                            className="p-1 hover:bg-red-500/10 rounded text-red-500 transition"
                                                                                                            title="Desvincular material de la PO"
                                                                                                        >
                                                                                                            <Unlink className="w-3.5 h-3.5" />
                                                                                                        </button>
                                                                                                    ) : (
                                                                                                        <span className="text-[9px] text-slate-400 dark:text-slate-600" title="Los matches automáticos se definen por número de PRCR. Edita el PRCR del ítem para removerlo.">🔒</span>
                                                                                                    )}
                                                                                                </td>
                                                                                            )}
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* RIGHT COLUMN: Suggestions & Manual Match */}
                                                            {showRightPanel && (
                                                                <div className="lg:col-span-4 space-y-4 border-l border-slate-200 dark:border-slate-800/80 pl-0 lg:pl-6">
                                                                    
                                                                    {/* Suggested Matches */}
                                                                    <div>
                                                                        <h5 className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mb-2">
                                                                            <HelpCircle className="w-3.5 h-3.5" />
                                                                            Sugerencias de Matching ({suggestedItems.length})
                                                                        </h5>
                                                                        {suggestedItems.length === 0 ? (
                                                                            <div className="text-[11px] text-slate-500 italic bg-slate-100 dark:bg-slate-900/30 p-3 rounded-lg border border-slate-200 dark:border-slate-800/50">
                                                                                No se encontraron ítems de BOM sugeridos para esta PO.
                                                                            </div>
                                                                        ) : (
                                                                            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                                                                                {suggestedItems.map(item => {
                                                                                    const part = getPartDetails(item);
                                                                                    return (
                                                                                        <div key={item.id} className="bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between gap-2 text-xs shadow-sm">
                                                                                            <div className="min-w-0">
                                                                                                <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{part.name}</div>
                                                                                                <div className="text-[9px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                                                                                    {part.partNumber} · ${Number(item.totalPrice || 0).toLocaleString('en-US')}
                                                                                                </div>
                                                                                            </div>
                                                                                            {canEdit && (
                                                                                                <button
                                                                                                    onClick={() => handleAssociate(po.id, item.id)}
                                                                                                    className="px-2 py-1 bg-indigo-50 dark:bg-indigo-600/10 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 hover:text-white rounded border border-indigo-200 dark:border-indigo-500/20 text-[10px] font-bold transition shrink-0"
                                                                                                >
                                                                                                    Vincular
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Manual Match form */}
                                                                    {canEdit && (
                                                                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60">
                                                                            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2">
                                                                                <Plus className="w-3.5 h-3.5" />
                                                                                Asociar Manualmente
                                                                            </h5>
                                                                            {unmatchedItems.length === 0 ? (
                                                                                <div className="text-[11px] text-slate-600 italic">
                                                                                    No hay ítems del BOM libres para asociar en este proyecto.
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex gap-2">
                                                                                    <select
                                                                                        value={selectedBomItemId}
                                                                                        onChange={e => setSelectedBomItemId(e.target.value)}
                                                                                        className="flex-1 px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                                                                                    >
                                                                                        <option value="">Selecciona componente...</option>
                                                                                        {unmatchedItems.map(item => {
                                                                                            const part = getPartDetails(item);
                                                                                            return (
                                                                                                <option key={item.id} value={item.id}>
                                                                                                    {part.partNumber} - {part.name.substring(0, 25)}... (${item.totalPrice})
                                                                                                </option>
                                                                                            );
                                                                                        })}
                                                                                    </select>
                                                                                    <button
                                                                                        onClick={() => handleAssociate(po.id, selectedBomItemId)}
                                                                                        disabled={!selectedBomItemId}
                                                                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-40"
                                                                                    >
                                                                                        Asociar
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })()}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

        </div>
    );
}
