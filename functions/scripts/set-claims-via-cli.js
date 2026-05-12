/**
 * set-claims-via-cli.js
 * Uses Firebase CLI's Application Default Credentials to set custom claims.
 */
const { GoogleAuth } = require('google-auth-library');

const PROJECT_ID = 'bom-ame-cr';

// All user UIDs from the export
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

async function setClaimsViaREST() {
    // Use gcloud/firebase Application Default Credentials
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/firebase', 'https://www.googleapis.com/auth/identitytoolkit'],
    });
    
    const client = await auth.getClient();
    
    for (const uid of USER_UIDS) {
        const url = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`;
        
        try {
            const res = await client.request({
                url,
                method: 'POST',
                data: {
                    localId: uid,
                    customAttributes: JSON.stringify({ role: 'authenticated' }),
                },
            });
            console.log(`✅ ${uid} — claim set`);
        } catch (err) {
            console.error(`❌ ${uid} — ${err.message}`);
        }
    }
    console.log('\n🎉 Done!');
}

setClaimsViaREST();
