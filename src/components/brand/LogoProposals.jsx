import React, { useState } from 'react';

/* ═══════════════════════════════════════════════════
   PROPOSAL 1: NEURAL NEXUS
   Molecular network with organic nodes and flowing connections.
   Hover: nodes pulse, connections glow, particles flow.
   ═══════════════════════════════════════════════════ */
export function LogoNeuralNexus({ size = 120, interactive = true }) {
    const [hovered, setHovered] = useState(false);
    const id = React.useId();

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            onMouseEnter={() => interactive && setHovered(true)}
            onMouseLeave={() => interactive && setHovered(false)}
            style={{ cursor: interactive ? 'pointer' : 'default', transition: 'transform 0.3s ease', transform: hovered ? 'scale(1.05)' : 'scale(1)' }}
        >
            <defs>
                <linearGradient id={`${id}-gp`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#5B2D8E" />
                    <stop offset="100%" stopColor="#3D1B5E" />
                </linearGradient>
                <linearGradient id={`${id}-gc`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#D4A574" />
                    <stop offset="100%" stopColor="#B8855A" />
                </linearGradient>
                <linearGradient id={`${id}-gt`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00E5FF" />
                    <stop offset="100%" stopColor="#00B0CC" />
                </linearGradient>
                <filter id={`${id}-glow`}>
                    <feGaussianBlur stdDeviation="2" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>

            {/* Connection lines with animation */}
            <g opacity={hovered ? 0.9 : 0.5} style={{ transition: 'opacity 0.4s ease' }}>
                <path d="M60 25 Q45 40, 35 55" stroke={`url(#${id}-gp)`} strokeWidth="3" strokeLinecap="round" fill="none">
                    <animate attributeName="stroke-dasharray" values="0,100;50,100" dur="1.5s" fill="freeze" />
                </path>
                <path d="M60 25 Q75 40, 85 50" stroke={`url(#${id}-gc)`} strokeWidth="3" strokeLinecap="round" fill="none">
                    <animate attributeName="stroke-dasharray" values="0,100;50,100" dur="1.5s" begin="0.2s" fill="freeze" />
                </path>
                <path d="M35 55 Q45 70, 55 82" stroke={`url(#${id}-gp)`} strokeWidth="3" strokeLinecap="round" fill="none">
                    <animate attributeName="stroke-dasharray" values="0,100;50,100" dur="1.5s" begin="0.4s" fill="freeze" />
                </path>
                <path d="M85 50 Q75 68, 65 80" stroke={`url(#${id}-gc)`} strokeWidth="3" strokeLinecap="round" fill="none">
                    <animate attributeName="stroke-dasharray" values="0,100;50,100" dur="1.5s" begin="0.6s" fill="freeze" />
                </path>
                <path d="M35 55 Q55 48, 85 50" stroke={`url(#${id}-gt)`} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6">
                    <animate attributeName="stroke-dasharray" values="0,100;60,100" dur="1.5s" begin="0.3s" fill="freeze" />
                </path>
                {/* Outer branches */}
                <path d="M35 55 L18 68" stroke={`url(#${id}-gp)`} strokeWidth="2.5" strokeLinecap="round" />
                <path d="M85 50 L100 38" stroke={`url(#${id}-gc)`} strokeWidth="2.5" strokeLinecap="round" />
                <path d="M60 82 L72 98" stroke={`url(#${id}-gt)`} strokeWidth="2.5" strokeLinecap="round" />
            </g>

            {/* Flowing particles on hover */}
            {hovered && (
                <g>
                    <circle r="2" fill="#00E5FF" opacity="0.8">
                        <animateMotion dur="1.5s" repeatCount="indefinite" path="M60 25 Q45 40, 35 55" />
                    </circle>
                    <circle r="2" fill="#C4956A" opacity="0.8">
                        <animateMotion dur="1.5s" repeatCount="indefinite" begin="0.5s" path="M60 25 Q75 40, 85 50" />
                    </circle>
                    <circle r="1.5" fill="#5B2D8E" opacity="0.7">
                        <animateMotion dur="2s" repeatCount="indefinite" begin="0.3s" path="M35 55 Q55 48, 85 50" />
                    </circle>
                </g>
            )}

            {/* Primary nodes */}
            <circle cx="60" cy="25" r={hovered ? 10 : 8} fill={`url(#${id}-gp)`} filter={`url(#${id}-glow)`} style={{ transition: 'r 0.3s ease' }}>
                <animate attributeName="r" values={hovered ? "9;11;9" : "8;8;8"} dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="35" cy="55" r={hovered ? 9 : 7} fill={`url(#${id}-gc)`} filter={`url(#${id}-glow)`}>
                <animate attributeName="r" values={hovered ? "8;10;8" : "7;7;7"} dur="2s" begin="0.3s" repeatCount="indefinite" />
            </circle>
            <circle cx="85" cy="50" r={hovered ? 9 : 7} fill={`url(#${id}-gp)`} filter={`url(#${id}-glow)`}>
                <animate attributeName="r" values={hovered ? "8;10;8" : "7;7;7"} dur="2s" begin="0.6s" repeatCount="indefinite" />
            </circle>
            <circle cx="60" cy="82" r={hovered ? 10 : 8} fill={`url(#${id}-gc)`} filter={`url(#${id}-glow)`}>
                <animate attributeName="r" values={hovered ? "9;11;9" : "8;8;8"} dur="2s" begin="0.9s" repeatCount="indefinite" />
            </circle>

            {/* Cyan accent nodes */}
            <circle cx="18" cy="68" r={hovered ? 6 : 5} fill={`url(#${id}-gt)`} filter={`url(#${id}-glow)`}>
                <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="100" cy="38" r={hovered ? 6 : 5} fill={`url(#${id}-gt)`} filter={`url(#${id}-glow)`}>
                <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" begin="0.7s" repeatCount="indefinite" />
            </circle>
            <circle cx="72" cy="98" r={hovered ? 5 : 4} fill={`url(#${id}-gt)`} filter={`url(#${id}-glow)`}>
                <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" begin="1.4s" repeatCount="indefinite" />
            </circle>

            {/* White highlight dots */}
            <circle cx="60" cy="24" r="3" fill="white" opacity={hovered ? 0.8 : 0.5} style={{ transition: 'opacity 0.3s' }} />
            <circle cx="35" cy="54" r="2.5" fill="white" opacity={hovered ? 0.7 : 0.4} style={{ transition: 'opacity 0.3s' }} />
            <circle cx="85" cy="49" r="2.5" fill="white" opacity={hovered ? 0.7 : 0.4} style={{ transition: 'opacity 0.3s' }} />
            <circle cx="60" cy="81" r="3" fill="white" opacity={hovered ? 0.8 : 0.5} style={{ transition: 'opacity 0.3s' }} />
        </svg>
    );
}


/* ═══════════════════════════════════════════════════
   PROPOSAL 2: DATA ORBIT
   Central analytics eye with orbiting data nodes.
   Hover: orbits speed up, eye pulses, rings expand.
   ═══════════════════════════════════════════════════ */
export function LogoDataOrbit({ size = 120, interactive = true }) {
    const [hovered, setHovered] = useState(false);
    const id = React.useId();

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            onMouseEnter={() => interactive && setHovered(true)}
            onMouseLeave={() => interactive && setHovered(false)}
            style={{ cursor: interactive ? 'pointer' : 'default', transition: 'transform 0.3s ease', transform: hovered ? 'scale(1.05)' : 'scale(1)' }}
        >
            <defs>
                <linearGradient id={`${id}-p`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#5B2D8E" />
                    <stop offset="100%" stopColor="#3D1B5E" />
                </linearGradient>
                <linearGradient id={`${id}-c`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#D4A574" />
                    <stop offset="100%" stopColor="#B8855A" />
                </linearGradient>
                <linearGradient id={`${id}-t`} x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor="#00E5FF" />
                    <stop offset="100%" stopColor="#00A0BB" />
                </linearGradient>
                <filter id={`${id}-gl`}>
                    <feGaussianBlur stdDeviation="2" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>

            {/* Outer orbit ring */}
            <ellipse cx="60" cy="60" rx="48" ry="22" stroke={`url(#${id}-p)`} strokeWidth="1.5" opacity={hovered ? 0.5 : 0.25} fill="none"
                transform="rotate(-25 60 60)" style={{ transition: 'opacity 0.3s' }}>
            </ellipse>

            {/* Middle orbit ring */}
            <ellipse cx="60" cy="60" rx="38" ry="18" stroke={`url(#${id}-c)`} strokeWidth="1.5" opacity={hovered ? 0.5 : 0.25} fill="none"
                transform="rotate(35 60 60)" style={{ transition: 'opacity 0.3s' }}>
            </ellipse>

            {/* Inner orbit ring */}
            <ellipse cx="60" cy="60" rx="28" ry="14" stroke={`url(#${id}-t)`} strokeWidth="1.5" opacity={hovered ? 0.6 : 0.3} fill="none"
                transform="rotate(-60 60 60)" style={{ transition: 'opacity 0.3s' }}>
            </ellipse>

            {/* Orbiting nodes */}
            {/* Orbit 1 — purple */}
            <circle r="5" fill={`url(#${id}-p)`} filter={`url(#${id}-gl)`}>
                <animateMotion dur={hovered ? "3s" : "6s"} repeatCount="indefinite"
                    path="M60 60 m-48 0 a48,22 -25 1,1 96,0 a48,22 -25 1,1 -96,0"
                />
            </circle>

            {/* Orbit 2 — copper */}
            <circle r="4.5" fill={`url(#${id}-c)`} filter={`url(#${id}-gl)`}>
                <animateMotion dur={hovered ? "2.5s" : "5s"} repeatCount="indefinite"
                    path="M60 60 m-38 0 a38,18 35 1,1 76,0 a38,18 35 1,1 -76,0"
                />
            </circle>

            {/* Orbit 3 — cyan */}
            <circle r="4" fill={`url(#${id}-t)`} filter={`url(#${id}-gl)`}>
                <animateMotion dur={hovered ? "2s" : "4s"} repeatCount="indefinite"
                    path="M60 60 m-28 0 a28,14 -60 1,1 56,0 a28,14 -60 1,1 -56,0"
                />
            </circle>

            {/* Central core */}
            <circle cx="60" cy="60" r={hovered ? 14 : 12} fill={`url(#${id}-p)`} filter={`url(#${id}-gl)`} style={{ transition: 'all 0.3s ease' }}>
                <animate attributeName="r" values={hovered ? "13;15;13" : "12;12;12"} dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="60" cy="60" r={hovered ? 8 : 6} fill={`url(#${id}-t)`} style={{ transition: 'all 0.3s ease' }}>
                <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="60" cy="60" r="3" fill="white" opacity={hovered ? 0.9 : 0.6} style={{ transition: 'opacity 0.3s' }} />

            {/* Corner accent dots */}
            <circle cx="15" cy="15" r="2" fill={`url(#${id}-t)`} opacity={hovered ? 0.6 : 0}>
                <animate attributeName="opacity" values="0;0.6;0" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="105" cy="20" r="1.5" fill={`url(#${id}-c)`} opacity={hovered ? 0.5 : 0}>
                <animate attributeName="opacity" values="0;0.5;0" dur="3s" begin="1s" repeatCount="indefinite" />
            </circle>
            <circle cx="18" cy="100" r="1.5" fill={`url(#${id}-p)`} opacity={hovered ? 0.5 : 0}>
                <animate attributeName="opacity" values="0;0.5;0" dur="3s" begin="2s" repeatCount="indefinite" />
            </circle>
        </svg>
    );
}


/* ═══════════════════════════════════════════════════
   PROPOSAL 3: PULSE GRAPH
   Analytics chart morphing into a heartbeat/pulse line.
   Hover: bars rise, pulse line animates, data points glow.
   ═══════════════════════════════════════════════════ */
export function LogoPulseGraph({ size = 120, interactive = true }) {
    const [hovered, setHovered] = useState(false);
    const id = React.useId();

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            onMouseEnter={() => interactive && setHovered(true)}
            onMouseLeave={() => interactive && setHovered(false)}
            style={{ cursor: interactive ? 'pointer' : 'default', transition: 'transform 0.3s ease', transform: hovered ? 'scale(1.05)' : 'scale(1)' }}
        >
            <defs>
                <linearGradient id={`${id}-p`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#5B2D8E" />
                    <stop offset="100%" stopColor="#3D1B5E" />
                </linearGradient>
                <linearGradient id={`${id}-c`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#D4A574" />
                    <stop offset="100%" stopColor="#B8855A" />
                </linearGradient>
                <linearGradient id={`${id}-t`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00E5FF" />
                    <stop offset="100%" stopColor="#00A0BB" />
                </linearGradient>
                <filter id={`${id}-gl`}>
                    <feGaussianBlur stdDeviation="1.5" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>

            {/* Background circle */}
            <circle cx="60" cy="60" r="52" stroke={`url(#${id}-p)`} strokeWidth="1" opacity={hovered ? 0.3 : 0.15} fill="none" style={{ transition: 'opacity 0.3s' }} />
            <circle cx="60" cy="60" r="42" stroke={`url(#${id}-p)`} strokeWidth="0.5" opacity={hovered ? 0.2 : 0.1} fill="none" strokeDasharray="4 4" style={{ transition: 'opacity 0.3s' }}>
                {hovered && <animateTransform type="rotate" from="0 60 60" to="360 60 60" dur="20s" repeatCount="indefinite" attributeName="transform" />}
            </circle>

            {/* Bar chart — bars grow on hover */}
            <rect x="25" y={hovered ? 50 : 75} width="8" height={hovered ? 40 : 15} rx="4" fill={`url(#${id}-p)`} opacity="0.9" style={{ transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
            <rect x="37" y={hovered ? 38 : 65} width="8" height={hovered ? 52 : 25} rx="4" fill={`url(#${id}-c)`} opacity="0.9" style={{ transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s' }} />
            <rect x="49" y={hovered ? 55 : 70} width="8" height={hovered ? 35 : 20} rx="4" fill={`url(#${id}-p)`} opacity="0.9" style={{ transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s' }} />
            <rect x="61" y={hovered ? 30 : 60} width="8" height={hovered ? 60 : 30} rx="4" fill={`url(#${id}-c)`} opacity="0.9" style={{ transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s' }} />
            <rect x="73" y={hovered ? 42 : 68} width="8" height={hovered ? 48 : 22} rx="4" fill={`url(#${id}-p)`} opacity="0.9" style={{ transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s' }} />
            <rect x="85" y={hovered ? 48 : 72} width="8" height={hovered ? 42 : 18} rx="4" fill={`url(#${id}-c)`} opacity="0.9" style={{ transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.25s' }} />

            {/* Pulse line — the "heartbeat" */}
            <path
                d={hovered
                    ? "M15 55 L30 55 L38 35 L46 65 L54 25 L62 55 L70 45 L78 55 L86 40 L94 55 L105 55"
                    : "M15 65 L30 65 L38 60 L46 68 L54 58 L62 65 L70 62 L78 65 L86 63 L94 65 L105 65"
                }
                stroke={`url(#${id}-t)`}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                filter={`url(#${id}-gl)`}
                style={{ transition: 'd 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            >
                {hovered && <animate attributeName="stroke-dasharray" values="0,300;300,0" dur="1s" fill="freeze" />}
            </path>

            {/* Data points on pulse */}
            {hovered && (
                <g>
                    <circle cx="38" cy="35" r="3" fill={`url(#${id}-t)`} filter={`url(#${id}-gl)`}>
                        <animate attributeName="r" values="2;4;2" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="54" cy="25" r="3.5" fill="#00E5FF" filter={`url(#${id}-gl)`}>
                        <animate attributeName="r" values="2.5;4.5;2.5" dur="1.5s" begin="0.3s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="86" cy="40" r="3" fill={`url(#${id}-t)`} filter={`url(#${id}-gl)`}>
                        <animate attributeName="r" values="2;4;2" dur="1.5s" begin="0.6s" repeatCount="indefinite" />
                    </circle>
                </g>
            )}

            {/* Trend arrow on hover */}
            {hovered && (
                <g opacity="0" style={{ animation: 'fadeIn 0.5s ease 0.3s forwards' }}>
                    <path d="M88 22 L98 15 L95 25" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <line x1="70" y1="35" x2="96" y2="17" stroke="#00E5FF" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />
                </g>
            )}

            <style>{`
                @keyframes fadeIn {
                    to { opacity: 1; }
                }
            `}</style>
        </svg>
    );
}
