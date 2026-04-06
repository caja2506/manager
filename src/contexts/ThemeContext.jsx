import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

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

    // Sync from Firestore on login (only once)
    useEffect(() => {
        if (!user?.uid) return;
        let cancelled = false;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'users', user.uid));
                if (!cancelled && snap.exists()) {
                    const saved = snap.data()?.theme;
                    if (saved && (saved === 'dark' || saved === 'light')) {
                        setTheme(saved);
                    }
                }
            } catch (err) {
                console.warn('ThemeContext: Could not load theme from Firestore', err);
            }
        })();
        return () => { cancelled = true; };
    }, [user?.uid]);

    const toggleTheme = useCallback(() => {
        setTheme(prev => {
            const next = prev === 'dark' ? 'light' : 'dark';
            // Persist to Firestore in background
            if (user?.uid) {
                setDoc(doc(db, 'users', user.uid), { theme: next }, { merge: true }).catch(() => {});
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
