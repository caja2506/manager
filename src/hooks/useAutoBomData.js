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
                if (p.data) setProyectos(p.data);
                if (c.data) setCatalogo(c.data);
                if (b.data) setBomItems(b.data);
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
                    supabase.from('proyectos_bom').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setProyectos(data));
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'catalogo_maestro' }, () => {
                    supabase.from('catalogo_maestro').select('*').order('name').then(({ data }) => data && setCatalogo(data));
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'items_bom' }, () => {
                    supabase.from('items_bom').select('*').then(({ data }) => data && setBomItems(data));
                })
                .subscribe();

            return () => supabase.removeChannel(ch);
        }

        // Firebase fallback
        let unsubs = [];
        (async () => {
            const { collection, onSnapshot } = await import('firebase/firestore');
            const { db } = await import('../firebase');

            unsubs.push(onSnapshot(collection(db, 'proyectos_bom'), s => setProyectos(
                s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            )));
            unsubs.push(onSnapshot(collection(db, 'catalogo_maestro'), s => setCatalogo(
                s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => safeLocaleCompare(a, b, 'name'))
            )));
            unsubs.push(onSnapshot(collection(db, 'items_bom'), s => setBomItems(s.docs.map(d => ({ ...d.data(), id: d.id })))));
            unsubs.push(onSnapshot(collection(db, 'categorias'), s => setManagedLists(prev => ({
                ...prev, categories: s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.name).sort((a, b) => safeLocaleCompare(a, b, 'name'))
            }))));
            unsubs.push(onSnapshot(collection(db, 'proveedores'), s => setManagedLists(prev => ({
                ...prev, providers: s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.name).sort((a, b) => safeLocaleCompare(a, b, 'name'))
            }))));
            unsubs.push(onSnapshot(collection(db, 'marcas'), s => setManagedLists(prev => ({
                ...prev, brands: s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.name).sort((a, b) => safeLocaleCompare(a, b, 'name'))
            }))));
        })();

        return () => unsubs.forEach(u => u());
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
            if (editingProjectId) {
                await supabase.from('proyectos_bom').update(data).eq('id', editingProjectId);
            } else {
                await supabase.from('proyectos_bom').insert(data);
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
                await supabase.from('catalogo_maestro').update(data).eq('id', editingMasterRecord.id);
            } else {
                await supabase.from('catalogo_maestro').insert(data);
            }
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
        setEditingMasterRecord(null);
        setIsMasterRecordModalOpen(false);
    };

    // ============================================================
    // Handlers — BOM Items
    // ============================================================

    const handleUpdateBomItem = async (itemId, updatedData, catalogLeadTimeUpdate) => {
        const newData = { ...updatedData, totalPrice: (updatedData.quantity || 0) * (updatedData.unitPrice || 0) };
        if (USE_SUPABASE) {
            await supabase.from('items_bom').update(newData).eq('id', itemId);
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
    };

    const handleAddFromCatalog = async (itemsToAdd, activeProject) => {
        if (USE_SUPABASE) {
            const rows = itemsToAdd.map(({ item, quantity }) => ({
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
        } else {
            const { doc, collection, writeBatch } = await import('firebase/firestore');
            const { db } = await import('../firebase');
            const batch = writeBatch(db);
            itemsToAdd.forEach(({ item, quantity }) => {
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
    };

    // ============================================================
    // Handlers — Image
    // ============================================================

    const handleImageSelect = async (url) => {
        if (!imagePickerItem) return;
        try {
            if (USE_SUPABASE) {
                await supabase.from('catalogo_maestro').update({ image_url: url }).eq('id', imagePickerItem.id);
            } else {
                const { doc, updateDoc } = await import('firebase/firestore');
                const { db } = await import('../firebase');
                await updateDoc(doc(db, 'catalogo_maestro', imagePickerItem.id), { imageUrl: url });
            }
        } catch (err) {
            console.error('Error saving image:', err);
        }
        setImagePickerItem(null);
    };

    const handleEditClick = (item) => {
        setEditingMasterRecord(item);
        setIsMasterRecordModalOpen(true);
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
        handleImageSelect,
        handleEditClick,
    };
}
