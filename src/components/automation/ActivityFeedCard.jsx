import React from 'react';
import { Activity, Send, ArrowDown, ArrowUp, AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react';

/**
 * ActivityFeedCard — Recent activity combining runs and deliveries.
 *
 * @param {Object} props
 * @param {Array} props.recentRuns - Recent automationRuns docs
 * @param {Array} props.recentDeliveries - Recent telegramDeliveries docs
 */
export default function ActivityFeedCard({ recentRuns = [], recentDeliveries = [] }) {
    // Merge and sort by timestamp (most recent first)
    const runItems = recentRuns.map(r => ({
        type: 'run',
        id: r.id,
        key: r.routineKey,
        status: r.status,
        sentCount: r.sentCount || 0,
        dryRun: r.dryRun || false,
        timestamp: r.startedAt || r.createdAt,
        triggerType: r.triggerType,
    }));

    const deliveryItems = recentDeliveries.map(d => ({
        type: 'delivery',
        id: d.id,
        direction: d.direction,
        status: d.deliveryStatus,
        routineKey: d.routineKey,
        dryRun: d.dryRun || false,
        timestamp: d.sentAt || d.createdAt,
        messagePreview: d.messageText?.substring(0, 80),
    }));

    const allItems = [...runItems, ...deliveryItems]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 25);

    const getStatusIcon = (item) => {
        if (item.type === 'run') {
            switch (item.status) {
                case 'success': return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
                case 'failed': return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
                case 'partial': return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
                case 'running': return <Clock className="w-3.5 h-3.5 text-blue-400 animate-pulse" />;
                default: return <Clock className="w-3.5 h-3.5 text-slate-400" />;
            }
        }
        if (item.type === 'delivery') {
            if (item.direction === 'inbound') return <ArrowDown className="w-3.5 h-3.5 text-blue-400" />;
            switch (item.status) {
                case 'delivered': return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
                case 'responded': return <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />;
                case 'failed': return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
                default: return <ArrowUp className="w-3.5 h-3.5 text-slate-400" />;
            }
        }
        return <Activity className="w-3.5 h-3.5 text-slate-400" />;
    };

    const formatTime = (ts) => {
        if (!ts) return '—';
        try {
            const d = new Date(ts);
            return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        } catch { return '—'; }
    };

    const getLabel = (item) => {
        if (item.type === 'run') {
            const trigger = item.triggerType === 'manual' ? '🔧' : '⏰';
            return `${trigger} ${item.key || 'rutina'} → ${item.sentCount} env.`;
        }
        if (item.type === 'delivery') {
            const dir = item.direction === 'inbound' ? '📥' : '📤';
            return `${dir} ${item.routineKey || 'mensaje'}`;
        }
        return 'actividad';
    };

    return (
        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-bold text-white">Actividad Reciente</h4>
                <span className="text-xs text-slate-500 ml-auto">{allItems.length} eventos</span>
            </div>

            {allItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No hay actividad reciente</p>
                    <p className="text-xs mt-1">Las ejecuciones y envíos aparecerán aquí</p>
                </div>
            ) : (
                <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                    {allItems.map((item) => (
                        <div
                            key={`${item.type}-${item.id}`}
                            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-700/20 transition-colors"
                        >
                            {getStatusIcon(item)}
                            <span className="text-xs text-slate-300 flex-1 truncate">
                                {getLabel(item)}
                            </span>
                            {item.dryRun && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 font-medium">
                                    DRY
                                </span>
                            )}
                            <span className="text-xs text-slate-500 tabular-nums">
                                {formatTime(item.timestamp)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
