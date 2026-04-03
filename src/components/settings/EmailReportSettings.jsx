import React, { useState, useEffect } from 'react';
import {
    Mail, Save, Send, Clock, Users, ChevronDown, ChevronUp,
    Plus, X, CheckCircle, AlertCircle, Loader2, BarChart3,
    Shield, Target, FileText, Zap
} from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';



/**
 * EmailReportSettings
 * Admin panel to configure the daily performance email report.
 * Stored in Firestore: settings/emailReportConfig
 * 
 * Features:
 * - Toggle email/Telegram channels
 * - Manage recipient email list
 * - Configure which sections to include
 * - Manual trigger button
 * - Delivery history preview
 */
export default function EmailReportSettings() {
    const { user } = useAuth();
    const [config, setConfig] = useState(null);
    const [expanded, setExpanded] = useState(false);

    // Form state
    const [enabled, setEnabled] = useState(false);
    const [emailChannel, setEmailChannel] = useState(true);
    const [telegramChannel, setTelegramChannel] = useState(true);
    const [recipients, setRecipients] = useState([]);
    const [newEmail, setNewEmail] = useState('');
    const [scheduleTime, setScheduleTime] = useState('18:15');
    const [sections, setSections] = useState({
        executiveSummary: true,
        risks: true,
        kpis: true,
        individualScores: true,
        overdueTasks: true,
        recommendations: true,
    });

    // UI state
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);
    const [emailError, setEmailError] = useState('');

    // Subscribe to Firestore
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'emailReportConfig'), snap => {
            if (snap.exists()) {
                const data = snap.data();
                setConfig(data);
                setEnabled(data.enabled !== false);
                setEmailChannel(data.channels?.email !== false);
                setTelegramChannel(data.channels?.telegramPdf !== false);
                setRecipients(data.recipients || []);
                setScheduleTime(data.scheduleTime || '18:15');
                if (data.sections) setSections({ ...sections, ...data.sections });
            }
        });
        return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAddEmail = () => {
        const email = newEmail.trim().toLowerCase();
        if (!email) return;
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setEmailError('Email no válido');
            return;
        }
        if (recipients.includes(email)) {
            setEmailError('Ya existe en la lista');
            return;
        }

        setRecipients([...recipients, email]);
        setNewEmail('');
        setEmailError('');
    };

    const handleRemoveEmail = (email) => {
        setRecipients(recipients.filter(e => e !== email));
    };

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await setDoc(doc(db, 'settings', 'emailReportConfig'), {
                enabled,
                channels: {
                    email: emailChannel,
                    telegramPdf: telegramChannel,
                },
                recipients,
                scheduleTime,
                sections,
                timezone: 'America/Mexico_City',
                updatedAt: new Date().toISOString(),
                updatedBy: user?.uid || null,
            }, { merge: true });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            console.error('Error saving email report config:', e);
        }
        setSaving(false);
    };

    const handleSendNow = async () => {
        if (sending) return;
        setSending(true);
        setSendResult(null);
        try {
            const fn = httpsCallable(functions, 'executePerformanceReport');
            const result = await fn();
            setSendResult({
                ok: true,
                data: result.data,
            });
        } catch (err) {
            setSendResult({
                ok: false,
                error: err.message,
            });
        }
        setSending(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddEmail();
        }
    };

    const toggleSection = (key) => {
        setSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const sectionConfig = [
        { key: 'executiveSummary', label: 'Resumen Ejecutivo', icon: BarChart3, color: 'text-blue-400' },
        { key: 'risks', label: 'Riesgos Operacionales', icon: Shield, color: 'text-red-400' },
        { key: 'kpis', label: 'KPIs del Equipo', icon: Target, color: 'text-emerald-400' },
        { key: 'individualScores', label: 'Rendimiento Individual', icon: Users, color: 'text-purple-400' },
        { key: 'overdueTasks', label: 'Tareas Vencidas', icon: FileText, color: 'text-orange-400' },
        { key: 'recommendations', label: 'Recomendaciones', icon: Zap, color: 'text-amber-400' },
    ];

    return (
        <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between"
            >
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <Mail className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">
                            Reporte por Email
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                            analyzeops.com — {enabled ? 'Activo' : 'Inactivo'} 
                            {recipients.length > 0 ? ` · ${recipients.length} destinatarios` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Status badge */}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        enabled 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-700/50 text-slate-500 border border-slate-600/30'
                    }`}>
                        {enabled ? '● ON' : '○ OFF'}
                    </span>
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
            </button>

            {/* Expandable content */}
            {expanded && (
                <div className="mt-5 space-y-5 border-t border-slate-800 pt-5">

                    {/* Enable toggle */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                        <div>
                            <p className="text-sm font-bold text-white">Reporte automático activado</p>
                            <p className="text-xs text-slate-500">
                                Envía el reporte diario al cierre del día
                            </p>
                        </div>
                        <button
                            onClick={() => setEnabled(!enabled)}
                            className={`relative w-12 h-7 rounded-full transition-all ${
                                enabled ? 'bg-indigo-500' : 'bg-slate-700'
                            }`}
                        >
                            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow ${
                                enabled ? 'left-6' : 'left-1'
                            }`} />
                        </button>
                    </div>

                    {/* Channels */}
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                            Canales de entrega
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setEmailChannel(!emailChannel)}
                                className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                                    emailChannel
                                        ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                                        : 'bg-slate-800/50 border-slate-700 text-slate-500'
                                }`}
                            >
                                <Mail className="w-4 h-4" />
                                <div className="text-left">
                                    <p className="text-xs font-bold">Email</p>
                                    <p className="text-[10px] opacity-70">via Resend</p>
                                </div>
                                <span className={`ml-auto w-2 h-2 rounded-full ${
                                    emailChannel ? 'bg-indigo-400' : 'bg-slate-600'
                                }`} />
                            </button>
                            <button
                                onClick={() => setTelegramChannel(!telegramChannel)}
                                className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                                    telegramChannel
                                        ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                                        : 'bg-slate-800/50 border-slate-700 text-slate-500'
                                }`}
                            >
                                <Send className="w-4 h-4" />
                                <div className="text-left">
                                    <p className="text-xs font-bold">Telegram</p>
                                    <p className="text-[10px] opacity-70">Resumen texto</p>
                                </div>
                                <span className={`ml-auto w-2 h-2 rounded-full ${
                                    telegramChannel ? 'bg-sky-400' : 'bg-slate-600'
                                }`} />
                            </button>
                        </div>
                    </div>

                    {/* Schedule */}
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                            Hora de envío
                        </p>
                        <div className="flex items-center gap-3">
                            <Clock className="w-4 h-4 text-indigo-400" />
                            <input
                                type="time"
                                value={scheduleTime}
                                onChange={e => setScheduleTime(e.target.value)}
                                disabled={!enabled}
                                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40 w-32"
                            />
                            <span className="text-[10px] text-slate-500">
                                Lunes a Viernes · America/Mexico_City
                            </span>
                        </div>
                    </div>

                    {/* Recipients */}
                    {emailChannel && (
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                                Destinatarios de email
                            </p>
                            
                            {/* Email list */}
                            <div className="space-y-1.5 mb-3">
                                {recipients.map(email => (
                                    <div key={email} className="flex items-center justify-between px-3 py-2 bg-slate-800/60 rounded-lg border border-slate-700/50 group">
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-3 h-3 text-indigo-400" />
                                            <span className="text-xs text-slate-300 font-mono">{email}</span>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveEmail(email)}
                                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                {recipients.length === 0 && (
                                    <p className="text-xs text-slate-600 italic py-2">
                                        No hay destinatarios configurados
                                    </p>
                                )}
                            </div>

                            {/* Add email input */}
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={e => { setNewEmail(e.target.value); setEmailError(''); }}
                                        onKeyDown={handleKeyDown}
                                        placeholder="nuevo@email.com"
                                        className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600 ${
                                            emailError ? 'border-red-500' : 'border-slate-700'
                                        }`}
                                    />
                                    {emailError && (
                                        <p className="absolute -bottom-4 left-0 text-[10px] text-red-400">{emailError}</p>
                                    )}
                                </div>
                                <button
                                    onClick={handleAddEmail}
                                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all flex items-center gap-1 text-xs font-bold"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Agregar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Report sections */}
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                            Secciones del reporte
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {sectionConfig.map(({ key, label, icon: Icon, color }) => (
                                <button
                                    key={key}
                                    onClick={() => toggleSection(key)}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all ${
                                        sections[key]
                                            ? 'bg-slate-800/80 border-slate-600 text-slate-200'
                                            : 'bg-slate-900/50 border-slate-800 text-slate-600'
                                    }`}
                                >
                                    <Icon className={`w-3.5 h-3.5 ${sections[key] ? color : 'text-slate-700'}`} />
                                    <span className="text-[11px] font-semibold">{label}</span>
                                    <span className={`ml-auto w-1.5 h-1.5 rounded-full ${
                                        sections[key] ? 'bg-emerald-400' : 'bg-slate-700'
                                    }`} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg transition-all flex items-center gap-1.5 disabled:bg-slate-600"
                        >
                            <Save className="w-3.5 h-3.5" />
                            {saving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>

                        <button
                            onClick={handleSendNow}
                            disabled={sending || recipients.length === 0}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg transition-all flex items-center gap-1.5 disabled:bg-slate-700 disabled:text-slate-500"
                        >
                            {sending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Send className="w-3.5 h-3.5" />
                            )}
                            {sending ? 'Enviando...' : 'Enviar Ahora'}
                        </button>

                        {saved && (
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Guardado
                            </span>
                        )}
                    </div>

                    {/* Send result */}
                    {sendResult && (
                        <div className={`p-3 rounded-xl border ${
                            sendResult.ok
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : 'bg-red-500/10 border-red-500/30'
                        }`}>
                            <div className="flex items-start gap-2">
                                {sendResult.ok ? (
                                    <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                                )}
                                <div>
                                    <p className={`text-xs font-bold ${
                                        sendResult.ok ? 'text-emerald-300' : 'text-red-300'
                                    }`}>
                                        {sendResult.ok ? '✅ Reporte enviado exitosamente' : '❌ Error al enviar'}
                                    </p>
                                    {sendResult.ok && sendResult.data && (
                                        <p className="text-[10px] text-emerald-400/70 mt-1">
                                            Email: {sendResult.data.emailSent ? '✓' : '✗'} · 
                                            Telegram: {sendResult.data.telegramSent || 0} enviados · 
                                            Errores: {sendResult.data.failedCount || 0}
                                        </p>
                                    )}
                                    {sendResult.error && (
                                        <p className="text-[10px] text-red-400/70 mt-1">{sendResult.error}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Last sent info */}
                    {config?.lastSentAt && (
                        <div className="text-[10px] text-slate-600 text-right">
                            Último envío: {new Date(config.lastSentAt).toLocaleString()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
