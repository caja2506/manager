// Archivo: src/hooks/useAutoBomData.js
// ======================================
// Custom hook owning all BOM-related subscriptions,
// computed values, and CRUD handlers.
// Dual-backend: Supabase or Firebase.

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabase';

// ── Helpers ──

const safeLocaleCompare = (a, b, field) =>
    String(a[field] || '').localeCompare(String(b[field] || ''));

const fetchAllItemsBom = async () => {
    let allItems = [];
    let start = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await supabase
            .from('items_bom')
            .select('*')
            .range(start, start + pageSize - 1);
        if (error) {
            console.error("Error al paginar items_bom:", error);
            break;
        }
        if (!data || data.length === 0) break;
        allItems = allItems.concat(data);
        if (data.length < pageSize) break;
        start += pageSize;
    }
    return allItems;
};

const fetchAllCatalogoMaestro = async () => {
    let allItems = [];
    let start = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await supabase
            .from('catalogo_maestro')
            .select('*')
            .order('name')
            .range(start, start + pageSize - 1);
        if (error) {
            console.error("Error al paginar catalogo_maestro:", error);
            break;
        }
        if (!data || data.length === 0) break;
        allItems = allItems.concat(data);
        if (data.length < pageSize) break;
        start += pageSize;
    }
    return allItems;
};

// ============================================================
// Hook
// ============================================================

