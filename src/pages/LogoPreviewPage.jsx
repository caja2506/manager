import React, { useState } from 'react';
import { LogoNeuralNexus, LogoDataOrbit, LogoPulseGraph } from '../components/brand/LogoProposals';

/**
 * Temporary page to preview the 3 logo proposals.
 * Access via: http://localhost:5173/logo-preview
 */
export default function LogoPreviewPage() {
    const [selected, setSelected] = useState(null);

    const proposals = [
        {
            id: 'neural',
            name: 'Neural Nexus',
            desc: 'Red molecular con nodos orgánicos interconectados. Los nodos pulsan y partículas fluyen al hacer hover.',
            concept: 'Conectividad • Inteligencia • Datos',
            Component: LogoNeuralNexus,
        },
        {
            id: 'orbit',
            name: 'Data Orbit',
            desc: 'Núcleo central con nodos de datos orbitando. Las órbitas aceleran y el centro pulsa al hacer hover.',
            concept: 'Operaciones • Flujo • Centralización',
            Component: LogoDataOrbit,
        },
        {
            id: 'pulse',
            name: 'Pulse Graph',
            desc: 'Barras de analytics que crecen con una línea de pulso tipo heartbeat. Todo cobra vida al hacer hover.',
            concept: 'Métricas • Control • Monitoreo',
            Component: LogoPulseGraph,
        },
    ];

    return (
        <div className="min-h-screen p-8" style={{ background: 'linear-gradient(135deg, #0c0a1a 0%, #1a1035 35%, #0f172a 70%, #0c0a1a 100%)' }}>
            {/* Noise overlay */}
            <div className="fixed inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
            />

            <div className="relative z-10 max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: '#C4956A' }}>
                        Branding Proposals
                    </p>
                    <h1 className="text-4xl font-black tracking-tight mb-2" style={{
                        background: 'linear-gradient(135deg, #ffffff, #C4956A)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        Logo Interactivo para AnalyzeOps
                    </h1>
                    <p className="text-slate-400 text-sm max-w-lg mx-auto">
                        Pasa el mouse sobre cada logo para ver las animaciones interactivas.
                        Haz click para seleccionar tu favorito.
                    </p>
                </div>

                {/* Proposals Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    {proposals.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setSelected(p.id)}
                            className="group rounded-2xl border p-8 text-left transition-all duration-300"
                            style={{
                                background: selected === p.id ? 'rgba(91,45,142,0.15)' : 'rgba(15,12,30,0.6)',
                                borderColor: selected === p.id ? '#5B2D8E' : 'rgba(107,63,160,0.2)',
                                boxShadow: selected === p.id ? '0 0 30px rgba(91,45,142,0.2), inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                                transform: selected === p.id ? 'scale(1.02)' : undefined,
                            }}
                        >
                            {/* Logo */}
                            <div className="flex justify-center mb-6 h-32 items-center">
                                <p.Component size={120} interactive />
                            </div>

                            {/* Name */}
                            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                                {selected === p.id && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
                                {p.name}
                            </h2>

                            {/* Concept tags */}
                            <p className="text-[11px] font-bold tracking-wider uppercase mb-3" style={{ color: '#00CFFF' }}>
                                {p.concept}
                            </p>

                            {/* Description */}
                            <p className="text-xs text-slate-400 leading-relaxed">
                                {p.desc}
                            </p>
                        </button>
                    ))}
                </div>

                {/* Selected Preview */}
                {selected && (
                    <div className="text-center">
                        <div className="inline-flex flex-col items-center rounded-2xl border p-10" style={{
                            background: 'rgba(15,12,30,0.8)',
                            borderColor: 'rgba(107,63,160,0.3)',
                        }}>
                            <div className="mb-6">
                                {selected === 'neural' && <LogoNeuralNexus size={150} interactive />}
                                {selected === 'orbit' && <LogoDataOrbit size={150} interactive />}
                                {selected === 'pulse' && <LogoPulseGraph size={150} interactive />}
                            </div>
                            <h2 className="text-3xl font-black tracking-tight" style={{
                                background: 'linear-gradient(135deg, #ffffff 0%, #C4956A 60%, #00CFFF 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}>
                                Analyze<span style={{
                                    WebkitTextFillColor: 'transparent',
                                    background: 'linear-gradient(135deg, #00CFFF, #6B3FA0)',
                                    WebkitBackgroundClip: 'text',
                                }}>Ops</span>
                            </h2>
                            <p className="text-[11px] font-medium tracking-[0.15em] uppercase mt-2" style={{ color: '#C4956A' }}>
                                Lo que no se mide, no se controla
                            </p>
                            <p className="text-xs text-slate-500 mt-2">analyzeops.com</p>
                        </div>
                    </div>
                )}

                {/* Color palette reference */}
                <div className="mt-12 flex justify-center gap-6 items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ background: '#5B2D8E' }} />
                        <span className="text-[10px] text-slate-500 font-mono">#5B2D8E</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ background: '#C4956A' }} />
                        <span className="text-[10px] text-slate-500 font-mono">#C4956A</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ background: '#00CFFF' }} />
                        <span className="text-[10px] text-slate-500 font-mono">#00CFFF</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
