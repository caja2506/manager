import React from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAppData } from '../contexts/AppDataContext';
import ManagedListCard from '../components/ui/ManagedListCard';
import { Truck, Tag, LayoutList, Database } from 'lucide-react';

export default function BomListsPage() {
    const { managedLists, handleSaveManagedList } = useAppData();

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <PageHeader title="" showBack={true} />
            
            {/* Page Header */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-cyan-500/15 rounded-2xl flex items-center justify-center">
                    <Database className="w-6 h-6 text-cyan-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">Listas BOM (Catálogo)</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Administra las listas maestras utilizadas en la ingeniería de costos y catálogo.</p>
                </div>
            </div>

            {/* Grid of Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ManagedListCard
                    title="Proveedores"
                    subtitle="Empresas suministradoras de materiales"
                    icon={Truck}
                    iconBg="bg-cyan-100 dark:bg-cyan-500/10"
                    iconColor="text-cyan-600 dark:text-cyan-400"
                    items={(managedLists?.providers || []).map(p => p.name)}
                    onSave={(data) => handleSaveManagedList({ type: 'provider', data })}
                />
                <ManagedListCard
                    title="Marcas"
                    subtitle="Marcas comerciales de componentes"
                    icon={Tag}
                    iconBg="bg-violet-100 dark:bg-violet-500/10"
                    iconColor="text-violet-600 dark:text-violet-400"
                    items={(managedLists?.brands || []).map(b => b.name)}
                    onSave={(data) => handleSaveManagedList({ type: 'brand', data })}
                />
                <ManagedListCard
                    title="Categorías"
                    subtitle="Clasificación de partes y componentes"
                    icon={LayoutList}
                    iconBg="bg-amber-100 dark:bg-amber-500/10"
                    iconColor="text-amber-600 dark:text-amber-400"
                    items={(managedLists?.categories || []).map(c => c.name)}
                    onSave={(data) => handleSaveManagedList({ type: 'category', data })}
                />
            </div>
        </div>
    );
}
