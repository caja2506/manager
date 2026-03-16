import React from 'react';
import { Radio, Wifi, WifiOff, MessageSquare } from 'lucide-react';
import { AUTOMATION_CHANNELS } from '../../automation/constants.js';

/**
 * Channel configuration with display info.
 */
const CHANNEL_CONFIG = {
    [AUTOMATION_CHANNELS.TELEGRAM]: {
        label: 'Telegram',
        icon: MessageSquare,
        color: 'text-sky-400',
        bgColor: 'bg-sky-400/10',
        borderColor: 'border-sky-400/30',
    },
    [AUTOMATION_CHANNELS.EMAIL]: {
        label: 'Email',
        icon: Radio,
        color: 'text-orange-400',
        bgColor: 'bg-orange-400/10',
        borderColor: 'border-orange-400/30',
    },
    [AUTOMATION_CHANNELS.SLACK]: {
        label: 'Slack',
        icon: Radio,
        color: 'text-purple-400',
        bgColor: 'bg-purple-400/10',
        borderColor: 'border-purple-400/30',
    },
    [AUTOMATION_CHANNELS.WHATSAPP]: {
        label: 'WhatsApp',
        icon: Radio,
        color: 'text-green-400',
        bgColor: 'bg-green-400/10',
        borderColor: 'border-green-400/30',
    },
};

/**
 * ChannelHealthCard
 * 
 * Shows registered channels/providers with their current status.
 */
export default function ChannelHealthCard({ coreConfig, telegramConfig }) {
    const channels = [
        {
            key: AUTOMATION_CHANNELS.TELEGRAM,
            enabled: telegramConfig?.enabled ?? false,
            lastActivity: telegramConfig?.updatedAt ?? null,
            debugMode: telegramConfig?.debugMode ?? false,
            dryRun: telegramConfig?.dryRun ?? true,
        },
        // Future channels will be added here
    ];

    return (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">
                Canales / Proveedores
            </h3>

            <div className="space-y-3">
                {channels.map(channel => {
                    const config = CHANNEL_CONFIG[channel.key] || CHANNEL_CONFIG[AUTOMATION_CHANNELS.TELEGRAM];
                    const Icon = config.icon;
                    const isOnline = channel.enabled && (coreConfig?.enabled ?? false);

                    return (
                        <div
                            key={channel.key}
                            className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${isOnline
                                    ? `bg-slate-900/50 ${config.borderColor}`
                                    : 'bg-slate-900/30 border-slate-700/30'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center`}>
                                    <Icon className={`w-5 h-5 ${config.color}`} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">{config.label}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {isOnline ? (
                                            <Wifi className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                            <WifiOff className="w-3 h-3 text-slate-500" />
                                        )}
                                        <span className={`text-[10px] font-bold uppercase ${isOnline ? 'text-emerald-400' : 'text-slate-500'
                                            }`}>
                                            {isOnline ? 'Activo' : 'Inactivo'}
                                        </span>

                                        {channel.debugMode && (
                                            <span className="text-[9px] font-bold text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
                                                DEBUG
                                            </span>
                                        )}
                                        {channel.dryRun && (
                                            <span className="text-[9px] font-bold text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded">
                                                DRY-RUN
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Status dot */}
                            <div className={`w-3 h-3 rounded-full ${isOnline
                                    ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse'
                                    : 'bg-slate-600'
                                }`} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