export function useAutoBomData() {

    // ── State ──

    const [proyectos, setProyectos] = useState([]);
    const [catalogo, setCatalogo] = useState([]);
    const [bomItems, setBomItems] = useState([]);
    const [managedLists, setManagedLists] = useState({
        categories: [],
        providers: [],
        brands: [],
    });

    // Master Record Modal state
    const [isMasterRecordModalOpen, setIsMasterRecordModalOpen] = useState(false);
    const [editingMasterRecord, setEditingMasterRecord] = useState(null);

    // Image Picker state
    const [imagePickerItem, setImagePickerItem] = useState(null);

    // Image Lightbox state
    const [zoomedImageUrl, setZoomedImageUrl] = useState(null);

    // Refs
    const pdfInputRef = useRef(null);
    const excelInputRef = useRef(null);

    // ── Supabase → camelCase mappers ──
    const mapProject = (r) => ({
        ...r,
        createdAt: r.created_at || r.createdAt,
        createdBy: r.created_by || r.createdBy,
    });

    const mapCatalogItem = (r) => ({
        ...r,
        partNumber: r.part_number || r.partNumber || '',
        lastPrice: Number(r.last_price ?? r.lastPrice ?? 0),
        brand: r.brand_id ? { id: r.brand_id } : r.brand || null,
        category: r.category_id ? { id: r.category_id } : r.category || null,
        defaultProvider: r.default_provider_id ? { id: r.default_provider_id } : r.defaultProvider || null,
        leadTimeWeeks: r.lead_time_weeks ?? r.leadTimeWeeks ?? null,
        imageUrl: r.image_url || r.imageUrl || '',
    });

    const mapBomItem = (r) => ({
        ...r,
        projectId: r.project_id || r.projectId,
        poId: r.po_id || r.poId || null,
        isCustomMechanical: r.is_custom_mechanical || r.isCustomMechanical || false,
        stationId: r.station_id || r.stationId || null,
        masterPartRef: r.master_part_ref_id ? { id: r.master_part_ref_id } : r.masterPartRef || null,
        quantity: Number(r.quantity || 0),
        unitPrice: Number(r.unit_price ?? r.unitPrice ?? 0),
        totalPrice: Number(r.total_price ?? r.totalPrice ?? 0),
        proveedor: r.proveedor_id ? { id: r.proveedor_id } : r.proveedor || null,
        addedAt: r.added_at || r.addedAt || r.created_at || '',
        leadTimeWeeks: r.lead_time_weeks ?? r.leadTimeWeeks ?? null,
        imageUrl: r.image_url || r.imageUrl || '',
        partNumber: r.part_number || r.partNumber || '',
        name: r.name || '',
    });

    // ── Data Subscriptions ──

    useEffect(() => {
        // Initial fetch for all collections
        const fetchAll = async () => {
            const [p, c, b, cat, prov, br] = await Promise.all([
                supabase.from('proyectos_bom').select('*').order('created_at', { ascending: false }),
                fetchAllCatalogoMaestro(),
                fetchAllItemsBom(),
                supabase.from('categorias').select('*').order('name'),
                supabase.from('proveedores').select('*').order('name'),
                supabase.from('marcas').select('*').order('name'),
            ]);
            if (p.data) setProyectos(p.data.map(mapProject));
            if (c) setCatalogo(c.map(mapCatalogItem));
            if (b) setBomItems(b.map(mapBomItem));
            setManagedLists({
                categories: (cat.data || []).filter(d => d.name),
                providers: (prov.data || []).filter(d => d.name),
                brands: (br.data || []).filter(d => d.name),
            });
        };
        fetchAll();

        // Realtime for key tables
        const refreshLists = async () => {
            const [cat, prov, br] = await Promise.all([
                supabase.from('categorias').select('*').order('name'),
                supabase.from('proveedores').select('*').order('name'),
                supabase.from('marcas').select('*').order('name'),
            ]);
            setManagedLists({
                categories: (cat.data || []).filter(d => d.name),
                providers: (prov.data || []).filter(d => d.name),
                brands: (br.data || []).filter(d => d.name),
            });
        };

        const ch = supabase.channel('autobom-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos_bom' }, () => {
                supabase.from('proyectos_bom').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setProyectos(data.map(mapProject)));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'catalogo_maestro' }, () => {
                fetchAllCatalogoMaestro().then(data => data && setCatalogo(data.map(mapCatalogItem)));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'items_bom' }, () => {
                fetchAllItemsBom().then(data => data && setBomItems(data.map(mapBomItem)));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias' }, refreshLists)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'proveedores' }, refreshLists)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'marcas' }, refreshLists)
            .subscribe();

        return () => supabase.removeChannel(ch);
    }, []);

    // ── Computed Values ──

    const brandOptions = useMemo(() =>
        managedLists.brands.map(b => ({ value: b.id, label: b.name })),
        [managedLists.brands]
    );

    const categoryOptions = useMemo(() =>
        managedLists.categories.map(c => ({ value: c.id, label: c.name })),
        [managedLists.categories]
    );

    const providerOptions = useMemo(() =>
        managedLists.providers.map(p => ({ value: p.id, label: p.name })),
        [managedLists.providers]
    );

    // ============================================================
    // Handlers — Projects
    // ============================================================

    const handleSaveProject = async (e, projectData, editingProjectId) => {
        e.preventDefault();
        if (!projectData.name.trim()) return;
        const data = { name: projectData.name, description: projectData.description, createdAt: new Date().toISOString() };
        const sbData = { name: projectData.name, description: projectData.description || '', created_at: new Date().toISOString() };
        if (editingProjectId) {
            await supabase.from('proyectos_bom').update(sbData).eq('id', editingProjectId);
        } else {
            await supabase.from('proyectos_bom').insert(sbData);
        }
    };

    // ============================================================
    // Handlers — Master Catalog
    // ============================================================

    const saveMasterRecord = async (formData) => {
        if (!formData.name || !formData.partNumber) return alert('Nombre y P/N obligatorios.');

        // Optimistic UI Update for Catalog
        const optBrand = formData.brand ? { id: formData.brand } : null;
        const optCategory = formData.category ? { id: formData.category } : null;
        const optProvider = formData.defaultProvider ? { id: formData.defaultProvider } : null;

        const optimisticItem = {
            id: editingMasterRecord?.id || `temp_cat_${Date.now()}`,
            name: String(formData.name).trim(),
            partNumber: String(formData.partNumber).replace(/\s+/g, '').toUpperCase(),
            lastPrice: Number(formData.lastPrice) || 0,
            brand: optBrand,
            category: optCategory,
            defaultProvider: optProvider,
            leadTimeWeeks: formData.leadTimeWeeks === '' ? null : Number(formData.leadTimeWeeks),
            imageUrl: formData.imageUrl ? String(formData.imageUrl).trim() : (editingMasterRecord?.imageUrl || ''),
        };

        setCatalogo(prev => {
            const next = [...prev];
            if (editingMasterRecord) {
                const idx = next.findIndex(i => i.id === editingMasterRecord.id);
                if (idx !== -1) {
                    next[idx] = { ...next[idx], ...optimisticItem };
                }
            } else {
                next.push(optimisticItem);
            }
            return next.sort((a, b) => safeLocaleCompare(a, b, 'name'));
        });

        try {
            const data = {
                name: String(formData.name).trim(),
                part_number: String(formData.partNumber).replace(/\s+/g, '').toUpperCase(),
                last_price: Number(formData.lastPrice) || 0,
                brand_id: formData.brand || null,
                category_id: formData.category || null,
                default_provider_id: formData.defaultProvider || null,
                lead_time_weeks: formData.leadTimeWeeks === '' ? null : Number(formData.leadTimeWeeks),
                image_url: formData.imageUrl ? String(formData.imageUrl).trim() : '',
            };
            if (editingMasterRecord) {
                const { error } = await supabase.from('catalogo_maestro').update(data).eq('id', editingMasterRecord.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('catalogo_maestro').insert(data);
                if (error) throw error;
            }
            // Refresh local state immediately
            const updatedCatalog = await fetchAllCatalogoMaestro();
            if (updatedCatalog) setCatalogo(updatedCatalog.map(mapCatalogItem));
        } catch (err) {
            console.error('Error saving master record:', err);
            alert('Error al guardar el registro: ' + (err.message || err));
        }
        setEditingMasterRecord(null);
        setIsMasterRecordModalOpen(false);
    };

    const handleMergeAllDuplicates = async (projectId) => {
        const activeItems = bomItems.filter(i => i.projectId === projectId || i.project_id === projectId);
        const norm = (pn) => String(pn || '').trim().replace(/\s+/g, '').toUpperCase();
        
        // Group items by normalized Part Number
        const groups = {};
        activeItems.forEach(item => {
            let pn = '';
            if (item.masterPartRef) {
                const mpRefId = item.masterPartRef.id || item.master_part_ref_id;
                const mp = catalogo.find(p => p.id === mpRefId);
                if (mp) pn = mp.partNumber;
            } else {
                pn = item.partNumber;
            }
            const key = norm(pn);
            if (key && key !== 'S/N' && key !== '') {
                if (!groups[key]) groups[key] = [];
                groups[key].push(item);
            }
        });
        
        const duplicateGroups = Object.values(groups).filter(g => g.length > 1);
        if (duplicateGroups.length === 0) return;
        
        try {
            for (const group of duplicateGroups) {
                const survivor = group[0];
                const totalQty = group.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                const totalPrice = totalQty * Number(survivor.unitPrice || survivor.unit_price || 0);
                
                await supabase.from('items_bom').update({
                    quantity: totalQty,
                    total_price: totalPrice
                }).eq('id', survivor.id);
                
                const idsToDelete = group.slice(1).map(item => item.id);
                await supabase.from('items_bom').delete().in('id', idsToDelete);
            }
            const data = await fetchAllItemsBom();
            if (data) setBomItems(data.map(mapBomItem));
        } catch (err) {
            console.error('Error merging all duplicates:', err);
            alert('Error al unificar duplicados: ' + (err.message || err));
        }
    };

    const handleMergeSingleDuplicate = async (projectId, partNumberToMerge) => {
        const activeItems = bomItems.filter(i => i.projectId === projectId || i.project_id === projectId);
        const norm = (pn) => String(pn || '').trim().replace(/\s+/g, '').toUpperCase();
        const targetKey = norm(partNumberToMerge);
        
        const group = activeItems.filter(item => {
            let pn = '';
            if (item.masterPartRef) {
                const mpRefId = item.masterPartRef.id || item.master_part_ref_id;
                const mp = catalogo.find(p => p.id === mpRefId);
                if (mp) pn = mp.partNumber;
            } else {
                pn = item.partNumber;
            }
            return norm(pn) === targetKey;
        });
        
        if (group.length <= 1) return;
        
        try {
            const survivor = group[0];
            const totalQty = group.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
            const totalPrice = totalQty * Number(survivor.unitPrice || survivor.unit_price || 0);
            
            await supabase.from('items_bom').update({
                quantity: totalQty,
                total_price: totalPrice
            }).eq('id', survivor.id);
            
            const idsToDelete = group.slice(1).map(item => item.id);
            await supabase.from('items_bom').delete().in('id', idsToDelete);
            
            const data = await fetchAllItemsBom();
            if (data) setBomItems(data.map(mapBomItem));
        } catch (err) {
            console.error('Error merging single duplicate:', err);
            alert('Error al unificar duplicado: ' + (err.message || err));
        }
    };

    // ============================================================
    // Handlers — BOM Items
    // ============================================================
    const handleUpdateBomItem = async (itemId, updatedData, catalogLeadTimeUpdate) => {
        const newData = { ...updatedData, totalPrice: (updatedData.quantity || 0) * (updatedData.unitPrice || 0) };

        // Find old item for status transition check
        const oldItem = bomItems.find(i => i.id === itemId);

        // Optimistic UI Update for items_bom
        setBomItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const qty = updatedData.quantity !== undefined ? Number(updatedData.quantity) : (item.quantity || 0);
                const price = updatedData.unitPrice !== undefined ? Number(updatedData.unitPrice) : (item.unitPrice || 0);
                return {
                    ...item,
                    ...updatedData,
                    quantity: qty,
                    unitPrice: price,
                    totalPrice: qty * price
                };
            }
            return item;
        }));

        // Optimistic UI Update for catalog (lead time update)
        if (catalogLeadTimeUpdate !== undefined) {
            const bomItem = bomItems.find(i => i.id === itemId);
            const refId = bomItem?.masterPartRef?.id || bomItem?.master_part_ref_id;
            if (refId) {
                setCatalogo(prev => prev.map(c => 
                    c.id === refId ? { ...c, leadTimeWeeks: catalogLeadTimeUpdate } : c
                ));
            }
        }

        try {
            // Map camelCase → snake_case for Supabase columns
            const sbData = {
                quantity: newData.quantity,
                unit_price: newData.unitPrice,
                total_price: newData.totalPrice,
                prcr: newData.prcr,
                lead_time_weeks: newData.leadTimeWeeks,
            };
            if (newData.status !== undefined) sbData.status = newData.status;
            if (newData.isCustomMechanical !== undefined) sbData.is_custom_mechanical = newData.isCustomMechanical;
            if (newData.stationId !== undefined) sbData.station_id = newData.stationId;

            await supabase.from('items_bom').update(sbData).eq('id', itemId);

            // Check for "Comprado" status transition to create receipt task in Gantt
            const statusWasChanged = newData.status !== undefined && oldItem && String(oldItem.status).toLowerCase() !== 'comprado';
            const isComprado = newData.status !== undefined && String(newData.status).toLowerCase() === 'comprado';

            if (statusWasChanged && isComprado) {
                const targetStationId = newData.stationId !== undefined ? newData.stationId : (oldItem?.stationId || null);
                
                // 1. Fetch engineering project linked to this BOM project
                const { data: engProj } = await supabase
                    .from('projects')
                    .select('id')
                    .eq('bom_project_id', oldItem.projectId)
                    .maybeSingle();

                if (engProj && engProj.id) {
                    const leadWeeks = Number(newData.leadTimeWeeks ?? oldItem.leadTimeWeeks ?? 1) || 1;
                    const startDate = new Date();
                    const dueDate = new Date(startDate.getTime() + leadWeeks * 7 * 24 * 60 * 60 * 1000);
                    
                    const formattedStart = startDate.toISOString().split('T')[0];
                    const formattedDue = dueDate.toISOString().split('T')[0];

                    // Find details
                    let partNumber = oldItem.partNumber || '';
                    let partName = oldItem.name || 'Componente';
                    if (oldItem.masterPartRef) {
                        const mp = catalogo.find(p => p.id === oldItem.masterPartRef.id);
                        if (mp) {
                            partNumber = mp.partNumber || '';
                            partName = mp.name || 'Componente';
                        }
                    }

                    const taskTitle = `Recibo: ${partNumber || 'S/N'} - ${partName}`;

                    // Check if a task with this title already exists in the project
                    const { data: existingTask } = await supabase
                        .from('tasks')
                        .select('id')
                        .eq('project_id', engProj.id)
                        .eq('title', taskTitle)
                        .maybeSingle();

                    if (!existingTask) {
                        const taskRow = {
                            id: crypto.randomUUID(),
                            project_id: engProj.id,
                            station_id: targetStationId,
                            title: taskTitle,
                            status: 'pending',
                            planned_start_date: formattedStart,
                            planned_end_date: formattedDue,
                            due_date: formattedDue,
                            show_in_gantt: true,
                            milestone: false,
                            summary_task: false,
                            percent_complete: 0,
                            estimated_hours: 0,
                            actual_hours: 0,
                            created_at: new Date().toISOString()
                        };

                        await supabase.from('tasks').insert(taskRow);
                        console.log(`[useAutoBomData] Auto-created receipt task for BOM item ${itemId}:`, taskTitle);
                    }
                }
            }

            if (catalogLeadTimeUpdate !== undefined) {
                const bomItem = bomItems.find(i => i.id === itemId);
                const refId = bomItem?.masterPartRef?.id || bomItem?.master_part_ref_id;
                if (refId) await supabase.from('catalogo_maestro').update({ lead_time_weeks: catalogLeadTimeUpdate }).eq('id', refId);
            }
        } catch (err) {
            console.error('Error updating BOM item:', err);
        }
    };

    const handleAddFromCatalog = async (itemsToAdd, activeProject) => {
        // Separate items that already exist in the project BOM vs new ones
        const existingBom = bomItems.filter(bi => bi.projectId === activeProject.id);

        const toUpdate = [];
        const toInsert = [];

        for (const { item, quantity } of itemsToAdd) {
            const existing = existingBom.find(bi => {
                const refId = bi.masterPartRef?.id || bi.master_part_ref_id;
                return refId === item.id;
            });
            if (existing) {
                const newQty = (existing.quantity || 0) + Number(quantity);
                const unitPrice = existing.unitPrice || Number(item.lastPrice || item.last_price || 0);
                toUpdate.push({ id: existing.id, newQty, unitPrice });
            } else {
                toInsert.push({ item, quantity });
            }
        }

        // Optimistic UI Update
        setBomItems(prev => {
            const next = [...prev];
            toUpdate.forEach(({ id, newQty, unitPrice }) => {
                const idx = next.findIndex(i => i.id === id);
                if (idx !== -1) {
                    next[idx] = {
                        ...next[idx],
                        quantity: newQty,
                        totalPrice: newQty * unitPrice
                    };
                }
            });
            toInsert.forEach(({ item, quantity }) => {
                next.push({
                    id: `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                    projectId: activeProject.id,
                    project_id: activeProject.id,
                    masterPartRef: { id: item.id },
                    master_part_ref_id: item.id,
                    quantity: Number(quantity),
                    unitPrice: Number(item.lastPrice || item.last_price || 0),
                    totalPrice: Number(quantity) * Number(item.lastPrice || item.last_price || 0),
                    proveedor: item.defaultProvider ? { id: item.defaultProvider.id } : null,
                    proveedor_id: item.defaultProvider?.id || null,
                    status: 'Requerido',
                    addedAt: new Date().toISOString(),
                    added_at: new Date().toISOString()
                });
            });
            return next;
        });

        try {
            // Update existing items — increase quantity
            for (const { id, newQty, unitPrice } of toUpdate) {
                await supabase.from('items_bom').update({
                    quantity: newQty,
                    total_price: newQty * unitPrice,
                }).eq('id', id);
            }
            // Insert new items
            if (toInsert.length > 0) {
                const rows = toInsert.map(({ item, quantity }) => ({
                    project_id: activeProject.id,
                    master_part_ref_id: item.id,
                    quantity: Number(quantity),
                    unit_price: Number(item.lastPrice || item.last_price || 0),
                    total_price: Number(quantity) * Number(item.lastPrice || item.last_price || 0),
                    proveedor_id: item.defaultProvider?.id || item.default_provider_id || null,
                    status: 'Requerido',
                    added_at: new Date().toISOString(),
                }));
                await supabase.from('items_bom').insert(rows);
            }
        } catch (err) {
            console.error('Error adding from catalog:', err);
        }
    };

    const handleDeleteBomItem = async (itemId) => {
        // Optimistic UI Update
        setBomItems(prev => prev.filter(i => i.id !== itemId));

        try {
            await supabase.from('items_bom').delete().eq('id', itemId);
        } catch (err) {
            console.error('Error deleting BOM item:', err);
            alert('Error al eliminar el ítem: ' + (err.message || err));
        }
    };

    const handleDeleteBomItemsBatch = async (itemIds) => {
        // Optimistic UI Update
        setBomItems(prev => prev.filter(i => !itemIds.includes(i.id)));

        try {
            await supabase.from('items_bom').delete().in('id', itemIds);
        } catch (err) {
            console.error('Error batch deleting BOM items:', err);
            alert('Error al eliminar los ítems seleccionados: ' + (err.message || err));
        }
    };
    // ============================================================
    // Handlers — Image
    // ============================================================

    const handleImageSelect = async (url) => {
        if (!imagePickerItem) return;
        const itemId = imagePickerItem.id;
        const isBomItem = imagePickerItem._isBomItem; // Flag to distinguish BOM items from catalog items
        try {
            if (isBomItem) {
                // Save image directly to the BOM item (items_bom collection)
                await supabase.from('items_bom').update({ image_url: url }).eq('id', itemId);
                // Optimistic update for BOM items
                setBomItems(prev => prev.map(item =>
                    item.id === itemId ? { ...item, imageUrl: url } : item
                ));
            } else {
                // Save image to catalogo_maestro (existing behavior)
                await supabase.from('catalogo_maestro').update({ image_url: url }).eq('id', itemId);
                // Optimistic update for catalog items
                setCatalogo(prev => prev.map(item =>
                    item.id === itemId ? { ...item, imageUrl: url } : item
                ));
            }
        } catch (err) {
            console.error('Error saving image:', err);
            const errMsg = err.message || '';
            if (errMsg.includes('permission-denied') || errMsg.includes('insufficient permissions') || err.code === 'permission-denied') {
                alert('No tienes permisos suficientes para modificar este registro. Se requiere rol de Editor o Administrador.');
            } else {
                alert(`Error al guardar la imagen: ${err.message || err}`);
            }
        }
        setImagePickerItem(null);
    };

    const handleEditClick = (item) => {
        setEditingMasterRecord(item);
        setIsMasterRecordModalOpen(true);
    };

    // ── Temporary: Sync images from Firebase to Supabase ──
    const syncImagesFromFirebase = async () => {
        alert('La base de datos Firebase está desconectada. Esta función ya no está disponible.');
    };

    // ============================================================
    // Return — same shape as the BOM subset of AppDataContext
    // ============================================================

    return {
        // Data
        proyectos,
        catalogo, setCatalogo,
        bomItems,
        managedLists,

        // Computed
        brandOptions,
        categoryOptions,
        providerOptions,

        // Master Record Modal
        isMasterRecordModalOpen, setIsMasterRecordModalOpen,
        editingMasterRecord, setEditingMasterRecord,

        // Image
        imagePickerItem, setImagePickerItem,
        zoomedImageUrl, setZoomedImageUrl,

        // Refs
        pdfInputRef,
        excelInputRef,

        // Handlers
        handleSaveProject,
        saveMasterRecord,
        handleUpdateBomItem,
        handleAddFromCatalog,
        handleDeleteBomItem,
        handleDeleteBomItemsBatch,
        handleImageSelect,
        handleEditClick,
        syncImagesFromFirebase,
        handleMergeAllDuplicates,
        handleMergeSingleDuplicate,
    };
}
