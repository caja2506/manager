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
    const [customUrl, setCustomUrl] = useState('');
    const [previewError, setPreviewError] = useState(false);
    const [error, setError] = useState(null);

    const defaultQuery = [partNumber, itemName?.split(' ').slice(0, 4).join(' ')].filter(Boolean).join(' ');

    useEffect(() => {
        if (isOpen) {
            setSearchQuery(defaultQuery);
            setImages([]);
            setSelectedUrl(null);
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
            setError(`La búsqueda automática no está disponible aún. Usa "Pegar URL" o "Google Images" para buscar manualmente.`);
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

    const handleConfirm = () => {
        const url = mode === 'url' ? customUrl : selectedUrl;
        if (url) {
            onSelect(url);
            onClose();
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
                                        className="pl-10 pr-4 py-3 w-full border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
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
                                        onClick={openGoogleImages}
                                        className="w-full bg-slate-900 border border-amber-300 text-amber-800 px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
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
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {images.map((img, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedUrl(img.url)}
                                            className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square group ${selectedUrl === img.url ? 'border-indigo-600 ring-2 ring-indigo-200 scale-[1.02]' : 'border-slate-700 hover:border-indigo-300'}`}
                                        >
                                            <img
                                                src={img.thumbnail}
                                                alt={img.title}
                                                className="w-full h-full object-contain p-1"
                                                loading="lazy"
                                                onError={e => { e.target.src = ''; e.target.alt = '⚠️'; }}
                                            />
                                            {selectedUrl === img.url && (
                                                <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center">
                                                    <div className="bg-indigo-600 text-white p-2 rounded-full shadow-lg">
                                                        <Check className="w-5 h-5" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-[10px] text-white font-bold truncate block">{img.source}</span>
                                            </div>
                                        </button>
                                    ))}
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
                                    onClick={openGoogleImages}
                                    className="w-full bg-slate-900/70 border border-slate-700 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 px-4 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
                                >
                                    <Globe className="w-5 h-5 text-indigo-500" /> Abrir Google Images
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
                                        className="flex-1 px-4 py-3 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                                    />
                                    <button onClick={handlePaste} className="px-4 py-3 bg-slate-800 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-colors">
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
                                            <img src={customUrl} alt="Preview" className="max-h-48 max-w-full rounded-xl object-contain shadow-md" onError={() => setPreviewError(true)} onLoad={() => setPreviewError(false)} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-800 transition-colors text-sm">
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
