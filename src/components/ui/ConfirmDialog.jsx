import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';

// ========================================================
// COMPONENTE: DIÁLOGO DE CONFIRMACIÓN
// ========================================================
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-sm p-6 text-center animate-in zoom-in duration-200">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle className="w-8 h-8" /></div>
                <h2 className="font-black text-xl mb-2">{title}</h2>
                <p className="text-slate-500 mb-6">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 p-3.5 bg-slate-800 text-slate-600 rounded-xl font-bold">Cancelar</button>
                    <button onClick={() => { onConfirm(); onClose(); }} className="flex-1 p-3.5 bg-red-500 text-white rounded-xl font-black">Confirmar</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
