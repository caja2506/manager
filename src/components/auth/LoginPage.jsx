import React, { useState } from 'react';
import { BrainCircuit, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
    const { signInWithGoogle } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await signInWithGoogle();
        } catch (err) {
            setError(err.message || 'Error al iniciar sesión');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4">
            {/* Noise Texture Overlay */}
            <div className="fixed inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
            />

            {/* Ambient Glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-600/15 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-md">
                {/* Card */}
                <div className="bg-slate-900/80 backdrop-blur-2xl rounded-3xl border border-slate-700/50 shadow-2xl shadow-black/50 p-8 sm:p-10">
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-indigo-900/40 rotate-3 hover:rotate-0 transition-transform duration-300">
                            <BrainCircuit className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight">AutoBOM Pro</h1>
                        <p className="text-sm text-slate-400 mt-2 text-center">
                            Gestión inteligente de Bill of Materials
                        </p>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="flex-1 h-px bg-slate-700/50" />
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Iniciar Sesión</span>
                        <div className="flex-1 h-px bg-slate-700/50" />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-6 bg-red-950/50 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 text-center">
                            {error}
                        </div>
                    )}

                    {/* Google Button */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 font-bold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.99 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                        )}
                        {isLoading ? 'Conectando...' : 'Continuar con Google'}
                    </button>

                    {/* Info */}
                    <p className="text-[11px] text-slate-500 text-center mt-6 leading-relaxed">
                        Se requiere una cuenta de Google autorizada.
                        <br />
                        Contacta al administrador para obtener acceso.
                    </p>
                </div>

                {/* Footer */}
                <p className="text-[10px] text-slate-600 text-center mt-6">
                    © 2025 AutoBOM Pro — Powered by Firebase
                </p>
            </div>
        </div>
    );
}
