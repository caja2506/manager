// Archivo: src/hooks/useAutoBomData.js
// ======================================
// Custom hook owning all BOM-related subscriptions,
// computed values, and CRUD handlers.
// Dual-backend: Supabase or Firebase.

import { useState, useEffect, useMemo, useRef } from 'react';
import { USE_SUPABASE } from '../services/_backend';
import { supabase } from '../supabase';

// ── Helpers ──

const safeLocaleCompare = (a, b, field) =>
    String(a[field] || '').localeCompare(String(b[field] || ''));

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
        if (USE_SUPABASE) {
            // Initial fetch for all collections
            const fetchAll = async () => {
                const [p, c, b, cat, prov, br] = await Promise.all([
                    supabase.from('proyectos_bom').select('*').order('created_at', { ascending: false }),
                    supabase.from('catalogo_maestro').select('*').order('name'),
                    supabase.from('items_bom').select('*'),
                    supabase.from('categorias').select('*').order('name'),
                    supabase.from('proveedores').select('*').order('name'),
                    supabase.from('marcas').select('*').order('name'),
                ]);
                if (p.data) setProyectos(p.data.map(mapProject));
                if (c.data) setCatalogo(c.data.map(mapCatalogItem));
                if (b.data) setBomItems(b.data.map(mapBomItem));
                setManagedLists({
                    categories: (cat.data || []).filter(d => d.name),
                    providers: (prov.data || []).filter(d => d.name),
                    brands: (br.data || []).filter(d => d.name),
                });
            };
            fetchAll();

            // Realtime for key tables
            const ch = supabase.channel('autobom-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos_bom' }, () => {
                    supabase.from('proyectos_bom').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setProyectos(data.map(mapProject)));
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'catalogo_maestro' }, () => {
                    supabase.from('catalogo_maestro').select('*').order('name').then(({ data }) => data && setCatalogo(data.map(mapCatalogItem)));
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'items_bom' }, () => {
                    supabase.from('items_bom').select('*').then(({ data }) => data && setBomItems(data.map(mapBomItem)));
                })
                .subscribe();

            return () => supabase.removeChannel(ch);
        }

        // Firebase fallback
        let active = true;
        let unsubs = [];
        const setupFirebase = async () => {
            const { collection, onSnapshot } = await import('firebase/firestore');
            const { db } = await import('../firebase');

            if (!active) return;

            const unsub1 = onSnapshot(collection(db, 'proyectos_bom'), s => setProyectos(
                s.docs.map(d => mapProject({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            ));
            const unsub2 = onSnapshot(collection(db, 'catalogo_maestro'), s => setCatalogo(
                s.docs.map(d => mapCatalogItem({ ...d.data(), id: d.id })).sort((a, b) => safeLocaleCompare(a, b, 'name'))
            ));
            const unsub3 = onSnapshot(collection(db, 'items_bom'), s => setBomItems(
                s.docs.map(d => mapBomItem({ ...d.data(), id: d.id }))
            ));
            const unsub4 = onSnapshot(collection(db, 'categorias'), s => setManagedLists(prev => ({
                ...prev, categories: s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.name).sort((a, b) => safeLocaleCompare(a, b, 'name'))
            })));
            const unsub5 = onSnapshot(collection(db, 'proveedores'), s => setManagedLists(prev => ({
                ...prev, providers: s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.name).sort((a, b) => safeLocaleCompare(a, b, 'name'))
            })));
            const unsub6 = onSnapshot(collection(db, 'marcas'), s => setManagedLists(prev => ({
                ...prev, brands: s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.name).sort((a, b) => safeLocaleCompare(a, b, 'name'))
            })));

            unsubs.push(unsub1, unsub2, unsub3, unsub4, unsub5, unsub6);
        };

        setupFirebase();

        return () => {
            active = false;
            unsubs.forEach(u => u());
        };
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
        if (USE_SUPABASE) {
            const sbData = { name: projectData.name, description: projectData.description || '', created_at: new Date().toISOString() };
            if (editingProjectId) {
                await supabase.from('proyectos_bom').update(sbData).eq('id', editingProjectId);
            } else {
                await supabase.from('proyectos_bom').insert(sbData);
            }
        } else {
            const { doc, setDoc, updateDoc, collection } = await import('firebase/firestore');
            const { db } = await import('../firebase');
            if (editingProjectId) {
                await updateDoc(doc(db, 'proyectos_bom', editingProjectId), data);
            } else {
                await setDoc(doc(collection(db, 'proyectos_bom')), data);
            }
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
            if (USE_SUPABASE) {
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
                const { data: updatedCatalog } = await supabase.from('catalogo_maestro').select('*').order('name');
                if (updatedCatalog) setCatalogo(updatedCatalog.map(mapCatalogItem));
            } else {
                const { doc, setDoc, updateDoc, collection } = await import('firebase/firestore');
                const { db } = await import('../firebase');
                const data = {
                    name: String(formData.name).trim(),
                    partNumber: String(formData.partNumber).replace(/\s+/g, '').toUpperCase(),
                    lastPrice: Number(formData.lastPrice) || 0,
                    brand: formData.brand ? doc(db, 'marcas', formData.brand) : null,
                    category: formData.category ? doc(db, 'categorias', formData.category) : null,
                    defaultProvider: formData.defaultProvider ? doc(db, 'proveedores', formData.defaultProvider) : null,
                    leadTimeWeeks: formData.leadTimeWeeks === '' ? null : Number(formData.leadTimeWeeks),
                    imageUrl: formData.imageUrl ? String(formData.imageUrl).trim() : '',
                };
                if (editingMasterRecord) {
                    await updateDoc(doc(db, 'catalogo_maestro', editingMasterRecord.id), data);
                } else {
                    await setDoc(doc(collection(db, 'catalogo_maestro')), data);
                }
            }
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
            if (USE_SUPABASE) {
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
                const { data } = await supabase.from('items_bom').select('*');
                if (data) setBomItems(data.map(mapBomItem));
            } else {
                const { doc, writeBatch } = await import('firebase/firestore');
                const { db } = await import('../firebase');
                const batch = writeBatch(db);
                
                for (const group of duplicateGroups) {
                    const survivor = group[0];
                    const totalQty = group.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                    const totalPrice = totalQty * Number(survivor.unitPrice || 0);
                    
                    batch.update(doc(db, 'items_bom', survivor.id), {
                        quantity: totalQty,
                        totalPrice: totalPrice
                    });
                    group.slice(1).forEach(item => {
                        batch.delete(doc(db, 'items_bom', item.id));
                    });
                }
                await batch.commit();
            }
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
            if (USE_SUPABASE) {
                const survivor = group[0];
                const totalQty = group.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                const totalPrice = totalQty * Number(survivor.unitPrice || survivor.unit_price || 0);
                
                await supabase.from('items_bom').update({
                    quantity: totalQty,
                    total_price: totalPrice
                }).eq('id', survivor.id);
                
                const idsToDelete = group.slice(1).map(item => item.id);
                await supabase.from('items_bom').delete().in('id', idsToDelete);
                
                const { data } = await supabase.from('items_bom').select('*');
                if (data) setBomItems(data.map(mapBomItem));
            } else {
                const { doc, writeBatch } = await import('firebase/firestore');
                const { db } = await import('../firebase');
                const batch = writeBatch(db);
                
                const survivor = group[0];
                const totalQty = group.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                const totalPrice = totalQty * Number(survivor.unitPrice || 0);
                
                batch.update(doc(db, 'items_bom', survivor.id), {
                    quantity: totalQty,
                    totalPrice: totalPrice
                });
                group.slice(1).forEach(item => {
                    batch.delete(doc(db, 'items_bom', item.id));
                });
                await batch.commit();
            }
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
            if (USE_SUPABASE) {
                // Map camelCase → snake_case for Supabase columns
                const sbData = {
                    quantity: newData.quantity,
                    unit_price: newData.unitPrice,
                    total_price: newData.totalPrice,
                    prcr: newData.prcr,
                    lead_time_weeks: newData.leadTimeWeeks,
                };
                await supabase.from('items_bom').update(sbData).eq('id', itemId);
                if (catalogLeadTimeUpdate !== undefined) {
                    const bomItem = bomItems.find(i => i.id === itemId);
                    const refId = bomItem?.masterPartRef?.id || bomItem?.master_part_ref_id;
                    if (refId) await supabase.from('catalogo_maestro').update({ lead_time_weeks: catalogLeadTimeUpdate }).eq('id', refId);
                }
            } else {
                const { doc, updateDoc } = await import('firebase/firestore');
                const { db } = await import('../firebase');
                await updateDoc(doc(db, 'items_bom', itemId), newData);
                if (catalogLeadTimeUpdate !== undefined) {
                    const bomItem = bomItems.find(i => i.id === itemId);
                    if (bomItem?.masterPartRef) {
                        await updateDoc(doc(db, 'catalogo_maestro', bomItem.masterPartRef.id), { leadTimeWeeks: catalogLeadTimeUpdate });
                    }
                }
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
            if (USE_SUPABASE) {
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
            } else {
                const { doc, collection, writeBatch, updateDoc: fbUpdateDoc } = await import('firebase/firestore');
                const { db } = await import('../firebase');
                // Update existing
                for (const { id, newQty, unitPrice } of toUpdate) {
                    await fbUpdateDoc(doc(db, 'items_bom', id), {
                        quantity: newQty,
                        totalPrice: newQty * unitPrice,
                    });
                }
                // Insert new
                if (toInsert.length > 0) {
                    const batch = writeBatch(db);
                    toInsert.forEach(({ item, quantity }) => {
                        const bomRef = doc(collection(db, 'items_bom'));
                        batch.set(bomRef, {
                            projectId: activeProject.id,
                            masterPartRef: doc(db, 'catalogo_maestro', item.id),
                            quantity: Number(quantity),
                            unitPrice: Number(item.lastPrice || 0),
                            totalPrice: Number(quantity) * Number(item.lastPrice || 0),
                            proveedor: item.defaultProvider ? doc(db, 'proveedores', item.defaultProvider.id) : null,
                            status: 'Requerido',
                            addedAt: new Date().toISOString()
                        });
                    });
                    await batch.commit();
                }
            }
        } catch (err) {
            console.error('Error adding from catalog:', err);
        }
    };

    const handleDeleteBomItem = async (itemId) => {
        // Optimistic UI Update
        setBomItems(prev => prev.filter(i => i.id !== itemId));

        try {
            if (USE_SUPABASE) {
                await supabase.from('items_bom').delete().eq('id', itemId);
            } else {
                const { doc, deleteDoc } = await import('firebase/firestore');
                const { db } = await import('../firebase');
                await deleteDoc(doc(db, 'items_bom', itemId));
            }
        } catch (err) {
            console.error('Error deleting BOM item:', err);
            alert('Error al eliminar el ítem: ' + (err.message || err));
        }
    };

    const handleDeleteBomItemsBatch = async (itemIds) => {
        // Optimistic UI Update
        setBomItems(prev => prev.filter(i => !itemIds.includes(i.id)));

        try {
            if (USE_SUPABASE) {
                await supabase.from('items_bom').delete().in('id', itemIds);
            } else {
                const { doc, writeBatch } = await import('firebase/firestore');
                const { db } = await import('../firebase');
                const batch = writeBatch(db);
                itemIds.forEach(id => batch.delete(doc(db, 'items_bom', id)));
                await batch.commit();
            }
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
                if (USE_SUPABASE) {
                    await supabase.from('items_bom').update({ image_url: url }).eq('id', itemId);
                } else {
                    const { doc, updateDoc } = await import('firebase/firestore');
                    const { db } = await import('../firebase');
                    await updateDoc(doc(db, 'items_bom', itemId), { imageUrl: url });
                }
                // Optimistic update for BOM items
                setBomItems(prev => prev.map(item =>
                    item.id === itemId ? { ...item, imageUrl: url } : item
                ));
            } else {
                // Save image to catalogo_maestro (existing behavior)
                if (USE_SUPABASE) {
                    await supabase.from('catalogo_maestro').update({ image_url: url }).eq('id', itemId);
                } else {
                    const { doc, updateDoc } = await import('firebase/firestore');
                    const { db } = await import('../firebase');
                    await updateDoc(doc(db, 'catalogo_maestro', itemId), { imageUrl: url });
                }
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
        if (!USE_SUPABASE) { alert('Solo funciona con Supabase activo'); return; }
        try {
            const { collection, getDocs } = await import('firebase/firestore');
            const { db } = await import('../firebase');

            console.log('[syncImages] Leyendo catalogo_maestro de Firebase...');
            const snap = await getDocs(collection(db, 'catalogo_maestro'));
            const firebaseDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const withImages = firebaseDocs.filter(d => d.imageUrl && String(d.imageUrl).trim() !== '');

            console.log(`[syncImages] ${withImages.length} docs con imageUrl en Firebase`);

            let updated = 0, skipped = 0, notFound = 0;

            for (const fbItem of withImages) {
                const pn = String(fbItem.partNumber || '').replace(/\s+/g, '').toUpperCase();
                if (!pn || pn === 'S/N') continue;

                // Find in Supabase
                const { data: matches } = await supabase
                    .from('catalogo_maestro')
                    .select('id, part_number, image_url')
                    .eq('part_number', pn);

                if (!matches || matches.length === 0) {
                    console.log(`  ⚠️ No encontrado: ${pn}`);
                    notFound++;
                    continue;
                }

                for (const match of matches) {
                    if (match.image_url && match.image_url.trim() !== '') {
                        skipped++;
                        continue;
                    }
                    await supabase.from('catalogo_maestro').update({ image_url: fbItem.imageUrl }).eq('id', match.id);
                    console.log(`  ✅ ${pn} → imagen restaurada`);
                    updated++;
                }
            }

            const msg = `Sync completo:\n✅ Actualizados: ${updated}\nℹ️ Ya tenían imagen: ${skipped}\n⚠️ No encontrados: ${notFound}`;
            console.log(msg);
            alert(msg);

            // Refresh catalog
            const { data } = await supabase.from('catalogo_maestro').select('*').order('name');
            if (data) setCatalogo(data.map(mapCatalogItem));
        } catch (err) {
            console.error('[syncImages] Error:', err);
            alert('Error: ' + err.message);
        }
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
