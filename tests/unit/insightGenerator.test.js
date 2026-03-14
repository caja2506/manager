import { describe, it, expect } from 'vitest';
import { parseGeminiResponse } from '../../src/core/ai/insightGenerator';

describe('Gemini Insight Generator & Parser', () => {
    
    it('should parse direct generic JSON correctly', () => {
        const rawJson = '{"overallAssessment": "Test assessment", "topRisks": []}';
        const parsed = parseGeminiResponse(rawJson);
        expect(parsed).toBeDefined();
        expect(parsed.overallAssessment).toBe("Test assessment");
    });

    it('should parse JSON wrapped in markdown code blocks', () => {
        const responseWithMarkdown = `
Aquí está tu análisis:
\`\`\`json
{
  "weeklyFocus": "Reducir tareas bloqueadas"
}
\`\`\`
Espero que sirva.`;
        const parsed = parseGeminiResponse(responseWithMarkdown);
        expect(parsed).toBeDefined();
        expect(parsed.weeklyFocus).toBe("Reducir tareas bloqueadas");
    });

    it('should parse JSON that is embedded within plain text without markdown', () => {
        const plainTextWithJson = `
Análisis completado:
{
  "quickWins": [{"action": "Test action", "expectedImpact": "High"}]
}
Si necesitas más, avisa.`;
        const parsed = parseGeminiResponse(plainTextWithJson);
        expect(parsed).toBeDefined();
        expect(parsed.quickWins[0].action).toBe("Test action");
    });

    it('should return null for completely invalid responses', () => {
        const invalidResponse = "Lo siento, no puedo generar esto.";
        const parsed = parseGeminiResponse(invalidResponse);
        expect(parsed).toBeNull();
    });

});
