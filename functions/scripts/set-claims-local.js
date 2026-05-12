/**
 * set-claims-local.js
 * Uses Firebase CLI's stored refresh token to get an access token
 * and set custom claims via Identity Toolkit REST API.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_PATH = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const PROJECT_ID = 'bom-ame-cr';

const USER_UIDS = [
    '0hnykCqsusOxrWp1QUf7Yu0iMcK2',
    'B4o8UZiHZ4fvHaJtwzivKTXWZ2l1',
    'E8HtB4YAPLNlyogj9qNr07k6Q192',
    'Tf9Fa3Psr3NfNTL6X85lM1XFbEp2',
    'YML7bjJj1CMliAa9cWLci0s9Qod2',
    'f7jhLgYoXmTKOVKadbhcR5cuGSQ2',
    'inlsaFAEhmMrAKBoBJMGFsmqXph2',
    'm9CRdKjpGNZcSHtxgEBgoUsv0B22',
    'tp5uEA6o5JZrS45tsyEXl6Sp6OI3',
    'ycOfDVr8jPN4A70paAW16UlNyew2',
];

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

async function getAccessToken(refreshToken) {
    // Firebase CLI uses Google OAuth2 with its own client ID
    const FIREBASE_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
    const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
    
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: FIREBASE_CLIENT_ID,
        client_secret: FIREBASE_CLIENT_SECRET,
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

async function setCustomClaims(accessToken, uid, claims) {
    const body = JSON.stringify({
        localId: uid,
        customAttributes: JSON.stringify(claims),
    });

    const res = await httpRequest({
        hostname: 'identitytoolkit.googleapis.com',
        path: `/v1/projects/${PROJECT_ID}/accounts:update`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        },
    }, body);

    return res;
}

async function main() {
    console.log('🔧 Setting role:authenticated claims for all Firebase users...\n');
    
    // Read Firebase CLI config
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const refreshToken = config.tokens.refresh_token;
    
    // Get access token
    console.log('🔑 Getting access token from Firebase CLI credentials...');
    const accessToken = await getAccessToken(refreshToken);
    console.log('✅ Access token obtained\n');
    
    let updated = 0;
    let errors = 0;
    
    for (const uid of USER_UIDS) {
        try {
            const res = await setCustomClaims(accessToken, uid, { role: 'authenticated' });
            if (res.status === 200) {
                console.log(`  ✅ ${uid} — claim set`);
                updated++;
            } else {
                console.log(`  ❌ ${uid} — HTTP ${res.status}: ${JSON.stringify(res.data)}`);
                errors++;
            }
        } catch (err) {
            console.log(`  ❌ ${uid} — ${err.message}`);
            errors++;
        }
    }
    
    console.log(`\n📊 Results: ${updated} updated, ${errors} errors`);
    console.log('✅ Done! Users must re-login or force token refresh to get new claims.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
