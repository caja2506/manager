import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion, ShieldOff } from 'lucide-react';
import { PR_STATUS_CONFIG } from '../../../services/peerReviewService';

export default function PeerReviewBadge({ status, required = false, className = '' }) {
    if (!required || status === 'not_required') return null;

    const config = PR_STATUS_CONFIG[status] || PR_STATUS_CONFIG.not_required;
    
    // Determine visual style based on status
    let styleClass = 'bg-slate-800 text-slate-400 border-slate-700'; // default
    let Icon = Shield;
    
    switch (status) {
        case 'requested':
            styleClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
            Icon = ShieldQuestion;
            break;
        case 'in_review':
            styleClass = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
            Icon = Shield;
            break;
        case 'approved':
            styleClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
            Icon = ShieldCheck;
            break;
        case 'changes_requested':
            styleClass = 'bg-red-500/10 text-red-400 border-red-500/30';
            Icon = ShieldAlert;
            break;
        case 'waived':
            styleClass = 'bg-slate-500/10 text-slate-400 border-slate-500/30';
            Icon = ShieldOff;
            break;
    }

    return (
        <span 
            className={`h-6 inline-flex items-center gap-1 px-2.5 rounded-full text-[10px] font-semibold border ${styleClass} ${className}`}
            title={`Peer Review: ${config.label}`}
        >
            <Icon className="w-3 h-3 shrink-0" />
            <span className="hidden sm:inline">{config.label}</span>
            <span className="sm:hidden">PR</span>
        </span>
    );
}
