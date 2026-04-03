import React, { useState, useCallback } from 'react';
import { useRole } from '../contexts/RoleContext';
import UserAdminPanel from '../components/admin/UserAdminPanel';
import IPSWeightConfigPanel from '../components/admin/IPSWeightConfigPanel';
import PageHeader from '../components/layout/PageHeader';
import { backfillTimeLogNames } from '../services/backfillService';

import { Settings as SettingsIcon, Shield, Database, Loader2 } from 'lucide-react';

export default function SettingsPage() {
    const { isAdmin } = useRole();
    const [migrationLog, setMigrationLog] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [migrationResult, setMigrationResult] = useState(null);

    const handleBackfillTimeLogs = useCallback(async () => {
        if (isRunning) return;
        if (!confirm('¿Ejecutar migración de nombres en timeLogs? Esta operación actualiza registros existentes.')) return;

        setIsRunning(true);
        setMigrationLog([]);
        setMigrationResult(null);

        try {
            const result = await backfillTimeLogNames((msg) => {
                setMigrationLog(prev => [...prev, msg]);
            });
            setMigrationResult(result);
        } catch (err) {
            setMigrationLog(prev => [...prev, `❌ Error: ${err.message}`]);
        }
        setIsRunning(false);
    }, [isRunning]);

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                <Shield className="w-16 h-16 text-slate-300 mb-4" />
                <p className="text-lg font-bold">Acceso Restringido</p>
                <p className="text-sm">Solo administradores pueden acceder a esta página.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <PageHeader title="" showBack={true} />
            <div className="bg-slate-900/70 backdrop-blur-sm p-6 rounded-2xl border border-slate-800 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center">
                        <SettingsIcon className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="font-black text-2xl text-white tracking-tight">Configuración</h2>
                        <p className="text-xs text-slate-400 font-bold">Panel de administración del sistema</p>
                    </div>
                </div>
            </div>
            <UserAdminPanel />
            <IPSWeightConfigPanel />

            {/* Migration Tools */}
            <div className="bg-slate-900/70 backdrop-blur-sm p-6 rounded-2xl border border-amber-500/20 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-amber-600/20 border border-amber-500/30 rounded-xl flex items-center justify-center">
                        <Database className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="font-black text-lg text-white">Herramientas de Migración</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Solo administradores</p>
                    </div>
                </div>

                <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <p className="text-sm font-bold text-white">Backfill TimeLogs</p>
                            <p className="text-xs text-slate-400">Agrega taskTitle, projectName y displayName a todos los registros de tiempo existentes.</p>
                        </div>
                        <button
                            onClick={handleBackfillTimeLogs}
                            disabled={isRunning}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-lg transition-all disabled:bg-slate-600 flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 shrink-0"
                        >
                            {isRunning ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Ejecutando...</>
                            ) : (
                                <><Database className="w-4 h-4" /> Ejecutar</>
                            )}
                        </button>
                    </div>

                    {/* Migration log */}
                    {migrationLog.length > 0 && (
                        <div className="mt-3 bg-slate-900/80 rounded-lg p-3 max-h-60 overflow-y-auto border border-slate-700/50">
                            {migrationLog.map((line, i) => (
                                <p key={i} className={`text-[11px] font-mono leading-relaxed ${
                                    line.startsWith('✅') ? 'text-emerald-400 font-bold' :
                                    line.startsWith('❌') ? 'text-red-400 font-bold' :
                                    line.startsWith('✏️') ? 'text-indigo-300' :
                                    line.startsWith('💾') ? 'text-amber-400' :
                                    'text-slate-400'
                                }`}>
                                    {line}
                                </p>
                            ))}
                        </div>
                    )}

                    {/* Result summary */}
                    {migrationResult && (
                        <div className="mt-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                            <p className="text-xs font-bold text-emerald-400">{migrationResult.summary}</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
