/**
 * AreaTaskTypeRelationModal — Shared popup for configuring
 * Area ↔ Task Type relationships.
 *
 * V5: Now writes to per-milestone workAreas.taskTypeIds[] (persisted mapping).
 * Falls back to global workAreaTypes.defaultTaskTypes if no per-milestone areas.
 *
 * Used from: ManagedListsPage and MilestoneDetailPage.
 */
import React, { useState, useEffect } from 'react';
import { X, Search, Compass, ChevronDown } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { COLLECTIONS } from '../../models/schemas';

export default function AreaTaskTypeRelationModal({ open, onClose, workAreaTypes, workAreas, taskTypes }) {
    const [localMapping, setLocalMapping] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [expandedArea, setExpandedArea] = useState(null);
    const [searchByArea, setSearchByArea] = useState({});

    const allTaskTypeNames = (taskTypes || []).map(t => t.name);

    // V5: Prefer per-milestone workAreas, fall back to global workAreaTypes
    const areas = (workAreas && workAreas.length > 0) ? workAreas : (workAreaTypes || []);
    const isPerMilestone = !!(workAreas && workAreas.length > 0);

    // Init mapping when opened
    useEffect(() => {
        if (open) {
            const mapping = {};
            areas.forEach(area => {
                // V5: Prefer taskTypeIds, fall back to defaultTaskTypes or taskFilter.typeMatch
                mapping[area.id] = area.taskTypeIds || area.defaultTaskTypes || area.taskFilter?.typeMatch || [];
            });
            setLocalMapping(mapping);
            setExpandedArea(null);
            setSearchByArea({});
        }
    }, [open, workAreaTypes, workAreas]);

    if (!open) return null;

    const toggleType = (areaId, typeName) => {
        setLocalMapping(prev => {
            const current = prev[areaId] || [];
            const updated = current.includes(typeName)
                ? current.filter(t => t !== typeName)
                : [...current, typeName];
            return { ...prev, [areaId]: updated };
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            for (const area of areas) {
                const types = localMapping[area.id] || [];
                if (isPerMilestone) {
                    // V5: Write to per-milestone work area
                    await updateDoc(doc(db, COLLECTIONS.WORK_AREAS, area.id), {
                        taskTypeIds: types,
                        // Also update legacy taskFilter for backward compat
                        'taskFilter.typeMatch': types.length > 0 ? types : null,
                    });
                } else {
                    // Global fallback
                    await updateDoc(doc(db, COLLECTIONS.WORK_AREA_TYPES, area.id), {
                        defaultTaskTypes: types,
                    });
                }
            }
            onClose();
        } catch (err) {
            console.error('Error saving area-type mapping:', err);
        }
        setIsSaving(false);
    };

    const getSearch = (areaId) => searchByArea[areaId] || '';
    const setSearch = (areaId, val) => setSearchByArea(prev => ({ ...prev, [areaId]: val }));

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '20px',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '16px',
                    width: '100%',
                    maxWidth: '640px',
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: 40, height: 40,
                            background: 'rgba(20,184,166,0.15)',
                            borderRadius: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Compass size={20} color="#14b8a6" />
                        </div>
                        <div>
                            <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '16px', margin: 0 }}>
                                Relación Áreas ↔ Tipos de Tarea
                            </h2>
                            <p style={{ color: '#64748b', fontSize: '11px', margin: '2px 0 0' }}>
                                {isPerMilestone
                                    ? 'Configuración por milestone · Tipos asignados a cada área'
                                    : 'Configuración global · Aplica a todos los milestones'
                                }
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none', border: 'none', color: '#64748b',
                            cursor: 'pointer', padding: '4px',
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body — scrollable */}
                <div style={{
                    padding: '16px 24px',
                    flex: 1,
                    overflowY: 'auto',
                }}>
                    {areas.length === 0 && (
                        <p style={{ color: '#475569', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>
                            Agrega áreas de trabajo primero en Listas Gestionadas.
                        </p>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {areas.map(area => {
                            const currentTypes = localMapping[area.id] || [];
                            const isOpen = expandedArea === area.id;
                            const search = getSearch(area.id);
                            const filteredTypes = allTaskTypeNames.filter(t =>
                                t.toLowerCase().includes(search.toLowerCase())
                            );

                            return (
                                <div key={area.id}>
                                    {/* Row */}
                                    <div
                                        onClick={() => setExpandedArea(isOpen ? null : area.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '10px 12px',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                            background: isOpen ? 'rgba(30,41,59,0.7)' : 'rgba(30,41,59,0.3)',
                                        }}
                                    >
                                        <div style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: '#14b8a6', flexShrink: 0,
                                        }} />
                                        <span style={{
                                            color: '#e2e8f0', fontWeight: 600, fontSize: '13px',
                                            minWidth: '90px',
                                        }}>
                                            {area.name}
                                        </span>

                                        {/* Inline summary chips */}
                                        <div style={{
                                            display: 'flex', flexWrap: 'wrap', gap: '4px',
                                            flex: 1, minWidth: 0,
                                        }}>
                                            {currentTypes.length > 0 ? currentTypes.map(tt => (
                                                <span key={tt} style={{
                                                    padding: '2px 8px',
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    borderRadius: '4px',
                                                    border: '1px solid rgba(20,184,166,0.3)',
                                                    background: 'rgba(20,184,166,0.1)',
                                                    color: '#5eead4',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {tt}
                                                </span>
                                            )) : (
                                                <span style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>
                                                    sin asignar
                                                </span>
                                            )}
                                        </div>

                                        {/* Count badge */}
                                        <span style={{
                                            fontSize: '10px', fontWeight: 700,
                                            padding: '2px 8px', borderRadius: '4px', flexShrink: 0,
                                            background: currentTypes.length > 0 ? 'rgba(20,184,166,0.1)' : 'rgba(245,158,11,0.1)',
                                            color: currentTypes.length > 0 ? '#14b8a6' : '#f59e0b',
                                        }}>
                                            {currentTypes.length}
                                        </span>

                                        {/* Chevron */}
                                        <ChevronDown
                                            size={14}
                                            color="#64748b"
                                            style={{
                                                flexShrink: 0,
                                                transition: 'transform 0.2s ease',
                                                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                            }}
                                        />
                                    </div>

                                    {/* Expanded panel */}
                                    {isOpen && (
                                        <div style={{
                                            marginLeft: '18px',
                                            marginTop: '4px',
                                            marginBottom: '6px',
                                            padding: '12px',
                                            background: 'rgba(30,41,59,0.5)',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(20,184,166,0.1)',
                                        }}>
                                            {/* Search filter */}
                                            {allTaskTypeNames.length > 0 && (
                                                <div style={{ position: 'relative', marginBottom: '10px' }}>
                                                    <Search
                                                        size={12}
                                                        color="#64748b"
                                                        style={{
                                                            position: 'absolute', left: '10px',
                                                            top: '50%', transform: 'translateY(-50%)',
                                                        }}
                                                    />
                                                    <input
                                                        value={search}
                                                        onChange={e => setSearch(area.id, e.target.value)}
                                                        placeholder="Filtrar tipos..."
                                                        style={{
                                                            width: '100%',
                                                            background: '#1e293b',
                                                            border: '1px solid #334155',
                                                            borderRadius: '8px',
                                                            padding: '7px 10px 7px 30px',
                                                            fontSize: '11px',
                                                            color: '#e2e8f0',
                                                            outline: 'none',
                                                            boxSizing: 'border-box',
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            <p style={{
                                                color: '#64748b', fontSize: '10px', fontWeight: 600,
                                                textTransform: 'uppercase', letterSpacing: '0.5px',
                                                margin: '0 0 8px',
                                            }}>
                                                Seleccionar tipos para {area.name}
                                            </p>

                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {filteredTypes.map(tt => {
                                                    const isOn = currentTypes.includes(tt);
                                                    return (
                                                        <button
                                                            key={tt}
                                                            onClick={e => { e.stopPropagation(); toggleType(area.id, tt); }}
                                                            style={{
                                                                padding: '5px 12px',
                                                                fontSize: '11px',
                                                                fontWeight: 600,
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s ease',
                                                                border: isOn ? '1px solid #14b8a6' : '1px solid #334155',
                                                                background: isOn ? 'rgba(20,184,166,0.15)' : 'rgba(30,41,59,0.5)',
                                                                color: isOn ? '#5eead4' : '#94a3b8',
                                                            }}
                                                        >
                                                            {isOn && '✓ '}{tt}
                                                        </button>
                                                    );
                                                })}
                                                {filteredTypes.length === 0 && (
                                                    <span style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>
                                                        {search ? 'Sin resultados' : 'Agrega tipos de tarea primero'}
                                                    </span>
                                                )}
                                            </div>

                                            {currentTypes.length === 0 && (
                                                <p style={{
                                                    color: '#f59e0b', fontSize: '10px', fontStyle: 'italic',
                                                    margin: '8px 0 0',
                                                }}>
                                                    ⚠ Sin tipos = todas las tareas contarán para esta área
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid #1e293b',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '8px',
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            background: '#1e293b',
                            color: '#94a3b8',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{
                            padding: '8px 20px',
                            background: '#14b8a6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 700,
                            opacity: isSaving ? 0.6 : 1,
                        }}
                    >
                        {isSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
