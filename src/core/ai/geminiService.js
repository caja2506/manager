/**
 * Gemini Service
 * ==============
 * 
 * Client-side service for calling Gemini via Firebase Cloud Functions.
 * All AI calls go through Cloud Functions which hold the API key.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { parseGeminiResponse } from './insightGenerator';

// ============================================================
// CLOUD FUNCTION CALLERS
// ============================================================

/**
 * Generate AI insights by calling the generateInsights Cloud Function.
 * 
 * @param {string} prompt - The formatted prompt
 * @param {string} type - Insight type: 'audit_analysis' | 'team_analysis' | 'weekly_brief'
 * @returns {Object|null} Parsed response or null on failure
 */
export async function callGeminiInsights(prompt, type = 'audit_analysis') {
    try {
        const generateInsights = httpsCallable(functions, 'generateInsights');
        const result = await generateInsights({ prompt, type });

        if (result.data?.success && result.data?.response) {
            const parsed = parseGeminiResponse(result.data.response);
            
            if (!parsed) {
                console.warn('Gemini response could not be parsed as valid JSON.');
                return {
                    success: false,
                    error: 'La IA devolvió un formato inválido. Por favor intenta de nuevo.',
                    type,
                };
            }

            return {
                success: true,
                data: parsed,
                raw: result.data.response,
                type,
                generatedAt: new Date().toISOString(),
            };
        }

        return {
            success: false,
            error: result.data?.error || 'No response from Gemini',
            type,
        };
    } catch (error) {
        console.error('Gemini Cloud Function error:', error);
        return {
            success: false,
            error: error.message || 'Cloud Function call failed',
            type,
        };
    }
}

/**
 * Test Gemini connection using existing testGeminiConnection function.
 */
export async function testGeminiConnection() {
    try {
        const testFn = httpsCallable(functions, 'testGeminiConnection');
        const result = await testFn();
        return {
            connected: result.data?.success || false,
            model: result.data?.model || 'unknown',
            response: result.data?.response || null,
        };
    } catch (error) {
        return {
            connected: false,
            error: error.message,
        };
    }
}
