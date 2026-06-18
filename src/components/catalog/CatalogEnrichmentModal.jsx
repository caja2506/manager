import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { supabase } from '../../supabase';
import { useAppData } from '../../contexts/AppDataContext';
import { useRole } from '../../contexts/RoleContext';
import {
    X, Sparkles, Play, Square, CheckCircle, AlertCircle,
    Loader2, ImageIcon, Tag, Bookmark, Check
} from 'lucide-react';

export default function CatalogEnrichmentModal({ isOpen, onClose }) {
    const { canEdit } = useRole();
    const { catalogo, managedLists } = useAppData();

    // Estado del enriquecimiento
    const [isInProgress, setIsInProgress] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentItem, setCurrentItem] = useState(null);
    const [stats, setStats] = useState({ total: 0, incomplete: 0, processed: 0, updated: 0, brandCreated: 0, categoryCreated: 0 });
    const [log, setLog] = useState([]);
    const [abortController, setAbortController] = useState(null);

    // Listado local de marcas y categorías para acelerar la concordancia en memoria
    const [localBrands, setLocalBrands] = useState([]);
    const [localCategories, setLocalCategories] = useState([]);
    const [incompleteItems, setIncompleteItems] = useState([]);

    // Cargar estadísticas y listas iniciales
    useEffect(() => {
        if (isOpen) {
            setLocalBrands(managedLists.brands || []);
            setLocalCategories(managedLists.categories || []);

            // Filtrar ítems incompletos (les falta imagen, marca o categoría)
            const incomplete = catalogo.filter(item => {
                const hasImage = !!item.imageUrl;
                const hasBrand = !!(item.brand?.id || item.brand_id);
                const hasCategory = !!(item.category?.id || item.category_id);
                return !hasImage || !hasBrand || !hasCategory;
            });

            setIncompleteItems(incomplete);
            setStats({
                total: catalogo.length,
                incomplete: incomplete.length,
                processed: 0,
                updated: 0,
                brandCreated: 0,
                categoryCreated: 0
            });
            setProgress(0);
            setCurrentItem(null);
            setLog([]);
            setIsInProgress(false);
        }
    }, [isOpen, catalogo, managedLists]);

    if (!isOpen) return null;

    // Helper para añadir logs en la pantalla
    const addLog = (message, type = 'info') => {
        setLog(prev => [{ text: message, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
    };

    // Función principal de Enriquecimiento
    const startEnrichment = async () => {
        if (!canEdit) return;
        setIsInProgress(true);
        addLog("🚀 Iniciando enriquecimiento del catálogo con IA...", "success");

        let currentProcessed = 0;
        let currentUpdated = 0;
        let currentBrandsCreated = 0;
        let currentCategoriesCreated = 0;
        
        let activeBrands = [...localBrands];
        let activeCategories = [...localCategories];

        const searchImagesFn = httpsCallable(functions, 'searchImages');
        const generateInsightsFn = httpsCallable(functions, 'generateInsights');

        for (let i = 0; i < incompleteItems.length; i++) {
            // Check manual cancellation/abort
            if (!isInProgress) {
                // Read from state reference directly since we are in a loop
                // We'll handle abort breaking using a mutable ref or check
            }
            
            const item = incompleteItems[i];
            setCurrentItem(item);
            addLog(`Analizando component [${item.partNumber}]: "${item.name}"...`);

            try {
                // 1. Buscar imágenes en la web mediante el Part Number
                let imageUrlsList = [];
                const searchQuery = `${item.partNumber} ${item.brand?.name || ''} component`;
                
                try {
                    const searchRes = await searchImagesFn({ query: searchQuery });
                    if (searchRes.data?.images && searchRes.data.images.length > 0) {
                        imageUrlsList = searchRes.data.images.map(img => img.url).slice(0, 5);
                        addLog(`📸 Encontradas ${searchRes.data.images.length} imágenes web potenciales.`, "info");
                    }
                } catch (searchErr) {
                    console.warn("Error buscando imágenes:", searchErr);
                    addLog(`⚠️ Búsqueda de imágenes fallida: ${searchErr.message || searchErr}`, "warning");
                }

                // 2. Llamar a Gemini para analizar marcas, categorías y seleccionar imagen
                const brandNamesList = activeBrands.map(b => b.name).join(", ");
                const categoryNamesList = activeCategories.map(c => c.name).join(", ");

                const prompt = `Analiza este componente técnico de ingeniería:
P/N (Part Number): "${item.partNumber}"
Nombre/Descripción: "${item.name}"

Lista de Marcas existentes en el sistema: [${brandNamesList}]
Lista de Categorías existentes en el sistema: [${categoryNamesList}]
URLs de imágenes de producto encontradas: ${JSON.stringify(imageUrlsList)}

Tu objetivo es deducir:
1. La Marca correcta. Si existe en la lista, selecciona la existente. Si no existe, indica el nombre de la nueva marca a crear.
2. La Categoría correcta. Si existe en la lista, elígela. Si es nueva, dinos el nombre para crearla.
3. La URL de la imagen más oficial, limpia y descriptiva del listado suministrado. Si el listado de imágenes está vacío o no contiene ninguna imagen relevante del producto, devuelve un string vacío "".

Devuelve ÚNICAMENTE un JSON estricto con el siguiente formato, sin bloques de código markdown:
{
  "brandAction": "use_existing" | "create_new",
  "brandName": "Nombre correcto de la marca",
  "brandId": "ID de la marca (si es existente)",
  "categoryAction": "use_existing" | "create_new",
  "categoryName": "Nombre de la categoría",
  "categoryId": "ID de la categoría (si es existente)",
  "image_url": "URL seleccionada de la lista o vacía"
}`;

                const aiRes = await generateInsightsFn({ prompt, type: 'catalog_enrichment', provider: 'deepseek' });
                
                if (aiRes.data?.success && aiRes.data?.response) {
                    let aiData;
                    try {
                        aiData = JSON.parse(aiRes.data.response.replace(/```json/g, "").replace(/```/g, "").trim());
                    } catch (pe) {
                        throw new Error("Respuesta de IA no convertible a JSON.");
                    }

                    console.log("[Enrichment] AI Result:", aiData);

                    // 3. Procesar Marca
                    let finalBrandId = item.brand?.id || item.brand_id || null;
                    if (!finalBrandId) {
                        if (aiData.brandAction === 'use_existing' && aiData.brandId) {
                            finalBrandId = aiData.brandId;
                        } else if (aiData.brandName) {
                            // Buscar si por nombre ya existe localmente
                            const existingB = activeBrands.find(b => b.name.toLowerCase().trim() === aiData.brandName.toLowerCase().trim());
                            if (existingB) {
                                finalBrandId = existingB.id;
                            } else {
                                // Crear nueva marca en BD
                                addLog(`🆕 Creando nueva marca: "${aiData.brandName}"...`, "info");
                                const { data: newB, error: bErr } = await supabase
                                    .from('marcas')
                                    .insert({ name: aiData.brandName })
                                    .select('id, name')
                                    .single();
                                if (!bErr && newB) {
                                    finalBrandId = newB.id;
                                    activeBrands.push(newB);
                                    currentBrandsCreated++;
                                } else {
                                    console.error("Error creando marca:", bErr);
                                }
                            }
                        }
                    }

                    // 4. Procesar Categoría
                    let finalCategoryId = item.category?.id || item.category_id || null;
                    if (!finalCategoryId) {
                        if (aiData.categoryAction === 'use_existing' && aiData.categoryId) {
                            finalCategoryId = aiData.categoryId;
                        } else if (aiData.categoryName) {
                            // Buscar si ya existe por nombre
                            const existingC = activeCategories.find(c => c.name.toLowerCase().trim() === aiData.categoryName.toLowerCase().trim());
                            if (existingC) {
                                finalCategoryId = existingC.id;
                            } else {
                                // Crear nueva categoría
                                addLog(`🆕 Creando nueva categoría: "${aiData.categoryName}"...`, "info");
                                const { data: newC, error: cErr } = await supabase
                                    .from('categorias')
                                    .insert({ name: aiData.categoryName })
                                    .select('id, name')
                                    .single();
                                if (!cErr && newC) {
                                    finalCategoryId = newC.id;
                                    activeCategories.push(newC);
                                    currentCategoriesCreated++;
                                } else {
                                    console.error("Error creando categoría:", cErr);
                                }
                            }
                        }
                    }

                    // 5. Determinar Imagen
                    const finalImageUrl = item.imageUrl || aiData.image_url || '';

                    // 6. Actualizar registro en catalogo_maestro
                    const updates = {};
                    let wasUpdated = false;

                    if (!item.imageUrl && finalImageUrl) {
                        updates.image_url = finalImageUrl;
                        wasUpdated = true;
                    }
                    if (!(item.brand?.id || item.brand_id) && finalBrandId) {
                        updates.brand_id = finalBrandId;
                        wasUpdated = true;
                    }
                    if (!(item.category?.id || item.category_id) && finalCategoryId) {
                        updates.category_id = finalCategoryId;
                        wasUpdated = true;
                    }

                    if (wasUpdated) {
                        const { error: updErr } = await supabase
                            .from('catalogo_maestro')
                            .update(updates)
                            .eq('id', item.id);

                        if (updErr) {
                            throw new Error(`Error BD al actualizar registro: ${updErr.message}`);
                        }

                        currentUpdated++;
                        addLog(`✅ Componente [${item.partNumber}] enriquecido con éxito.`, "success");
                    } else {
                        addLog(`ℹ️ Componente [${item.partNumber}] analizado, sin datos nuevos aplicables.`);
                    }

                } else {
                    throw new Error(aiRes.data?.error || "Gemini no devolvió respuesta");
                }

            } catch (err) {
                console.error("Error enriqueciendo componente:", err);
                addLog(`❌ Error procesando [${item.partNumber}]: ${err.message || String(err)}`, "error");
            }

            // Actualizar estados tras iteración
            currentProcessed++;
            setStats(prev => ({
                ...prev,
                processed: currentProcessed,
                updated: currentUpdated,
                brandCreated: currentBrandsCreated,
                categoryCreated: currentCategoriesCreated
            }));
            
            const newProgress = Math.round((currentProcessed / incompleteItems.length) * 100);
            setProgress(newProgress);

            // Throttle delay de 3.5 segundos entre celdas para respetar las cuotas de Gemini
            await new Promise(resolve => setTimeout(resolve, 3500));
        }

        // Fin de procesamiento
        setIsInProgress(false);
        setCurrentItem(null);
        addLog(`🎉 Proceso finalizado. Se procesaron ${currentProcessed} componentes. Se actualizaron ${currentUpdated} registros.`, "success");
    };

    // Detener de inmediato
    const stopEnrichment = () => {
        setIsInProgress(false);
        setCurrentItem(null);
        addLog("🛑 Enriquecimiento cancelado por el usuario.", "warning");
    };

    return (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in duration-200">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-800/80 bg-gradient-to-r from-indigo-500/10 to-transparent flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 bg-indigo-500/15 text-indigo-400 rounded-2xl flex items-center justify-center">
                            <Sparkles className="w-5 h-5 fill-indigo-400/20" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white leading-tight">Enriquecimiento de Catálogo con IA</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Automático & Predictivo</p>
                        </div>
                    </div>
                    {!isInProgress && (
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {/* Stats overview */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 flex flex-col justify-center text-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Incompletos</span>
                            <span className="text-2xl font-black text-white mt-1">{stats.incomplete}</span>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 flex flex-col justify-center text-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enriquecidos</span>
                            <span className="text-2xl font-black text-emerald-400 mt-1">{stats.updated}</span>
                        </div>
                        <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 flex flex-col justify-center text-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nuevas Marcas</span>
                            <span className="text-2xl font-black text-indigo-400 mt-1">{stats.brandCreated + stats.categoryCreated}</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {isInProgress && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400 font-medium">Progreso general</span>
                                <span className="font-black text-indigo-400">{progress}%</span>
                            </div>
                            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                <div 
                                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Current Item Processing Info */}
                    {currentItem && (
                        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-4 flex gap-3 animate-pulse">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider">Procesando Componente</span>
                                <h4 className="font-bold text-white text-sm mt-0.5 truncate">{currentItem.name}</h4>
                                <p className="font-mono text-[10px] text-slate-400 mt-0.5">P/N: {currentItem.partNumber}</p>
                            </div>
                        </div>
                    )}

                    {/* Log Terminal */}
                    <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Terminal de Actividad</span>
                        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 h-40 overflow-y-auto font-mono text-xs space-y-1.5 scrollbar-none">
                            {log.length === 0 ? (
                                <div className="text-slate-600 italic flex items-center justify-center h-full text-center">
                                    Presiona "Iniciar" para comenzar a enriquecer tus componentes con fotos, marcas y categorías mediante IA.
                                </div>
                            ) : (
                                log.map((item, idx) => (
                                    <div key={idx} className={`flex items-start gap-2 leading-relaxed ${
                                        item.type === 'success' ? 'text-emerald-400' :
                                        item.type === 'error' ? 'text-red-400 font-bold' :
                                        item.type === 'warning' ? 'text-amber-400' : 'text-slate-300'
                                    }`}>
                                        <span className="text-slate-600 shrink-0 text-[10px] select-none">[{item.time}]</span>
                                        <span>{item.text}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-3">
                    {isInProgress ? (
                        <button
                            onClick={stopEnrichment}
                            className="bg-red-500/15 border border-red-500/20 text-red-400 px-6 py-3 rounded-2xl font-bold flex items-center justify-center shadow-lg active:scale-95 transition-all text-sm cursor-pointer"
                        >
                            <Square className="w-4 h-4 mr-1.5 fill-red-400/20" /> Detener
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={onClose}
                                className="px-6 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-800 transition"
                            >
                                Cerrar
                            </button>
                            <button
                                onClick={startEnrichment}
                                disabled={stats.incomplete === 0}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-black flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 text-sm cursor-pointer"
                            >
                                <Play className="w-4 h-4 mr-1.5 fill-white/20" /> Iniciar Enriquecimiento
                            </button>
                        </>
                    )}
                </div>

            </div>
        </div>
    );
}
