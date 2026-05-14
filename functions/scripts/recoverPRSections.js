const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const PROJECT_ID = "bom-ame-cr";
const SUPABASE_URL = "https://mkymgptfmtlqpdswvywo.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
    || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reW1ncHRmbXRscXBkc3d2eXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE4MjEwMiwiZXhwIjoyMDkzNzU4MTAyfQ.IzegMIzSgWNXALkiHrsFRBJW2wmS6aG7YP5TJ02FYRY";

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
            client_id: creds.client_id, client_secret: creds.client_secret,
            refresh_token: creds.refresh_token, grant_type: "refresh_token",
        }),
    });
    const data = await resp.json();
    if (!data.access_token) throw new Error("Token failed: " + JSON.stringify(data));
    return data.access_token;
}

function parseDoc(fields) {
    const r = {};
    for (const [k, v] of Object.entries(fields)) r[k] = parseVal(v);
    return r;
}

function parseVal(v) {
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return v.doubleValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.nullValue !== undefined) return null;
    if (v.timestampValue !== undefined) return v.timestampValue;
    if (v.arrayValue) return (v.arrayValue.values || []).map(parseVal);
    if (v.mapValue) return parseDoc(v.mapValue.fields || {});
    return null;
}

async function run() {
    console.log("Fetching token...");
    const token = await getAccessToken();

    console.log("Fetching taskTypes from Firestore...");
    let url = `${FIRESTORE_BASE}/taskTypes?pageSize=300`;
    let pageToken = null;
    const taskTypesFs = [];

    do {
        let fetchUrl = url;
        if (pageToken) fetchUrl += `&pageToken=${pageToken}`;
        const resp = await fetch(fetchUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) { console.error(`Read taskTypes failed: ${resp.status}`); break; }
        const body = await resp.json();
        if (body.documents) {
            for (const doc of body.documents) {
                const id = doc.name.split("/").pop();
                taskTypesFs.push({ ...parseDoc(doc.fields || {}), _firestoreId: id });
            }
        }
        pageToken = body.nextPageToken || null;
    } while (pageToken);

    console.log(`Found ${taskTypesFs.length} taskTypes in Firestore.`);

    let updatedCount = 0;
    for (const tt of taskTypesFs) {
        if (tt.peerReviewSections && tt.peerReviewSections.length > 0) {
            console.log(`Updating ${tt.name} with ${tt.peerReviewSections.length} sections...`);
            const { error } = await supabase
                .from('task_types')
                .update({ peer_review_sections: tt.peerReviewSections })
                .eq('firestore_id', tt._firestoreId);
            
            if (error) {
                console.error(`Error updating ${tt.name}:`, error.message);
            } else {
                updatedCount++;
            }
        }
    }
    console.log(`Done. Updated ${updatedCount} task_types.`);
}

run().catch(console.error);
