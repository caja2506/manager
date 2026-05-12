const admin = require('firebase-admin');

const token = process.env.GOOGLE_OAUTH_TOKEN;
if (!token) throw new Error("Missing GOOGLE_OAUTH_TOKEN env var. Generate with: gcloud auth print-access-token");
admin.initializeApp({ 
    projectId: "bom-ame-cr",
    credential: {
        getAccessToken: () => Promise.resolve({ access_token: token, expires_in: 3600 })
    }
});

async function updateEmails() {
    try {
        console.log("Fetching users...");
        const listUsersResult = await admin.auth().listUsers(1000);
        let updatedCount = 0;
        let deletedCount = 0;
        for (const userRecord of listUsersResult.users) {
            if (userRecord.email && userRecord.email.includes('pentest_aizas')) {
                console.log(`Deleting user ${userRecord.uid} (${userRecord.email})`);
                await admin.auth().deleteUser(userRecord.uid);
                console.log(`Successfully deleted ${userRecord.email}`);
                deletedCount++;
                continue;
            }
            
            if (userRecord.email && userRecord.email.endsWith('@analizeops.com')) {
                const newEmail = userRecord.email.replace('@analizeops.com', '@analyzeops.com');
                console.log(`Updating user ${userRecord.uid} email from ${userRecord.email} to ${newEmail}`);
                try {
                    await admin.auth().updateUser(userRecord.uid, { email: newEmail });
                    console.log(`Successfully updated ${userRecord.email}`);
                    updatedCount++;
                } catch (updateErr) {
                    console.error(`Failed to update ${userRecord.email}: ${updateErr.message}`);
                }
            }
        }
        console.log(`Finished updating. Total updated: ${updatedCount}. Total deleted: ${deletedCount}`);
    } catch (error) {
        console.error("Error listing users:", error.message);
    }
}

updateEmails();
