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

    const USER = { uid: 'E8HtB4YAPLNlyogj9qNr07k6Q192', newEmail: 'jorge.arce2@icumed.com', displayName: 'Jorge Arce', password: '60401213' };

    const record = await admin.auth().getUser(USER.uid);
    console.log(`Estado actual: ${record.email}`);
    await admin.auth().updateUser(USER.uid, { email: USER.newEmail, password: USER.password, emailVerified: false, displayName: USER.displayName });
    const updated = await admin.auth().getUser(USER.uid);
    console.log(`\n✅ Email:    ${updated.email}`);
    console.log(`✅ Password: ${USER.password}`);
    console.log(`✅ Nombre:   ${updated.displayName}`);
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
