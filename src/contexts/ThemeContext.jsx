import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { USE_SUPABASE } from '../services/_backend';
import { supabase } from '../supabase';

// Firebase fallback (only loaded when not using Supabase)
let fbGetDoc, fbSetDoc, fbDoc, fbDb;
if (!USE_SUPABASE) {
    const fbFirestore = await import('firebase/firestore');
    fbGetDoc = fbFirestore.getDoc;
    fbSetDoc = fbFirestore.setDoc;
    fbDoc = fbFirestore.doc;
    const fbModule = await import('../firebase');
    fbDb = fbModule.db;
}

const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {}, isDark: true });

const STORAGE_KEY = 'analyzeops-theme';

export function ThemeProvider({ children }) {
    const { user } = useAuth();

    // Initialize from localStorage for instant load (no flash)
    const [theme, setTheme] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'dark';
        } catch {
            return 'dark';
        }
    });

    // Apply data-theme to <html> whenever theme changes
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* noop */ }
    }, [theme]);

    // Sync from database on login (only once)
    useEffect(() => {
        if (!user?.uid) return;
        let cancelled = false;
        (async () => {
            try {
                let saved;
                if (USE_SUPABASE) {
                    const { data } = await supabase.from('users').select('theme').eq('id', user.uid).single();
                    saved = data?.theme;
                } else {
                    const snap = await fbGetDoc(fbDoc(fbDb, 'users', user.uid));
                    if (snap.exists()) saved = snap.data()?.theme;
                }
                if (!cancelled && saved && (saved === 'dark' || saved === 'light')) {
                    setTheme(saved);
                }
            } catch (err) {
                console.warn('ThemeContext: Could not load theme', err);
            }
        })();
        return () => { cancelled = true; };
    }, [user?.uid]);

    const toggleTheme = useCallback(() => {
        setTheme(prev => {
            const next = prev === 'dark' ? 'light' : 'dark';
            // Persist to database in background
            if (user?.uid) {
                if (USE_SUPABASE) {
                    supabase.from('users').update({ theme: next }).eq('id', user.uid).then();
                } else {
                    fbSetDoc(fbDoc(fbDb, 'users', user.uid), { theme: next }, { merge: true }).catch(() => {});
                }
            }
            return next;
        });
    }, [user]);

    const isDark = theme === 'dark';

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}

export default ThemeContext;
