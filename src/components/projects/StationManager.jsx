/**
 * StationManager — CRUD de estaciones por proyecto
 * ==================================================
 * Panel embebido en ProjectDetailPage para gestionar las estaciones.
 * Soporta importación desde imagen (paste screenshot).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Plus, Trash2, Save, X, MapPin, Hash, Loader2, ChevronDown, ChevronRight,
    Image, Sparkles, CheckCircle2, AlertCircle, Upload
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import {
    onProjectStations, addStation, updateStation, deleteStation, hasMultipleIndexers
} from '../../services/stationService';

const analyzeStationImageFn = httpsCallable(functions, 'analyzeStationImage');

// ============================================================
// IMPORT MODAL — paste image → analyze → review → confirm
// ============================================================

function ImportModal({ open, onClose, projectId, userId, existingCount }) {
    const [pastedImage, setPastedImage] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [importProgress, setImportProgress] = useState(null);
    const [importDone, setImportDone] = useState(false);
    const pasteZoneRef = useRef(null);

    useEffect(() => {
        if (open) {
            setPastedImage(null); setResult(null); setError(null);
            setImportProgress(null); setImportDone(false);
        }
    }, [open]);

    useEffect(() => {
        if (open && pasteZoneRef.current) {
            setTimeout(() => pasteZoneRef.current?.focus(), 100);
        }
    }, [open, pastedImage]);

    const handlePaste = useCallback((e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                const reader = new FileReader();
                reader.onload = () => {
                    const dataUrl = reader.result;
                    setPastedImage({ base64: dataUrl.split(',')[1], mimeType: file.type, preview: dataUrl });
                    setResult(null); setError(null);
                };
                reader.readAsDataURL(file);
                break;
            }
        }
    }, []);

    const handleAnalyze = useCallback(async () => {
        if (!pastedImage) return;
        setProcessing(true); setError(null); setResult(null);
        try {
            const res = await analyzeStationImageFn({
                imageBase64: pastedImage.base64, mimeType: pastedImage.mimeType,
            });
            const data = res.data?.data;
            if (data?.stations?.length > 0) { setResult(data); }
            else { setError('No se encontraron estaciones en la imagen. Intenta con otra captura.'); }
        } catch (err) { setError(err.message || 'Error al analizar la imagen.'); }
        setProcessing(false);
    }, [pastedImage]);

    const handleConfirmImport = useCallback(async () => {
        if (!result?.stations?.length) return;
        setProcessing(true); setImportProgress(`0 / ${result.stations.length}`);
        try {
            for (let i = 0; i < result.stations.length; i++) {
                const s = result.stations[i];
                await addStation(projectId, {
                    indx: s.indx || 1,
                    stn: String(s.stn || '').padStart(2, '0'),
                    abbreviation: s.abbreviation || '',
                    description: s.description || '',
                    order: existingCount + i,
                }, userId);
                setImportProgress(`${i + 1} / ${result.stations.length}`);
            }
            setImportDone(true);
        } catch (err) { setError(`Error importando: ${err.message}`); }
        setProcessing(false);
    }, [result, projectId, existingCount, userId]);

    const step = importDone ? 'done' : result ? 'review' : pastedImage ? 'analyze' : 'paste';

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-purple-900/30 to-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-purple-500/20 rounded-xl flex items-center justify-center">
                            <Image className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Importar Estaciones desde Imagen</h2>
                            <p className="text-[11px] text-slate-500">Pega una captura de tu tabla de estaciones</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Steps */}
                <div className="px-6 py-3 border-b border-slate-800/50 flex items-center gap-4">
                    {['Pegar imagen', 'Analizar', 'Revisar e importar'].map((label, i) => {
                        const stepIdx = step === 'paste' ? 0 : step === 'analyze' ? 1 : step === 'review' ? 2 : 3;
                        const isActive = i <= stepIdx;
                        const isCurrent = i === stepIdx;
                        return (
                            <div key={label} className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                    isCurrent ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                    : isActive ? 'bg-purple-500/20 text-purple-400'
                                    : 'bg-slate-800 text-slate-600'
                                }`}>{i + 1}</div>
                                <span className={`text-xs font-medium ${isActive ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
                                {i < 2 && <div className={`w-8 h-px ${isActive ? 'bg-purple-500/40' : 'bg-slate-800'}`} />}
                            </div>
                        );
                    })}
                </div>

                {/* Body */}
                <div className="px-6 py-5 max-h-[60vh] overflow-auto">

                    {step === 'done' && (
                        <div className="text-center py-10 space-y-4">
                            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white">¡Importación completa!</h3>
                            <p className="text-sm text-slate-400">
                                Se importaron <span className="font-bold text-emerald-400">{result?.stations?.length}</span> estaciones exitosamente.
                            </p>
                            <button onClick={onClose} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition cursor-pointer">
                                Cerrar
                            </button>
                        </div>
                    )}

                    {(step === 'paste' || step === 'analyze') && (
                        <div className="space-y-4">
                            <div
                                ref={pasteZoneRef} tabIndex={0} onPaste={handlePaste}
                                className={`border-2 border-dashed rounded-xl transition-all focus:outline-none ${
                                    pastedImage
                                        ? 'border-purple-500/40 bg-purple-500/5 p-4'
                                        : 'border-slate-700 hover:border-purple-500/30 focus:border-purple-500/50 bg-slate-800/30 p-10'
                                }`}
                                onClick={() => pasteZoneRef.current?.focus()}
                            >
                                {pastedImage ? (
                                    <div className="space-y-3">
                                        <img src={pastedImage.preview} alt="Imagen pegada" className="max-h-56 mx-auto rounded-lg border border-slate-700 shadow-lg" />
                                        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                            Imagen cargada — lista para analizar
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center space-y-3">
                                        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto border border-slate-700">
                                            <Image className="w-8 h-8 text-slate-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-300 font-medium">Haz click aquí y pega tu imagen</p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                <span className="font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">Ctrl+V</span>
                                                {' '}para pegar una captura de pantalla
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-slate-600">Soporta capturas de Excel, tablas, listas de estaciones</p>
                                    </div>
                                )}
                            </div>
                            {error && (
                                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="space-y-4">
                            {pastedImage && (
                                <div className="flex items-start gap-4">
                                    <img src={pastedImage.preview} alt="" className="h-20 rounded-lg border border-slate-700 opacity-60" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                                            <CheckCircle2 className="w-4 h-4" /> {result.stations.length} estaciones detectadas
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1">
                                            Revisa los datos y confirma la importación.
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div className="rounded-xl border border-slate-700 overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-800/80 text-slate-500 text-[10px] uppercase tracking-wider">
                                            <th className="px-3 py-2 text-left w-16">STN</th>
                                            <th className="px-3 py-2 text-left">Descripción</th>
                                            <th className="px-3 py-2 text-left w-28">Abreviatura</th>
                                            {result?.stations?.some(s => s.indx) && <th className="px-3 py-2 text-center w-14">INDX</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result?.stations?.map((s, i) => (
                                            <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-800/40 transition-colors">
                                                <td className="px-3 py-2 font-mono font-bold text-cyan-400">{String(s.stn).padStart(2, '0')}</td>
                                                <td className="px-3 py-2 text-slate-300">{s.description}</td>
                                                <td className="px-3 py-2 text-slate-500 font-semibold">{s.abbreviation || '—'}</td>
                                                {result.stations.some(st => st.indx) && <td className="px-3 py-2 text-center text-slate-500">{s.indx || 1}</td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {error && (
                                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step !== 'done' && (
                    <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/80">
                        <button onClick={() => {
                            if (step === 'review') { setResult(null); setError(null); }
                            else if (step === 'analyze') { setPastedImage(null); setResult(null); }
                            else onClose();
                        }} className="px-4 py-2 text-slate-400 hover:text-white text-xs font-medium transition cursor-pointer">
                            {step === 'paste' ? 'Cancelar' : '← Atrás'}
                        </button>
                        <div className="flex items-center gap-2">
                            {step === 'analyze' && (
                                <>
                                    <button onClick={() => setPastedImage(null)}
                                        className="px-3 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs hover:bg-slate-700 transition cursor-pointer">
                                        Cambiar imagen
                                    </button>
                                    <button onClick={handleAnalyze} disabled={processing}
                                        className="px-5 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-2">
                                        {processing
                                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analizando...</>
                                            : <><Sparkles className="w-3.5 h-3.5" /> Analizar</>
                                        }
                                    </button>
                                </>
                            )}
                            {step === 'review' && (
                                <button onClick={handleConfirmImport} disabled={processing}
                                    className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-2">
                                    {processing
                                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importando {importProgress}</>
                                        : <><Upload className="w-3.5 h-3.5" /> Confirmar Importación ({result?.stations?.length})</>
                                    }
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

// ============================================================
// INLINE EDIT CELL — click to edit, blur to save
// ============================================================

function InlineEditCell({ value, stationId, field, type = 'text', projectId, canEdit, className = '' }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value ?? '');
    const inputRef = useRef(null);

    useEffect(() => { setDraft(value ?? ''); }, [value]);
    useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

    const save = useCallback(async () => {
        setEditing(false);
        const newVal = type === 'number' ? (Number(draft) || 1) : draft;
        if (newVal === value) return; // no change
        try {
            await updateStation(projectId, stationId, { [field]: newVal });
        } catch (err) { console.error('Auto-save error:', err); setDraft(value ?? ''); }
    }, [draft, value, projectId, stationId, field, type]);

    if (!canEdit) {
        return <span className={className}>{value || '—'}</span>;
    }

    if (editing) {
        return (
            <input
                ref={inputRef}
                type={type} min={type === 'number' ? '1' : undefined}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={save}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); } }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-cyan-500/50 rounded px-1.5 py-0.5 text-xs text-slate-800 dark:text-slate-200 outline-none"
            />
        );
    }

    return (
        <span
            onClick={() => { setDraft(value ?? ''); setEditing(true); }}
            className={`cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded px-1 py-0.5 -mx-1 transition ${className}`}
            title="Click para editar"
        >
            {value || '—'}
        </span>
    );
}

// ============================================================
// STATION MANAGER
// ============================================================

export default function StationManager({ projectId, canEdit = false, userId = null }) {
    const [stations, setStations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newStation, setNewStation] = useState({ indx: 1, stn: '', abbreviation: '', description: '' });
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);

    useEffect(() => {
        if (!projectId) { setStations([]); setLoading(false); return; }
        setLoading(true);
        const unsub = onProjectStations(projectId, (data) => { setStations(data); setLoading(false); });
        return unsub;
    }, [projectId]);

    const multiIdx = hasMultipleIndexers(stations);

    const handleAdd = useCallback(async () => {
        if (!newStation.stn.trim()) return;
        setSaving(true);
        try {
            await addStation(projectId, { ...newStation, indx: Number(newStation.indx) || 1, order: stations.length }, userId);
            setNewStation({ indx: 1, stn: '', abbreviation: '', description: '' }); setShowForm(false);
        } catch (err) { console.error('Error adding station:', err); }
        setSaving(false);
    }, [projectId, newStation, stations.length, userId]);

    const handleDelete = useCallback(async (stationId) => {
        setDeletingId(stationId);
        try { await deleteStation(projectId, stationId); } catch (err) { console.error('Error deleting station:', err); }
        setDeletingId(null);
    }, [projectId]);

    const indexerGroups = stations.reduce((acc, s) => {
        const idx = s.indx || 1; if (!acc[idx]) acc[idx] = []; acc[idx].push(s); return acc;
    }, {});
    const indexerKeys = Object.keys(indexerGroups).sort((a, b) => Number(a) - Number(b));

    return (
        <div className="bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg">
            <ImportModal open={showImportModal} onClose={() => setShowImportModal(false)}
                projectId={projectId} userId={userId} existingCount={stations.length} />

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 cursor-pointer group">
                    {expanded ? <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition" /> : <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition" />}
                    <MapPin className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">Estaciones</h3>
                    {stations.length > 0 && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{stations.length}</span>}
                </button>
                {canEdit && expanded && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowImportModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 dark:bg-slate-800 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 hover:bg-purple-100 dark:hover:bg-purple-500/10 rounded-xl text-xs font-bold transition cursor-pointer">
                            <Image className="w-3.5 h-3.5" /> Importar Imagen
                        </button>
                        <button onClick={() => setShowForm(true)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-bold hover:bg-cyan-700 shadow-lg shadow-cyan-900/30 transition cursor-pointer">
                            <Plus className="w-3.5 h-3.5" /> Nueva Estación
                        </button>
                    </div>
                )}
            </div>

            {!expanded ? null : loading ? (
                <div className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-500 mt-2">Cargando estaciones...</p>
                </div>
            ) : (
                <>
                    {showForm && (
                        <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-cyan-200 dark:border-cyan-500/20 animate-in fade-in duration-200">
                            <div className="grid grid-cols-12 gap-2 items-end">
                                <div className="col-span-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">INDX</label>
                                    <input type="number" min="1" value={newStation.indx} onChange={e => setNewStation({ ...newStation, indx: e.target.value })}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-cyan-500/50" />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">STN #</label>
                                    <input value={newStation.stn} onChange={e => setNewStation({ ...newStation, stn: e.target.value })} placeholder="01"
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-cyan-500/50" />
                                </div>
                                <div className="col-span-3">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Descripción</label>
                                    <input value={newStation.description} onChange={e => setNewStation({ ...newStation, description: e.target.value })} placeholder="Body Load"
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-cyan-500/50" />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Abreviatura</label>
                                    <input value={newStation.abbreviation} onChange={e => setNewStation({ ...newStation, abbreviation: e.target.value })} placeholder="BDY LD"
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-cyan-500/50" />
                                </div>
                                <div className="col-span-2 flex items-center gap-1">
                                    <button onClick={handleAdd} disabled={saving || !newStation.stn.trim()}
                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-bold hover:bg-cyan-700 transition disabled:opacity-50 cursor-pointer">
                                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                    </button>
                                    <button onClick={() => setShowForm(false)}
                                        className="px-2 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {stations.length === 0 ? (
                        <div className="text-center py-8">
                            <MapPin className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                            <p className="text-sm text-slate-500 mb-1">Este proyecto aún no tiene estaciones configuradas.</p>
                            <p className="text-[11px] text-slate-600">Agrega estaciones o importa desde una imagen.</p>
                        </div>
                    ) : (
                        <div className="space-y-0">
                            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                                <div className="col-span-1">INDX</div>
                                <div className="col-span-1">STN</div>
                                <div className="col-span-3">Descripción</div>
                                <div className="col-span-2">Abreviatura</div>
                                <div className="col-span-3">DWG Name</div>
                                {canEdit && <div className="col-span-2 text-right">Acciones</div>}
                            </div>
                            {indexerKeys.map(idxKey => (
                                <div key={idxKey}>
                                    {multiIdx && (
                                        <div className="px-3 py-1.5 text-[10px] font-black text-cyan-500 uppercase tracking-wider bg-cyan-500/5 rounded mt-2">
                                            <Hash className="w-3 h-3 inline mr-1" /> Indexer {idxKey}
                                        </div>
                                    )}
                                    {indexerGroups[idxKey].map(stn => (
                                        <div key={stn.id} className="grid grid-cols-12 gap-2 px-3 py-2 items-center hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/50 last:border-0 transition-colors group">
                                            <div className="col-span-1 text-xs">
                                                <InlineEditCell value={stn.indx || 1} stationId={stn.id} field="indx" type="number" projectId={projectId} canEdit={canEdit} className="text-slate-600 dark:text-slate-500" />
                                            </div>
                                            <div className="col-span-1 text-xs">
                                                <InlineEditCell value={stn.stn} stationId={stn.id} field="stn" projectId={projectId} canEdit={canEdit} className="text-cyan-600 dark:text-cyan-400 font-mono font-bold" />
                                            </div>
                                            <div className="col-span-3 text-xs">
                                                <InlineEditCell value={stn.description} stationId={stn.id} field="description" projectId={projectId} canEdit={canEdit} className="text-slate-700 dark:text-slate-300" />
                                            </div>
                                            <div className="col-span-2 text-xs">
                                                <InlineEditCell value={stn.abbreviation} stationId={stn.id} field="abbreviation" projectId={projectId} canEdit={canEdit} className="text-slate-500 dark:text-slate-400 font-semibold" />
                                            </div>
                                            <div className="col-span-3 text-xs">
                                                <span className="text-amber-600 dark:text-amber-400/80 font-mono text-[11px]">
                                                    {(() => {
                                                        const stnPad = String(stn.stn || '').padStart(2, '0');
                                                        const prefix = multiIdx ? `${stn.indx || 1}-STN${stnPad}` : `STN${stnPad}`;
                                                        return stn.abbreviation ? `${prefix} ${stn.abbreviation}` : prefix;
                                                    })()}
                                                </span>
                                            </div>
                                            {canEdit && (
                                                <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleDelete(stn.id)} disabled={deletingId === stn.id} className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition cursor-pointer disabled:opacity-50" title="Eliminar">
                                                        {deletingId === stn.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
