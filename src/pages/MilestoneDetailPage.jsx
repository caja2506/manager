/**
 * MilestoneDetailPage — V5 Phase 4A
 * ====================================
 * The main operational view for a milestone (setup or other critical milestone).
 * Shows score, traffic light, trend, areas, ranking, and explainability.
 */

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft, Calendar, User, TrendingUp, TrendingDown,
    Minus, Target, Loader2, AlertTriangle, History, BrainCircuit,
    Plus, X, Check, Compass
} from 'lucide-react';
import useMilestoneScore from '../hooks/useMilestoneScore';
import AreaScoreCard from '../components/milestones/AreaScoreCard';
import AreaTaskTypeRelationModal from '../components/milestones/AreaTaskTypeRelationModal';
import AttentionRanking from '../components/milestones/AttentionRanking';
import ScoreExplainer from '../components/milestones/ScoreExplainer';
import { explainScore } from '../core/scoring/scoreEngine';
import { MILESTONE_TYPE, COLLECTIONS } from '../models/schemas';
import { useAppData } from '../contexts/AppDataContext';
import { createWorkArea } from '../services/workAreaService';
import { useRole } from '../contexts/RoleContext';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const TRAFFIC_STYLES = {
    green:  { bg: 'rgba(34,197,94,0.12)', border: '#22c55e', glow: '0 0 40px rgba(34,197,94,0.15)', label: 'Verde' },
    yellow: { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', glow: '0 0 40px rgba(245,158,11,0.15)', label: 'Amarillo' },
    red:    { bg: 'rgba(239,68,68,0.12)',  border: '#ef4444', glow: '0 0 40px rgba(239,68,68,0.15)', label: 'Rojo' },
};

const TREND_MAP = {
    improving: { Icon: TrendingUp,   color: '#22c55e', label: 'Subiendo' },
    stable:    { Icon: Minus,        color: '#94a3b8', label: 'Estable' },
    declining: { Icon: TrendingDown, color: '#ef4444', label: 'Bajando' },
};

const TYPE_LABELS = {
    [MILESTONE_TYPE.SETUP]: 'Setup',
    [MILESTONE_TYPE.COMMISSIONING]: 'Puesta en Marcha',
    [MILESTONE_TYPE.VALIDATION]: 'Validación',
    [MILESTONE_TYPE.CUSTOM]: 'Personalizado',
};

// ── Modal to Add Work Areas from Catalog with Task Type Mapping ──
function AddAreasModal({ open, onClose, milestoneId, projectId, existingAreas, workAreaTypes, taskTypes, onSaved, userId }) {
    // selected = { areaName: [taskTypeName, ...], ... }
    const [selected, setSelected] = useState({});
    const [newTypeName, setNewTypeName] = useState('');
    const [saving, setSaving] = useState(false);
    const [addingNew, setAddingNew] = useState(false);

    if (!open) return null;

    const existingNames = (existingAreas || []).map(a => (a.name || '').toLowerCase());
    const available = (workAreaTypes || []).filter(
        t => !existingNames.includes(t.name.toLowerCase())
    );
    const allTaskTypes = (taskTypes || []).map(t => t.name);

    const toggleArea = (name) => {
        setSelected(prev => {
            if (prev[name] !== undefined) {
                const copy = { ...prev };
                delete copy[name];
                return copy;
            }
            // Auto-populate from global default mapping
            const areaType = (workAreaTypes || []).find(t => t.name === name);
            const defaults = areaType?.defaultTaskTypes || [];
            return { ...prev, [name]: [...defaults] };
        });
    };

    const toggleTaskType = (areaName, typeName) => {
        setSelected(prev => {
            const current = prev[areaName] || [];
            const updated = current.includes(typeName)
                ? current.filter(t => t !== typeName)
                : [...current, typeName];
            return { ...prev, [areaName]: updated };
        });
    };

    const handleAddNewType = async () => {
        const trimmed = newTypeName.trim();
        if (!trimmed) return;
        await addDoc(collection(db, COLLECTIONS.WORK_AREA_TYPES), { name: trimmed });
        setSelected(prev => ({ ...prev, [trimmed]: [] }));
        setNewTypeName('');
        setAddingNew(false);
    };

    const selectedCount = Object.keys(selected).length;

    const handleSave = async () => {
        if (selectedCount === 0) return;
        setSaving(true);
        try {
            const entries = Object.entries(selected);
            for (let i = 0; i < entries.length; i++) {
                const [areaName, types] = entries[i];
                await createWorkArea(milestoneId, projectId, {
                    name: areaName,
                    order: existingAreas.length + i,
                    // V5: Persisted taskTypeIds for mapping
                    taskTypeIds: types.length > 0 ? types : [],
                    // Legacy backward compat
                    taskFilter: {
                        typeMatch: types.length > 0 ? types : null,
                        tagMatch: null,
                    },
                }, userId);
            }
            onSaved();
            onClose();
        } catch (err) {
            console.error('Error creating work areas:', err);
        }
        setSaving(false);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{
                background: '#0f172a', border: '1px solid rgba(148,163,184,0.15)',
                borderRadius: '16px', padding: '24px', width: '520px', maxWidth: '92vw',
                maxHeight: '85vh', overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '32px', height: '32px', background: 'rgba(20,184,166,0.15)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Compass size={16} color="#14b8a6" />
                        </div>
                        <h3 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: 0 }}>Agregar Áreas</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                        <X size={18} />
                    </button>
                </div>

                <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 16px' }}>
                    Selecciona las disciplinas y asigna qué tipos de tarea pertenecen a cada una.
                </p>

                {/* Available areas */}
                <div style={{ marginBottom: '12px' }}>
                    {available.length === 0 && !addingNew && selectedCount === 0 && (
                        <p style={{ color: '#475569', fontSize: '12px', textAlign: 'center', padding: '16px' }}>
                            Todas las áreas ya están asignadas.
                        </p>
                    )}

                    {available.map(type => {
                        const isSelected = selected[type.name] !== undefined;
                        const assignedTypes = selected[type.name] || [];
                        return (
                            <div key={type.id} style={{ marginBottom: '4px' }}>
                                <button onClick={() => toggleArea(type.name)} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                                    padding: '10px 12px', background: isSelected ? 'rgba(20,184,166,0.1)' : 'transparent',
                                    border: 'none', borderRadius: '8px', cursor: 'pointer',
                                    color: '#e2e8f0', fontSize: '13px', fontWeight: 500,
                                    transition: 'all 0.15s ease', textAlign: 'left',
                                }}>
                                    <div style={{
                                        width: '20px', height: '20px', borderRadius: '4px',
                                        border: isSelected ? '2px solid #14b8a6' : '2px solid #334155',
                                        background: isSelected ? '#14b8a6' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0, transition: 'all 0.15s ease',
                                    }}>
                                        {isSelected && <Check size={12} color="#fff" />}
                                    </div>
                                    {type.name}
                                    {isSelected && assignedTypes.length > 0 && (
                                        <span style={{ color: '#14b8a6', fontSize: '10px', fontWeight: 700, marginLeft: 'auto' }}>
                                            {assignedTypes.length} tipo{assignedTypes.length > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </button>

                                {/* Task type multi-select (only when area is selected) */}
                                {isSelected && allTaskTypes.length > 0 && (
                                    <div style={{
                                        margin: '4px 0 8px 30px', padding: '10px 12px',
                                        background: 'rgba(15,23,42,0.5)',
                                        border: '1px solid rgba(20,184,166,0.1)',
                                        borderRadius: '8px',
                                    }}>
                                        <p style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 8px', letterSpacing: '0.5px' }}>
                                            Tipos de tarea → {type.name}
                                        </p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {allTaskTypes.map(tt => {
                                                const isOn = assignedTypes.includes(tt);
                                                return (
                                                    <button key={tt} onClick={() => toggleTaskType(type.name, tt)} style={{
                                                        padding: '4px 10px',
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                        border: isOn ? '1px solid #14b8a6' : '1px solid #334155',
                                                        background: isOn ? 'rgba(20,184,166,0.15)' : 'rgba(30,41,59,0.5)',
                                                        color: isOn ? '#5eead4' : '#94a3b8',
                                                    }}>
                                                        {isOn && '✓ '}{tt}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {assignedTypes.length === 0 && (
                                            <p style={{ color: '#f59e0b', fontSize: '10px', margin: '6px 0 0', fontStyle: 'italic' }}>
                                                ⚠ Sin tipos = todas las tareas del proyecto contarán
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Newly selected items not in catalog yet */}
                    {Object.keys(selected).filter(s => !available.some(a => a.name === s)).map(name => {
                        const assignedTypes = selected[name] || [];
                        return (
                            <div key={name} style={{ marginBottom: '4px' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 12px', background: 'rgba(20,184,166,0.1)',
                                    borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', fontWeight: 500,
                                }}>
                                    <div style={{
                                        width: '20px', height: '20px', borderRadius: '4px',
                                        border: '2px solid #14b8a6', background: '#14b8a6',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}>
                                        <Check size={12} color="#fff" />
                                    </div>
                                    {name} <span style={{ color: '#14b8a6', fontSize: '10px', fontWeight: 700 }}>NUEVO</span>
                                </div>
                                {/* Task type selector for new areas too */}
                                {allTaskTypes.length > 0 && (
                                    <div style={{
                                        margin: '4px 0 8px 30px', padding: '10px 12px',
                                        background: 'rgba(15,23,42,0.5)',
                                        border: '1px solid rgba(20,184,166,0.1)',
                                        borderRadius: '8px',
                                    }}>
                                        <p style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 8px', letterSpacing: '0.5px' }}>
                                            Tipos de tarea → {name}
                                        </p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {allTaskTypes.map(tt => {
                                                const isOn = assignedTypes.includes(tt);
                                                return (
                                                    <button key={tt} onClick={() => toggleTaskType(name, tt)} style={{
                                                        padding: '4px 10px',
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                        border: isOn ? '1px solid #14b8a6' : '1px solid #334155',
                                                        background: isOn ? 'rgba(20,184,166,0.15)' : 'rgba(30,41,59,0.5)',
                                                        color: isOn ? '#5eead4' : '#94a3b8',
                                                    }}>
                                                        {isOn && '✓ '}{tt}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Add new area type inline */}
                {addingNew ? (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            value={newTypeName}
                            onChange={e => setNewTypeName(e.target.value)}
                            placeholder="Nombre del área nueva..."
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleAddNewType()}
                            style={{
                                flex: 1, background: '#1e293b', border: '1px solid #334155',
                                borderRadius: '8px', padding: '8px 12px', color: '#f1f5f9',
                                fontSize: '13px', outline: 'none',
                            }}
                        />
                        <button onClick={handleAddNewType} style={{
                            padding: '8px 12px', background: '#14b8a6', color: '#fff',
                            border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                        }}>Crear</button>
                        <button onClick={() => { setAddingNew(false); setNewTypeName(''); }} style={{
                            padding: '8px', background: 'none', border: 'none',
                            color: '#64748b', cursor: 'pointer',
                        }}><X size={16} /></button>
                    </div>
                ) : (
                    <button onClick={() => setAddingNew(true)} style={{
                        display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
                        padding: '8px 12px', background: 'rgba(20,184,166,0.06)',
                        border: '1px dashed rgba(20,184,166,0.3)', borderRadius: '8px',
                        color: '#14b8a6', fontSize: '12px', fontWeight: 600,
                        cursor: 'pointer', marginBottom: '12px',
                    }}>
                        <Plus size={14} /> Crear nuevo tipo de área
                    </button>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                    <button onClick={onClose} style={{
                        padding: '8px 16px', background: '#1e293b', color: '#94a3b8',
                        border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer',
                        fontSize: '12px', fontWeight: 500,
                    }}>Cancelar</button>
                    <button onClick={handleSave} disabled={selectedCount === 0 || saving} style={{
                        padding: '8px 20px', background: selectedCount > 0 ? '#14b8a6' : '#1e293b',
                        color: '#fff', border: 'none', borderRadius: '8px',
                        cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
                        fontSize: '12px', fontWeight: 600, opacity: saving ? 0.6 : 1,
                    }}>
                        {saving ? 'Guardando...' : `Agregar ${selectedCount > 0 ? `(${selectedCount})` : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function MilestoneDetailPage() {
    const { milestoneId } = useParams();
    const navigate = useNavigate();
    const { milestone, workAreas, scoreResult, ranking, loading, error, reload } = useMilestoneScore(milestoneId);
    const { workAreaTypes, taskTypes } = useAppData();
    const { user } = useRole();
    const [showAddAreas, setShowAddAreas] = useState(false);
    const [showRelationModal, setShowRelationModal] = useState(false);

    // ── Loading ──
    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 size={32} color="#818cf8" style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                    <p style={{ color: '#64748b', marginTop: '12px', fontSize: '13px' }}>Calculando score del milestone...</p>
                </div>
            </div>
        );
    }

    // ── Error ──
    if (error) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <AlertTriangle size={40} color="#ef4444" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: '#fca5a5', fontSize: '15px' }}>{error}</p>
                <button onClick={() => navigate(-1)} style={{
                    marginTop: '16px', padding: '8px 20px', background: 'rgba(99,102,241,0.15)',
                    color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', cursor: 'pointer',
                }}>Volver</button>
            </div>
        );
    }

    // ── Score data ──
    const msResult = scoreResult?.milestone;
    const areas = scoreResult?.areas || {};
    const tl = TRAFFIC_STYLES[msResult?.trafficLight?.value] || TRAFFIC_STYLES.green;
    const trendInfo = TREND_MAP[msResult?.trend] || TREND_MAP.stable;
    const TrendIcon = trendInfo.Icon;

    // Build milestone-level explanation
    const milestoneExplanation = msResult ? {
        summary: `Score General: ${msResult.score}/100 — Semáforo: ${tl.label}`,
        reasons: msResult.trafficLight?.source === 'lock'
            ? [`Candado activo: ${msResult.trafficLight.reason}`]
            : [`Score ${msResult.score} — banda ${tl.label}`],
        improvements: [],
        blockers: msResult.locks?.map(l => l.replace(/_/g, ' ')) || [],
    } : null;

    const hasOverride = milestone?.trafficLightOverride;

    return (
        <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
            {/* ── Back + Header ── */}
            <button
                onClick={() => navigate(-1)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'none', border: 'none', color: '#818cf8',
                    cursor: 'pointer', fontSize: '13px', marginBottom: '20px', padding: 0,
                }}
            >
                <ArrowLeft size={14} /> Volver
            </button>

            {/* ── SECTION A: General Detail ── */}
            <div style={{
                background: tl.bg,
                border: `1px solid ${tl.border}33`,
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '20px',
                boxShadow: tl.glow,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    {/* Left: Info */}
                    <div style={{ flex: 1, minWidth: '260px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{
                                background: 'rgba(99,102,241,0.15)',
                                color: '#a5b4fc',
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                            }}>
                                {TYPE_LABELS[milestone?.type] || milestone?.type || 'Milestone'}
                            </span>
                            {milestone?.status && (
                                <span style={{
                                    fontSize: '10px',
                                    color: '#94a3b8',
                                    fontWeight: 500,
                                }}>
                                    {milestone.status}
                                </span>
                            )}
                        </div>

                        <h1 style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: 700, margin: '0 0 8px' }}>
                            {milestone?.name || 'Milestone'}
                        </h1>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', color: '#94a3b8', fontSize: '12px' }}>
                            {milestone?.dueDate && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Calendar size={12} />
                                    {new Date(milestone.dueDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                            )}
                            {milestone?.ownerId && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <User size={12} />
                                    {milestone.ownerId}
                                </span>
                            )}
                        </div>

                        {/* Global locks */}
                        {msResult?.locks?.length > 0 && (
                            <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {msResult.locks.map(lock => (
                                    <span key={lock} style={{
                                        background: 'rgba(239,68,68,0.12)',
                                        color: '#fca5a5',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        padding: '3px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid rgba(239,68,68,0.2)',
                                    }}>
                                        🔒 {lock.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Override notice */}
                        {hasOverride && (
                            <div style={{
                                marginTop: '10px',
                                background: 'rgba(139,92,246,0.1)',
                                color: '#c4b5fd',
                                fontSize: '11px',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid rgba(139,92,246,0.2)',
                            }}>
                                ⚡ Override manual activo por <strong>{milestone.trafficLightOverrideBy}</strong>
                                {milestone.trafficLightOverrideExpires && (
                                    <span> — vence {new Date(milestone.trafficLightOverrideExpires).toLocaleDateString('es-MX')}</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Score hub */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        minWidth: '120px',
                    }}>
                        {/* Score circle */}
                        <div style={{
                            width: '88px', height: '88px',
                            borderRadius: '50%',
                            border: `3px solid ${tl.border}`,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(15,23,42,0.6)',
                            boxShadow: `0 0 20px ${tl.border}33`,
                        }}>
                            <div style={{ color: tl.border, fontWeight: 800, fontSize: '28px', lineHeight: 1 }}>
                                {msResult?.score ?? '—'}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '10px', marginTop: '2px' }}>/ 100</div>
                        </div>

                        {/* Trend */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <TrendIcon size={14} color={trendInfo.color} />
                            <span style={{ color: trendInfo.color, fontSize: '12px', fontWeight: 500 }}>
                                {trendInfo.label}
                            </span>
                        </div>

                        {/* Traffic light label */}
                        <div style={{
                            color: tl.border,
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                        }}>
                            {msResult?.trafficLight?.source === 'lock' ? '⚡ ' : ''}{tl.label}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── SECTION D: Attention Ranking ── */}
            <div style={{ marginBottom: '20px' }}>
                <AttentionRanking ranking={ranking} />
            </div>

            {/* ── SECTION B/C: Area Cards ── */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: '12px',
                }}>
                    <h2 style={{ color: '#e2e8f0', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                        <Target size={14} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
                        Áreas ({workAreas.length})
                    </h2>
                    <button
                        onClick={() => setShowAddAreas(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '6px 14px',
                            background: 'rgba(20,184,166,0.12)',
                            border: '1px solid rgba(20,184,166,0.3)',
                            borderRadius: '8px',
                            color: '#14b8a6',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        <Plus size={14} /> Agregar
                    </button>
                    <button
                        onClick={() => setShowRelationModal(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'rgba(20,184,166,0.08)',
                            border: '1px solid rgba(20,184,166,0.2)',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            color: '#14b8a6',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        <Compass size={14} /> Relación Áreas-Tipos
                    </button>
                </div>

                <AddAreasModal
                    open={showAddAreas}
                    onClose={() => setShowAddAreas(false)}
                    milestoneId={milestoneId}
                    projectId={milestone?.projectId}
                    existingAreas={workAreas}
                    workAreaTypes={workAreaTypes}
                    taskTypes={taskTypes}
                    userId={user?.uid}
                    onSaved={() => window.location.reload()}
                />
                <AreaTaskTypeRelationModal
                    open={showRelationModal}
                    onClose={() => setShowRelationModal(false)}
                    workAreaTypes={workAreaTypes}
                    taskTypes={taskTypes}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {workAreas.map(area => (
                        <AreaScoreCard
                            key={area.id}
                            areaId={area.id}
                            areaName={area.name || area.id}
                            result={areas[area.id]}
                            workArea={area}
                            onDeleted={() => window.location.reload()}
                        />
                    ))}
                    {workAreas.length === 0 && (
                        <div style={{
                            textAlign: 'center', padding: '32px',
                            color: '#64748b', fontSize: '13px',
                            background: 'rgba(15,23,42,0.3)',
                            borderRadius: '10px',
                        }}>
                            No hay áreas configuradas para este milestone.
                        </div>
                    )}
                </div>
            </div>

            {/* ── SECTION E: Score Explainer (milestone level) ── */}
            {milestoneExplanation && (
                <div style={{ marginBottom: '20px' }}>
                    <h2 style={{ color: '#e2e8f0', fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>
                        💡 Explicación del Score
                    </h2>
                    <ScoreExplainer explanation={milestoneExplanation} />
                </div>
            )}

            {/* ── SECTION G: Navigation links ── */}
            <div style={{
                display: 'flex', gap: '10px', flexWrap: 'wrap',
                marginTop: '24px', paddingTop: '20px',
                borderTop: '1px solid rgba(148,163,184,0.1)',
            }}>
                <NavButton
                    icon={<History size={14} />}
                    label="Historial de Score"
                    onClick={() => navigate(`/milestones/${milestoneId}/history`)}
                />
                <NavButton
                    icon={<BrainCircuit size={14} />}
                    label="AI Monitoring"
                    onClick={() => navigate(`/milestones/${milestoneId}/ai-monitoring`)}
                />
            </div>
        </div>
    );
}

function NavButton({ icon, label, onClick, disabled, tooltip }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={tooltip}
            style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px',
                background: disabled ? 'rgba(15,23,42,0.3)' : 'rgba(99,102,241,0.12)',
                border: `1px solid ${disabled ? 'rgba(148,163,184,0.1)' : 'rgba(99,102,241,0.3)'}`,
                borderRadius: '8px',
                color: disabled ? '#475569' : '#a5b4fc',
                fontSize: '12px',
                fontWeight: 500,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
            }}
        >
            {icon} {label}
        </button>
    );
}
