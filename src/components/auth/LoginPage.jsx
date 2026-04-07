import React, { useState } from 'react';
import { Loader2, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AnalyzeOpsLogo from '../brand/AnalyzeOpsLogo';

// Firebase error code → user-friendly message
const AUTH_ERRORS = {
    'auth/invalid-email': 'El correo electrónico no es válido.',
    'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
    'auth/user-not-found': 'No existe una cuenta con este correo.',
    'auth/wrong-password': 'La contraseña es incorrecta.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/email-already-in-use': 'Ya existe una cuenta con este correo.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de autenticación.',
    'auth/network-request-failed': 'Error de red. Verifica tu conexión.',
};

function getErrorMessage(error) {
    return AUTH_ERRORS[error.code] || error.message || 'Error al iniciar sesión';
}

export default function LoginPage() {
    const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState(null);

    // Form state
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        setError(null);
        try {
            await signInWithGoogle();
        } catch (err) {
            setError(getErrorMessage(err));
            setGoogleLoading(false);
        }
    };

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) return;
        if (mode === 'register' && !displayName.trim()) return;

        setIsLoading(true);
        setError(null);
        try {
            if (mode === 'login') {
                await signInWithEmail(email, password);
            } else {
                await signUpWithEmail(email, password, displayName.trim());
            }
        } catch (err) {
            setError(getErrorMessage(err));
            setIsLoading(false);
        }
    };

    const toggleMode = () => {
        setMode(m => m === 'login' ? 'register' : 'login');
        setError(null);
    };

    const inputStyle = {
        background: 'rgba(30,25,55,0.9)',
        borderColor: 'rgba(107,63,160,0.25)',
        color: '#e2e8f0',
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0c0a1a 0%, #1a1035 35%, #0f172a 70%, #0c0a1a 100%)' }}>
            {/* Noise Texture Overlay */}
            <div className="fixed inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
            />

            {/* Ambient Glow */}
            <div className="absolute rounded-full pointer-events-none" style={{ width: 400, height: 400, top: '15%', left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(107,63,160,0.2) 0%, transparent 70%)', filter: 'blur(100px)' }} />
            <div className="absolute rounded-full pointer-events-none" style={{ width: 300, height: 300, bottom: '20%', right: '20%', background: 'radial-gradient(circle, rgba(0,207,255,0.12) 0%, transparent 70%)', filter: 'blur(80px)' }} />
            <div className="absolute rounded-full pointer-events-none" style={{ width: 250, height: 250, bottom: '30%', left: '15%', background: 'radial-gradient(circle, rgba(196,149,106,0.1) 0%, transparent 70%)', filter: 'blur(60px)' }} />

            <div className="relative z-10 w-full max-w-md">
                {/* Card */}
                <div className="backdrop-blur-2xl rounded-3xl border shadow-2xl shadow-black/50 p-8 sm:p-10" style={{ background: 'rgba(15,12,30,0.8)', borderColor: 'rgba(107,63,160,0.25)' }}>
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative mb-2">
                            <AnalyzeOpsLogo size={110} interactive showName />
                        </div>

                        {/* Slogan */}
                        <div className="flex items-center gap-2 mt-3 mb-1">
                            <div className="w-8 h-px" style={{ background: 'linear-gradient(90deg, transparent, #6B3FA0)' }} />
                            <div className="w-1 h-1 rounded-full" style={{ background: '#00CFFF', boxShadow: '0 0 6px #00CFFF' }} />
                            <div className="w-8 h-px" style={{ background: 'linear-gradient(90deg, #6B3FA0, transparent)' }} />
                        </div>
                        <p className="text-[11px] font-medium tracking-[0.15em] uppercase mt-1" style={{ color: '#C4956A', textShadow: '0 0 15px rgba(196,149,106,0.2)' }}>
                            Lo que no se mide, no se controla
                        </p>
                        <p className="text-xs text-slate-500 mt-3 text-center">
                            Engineering Management Platform
                        </p>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(107,63,160,0.3), transparent)' }} />
                        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#6B3FA0' }}>
                            {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                        </span>
                        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(107,63,160,0.3), transparent)' }} />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-5 rounded-xl p-3 text-sm text-center" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#fca5a5' }}>
                            {error}
                        </div>
                    )}

                    {/* Email/Password Form */}
                    <form onSubmit={handleEmailSubmit} className="space-y-3 mb-5">
                        {/* Display Name — only for register */}
                        {mode === 'register' && (
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    placeholder="Nombre completo"
                                    required
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-purple-500/40 transition-all placeholder-slate-600"
                                    style={inputStyle}
                                />
                            </div>
                        )}

                        {/* Email */}
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="Correo electrónico"
                                required
                                autoComplete="email"
                                className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-purple-500/40 transition-all placeholder-slate-600"
                                style={inputStyle}
                            />
                        </div>

                        {/* Password */}
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Contraseña"
                                required
                                minLength={6}
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                className="w-full pl-10 pr-10 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-purple-500/40 transition-all placeholder-slate-600"
                                style={inputStyle}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(s => !s)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading || !email.trim() || !password.trim()}
                            className="w-full flex items-center justify-center gap-2 font-bold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-sm"
                            style={{
                                background: 'linear-gradient(135deg, #6B3FA0, #4f46e5)',
                                color: '#fff',
                            }}
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Mail className="w-4 h-4" />
                            )}
                            {isLoading
                                ? 'Procesando...'
                                : mode === 'login'
                                    ? 'Iniciar Sesión'
                                    : 'Crear Cuenta'
                            }
                        </button>
                    </form>

                    {/* Toggle mode */}
                    <div className="text-center mb-5">
                        <button
                            onClick={toggleMode}
                            className="text-xs font-medium transition-colors hover:underline"
                            style={{ color: '#a78bfa' }}
                        >
                            {mode === 'login'
                                ? '¿No tienes cuenta? Crear una nueva'
                                : '¿Ya tienes cuenta? Inicia sesión'
                            }
                        </button>
                    </div>

                    {/* OR Divider */}
                    <div className="flex items-center gap-3 mb-5">
                        <div className="flex-1 h-px" style={{ background: 'rgba(100,116,139,0.3)' }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">o</span>
                        <div className="flex-1 h-px" style={{ background: 'rgba(100,116,139,0.3)' }} />
                    </div>

                    {/* Google Button */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={googleLoading || isLoading}
                        className="w-full flex items-center justify-center gap-3 font-bold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-sm"
                        style={{
                            background: 'linear-gradient(135deg, #ffffff, #f0ecf5)',
                            color: '#2D1B4E',
                        }}
                    >
                        {googleLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.99 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                        )}
                        {googleLoading ? 'Conectando...' : 'Continuar con Google'}
                    </button>

                    {/* Info */}
                    <p className="text-[11px] text-slate-500 text-center mt-6 leading-relaxed">
                        Contacta al administrador para obtener acceso.
                    </p>
                </div>

                {/* Footer */}
                <p className="text-[10px] text-center mt-6" style={{ color: 'rgba(107,63,160,0.5)' }}>
                    © 2025 AnalyzeOps — Powered by Firebase
                </p>
            </div>
        </div>
    );
}
