import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Upload, Trash2, Eye, Download, FileText, Box, Image as ImageIcon, Settings, Loader2, AlertCircle, Paperclip } from 'lucide-react';
import { uploadTaskFile, deleteTaskFile, listTaskFiles, getFileTypeInfo, validateFile, formatFileSize } from '../../../services/storageService';

// Lazy-load viewers
const PdfViewer = lazy(() => import('../../viewers/PdfViewer'));
const StlViewer = lazy(() => import('../../viewers/StlViewer'));

// ── File type icon mapping ──
const FILE_ICONS = {
    pdf: FileText,
    stl: Box,
    image: ImageIcon,
    cad: Settings,
    solidworks: Settings,
    other: Paperclip,
};

/**
 * FileAttachments — Upload, view, and manage task attachments.
 *
 * Props:
 *  - taskId: string
 *  - canEdit: boolean
 *  - compact: boolean — if true, shows a minimal version
 */
export default function FileAttachments({ taskId, canEdit = false, compact = false }) {
    const [files, setFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState(null);
    const [viewerFile, setViewerFile] = useState(null); // { url, type, name }
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    // Load files
    useEffect(() => {
        if (!taskId) return;
        setIsLoading(true);
        listTaskFiles(taskId)
            .then(setFiles)
            .catch(err => {
                console.warn('[FileAttachments] Failed to list files:', err);
                setFiles([]);
            })
            .finally(() => setIsLoading(false));
    }, [taskId]);

    const handleUpload = async (file) => {
        if (!taskId) {
            setError('Guarda la tarea primero antes de adjuntar archivos.');
            return;
        }
        const validation = validateFile(file);
        if (!validation.valid) {
            setError(validation.error);
            return;
        }
        setUploading(true);
        setUploadProgress(0);
        setError(null);
        try {
            const uploaded = await uploadTaskFile(taskId, file, (pct) => setUploadProgress(pct));
            setFiles(prev => [...prev, { ...uploaded, icon: getFileTypeInfo(file.name).icon, label: getFileTypeInfo(file.name).label }]);
        } catch (err) {
            setError(err.message || 'Error al subir archivo.');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleDelete = async (file) => {
        if (!window.confirm(`¿Eliminar "${file.name}"?`)) return;
        try {
            await deleteTaskFile(file.storagePath);
            setFiles(prev => prev.filter(f => f.storagePath !== file.storagePath));
        } catch (err) {
            setError('Error al eliminar: ' + err.message);
        }
    };

    const handleView = (file) => {
        setViewerFile(file);
    };

    const handleFileInput = (e) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
        e.target.value = '';
    };

    // Drag & drop handlers
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleUpload(file);
    };

    const FileIcon = ({ type }) => {
        const Icon = FILE_ICONS[type] || FILE_ICONS.other;
        return <Icon className="w-4 h-4" />;
    };

    return (
        <>
            <div className="space-y-2">
                {/* File list */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-3">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                    </div>
                ) : files.length > 0 ? (
                    <div className="space-y-1">
                        {files.map((file, idx) => (
                            <div key={file.storagePath || idx} className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/60 rounded-lg group hover:bg-slate-800 transition-colors">
                                <span className="text-sm">{file.icon || getFileTypeInfo(file.name).icon}</span>
                                <span className="flex-1 text-[10px] text-slate-300 font-medium truncate" title={file.name}>
                                    {file.name}
                                </span>
                                {file.size && (
                                    <span className="text-[9px] text-slate-500 shrink-0">{formatFileSize(file.size)}</span>
                                )}
                                <div className="flex items-center gap-1 shrink-0">
                                    {file.viewable && (
                                        <button
                                            onClick={() => handleView(file)}
                                            className="p-1 rounded hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 transition-colors"
                                            title="Ver archivo"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <a
                                        href={file.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                        title="Descargar"
                                        download={file.name}
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                    </a>
                                    {canEdit && (
                                        <button
                                            onClick={() => handleDelete(file)}
                                            className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : !compact ? (
                    <p className="text-[10px] text-slate-500 italic text-center py-2">Sin archivos adjuntos</p>
                ) : null}

                {/* Upload area */}
                {canEdit && taskId && (
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all ${
                            isDragging
                                ? 'border-indigo-500 bg-indigo-500/10'
                                : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'
                        }`}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {uploading ? (
                            <div className="space-y-1.5">
                                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 mx-auto" />
                                <div className="w-full bg-slate-700 rounded-full h-1.5">
                                    <div
                                        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                                <p className="text-[9px] text-indigo-400 font-bold">{uploadProgress}%</p>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <Upload className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-[10px] text-slate-500 font-medium">
                                    {isDragging ? 'Soltar archivo aquí' : 'Arrastrar o clic para subir'}
                                </span>
                            </div>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileInput}
                            accept=".pdf,.stl,.step,.stp,.sldprt,.sldasm,.slddrw,.png,.jpg,.jpeg,.gif,.webp,.dwg,.dxf,.iges,.igs"
                        />
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="flex items-start gap-1.5 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-red-300">{error}</p>
                        <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-auto shrink-0">×</button>
                    </div>
                )}
            </div>

            {/* Viewer modal */}
            {viewerFile && (
                <Suspense fallback={
                    <div className="fixed inset-0 z-[400] bg-black/80 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                    </div>
                }>
                    {viewerFile.type === 'pdf' && (
                        <PdfViewer src={viewerFile.url} onClose={() => setViewerFile(null)} />
                    )}
                    {viewerFile.type === 'stl' && (
                        <StlViewer src={viewerFile.url} onClose={() => setViewerFile(null)} />
                    )}
                    {viewerFile.type === 'image' && (
                        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setViewerFile(null)}>
                            <div className="relative max-w-4xl max-h-[85vh]" onClick={e => e.stopPropagation()}>
                                <img src={viewerFile.url} alt={viewerFile.name} className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain" />
                                <button
                                    onClick={() => setViewerFile(null)}
                                    className="absolute -top-3 -right-3 w-8 h-8 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shadow-lg"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    )}
                </Suspense>
            )}
        </>
    );
}
