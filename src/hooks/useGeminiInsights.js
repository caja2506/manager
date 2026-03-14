/**
 * useGeminiInsights Hook
 * ======================
 * 
 * React hook for generating AI insights via Gemini Cloud Functions.
 */

import { useState, useCallback } from 'react';
import { callGeminiInsights, testGeminiConnection } from '../core/ai/geminiService';
import {
    buildAuditAnalysisPrompt,
    buildTeamAnalysisPrompt,
    buildWeeklyBriefPrompt,
} from '../core/ai/insightGenerator';

export function useGeminiInsights() {
    const [insights, setInsights] = useState(null);
    const [teamAnalysis, setTeamAnalysis] = useState(null);
    const [weeklyBrief, setWeeklyBrief] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState(null);

    /**
     * Generate audit analysis insights.
     */
    const generateAuditInsights = useCallback(async (auditResult, snapshot = null) => {
        setIsGenerating(true);
        setError(null);

        try {
            const prompt = buildAuditAnalysisPrompt(auditResult, snapshot);
            const result = await callGeminiInsights(prompt, 'audit_analysis');

            if (result.success) {
                setInsights(result);
                return result;
            } else {
                setError(result.error);
                return null;
            }
        } catch (err) {
            setError(err.message);
            return null;
        } finally {
            setIsGenerating(false);
        }
    }, []);

    /**
     * Generate team performance analysis.
     */
    const generateTeamAnalysis = useCallback(async (teamUtilization) => {
        setIsGenerating(true);
        setError(null);

        try {
            const prompt = buildTeamAnalysisPrompt(teamUtilization);
            if (!prompt) {
                setError('No team data available');
                return null;
            }

            const result = await callGeminiInsights(prompt, 'team_analysis');
            if (result.success) {
                setTeamAnalysis(result);
                return result;
            } else {
                setError(result.error);
                return null;
            }
        } catch (err) {
            setError(err.message);
            return null;
        } finally {
            setIsGenerating(false);
        }
    }, []);

    /**
     * Generate weekly management brief.
     */
    const generateWeeklyBrief = useCallback(async (snapshot, auditResult, previousSnapshot = null) => {
        setIsGenerating(true);
        setError(null);

        try {
            const prompt = buildWeeklyBriefPrompt(snapshot, auditResult, previousSnapshot);
            const result = await callGeminiInsights(prompt, 'weekly_brief');

            if (result.success) {
                setWeeklyBrief(result);
                return result;
            } else {
                setError(result.error);
                return null;
            }
        } catch (err) {
            setError(err.message);
            return null;
        } finally {
            setIsGenerating(false);
        }
    }, []);

    /**
     * Test Gemini connection.
     */
    const checkConnection = useCallback(async () => {
        const status = await testGeminiConnection();
        setConnectionStatus(status);
        return status;
    }, []);

    return {
        // Actions
        generateAuditInsights,
        generateTeamAnalysis,
        generateWeeklyBrief,
        checkConnection,

        // State
        insights,
        teamAnalysis,
        weeklyBrief,
        isGenerating,
        error,
        connectionStatus,
    };
}
