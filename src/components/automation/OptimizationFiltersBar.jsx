import React from 'react';
import { ScanSearch, Loader2 } from 'lucide-react';

export default function OptimizationFiltersBar({ onScan, scanning = false }) {
    return (
        <div className="flex items-center justify-between bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-700/40">
            <div className="flex items-center gap-2">
                <ScanSearch className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-slate-400">Optimization Engine</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">Fase 5</span>
            </div>

            <button
                onClick={onScan}
                disabled={scanning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 text-white text-xs font-medium rounded-lg transition-colors"
            >
                {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanSearch className="w-3 h-3" />}
                {scanning ? 'Escaneando...' : 'Ejecutar Escaneo'}
            </button>
        </div>
    );
}
