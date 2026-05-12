import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    X, Plus, Trash2, GripVertical, Save, Loader2, Sparkles, ChevronDown, ChevronRight,
    ShieldCheck, AlertCircle, CheckCircle2, MessageSquareText
} from 'lucide-react';
import {
    generatePRChecklist, saveTaskTypeChecklist
} from '../../../services/peerReviewService';

/**
 * PeerReviewTemplateEditor — Per-task-type checklist editor.
 * 
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - taskTypes: array from useEngineeringData()
 *  - workAreaTypes: array of work areas
 *  - initialSelectedId: id of task type to pre-select
 */
export default function PeerReviewTemplateEditor({ isOpen, onClose, taskTypes = [], workAreaTypes = [], initialSelectedId = null }) {
    const [selectedId, setSelectedId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [toast, setToast] = useState(null);
    const [aiContext, setAiContext] = useState('');
    const [showContextInput, setShowContextInput] = useState(false);

    // Working copy of the selected task type's sections
    const [editSections, setEditSections] = useState([]);

    const activeTypes = taskTypes.filter(tt => tt.active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const selectedType = activeTypes.find(tt => tt.id === selectedId);

    // Auto-select on open
    useEffect(() => {
        if (isOpen) {
            if (initialSelectedId && activeTypes.some(t => t.id === initialSelectedId)) {
                setSelectedId(initialSelectedId);
            } else if (activeTypes.length > 0 && !selectedId) {
                setSelectedId(activeTypes[0].id);
            }
        } else {
            setSelectedId(null);
        }
    }, [isOpen, initialSelectedId, activeTypes.length]);

    // Load sections when selection changes
    useEffect(() => {
        if (!selectedId) { setEditSections([]); return; }
        const tt = activeTypes.find(t => t.id === selectedId);
        if (!tt) { setEditSections([]); return; }

        const sections = (tt.peerReviewSections || []).map((s, si) => ({
            name: s.name || 'Sin nombre',
            items: (s.items || []).map((item, ii) => ({
                id: item.id || `s${si}i${ii}`,
                label: item.label || '',
                required: !!item.required,
            })),
        }));
        setEditSections(sections);
    }, [selectedId, taskTypes]);

    // ── Section / Item CRUD ──

    const addSection = () => {
        setEditSections(prev => [...prev, { name: 'Nueva Sección', items: [] }]);
    };

    const removeSection = (sIdx) => {
        setEditSections(prev => prev.filter((_, i) => i !== sIdx));
    };

    const updateSectionName = (sIdx, name) => {
        setEditSections(prev => prev.map((s, i) => i === sIdx ? { ...s, name } : s));
    };

    const addItem = (sIdx) => {
        setEditSections(prev => prev.map((s, i) =>
            i === sIdx
                ? { ...s, items: [...s.items, { id: `new-${Date.now()}`, label: '', required: true }] }
                : s
        ));
    };

    const removeItem = (sIdx, iIdx) => {
        setEditSections(prev => prev.map((s, i) =>
            i === sIdx ? { ...s, items: s.items.filter((_, j) => j !== iIdx) } : s
        ));
    };

    const updateItem = (sIdx, iIdx, field, value) => {
        setEditSections(prev => prev.map((s, i) =>
            i === sIdx
                ? { ...s, items: s.items.map((item, j) => j === iIdx ? { ...item, [field]: value } : item) }
                : s
        ));
    };

    // ── AI Generation ──
    // Auto-detect which area this task type belongs to
    const selectedAreaName = useMemo(() => {
        if (!selectedId || !workAreaTypes?.length) return '';
        for (const area of workAreaTypes) {
            const ids = area.taskTypeIds || area.defaultTaskTypes || [];
            if (ids.some(val => val === selectedId || val === selectedType?.name)) {
                return area.name;
            }
        }
        return '';
    }, [selectedId, workAreaTypes, selectedType]);

    const handleGenerate = async () => {
        if (!selectedType) return;
        setIsGenerating(true);
        try {
            // Build rich context: area + user custom context
            const parts = [];
            if (selectedAreaName) parts.push(`Área de trabajo: ${selectedAreaName}`);
            parts.push('Automatización de equipos de manufactura médica (ICU Medical)');
            if (aiContext.trim()) parts.push(aiContext.trim());
            const fullContext = parts.join('. ');

            const result = await generatePRChecklist(selectedType.name, fullContext);
            if (result.sections?.length) {
                setEditSections(result.sections.map((s, si) => ({
                    name: s.name,
                    items: (s.items || []).map((item, ii) => ({
                        id: `ai-${Date.now()}-${si}-${ii}`,
                        label: item.label,
                        required: !!item.required,
                    })),
                })));
                showToast('✨ Checklist generado con AI', 'success');
            }
        } catch (err) {
            showToast('Error: ' + (err.message || 'Fallo en AI'), 'error');
        }
        setIsGenerating(false);
    };

    // ── Save ──
    const handleSave = async () => {
        if (!selectedId) return;
        setIsSaving(true);
        try {
            await saveTaskTypeChecklist(selectedId, editSections);
            showToast('✅ Checklist guardado', 'success');
        } catch (err) {
            showToast('Error: ' + (err.message || 'Error al guardar'), 'error');
        }
        setIsSaving(false);
    };

    // ── Toast ──
    const showToast = (msg, type = 'info') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    if (!isOpen) return null;

    const totalItems = editSections.reduce((sum, s) => sum + (s.items?.length || 0), 0);
    const reqItems = editSections.reduce((sum, s) => sum + (s.items?.filter(i => i.required).length || 0), 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-4 zoom-in-95">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-indigo-400" />
                        <h2 className="font-black tracking-wide text-white text-sm">Checklists de Peer Review por Tipo de Tarea</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-1 overflow-hidden min-h-0">

                    {/* Sidebar — Task Types */}
                    <div className="w-56 border-r border-slate-800 bg-slate-950/50 flex flex-col shrink-0">
                        <div className="p-3 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">
                            Tipos de Tarea
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {activeTypes.map(tt => {
                                const hasSections = (tt.peerReviewSections?.length || 0) > 0;
                                const itemCount = (tt.peerReviewSections || []).reduce((sum, s) => sum + (s.items?.length || 0), 0);
                                return (
                                    <button
                                        key={tt.id}
                                        onClick={() => setSelectedId(tt.id)}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors ${
                                            selectedId === tt.id
                                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
                                        }`}
                                    >
                                        <div className="font-bold truncate">{tt.name}</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                            {hasSections
                                                ? `${tt.peerReviewSections.length} secciones · ${itemCount} items`
                                                : 'Sin checklist'
                                            }
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main Editor */}
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0">

                        {!selectedType ? (
                            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                                Selecciona un tipo de tarea
                            </div>
                        ) : (
                            <>
                                {/* Header bar */}
                                <div className="p-4 border-b border-slate-800 bg-slate-800/30 shrink-0">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-white font-black text-base">{selectedType.name}</h3>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                            <span>{editSections.length} secciones</span>
                                            <span>·</span>
                                            <span>{totalItems} items ({reqItems} obligatorios)</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowContextInput(!showContextInput)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors border ${
                                                showContextInput
                                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-300 hover:bg-slate-700 border-transparent'
                                            }`}
                                        >
                                            <MessageSquareText className="w-3 h-3" /> Contexto AI
                                        </button>
                                        <button
                                            onClick={handleGenerate}
                                            disabled={isGenerating}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                                        >
                                            {isGenerating
                                                ? <><Loader2 className="w-3 h-3 animate-spin" /> Generando...</>
                                                : <><Sparkles className="w-3 h-3" /> Generar con AI</>
                                            }
                                        </button>
                                        <button
                                            onClick={addSection}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-700/50 text-slate-300 hover:bg-slate-700 rounded-lg text-[11px] font-bold transition-colors"
                                        >
                                            <Plus className="w-3 h-3" /> Sección
                                        </button>
                                        <div className="flex-1" />
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="flex items-center gap-1 px-4 py-1.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50 shadow-lg"
                                        >
                                            {isSaving
                                                ? <><Loader2 className="w-3 h-3 animate-spin" /> Guardando</>
                                                : <><Save className="w-3 h-3" /> Guardar</>
                                            }
                                        </button>
                                    </div>
                                    {showContextInput && (
                                        <div className="mt-3 space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contexto adicional para la IA</label>
                                            <textarea
                                                value={aiContext}
                                                onChange={(e) => setAiContext(e.target.value)}
                                                placeholder={`Ej: Este tipo de tarea involucra programación de PLCs Allen-Bradley para líneas de llenado aséptico...${selectedAreaName ? `\n\nÁrea detectada: ${selectedAreaName}` : ''}`}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none"
                                                rows={3}
                                            />
                                            <p className="text-[10px] text-slate-600">
                                                {selectedAreaName && <span className="text-amber-400/70">Área auto-detectada: {selectedAreaName}. </span>}
                                                Este contexto se enviará junto al nombre de la tarea para generar un checklist más preciso.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Sections + Items */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {editSections.length === 0 && (
                                        <div className="text-center py-12">
                                            <p className="text-slate-500 text-sm mb-3">Sin checklist para "{selectedType.name}"</p>
                                            <div className="flex items-center justify-center gap-3">
                                                <button onClick={addSection} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors">
                                                    <Plus className="w-3.5 h-3.5 inline mr-1" /> Agregar sección manual
                                                </button>
                                                <button onClick={handleGenerate} disabled={isGenerating} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-500 transition-colors disabled:opacity-50">
                                                    <Sparkles className="w-3.5 h-3.5 inline mr-1" /> {isGenerating ? 'Generando...' : 'Generar con AI'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {editSections.map((section, sIdx) => (
                                        <SectionCard
                                            key={sIdx}
                                            section={section}
                                            onUpdateName={(name) => updateSectionName(sIdx, name)}
                                            onRemoveSection={() => removeSection(sIdx)}
                                            onAddItem={() => addItem(sIdx)}
                                            onRemoveItem={(iIdx) => removeItem(sIdx, iIdx)}
                                            onUpdateItem={(iIdx, field, value) => updateItem(sIdx, iIdx, field, value)}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Toast */}
                {toast && (
                    <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-3 ${
                        toast.type === 'error' 
                            ? 'bg-red-500/90 text-white' 
                            : 'bg-emerald-500/90 text-white'
                    }`}>
                        {toast.type === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        {toast.msg}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Section Card Sub-component ──
function SectionCard({ section, onUpdateName, onRemoveSection, onAddItem, onRemoveItem, onUpdateItem }) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
            {/* Section Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/60">
                <button onClick={() => setCollapsed(!collapsed)} className="text-slate-400 hover:text-white">
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <input
                    value={section.name}
                    onChange={e => onUpdateName(e.target.value)}
                    className="flex-1 bg-transparent text-sm font-bold text-slate-200 outline-none border-b border-transparent focus:border-indigo-500 transition-colors"
                    placeholder="Nombre de la sección..."
                />
                <span className="text-[10px] text-slate-500 font-bold mr-2">{section.items.length} items</span>
                <button onClick={onAddItem} className="p-1 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded transition-colors" title="Agregar item">
                    <Plus className="w-3.5 h-3.5" />
                </button>
                <button onClick={onRemoveSection} className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors" title="Eliminar sección">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Items */}
            {!collapsed && (
                <div className="p-3 space-y-1.5">
                    {section.items.length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-3">Sin items — click + para agregar</p>
                    )}
                    {section.items.map((item, iIdx) => (
                        <div key={item.id || iIdx} className="flex items-start gap-2 group pt-0.5">
                            <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
                            <textarea
                                value={item.label}
                                onChange={e => onUpdateItem(iIdx, 'label', e.target.value)}
                                placeholder="Criterio de revisión..."
                                className="flex-1 px-2.5 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded text-xs text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none min-h-[28px]"
                                rows={1}
                                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                            />
                            <button
                                onClick={() => onUpdateItem(iIdx, 'required', !item.required)}
                                className={`shrink-0 px-2 py-1 rounded text-[9px] font-bold uppercase transition-colors ${
                                    item.required
                                        ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25'
                                        : 'bg-slate-700/50 text-slate-500 border border-slate-600/50 hover:bg-slate-700'
                                }`}
                                title={item.required ? "Obligatorio — click para opcional" : "Opcional — click para obligatorio"}
                            >
                                {item.required ? 'REQ' : 'OPT'}
                            </button>
                            <button
                                onClick={() => onRemoveItem(iIdx)}
                                className="shrink-0 p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
