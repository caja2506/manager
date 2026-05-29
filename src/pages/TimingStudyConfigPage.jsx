import React from 'react';
import { useEngineeringData } from '../hooks/useEngineeringData';
import TimingActionsCard from '../components/ui/TimingActionsCard';
import MotionProfilesCard from '../components/ui/MotionProfilesCard';
import MotionStandardsKanban from '../components/engineering/MotionStandardsKanban';
import ActuatorGroupsEditor from '../components/engineering/ActuatorGroupsEditor';
import { Timer, Zap, Gauge } from 'lucide-react';

// ============================================================
// TimingStudyConfigPage
// ============================================================
// Sub-página dedicada a toda la configuración de Estudio de Tiempos:
//   • Grupos de Actuadores (con subtipos, perfiles, acciones)
//   • Motion Standards (tiempos fijos y clasificadores)
//   • Acciones de Timing (lista global)
//   • Perfiles de Movimiento (lista global)
// ============================================================
export default function TimingStudyConfigPage() {
    const { timingActions, setTimingActions, motionProfiles, setMotionProfiles } = useEngineeringData();

    return (
        <div className="w-full space-y-6 pb-20">
            {/* Page Header */}
            <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-cyan-500/15 rounded-2xl flex items-center justify-center">
                    <Timer className="w-6 h-6 text-cyan-500 dark:text-cyan-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">
                        Estudio de Tiempos
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Grupos de actuadores, perfiles de movimiento, acciones y estándares de motion.
                    </p>
                </div>
            </div>

            {/* Global Cards: Acciones + Perfiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="h-[420px]">
                    <TimingActionsCard
                        title="Acciones de Timing"
                        subtitle="Acciones globales"
                        icon={Zap}
                        iconBg="bg-cyan-100 dark:bg-cyan-500/10"
                        iconColor="text-cyan-600 dark:text-cyan-400"
                        items={(timingActions || []).map(t => ({ name: t.name, description: t.description || '' }))}
                        onSave={async (editedItems) => {
                            const { supabase } = await import('../supabase');
                            const { data: existing } = await supabase.from('timing_actions').select('id, name');
                            const editedNames = editedItems.map(e => e.name.trim()).filter(Boolean);
                            for (const ex of (existing || [])) {
                                if (!editedNames.includes(ex.name)) {
                                    await supabase.from('timing_actions').delete().eq('id', ex.id);
                                }
                            }
                            for (const item of editedItems) {
                                if (!item.name.trim()) continue;
                                await supabase.from('timing_actions').upsert(
                                    { name: item.name.trim(), description: item.description?.trim() || '' },
                                    { onConflict: 'name' }
                                );
                            }
                            const { data: fresh } = await supabase.from('timing_actions').select('id, name, description').order('name');
                            if (fresh && setTimingActions) setTimingActions(fresh);
                        }}
                    />
                </div>
                <div className="h-[420px]">
                    <MotionProfilesCard
                        title="Perfiles de Movimiento"
                        subtitle="Perfiles globales"
                        icon={Gauge}
                        iconBg="bg-violet-100 dark:bg-violet-500/10"
                        iconColor="text-violet-600 dark:text-violet-400"
                        items={(motionProfiles || []).map(p => ({ name: p.name, value: p.value, unit: p.unit || 'mm/s' }))}
                        onSave={async (editedItems) => {
                            const { supabase } = await import('../supabase');
                            const { data: existing } = await supabase.from('motion_profiles').select('id, name');
                            const editedNames = editedItems.map(e => e.name.trim()).filter(Boolean);
                            for (const ex of (existing || [])) {
                                if (!editedNames.includes(ex.name)) {
                                    await supabase.from('motion_profiles').delete().eq('id', ex.id);
                                }
                            }
                            for (const item of editedItems) {
                                if (!item.name.trim()) continue;
                                await supabase.from('motion_profiles').upsert(
                                    { name: item.name.trim(), value: Number(item.value) || 0, unit: item.unit || 'mm/s' },
                                    { onConflict: 'name' }
                                );
                            }
                            const { data: fresh } = await supabase.from('motion_profiles').select('id, name, value, unit').order('name');
                            if (fresh && setMotionProfiles) setMotionProfiles(fresh);
                        }}
                    />
                </div>
            </div>

            {/* Editor: Grupos de Actuadores */}
            <div className="pb-2">
                <ActuatorGroupsEditor />
            </div>

            {/* Kanban: Motion Standards */}
            <div className="pb-2">
                <MotionStandardsKanban />
            </div>
        </div>
    );
}
