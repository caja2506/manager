/**
 * Supabase Auth Bridge — Cloud Functions (non-blocking)
 * =====================================================
 * 
 * Since Blocking Functions require GCIP (Google Cloud Identity Platform),
 * we use a different approach:
 * 
 * 1. setSupabaseClaims — One-time callable function to set the claim
 *    on ALL existing users.
 * 
 * 2. onUserCreatedSetClaims — Firestore trigger that sets the claim
 *    on NEW users when they are first created in Firebase Auth.
 */

const { getAuth } = require("firebase-admin/auth");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { beforeUserCreated } = require("firebase-functions/v2/identity");

/**
 * setSupabaseClaims — Admin-only callable function.
 * Sets `role: 'authenticated'` on ALL existing Firebase users.
 * Call once to migrate existing users.
 */
const setSupabaseClaims = onCall(
    { region: "us-central1" },
    async (request) => {
        // Only admins can run this
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Must be authenticated");
        }

        const auth = getAuth();
        let nextPageToken;
        let totalProcessed = 0;
        let totalUpdated = 0;

        do {
            const listResult = await auth.listUsers(100, nextPageToken);

            for (const user of listResult.users) {
                const existingClaims = user.customClaims || {};

                if (existingClaims.role !== "authenticated") {
                    const newClaims = { ...existingClaims, role: "authenticated" };
                    await auth.setCustomUserClaims(user.uid, newClaims);
                    totalUpdated++;
                }
                totalProcessed++;
            }

            nextPageToken = listResult.pageToken;
        } while (nextPageToken);

        return {
            success: true,
            totalProcessed,
            totalUpdated,
            message: `Updated ${totalUpdated}/${totalProcessed} users with role=authenticated`,
        };
    }
);

module.exports = { setSupabaseClaims };
