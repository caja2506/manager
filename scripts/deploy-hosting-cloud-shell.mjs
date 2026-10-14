// Run from an authenticated Google Cloud Shell session:
// node scripts/deploy-hosting-cloud-shell.mjs
// Validation only: add --check-config or --build-only.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const project = 'bom-ame-cr';
const origin = `https://${project}.web.app`;
const supabaseUrl = 'https://mkymgptfmtlqpdswvywo.supabase.co';
const fixCommit = 'dcd2c2389a8ba8ff7f76e7bf80266392b1038cef';
const mode = process.argv[2];

function run(command, args, env = process.env) {
    return execFileSync(command, args, { cwd: root, env, stdio: 'inherit' });
}

function download(url) {
    return execFileSync('curl', ['--fail', '--silent', '--show-error', '--max-time', '60', url], {
        encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
    });
}

function uniqueMatch(text, pattern, name) {
    const values = [...new Set(text.match(pattern) || [])];
    if (values.length !== 1) throw new Error(`No se pudo validar ${name}. No se publicara nada.`);
    return values[0];
}

try {
    if (process.argv.length > 3 || (mode && !['--check-config', '--build-only'].includes(mode))) {
        throw new Error('Opciones validas: --check-config, --build-only, o ninguna para publicar.');
    }
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major < 20 || (major === 20 && minor < 19) || major === 21 || (major === 22 && minor < 12)) {
        throw new Error('Se requiere Node 20.19+ o 22.12+. Selecciona Node 22 con nvm en Cloud Shell.');
    }
    const config = JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8'));
    if (config.projects.default !== project) throw new Error('Proyecto Firebase inesperado.');
    run('git', ['merge-base', '--is-ancestor', fixCommit, 'HEAD']);

    console.log('Verificando la configuracion publica de AutoBOM...');
    const html = download(`${origin}/`);
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)]
        .map((match) => new URL(match[1], origin))
        .filter((url) => url.origin === origin && /^\/assets\/index-[^/]+\.js$/.test(url.pathname));
    if (scripts.length !== 1) throw new Error('No se encontro un unico paquete principal de la aplicacion.');
    const bundle = download(scripts[0].href);
    if (!bundle.includes(supabaseUrl) || !bundle.includes(`${project}.firebaseapp.com`)) {
        throw new Error('La configuracion publicada pertenece a otro proyecto.');
    }
    // These are browser-visible keys from the existing production bundle.
    // Never request, read, or embed service-role keys or Google credentials.
    const env = {
        ...process.env,
        VITE_FIREBASE_API_KEY: uniqueMatch(bundle, /AIza[0-9A-Za-z_-]{35}/g, 'la clave publica de Firebase'),
        VITE_SUPABASE_URL: supabaseUrl,
        VITE_SUPABASE_ANON_KEY: uniqueMatch(bundle, /sb_publishable_[A-Za-z0-9_-]+/g, 'la clave publica de Supabase'),
    };
    console.log(`Configuracion validada para ${project}. Las claves no se imprimen ni guardan.`);
    if (mode !== '--check-config') {
        run('npm', ['ci', '--no-audit', '--no-fund'], env);
        run('npm', ['run', 'build'], env);
        if (mode === '--build-only') {
            console.log('Compilacion terminada. No se publico nada.');
        } else {
            console.log(`Publicando unicamente Hosting en ${project}...`);
            run('node', ['node_modules/firebase-tools/lib/bin/firebase.js', 'deploy', '--only', 'hosting', '--project', project], env);
            console.log(`Publicacion completada. Abre ${origin} y verifica Proyectos y BOM.`);
        }
    }
} catch (error) {
    console.error(`No se pudo completar la operacion: ${error.message}`);
    process.exitCode = 1;
}
