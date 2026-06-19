/**
 * Script: Recover image URLs from Firebase Firestore → Supabase
 * 
 * Authenticates with Firebase Auth REST API, then reads catalogo_maestro
 * from Firestore REST API, and syncs image URLs to Supabase.
 * 
 * Run: node scripts/sync-images-from-firebase.mjs
 * 
 * You'll be prompted for email/password of a Firebase Auth user.
 */

import * as readline from 'readline';

import fs from 'fs';

let FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY;
if (!FIREBASE_API_KEY && fs.existsSync('.env.local')) {
    const env = fs.readFileSync('.env.local', 'utf-8');
    const match = env.match(/VITE_FIREBASE_API_KEY=(.+)/);
    if (match) FIREBASE_API_KEY = match[1].trim();
}
const FIREBASE_PROJECT = 'bom-ame-cr';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

const SUPABASE_URL = 'https://ixrxsmqvckiwlgxuqzqt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cnhzbXF2Y2tpd2xneHVxenF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4MTk5NTQsImV4cCI6MjA2MjM5NTk1NH0.SRBpVJOXNTkdu2mOXvnJYavbfRslZKNpMV3kfleHDqQ';

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

/** Firebase Auth REST — sign in with email/password */
async function firebaseSignIn(email, password) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Firebase Auth error: ${data.error?.message || res.status}`);
    return data.idToken;
}

/** Fetch all documents from a Firestore collection */
async function fetchFirestoreCollection(collectionName, idToken) {
    const allDocs = [];
    let pageToken = null;

    do {
        let url = `${FIRESTORE_BASE}/${collectionName}?pageSize=300`;
        if (pageToken) url += `&pageToken=${pageToken}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${idToken}` },
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Firestore REST error: ${response.status} - ${err}`);
        }

        const data = await response.json();
        if (data.documents) allDocs.push(...data.documents);
        pageToken = data.nextPageToken || null;
    } while (pageToken);

    return allDocs;
}

/** Convert a Firestore REST document to a simple JS object */
function parseFirestoreDoc(doc) {
    const id = doc.name.split('/').pop();
    const fields = doc.fields || {};
    const result = { id };

    for (const [key, valueObj] of Object.entries(fields)) {
        if (valueObj.stringValue !== undefined) result[key] = valueObj.stringValue;
        else if (valueObj.integerValue !== undefined) result[key] = Number(valueObj.integerValue);
        else if (valueObj.doubleValue !== undefined) result[key] = valueObj.doubleValue;
        else if (valueObj.booleanValue !== undefined) result[key] = valueObj.booleanValue;
        else if (valueObj.nullValue !== undefined) result[key] = null;
        else if (valueObj.referenceValue !== undefined) result[key] = valueObj.referenceValue;
        else result[key] = JSON.stringify(valueObj);
    }

    return result;
}

async function supabaseUpdate(id, imageUrl) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/catalogo_maestro?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ image_url: imageUrl }),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Supabase PATCH error: ${response.status} - ${err}`);
    }
}

async function supabaseQuery(partNumber) {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/catalogo_maestro?part_number=eq.${encodeURIComponent(partNumber)}&select=id,part_number,image_url,name`,
        {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
        }
    );
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Supabase GET error: ${response.status} - ${err}`);
    }
    return response.json();
}

async function main() {
    console.log('🔐 Autenticación Firebase requerida\n');
    const email = await ask('Email: ');
    const password = await ask('Password: ');

    console.log('\n🔑 Autenticando...');
    const idToken = await firebaseSignIn(email, password);
    console.log('✅ Autenticado correctamente\n');

    console.log('📦 Leyendo catalogo_maestro de Firebase...\n');
    const rawDocs = await fetchFirestoreCollection('catalogo_maestro', idToken);
    const firebaseItems = rawDocs.map(parseFirestoreDoc);

    const withImages = firebaseItems.filter(item => item.imageUrl && String(item.imageUrl).trim() !== '');

    console.log(`📊 Total docs en Firebase: ${firebaseItems.length}`);
    console.log(`🖼️  Docs con imageUrl: ${withImages.length}\n`);

    console.log('='.repeat(90));
    console.log('ITEMS CON IMAGEN EN FIREBASE:');
    console.log('='.repeat(90));

    for (const item of withImages) {
        const pn = item.partNumber || 'SIN_PN';
        const name = (item.name || 'SIN_NOMBRE').substring(0, 35).padEnd(35);
        const url = String(item.imageUrl).substring(0, 60);
        console.log(`  PN: ${pn.padEnd(30)} | ${name} | ${url}...`);
    }

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

        try {
            const matches = await supabaseQuery(pn);

            if (!matches || matches.length === 0) {
                console.log(`  ⚠️  No encontrado en Supabase: ${pn} (${item.name})`);
                notFound++;
                continue;
            }

            for (const match of matches) {
                if (match.image_url && match.image_url.trim() !== '') {
                    console.log(`  ✅ Ya tiene imagen: ${pn} → skip`);
                    alreadyHas++;
                    continue;
                }

                await supabaseUpdate(match.id, item.imageUrl);
                console.log(`  ✅ Actualizado: ${pn} → ${String(item.imageUrl).substring(0, 50)}...`);
                updated++;
            }
        } catch (err) {
            console.log(`  ❌ Error con ${pn}: ${err.message}`);
            errors++;
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
