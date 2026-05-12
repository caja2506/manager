// Archivo: src/supabase.js
// ========================
// Supabase client initialization + Firebase Auth bridge.
//
// ARQUITECTURA DE MIGRACIÓN:
// - La autenticación SIGUE siendo Firebase Auth (Google Sign-In).
// - Supabase solo maneja la base de datos (PostgreSQL) y storage.
// - El token JWT de Firebase se pasa a Supabase automáticamente
//   via el callback `accessToken` para que RLS funcione.
//
// Flujo:
//   1. Usuario hace login con Google → Firebase emite idToken
//   2. accessToken callback retorna el idToken en cada request
//   3. Supabase Third-Party Auth valida el JWT de Firebase
//   4. auth.uid() en RLS retorna el Firebase UID
//   5. custom_access_token_hook asigna role=authenticated + rbac_role
//
// CONFIGURACIÓN EN SUPABASE DASHBOARD:
//   - Auth → Third-Party Auth: Firebase Project ID = bom-ame-cr ✅
//   - Auth Hooks → Custom Access Token: custom_access_token_hook ✅

import { createClient } from '@supabase/supabase-js';
import { auth as firebaseAuth } from './firebase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[supabase.js] ⚠️ Variables de entorno de Supabase no configuradas.');
}

/**
 * Cliente Supabase con Firebase Third-Party Auth.
 * 
 * El callback `accessToken` es invocado automáticamente por el
 * cliente Supabase en cada request (REST + Realtime), retornando
 * el Firebase ID Token actual. Esto permite que:
 *   - auth.uid() retorne el Firebase UID en RLS policies
 *   - El Custom Access Token Hook asigne role=authenticated
 *   - Las policies de RLS funcionen correctamente
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    // accessToken en el NIVEL RAÍZ (no dentro de auth)
    // Esto es lo que activa Third-Party Auth de Firebase
    accessToken: async () => {
        try {
            const user = firebaseAuth.currentUser;
            if (!user) return null;
            const token = await user.getIdToken(/* forceRefresh */ false);
            return token;
        } catch (err) {
            console.warn('[supabase.js] Error obteniendo Firebase token:', err.message);
            return null;
        }
    },
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
    global: {
        headers: {
            'X-Client-Info': 'autobom-pro',
        },
    },
});

/**
 * syncFirebaseTokenToSupabase
 * ============================
 * Se llama desde AuthContext cuando Firebase Auth cambia de estado.
 * Con el patrón `accessToken`, esta función es más liviana:
 * solo necesita notificar al canal realtime del nuevo token.
 *
 * @param {import('firebase/auth').User} firebaseUser
 * @returns {Promise<void>}
 */
export async function syncFirebaseTokenToSupabase(firebaseUser) {
    if (!firebaseUser) {
        supabase.realtime.setAuth(null);
        console.debug('[supabase.js] 🔌 Token Supabase limpiado (logout)');
        return;
    }

    try {
        const idToken = await firebaseUser.getIdToken(false);
        // Realtime necesita el token explícitamente
        supabase.realtime.setAuth(idToken);
        console.debug('[supabase.js] ✅ Token Firebase sincronizado con Supabase');
    } catch (error) {
        console.error('[supabase.js] ❌ Error sincronizando token:', error);
    }
}

export default supabase;
