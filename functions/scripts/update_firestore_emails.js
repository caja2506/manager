const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

async function checkFirestore() {
    const usersSnap = await db.collection("users").get();
    console.log(`Found ${usersSnap.size} users in Firestore`);
    
    let dbUpdatedCount = 0;
    
    for (const doc of usersSnap.docs) {
        const data = doc.data();
        let newEmail = null;
        if (data.email) {
            if (data.email.endsWith('@icumed.com')) {
                newEmail = data.email.replace('@icumed.com', '@analizeops.com');
            } else if (data.email.endsWith('@example.com')) {
               newEmail = data.email.replace('@example.com', '@analizeops.com');
            }
        }
        
        if (newEmail) {
            console.log(`Updating Firestore user ${doc.id} email to ${newEmail}`);
            await doc.ref.update({ email: newEmail });
            dbUpdatedCount++;
        }
    }
    
    console.log(`Firestore updated: ${dbUpdatedCount}`);
}

checkFirestore();
