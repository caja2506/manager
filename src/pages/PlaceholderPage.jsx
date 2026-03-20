import React from 'react';
import { Sparkles } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';

/**
 * Reusable placeholder page for features under development.
 * Displays phase number, an icon, title, description, and a feature list.
 */
export default function PlaceholderPage({ icon: Icon, title, description, phase, features = [] }) {
    return (
        <div className="flex items-center justify-center min-h-[70vh] animate-in fade-in duration-500">
            <PageHeader title="" showBack={true} />
            <div className="max-w-lg w-full text-center p-8">
                {/* Decorative ring */}
                <div className="relative mx-auto w-28 h-28 mb-8">
                    <div className="absolute inset-0 bg-indigo-500/20 rounded-3xl rotate-6 opacity-60"></div>
                    <div className="absolute inset-0 bg-indigo-500/10 rounded-3xl -rotate-3"></div>
                    <div className="relative w-full h-full bg-slate-900 rounded-3xl border-2 border-indigo-500/30 flex items-center justify-center shadow-lg">
                        <Icon className="w-12 h-12 text-indigo-500" />
                    </div>
                </div>

                {/* Phase badge */}
                {phase && (
                    <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-wider mb-4 border border-indigo-500/30">
                        <Sparkles className="w-3.5 h-3.5" />
                        Fase {phase}
                    </div>
                )}

                {/* Title & Description */}
                <h1 className="font-black text-3xl text-white tracking-tight mb-3">{title}</h1>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">{description}</p>

                {/* Feature Preview */}
                {features.length > 0 && (
                    <div className="bg-slate-900/70 rounded-2xl p-6 border border-slate-800 text-left">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Funcionalidades planificadas</h3>
                        <ul className="space-y-3">
                            {features.map((feature, idx) => (
                                <li key={idx} className="flex items-start gap-3 text-sm">
                                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 border border-indigo-500/30">
                                        <span className="text-[10px] font-black text-indigo-400">{idx + 1}</span>
                                    </div>
                                    <span className="text-slate-300 font-medium">{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Coming Soon indicator */}
                <div className="mt-8 flex items-center justify-center gap-2 text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                    <span className="text-xs font-bold uppercase tracking-wider">Próximamente</span>
                </div>
            </div>
        </div>
    );
}
