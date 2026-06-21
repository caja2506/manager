import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabase';

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
                const { data } = await supabase.from('users').select('theme').eq('id', user.uid).single();
                saved = data?.theme;
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
                supabase.from('users').update({ theme: next }).eq('id', user.uid).then();
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
