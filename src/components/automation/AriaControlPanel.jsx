import React, { useState, useEffect, useCallback } from 'react';
import {
    Bot, Power, PowerOff, Clock, Shield, Brain, MessageSquare,
    Eye, Trash2, ChevronDown, ChevronUp, Save, Loader2,
    CheckCircle, AlertTriangle, Edit3, History, Zap, Search,
    RefreshCw, Star, Tag, User, ClipboardList
} from 'lucide-react';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── ARIA CONTROL PANEL ──────────────────────────────────────
// Main panel for the ARIA tab in Automation Control Center.
// Sub-sections: Status + Kill Switch, Soul Editor, Memory Viewer

export default function AriaControlPanel() {
    return (
        <div className="space-y-4">
            <AriaStatusCard />
            <AriaReviewDashboard />
            <AriaSoulEditor />
            <AriaMemoryViewer />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// 1. STATUS + KILL SWITCH + SCHEDULE
// ═══════════════════════════════════════════════════════════════

function AriaStatusCard() {
    const { user } = useAuth();
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [nudgeStats, setNudgeStats] = useState({ today: 0, week: 0 });

    // Load config from settings table
    const loadConfig = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'proactiveAgent')
                .single();
            setConfig(data?.value || { enabled: false, startTime: '07:00', endTime: '17:00', maxNudgesPerDay: 3 });
        } catch { setConfig({ enabled: false, startTime: '07:00', endTime: '17:00', maxNudgesPerDay: 3 }); }
        setLoading(false);
    }, []);

    // Load nudge stats
    const loadStats = useCallback(async () => {
        try {
            const todayCutoff = new Date(); todayCutoff.setHours(0, 0, 0, 0);
            const weekCutoff = new Date(Date.now() - 7 * 86400000);
            const [{ count: today }, { count: week }] = await Promise.all([
                supabase.from('agent_nudges').select('id', { count: 'exact', head: true }).gte('sent_at', todayCutoff.toISOString()),
                supabase.from('agent_nudges').select('id', { count: 'exact', head: true }).gte('sent_at', weekCutoff.toISOString()),
            ]);
            setNudgeStats({ today: today || 0, week: week || 0 });
        } catch { /* silent */ }
    }, []);

    useEffect(() => { loadConfig(); loadStats(); }, [loadConfig, loadStats]);

    const handleToggle = async () => {
        const newVal = !config?.enabled;
        const updated = { ...config, enabled: newVal, updatedAt: new Date().toISOString(), updatedBy: user?.uid };
        setConfig(updated);
        await supabase.from('settings').upsert({ key: 'proactiveAgent', value: updated, category: 'aria', updated_at: updated.updatedAt }, { onConflict: 'key' });
    };

    const handleKillSwitch = async () => {
        if (!window.confirm('⚠️ ¿Desactivar ARIA inmediatamente? No enviará más nudges hasta que la reactives.')) return;
        const updated = { ...config, enabled: false, killedAt: new Date().toISOString(), killedBy: user?.uid, updatedAt: new Date().toISOString() };
        setConfig(updated);
        await supabase.from('settings').upsert({ key: 'proactiveAgent', value: updated, category: 'aria', updated_at: updated.updatedAt }, { onConflict: 'key' });
    };

    const handleScheduleSave = async (field, value) => {
        const updated = { ...config, [field]: value, updatedAt: new Date().toISOString() };
        setConfig(updated);
        await supabase.from('settings').upsert({ key: 'proactiveAgent', value: updated, category: 'aria', updated_at: updated.updatedAt }, { onConflict: 'key' });
    };

    if (loading) return <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto" /></div>;

    const isActive = config?.enabled;

    return (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5">
            {/* Header with status */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                        <Bot className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">Estado del Agente</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                            ARIA — AI para Ingeniería de Automatización
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Toggle */}
                    <button onClick={handleToggle}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-slate-700/50 text-slate-400 border border-slate-600/30 hover:bg-slate-700'}`}>
                        {isActive ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                        {isActive ? 'Activa' : 'Inactiva'}
                    </button>
                    {/* Kill switch */}
                    {isActive && (
                        <button onClick={handleKillSwitch}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold transition-all">
                            <Shield className="w-3.5 h-3.5" />
                            Kill Switch
                        </button>
                    )}
                </div>
            </div>

            {/* Stats + Schedule grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <StatBox label="Nudges Hoy" value={nudgeStats.today} color="text-indigo-400" />
                <StatBox label="Nudges 7 días" value={nudgeStats.week} color="text-violet-400" />
                <StatBox label="Max/día/usuario" value={config?.maxNudgesPerDay || 3} color="text-amber-400" />
                <StatBox label="Reglas Activas" value="11" color="text-emerald-400" />
            </div>

            {/* Schedule */}
            <div className="flex items-center gap-4 bg-slate-900/50 rounded-xl p-3 border border-slate-700/30">
                <Clock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span className="text-xs text-slate-400 font-bold">Horario:</span>
                <input type="time" value={config?.startTime || '07:00'}
                    onChange={e => handleScheduleSave('startTime', e.target.value)}
                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 w-24" />
                <span className="text-xs text-slate-500">a</span>
                <input type="time" value={config?.endTime || '17:00'}
                    onChange={e => handleScheduleSave('endTime', e.target.value)}
                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 w-24" />
                <span className="text-[10px] text-slate-600">L-V · America/Costa_Rica</span>
            </div>

            {config?.killedAt && (
                <div className="mt-3 flex items-center gap-2 text-[10px] text-red-400/60">
                    <AlertTriangle className="w-3 h-3" />
                    Kill switch activado: {new Date(config.killedAt).toLocaleString()}
                </div>
            )}
        </div>
    );
}

