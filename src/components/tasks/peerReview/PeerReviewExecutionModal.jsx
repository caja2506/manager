import React, { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { X, ShieldCheck, ShieldAlert, CheckSquare, Square, MinusSquare, XSquare, MessageSquare, AlertCircle, Info, Upload, Eye, Download, FileText, Box, Loader2, Paperclip, Maximize2, Minimize2 } from 'lucide-react';
import { submitPeerReview, getChecklistForTaskType } from '../../../services/peerReviewService';
import { listTaskFiles, getFileTypeInfo } from '../../../services/storageService';

// Lazy-load viewers
const PdfViewer = lazy(() => import('../../viewers/PdfViewer'));
const StlViewer = lazy(() => import('../../viewers/StlViewer'));

export default function PeerReviewExecutionModal({ isOpen, onClose, task, peerReviewDoc, onSuccess, teamMembers = [], viewOnly = false }) {
    const [checklistData, setChecklistData] = useState(null);
    const [checklist, setChecklist] = useState([]);
    const [summary, setSummary] = useState('');
    const [decision, setDecision] = useState(''); // 'approved' or 'changes_requested'
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    
    // File viewer state
    const [taskFiles, setTaskFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null); // file being viewed
    const [localFile, setLocalFile] = useState(null); // locally dropped file
    const [isDragging, setIsDragging] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(true);
    const [filesLoading, setFilesLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !task || !peerReviewDoc) return;
        
        let isMounted = true;
        setIsLoading(true);

        async function loadTemplate() {
            try {
                if (viewOnly && peerReviewDoc?.checklistItems) {
                    // View-only mode: load results from the completed review
                    const resultItems = peerReviewDoc.checklistItems.map(item => ({
                        id: item.id,
                        label: item.label,
                        required: item.required,
                        section: item.section || 'General',
                        status: item.rejected ? 'rejected' : item.checked ? 'checked' : item.na ? 'na' : (item.status || 'unchecked'),
                        comment: item.comment || '',
                    }));
                    if (isMounted) {
                        // Build sections with embedded items so renderChecklist can match them
                        const sectionMap = {};
                        resultItems.forEach(item => {
                            const sName = item.section || 'General';
                            if (!sectionMap[sName]) sectionMap[sName] = { name: sName, items: [] };
                            sectionMap[sName].items.push({ id: item.id, label: item.label });
                        });
                        const sections = Object.values(sectionMap);
                        setChecklistData({ sections, items: resultItems });
                        setChecklist(resultItems);
                        setSummary(peerReviewDoc.summary || '');
                        setDecision(peerReviewDoc.decision || '');
                    }
                } else {
                    const data = await getChecklistForTaskType(task.taskTypeId);
                    if (isMounted) {
                        setChecklistData(data);
                        const initialList = (data?.items || []).map(item => ({
                            id: item.id,
                            label: item.label,
                            required: item.required,
                            status: 'unchecked'
                        }));
                        setChecklist(initialList);
                    }
                }
            } catch (err) {
                if (isMounted) setError('Error al cargar la configuración de revisión.');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }
        loadTemplate();

        // Load task attachments
        if (task?.id) {
            setFilesLoading(true);
            listTaskFiles(task.id)
                .then(files => {
                    if (isMounted) {
                        setTaskFiles(files);
                        // Auto-select first viewable file
                        const firstViewable = files.find(f => f.viewable);
                        if (firstViewable) setActiveFile(firstViewable);
                    }
                })
                .catch(() => {
                    if (isMounted) setTaskFiles([]);
                })
                .finally(() => {
                    if (isMounted) setFilesLoading(false);
                });
        }

        return () => { isMounted = false; };
    }, [isOpen, task, peerReviewDoc]);

    // Reset local file when modal closes
    useEffect(() => {
        if (!isOpen) {
            setLocalFile(null);
            setActiveFile(null);
        }
    }, [isOpen]);

    if (!isOpen || !task || !peerReviewDoc) return null;

    const cycleItem = (itemId) => {
        setChecklist(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            // Cycle: unchecked → checked → rejected → na → unchecked
            const next = item.status === 'unchecked' ? 'checked' 
                       : item.status === 'checked' ? 'rejected'
                       : item.status === 'rejected' ? 'na' 
                       : 'unchecked';
            // Clear comment when leaving rejected state
            const comment = next === 'rejected' ? (item.comment || '') : '';
            return { ...item, status: next, comment };
        }));
    };

    const updateItemComment = (itemId, comment) => {
        setChecklist(prev => prev.map(item => 
            item.id === itemId ? { ...item, comment } : item
        ));
    };

    // All required items must be checked or N/A to approve
    const allResolved = checklist.length > 0 && checklist.filter(i => i.required).every(item => item.status === 'checked' || item.status === 'na');

    // Check if any item is rejected
    const hasRejections = checklist.some(i => i.status === 'rejected');
    const rejectedCount = checklist.filter(i => i.status === 'rejected').length;

    // Check if rejected items have comments
    const rejectedWithoutComment = checklist.filter(i => i.status === 'rejected' && (!i.comment || !i.comment.trim()));

    // Cannot approve if there are rejections
    const canApprove = allResolved && !hasRejections;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!decision) {
            setError('Debes seleccionar una decisión.');
            return;
        }
        if (decision === 'approved' && hasRejections) {
            setError('No puedes aprobar con items rechazados. Cambia a "Solicitar Cambios".');
            setDecision('changes_requested');
            return;
        }
        if (decision === 'approved' && !allResolved) {
            setError('Debes marcar o establecer como N/A todos los items requeridos para aprobar.');
            return;
        }
        if (rejectedWithoutComment.length > 0) {
            setError(`Hay ${rejectedWithoutComment.length} item(s) rechazado(s) sin motivo. Agrega un comentario a cada rechazo.`);
            return;
        }
        if (decision === 'changes_requested' && !summary.trim()) {
            setError('Debes proporcionar un resumen explicando los cambios solitados.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            // Map status to fields for backend compatibility
            const checklistPayload = checklist.map(item => ({
                ...item,
                checked: item.status === 'checked',
                rejected: item.status === 'rejected',
                na: item.status === 'na',
                comment: item.comment || '',
            }));
            await submitPeerReview(peerReviewDoc.id, decision, checklistPayload, summary);
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            setError(err.message || 'Error al enviar la revisión.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle local file drop (for viewing files from Explorer without upload)
    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            const info = getFileTypeInfo(file.name);
            if (info.viewable) {
                setLocalFile(file);
                setActiveFile({ name: file.name, type: info.type, viewable: true, localFile: file });
            }
        }
    };

    // Determine if we should show split view  
    const hasViewableContent = activeFile || taskFiles.some(f => f.viewable) || localFile;
    const hasChecklist = checklistData && checklist.length > 0;
    const showSplit = hasViewableContent && hasChecklist;

    // ── Viewer panel content ──
    const renderViewer = () => {
        if (!activeFile) {
            return (
                <div
                    className={`flex-1 flex flex-col items-center justify-center gap-4 p-8 border-2 border-dashed rounded-xl transition-all ${
                        isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <Upload className="w-10 h-10 text-slate-600" />
                    <div className="text-center">
                        <p className="text-sm text-slate-400 font-medium">Arrastra un archivo aquí</p>
                        <p className="text-xs text-slate-500 mt-1">desde el Explorador de Windows para visualizarlo</p>
                        <p className="text-[10px] text-slate-600 mt-2">Soporta: PDF, STL, imágenes</p>
                    </div>
                </div>
            );
        }

        const fileSrc = activeFile.localFile || activeFile.url;
        const fileType = activeFile.type;

        return (
            <Suspense fallback={
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                </div>
            }>
                {fileType === 'pdf' && <PdfViewer src={fileSrc} embedded />}
                {fileType === 'stl' && <StlViewer src={fileSrc} embedded />}
                {fileType === 'image' && (
                    <div className="flex-1 flex items-center justify-center p-4 bg-slate-950/50 overflow-auto">
                        <img
                            src={fileSrc instanceof File ? URL.createObjectURL(fileSrc) : fileSrc}
                            alt={activeFile.name}
                            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                        />
                    </div>
                )}
            </Suspense>
        );
    };

    // ── Checklist panel content ──
    const renderChecklist = () => (
        <div className="space-y-6">
            <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/50">
                <h4 className="text-sm font-bold text-slate-200 mb-1">{task.title}</h4>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="px-2 py-0.5 bg-slate-700/50 rounded font-semibold">{checklistData?.name}</span>
                    <span>•</span>
                    <span>Asignada a: <strong className="text-slate-300">{teamMembers.find(m => m.uid === task.assignedTo)?.displayName || task.assignedTo}</strong></span>
                </div>
            </div>

            {/* Checklist grouped by sections */}
            <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Review Checklist
                </h4>
                <div className="space-y-4">
                    {(checklistData.sections && checklistData.sections.length > 0) ? (
                        checklistData.sections.map((section, sIdx) => {
                            const sectionItems = checklist.filter(ci => (section.items || []).some(si => (si.id || '') === ci.id || si.label === ci.label));
                            if (sectionItems.length === 0) return null;
                            return (
                                <div key={sIdx} className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-800">
                                        <h5 className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{section.name}</h5>
                                    </div>
                                    <div className="divide-y divide-slate-800/50">
                                        {sectionItems.map(item => (
                                            <div key={item.id} className={`w-full transition-colors text-left ${
                                                item.status === 'checked' ? 'bg-indigo-500/10 text-slate-200' 
                                                : item.status === 'rejected' ? 'bg-red-500/10 text-slate-200'
                                                : item.status === 'na' ? 'bg-amber-500/5 text-slate-500' 
                                                : 'text-slate-400'
                                            }`}>
                                                <div className="flex items-start gap-3 p-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => !viewOnly && cycleItem(item.id)}
                                                        disabled={viewOnly}
                                                        className={`mt-0.5 shrink-0 transition-colors ${viewOnly ? 'cursor-default' : ''}`}
                                                        title={viewOnly ? '' : 'Clic para cambiar: ✓ / ✗ / N/A / ☐'}
                                                    >
                                                        {item.status === 'checked' 
                                                            ? <CheckSquare className="w-4 h-4 text-indigo-400" />
                                                            : item.status === 'rejected'
                                                            ? <XSquare className="w-4 h-4 text-red-500" />
                                                            : item.status === 'na'
                                                            ? <MinusSquare className="w-4 h-4 text-amber-500" />
                                                            : <Square className="w-4 h-4 text-slate-500" />
                                                        }
                                                    </button>
                                                    <div className="flex-1">
                                                        <span className={`text-xs ${
                                                            item.status === 'checked' ? 'font-medium' 
                                                            : item.status === 'rejected' ? 'font-medium text-red-300'
                                                            : item.status === 'na' ? 'line-through opacity-60' 
                                                            : ''
                                                        }`}>
                                                            {item.label}
                                                        </span>
                                                        {item.status === 'rejected' && (
                                                            <span className="ml-2 text-[9px] text-red-400 font-bold uppercase px-1 py-0.5 bg-red-500/20 rounded">RECHAZADO</span>
                                                        )}
                                                        {item.status === 'na' && (
                                                            <span className="ml-2 text-[9px] text-amber-500 font-bold uppercase px-1 py-0.5 bg-amber-500/10 rounded">N/A</span>
                                                        )}
                                                        {item.required && item.status !== 'na' && item.status !== 'rejected' && (
                                                            <span className="ml-2 text-[9px] text-red-400 font-bold uppercase shrink-0 px-1 py-0.5 bg-red-500/10 rounded">REQ</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Comment field for rejected items */}
                                                {item.status === 'rejected' && (
                                                    <div className="px-3 pb-3 pl-10">
                                                        <div className="flex items-start gap-2">
                                                            <MessageSquare className="w-3 h-3 text-red-400 mt-1.5 shrink-0" />
                                                            {viewOnly ? (
                                                                <p className="text-xs text-slate-300 italic">{item.comment || 'Sin comentario'}</p>
                                                            ) : (
                                                                <textarea
                                                                    value={item.comment || ''}
                                                                    onChange={(e) => updateItemComment(item.id, e.target.value)}
                                                                    placeholder="Motivo del rechazo..."
                                                                    className="w-full px-2 py-1.5 bg-red-500/5 border border-red-500/30 rounded-md text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500/50 resize-none placeholder:text-red-400/40"
                                                                    rows={2}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        /* Legacy flat items fallback */
                        <div className="space-y-2">
                            {checklist.map(item => (
                                <div key={item.id} className={`w-full rounded-lg border transition-colors text-left ${
                                    item.status === 'checked'
                                        ? 'bg-indigo-500/10 border-indigo-500/30 text-slate-200'
                                        : item.status === 'rejected'
                                        ? 'bg-red-500/10 border-red-500/30 text-slate-200'
                                        : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                                }`}>
                                    <div className="flex items-start gap-3 p-3">
                                        <button type="button" onClick={() => !viewOnly && cycleItem(item.id)} disabled={viewOnly} className={`mt-0.5 shrink-0 ${viewOnly ? 'cursor-default' : ''}`}>
                                            {item.status === 'checked' ? <CheckSquare className="w-4 h-4 text-indigo-400" />
                                            : item.status === 'rejected' ? <XSquare className="w-4 h-4 text-red-500" />
                                            : <Square className="w-4 h-4 text-slate-500" />}
                                        </button>
                                        <div className="flex-1">
                                            <span className={`text-xs ${item.status === 'checked' ? 'font-medium' : item.status === 'rejected' ? 'font-medium text-red-300' : ''}`}>
                                                {item.label}
                                            </span>
                                            {item.status === 'rejected' && (
                                                <span className="ml-2 text-[9px] text-red-400 font-bold uppercase px-1 py-0.5 bg-red-500/20 rounded">RECHAZADO</span>
                                            )}
                                            {item.required && item.status !== 'rejected' && (
                                                <span className="ml-2 text-[9px] text-red-400 font-bold uppercase shrink-0">Req</span>
                                            )}
                                        </div>
                                    </div>
                                    {item.status === 'rejected' && (
                                        <div className="px-3 pb-3 pl-10">
                                            <textarea
                                                value={item.comment || ''}
                                                onChange={(e) => updateItemComment(item.id, e.target.value)}
                                                placeholder="Motivo del rechazo..."
                                                className="w-full px-2 py-1.5 bg-red-500/5 border border-red-500/30 rounded-md text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500/50 resize-none placeholder:text-red-400/40"
                                                rows={2}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Summary / Notes */}
            <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                    Notas de Revisión 
                    {!viewOnly && decision === 'changes_requested' && <span className="text-red-400 normal-case tracking-normal">Obligatorio</span>}
                </h4>
                {viewOnly ? (
                    <div className="w-full px-3 py-2 bg-slate-950/50 border border-slate-700 rounded-lg text-sm text-slate-300 min-h-[60px] whitespace-pre-wrap">
                        {summary || <span className="text-slate-500 italic">Sin notas</span>}
                    </div>
                ) : (
                    <textarea
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder="Detalles sobre lo revisado, correcciones necesarias..."
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        rows={4}
                    ></textarea>
                )}
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300">{error}</p>
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
             style={isFullscreen ? {} : { padding: '1rem' }}>
            <div className={`bg-slate-900 shadow-2xl flex flex-col animate-in slide-in-from-bottom-4 zoom-in-95 transition-all duration-300 ${
                isFullscreen
                    ? 'w-full h-full'
                    : showSplit
                        ? 'w-full max-w-6xl max-h-[92vh] border border-slate-700 rounded-xl'
                        : 'w-full max-w-2xl max-h-[90vh] border border-slate-700 rounded-xl'
            }`}>
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 text-indigo-400">
                        <ShieldCheck className="w-5 h-5" />
                        <h3 className="font-black tracking-wide text-sm">{viewOnly ? 'Resultado de Revisión' : 'Ejecución de Peer Review'}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsFullscreen(f => !f)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            title={isFullscreen ? 'Modo ventana' : 'Pantalla completa'}
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            disabled={isSubmitting}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-10 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                    </div>
                ) : !checklistData || checklist.length === 0 ? (
                    <div className="p-10 text-center">
                        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                        <p className="text-amber-400 text-sm font-bold">No hay checklist configurado</p>
                        <p className="text-slate-500 text-xs mt-1">El tipo de tarea actual no tiene un checklist asociado.</p>
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-800 text-slate-300 rounded text-xs hover:bg-slate-700">Cerrar</button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden min-h-0 flex-1">
                        {/* ── SPLIT VIEW or SINGLE COLUMN ── */}
                        <div className={`flex-1 overflow-hidden min-h-0 ${showSplit ? 'flex' : 'flex flex-col'}`}>
                            
                            {/* LEFT PANEL: Viewer */}
                            {showSplit && (
                                <div className="w-1/2 border-r border-slate-800 flex flex-col min-h-0">
                                    {/* File tabs */}
                                    {(taskFiles.length > 0 || localFile) && (
                                        <div className="px-3 py-2 border-b border-slate-800 bg-slate-800/30 flex items-center gap-1 overflow-x-auto shrink-0">
                                            {taskFiles.filter(f => f.viewable).map((file, idx) => (
                                                <button
                                                    key={file.storagePath || idx}
                                                    type="button"
                                                    onClick={() => setActiveFile(file)}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                                                        activeFile?.storagePath === file.storagePath
                                                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                                            : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800 border border-transparent'
                                                    }`}
                                                >
                                                    {file.type === 'pdf' ? <FileText className="w-3 h-3" /> : file.type === 'stl' ? <Box className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                    {file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name}
                                                </button>
                                            ))}
                                            {localFile && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const info = getFileTypeInfo(localFile.name);
                                                        setActiveFile({ name: localFile.name, type: info.type, viewable: true, localFile });
                                                    }}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                                                        activeFile?.localFile === localFile
                                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                            : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800 border border-transparent'
                                                    }`}
                                                >
                                                    <Upload className="w-3 h-3" />
                                                    {localFile.name.length > 20 ? localFile.name.substring(0, 20) + '...' : localFile.name}
                                                </button>
                                            )}
                                            {/* Drop zone hint */}
                                            <div
                                                className="flex items-center gap-1 px-2 py-1 text-[9px] text-slate-600 border border-dashed border-slate-700 rounded-lg cursor-default"
                                                onDragOver={handleDragOver}
                                                onDragLeave={handleDragLeave}
                                                onDrop={handleDrop}
                                            >
                                                <Upload className="w-3 h-3" /> Drop
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Viewer content */}
                                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden"
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        {renderViewer()}
                                    </div>

                                    {/* Non-viewable files (download only) */}
                                    {taskFiles.filter(f => !f.viewable).length > 0 && (
                                        <div className="px-3 py-2 border-t border-slate-800 bg-slate-800/30 shrink-0">
                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Otros archivos</p>
                                            <div className="flex flex-wrap gap-1">
                                                {taskFiles.filter(f => !f.viewable).map((file, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={file.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        download={file.name}
                                                        className="flex items-center gap-1 px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700"
                                                    >
                                                        <Download className="w-3 h-3" />
                                                        {file.name}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* RIGHT PANEL (or SINGLE): Checklist */}
                            <div className={`${showSplit ? 'w-1/2' : 'w-full'} overflow-y-auto p-5`}>
                                {/* Drop zone when no files (non-split mode) */}
                                {!showSplit && (
                                    <div
                                        className={`mb-4 border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                                            isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700/50'
                                        }`}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        <div className="flex items-center justify-center gap-2 text-slate-500">
                                            <Upload className="w-4 h-4" />
                                            <span className="text-[10px] font-medium">
                                                {isDragging ? 'Soltar archivo aquí' : 'Arrastra un PDF o STL aquí para visualizarlo durante la revisión'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {renderChecklist()}
                            </div>
                        </div>

                        {/* Footer / Actions */}
                        <div className="p-5 border-t border-slate-800 bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                            
                            {viewOnly ? (
                                /* View-only mode: just a close button */
                                <>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                                            decision === 'approved' 
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                        }`}>
                                            {decision === 'approved' ? '✅ Aprobada' : '⚠️ Cambios Solicitados'}
                                        </span>
                                        {peerReviewDoc?.completedAt && (
                                            <span className="text-[10px] text-slate-500">
                                                {new Date(peerReviewDoc.completedAt).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-6 py-2 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                                    >
                                        Cerrar
                                    </button>
                                </>
                            ) : (
                                /* Execution mode: approve/reject + confirm */
                                <>
                                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700 w-full sm:w-auto">
                                        <button
                                            type="button"
                                            onClick={() => !hasRejections && setDecision('approved')}
                                            disabled={hasRejections}
                                            title={hasRejections ? `No puedes aprobar con ${rejectedCount} item(s) rechazado(s)` : 'Aprobar revisión'}
                                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-md transition-colors ${
                                                hasRejections
                                                    ? 'opacity-30 cursor-not-allowed text-slate-500 border border-transparent'
                                                    : decision === 'approved'
                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
                                            }`}
                                        >
                                            <ShieldCheck className="w-4 h-4" /> Aprobar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDecision('changes_requested')}
                                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-md transition-colors ${
                                                decision === 'changes_requested' || hasRejections
                                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
                                            }`}
                                        >
                                            <ShieldAlert className="w-4 h-4" /> Solicitar Cambios
                                            {hasRejections && (
                                                <span className="ml-1 px-1.5 py-0.5 bg-red-500/30 rounded-full text-[9px] font-black">{rejectedCount}</span>
                                            )}
                                        </button>
                                    </div>

                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                                            disabled={isSubmitting}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={!decision || isSubmitting}
                                            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-bold transition-all shadow-lg min-w-[120px] ${
                                                !decision || isSubmitting 
                                                ? 'bg-indigo-600/50 text-white/50 cursor-not-allowed border border-transparent'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-indigo-500/25 border border-indigo-500'
                                            }`}
                                        >
                                            {isSubmitting ? 'Enviando...' : 'Confirmar'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
