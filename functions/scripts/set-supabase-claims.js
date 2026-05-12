/**
 * set-supabase-claims.js — One-time Script
 * ==========================================
 * Sets the `role: 'authenticated'` custom claim on ALL existing
 * Firebase users. Required for Supabase Third-Party Auth + RLS.
 * 
 * Usage:
 *   node functions/scripts/set-supabase-claims.js
 * 
 * Prerequisites:
 *   - Firebase Admin SDK must be initialized (GOOGLE_APPLICATION_CREDENTIALS
 *     or running in a GCP environment)
 *   - Or use: firebase functions:shell and require this script
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

// Initialize Firebase Admin (uses GOOGLE_APPLICATION_CREDENTIALS or default)
initializeApp();
const auth = getAuth();

async function setClaimsForAllUsers() {
    console.log("🔧 Setting 'role: authenticated' claim for all Firebase users...\n");
    
    let nextPageToken;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    do {
        const listResult = await auth.listUsers(100, nextPageToken);
        
        for (const user of listResult.users) {
            const existingClaims = user.customClaims || {};
            
            if (existingClaims.role === "authenticated") {
                console.log(`  ✅ ${user.email || user.uid} — already has claim, skipping`);
                totalSkipped++;
            } else {
                // Preserve existing claims and add/override role
                const newClaims = { ...existingClaims, role: "authenticated" };
                await auth.setCustomUserClaims(user.uid, newClaims);
                console.log(`  🔄 ${user.email || user.uid} — claim set: role=authenticated`);
                totalUpdated++;
            }
            totalProcessed++;
        }
        
        nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    console.log(`\n📊 Results:`);
    console.log(`   Total processed: ${totalProcessed}`);
    console.log(`   Updated: ${totalUpdated}`);
    console.log(`   Already had claim: ${totalSkipped}`);
    console.log(`\n✅ Done! Users will get the new claim on their next token refresh.`);
    console.log(`   Tip: Force refresh in app with: auth.currentUser.getIdToken(true)`);
}

setClaimsForAllUsers().catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
});
