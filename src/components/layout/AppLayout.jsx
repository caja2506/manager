import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { useAppData } from '../../contexts/AppDataContext';
import {
    Activity, X
} from 'lucide-react';

// Shared modals & overlays
import ListManagerModal from '../ui/ListManagerModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import MasterRecordModal from '../catalog/MasterRecordModal';
import PdfReviewModal from '../projects/PdfReviewModal';
import ImagePickerModal from '../catalog/ImagePickerModal';
import DelayReportModal from '../delays/DelayReportModal';

export default function AppLayout() {
    const {
        // Processing
        isProcessing, setIsProcessing,
        processingStatus,
        isDiagnosticOpen, setIsDiagnosticOpen,
        lastError,

        // Modals
        confirmDelete, setConfirmDelete,
        listManager, setListManager,
        isMasterRecordModalOpen, setIsMasterRecordModalOpen,
        editingMasterRecord,
        imagePickerItem, setImagePickerItem,
        zoomedImageUrl, setZoomedImageUrl,
        isPdfReviewOpen, setIsPdfReviewOpen,
        pdfReviewData, setPdfReviewData,
        pdfSupplierAnalysis, setPdfSupplierAnalysis,

        // Handlers
        handleSaveManagedList,
        saveMasterRecord,
        handleConfirmImport,
        handleImageSelect,

        // Data
        managedLists,
        taskTypes,
        catalogo,
    } = useAppData();

    return (
        <div className="h-screen flex flex-col md:flex-row font-sans overflow-hidden" style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}>

            {/* ===== PROCESSING PANEL ===== */}
            {(isDiagnosticOpen || isProcessing) && (
                <div className="fixed top-4 right-4 z-[500] w-full max-w-sm animate-in slide-in-from-right duration-300">
                    <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-5 border border-slate-700">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                            <div className="flex items-center text-xs font-black text-indigo-400 uppercase tracking-tighter"><Activity className="w-4 h-4 mr-2" /> Panel de Procesamiento</div>
                            <button onClick={() => { setIsDiagnosticOpen(false); setIsProcessing(false); }} className="text-slate-400 hover:text-white bg-slate-800 p-1 rounded"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400 font-bold">Estado:</span>
                                <span className={`font-mono font-bold ${isProcessing && processingStatus !== '❌ ERROR' ? 'text-yellow-400 animate-pulse' : 'text-green-400'}`}>{processingStatus || "Listo"}</span>
                            </div>
                            {lastError && (
                                <div className="bg-red-950/50 border border-red-500/50 p-3 rounded-xl text-xs text-red-200 font-mono break-words">
                                    <span className="text-red-400 font-black block mb-1 uppercase">Error Exacto:</span>
                                    {lastError}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== SHARED MODALS ===== */}
            {listManager.isOpen && (
                <ListManagerModal
                    title={listManager.title}
                    items={
                        listManager.type === 'taskType'
                            ? (taskTypes || []).map(t => t.name)
                            : managedLists[listManager.type === 'category' ? 'categories' : listManager.type + 's']?.map(i => i.name) || []
                    }
                    onClose={() => setListManager({ isOpen: false, type: null, title: '' })}
                    onSave={(data) => handleSaveManagedList({ type: listManager.type, data })}
                />
            )}

            <MasterRecordModal
                isOpen={isMasterRecordModalOpen}
                onClose={() => setIsMasterRecordModalOpen(false)}
                onSave={saveMasterRecord}
                initialData={editingMasterRecord}
                managedLists={managedLists}
                onOpenManager={(type) => setListManager({ isOpen: true, type, title: `Gestionar ${type === 'brand' ? 'Marcas' : type === 'category' ? 'Categorías' : 'Proveedores'}` })}
            />

            <PdfReviewModal
                isOpen={isPdfReviewOpen}
                onClose={() => { setIsPdfReviewOpen(false); setPdfReviewData(null); setPdfSupplierAnalysis(null); }}
                onConfirm={(reviewedData) => handleConfirmImport(reviewedData, window.__activeProject__)}
                extractedData={pdfReviewData}
                supplierAnalysis={pdfSupplierAnalysis}
            />

            <ConfirmDialog
                isOpen={confirmDelete.isOpen}
                title={confirmDelete.title}
                message={confirmDelete.message}
                onConfirm={confirmDelete.onConfirm}
                onClose={() => setConfirmDelete({ isOpen: false, onConfirm: null })}
            />

            <ImagePickerModal
                isOpen={!!imagePickerItem}
                onClose={() => setImagePickerItem(null)}
                onSelect={handleImageSelect}
                itemName={imagePickerItem?.name}
                partNumber={imagePickerItem?.partNumber}
            />

            {/* ===== DELAY REPORT MODAL ===== */}
            <DelayReportModal />

            {/* ===== IMAGE LIGHTBOX ===== */}
            {zoomedImageUrl && (
                <div
                    className="fixed inset-0 z-[700] flex items-center justify-center bg-black/80 backdrop-blur-md cursor-zoom-out animate-in fade-in duration-200 p-6"
                    onClick={() => setZoomedImageUrl(null)}
                >
                    <button
                        onClick={() => setZoomedImageUrl(null)}
                        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img
                        src={zoomedImageUrl}
                        alt="Imagen ampliada"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* ===== SIDEBAR (Desktop) ===== */}
            <Sidebar />

            {/* ===== MOBILE NAV ===== */}
            <MobileNav />

            {/* ===== MAIN CONTENT — React Router Outlet ===== */}
            <main className="flex-1 overflow-y-auto pb-20 md:pb-4 p-4 md:p-8" style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
                <Outlet />
            </main>
        </div>
    );
}
