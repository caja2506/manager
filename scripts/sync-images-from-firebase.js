/**
 * Script: Recover image URLs from Firebase Firestore → Supabase
 * 
 * Reads all catalogo_maestro docs from Firestore that have imageUrl set,
 * then updates the corresponding Supabase records by matching part_number.
 * 
 * Usage: node scripts/sync-images-from-firebase.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDGUTnCBWhPpyOrjAf5eQbQaQz0Dm18NXc",
    authDomain: "bom-ame-cr.firebaseapp.com",
    projectId: "bom-ame-cr",
    storageBucket: "bom-ame-cr.firebasestorage.app",
    messagingSenderId: "865326401984",
    appId: "1:865326401984:web:ebad6ca9ee666eaec3a025",
};

// Supabase config
const SUPABASE_URL = 'https://ixrxsmqvckiwlgxuqzqt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cnhzbXF2Y2tpd2xneHVxenF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4MTk5NTQsImV4cCI6MjA2MjM5NTk1NH0.SRBpVJOXNTkdu2mOXvnJYavbfRslZKNpMV3kfleHDqQ';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('📦 Leyendo catalogo_maestro de Firebase...');
    
    const snapshot = await getDocs(collection(db, 'catalogo_maestro'));
    const firebaseItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Filter items that have imageUrl
    const withImages = firebaseItems.filter(item => item.imageUrl && item.imageUrl.trim() !== '');
    
    console.log(`\n📊 Total docs en Firebase: ${firebaseItems.length}`);
    console.log(`🖼️  Docs con imageUrl: ${withImages.length}`);
    console.log('');

    // Show what we found
    console.log('='.repeat(80));
    console.log('ITEMS CON IMAGEN EN FIREBASE:');
    console.log('='.repeat(80));
    
    for (const item of withImages) {
        const pn = item.partNumber || 'SIN PN';
        const name = item.name || 'SIN NOMBRE';
        const url = item.imageUrl;
        console.log(`  PN: ${pn.padEnd(30)} | ${name.substring(0, 40).padEnd(40)} | ${url.substring(0, 60)}...`);
    }

    // Now sync to Supabase
    console.log('\n' + '='.repeat(80));
    console.log('SINCRONIZANDO A SUPABASE...');
    console.log('='.repeat(80));

    let updated = 0;
    let notFound = 0;
    let errors = 0;

    for (const item of withImages) {
        const pn = (item.partNumber || '').replace(/\s+/g, '').toUpperCase();
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
                console.log(`  ✅ Actualizado: ${pn} → ${item.imageUrl.substring(0, 50)}...`);
                updated++;
            }
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('RESUMEN:');
    console.log(`  ✅ Actualizados: ${updated}`);
    console.log(`  ⚠️  No encontrados: ${notFound}`);
    console.log(`  ❌ Errores: ${errors}`);
    console.log('='.repeat(80));

    process.exit(0);
}

main().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
