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
 * Seeds the peerReviewTemplates collection with initial generic templates.
 * Skips if templates already exist.
 */
export async function seedPeerReviewTemplates(db) {
    const colRef = collection(db, 'peerReviewTemplates');
    const snapshot = await getDocs(colRef);

    if (snapshot.size > 0) {
        console.log(`[Seed] peerReviewTemplates already has ${snapshot.size} documents. Skipping.`);
        return { seeded: false, count: snapshot.size };
    }

    const templates = [
        {
            id: 'programming',
            name: 'Programming Review',
            discipline: 'programming',
            items: [
                { id: 'logic_objective', label: 'Logic fulfills intended task objective', required: true },
                { id: 'sequence_interlocks', label: 'Sequence/interlocks reviewed', required: true },
                { id: 'alarms_abnormal', label: 'Alarms or abnormal cases considered', required: true },
                { id: 'reset_recovery', label: 'Reset/recovery behavior considered', required: true },
                { id: 'impact_related', label: 'Impact on related machine behavior considered', required: true },
                { id: 'test_evidence', label: 'Evidence or test notes attached', required: true },
                { id: 'understandable', label: 'Implementation is understandable for another engineer/technician', required: true },
            ],
        },
        {
            id: 'electrical',
            name: 'Electrical Review',
            discipline: 'electrical',
            items: [
                { id: 'technical_coherent', label: 'Electrical intent is technically coherent', required: true },
                { id: 'naming_consistent', label: 'References/naming are consistent', required: true },
                { id: 'io_coherent', label: 'I/O relation is coherent with control intent', required: true },
                { id: 'protections_risks', label: 'Protections or electrical risks considered', required: true },
                { id: 'impact_documented', label: 'Implementation impact documented', required: true },
                { id: 'docs_updated', label: 'Related documentation updated if needed', required: true },
            ],
        },
        {
            id: 'mechanical',
            name: 'Mechanical Review',
            discipline: 'mechanical',
            items: [
                { id: 'mech_coherent', label: 'Change is mechanically coherent', required: true },
                { id: 'no_interference', label: 'No obvious interference risk', required: true },
                { id: 'accessibility', label: 'Accessibility/adjustment considered', required: true },
                { id: 'fixation_support', label: 'Fixation/support adequate', required: true },
                { id: 'sensor_actuator', label: 'Impact on sensors/actuators/process considered', required: true },
                { id: 'maintainable', label: 'Implementation is understandable and maintainable', required: true },
            ],
        },
    ];

    const now = new Date().toISOString();
    for (const template of templates) {
        const { id, ...data } = template;
        const docRef = doc(colRef, id);
        await setDoc(docRef, {
            ...data,
            active: true,
            taskTypeId: null,
            createdBy: 'system',
            updatedBy: 'system',
            createdAt: now,
            updatedAt: now,
        });
        console.log(`[Seed] Created template: "${template.name}" (${template.items.length} items)`);
    }

    return { seeded: true, count: templates.length };
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
        peerReviewTemplates: await seedPeerReviewTemplates(db),
    };

    console.log('[Seed] Database seeding complete:', results);
    return results;
}
