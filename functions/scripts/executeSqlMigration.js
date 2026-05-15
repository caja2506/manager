/**
 * Execute SQL Migration on Supabase
 * ===================================
 * Uses the Supabase Management API to execute raw SQL.
 * Falls back to statement-by-statement execution via REST if needed.
 *
 * USAGE: node scripts/executeSqlMigration.js
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://mkymgptfmtlqpdswvywo.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) throw new Error("Missing SUPABASE_SERVICE_KEY env var.");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Split SQL into individual statements (handles DO $$ blocks)
function splitStatements(sql) {
    const stmts = [];
    let current = "";
    let inDollarBlock = false;

    const lines = sql.split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        // Skip pure comments and empty lines when not in a block
        if (!inDollarBlock && (trimmed === "" || trimmed.startsWith("--"))) continue;

        current += line + "\n";

        if (trimmed.includes("$$") && !inDollarBlock) {
            // Check if this line opens a $$ block (and doesn't also close it)
            const count = (trimmed.match(/\$\$/g) || []).length;
            if (count === 1) inDollarBlock = true;
            else if (count >= 2) {
                // Opens and might close — check if it's a complete statement
                // Still accumulate
            }
        } else if (trimmed.includes("$$") && inDollarBlock) {
            inDollarBlock = false;
        }

        // Statement ends with ; at end of line (outside $$ blocks)
        if (!inDollarBlock && trimmed.endsWith(";")) {
            const stmt = current.trim();
            if (stmt && !stmt.startsWith("--")) {
                stmts.push(stmt);
            }
            current = "";
        }
    }

    // Catch any remaining
    if (current.trim()) {
        stmts.push(current.trim());
    }

    return stmts;
}

async function executeViaPgMeta(sql) {
    // Try the Supabase pg-meta SQL endpoint
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: "POST",
        headers: {
            "apikey": SERVICE_KEY,
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        body: JSON.stringify({ query: sql }),
    });
    return resp;
}

async function main() {
    const sqlFile = process.argv[2] || path.join(__dirname, "..", "..", "supabase", "migrations", "004_extended_schema.sql");

    if (!fs.existsSync(sqlFile)) {
        console.error(`❌ SQL file not found: ${sqlFile}`);
        process.exit(1);
    }

    console.log("╔══════════════════════════════════════════════╗");
    console.log("║  Execute SQL Migration on Supabase           ║");
    console.log("╚══════════════════════════════════════════════╝");
    console.log(`  File: ${path.basename(sqlFile)}`);

    const rawSql = fs.readFileSync(sqlFile, "utf8");
    const statements = splitStatements(rawSql);
    console.log(`  Statements: ${statements.length}\n`);

    let success = 0, failed = 0;

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const preview = stmt.substring(0, 80).replace(/\n/g, " ").trim();
        process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}...`);

        try {
            // Use supabase.rpc to call a helper, or try direct SQL via pg-meta
            // For DDL, we need to use the SQL endpoint
            const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
                method: "POST",
                headers: {
                    "apikey": SERVICE_KEY,
                    "Authorization": `Bearer ${SERVICE_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query: stmt }),
            });

            if (resp.ok) {
                console.log(" ✅");
                success++;
            } else {
                const body = await resp.text();
                // If exec_sql doesn't exist, try creating it first
                if (body.includes("Could not find the function") && i === 0) {
                    console.log(" ⚠️ exec_sql function not found, creating it...");
                    await createExecSqlFunction();
                    // Retry
                    const retry = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
                        method: "POST",
                        headers: {
                            "apikey": SERVICE_KEY,
                            "Authorization": `Bearer ${SERVICE_KEY}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ query: stmt }),
                    });
                    if (retry.ok) {
                        console.log(" ✅ (retry)");
                        success++;
                    } else {
                        const err = await retry.text();
                        console.log(` ❌ ${err.substring(0, 100)}`);
                        failed++;
                    }
                } else {
                    console.log(` ❌ ${body.substring(0, 120)}`);
                    failed++;
                }
            }
        } catch (e) {
            console.log(` ❌ ${e.message}`);
            failed++;
        }
    }

    console.log(`\n  ═══════════════════════════════════════`);
    console.log(`  Results: ${success} ✅ | ${failed} ❌`);
    console.log(`  ═══════════════════════════════════════`);
}

async function createExecSqlFunction() {
    // Create a SECURITY DEFINER function that can execute arbitrary SQL
    // This is needed because Supabase REST API doesn't support raw DDL
    const createFn = `
        CREATE OR REPLACE FUNCTION exec_sql(query text)
        RETURNS void AS $$
        BEGIN
            EXECUTE query;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    // We need to bootstrap this via a different method
    // Try using the Supabase SQL editor API
    console.log("  Attempting to create exec_sql helper function...");

    // Use the pg endpoint 
    const endpoints = [
        `${SUPABASE_URL}/rest/v1/rpc/`,
    ];

    // Since we can't create the function via REST, let the user know
    console.log("  ⚠️  Cannot create exec_sql function via REST API.");
    console.log("  ℹ️  Please execute the following in Supabase SQL Editor first:");
    console.log("  ");
    console.log("  CREATE OR REPLACE FUNCTION exec_sql(query text)");
    console.log("  RETURNS void AS $$ BEGIN EXECUTE query; END; $$ LANGUAGE plpgsql SECURITY DEFINER;");
    console.log("  ");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
