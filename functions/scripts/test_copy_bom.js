/**
 * Diagnóstico: verifica la estructura de items_bom en Supabase
 * y prueba insertar un item de prueba.
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mkymgptfmtlqpdswvywo.supabase.co';
const supabaseKey = 'sb_publishable_R4wQAwCSSp1BwuplVroLow_9XwFu_RD';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // 1. Ver columnas de items_bom
    console.log('=== Columnas de items_bom ===');
    const { data: cols, error: colErr } = await supabase.rpc('get_table_columns', { table_name_param: 'items_bom' });
    if (colErr) {
        console.log('No se puede obtener columnas via RPC, intentando query directo...');
        // Fallback: hacer un select y ver las keys
        const { data: sample, error: sampleErr } = await supabase.from('items_bom').select('*').limit(1);
        if (sampleErr) {
            console.log('Error obteniendo sample:', sampleErr.message);
        } else if (sample && sample.length > 0) {
            console.log('Columnas (keys del primer registro):');
            Object.keys(sample[0]).forEach(k => console.log(`  - ${k}: ${typeof sample[0][k]} = ${JSON.stringify(sample[0][k]).slice(0, 80)}`));
        } else {
            console.log('No hay items en items_bom');
        }
    } else {
        console.log(cols);
    }

    // 2. Ver un proyecto existente
    console.log('\n=== Proyectos BOM ===');
    const { data: projects } = await supabase.from('proyectos_bom').select('id, name').limit(5);
    if (projects) projects.forEach(p => console.log(`  ${p.id}: ${p.name}`));

    // 3. Contar items por proyecto
    if (projects && projects.length > 0) {
        for (const p of projects) {
            const { count } = await supabase.from('items_bom').select('*', { count: 'exact', head: true }).eq('project_id', p.id);
            console.log(`  → ${p.name}: ${count} items`);
        }
    }

    // 4. Probar crear un proyecto de prueba
    console.log('\n=== Test: Crear proyecto de prueba ===');
    const { data: testProj, error: testProjErr } = await supabase
        .from('proyectos_bom')
        .insert({ name: 'TEST_COPY_DELETE_ME', description: 'test', created_at: new Date().toISOString() })
        .select('id')
        .single();
    
    if (testProjErr) {
        console.log('❌ Error creando proyecto test:', testProjErr);
    } else {
        console.log('✅ Proyecto test creado:', testProj.id);

        // 5. Probar insertar un item
        if (projects && projects.length > 0) {
            const { data: sampleItems } = await supabase.from('items_bom').select('*').eq('project_id', projects[0].id).limit(1);
            if (sampleItems && sampleItems.length > 0) {
                const src = sampleItems[0];
                console.log('\n=== Test: Copiar un item ===');
                console.log('Item original:', JSON.stringify(src, null, 2));
                
                const newItem = {
                    project_id: testProj.id,
                    master_part_ref_id: src.master_part_ref_id,
                    quantity: src.quantity,
                    unit_price: src.unit_price,
                    total_price: src.total_price,
                    proveedor_id: src.proveedor_id,
                    status: src.status || 'Requerido',
                    lead_time_weeks: src.lead_time_weeks,
                    prcr: src.prcr,
                    added_at: new Date().toISOString(),
                };
                console.log('\nItem a insertar:', JSON.stringify(newItem, null, 2));
                
                const { data: insertResult, error: insertErr } = await supabase.from('items_bom').insert(newItem).select('id');
                if (insertErr) {
                    console.log('❌ Error insertando item:', insertErr);
                } else {
                    console.log('✅ Item insertado:', insertResult);
                }
            }
        }

        // Limpiar: borrar proyecto test
        console.log('\n=== Limpieza ===');
        await supabase.from('items_bom').delete().eq('project_id', testProj.id);
        await supabase.from('proyectos_bom').delete().eq('id', testProj.id);
        console.log('✅ Proyecto test eliminado');
    }
}

main().catch(err => console.error('Fatal:', err));
