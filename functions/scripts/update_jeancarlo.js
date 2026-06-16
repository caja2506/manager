/**
 * update_jeancarlo.js
 * 
 * Cambia el correo de Jean Carlo Suarez de Gmail → @icumed.com
 * y establece su contraseña.
 * 
 * Usa el refresh_token almacenado por Firebase CLI.
 * 
 * Ejecutar:
 *   node functions/scripts/update_jeancarlo.js
 */
const admin = require('firebase-admin');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ── 1. Obtener refresh token de Firebase CLI ──
function getRefreshToken() {
    const configPath = path.join(
        process.env.USERPROFILE || process.env.HOME,
        '.config', 'configstore', 'firebase-tools.json'
    );
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.tokens.refresh_token;
}

// ── 2. Intercambiar refresh token por access token ──
function exchangeRefreshToken(refreshToken) {
    return new Promise((resolve, reject) => {
        const clientId = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
        const clientSecret = 'j9iVZfS8kkCEFUPaAeJV0sAi';
        
        const postData = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
        }).toString();

        const options = {
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const parsed = JSON.parse(data);
                if (parsed.access_token) {
                    resolve(parsed.access_token);
                } else {
                    reject(new Error(`Token exchange failed: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// ── 3. Main ──
async function main() {
    const USER = {
        uid: 'm9CRdKjpGNZcSHtxgEBgoUsv0B22',
        oldEmail: 'suarez.jeancarlo91@gmail.com',
        newEmail: 'jean.suarez@icumed.com',
        displayName: 'Jean Carlo Suarez Gomez',
        password: '72064847',
    };

    console.log('Obteniendo access token desde Firebase CLI...');
    const refreshToken = getRefreshToken();
    const accessToken = await exchangeRefreshToken(refreshToken);
    console.log('✔ Access token obtenido\n');

    admin.initializeApp({
        projectId: 'bom-ame-cr',
        credential: {
            getAccessToken: () => Promise.resolve({ access_token: accessToken, expires_in: 3600 }),
        },
    });

    console.log('=== Actualización de Jean Carlo Suarez ===\n');
    console.log(`  UID:          ${USER.uid}`);
    console.log(`  Email antes:  ${USER.oldEmail}`);
    console.log(`  Email nuevo:  ${USER.newEmail}`);
    console.log(`  Password:     ${USER.password}`);
    console.log('');

    try {
        // Verificar estado actual
        const record = await admin.auth().getUser(USER.uid);
        console.log(`  Estado actual: ${record.email} (providers: ${record.providerData.map(p => p.providerId).join(', ')})`);

        if (record.email !== USER.oldEmail) {
            console.log(`\n  ⚠ El email actual es "${record.email}", no "${USER.oldEmail}"`);
            console.log(`  Continuando de todas formas con la actualización...`);
        }

        // Actualizar email, password y nombre
        await admin.auth().updateUser(USER.uid, {
            email: USER.newEmail,
            password: USER.password,
            emailVerified: false,
            displayName: USER.displayName,
        });

        console.log('\n  ✅ Email actualizado a: ' + USER.newEmail);
        console.log('  ✅ Password establecido: ' + USER.password);
        console.log('  ✅ Display name: ' + USER.displayName);

        // Verificar
        console.log('\n--- Verificación ---');
        const updated = await admin.auth().getUser(USER.uid);
        console.log(`  Email:    ${updated.email}`);
        console.log(`  Nombre:   ${updated.displayName}`);
        console.log(`  Verified: ${updated.emailVerified}`);
        console.log(`  Providers: ${updated.providerData.map(p => `${p.providerId}(${p.email})`).join(', ')}`);

        console.log('\n🎉 ¡Listo! Jean Carlo ahora puede entrar con:');
        console.log(`   Email:    ${USER.newEmail}`);
        console.log(`   Password: ${USER.password}`);

    } catch (err) {
        console.error(`\n  ✘ ERROR: ${err.message}`);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
