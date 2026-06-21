/**
 * Automation Bootstrap
 * =====================
 * 
 * Idempotent seed function for initializing the automation subsystem
 * in Supabase. Safe to call multiple times — never overwrites existing
 * documents.
 * 
 * Call this from the Automation Control Center on first load,
 * or from an admin script.
 * 
 * @module automation/bootstrapAutomation
 */

import { supabase } from '../supabase';
import { createAutomationCoreConfig, createTelegramOpsConfig } from './schemas.js';
import { DEFAULT_ROUTINES } from './routineRegistry.js';

/**
 * Fields from the registry that should be synced to existing Supabase records.
 */
const SYNC_FIELDS = [
    { code: 'name', db: 'name' },
    { code: 'description', db: 'description' },
    { code: 'allowedRoles', db: 'allowed_roles' },
    { code: 'channel', db: 'channel' },
    { code: 'provider', db: 'provider' },
    { code: 'scheduleType', db: 'schedule_type' },
    { code: 'delayMinutes', db: 'delay_minutes' },
    { code: 'gracePeriodMinutes', db: 'grace_period_minutes' },
    { code: 'personalityMode', db: 'personality_mode' },
    { code: 'priority', db: 'priority' },
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

    // Helper to seed settings table
    const seedSettings = async (key, defaultValue) => {
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('key', key)
            .maybeSingle();

        if (error) {
            console.error(`[bootstrap] Error reading settings/${key}:`, error);
            return;
        }

        if (!data) {
            const { error: insErr } = await supabase
                .from('settings')
                .insert({ key, value: defaultValue, category: 'automation' });
            if (insErr) {
                console.error(`[bootstrap] Error creating settings/${key}:`, insErr);
            } else {
                created.push(`settings/${key}`);
            }
        } else {
            skipped.push(`settings/${key}`);
        }
    };

    // ── 1. Create automationCore settings ──
    await seedSettings('automationCore', createAutomationCoreConfig());

    // ── 2. Create telegramOps settings ──
    await seedSettings('telegramOps', createTelegramOpsConfig());

    // ── 2.5. Create automationAI settings ──
    const now = new Date().toISOString();
    await seedSettings('automationAI', {
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

    // ── 3. Create OR sync default routines ──
    for (const routine of DEFAULT_ROUTINES) {
        const { data: existing, error } = await supabase
            .from('automation_routines')
            .select('*')
            .eq('key', routine.key)
            .maybeSingle();

        if (error) {
            console.error(`[bootstrap] Error reading routine ${routine.key}:`, error);
            continue;
        }

        if (!existing) {
            const sbDoc = {
                key: routine.key,
                name: routine.name,
                description: routine.description || '',
                enabled: routine.enabled !== false,
                dry_run: routine.dryRun !== false,
                debug_mode: routine.debugMode === true,
                allowed_roles: routine.allowedRoles || [],
                channel: routine.channel || '',
                provider: routine.provider || '',
                schedule_type: routine.scheduleType || '',
                delay_minutes: Number(routine.delayMinutes || 0),
                grace_period_minutes: Number(routine.gracePeriodMinutes || 0),
                personality_mode: routine.personalityMode || '',
                priority: routine.priority || 'medium',
            };

            const { error: insErr } = await supabase.from('automation_routines').insert(sbDoc);
            if (insErr) {
                console.error(`[bootstrap] Error creating routine ${routine.key}:`, insErr);
            } else {
                created.push(`automation_routines/${routine.key}`);
            }
        } else {
            // Sync: merge registry metadata into existing doc
            const updates = {};
            for (const field of SYNC_FIELDS) {
                const regVal = routine[field.code];
                const dbVal = existing[field.db];
                if (regVal !== undefined) {
                    const regValStr = JSON.stringify(regVal);
                    const dbValStr = JSON.stringify(dbVal);
                    if (regValStr !== dbValStr) {
                        updates[field.db] = regVal;
                    }
                }
            }

            if (Object.keys(updates).length > 0) {
                updates.updated_at = new Date().toISOString();
                const { error: updErr } = await supabase
                    .from('automation_routines')
                    .update(updates)
                    .eq('key', routine.key);

                if (updErr) {
                    console.error(`[bootstrap] Error syncing routine ${routine.key}:`, updErr);
                } else {
                    synced.push(`automation_routines/${routine.key}`);
                    console.log(`[bootstrap] Synced ${routine.key}:`, Object.keys(updates));
                }
            } else {
                skipped.push(`automation_routines/${routine.key}`);
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

