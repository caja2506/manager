/**
 * Script: Recover image URLs from Firebase Firestore → Supabase
 * 
 * Uses firebase-admin to read catalogo_maestro with imageUrl from Firestore,
 * then updates matching Supabase records.
 * 
 * Run from functions/ dir: node scripts/sync-images-from-firebase.js
 */

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { createClient } = require("@supabase/supabase-js");

// Init Firebase Admin (uses ADC / gcloud auth)
initializeApp({ projectId: "bom-ame-cr" });
const db = getFirestore();

// Init Supabase
const SUPABASE_URL = 'https://ixrxsmqvckiwlgxuqzqt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cnhzbXF2Y2tpd2xneHVxenF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4MTk5NTQsImV4cCI6MjA2MjM5NTk1NH0.SRBpVJOXNTkdu2mOXvnJYavbfRslZKNpMV3kfleHDqQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('📦 Leyendo catalogo_maestro de Firebase...\n');

    const snapshot = await db.collection('catalogo_maestro').get();
    const firebaseItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter items that have imageUrl
    const withImages = firebaseItems.filter(item => item.imageUrl && String(item.imageUrl).trim() !== '');

    console.log(`📊 Total docs en Firebase: ${firebaseItems.length}`);
    console.log(`🖼️  Docs con imageUrl: ${withImages.length}\n`);

    // Show what we found
    console.log('='.repeat(90));
    console.log('ITEMS CON IMAGEN EN FIREBASE:');
    console.log('='.repeat(90));

    for (const item of withImages) {
        const pn = item.partNumber || 'SIN_PN';
        const name = (item.name || 'SIN_NOMBRE').substring(0, 35).padEnd(35);
        const url = String(item.imageUrl).substring(0, 60);
        console.log(`  PN: ${pn.padEnd(30)} | ${name} | ${url}...`);
    }

    // Now sync to Supabase
    console.log('\n' + '='.repeat(90));
    console.log('SINCRONIZANDO A SUPABASE...');
    console.log('='.repeat(90));

    let updated = 0;
    let alreadyHas = 0;
    let notFound = 0;
    let errors = 0;

    for (const item of withImages) {
        const pn = String(item.partNumber || '').replace(/\s+/g, '').toUpperCase();
        if (!pn || pn === 'S/N') {
            console.log(`  ⚠️  Skip (sin PN): ${item.name || item.id}`);
            continue;
        }

        // Try to find by part_number in Supabase
        const { data: matches, error: fetchError } = await supabase
            .from('catalogo_maestro')
            .select('id, part_number, image_url, name')
            .eq('part_number', pn);

        if (fetchError) {
            console.log(`  ❌ Error buscando ${pn}: ${fetchError.message}`);
            errors++;
            continue;
        }

        if (!matches || matches.length === 0) {
            console.log(`  ⚠️  No encontrado en Supabase: ${pn} (${item.name})`);
            notFound++;
            continue;
        }

        // Update each match
        for (const match of matches) {
            if (match.image_url && match.image_url.trim() !== '') {
                console.log(`  ✅ Ya tiene imagen: ${pn} → skip`);
                alreadyHas++;
                continue;
            }

            const { error: updateError } = await supabase
                .from('catalogo_maestro')
                .update({ image_url: item.imageUrl })
                .eq('id', match.id);

            if (updateError) {
                console.log(`  ❌ Error actualizando ${pn}: ${updateError.message}`);
                errors++;
            } else {
                console.log(`  ✅ Actualizado: ${pn} → ${String(item.imageUrl).substring(0, 50)}...`);
                updated++;
            }
        }
    }

    console.log('\n' + '='.repeat(90));
    console.log('RESUMEN:');
    console.log(`  ✅ Actualizados: ${updated}`);
    console.log(`  ℹ️  Ya tenían imagen: ${alreadyHas}`);
    console.log(`  ⚠️  No encontrados en Supabase: ${notFound}`);
    console.log(`  ❌ Errores: ${errors}`);
    console.log('='.repeat(90));
}

main().then(() => process.exit(0)).catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
