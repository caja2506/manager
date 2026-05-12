import React, { useState } from 'react';
import { X, ShieldQuestion, User, AlertCircle } from 'lucide-react';

export default function PeerReviewRequestModal({ isOpen, onClose, task, teamMembers, onRequestReview }) {
    const [selectedReviewer, setSelectedReviewer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen || !task) return null;

    // Filter out the task assignee because you shouldn't review your own task
    const availableReviewers = teamMembers.filter(m => m.uid !== task.assignedTo);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedReviewer) {
            setError('Debes seleccionar un revisor.');
            return;
        }
        
        setIsSubmitting(true);
        setError(null);
        try {
            await onRequestReview(task.id, selectedReviewer);
            setSelectedReviewer('');
            onClose();
        } catch (err) {
            setError(err.message || 'Error al solicitar revisión.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-400">
                        <ShieldQuestion className="w-5 h-5" />
                        <h3 className="font-black tracking-wide text-sm">Solicitar Peer Review</h3>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                        disabled={isSubmitting}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/50">
                        <p className="text-xs text-slate-300 leading-relaxed">
                            La tarea <span className="text-white font-bold">{task.title}</span> requiere validación técnica antes de poder completarse. Selecciona al ingeniero que realizará la revisión.
                        </p>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                            Revisor asignado
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <select
                                value={selectedReviewer}
                                onChange={(e) => setSelectedReviewer(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                                disabled={isSubmitting}
                            >
                                <option value="">-- Seleccionar Revisor --</option>
                                {availableReviewers.map(m => (
                                    <option key={m.uid} value={m.uid}>
                                        {m.displayName || m.email}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-300">{error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!selectedReviewer || isSubmitting}
                            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-lg ${
                                !selectedReviewer || isSubmitting 
                                ? 'bg-indigo-600/50 text-white/50 cursor-not-allowed border border-transparent'
                                : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-indigo-500/25 border border-indigo-500'
                            }`}
                        >
                            {isSubmitting ? 'Enviando...' : 'Solicitar Revisión'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
