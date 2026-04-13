#!/usr/bin/env node
/**
 * Bootstrap Firestore Profile Docs for New Users
 * =================================================
 * 
 * SECURITY: This script contains NO hardcoded credentials.
 * All sensitive values MUST be supplied via environment variables
 * or a local .env file (which MUST NOT be committed to git).
 * 
 * Required environment variables:
 *   FIREBASE_API_KEY       — Firebase Web API key
 *   FIREBASE_PROJECT_ID    — Firebase project ID (e.g. 'bom-ame-cr')
 *   BOOTSTRAP_USERS_JSON   — Path to a JSON file with user definitions
 *                            Format: [{ "email": "...", "password": "...", "displayName": "..." }]
 * 
 * Optional:
 *   BOOTSTRAP_ENV           — Must be set to 'production' to run against prod.
 *                             If unset, the script runs in dry-run mode.
 * 
 * Usage:
 *   # 1. Create a users.json file (NEVER commit this file):
 *   #    [{ "email": "user@example.com", "password": "secure_pwd", "displayName": "Name" }]
 *   
 *   # 2. Set environment variables:
 *   #    export FIREBASE_API_KEY="AIza..."
 *   #    export FIREBASE_PROJECT_ID="my-project"
 *   #    export BOOTSTRAP_USERS_JSON="./users.json"
 *   
 *   # 3. Run:
 *   #    node functions/scripts/createUsers.js
 * 
 * IMPORTANT:
 *   - This script writes to the `users` collection (current architecture).
 *   - The `users_roles` collection is FROZEN and no longer receives writes.
 *   - New users get rbacRole='viewer' (minimum privilege).
 *   - An admin must manually promote roles via the Settings UI.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// ============================================================
// CONFIGURATION — from environment variables only
// ============================================================

const API_KEY = process.env.FIREBASE_API_KEY;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const USERS_JSON_PATH = process.env.BOOTSTRAP_USERS_JSON;
const BOOTSTRAP_ENV = process.env.BOOTSTRAP_ENV || "dry-run";

// ============================================================
// VALIDATION — fail fast with clear messages
// ============================================================

function validateConfig() {
    const errors = [];

    if (!API_KEY) {
        errors.push("FIREBASE_API_KEY is not set. Set it via environment variable.");
    }
    if (!PROJECT_ID) {
        errors.push("FIREBASE_PROJECT_ID is not set. Set it via environment variable.");
    }
    if (!USERS_JSON_PATH) {
        errors.push("BOOTSTRAP_USERS_JSON is not set. Provide the path to a JSON file with user definitions.");
    }
    if (USERS_JSON_PATH && !fs.existsSync(USERS_JSON_PATH)) {
        errors.push(`BOOTSTRAP_USERS_JSON file not found: ${USERS_JSON_PATH}`);
    }

    if (errors.length > 0) {
        console.error("\n❌ Configuration errors:\n");
        errors.forEach(e => console.error(`   • ${e}`));
        console.error("\nSee the script header for usage instructions.\n");
        process.exit(1);
    }
}

function loadUsers() {
    const raw = fs.readFileSync(path.resolve(USERS_JSON_PATH), "utf-8");
    const users = JSON.parse(raw);

    if (!Array.isArray(users) || users.length === 0) {
        console.error("❌ BOOTSTRAP_USERS_JSON must contain a non-empty JSON array.");
        process.exit(1);
    }

    for (const [i, u] of users.entries()) {
        if (!u.email || !u.password || !u.displayName) {
            console.error(`❌ User at index ${i} is missing required fields (email, password, displayName).`);
            process.exit(1);
        }
    }

    return users;
}

// ============================================================
// HTTP HELPERS
// ============================================================

function httpsPost(hostname, reqPath, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const req = https.request({
            hostname, path: reqPath, method: "POST",
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

function httpsPatch(hostname, reqPath, data, token) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const req = https.request({
            hostname, path: reqPath, method: "PATCH",
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

// ============================================================
// FIREBASE OPERATIONS
// ============================================================

async function signIn(email, password) {
    const result = await httpsPost(
        "identitytoolkit.googleapis.com",
        `/v1/accounts:signInWithPassword?key=${API_KEY}`,
        { email, password, returnSecureToken: true }
    );
    if (result.error) throw new Error(result.error.message);
    return { idToken: result.idToken, uid: result.localId };
}

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

    const docPath = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
    return await httpsPatch("firestore.googleapis.com", docPath, { fields: firestoreFields }, token);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
    validateConfig();
    const users = loadUsers();

    const isDryRun = BOOTSTRAP_ENV !== "production";

    console.log("══════════════════════════════════════════════════");
    console.log("  User Bootstrap Script");
    console.log(`  Project:  ${PROJECT_ID}`);
    console.log(`  Mode:     ${isDryRun ? "🔒 DRY-RUN (set BOOTSTRAP_ENV=production to execute)" : "🔴 PRODUCTION"}`);
    console.log(`  Users:    ${users.length}`);
    console.log("══════════════════════════════════════════════════\n");

    if (isDryRun) {
        console.log("Dry-run mode — validating configuration only.\n");
        for (const u of users) {
            console.log(`  ✓ Would bootstrap: ${u.displayName} (${u.email})`);
        }
        console.log("\n✅ Dry-run complete. Set BOOTSTRAP_ENV=production to execute.\n");
        return;
    }

    // Production execution
    console.log("⚠️  PRODUCTION MODE — writing to Firestore...\n");

    for (const u of users) {
        try {
            // 1. Sign in to get auth token
            const { idToken, uid } = await signIn(u.email, u.password);
            console.log(`🔑 ${u.displayName} signed in → uid: ${uid}`);

            // 2. Create/update users doc (current architecture)
            // NOTE: We write to `users` collection only.
            //       `users_roles` is FROZEN — no new writes.
            //       rbacRole defaults to 'viewer' (minimum privilege).
            //       An admin must promote via Settings UI.
            const usersResult = await writeFirestoreDoc("users", uid, {
                uid: uid,
                email: u.email,
                displayName: u.displayName,
                rbacRole: "viewer",
                teamRole: "engineer",
                weeklyCapacityHours: "48",
                active: true,
                createdAt: new Date().toISOString(),
            }, idToken);

            if (usersResult.error) {
                console.log(`   ⚠️  users: ${usersResult.error.message}`);
            } else {
                console.log(`   ✅ users/${uid} → rbacRole: viewer, teamRole: engineer`);
            }

            console.log("");
        } catch (err) {
            console.error(`❌ ${u.displayName}: ${err.message}\n`);
        }
    }
    console.log("✅ Done. Reload the Settings page to see the new users.");
}

main();
