/**
 * Bootstrap Firestore profile docs for newly created users.
 * Signs in as each user to create their users_roles + users docs via REST.
 */
const https = require("https");

const API_KEY = "AIzaSyDGUTnCBWhPpyOrjAf5eQbQaQz0Dm18NXc";
const PROJECT_ID = "bom-ame-cr";

const users = [
    { email: "william.morales@icumed.com", password: "84476308", displayName: "William Morales" },
    { email: "keylor.cordero@icumed.com",  password: "86316329", displayName: "Keylor Cordero" },
    { email: "jorge.arce2@icumed.com",     password: "60401213", displayName: "Jorge Arce" },
];

function httpsPost(hostname, path, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const req = https.request({
            hostname, path, method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        }, (res) => {
            let buf = "";
            res.on("data", c => buf += c);
            res.on("end", () => {
                try { resolve(JSON.parse(buf)); } catch { resolve(buf); }
            });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

function httpsPatch(hostname, path, data, token) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const req = https.request({
            hostname, path, method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
                "Authorization": `Bearer ${token}`,
            },
        }, (res) => {
            let buf = "";
            res.on("data", c => buf += c);
            res.on("end", () => {
                try { resolve(JSON.parse(buf)); } catch { resolve(buf); }
            });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

// Sign in and get idToken + localId
async function signIn(email, password) {
    const result = await httpsPost(
        "identitytoolkit.googleapis.com",
        `/v1/accounts:signInWithPassword?key=${API_KEY}`,
        { email, password, returnSecureToken: true }
    );
    if (result.error) throw new Error(result.error.message);
    return { idToken: result.idToken, uid: result.localId };
}

// Write a Firestore document via REST
async function writeFirestoreDoc(collection, docId, fields, token) {
    const firestoreFields = {};
    for (const [key, val] of Object.entries(fields)) {
        if (typeof val === "string") {
            firestoreFields[key] = { stringValue: val };
        } else if (typeof val === "number") {
            firestoreFields[key] = { integerValue: String(val) };
        } else if (typeof val === "boolean") {
            firestoreFields[key] = { booleanValue: val };
        } else if (val === null) {
            firestoreFields[key] = { nullValue: null };
        }
    }

    const path = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
    const result = await httpsPatch(
        "firestore.googleapis.com",
        path,
        { fields: firestoreFields },
        token
    );
    return result;
}

async function main() {
    console.log("Bootstrapping Firestore profiles for 3 new users...\n");

    for (const u of users) {
        try {
            // 1. Sign in to get auth token
            const { idToken, uid } = await signIn(u.email, u.password);
            console.log(`🔑 ${u.displayName} signed in → uid: ${uid}`);

            // 2. Create users_roles doc (viewer role — self-registration)
            const rolesResult = await writeFirestoreDoc("users_roles", uid, {
                role: "viewer",
                email: u.email,
                createdAt: new Date().toISOString(),
            }, idToken);

            if (rolesResult.error) {
                console.log(`   ⚠️  users_roles: ${rolesResult.error.message}`);
            } else {
                console.log(`   ✅ users_roles/${uid} → role: viewer`);
            }

            // 3. Create users doc (operational profile)
            const usersResult = await writeFirestoreDoc("users", uid, {
                uid: uid,
                email: u.email,
                displayName: u.displayName,
                teamRole: "engineer",
                operationalRole: "engineer",
                weeklyCapacityHours: "48",
                createdAt: new Date().toISOString(),
            }, idToken);

            if (usersResult.error) {
                console.log(`   ⚠️  users: ${usersResult.error.message}`);
            } else {
                console.log(`   ✅ users/${uid} → teamRole: engineer`);
            }

            console.log("");
        } catch (err) {
            console.error(`❌ ${u.displayName}: ${err.message}\n`);
        }
    }
    console.log("✅ Done. Reload the Settings page to see the new users.");
}

main();
