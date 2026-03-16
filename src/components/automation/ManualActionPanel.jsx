import React, { useState } from 'react';
import {
    Play, Send, Loader2, CheckCircle, XCircle,
    Zap, Users, AlertTriangle
} from 'lucide-react';

/**
 * ManualActionPanel — Admin controls for triggering automation actions.
 * 
 * @param {Object} props
 * @param {Array} props.routines - Available routines
 * @param {Array} props.teamMembers - Team members for test message target
 * @param {Function} props.onExecuteRoutine - (routineKey) => Promise
 * @param {Function} props.onSendTestMessage - (userId, message?) => Promise
 */
export default function ManualActionPanel({ routines = [], teamMembers = [], onExecuteRoutine, onSendTestMessage }) {
    const [selectedRoutine, setSelectedRoutine] = useState('');
    const [selectedUser, setSelectedUser] = useState('');
    const [testMessage, setTestMessage] = useState('');
    const [routineLoading, setRoutineLoading] = useState(false);
    const [testLoading, setTestLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleExecuteRoutine = async () => {
        if (!selectedRoutine || !onExecuteRoutine) return;
        setRoutineLoading(true);
        setResult(null);
        try {
            const res = await onExecuteRoutine(selectedRoutine);
            setResult({ type: 'success', action: 'routine', data: res });
        } catch (err) {
            setResult({ type: 'error', action: 'routine', message: err.message });
        } finally {
            setRoutineLoading(false);
        }
    };

    const handleSendTest = async () => {
        if (!selectedUser || !onSendTestMessage) return;
        setTestLoading(true);
        setResult(null);
        try {
            const res = await onSendTestMessage(selectedUser, testMessage || undefined);
            setResult({ type: 'success', action: 'test', data: res });
        } catch (err) {
            setResult({ type: 'error', action: 'test', message: err.message });
        } finally {
            setTestLoading(false);
        }
    };

    // Filter users with telegram link
    const linkedUsers = teamMembers.filter(m =>
        m.providerLinks?.telegram?.chatId || m.telegramChatId || m.isAutomationParticipant
    );

    return (
        <div className="space-y-4">
            {/* Execute Routine */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-sm font-bold text-white">Ejecutar Rutina Manual</h4>
                </div>

                <div className="flex gap-2">
                    <select
                        value={selectedRoutine}
                        onChange={(e) => setSelectedRoutine(e.target.value)}
                        className="flex-1 bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                        <option value="">Seleccionar rutina...</option>
                        {routines.map(r => (
                            <option key={r.key} value={r.key}>
                                {r.name || r.key} {r.enabled ? '✅' : '⏸️'}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={handleExecuteRoutine}
                        disabled={!selectedRoutine || routineLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        {routineLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Ejecutar
                    </button>
                </div>

                <p className="text-xs text-slate-500 mt-2">
                    La rutina se ejecutará con trigger manual, respetando dryRun si está activo.
                </p>
            </div>

            {/* Send Test Message */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                    <Send className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-bold text-white">Enviar Mensaje de Prueba</h4>
                </div>

                <div className="space-y-2">
                    <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                        <option value="">Seleccionar usuario...</option>
                        {linkedUsers.map(m => (
                            <option key={m.id || m.uid} value={m.id || m.uid}>
                                {m.name || m.email} {m.operationalRole ? `(${m.operationalRole})` : ''}
                            </option>
                        ))}
                        {linkedUsers.length === 0 && (
                            <option disabled>No hay usuarios con Telegram vinculado</option>
                        )}
                    </select>

                    <input
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        placeholder="Mensaje personalizado (opcional)"
                        className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />

                    <button
                        onClick={handleSendTest}
                        disabled={!selectedUser || testLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar
                    </button>
                </div>
            </div>

            {/* Result Feedback */}
            {result && (
                <div className={`rounded-xl p-3 border ${result.type === 'success'
                    ? 'bg-emerald-900/20 border-emerald-700/50'
                    : 'bg-red-900/20 border-red-700/50'
                    }`}>
                    <div className="flex items-center gap-2">
                        {result.type === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className={`text-sm font-medium ${result.type === 'success' ? 'text-emerald-300' : 'text-red-300'
                            }`}>
                            {result.type === 'success'
                                ? `Acción completada — ${result.data?.sentCount ?? 0} enviados`
                                : `Error: ${result.message}`
                            }
                        </span>
                    </div>
                    {result.data?.runId && (
                        <p className="text-xs text-slate-500 mt-1">Run ID: {result.data.runId}</p>
                    )}
                </div>
            )}
        </div>
    );
}
