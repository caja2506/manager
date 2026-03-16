import React from 'react';
import {
    Send, MessageCircle, ArrowUpRight, AlertOctagon,
    Mic, FileText, XCircle, Activity
} from 'lucide-react';

/**
 * MetricsSummaryCard
 * 
 * Displays today's daily automation metrics summary.
 */
export default function MetricsSummaryCard({ metrics }) {
    const items = [
        {
            label: 'Mensajes Enviados',
            value: metrics?.messagesSent ?? 0,
            icon: Send,
            color: 'text-blue-400',
            bgColor: 'bg-blue-400/10',
        },
        {
            label: 'Respuestas Recibidas',
            value: metrics?.responsesReceived ?? 0,
            icon: MessageCircle,
            color: 'text-emerald-400',
            bgColor: 'bg-emerald-400/10',
        },
        {
            label: 'Respuestas a Tiempo',
            value: metrics?.responsesOnTime ?? 0,
            icon: Activity,
            color: 'text-green-400',
            bgColor: 'bg-green-400/10',
        },
        {
            label: 'Respuestas Tarde',
            value: metrics?.responsesLate ?? 0,
            icon: ArrowUpRight,
            color: 'text-amber-400',
            bgColor: 'bg-amber-400/10',
        },
        {
            label: 'Escalaciones',
            value: metrics?.escalationsTriggered ?? 0,
            icon: AlertOctagon,
            color: 'text-red-400',
            bgColor: 'bg-red-400/10',
        },
        {
            label: 'Incidentes Abiertos',
            value: metrics?.incidentsOpened ?? 0,
            icon: XCircle,
            color: 'text-orange-400',
            bgColor: 'bg-orange-400/10',
        },
        {
            label: 'Reportes Texto',
            value: metrics?.textReportsCount ?? 0,
            icon: FileText,
            color: 'text-indigo-400',
            bgColor: 'bg-indigo-400/10',
        },
        {
            label: 'Reportes Audio',
            value: metrics?.audioReportsCount ?? 0,
            icon: Mic,
            color: 'text-purple-400',
            bgColor: 'bg-purple-400/10',
        },
    ];

    return (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">
                Métricas del Día
            </h3>

            {!metrics ? (
                <p className="text-sm text-slate-500 italic">Sin datos para hoy.</p>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {items.map(item => {
                        const Icon = item.icon;
                        return (
                            <div
                                key={item.label}
                                className="flex flex-col items-center p-3 bg-slate-900/40 rounded-xl border border-slate-700/20"
                            >
                                <div className={`w-8 h-8 rounded-lg ${item.bgColor} flex items-center justify-center mb-2`}>
                                    <Icon className={`w-4 h-4 ${item.color}`} />
                                </div>
                                <span className="text-xl font-black text-white">{item.value}</span>
                                <span className="text-[10px] text-slate-500 text-center mt-0.5 leading-tight">
                                    {item.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
