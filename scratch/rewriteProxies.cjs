const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'services');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('Service.js') || f === 'ganttPlannerSync.js');

let count = 0;

for (const file of files) {
    const filePath = path.join(srcDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check if it's a proxy file
    if (!content.includes('const impl = USE_SUPABASE') || !content.includes('await import')) {
        continue;
    }

    // Extract basename from the import (e.g. './activityLogService.supabase.js' -> 'activityLogService')
    const match = content.match(/await import\('\.\/([^']+)\.supabase\.js'\)/);
    if (!match) continue;
    const baseName = match[1];

    // Find all exports
    const exportRegex = /export const (\w+) = impl\.\w+;/g;
    let exportsMatches = [];
    let m;
    while ((m = exportRegex.exec(content)) !== null) {
        exportsMatches.push(m[1]);
    }

    if (exportsMatches.length === 0) continue;

    // Generate new content
    let newContent = `/**
 * ${baseName} \u2014 Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './${baseName}.supabase.js';
import * as firebaseImpl from './${baseName}.firebase.js';

`;

    for (const exp of exportsMatches) {
        // If it's all uppercase, it's a constant
        if (/^[A-Z_]+$/.test(exp)) {
            newContent += `export const ${exp} = USE_SUPABASE ? supabaseImpl.${exp} : firebaseImpl.${exp};\n`;
        } else {
            newContent += `export const ${exp} = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).${exp}(...args);\n`;
        }
    }

    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Rewrote ${file}`);
    count++;
}

console.log(`Successfully rewrote ${count} files.`);
