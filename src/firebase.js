// Archivo: src/firebase.js
// ========================
// Firebase SDK initialization + session guarantee utility.

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getAuth, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyDGUTnCBWhPpyOrjAf5eQbQaQz0Dm18NXc",
    authDomain: "bom-ame-cr.firebaseapp.com",
    projectId: "bom-ame-cr",
    storageBucket: "bom-ame-cr.firebasestorage.app",
    messagingSenderId: "865326401984",
    appId: "1:865326401984:web:ebad6ca9ee666eaec3a025",
    measurementId: "G-XNN4RBPK2Y"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * ensureSession
 * =============
 * Returns a promise that resolves with the current Firebase user
 * once the auth state is confirmed. Rejects after `timeoutMs` if
 * no authenticated session is found.
 *
 * Use before any Firestore operation that requires auth context
 * to guarantee the user session is ready.
 *
 * @param {number} [timeoutMs=10000] — max wait time in ms
 * @returns {Promise<import('firebase/auth').User>}
 */
export function ensureSession(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        // If already authenticated, resolve immediately
        if (auth.currentUser) {
            resolve(auth.currentUser);
            return;
        }

        let settled = false;

        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                unsubscribe();
                reject(new Error('ensureSession: timeout — no authenticated session detected'));
            }
        }, timeoutMs);

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!settled && user) {
                settled = true;
                clearTimeout(timeout);
                unsubscribe();
                resolve(user);
            }
        });
    });
}
