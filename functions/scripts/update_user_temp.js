const admin = require('firebase-admin');
const https = require('https');
const fs = require('fs');
const path = require('path');

function getRefreshToken() {
    const configPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8')).tokens.refresh_token;
}

function exchangeRefreshToken(refreshToken) {
    return new Promise((resolve, reject) => {
        const postData = new URLSearchParams({
            grant_type: 'refresh_token', refresh_token: refreshToken,
            client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
            client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
        }).toString();
        const req = https.request({
            hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
        }, (res) => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => { const p = JSON.parse(data); p.access_token ? resolve(p.access_token) : reject(new Error(data)); });
        });
        req.on('error', reject); req.write(postData); req.end();
    });
}

async function main() {
    const refreshToken = getRefreshToken();
    const accessToken = await exchangeRefreshToken(refreshToken);
    admin.initializeApp({ projectId: 'bom-ame-cr', credential: { getAccessToken: () => Promise.resolve({ access_token: accessToken, expires_in: 3600 }) } });

    const USER = { uid: 'tp5uEA6o5JZrS45tsyEXl6Sp6OI3', newEmail: 'jose.piedra@icumed.com', displayName: 'Jose A Piedra Venegas', password: '88667667' };

    const record = await admin.auth().getUser(USER.uid);
    console.log(`Estado actual: ${record.email}`);
    await admin.auth().updateUser(USER.uid, { password: USER.password });
    console.log(`\n✅ Password corregido: ${USER.password}`);
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
