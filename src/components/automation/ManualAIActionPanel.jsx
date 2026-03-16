import React, { useState } from 'react';
import { FlaskConical, Send, RefreshCw, Loader2, Brain, FileText } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

/**
 * ManualAIActionPanel
 * 
 * Admin panel for testing AI capabilities:
 * - Test text extraction
 * - Test briefing generation
 * - Reprocess existing report
 */
export default function ManualAIActionPanel() {
    const [activeAction, setActiveAction] = useState('extraction');
    const [testText, setTestText] = useState('');
    const [briefingRole, setBriefingRole] = useState('technician');
    const [reportId, setReportId] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    async function handleTestExtraction() {
        if (!testText.trim()) return;
        setLoading(true); setError(null); setResult(null);
        try {
            const fn = httpsCallable(functions, 'testAIExtraction');
            const res = await fn({ text: testText });
            setResult(res.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleTestBriefing() {
        setLoading(true); setError(null); setResult(null);
        try {
            const fn = httpsCallable(functions, 'testAIBriefing');
            const res = await fn({ role: briefingRole, userName: 'Admin Test' });
            setResult(res.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleReprocessReport() {
        if (!reportId.trim()) return;
        setLoading(true); setError(null); setResult(null);
        try {
            const fn = httpsCallable(functions, 'reprocesarReporteConIA');
            const res = await fn({ reportId });
            setResult(res.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const ACTIONS = [
        { key: 'extraction', label: 'Extracción', icon: FileText },
        { key: 'briefing', label: 'Briefing', icon: Brain },
        { key: 'reprocess', label: 'Reprocesar', icon: RefreshCw },
    ];

    return (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-5">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-fuchsia-400" />
                Pruebas de IA — Solo Admin
            </h4>

            {/* Action tabs */}
            <div className="flex gap-1 mb-4 bg-slate-900/40 rounded-lg p-1">
                {ACTIONS.map(a => {
                    const Icon = a.icon;
                    return (
                        <button
                            key={a.key}
                            onClick={() => { setActiveAction(a.key); setResult(null); setError(null); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeAction === a.key
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {a.label}
                        </button>
                    );
                })}
            </div>

            {/* Extraction test */}
            {activeAction === 'extraction' && (
                <div className="space-y-3">
                    <p className="text-xs text-slate-400">
                        Prueba la extracción de datos de un texto de reporte (simula un mensaje de Telegram).
                    </p>
                    <textarea
                        value={testText}
                        onChange={e => setTestText(e.target.value)}
                        placeholder='Ej: "Hoy avancé un 80% en la instalación del tablero eléctrico. Trabajé 7.5 horas. Tuve un bloqueo porque no llegó el material de la bodega."'
                        className="w-full bg-slate-900/60 border border-slate-600/30 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 resize-none h-24"
                    />
                    <button
                        onClick={handleTestExtraction}
                        disabled={loading || !testText.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Probar Extracción
                    </button>
                </div>
            )}

            {/* Briefing test */}
            {activeAction === 'briefing' && (
                <div className="space-y-3">
                    <p className="text-xs text-slate-400">
                        Genera un briefing matutino de prueba para el rol seleccionado.
                    </p>
                    <select
                        value={briefingRole}
                        onChange={e => setBriefingRole(e.target.value)}
                        className="bg-slate-900/60 border border-slate-600/30 rounded-xl px-4 py-2 text-sm text-white focus:outline-none"
                    >
                        <option value="technician">Técnico</option>
                        <option value="engineer">Ingeniero</option>
                        <option value="team_lead">Team Lead</option>
                        <option value="manager">Manager</option>
                    </select>
                    <button
                        onClick={handleTestBriefing}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                        Generar Briefing
                    </button>
                </div>
            )}

            {/* Reprocess report */}
            {activeAction === 'reprocess' && (
                <div className="space-y-3">
                    <p className="text-xs text-slate-400">
                        Re-procesa un reporte existente con la IA. Ingresa el ID del documento de telegramReports.
                    </p>
                    <input
                        type="text"
                        value={reportId}
                        onChange={e => setReportId(e.target.value)}
                        placeholder="ID del documento en telegramReports"
                        className="w-full bg-slate-900/60 border border-slate-600/30 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                    />
                    <button
                        onClick={handleReprocessReport}
                        disabled={loading || !reportId.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Reprocesar con IA
                    </button>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400">
                    ❌ {error}
                </div>
            )}

            {/* Result */}
            {result && (
                <div className="mt-4 bg-slate-900/60 border border-slate-600/30 rounded-xl p-4">
                    <h5 className="text-xs font-bold text-slate-300 mb-2">Resultado:</h5>

                    {/* Briefing result — render as HTML */}
                    {activeAction === 'briefing' && result.message && (
                        <div className="bg-slate-800/80 rounded-lg p-3 text-sm text-white mb-2"
                            dangerouslySetInnerHTML={{ __html: result.message }}
                        />
                    )}

                    {/* Extraction/Reprocess result — JSON */}
                    {(activeAction === 'extraction' || activeAction === 'reprocess') && result.extracted && (
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <ResultField label="Avance" value={result.extracted.progressPercent != null ? `${result.extracted.progressPercent}%` : 'N/A'} />
                                <ResultField label="Horas" value={result.extracted.hoursWorked ?? 'N/A'} />
                                <ResultField label="Bloqueo" value={result.extracted.blockerPresent ? 'Sí' : 'No'} />
                                <ResultField label="Confianza" value={result.extracted.confidenceScore != null ? `${Math.round(result.extracted.confidenceScore * 100)}%` : 'N/A'} />
                            </div>
                            {result.extracted.normalizedSummary && (
                                <div className="bg-slate-800/80 rounded-lg px-3 py-2 text-xs text-slate-300">
                                    📝 {result.extracted.normalizedSummary}
                                </div>
                            )}
                            {result.extracted.blockerSummary && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-300">
                                    🚨 {result.extracted.blockerSummary}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Raw JSON toggle */}
                    <details className="mt-2">
                        <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-300">
                            Ver JSON completo
                        </summary>
                        <pre className="mt-1 text-[10px] text-slate-400 overflow-auto max-h-60 bg-slate-900 rounded p-2">
                            {JSON.stringify(result, null, 2)}
                        </pre>
                    </details>
                </div>
            )}
        </div>
    );
}

function ResultField({ label, value }) {
    return (
        <div className="bg-slate-800/60 rounded-lg px-3 py-2">
            <div className="text-[10px] text-slate-500">{label}</div>
            <div className="text-sm font-bold text-white">{value}</div>
        </div>
    );
}
