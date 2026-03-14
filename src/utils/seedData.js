/**
 * Firestore Seed Data Utility
 * ============================
 * 
 * Populates the database with initial configuration data:
 * - Delay causes
 * - Task types
 * - System settings
 * 
 * This utility is idempotent — it checks for existing data
 * before creating documents to avoid duplicates.
 * 
 * Usage: Import and call seedDatabase(db) from admin panel or setup script.
 */

import {
    collection,
    getDocs,
    doc,
    setDoc,
    writeBatch,
} from 'firebase/firestore';

import {
    COLLECTIONS,
    DEFAULT_DELAY_CAUSES,
    DEFAULT_TASK_TYPES,
    DEFAULT_SETTINGS,
    createDelayCauseDocument,
    createTaskTypeDocument,
    createSettingDocument,
} from '../models/schemas';


/**
 * Seeds the delayCauses collection with default delay causes.
 * Skips if the collection already has documents.
 * 
 * @param {import('firebase/firestore').Firestore} db 
 * @returns {{ seeded: boolean, count: number }}
 */
export async function seedDelayCauses(db) {
    const colRef = collection(db, COLLECTIONS.DELAY_CAUSES);
    const snapshot = await getDocs(colRef);

    if (snapshot.size > 0) {
        console.log(`[Seed] delayCauses already has ${snapshot.size} documents. Skipping.`);
        return { seeded: false, count: snapshot.size };
    }

    const batch = writeBatch(db);

    DEFAULT_DELAY_CAUSES.forEach((cause) => {
        const docRef = doc(colRef);
        batch.set(docRef, createDelayCauseDocument(cause));
    });

    await batch.commit();
    console.log(`[Seed] Created ${DEFAULT_DELAY_CAUSES.length} default delay causes.`);
    return { seeded: true, count: DEFAULT_DELAY_CAUSES.length };
}


/**
 * Seeds the taskTypes collection with default task types.
 * Skips if the collection already has documents.
 * 
 * @param {import('firebase/firestore').Firestore} db 
 * @returns {{ seeded: boolean, count: number }}
 */
export async function seedTaskTypes(db) {
    const colRef = collection(db, COLLECTIONS.TASK_TYPES);
    const snapshot = await getDocs(colRef);

    if (snapshot.size > 0) {
        console.log(`[Seed] taskTypes already has ${snapshot.size} documents. Skipping.`);
        return { seeded: false, count: snapshot.size };
    }

    const batch = writeBatch(db);

    DEFAULT_TASK_TYPES.forEach((taskType) => {
        const docRef = doc(colRef);
        batch.set(docRef, createTaskTypeDocument(taskType));
    });

    await batch.commit();
    console.log(`[Seed] Created ${DEFAULT_TASK_TYPES.length} default task types.`);
    return { seeded: true, count: DEFAULT_TASK_TYPES.length };
}


/**
 * Seeds the settings collection with default system settings.
 * Uses the setting key as the document ID.
 * Skips individual settings that already exist.
 * 
 * @param {import('firebase/firestore').Firestore} db 
 * @returns {{ seeded: number, skipped: number }}
 */
export async function seedSettings(db) {
    const colRef = collection(db, COLLECTIONS.SETTINGS);
    const snapshot = await getDocs(colRef);
    const existingKeys = new Set(snapshot.docs.map(d => d.id));

    let seeded = 0;
    let skipped = 0;

    for (const setting of DEFAULT_SETTINGS) {
        if (existingKeys.has(setting.key)) {
            console.log(`[Seed] Setting "${setting.key}" already exists. Skipping.`);
            skipped++;
            continue;
        }

        const docRef = doc(db, COLLECTIONS.SETTINGS, setting.key);
        await setDoc(docRef, createSettingDocument(setting));
        seeded++;
        console.log(`[Seed] Created setting: "${setting.key}"`);
    }

    return { seeded, skipped };
}


/**
 * Seeds all default data.
 * Safe to call multiple times — idempotent.
 * 
 * @param {import('firebase/firestore').Firestore} db 
 * @returns {Object} Results summary
 */
export async function seedDatabase(db) {
    console.log('[Seed] Starting database seeding...');

    const results = {
        delayCauses: await seedDelayCauses(db),
        taskTypes: await seedTaskTypes(db),
        settings: await seedSettings(db),
    };

    console.log('[Seed] Database seeding complete:', results);
    return results;
}
