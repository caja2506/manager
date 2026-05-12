/**
 * Migrate settings collection specifically
 * Settings table uses `key` as PK instead of `firestore_id`
 */
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://mkymgptfmtlqpdswvywo.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reW1ncHRmbXRscXBkc3d2eXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE4MjEwMiwiZXhwIjoyMDkzNzU4MTAyfQ.IzegMIzSgWNXALkiHrsFRBJW2wmS6aG7YP5TJ02FYRY";
const PROJECT_ID = "bom-ame-cr";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function getAccessToken() {
    const credPath = path.join(
        process.env.APPDATA || process.env.HOME,
        "firebase",
        "caja2506_gmail_com_application_default_credentials.json"
    );
    if (!fs.existsSync(credPath)) throw new Error("Firebase CLI creds not found.");
    const creds = JSON.parse(fs.readFileSync(credPath, "utf8"));
    const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: creds.client_id,
            client_secret: creds.client_secret,
            refresh_token: creds.refresh_token,
            grant_type: "refresh_token",
        }),
    });
    const data = await resp.json();
    return data.access_token;
}

function parseFirestoreValue(val) {
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.integerValue !== undefined) return Number(val.integerValue);
    if (val.doubleValue !== undefined) return val.doubleValue;
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.nullValue !== undefined) return null;
    if (val.timestampValue !== undefined) return val.timestampValue;
    if (val.arrayValue) return (val.arrayValue.values || []).map(parseFirestoreValue);
    if (val.mapValue) {
        const r = {};
        for (const [k, v] of Object.entries(val.mapValue.fields || {})) r[k] = parseFirestoreValue(v);
        return r;
    }
    return null;
}

async function main() {
    const token = await getAccessToken();
    const resp = await fetch(`${FIRESTORE_BASE}/settings?pageSize=300`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const body = await resp.json();
    const docs = (body.documents || []).map(d => {
        const id = d.name.split("/").pop();
        const fields = {};
        for (const [k, v] of Object.entries(d.fields || {})) {
            fields[k] = parseFirestoreValue(v);
        }
        return { id, ...fields };
    });

    console.log(`Settings docs found: ${docs.length}`);

    for (const doc of docs) {
        const row = {
            key: doc.id,
            value: JSON.stringify(doc),
            description: doc.description || "",
            category: doc.category || "general",
        };
        const { error } = await supabase.from("settings").upsert(row, { onConflict: "key" });
        if (error) console.error(`  ❌ ${doc.id}: ${error.message}`);
        else console.log(`  ✅ ${doc.id}`);
    }
}

main().catch(e => console.error(e));
