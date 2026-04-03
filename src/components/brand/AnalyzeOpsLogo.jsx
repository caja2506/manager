import React, { useState } from 'react';

/**
 * AnalyzeOps Logo — Final hybrid design combining:
 * - Pulse Graph: analytics bars showing what the platform does
 * - Data Orbit: flowing orbital animations (most dynamic)
 * - Neural Nexus: professional structure with connected nodes
 * 
 * Uses the app's existing color palette:
 * - Purple:  #5B2D8E / #6B3FA0
 * - Copper:  #C4956A
 * - Cyan:    #00CFFF
 * 
 * Props:
 * - size: number — overall dimensions
 * - animate: boolean — auto-animate (for splash/loading)
 * - interactive: boolean — hover effects (for sidebar/login)
 * - showName: boolean — show "AnalyzeOps.com" text below
 * - className: string
 */
export default function AnalyzeOpsLogo({
    size = 48,
    animate = false,
    interactive = true,
    showName = false,
    className = '',
}) {
    const [hovered, setHovered] = useState(false);
    const active = animate || hovered;
    const id = React.useId();

    // Scale text size proportionally
    const nameSize = Math.max(10, size * 0.12);

    return (
        <div
            className={className}
            style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: showName ? size * 0.06 : 0,
            }}
            onMouseEnter={() => interactive && setHovered(true)}
            onMouseLeave={() => interactive && setHovered(false)}
        >
            <svg
                width={size}
                height={size}
                viewBox="0 0 120 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                    cursor: interactive ? 'pointer' : 'default',
                    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform: hovered ? 'scale(1.08)' : 'scale(1)',
                }}
                aria-label="AnalyzeOps Logo"
            >
                <defs>
                    <linearGradient id={`${id}-purple`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#6B3FA0" />
                        <stop offset="100%" stopColor="#5B2D8E" />
                    </linearGradient>
                    <linearGradient id={`${id}-copper`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#D4A574" />
                        <stop offset="100%" stopColor="#C4956A" />
                    </linearGradient>
                    <linearGradient id={`${id}-cyan`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00E5FF" />
                        <stop offset="100%" stopColor="#00CFFF" />
                    </linearGradient>
                    <linearGradient id={`${id}-purpleCyan`} x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#5B2D8E" />
                        <stop offset="100%" stopColor="#00CFFF" />
                    </linearGradient>
                    <filter id={`${id}-glow`}>
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id={`${id}-softGlow`}>
                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* ══════ ORBITAL RING (from Data Orbit) ══════ */}
                <ellipse
                    cx="60" cy="60" rx="50" ry="20"
                    stroke={`url(#${id}-purple)`}
                    strokeWidth="1"
                    opacity={active ? 0.4 : 0.15}
                    fill="none"
                    transform="rotate(-30 60 60)"
                    style={{ transition: 'opacity 0.5s ease' }}
                >
                    {animate && (
                        <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="-30 60 60"
                            to="330 60 60"
                            dur="30s"
                            repeatCount="indefinite"
                        />
                    )}
                </ellipse>
                <ellipse
                    cx="60" cy="60" rx="44" ry="16"
                    stroke={`url(#${id}-copper)`}
                    strokeWidth="0.8"
                    opacity={active ? 0.35 : 0.1}
                    fill="none"
                    transform="rotate(40 60 60)"
                    style={{ transition: 'opacity 0.5s ease' }}
                    strokeDasharray={active ? "none" : "3 5"}
                >
                    {animate && (
                        <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="40 60 60"
                            to="-320 60 60"
                            dur="25s"
                            repeatCount="indefinite"
                        />
                    )}
                </ellipse>

                {/* ══════ ANALYTICS BARS (from Pulse Graph) ══════ */}
                <rect x="35" y={active ? 48 : 62} width="7" height={active ? 26 : 12} rx="3.5"
                    fill={`url(#${id}-purple)`} opacity="0.9"
                    style={{ transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
                <rect x="45" y={active ? 38 : 55} width="7" height={active ? 36 : 19} rx="3.5"
                    fill={`url(#${id}-copper)`} opacity="0.9"
                    style={{ transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.06s' }} />
                <rect x="55" y={active ? 44 : 58} width="7" height={active ? 30 : 16} rx="3.5"
                    fill={`url(#${id}-purple)`} opacity="0.9"
                    style={{ transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.12s' }} />
                <rect x="65" y={active ? 32 : 52} width="7" height={active ? 42 : 22} rx="3.5"
                    fill={`url(#${id}-cyan)`} opacity="0.85"
                    style={{ transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.18s' }} />
                <rect x="75" y={active ? 42 : 56} width="7" height={active ? 32 : 18} rx="3.5"
                    fill={`url(#${id}-copper)`} opacity="0.9"
                    style={{ transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.24s' }} />

                {/* ══════ PULSE LINE (heartbeat overlay) ══════ */}
                <path
                    d={active
                        ? "M25 58 L36 58 L42 42 L50 62 L58 30 L66 54 L72 46 L78 58 L84 38 L92 58 L100 58"
                        : "M25 66 L36 66 L42 64 L50 67 L58 63 L66 66 L72 65 L78 66 L84 64 L92 66 L100 66"
                    }
                    stroke={`url(#${id}-cyan)`}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    filter={active ? `url(#${id}-softGlow)` : undefined}
                    style={{ transition: 'd 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                >
                    {active && (
                        <animate
                            attributeName="stroke-dasharray"
                            values="0,200;200,0"
                            dur="1.2s"
                            fill="freeze"
                        />
                    )}
                </path>

                {/* ══════ NEURAL NODES (from Neural Nexus) ══════ */}
                {/* Connection lines first (behind nodes) */}
                <g opacity={active ? 0.5 : 0.2} style={{ transition: 'opacity 0.5s' }}>
                    <line x1="28" y1="28" x2="42" y2="42" stroke={`url(#${id}-purple)`} strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="92" y1="28" x2="78" y2="42" stroke={`url(#${id}-copper)`} strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="28" y1="92" x2="42" y2="78" stroke={`url(#${id}-copper)`} strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="92" y1="92" x2="78" y2="78" stroke={`url(#${id}-purple)`} strokeWidth="1.5" strokeLinecap="round" />
                </g>

                {/* Corner nodes */}
                <circle cx="25" cy="25" r={active ? 5 : 3.5} fill={`url(#${id}-purple)`}
                    filter={active ? `url(#${id}-glow)` : undefined}
                    style={{ transition: 'all 0.4s ease' }}>
                    {active && <animate attributeName="r" values="4;6;4" dur="2.5s" repeatCount="indefinite" />}
                </circle>
                <circle cx="95" cy="25" r={active ? 4.5 : 3} fill={`url(#${id}-copper)`}
                    filter={active ? `url(#${id}-glow)` : undefined}
                    style={{ transition: 'all 0.4s ease' }}>
                    {active && <animate attributeName="r" values="3.5;5.5;3.5" dur="2.5s" begin="0.5s" repeatCount="indefinite" />}
                </circle>
                <circle cx="25" cy="95" r={active ? 4.5 : 3} fill={`url(#${id}-copper)`}
                    filter={active ? `url(#${id}-glow)` : undefined}
                    style={{ transition: 'all 0.4s ease' }}>
                    {active && <animate attributeName="r" values="3.5;5.5;3.5" dur="2.5s" begin="1s" repeatCount="indefinite" />}
                </circle>
                <circle cx="95" cy="95" r={active ? 5 : 3.5} fill={`url(#${id}-purple)`}
                    filter={active ? `url(#${id}-glow)` : undefined}
                    style={{ transition: 'all 0.4s ease' }}>
                    {active && <animate attributeName="r" values="4;6;4" dur="2.5s" begin="1.5s" repeatCount="indefinite" />}
                </circle>

                {/* Highlight inner dots */}
                <circle cx="25" cy="25" r="1.5" fill="white" opacity={active ? 0.7 : 0.3} style={{ transition: 'opacity 0.3s' }} />
                <circle cx="95" cy="25" r="1.2" fill="white" opacity={active ? 0.6 : 0.2} style={{ transition: 'opacity 0.3s' }} />
                <circle cx="25" cy="95" r="1.2" fill="white" opacity={active ? 0.6 : 0.2} style={{ transition: 'opacity 0.3s' }} />
                <circle cx="95" cy="95" r="1.5" fill="white" opacity={active ? 0.7 : 0.3} style={{ transition: 'opacity 0.3s' }} />

                {/* ══════ DATA POINTS on pulse peaks ══════ */}
                {active && (
                    <g>
                        <circle cx="58" cy="30" r="3.5" fill={`url(#${id}-cyan)`} filter={`url(#${id}-glow)`}>
                            <animate attributeName="r" values="2.5;4.5;2.5" dur="2s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="42" cy="42" r="3" fill={`url(#${id}-purple)`} filter={`url(#${id}-softGlow)`}>
                            <animate attributeName="r" values="2;4;2" dur="2s" begin="0.4s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="84" cy="38" r="3" fill={`url(#${id}-copper)`} filter={`url(#${id}-softGlow)`}>
                            <animate attributeName="r" values="2;4;2" dur="2s" begin="0.8s" repeatCount="indefinite" />
                        </circle>
                    </g>
                )}

                {/* ══════ ORBITING PARTICLE (from Data Orbit) ══════ */}
                <circle r="3" fill={`url(#${id}-cyan)`} filter={`url(#${id}-glow)`} opacity={active ? 1 : 0}
                    style={{ transition: 'opacity 0.5s' }}>
                    <animateMotion
                        dur={active ? "4s" : "8s"}
                        repeatCount="indefinite"
                        path="M10 60 A50 20 -30 1 1 110 60 A50 20 -30 1 1 10 60"
                    />
                </circle>
                <circle r="2.5" fill={`url(#${id}-copper)`} filter={`url(#${id}-softGlow)`} opacity={active ? 0.8 : 0}
                    style={{ transition: 'opacity 0.5s' }}>
                    <animateMotion
                        dur={active ? "3.5s" : "7s"}
                        repeatCount="indefinite"
                        begin="1s"
                        path="M16 60 A44 16 40 1 1 104 60 A44 16 40 1 1 16 60"
                    />
                </circle>

                {/* ══════ TREND ARROW (appears on hover) ══════ */}
                {active && (
                    <g opacity="0" style={{ animation: 'aops-fadeIn 0.4s ease 0.5s forwards' }}>
                        <path d="M96 18 L103 12 L101 20" stroke="#00CFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        <line x1="82" y1="30" x2="101" y2="14" stroke="#00CFFF" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
                    </g>
                )}
            </svg>

            {/* ══════ BRAND NAME ══════ */}
            {showName && (
                <div style={{ textAlign: 'center', lineHeight: 1.1 }}>
                    <div style={{
                        fontSize: nameSize * 1.6,
                        fontWeight: 900,
                        letterSpacing: '-0.02em',
                        color: '#ffffff',
                        fontFamily: "'Inter', 'Segoe UI', sans-serif",
                    }}>
                        AnalyzeOps<span style={{
                            fontSize: nameSize * 1.1,
                            fontWeight: 700,
                            color: '#ffffff',
                        }}>.com</span>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes aops-fadeIn {
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
}
