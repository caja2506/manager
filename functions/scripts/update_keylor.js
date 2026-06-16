/**
 * update_keylor.js
 * 
 * Actualiza el email y contraseña de Keylor Cordero en Firebase Auth.
 */
const admin = require('firebase-admin');
const https = require('https');
const fs = require('fs');
const path = require('path');

function getRefreshToken() {
    const configPath = path.join(
        process.env.USERPROFILE || process.env.HOME,
        '.config', 'configstore', 'firebase-tools.json'
    );
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.tokens.refresh_token;
}

function exchangeRefreshToken(refreshToken) {
    return new Promise((resolve, reject) => {
        const clientId = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
        const clientSecret = 'j9iVZfS8kkCEFUPaAeJV0sAi';
        const postData = new URLSearchParams({
            grant_type: 'refresh_token', refresh_token: refreshToken,
            client_id: clientId, client_secret: clientSecret,
        }).toString();
        const req = https.request({
            hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const parsed = JSON.parse(data);
                parsed.access_token ? resolve(parsed.access_token) : reject(new Error(`Token exchange failed: ${data}`));
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function main() {
    const USER = {
        uid: '0hnykCqsusOxrWp1QUf7Yu0iMcK2',
        newEmail: 'keylor.cordero@icumed.com',
        displayName: 'Keylor Cordero',
        password: '86316329',
    };

    console.log('Obteniendo access token desde Firebase CLI...');
    const refreshToken = getRefreshToken();
    const accessToken = await exchangeRefreshToken(refreshToken);
    console.log('✔ Access token obtenido\n');

    admin.initializeApp({
        projectId: 'bom-ame-cr',
        credential: { getAccessToken: () => Promise.resolve({ access_token: accessToken, expires_in: 3600 }) },
    });

    console.log('=== Actualización de Keylor Cordero ===\n');

    try {
        const record = await admin.auth().getUser(USER.uid);
        console.log(`  Estado actual: ${record.email} (providers: ${record.providerData.map(p => p.providerId).join(', ')})`);

        await admin.auth().updateUser(USER.uid, {
            email: USER.newEmail,
            password: USER.password,
            emailVerified: false,
            displayName: USER.displayName,
        });

        console.log('\n  ✅ Email actualizado a: ' + USER.newEmail);
        console.log('  ✅ Password establecido: ' + USER.password);

        const updated = await admin.auth().getUser(USER.uid);
        console.log('\n--- Verificación ---');
        console.log(`  Email:    ${updated.email}`);
        console.log(`  Nombre:   ${updated.displayName}`);
        console.log(`  Providers: ${updated.providerData.map(p => `${p.providerId}(${p.email})`).join(', ')}`);

        console.log('\n🎉 ¡Listo! Keylor Cordero ahora puede entrar con:');
        console.log(`   Email:    ${USER.newEmail}`);
        console.log(`   Password: ${USER.password}`);
    } catch (err) {
        console.error(`\n  ✘ ERROR: ${err.message}`);
        process.exit(1);
    }
}

main().catch(err => { console.error('Fatal error:', err.message); process.exit(1); });
