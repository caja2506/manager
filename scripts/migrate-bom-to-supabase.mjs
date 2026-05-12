/**
 * migrate-bom-to-supabase.mjs
 * =============================
 * Reads BOM data from Firestore REST API (using Firebase CLI credentials)
 * and inserts into Supabase PostgreSQL.
 *
 * Collections migrated:
 *   marcas, categorias, proveedores, catalogo_maestro, proyectos_bom, items_bom
 *
 * Usage: node scripts/migrate-bom-to-supabase.mjs
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// ── Config ──
const PROJECT_ID = 'bom-ame-cr';
const SUPABASE_URL = 'https://mkymgptfmtlqpdswvywo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_R4wQAwCSSp1BwuplVroLow_9XwFu_RD';
const CONFIG_PATH = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: { transport: ws },
});

// ── HTTP helper ──
function httpRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, data }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// ── Auth: get access token from Firebase CLI credentials ──
async function getAccessToken() {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const refreshToken = config.tokens.refresh_token;

    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
        client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    }).toString();

    const res = await httpRequest({
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, body);

    if (res.data.access_token) return res.data.access_token;
    throw new Error('Failed to get access token: ' + JSON.stringify(res.data));
}

// ── Firestore: read all documents from a collection ──
async function readFirestoreCollection(accessToken, collectionId) {
    const docs = [];
    let pageToken = null;

    do {
        const queryPath = pageToken
            ? `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionId}?pageSize=300&pageToken=${pageToken}`
            : `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionId}?pageSize=300`;

        const res = await httpRequest({
            hostname: 'firestore.googleapis.com',
            path: queryPath,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (res.status !== 200) {
            console.error(`  ❌ Error reading ${collectionId}:`, res.data);
            break;
        }

        const documents = res.data.documents || [];
        for (const doc of documents) {
            const id = doc.name.split('/').pop();
            const fields = parseFirestoreFields(doc.fields || {});
            docs.push({ id, ...fields });
        }

        pageToken = res.data.nextPageToken || null;
    } while (pageToken);

    return docs;
}

// ── Firestore field parser ──
function parseFirestoreFields(fields) {
    const result = {};
    for (const [key, value] of Object.entries(fields)) {
        result[key] = parseFirestoreValue(value);
    }
    return result;
}

function parseFirestoreValue(value) {
    if ('stringValue' in value) return value.stringValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return value.doubleValue;
    if ('booleanValue' in value) return value.booleanValue;
    if ('timestampValue' in value) return value.timestampValue;
    if ('nullValue' in value) return null;
    if ('referenceValue' in value) {
        // Extract document ID from reference path
        return { _ref: value.referenceValue.split('/').pop(), _path: value.referenceValue };
    }
    if ('arrayValue' in value) {
        return (value.arrayValue.values || []).map(parseFirestoreValue);
    }
    if ('mapValue' in value) {
        return parseFirestoreFields(value.mapValue.fields || {});
    }
    return null;
}

// ── Migration functions ──

async function migrateMarcas(docs) {
    console.log(`\n📦 Migrating marcas (${docs.length} records)...`);
    const rows = docs.map(d => ({
        id: d.id,
        name: d.name || d.nombre || '',
        created_at: d.createdAt || new Date().toISOString(),
    }));

    const { error } = await supabase.from('marcas').upsert(rows, { onConflict: 'id' });
    if (error) console.error('  ❌', error.message);
    else console.log(`  ✅ ${rows.length} marcas migrated`);
}

async function migrateCategorias(docs) {
    console.log(`\n📦 Migrating categorias (${docs.length} records)...`);
    const rows = docs.map(d => ({
        id: d.id,
        name: d.name || d.nombre || '',
        created_at: d.createdAt || new Date().toISOString(),
    }));

    const { error } = await supabase.from('categorias').upsert(rows, { onConflict: 'id' });
    if (error) console.error('  ❌', error.message);
    else console.log(`  ✅ ${rows.length} categorias migrated`);
}

async function migrateProveedores(docs) {
    console.log(`\n📦 Migrating proveedores (${docs.length} records)...`);
    const rows = docs.map(d => ({
        id: d.id,
        name: d.name || d.nombre || '',
        created_at: d.createdAt || new Date().toISOString(),
    }));

    const { error } = await supabase.from('proveedores').upsert(rows, { onConflict: 'id' });
    if (error) console.error('  ❌', error.message);
    else console.log(`  ✅ ${rows.length} proveedores migrated`);
}

async function migrateCatalogo(docs) {
    console.log(`\n📦 Migrating catalogo_maestro (${docs.length} records)...`);
    const rows = docs.map(d => ({
        id: d.id,
        name: d.name || '',
        part_number: d.partNumber || d.part_number || '',
        last_price: Number(d.lastPrice || d.last_price || 0),
        brand_id: d.brand?._ref || d.brand_id || null,
        category_id: d.category?._ref || d.category_id || null,
        default_provider_id: d.defaultProvider?._ref || d.default_provider_id || null,
        lead_time_weeks: d.leadTimeWeeks ?? d.lead_time_weeks ?? null,
        image_url: d.imageUrl || d.image_url || '',
        created_at: d.createdAt || new Date().toISOString(),
    }));

    // Insert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from('catalogo_maestro').upsert(batch, { onConflict: 'id' });
        if (error) console.error(`  ❌ Batch ${i / 50 + 1}:`, error.message);
        else console.log(`  ✅ Batch ${i / 50 + 1}: ${batch.length} records`);
    }
}

async function migrateProyectosBom(docs) {
    console.log(`\n📦 Migrating proyectos_bom (${docs.length} records)...`);
    const rows = docs.map(d => ({
        id: d.id,
        name: d.name || '',
        description: d.description || '',
        created_at: d.createdAt || new Date().toISOString(),
        created_by: d.createdBy || null,
    }));

    const { error } = await supabase.from('proyectos_bom').upsert(rows, { onConflict: 'id' });
    if (error) console.error('  ❌', error.message);
    else console.log(`  ✅ ${rows.length} proyectos_bom migrated`);
}

async function migrateItemsBom(docs) {
    console.log(`\n📦 Migrating items_bom (${docs.length} records)...`);
    const rows = docs.map(d => ({
        id: d.id,
        project_id: d.projectId || d.project_id || null,
        master_part_ref_id: d.masterPartRef?._ref || d.master_part_ref_id || null,
        quantity: Number(d.quantity || 0),
        unit_price: Number(d.unitPrice || d.unit_price || 0),
        total_price: Number(d.totalPrice || d.total_price || 0),
        proveedor_id: d.proveedor?._ref || d.proveedor_id || null,
        status: d.status || 'Requerido',
        notes: d.notes || d.notas || '',
        created_at: d.addedAt || d.createdAt || new Date().toISOString(),
    }));

    // Insert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from('items_bom').upsert(batch, { onConflict: 'id' });
        if (error) console.error(`  ❌ Batch ${i / 50 + 1}:`, error.message);
        else console.log(`  ✅ Batch ${i / 50 + 1}: ${batch.length} records`);
    }
}

// ── Main ──
async function main() {
    console.log('🚀 BOM Data Migration: Firestore → Supabase');
    console.log('='.repeat(50));

    // Get Firebase auth token
    console.log('\n🔑 Getting Firebase access token...');
    const accessToken = await getAccessToken();
    console.log('✅ Token obtained');

    // Read all collections
    const collections = ['marcas', 'categorias', 'proveedores', 'catalogo_maestro', 'proyectos_bom', 'items_bom'];
    const data = {};

    for (const col of collections) {
        console.log(`\n📖 Reading Firestore: ${col}...`);
        data[col] = await readFirestoreCollection(accessToken, col);
        console.log(`  → ${data[col].length} documents found`);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Firestore Data Summary:');
    for (const [col, docs] of Object.entries(data)) {
        console.log(`  ${col}: ${docs.length} documents`);
    }

    // Migrate in dependency order
    await migrateMarcas(data.marcas);
    await migrateCategorias(data.categorias);
    await migrateProveedores(data.proveedores);
    await migrateCatalogo(data.catalogo_maestro);
    await migrateProyectosBom(data.proyectos_bom);
    await migrateItemsBom(data.items_bom);

    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration complete!');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
