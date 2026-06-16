import React, { useState, useEffect } from 'react';
import { Search, X, Loader2, Check, ExternalLink, AlertTriangle, Camera, Globe, Image } from 'lucide-react';
import { functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';

// ========================================================
// MODAL: BUSCADOR DE IMÁGENES (Dual mode)
// ========================================================
const searchImagesFn = httpsCallable(functions, 'searchImages');

const ImagePickerModal = ({ isOpen, onClose, onSelect, itemName, partNumber }) => {
    const [mode, setMode] = useState('search'); // 'search' | 'url'
    const [searchQuery, setSearchQuery] = useState('');
    const [images, setImages] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedUrl, setSelectedUrl] = useState(null);
    const [selectedThumbnail, setSelectedThumbnail] = useState(null);
    const [testedUrl, setTestedUrl] = useState(null); // The URL that actually loads
    const [customUrl, setCustomUrl] = useState('');
    const [previewError, setPreviewError] = useState(false);
    const [error, setError] = useState(null);

    const defaultQuery = [partNumber, itemName?.split(' ').slice(0, 4).join(' ')].filter(Boolean).join(' ');

    useEffect(() => {
        if (isOpen) {
            setSearchQuery(defaultQuery);
            setImages([]);
            setSelectedUrl(null);
            setSelectedThumbnail(null);
            setTestedUrl(null);
            setCustomUrl('');
            setPreviewError(false);
            setError(null);
            setMode('search');
            // Auto-search on open
            if (defaultQuery.trim()) doSearch(defaultQuery);
        }
    }, [isOpen, partNumber, itemName]);

    const doSearch = async (q) => {
        const query = q || searchQuery;
        if (!query.trim()) return;
        setIsSearching(true);
        setError(null);
        setImages([]);

        try {
            const result = await searchImagesFn({ query });
            const imageResults = result.data.images || [];

            if (imageResults.length > 0) {
                setImages(imageResults);
            } else {
                setError('No se encontraron imágenes. Intenta con otros términos o usa "Pegar URL".');
            }
        } catch (err) {
            console.error('Image search error:', err);
            const errMsg = err.message || '';
            if (errMsg.includes('access to Custom Search') || errMsg.includes('PERMISSION_DENIED')) {
                setError('La "Custom Search API" no está habilitada en Google Cloud Console para esta API Key. Actívala en tu consola de Google Cloud para habilitar la búsqueda automática.');
            } else if (errMsg.includes('quota') || errMsg.includes('limit') || errMsg.includes('exhausted')) {
                setError('Se ha agotado el límite de búsquedas gratuitas de Google Custom Search por hoy (límite de 100 consultas diarias).');
            } else if (errMsg.includes('API key not valid')) {
                setError('La API Key configurada para Google Custom Search no es válida.');
            } else {
                setError(errMsg || 'Error al realizar la búsqueda de imágenes. Intenta de nuevo más tarde o usa "Pegar URL".');
            }
        }
        setIsSearching(false);
    };

    const openGoogleImages = () => {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery + ' product')}&tbm=isch`, '_blank');
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
                setCustomUrl(text);
                setPreviewError(false);
            }
        } catch (err) { /* Clipboard API may not be available */ }
    };

    // Test if the full-res image URL loads; fall back to thumbnail if blocked
    const handleSelectImage = (img) => {
        setSelectedUrl(img.url);
        setSelectedThumbnail(img.thumbnail);
        setTestedUrl(null); // reset while testing
        
        // Test if the full-res URL loads
        const testImg = new window.Image();
        testImg.referrerPolicy = 'no-referrer';
        testImg.onload = () => setTestedUrl(img.url);
        testImg.onerror = () => {
            console.warn('Full-res image blocked, using thumbnail:', img.url);
            setTestedUrl(img.thumbnail);
        };
        testImg.src = img.url;
    };

    const handleConfirmWithUrl = (url) => {
        if (url) {
            onSelect(url);
            onClose();
        }
    };

    const handleConfirm = () => {
        if (mode === 'url') {
            handleConfirmWithUrl(customUrl);
        } else {
            // Use the tested URL (full-res if it loaded, thumbnail otherwise)
            handleConfirmWithUrl(testedUrl || selectedUrl);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="p-6 border-b border-slate-800">
                    <div className="flex justify-between items-center mb-1">
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                            <Camera className="w-6 h-6 text-indigo-400" /> Imagen del Producto
                        </h2>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-800 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 font-bold truncate">{partNumber} — {itemName?.substring(0, 60)}</p>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-800 p-1 rounded-xl mt-4">
                        <button onClick={() => setMode('search')} className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${mode === 'search' ? 'bg-slate-900 text-slate-100 shadow-sm' : 'text-slate-500'}`}>
                            <Search className="w-3.5 h-3.5" /> Buscar
                        </button>
                        <button onClick={() => setMode('url')} className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${mode === 'url' ? 'bg-slate-900 text-slate-100 shadow-sm' : 'text-slate-500'}`}>
                            <ExternalLink className="w-3.5 h-3.5" /> Pegar URL
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {mode === 'search' ? (
                        <div className="space-y-4">
                            {/* Search bar */}
                            <form onSubmit={e => { e.preventDefault(); doSearch(); }} className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Buscar imagen..."
                                        className="pl-10 pr-4 py-3 w-full border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-white placeholder-slate-500"
                                    />
                                </div>
                                <button type="submit" disabled={isSearching} className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:bg-slate-300 transition-all flex items-center">
                                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                </button>
                            </form>

                            {/* Error with fallback */}
                            {error && (
                                <div className="bg-amber-500/15 border border-amber-200 p-4 rounded-xl text-sm text-amber-400 space-y-3">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={openGoogleImages}
                                        className="w-full bg-slate-900 border border-amber-500/50 text-amber-400 px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-amber-500 hover:text-slate-950 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Globe className="w-4 h-4" /> Abrir Google Images
                                    </button>
                                    <p className="text-[11px] text-amber-500">Click derecho en imagen → <strong>"Copiar dirección de imagen"</strong> → Usa pestaña "Pegar URL"</p>
                                </div>
                            )}

                            {/* Loading */}
                            {isSearching && (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <Loader2 className="w-10 h-10 animate-spin mb-3" />
                                    <span className="text-sm font-bold">Buscando imágenes...</span>
                                </div>
                            )}

                            {/* Results Grid */}
                            {!isSearching && images.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {images.map((img, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex flex-col bg-slate-800/40 rounded-2xl p-2.5 border transition-all ${selectedUrl === img.url ? 'border-indigo-500 ring-2 ring-indigo-500/10 bg-slate-800/80' : 'border-slate-800/80 hover:border-slate-700'}`}
                                        >
                                            {/* Clickable Image Container */}
                                            <button
                                                type="button"
                                                onClick={() => handleSelectImage(img)}
                                                onDoubleClick={() => handleConfirmWithUrl(img.url)}
                                                className={`relative w-full aspect-square rounded-xl overflow-hidden border-2 bg-white transition-all flex items-center justify-center cursor-pointer ${selectedUrl === img.url ? 'border-indigo-500' : 'border-slate-200 hover:border-indigo-300'}`}
                                            >
                                                <img
                                                    src={img.thumbnail}
                                                    alt={img.title}
                                                    referrerPolicy="no-referrer"
                                                    className="w-full h-full object-contain p-1.5"
                                                    loading="lazy"
                                                    onError={e => { e.target.src = ''; e.target.alt = '⚠️'; }}
                                                />
                                                {selectedUrl === img.url && (
                                                    <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center">
                                                        <div className="bg-indigo-600 text-white p-2 rounded-full shadow-lg">
                                                            <Check className="w-4 h-4" />
                                                        </div>
                                                    </div>
                                                )}
                                            </button>
                                            
                                            {/* Details Section */}
                                            <div className="mt-2.5 flex flex-col flex-1 min-h-[64px] justify-between">
                                                {/* Description */}
                                                <p 
                                                    className="text-[11px] text-slate-300 font-bold leading-normal line-clamp-2 hover:text-white transition-colors"
                                                    title={img.title}
                                                >
                                                    {img.title}
                                                </p>
                                                
                                                {/* Meta Info & Link */}
                                                <div className="mt-2 pt-2 border-t border-slate-800/50 flex items-center text-[10px] min-w-0">
                                                    <a 
                                                        href={img.pageUrl || img.url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-indigo-400 hover:text-indigo-300 font-bold inline-flex items-center gap-1 hover:underline truncate w-full"
                                                        onClick={(e) => e.stopPropagation()}
                                                        title={img.source || 'Ver página original'}
                                                    >
                                                        <span className="truncate uppercase tracking-tighter flex-1">
                                                            {img.source || 'Ver página'}
                                                        </span>
                                                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* URL fallback indicator */}
                            {selectedUrl && testedUrl && testedUrl !== selectedUrl && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span className="text-amber-300">La imagen original está bloqueada por el servidor. Se guardará la versión en caché de Google.</span>
                                </div>
                            )}

                            {/* Empty state */}
                            {!isSearching && images.length === 0 && !error && (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                                    <Image className="w-16 h-16 mb-3" />
                                    <span className="text-sm font-bold">Busca una imagen del producto</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* URL Paste mode */
                        <div className="space-y-5">
                            <div>
                                <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">① Buscar imagen</div>
                                <button
                                    type="button"
                                    onClick={openGoogleImages}
                                    className="w-full bg-slate-900/70 border border-slate-700 hover:border-indigo-500 hover:bg-indigo-950/30 text-slate-200 px-4 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
                                >
                                    <Globe className="w-5 h-5 text-indigo-400" /> Abrir Google Images
                                </button>
                                <p className="text-[11px] text-slate-400 mt-2">Click derecho en imagen → <strong>"Copiar dirección de imagen"</strong></p>
                            </div>

                            <div>
                                <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">② Pegar URL</div>
                                <div className="flex gap-2">
                                    <input
                                        value={customUrl}
                                        onChange={e => { setCustomUrl(e.target.value); setPreviewError(false); }}
                                        placeholder="https://ejemplo.com/imagen.jpg"
                                        className="flex-1 px-4 py-3 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono bg-slate-800 text-white placeholder-slate-500"
                                    />
                                    <button onClick={handlePaste} className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-sm transition-colors">
                                        📋 Pegar
                                    </button>
                                </div>
                            </div>

                            {customUrl && (
                                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">③ Vista previa</div>
                                    {previewError ? (
                                        <div className="flex items-center gap-2 text-red-500 text-sm">
                                            <AlertTriangle className="w-4 h-4" /> No se pudo cargar. Verifica la URL.
                                        </div>
                                    ) : (
                                        <div className="flex justify-center">
                                            <img src={customUrl} alt="Preview" referrerPolicy="no-referrer" className="max-h-48 max-w-full rounded-xl object-contain shadow-md" onError={() => setPreviewError(true)} onLoad={() => setPreviewError(false)} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm">
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={mode === 'search' ? !selectedUrl : (!customUrl || previewError)}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-lg disabled:opacity-40 disabled:shadow-none transition-all active:scale-95 flex items-center text-sm"
                    >
                        <Check className="w-4 h-4 mr-2" /> Guardar imagen
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImagePickerModal;
