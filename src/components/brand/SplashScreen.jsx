import React, { useState, useEffect } from 'react';
import AnalyzeOpsLogo from './AnalyzeOpsLogo';
import { selectedQuote } from './quotes';

/**
 * Animated splash screen with AnalyzeOps brand identity.
 * Shows for ~7s with a randomly selected inspirational quote.
 */

export default function SplashScreen({ onComplete }) {
    const [phase, setPhase] = useState('enter'); // enter → show → quote → exit → done

    const quote = selectedQuote;

    useEffect(() => {
        const timers = [];
        timers.push(setTimeout(() => setPhase('show'), 200));      // logo entrance
        timers.push(setTimeout(() => setPhase('quote'), 1500));    // show quote
        timers.push(setTimeout(() => setPhase('exit'), 6000));     // start fade out
        timers.push(setTimeout(() => {
            setPhase('done');
            onComplete?.();
        }, 7000)); // fully done
        return () => timers.forEach(clearTimeout);
    }, [onComplete]);

    if (phase === 'done') return null;

    const showingQuote = phase === 'quote' || phase === 'exit';

    return (
        <div
            className="fixed inset-0 z-9999 flex items-center justify-center"
            style={{
                background: 'linear-gradient(135deg, #0f0b2e 0%, #1a1050 30%, #0d1a3a 60%, #1a0f40 100%)',
                opacity: phase === 'exit' ? 0 : 1,
                transition: 'opacity 800ms ease-out',
            }}
        >
            {/* Noise Texture */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    opacity: 0.04,
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
                }}
            />

            {/* Ambient Glow Orbs */}
            <div
                className="absolute rounded-full pointer-events-none"
                style={{
                    width: 500, height: 500,
                    top: '10%', left: '50%', transform: 'translateX(-50%)',
                    background: 'radial-gradient(circle, rgba(99,102,241,0.20) 0%, transparent 70%)',
                    filter: 'blur(80px)',
                    animation: phase !== 'enter' ? 'splash-pulse 3s ease-in-out infinite' : undefined,
                }}
            />
            <div
                className="absolute rounded-full pointer-events-none"
                style={{
                    width: 400, height: 400,
                    bottom: '5%', right: '15%',
                    background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
                    filter: 'blur(80px)',
                    animation: phase !== 'enter' ? 'splash-pulse 3s ease-in-out 0.5s infinite' : undefined,
                }}
            />
            <div
                className="absolute rounded-full pointer-events-none"
                style={{
                    width: 300, height: 300,
                    top: '40%', left: '10%',
                    background: 'radial-gradient(circle, rgba(52,211,153,0.10) 0%, transparent 70%)',
                    filter: 'blur(60px)',
                    animation: phase !== 'enter' ? 'splash-pulse 3s ease-in-out 1s infinite' : undefined,
                }}
            />

            {/* Particle Lines (decorative) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: phase !== 'enter' ? 0.15 : 0, transition: 'opacity 1s ease' }}>
                <line x1="10%" y1="20%" x2="40%" y2="50%" stroke="#6B3FA0" strokeWidth="0.5" opacity="0.4">
                    <animate attributeName="opacity" values="0;0.4;0" dur="4s" repeatCount="indefinite" />
                </line>
                <line x1="90%" y1="15%" x2="60%" y2="55%" stroke="#00CFFF" strokeWidth="0.5" opacity="0.3">
                    <animate attributeName="opacity" values="0;0.3;0" dur="4s" begin="1s" repeatCount="indefinite" />
                </line>
                <line x1="20%" y1="80%" x2="50%" y2="50%" stroke="#C4956A" strokeWidth="0.5" opacity="0.3">
                    <animate attributeName="opacity" values="0;0.3;0" dur="4s" begin="2s" repeatCount="indefinite" />
                </line>
                <line x1="80%" y1="75%" x2="55%" y2="45%" stroke="#6B3FA0" strokeWidth="0.5" opacity="0.4">
                    <animate attributeName="opacity" values="0;0.4;0" dur="4s" begin="0.5s" repeatCount="indefinite" />
                </line>
                <circle cx="25%" cy="30%" r="1.5" fill="#00CFFF" opacity="0">
                    <animate attributeName="opacity" values="0;0.6;0" dur="3s" repeatCount="indefinite" />
                </circle>
                <circle cx="75%" cy="25%" r="1" fill="#C4956A" opacity="0">
                    <animate attributeName="opacity" values="0;0.5;0" dur="3s" begin="0.7s" repeatCount="indefinite" />
                </circle>
                <circle cx="30%" cy="70%" r="1.5" fill="#6B3FA0" opacity="0">
                    <animate attributeName="opacity" values="0;0.5;0" dur="3s" begin="1.4s" repeatCount="indefinite" />
                </circle>
                <circle cx="80%" cy="60%" r="1" fill="#00CFFF" opacity="0">
                    <animate attributeName="opacity" values="0;0.6;0" dur="3s" begin="2s" repeatCount="indefinite" />
                </circle>
            </svg>

            {/* Center Content */}
            <div
                className="relative z-10 flex flex-col items-center px-6"
                style={{
                    opacity: phase === 'enter' ? 0 : 1,
                    transform: phase === 'enter' ? 'scale(0.8) translateY(20px)' : 'scale(1) translateY(0)',
                    transition: 'all 800ms cubic-bezier(0.16, 1, 0.3, 1)',
                    maxWidth: 560,
                }}
            >
                {/* Logo with name — BIGGER */}
                <div
                    className="relative mb-6"
                    style={{
                        animation: phase !== 'enter' ? 'splash-float 3s ease-in-out infinite' : undefined,
                    }}
                >
                    {/* Outer glow ring */}
                    <div
                        className="absolute inset-0 rounded-full"
                        style={{
                            width: 200, height: 200,
                            top: '28%', left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'conic-gradient(from 0deg, #4A1D6E, #00CFFF, #C4956A, #6B3FA0, #4A1D6E)',
                            filter: 'blur(30px)',
                            opacity: 0.3,
                            animation: phase !== 'enter' ? 'splash-rotate 8s linear infinite' : undefined,
                        }}
                    />
                    <AnalyzeOpsLogo size={180} animate={phase !== 'enter'} interactive={false} showName />
                </div>

                {/* Tagline separator */}
                <div
                    className="flex items-center gap-3 mb-4"
                    style={{
                        opacity: phase === 'enter' ? 0 : 1,
                        transition: 'opacity 600ms ease 500ms',
                    }}
                >
                    <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, transparent, #6B3FA0)' }} />
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00CFFF', boxShadow: '0 0 8px #00CFFF' }} />
                    <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, #6B3FA0, transparent)' }} />
                </div>

                {/* Quote — fades in after logo */}
                <div
                    className="text-center"
                    style={{
                        opacity: showingQuote ? 1 : 0,
                        transform: showingQuote ? 'translateY(0)' : 'translateY(12px)',
                        transition: 'all 800ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                >
                    {/* Quote text */}
                    <p
                        className="text-sm sm:text-base font-light italic leading-relaxed"
                        style={{
                            color: 'rgba(255,255,255,0.75)',
                            whiteSpace: 'pre-line',
                        }}
                    >
                        "{quote.text}"
                    </p>

                    {/* Translation (for Drucker's English quote) */}
                    {quote.translation && (
                        <p
                            className="text-xs sm:text-sm mt-2 italic"
                            style={{ color: 'rgba(196,149,106,0.6)' }}
                        >
                            ({quote.translation})
                        </p>
                    )}

                    {/* Author */}
                    <p
                        className="mt-3 text-xs font-semibold tracking-widest uppercase"
                        style={{ color: '#C4956A', textShadow: '0 0 15px rgba(196,149,106,0.2)' }}
                    >
                        — {quote.author}
                        {quote.authorFull && (
                            <span className="font-normal opacity-60 ml-1">
                                ({quote.authorFull})
                            </span>
                        )}
                    </p>
                </div>

                {/* Loading bar */}
                <div
                    className="mt-8 w-48 h-[2px] rounded-full overflow-hidden"
                    style={{
                        background: 'rgba(255,255,255,0.06)',
                        opacity: phase === 'enter' ? 0 : 1,
                        transition: 'opacity 400ms ease 800ms',
                    }}
                >
                    <div
                        className="h-full rounded-full"
                        style={{
                            background: 'linear-gradient(90deg, #4A1D6E, #00CFFF, #C4956A)',
                            width: phase !== 'enter' ? '100%' : '0%',
                            transition: 'width 3500ms cubic-bezier(0.4, 0, 0.2, 1) 400ms',
                        }}
                    />
                </div>
            </div>

            {/* CSS Keyframes */}
            <style>{`
                @keyframes splash-pulse {
                    0%, 100% { opacity: 0.7; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.05); }
                }
                @keyframes splash-float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                }
                @keyframes splash-rotate {
                    from { transform: translate(-50%, -50%) rotate(0deg); }
                    to { transform: translate(-50%, -50%) rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