function StatBox({ label, value, color }) {
    return (
        <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/30 text-center">
            <p className={`text-lg font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// 2. SOUL EDITOR (System Prompt)
// ═══════════════════════════════════════════════════════════════

function AriaSoulEditor() {
    const { user } = useAuth();
    const [expanded, setExpanded] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [originalPrompt, setOriginalPrompt] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(false);

    // Default persona from agentPersona.js (displayed read-only if no custom exists)
    const DEFAULT_SOUL = `Eres ARIA (ARIA — AI para Ingeniería de Automatización), la asistente AI del departamento de Automation Engineering.

═══ PERSONALIDAD ═══
- Hablas español natural, como una colega confiable y profesional
- Eres directa pero cálida — no robótica, no infantil
- Usas emojis con moderación y propósito (✅ ⚠️ 📊)
- Te preocupas genuinamente por el cumplimiento de la metodología
- Celebras logros del equipo — reconoces cuando alguien hace bien su trabajo
- Si no sabes algo, dices "no tengo esa información" — nunca inventas datos

═══ REGLAS ═══
1. NUNCA INVENTES TAREAS ni datos ficticios
2. NUNCA INVENTES MÉTRICAS — usa solo datos del sistema
3. Responde en máximo 300 palabras. Sé concisa.
4. Formato HTML de Telegram (solo <b>, <i>)
5. Si te hacen preguntas personales, redirige al trabajo`;

    const loadSoul = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await supabase.from('settings').select('value').eq('key', 'ariaPersona').single();
            if (data?.value?.customPrompt) {
                setPrompt(data.value.customPrompt);
                setOriginalPrompt(data.value.customPrompt);
            } else {
                setPrompt(DEFAULT_SOUL);
                setOriginalPrompt(DEFAULT_SOUL);
            }
        } catch {
            setPrompt(DEFAULT_SOUL);
            setOriginalPrompt(DEFAULT_SOUL);
        }
        setLoading(false);
    }, []);

    useEffect(() => { if (expanded && !prompt) loadSoul(); }, [expanded, prompt, loadSoul]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await supabase.from('settings').upsert({
                key: 'ariaPersona',
                value: { customPrompt: prompt, updatedAt: new Date().toISOString(), updatedBy: user?.uid },
                category: 'aria',
                updated_at: new Date().toISOString(),
            }, { onConflict: 'key' });
            setOriginalPrompt(prompt);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) { console.error('Save soul error:', e); }
        setSaving(false);
    };

    const hasChanges = prompt !== originalPrompt;

    return (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-500/20 rounded-lg"><Brain className="w-5 h-5 text-violet-400" /></div>
                    <div className="text-left">
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">Alma de ARIA</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">System prompt — personalidad, reglas, y comportamiento</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">Sin guardar</span>}
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
            </button>

            {expanded && (
                <div className="px-5 pb-5 space-y-3 border-t border-slate-700/30 pt-4">
                    {loading ? (
                        <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-violet-400 mx-auto" /></div>
                    ) : (
                        <>
                            <textarea
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                rows={14}
                                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3 text-xs text-slate-300 font-mono leading-relaxed resize-y outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
                                placeholder="Define la personalidad y reglas de ARIA..."
                            />
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] text-slate-600">{prompt.length} caracteres · Los cambios se aplican en el próximo mensaje de ARIA</p>
                                <div className="flex items-center gap-2">
                                    {saved && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Guardado</span>}
                                    <button onClick={() => { setPrompt(DEFAULT_SOUL); }}
                                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">
                                        Restaurar default
                                    </button>
                                    <button onClick={handleSave} disabled={saving || !hasChanges}
                                        className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-xs font-bold transition-all">
                                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// 3. MEMORY VIEWER (Memories + Nudges + Conversations)
// ═══════════════════════════════════════════════════════════════

function AriaMemoryViewer() {
    const [expanded, setExpanded] = useState(false);
    const [tab, setTab] = useState('memories'); // memories | nudges | conversations
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    const loadData = useCallback(async (tabKey) => {
        setLoading(true);
        try {
            if (tabKey === 'memories') {
                const { data: rows } = await supabase.from('agent_memory')
                    .select('id, user_id, memory_type, category, content, importance, created_at')
                    .order('created_at', { ascending: false }).limit(100);
                setData(rows || []);
            } else if (tabKey === 'nudges') {
                const { data: rows } = await supabase.from('agent_nudges')
                    .select('id, user_id, rule_key, target_id, message_preview, sent_at')
                    .order('sent_at', { ascending: false }).limit(100);
                setData(rows || []);
            } else if (tabKey === 'conversations') {
                const { data: rows } = await supabase.from('agent_conversations')
                    .select('chat_id, user_id, message_count, last_interaction_at, summary')
                    .order('last_interaction_at', { ascending: false }).limit(50);
                setData(rows || []);
            }
        } catch { setData([]); }
        setLoading(false);
    }, []);

    useEffect(() => { if (expanded) loadData(tab); }, [expanded, tab, loadData]);

    const handleDeleteMemory = async (id) => {
        if (!window.confirm('¿Eliminar esta memoria?')) return;
        await supabase.from('agent_memory').delete().eq('id', id);
        setData(prev => prev.filter(m => m.id !== id));
    };

    const filtered = data.filter(d => {
        if (!search) return true;
        const s = search.toLowerCase();
        return JSON.stringify(d).toLowerCase().includes(s);
    });

    const TABS = [
        { key: 'memories', label: 'Memorias', icon: Brain, count: data.length },
        { key: 'nudges', label: 'Nudges Enviados', icon: MessageSquare, count: data.length },
        { key: 'conversations', label: 'Conversaciones', icon: History, count: data.length },
    ];

    return (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/20 rounded-lg"><Eye className="w-5 h-5 text-cyan-400" /></div>
                    <div className="text-left">
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">Memorias de ARIA</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Recuerdos, nudges enviados, y conversaciones</p>
                    </div>
                </div>
                {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>

            {expanded && (
                <div className="px-5 pb-5 space-y-3 border-t border-slate-700/30 pt-4">
                    {/* Sub-tabs */}
                    <div className="flex items-center gap-1 bg-slate-900/50 rounded-lg p-1">
                        {TABS.map(t => {
                            const Icon = t.icon;
                            return (
                                <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${tab === t.key
                                        ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                                    <Icon className="w-3 h-3" /> {t.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar..." className="w-full pl-9 pr-3 py-2 bg-slate-900/60 border border-slate-700/50 rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500" />
                        <button onClick={() => loadData(tab)} className="absolute right-2 top-1/2 -translate-y-1/2">
                            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 hover:text-cyan-400 transition-colors ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin text-cyan-400 mx-auto" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-6 text-xs text-slate-600">No hay datos</div>
                    ) : (
                        <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                            {tab === 'memories' && filtered.map(m => (
                                <div key={m.id} className="flex items-start gap-3 p-3 bg-slate-900/40 rounded-xl border border-slate-700/20 group hover:border-slate-600/40 transition-all">
                                    <div className="flex-shrink-0 mt-0.5">
                                        <Star className={`w-3.5 h-3.5 ${m.importance >= 7 ? 'text-amber-400' : m.importance >= 4 ? 'text-slate-400' : 'text-slate-600'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-300 leading-relaxed">{m.content}</p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">{m.memory_type}</span>
                                            {m.category && <span className="text-[9px] bg-cyan-900/30 text-cyan-500 px-1.5 py-0.5 rounded">{m.category}</span>}
                                            <span className="text-[9px] text-slate-600">{new Date(m.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteMemory(m.id)} className="opacity-0 group-hover:opacity-100 text-red-400/50 hover:text-red-400 transition-all">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                            {tab === 'nudges' && filtered.map(n => (
                                <div key={n.id} className="p-3 bg-slate-900/40 rounded-xl border border-slate-700/20">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] bg-indigo-900/30 text-indigo-400 px-2 py-0.5 rounded font-bold">{n.rule_key}</span>
                                        <span className="text-[10px] text-slate-600">{new Date(n.sent_at).toLocaleString()}</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">{n.message_preview || '—'}</p>
                                    {n.user_id && <p className="text-[9px] text-slate-600 mt-1">User: {n.user_id?.substring(0, 12)}...</p>}
                                </div>
                            ))}
                            {tab === 'conversations' && filtered.map(c => (
                                <div key={c.chat_id} className="p-3 bg-slate-900/40 rounded-xl border border-slate-700/20">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <User className="w-3 h-3 text-slate-500" />
                                            <span className="text-xs font-bold text-slate-300">Chat {c.chat_id}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-600">{c.message_count || 0} msgs</span>
                                    </div>
                                    {c.summary && <p className="text-xs text-slate-500 mt-1 italic">{c.summary}</p>}
                                    <p className="text-[9px] text-slate-600 mt-1">Última: {c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleString() : '—'}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// 4. REVIEW TASK DASHBOARD
// ═══════════════════════════════════════════════════════════════

function AriaReviewDashboard() {
    const [expanded, setExpanded] = useState(false);
    const [reviews, setReviews] = useState(null);
    const [loading, setLoading] = useState(false);
    const [lastRun, setLastRun] = useState(null);

    const loadReviews = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await supabase.from('settings').select('value').eq('key', 'ariaLastReviews').single();
            if (data?.value) {
                setReviews(data.value.reviews || []);
                setLastRun(data.value.lastRun);
            }
        } catch { setReviews([]); }
        setLoading(false);
    }, []);

    useEffect(() => { if (expanded && !reviews) loadReviews(); }, [expanded, reviews, loadReviews]);

    const REVIEW_ICONS = {
        gantt_review: { icon: '📅', label: 'Revisión Gantt', color: 'border-blue-500/30 bg-blue-500/5' },
        risk_pulse: { icon: '🔴', label: 'Pulso de Riesgos', color: 'border-orange-500/30 bg-orange-500/5' },
        workload_balance: { icon: '📊', label: 'Balance de Carga', color: 'border-violet-500/30 bg-violet-500/5' },
        deadline_watch: { icon: '⏰', label: 'Vigilancia de Fechas', color: 'border-amber-500/30 bg-amber-500/5' },
    };

    return (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg"><ClipboardList className="w-5 h-5 text-emerald-400" /></div>
                    <div className="text-left">
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">Tareas de Revisión</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Resultados de las revisiones automáticas de ARIA</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {lastRun && <span className="text-[10px] text-slate-600">Última: {new Date(lastRun).toLocaleString()}</span>}
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
            </button>

            {expanded && (
                <div className="px-5 pb-5 space-y-3 border-t border-slate-700/30 pt-4">
                    {loading ? (
                        <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin text-emerald-400 mx-auto" /></div>
                    ) : !reviews || reviews.length === 0 ? (
                        <div className="text-center py-8">
                            <ClipboardList className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                            <p className="text-xs text-slate-600">ARIA aún no ha ejecutado revisiones.</p>
                            <p className="text-[10px] text-slate-700 mt-1">Las revisiones se ejecutan automáticamente durante el horario operativo.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {reviews.map((r, i) => {
                                const meta = REVIEW_ICONS[r.type] || { icon: '📋', label: r.type, color: 'border-slate-500/30' };
                                const isOk = r.findings === 0;
                                return (
                                    <div key={i} className={`p-4 rounded-xl border ${meta.color} transition-all hover:border-opacity-60`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base">{meta.icon}</span>
                                                <span className="text-xs font-bold text-slate-300">{meta.label}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isOk
                                                    ? 'bg-emerald-500/20 text-emerald-400'
                                                    : 'bg-amber-500/20 text-amber-400'}`}>
                                                    {isOk ? '✅ Sin hallazgos' : `⚠️ ${r.findings} hallazgo${r.findings !== 1 ? 's' : ''}`}
                                                </span>
                                                {r.timestamp && <span className="text-[9px] text-slate-600">{new Date(r.timestamp).toLocaleTimeString()}</span>}
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed">{r.summary}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Review schedule info */}
                    <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/20">
                        <p className="text-[10px] text-slate-600 font-bold uppercase mb-1.5">Calendario de Revisiones</p>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                            <span>📅 Gantt Review — 7:00 AM</span>
                            <span>🔴 Risk Pulse — 8:00 AM y 2:00 PM</span>
                            <span>📊 Workload Balance — 8:00 AM</span>
                            <span>⏰ Deadline Watch — 9:00 AM</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
