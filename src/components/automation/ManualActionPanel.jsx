import React, { useState } from 'react';
import {
    Play, Send, Loader2, CheckCircle, XCircle,
    Zap, Users, AlertTriangle, Wrench
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

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
                                {m.displayName || m.name || m.email} {m.operationalRole ? `(${m.operationalRole})` : ''}
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

            {/* Break Hours Migration (temporary) */}
            <MigrationPanel />

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

/**
 * MigrationPanel — Temporary component for running the break hours migration.
 * Can be removed after migration is executed successfully.
 */
function MigrationPanel() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleMigrate = async () => {
        if (!window.confirm('¿Ejecutar migración de break hours? Esto recalculará TODOS los timeLogs existentes.')) return;
        setLoading(true);
        setResult(null);
        try {
            const fn = httpsCallable(functions, 'migrateBreakHours');
            const res = await fn();
            setResult({ ok: true, data: res.data });
        } catch (err) {
            setResult({ ok: false, error: err.message });
        }
        setLoading(false);
    };

    return (
        <div className="bg-amber-900/20 rounded-xl p-4 border border-amber-700/50">
            <div className="flex items-center gap-2 mb-3">
                <Wrench className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-bold text-amber-300">Migración: Break Hours</h4>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">UNA VEZ</span>
            </div>
            <p className="text-xs text-amber-400/70 mb-3">
                Recalcula totalHours en todos los timeLogs existentes descontando breaks (desayuno, almuerzo, café).
                Guarda el valor original en totalHoursGross para auditoría.
            </p>
            <button
                onClick={handleMigrate}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-bold transition-colors"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                {loading ? 'Ejecutando migración...' : 'Ejecutar Migración'}
            </button>
            {result && (
                <div className={`mt-3 p-3 rounded-lg border text-sm ${result.ok ? 'bg-emerald-900/20 border-emerald-700/50 text-emerald-300' : 'bg-red-900/20 border-red-700/50 text-red-300'}`}>
                    {result.ok ? (
                        <>
                            <p className="font-bold">✅ Migración completada</p>
                            <p className="text-xs mt-1">Logs actualizados: {result.data?.updated || 0} | Tareas recalculadas: {result.data?.tasksRecalculated || 0}</p>
                        </>
                    ) : (
                        <p>❌ Error: {result.error}</p>
                    )}
                </div>
            )}
        </div>
    );
}
