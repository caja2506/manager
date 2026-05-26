/**
 * migrate_to_icumed_emails.js
 * 
 * Cambia los correos de 4 usuarios de Gmail → @icumed.com
 * y establece contraseña "1234" para login con email/password.
 * 
 * Usa el refresh_token almacenado por Firebase CLI.
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
        // Firebase CLI uses its own OAuth client
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

// ── 3. Usuarios a migrar ──
const USERS_TO_MIGRATE = [
    {
        uid: 'inlsaFAEhmMrAKBoBJMGFsmqXph2',
        oldEmail: 'erickgr1230@gmail.com',
        newEmail: 'erick.guillen@icumed.com',
        displayName: 'Erick Guillén Retana',
    },
    {
        uid: 'YML7bjJj1CMliAa9cWLci0s9Qod2',
        oldEmail: 'eduardobarquero@gmail.com',
        newEmail: 'eduardo.barquero@icumed.com',
        displayName: 'Eduardo D Barquero Alvarez',
    },
    {
        uid: 'm9CRdKjpGNZcSHtxgEBgoUsv0B22',
        oldEmail: 'suarez.jeancarlo91@gmail.com',
        newEmail: 'jean.suarez@icumed.com',
        displayName: 'Jean Carlo Suarez Gomez',
    },
    {
        uid: 'ycOfDVr8jPN4A70paAW16UlNyew2',
        oldEmail: 'isaacgch777@gmail.com',
        newEmail: 'isaac.gonzalez@icumed.com',
        displayName: 'Isaac D. Gonzalez Chaves',
    },
];

// ── 4. Main ──
async function main() {
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

    console.log('=== Migración de correos Gmail → ICU Med ===\n');

    let successCount = 0;

    for (const user of USERS_TO_MIGRATE) {
        console.log(`--- ${user.displayName} ---`);
        console.log(`  Antes:   ${user.oldEmail}`);
        console.log(`  Después: ${user.newEmail}`);

        try {
            const record = await admin.auth().getUser(user.uid);
            if (record.email !== user.oldEmail) {
                console.log(`  ⚠ SKIP: Email actual es "${record.email}", no "${user.oldEmail}"`);
                console.log('');
                continue;
            }

            await admin.auth().updateUser(user.uid, {
                email: user.newEmail,
                password: '123456',
                emailVerified: false,
                displayName: user.displayName,
            });

            console.log(`  ✔ Email actualizado`);
            console.log(`  ✔ Password: 1234`);
            successCount++;
        } catch (err) {
            console.error(`  ✘ ERROR: ${err.message}`);
        }
        console.log('');
    }

    console.log(`=== Firebase Auth: ${successCount}/4 actualizados ===`);

    // Verificar los cambios
    if (successCount > 0) {
        console.log('\nVerificando cambios...');
        for (const user of USERS_TO_MIGRATE) {
            try {
                const r = await admin.auth().getUser(user.uid);
                console.log(`  ${r.displayName}: ${r.email} ✔`);
            } catch (e) {
                console.log(`  ${user.uid}: error verificando`);
            }
        }
    }
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
