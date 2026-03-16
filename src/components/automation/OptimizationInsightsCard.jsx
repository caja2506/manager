import React from 'react';
import { Sparkles } from 'lucide-react';

export default function OptimizationInsightsCard({ insightSummary = '' }) {
    if (!insightSummary) {
        return (
            <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-sm font-semibold text-slate-200">Insights de Optimización</h3>
                </div>
                <p className="text-xs text-slate-500 text-center py-6">Ejecuta un escaneo para generar insights.</p>
            </div>
        );
    }

    // Parse markdown-like formatting
    const lines = insightSummary.split('\n').filter(l => l.trim());

    return (
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-xl p-5 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                <h3 className="text-sm font-semibold text-slate-200">Insights de Optimización</h3>
            </div>

            <div className="space-y-1.5">
                {lines.map((line, i) => {
                    // Bold text
                    const isBold = line.startsWith('**') && line.includes('**');
                    const isListItem = line.startsWith('- ') || line.startsWith('→ ');
                    const cleanLine = line.replace(/\*\*/g, '');

                    if (isBold) {
                        return (
                            <p key={i} className="text-xs text-slate-200 font-semibold mt-2">
                                {cleanLine}
                            </p>
                        );
                    }
                    if (isListItem) {
                        return (
                            <p key={i} className="text-xs text-slate-400 pl-2">
                                {line}
                            </p>
                        );
                    }
                    return (
                        <p key={i} className="text-xs text-slate-300 leading-relaxed">
                            {line}
                        </p>
                    );
                })}
            </div>
        </div>
    );
}
