import React, { useState } from 'react';
import { useAppData } from '../../contexts/AppDataContext';
import { useEngineeringData } from '../../hooks/useEngineeringData';
import { useAuth } from '../../contexts/AuthContext';
import { createDelay, createDelayCause, deleteDelayCause } from '../../services/delayService';
import { TASK_STATUS } from '../../models/schemas';
import { AlertOctagon, X, Check, ChevronDown, Plus } from 'lucide-react';
import ListManagerModal from '../ui/ListManagerModal';

export default function DelayReportModal() {
    const {
        isDelayReportOpen, setIsDelayReportOpen,
        delayReportTarget, setDelayReportTarget,
    } = useAppData();
    const { delayCauses, engProjects, engTasks } = useEngineeringData();
    const { user } = useAuth();

    const [selectedCauseId, setSelectedCauseId] = useState('');
    const [comment, setComment] = useState('');
    const [impact, setImpact] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCauseManager, setShowCauseManager] = useState(false);

    if (!isDelayReportOpen || !delayReportTarget) return null;

    const { type, id, projectId: linkedProjectId } = delayReportTarget;
    const projectId = type === 'project' ? id : linkedProjectId;
    const taskId = type === 'task' ? id : null;
    const project = engProjects.find(p => p.id === projectId);
    const task = taskId ? engTasks.find(t => t.id === taskId) : null;
    const activeCauses = delayCauses.filter(c => c.active);

    const handleClose = () => {
        setIsDelayReportOpen(false);
        setDelayReportTarget(null);
        setSelectedCauseId('');
        setComment('');
        setImpact('');
        setShowCauseManager(false);
    };

    const handleSaveCauses = async ({ renames, deleted, added }) => {
        // Delete removed causes
        for (const deletedName of deleted) {
            const cause = delayCauses.find(c => c.name === deletedName);
            if (cause) await deleteDelayCause(cause.id);
        }
        // Add new causes
        for (const name of added) {
            await createDelayCause({ name, description: '', active: true, order: delayCauses.length });
        }
        // Note: renames not fully supported for Firestore docs, but keeps consistency
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedCauseId) return;

        setIsSubmitting(true);
        try {
            const cause = delayCauses.find(c => c.id === selectedCauseId);
            await createDelay({
                projectId, taskId,
                causeId: cause.id, causeName: cause.name,
                comment, impact,
            }, user.uid);
            handleClose();
        } catch (error) {
            console.error("Error creating delay report:", error);
            alert("Hubo un error al reportar el retraso");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
                <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-lg animate-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-rose-100 rounded-2xl flex items-center justify-center">
                                <AlertOctagon className="w-5 h-5 text-rose-600" />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg text-white tracking-tight">Reportar Retraso / Bloqueo</h2>
                                <p className="text-xs text-slate-400">
                                    {type === 'task' ? 'Bloqueando Tarea' : 'Retraso en el Proyecto'}
                                </p>
                            </div>
                        </div>
                        <button onClick={handleClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-800 rounded-xl transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Context Info */}
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-sm">
                            <p className="text-slate-500 mb-1">Proyecto:</p>
                            <p className="font-bold text-white mb-3">{project?.name || 'Desconocido'}</p>
                            {task && (
                                <>
                                    <p className="text-slate-500 mb-1">Tarea a Bloquear:</p>
                                    <p className="font-bold text-white">{task.title}</p>
                                    <p className="text-xs text-rose-600 mt-2 flex items-center gap-1 font-bold">
                                        <AlertOctagon className="w-3 h-3" /> La tarea cambiará su estado a "Bloqueado" automáticamente.
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="space-y-4">
                            {/* Cause Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    ¿Cuál es la causa del retraso? <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        required
                                        value={selectedCauseId}
                                        onChange={(e) => setSelectedCauseId(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    >
                                        <option value="" disabled>Selecciona una causa...</option>
                                        {activeCauses.map(cause => (
                                            <option key={cause.id} value={cause.id}>{cause.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                    </div>
                                </div>
                                {/* Button to open the ListManagerModal popup */}
                                <button
                                    type="button"
                                    onClick={() => setShowCauseManager(true)}
                                    className="mt-2 flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Agregar Nueva Causa
                                </button>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Comentarios Adicionales
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    rows={3}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                                    placeholder="Añade detalles sobre el problema..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Impacto Esperado
                                </label>
                                <input
                                    type="text"
                                    value={impact}
                                    onChange={(e) => setImpact(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    placeholder="Ej: Se retrasa la entrega 2 días"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-800 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={!selectedCauseId || isSubmitting}
                                className="flex items-center gap-2 bg-rose-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/30 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Check className="w-4 h-4" />
                                )}
                                Reportar Retraso
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* ListManagerModal popup — opens on top of the delay report modal */}
            {showCauseManager && (
                <div style={{ zIndex: 500 }} className="relative">
                    <ListManagerModal
                        title="Gestionar Causas de Retraso"
                        items={activeCauses.map(c => c.name)}
                        onSave={handleSaveCauses}
                        onClose={() => setShowCauseManager(false)}
                    />
                </div>
            )}
        </>
    );
}
