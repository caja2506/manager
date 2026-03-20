// Archivo: src/hooks/useAutoBomData.js
// ======================================
// Custom hook owning all BOM-related Firestore subscriptions,
// computed values, and CRUD handlers.
// Returns an object shaped exactly like the BOM subset of
// the old AppDataContext value, so consumers don't need to change.

import { useState, useEffect, useMemo, useRef } from 'react';
import {
    collection, onSnapshot, doc, setDoc, getDocs,
    deleteDoc, updateDoc, writeBatch, query, where
} from 'firebase/firestore';
import { db } from '../firebase';

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

    // ── Firestore Subscriptions ──

    useEffect(() => {
        const unsubProyectos = onSnapshot(
            collection(db, 'proyectos_bom'),
            s => setProyectos(
                s.docs.map(d => ({ ...d.data(), id: d.id }))
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            )
        );

        const unsubCatalogo = onSnapshot(
            collection(db, 'catalogo_maestro'),
            s => setCatalogo(
                s.docs.map(d => ({ ...d.data(), id: d.id }))
                    .sort((a, b) => safeLocaleCompare(a, b, 'name'))
            )
        );

        const unsubBom = onSnapshot(
            collection(db, 'items_bom'),
            s => setBomItems(s.docs.map(d => ({ ...d.data(), id: d.id })))
        );

        const unsubCategories = onSnapshot(
            collection(db, 'categorias'),
            s => setManagedLists(prev => ({
                ...prev,
                categories: s.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(d => d.name)
                    .sort((a, b) => safeLocaleCompare(a, b, 'name'))
            }))
        );

        const unsubProviders = onSnapshot(
            collection(db, 'proveedores'),
            s => setManagedLists(prev => ({
                ...prev,
                providers: s.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(d => d.name)
                    .sort((a, b) => safeLocaleCompare(a, b, 'name'))
            }))
        );

        const unsubBrands = onSnapshot(
            collection(db, 'marcas'),
            s => setManagedLists(prev => ({
                ...prev,
                brands: s.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(d => d.name)
                    .sort((a, b) => safeLocaleCompare(a, b, 'name'))
            }))
        );

        return () => {
            unsubProyectos();
            unsubCatalogo();
            unsubBom();
            unsubCategories();
            unsubProviders();
            unsubBrands();
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
        const data = {
            name: projectData.name,
            description: projectData.description,
            createdAt: new Date().toISOString()
        };
        if (editingProjectId) {
            await updateDoc(doc(db, 'proyectos_bom', editingProjectId), data);
        } else {
            await setDoc(doc(collection(db, 'proyectos_bom')), data);
        }
    };

    // ============================================================
    // Handlers — Master Catalog
    // ============================================================

    const saveMasterRecord = async (formData) => {
        if (!formData.name || !formData.partNumber) return alert('Nombre y P/N obligatorios.');

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
        setEditingMasterRecord(null);
        setIsMasterRecordModalOpen(false);
    };

    // ============================================================
    // Handlers — BOM Items
    // ============================================================

    const handleUpdateBomItem = async (itemId, updatedData, catalogLeadTimeUpdate) => {
        const itemRef = doc(db, 'items_bom', itemId);
        const newData = {
            ...updatedData,
            totalPrice: (updatedData.quantity || 0) * (updatedData.unitPrice || 0)
        };
        await updateDoc(itemRef, newData);

        if (catalogLeadTimeUpdate !== undefined) {
            const bomItem = bomItems.find(i => i.id === itemId);
            if (bomItem?.masterPartRef) {
                await updateDoc(
                    doc(db, 'catalogo_maestro', bomItem.masterPartRef.id),
                    { leadTimeWeeks: catalogLeadTimeUpdate }
                );
            }
        }
    };

    const handleAddFromCatalog = async (itemsToAdd, activeProject) => {
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
    };

    // ============================================================
    // Handlers — Image
    // ============================================================

    const handleImageSelect = async (url) => {
        if (!imagePickerItem) return;
        try {
            await updateDoc(doc(db, 'catalogo_maestro', imagePickerItem.id), { imageUrl: url });
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
