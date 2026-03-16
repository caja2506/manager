/**
 * Automation Bootstrap
 * =====================
 * 
 * Idempotent seed function for initializing the automation subsystem
 * in Firestore. Safe to call multiple times — never overwrites existing
 * documents.
 * 
 * Call this from the Automation Control Center on first load,
 * or from an admin script.
 * 
 * @module automation/bootstrapAutomation
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import {
    SETTINGS_COLLECTION,
    SETTINGS_DOCS,
    AUTOMATION_ROUTINES,
} from './firestorePaths.js';
import { createAutomationCoreConfig, createTelegramOpsConfig } from './schemas.js';
import { DEFAULT_ROUTINES } from './routineRegistry.js';

/**
 * Fields from the registry that should be synced to existing Firestore docs.
 * These are "source-of-truth" metadata fields managed in code.
 * User-controlled fields (enabled, dryRun, debugMode, lastRunAt, etc.) are preserved.
 */
const SYNC_FIELDS = [
    'name', 'description', 'allowedRoles', 'channel', 'provider',
    'scheduleType', 'delayMinutes', 'gracePeriodMinutes',
    'personalityMode', 'priority',
];

/**
 * Bootstrap the automation subsystem.
 * Creates default configuration and routine documents if they don't exist.
 * Also syncs existing routine documents with the latest registry metadata.
 * 
 * @returns {Promise<{ created: string[], skipped: string[], synced: string[] }>} Summary of actions taken
 */
export async function bootstrapAutomation() {
    const created = [];
    const skipped = [];
    const synced = [];

    // ── 1. Create automationCore settings ──
    const coreRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOCS.AUTOMATION_CORE);
    const coreSnap = await getDoc(coreRef);
    if (!coreSnap.exists()) {
        await setDoc(coreRef, createAutomationCoreConfig());
        created.push(`${SETTINGS_COLLECTION}/${SETTINGS_DOCS.AUTOMATION_CORE}`);
    } else {
        skipped.push(`${SETTINGS_COLLECTION}/${SETTINGS_DOCS.AUTOMATION_CORE}`);
    }

    // ── 2. Create telegramOps settings ──
    const tgRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOCS.TELEGRAM_OPS);
    const tgSnap = await getDoc(tgRef);
    if (!tgSnap.exists()) {
        await setDoc(tgRef, createTelegramOpsConfig());
        created.push(`${SETTINGS_COLLECTION}/${SETTINGS_DOCS.TELEGRAM_OPS}`);
    } else {
        skipped.push(`${SETTINGS_COLLECTION}/${SETTINGS_DOCS.TELEGRAM_OPS}`);
    }

    // ── 2.5. Create automationAI settings ──
    const aiRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOCS.AUTOMATION_AI);
    const aiSnap = await getDoc(aiRef);
    if (!aiSnap.exists()) {
        const now = new Date().toISOString();
        await setDoc(aiRef, {
            enabled: true,
            provider: 'gemini',
            defaultModel: 'gemini-2.5-flash',
            multimodalModel: 'gemini-2.5-flash',
            textModel: 'gemini-2.5-flash',
            briefingModel: 'gemini-2.5-flash',
            extractionModel: 'gemini-2.5-flash',
            confidenceThreshold: 0.8,
            confirmationThreshold: 0.5,
            allowAudioProcessing: true,
            allowSmartBriefings: true,
            allowSmartEscalationHints: true,
            debugPrompts: false,
            storeRawTranscripts: false,
            redactSensitiveText: false,
            createdAt: now,
            updatedAt: now,
        });
        created.push(`${SETTINGS_COLLECTION}/${SETTINGS_DOCS.AUTOMATION_AI}`);
    } else {
        skipped.push(`${SETTINGS_COLLECTION}/${SETTINGS_DOCS.AUTOMATION_AI}`);
    }

    // ── 3. Create OR sync default routines ──
    for (const routine of DEFAULT_ROUTINES) {
        const routineRef = doc(db, AUTOMATION_ROUTINES, routine.key);
        const routineSnap = await getDoc(routineRef);
        if (!routineSnap.exists()) {
            await setDoc(routineRef, routine);
            created.push(`${AUTOMATION_ROUTINES}/${routine.key}`);
        } else {
            // Sync: merge registry metadata into existing doc
            const existing = routineSnap.data();
            const updates = {};
            for (const field of SYNC_FIELDS) {
                if (routine[field] !== undefined) {
                    const registryVal = JSON.stringify(routine[field]);
                    const firestoreVal = JSON.stringify(existing[field]);
                    if (registryVal !== firestoreVal) {
                        updates[field] = routine[field];
                    }
                }
            }
            if (Object.keys(updates).length > 0) {
                updates.updatedAt = new Date().toISOString();
                await updateDoc(routineRef, updates);
                synced.push(`${AUTOMATION_ROUTINES}/${routine.key}`);
                console.log(`[bootstrap] Synced ${routine.key}:`, Object.keys(updates));
            } else {
                skipped.push(`${AUTOMATION_ROUTINES}/${routine.key}`);
            }
        }
    }

    const summary = {
        created,
        skipped,
        synced,
        totalCreated: created.length,
        totalSkipped: skipped.length,
        totalSynced: synced.length,
    };

    if (created.length > 0) {
        console.log(`[bootstrap] Created ${created.length} documents:`, created);
    }
    if (synced.length > 0) {
        console.log(`[bootstrap] Synced ${synced.length} routines:`, synced);
    }
    if (skipped.length > 0) {
        console.log(`[bootstrap] Skipped ${skipped.length} (up to date):`, skipped);
    }

    return summary;
}
