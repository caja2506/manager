import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source using jsDelivr matching the dependency version
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.5.207/build/pdf.worker.min.mjs';

/**
 * PdfViewer — Embedded PDF viewer using pdfjs-dist.
 * Can render from a URL or a local File object.
 *
 * Props:
 *  - src: string (URL) or File object
 *  - onClose: function
 *  - embedded: boolean — if true, no close button (used in split view)
 */
export default function PdfViewer({ src, onClose, embedded = false }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [pdfDoc, setPdfDoc] = useState(null);
    const [pageNum, setPageNum] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.2);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load PDF document
    useEffect(() => {
        if (!src) return;
        let cancelled = false;
        setLoading(true);
        setError(null);

        async function loadPdf() {
            try {
                let loadingTask;
                if (src instanceof File) {
                    const arrayBuffer = await src.arrayBuffer();
                    loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                } else {
                    // Fetch URL as ArrayBuffer first to avoid CORS issues with pdfjs internal loader
                    const response = await fetch(src);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const arrayBuffer = await response.arrayBuffer();
                    loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                }

                const pdf = await loadingTask.promise;
                if (!cancelled) {
                    setPdfDoc(pdf);
                    setNumPages(pdf.numPages);
                    setPageNum(1);
                }
            } catch (err) {
                console.error('[PdfViewer] Load error:', err);
                if (!cancelled) setError('Error al cargar el PDF: ' + err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadPdf();
        return () => { cancelled = true; };
    }, [src]);

    // Render current page
    const renderPage = useCallback(async () => {
        if (!pdfDoc || !canvasRef.current) return;
        try {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport,
            }).promise;
        } catch (err) {
            console.error('[PdfViewer] Render error:', err);
        }
    }, [pdfDoc, pageNum, scale]);

    useEffect(() => {
        renderPage();
    }, [renderPage]);

    const prevPage = () => setPageNum(p => Math.max(1, p - 1));
    const nextPage = () => setPageNum(p => Math.min(numPages, p + 1));
    const zoomIn = () => setScale(s => Math.min(3, s + 0.3));
    const zoomOut = () => setScale(s => Math.max(0.5, s - 0.3));

    const content = (
        <div className={`flex flex-col h-full ${embedded ? '' : 'bg-slate-900'}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 border-b border-slate-700 shrink-0">
                <div className="flex items-center gap-2">
                    <button onClick={zoomOut} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title="Zoom out">
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-400 font-mono min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
                    <button onClick={zoomIn} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title="Zoom in">
                        <ZoomIn className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={prevPage} disabled={pageNum <= 1} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-300 font-bold min-w-[60px] text-center">
                        {pageNum} / {numPages}
                    </span>
                    <button onClick={nextPage} disabled={pageNum >= numPages} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {!embedded && onClose && (
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Canvas area */}
            <div ref={containerRef} className="flex-1 overflow-auto flex items-start justify-center p-4 bg-slate-950/50">
                {loading && (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    </div>
                )}
                {error && (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}
                {!loading && !error && (
                    <canvas ref={canvasRef} className="shadow-2xl rounded-sm" />
                )}
            </div>
        </div>
    );

    // If embedded, just return the content
    if (embedded) return content;

    // Fullscreen modal wrapper
    return (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-5xl h-[85vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                {content}
            </div>
        </div>
    );
}
