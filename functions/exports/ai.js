/**
 * AI Domain Exports — functions/exports/ai.js
 * [Phase M.5] AI-related Cloud Functions: Gemini connection, PDF analysis,
 * image search, insights generation, extraction, briefing, report reprocessing.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { requireAdmin } = require("../middleware/authGuard");

const MODEL_NAME = "gemini-2.5-flash";

function createAiExports(adminDb, secrets) {
    const { geminiApiKey, googleCseKey, googleCx } = secrets;

    const testGeminiConnection = onCall(
        { secrets: [geminiApiKey] },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
            await requireAdmin(adminDb, request);
            const apiKey = geminiApiKey.value();
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: 'Responde únicamente con la palabra: CONECTADO' }] }],
                    }),
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new HttpsError("internal", data.error?.message || `HTTP error ${response.status}`);
                }
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                return { status: "ok", response: text };
            } catch (err) {
                if (err instanceof HttpsError) throw err;
                throw new HttpsError("internal", err.message);
            }
        }
    );

    const analyzeQuotePdf = onCall(
        { secrets: [geminiApiKey], timeoutSeconds: 120 },
        async (request) => {
            const { text } = request.data;
            if (!text || typeof text !== "string" || !text.trim()) {
                throw new HttpsError("invalid-argument", "Se requiere el texto extraído del PDF.");
            }
            const apiKey = geminiApiKey.value();
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
            const prompt = `Analiza el texto de una cotización. Extrae los datos y devuelve EXCLUSIVAMENTE un JSON estricto con la siguiente estructura: { "supplier": "Nombre Proveedor", "items": [ { "pn": "Número de parte", "description": "Descripción", "quantity": numero, "unitPrice": numero, "leadTimeWeeks": numero } ] }.
Reglas:
1. Ignora texto irrelevante, encabezados o textos legales.
2. Los pn (Part Number) deben estar en MAYÚSCULAS y resolverse sin espacios.
3. description debe ser concisa, técnica y resumida.
4. quantity y unitPrice deben ser numéricos (usa 0 si falta el dato).
5. Si no hay proveedor, usa "".
6. leadTimeWeeks es el tiempo de entrega en SEMANAS. Si dice días, convierte dividiendo entre 7 y redondeando hacia arriba (mínimo 1). Si no se menciona, usa null.
7. Busca frases como "lead time", "tiempo de entrega", "delivery", "plazo", "semanas", "weeks", "días", "days".
Devuelve SOLO el JSON sin delimitadores markdown.

Texto:

${text}`;
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { response_mime_type: "application/json" },
                    }),
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new HttpsError("internal", `Error de IA: ${result.error?.message || "Fallo desconocido"}`);
                }
                const rawJson = result.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!rawJson) {
                    throw new HttpsError("internal", "La IA no devolvió ningún texto.");
                }
                const parsed = JSON.parse(rawJson.replace(/```json/g, "").replace(/```/g, "").trim());
                return { data: parsed };
            } catch (err) {
                if (err instanceof HttpsError) throw err;
                if (err instanceof SyntaxError) {
                    throw new HttpsError("internal", "La IA devolvió JSON inválido. Intenta de nuevo.");
                }
                throw new HttpsError("internal", err.message);
            }
        }
    );

    // Helper for scraping DuckDuckGo Image Search as a fallback
    const searchDuckDuckGoImages = async (query) => {
        try {
            console.log("Attempting DuckDuckGo fallback image search for:", query);
            const response = await fetch('https://duckduckgo.com/', {
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                body: new URLSearchParams({ q: query })
            });
            const html = await response.text();
            const vqdMatch = html.match(/vqd=['"]?([^'"]+)['"]?/) || html.match(/vqd\s*=\s*['"]?([^'"]+)['"]?/);
            if (!vqdMatch) {
                throw new Error("Could not find DDG VQD token");
            }
            const vqd = vqdMatch[1];

            const params = new URLSearchParams({
                q: query,
                vqd: vqd,
                o: 'json',
                l: 'wt-wt'
            });

            const imageResponse = await fetch(`https://duckduckgo.com/i.js?${params.toString()}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://duckduckgo.com/'
                }
            });
            const data = await imageResponse.json();
            const images = (data.results || []).slice(0, 8).map((item) => ({
                url: item.image,
                thumbnail: item.thumbnail || item.image,
                title: item.title,
                source: item.url ? (item.url.match(/https?:\/\/([^\/]+)/)?.[1] || "duckduckgo") : "duckduckgo",
                pageUrl: item.url || item.image,
            }));
            console.log(`DuckDuckGo fallback succeeded. Found ${images.length} images.`);
            return images;
        } catch (ddgErr) {
            console.error("DuckDuckGo fallback failed:", ddgErr);
            throw ddgErr;
        }
    };

    const searchImages = onCall(
        { secrets: [googleCseKey, googleCx] },
        async (request) => {
            const { query } = request.data;
            if (!query || typeof query !== "string" || !query.trim()) {
                throw new HttpsError("invalid-argument", "Se requiere un término de búsqueda.");
            }
            
            // Try Google Custom Search first
            try {
                const key = googleCseKey.value();
                const cx = googleCx.value();
                const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query + " product")}&searchType=image&num=8&imgSize=medium&safe=active`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.error) {
                    console.warn("Google Custom Search API error, falling back to DuckDuckGo:", JSON.stringify(data.error));
                    // Trigger fallback to DDG
                    const images = await searchDuckDuckGoImages(query);
                    return { images };
                }
                
                const images = (data.items || []).map((item) => ({
                    url: item.link,
                    thumbnail: item.image?.thumbnailLink || item.link,
                    title: item.title,
                    source: item.displayLink,
                    pageUrl: item.image?.contextLink || item.link,
                }));
                return { images };
            } catch (err) {
                console.warn("Google search failed, attempting DuckDuckGo fallback:", err);
                try {
                    const images = await searchDuckDuckGoImages(query);
                    return { images };
                } catch (ddgErr) {
                    if (err instanceof HttpsError) throw err;
                    throw new HttpsError("internal", `Búsqueda fallida en Google y DuckDuckGo: ${err.message || err}`);
                }
            }
        }
    );

    const generateInsights = onCall(
        { secrets: [geminiApiKey], timeoutSeconds: 60 },
        async (request) => {
            if (!request.auth) {
                throw new HttpsError("unauthenticated", "User must be authenticated.");
            }
            const { prompt, type } = request.data;
            if (!prompt || typeof prompt !== "string") {
                throw new HttpsError("invalid-argument", "A valid prompt string is required.");
            }
            const apiKey = geminiApiKey.value();
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.4, maxOutputTokens: 4096, topP: 0.8, responseMimeType: "application/json" },
                    }),
                });
                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new HttpsError("internal", `Gemini API error: ${response.status} - ${errorBody}`);
                }
                const result = await response.json();
                const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) {
                    throw new HttpsError("internal", "No text response from Gemini.");
                }
                console.log(`[generateInsights] Successfully generated insights of type: ${type}`);
                console.log(`[generateInsights] RAW Output snippet: ${text.substring(0, 150)}...`);
                return { success: true, response: text, type: type || "general", model: MODEL_NAME, generatedAt: new Date().toISOString() };
            } catch (err) {
                if (err instanceof HttpsError) throw err;
                throw new HttpsError("internal", `Gemini insight generation failed: ${err.message}`);
            }
        }
    );

    const testAIExtraction = onCall(
        { secrets: [geminiApiKey], timeoutSeconds: 30 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            await requireAdmin(adminDb, request);
            const { text } = request.data;
            if (!text) throw new HttpsError("invalid-argument", "text is required.");
            const { extractFromText } = require("../ai/aiExtractionService");
            const result = await extractFromText(adminDb, geminiApiKey.value(), text);
            return result;
        }
    );

    const testAIBriefing = onCall(
        { secrets: [geminiApiKey], timeoutSeconds: 30 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            await requireAdmin(adminDb, request);
            const { role, userName } = request.data;
            if (!role) throw new HttpsError("invalid-argument", "role is required.");
            const { generateBriefing } = require("../ai/aiBriefingService");
            const result = await generateBriefing(adminDb, geminiApiKey.value(), role, { userId: request.auth.uid, userName: userName || "Test User" });
            return result;
        }
    );

    const reprocesarReporteConIA = onCall(
        { secrets: [geminiApiKey], timeoutSeconds: 30 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            await requireAdmin(adminDb, request);
            const { reportId } = request.data;
            if (!reportId) throw new HttpsError("invalid-argument", "reportId is required.");
            const reportDoc = await adminDb.collection("telegramReports").doc(reportId).get();
            if (!reportDoc.exists) throw new HttpsError("not-found", "Report not found.");
            const report = reportDoc.data();
            const rawText = report.rawText;
            if (!rawText) throw new HttpsError("failed-precondition", "Report has no rawText.");
            const { extractFromText } = require("../ai/aiExtractionService");
            const result = await extractFromText(adminDb, geminiApiKey.value(), rawText, { userId: report.userId });
            await adminDb.collection("telegramReports").doc(reportId).update({
                aiReprocessed: true, aiReprocessedAt: new Date().toISOString(),
                aiParsedData: result.extracted, aiConfidence: result.extracted.confidenceScore, aiSource: result.source,
            });
            return { reportId, ...result };
        }
    );

    // ── Analyze Station Image (Vision) ──
    const analyzeStationImage = onCall(
        { secrets: [geminiApiKey], timeoutSeconds: 60 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const { imageBase64, mimeType } = request.data;
            if (!imageBase64) throw new HttpsError("invalid-argument", "imageBase64 is required.");

            const apiKey = geminiApiKey.value();
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

            const prompt = `Analiza esta imagen que contiene una tabla de estaciones de una línea de producción o ensamble.
Extrae cada estación y devuelve EXCLUSIVAMENTE un JSON con la siguiente estructura:
{
  "stations": [
    {
      "stn": "01",
      "description": "Descripción de la estación",
      "abbreviation": "Abreviatura corta"
    }
  ]
}

Reglas:
1. El campo "stn" debe ser el número de la estación con ceros a la izquierda (2 dígitos). Ejemplo: "01", "02", "09", "10".
2. "description" es la descripción completa tal como aparece en la tabla.
3. "abbreviation" es una abreviatura técnica derivada del nombre (ej: "Bag Spike Load" → "BSP LD", "Flow Test" → "FLW TST", "Vision Check" → "VIS CHK"). Si la tabla ya tiene abreviatura, úsala.
4. Ignora estaciones marcadas como "SPARE", "EMPTY", "VACANT" o vacías — NO las incluyas.
5. Si hay estaciones duplicadas (mismo número), inclúyelas todas (pueden ser sub-estaciones).
6. Si la tabla tiene una columna "INDX" o "Indexer", agrega el campo "indx" (número) a cada estación.
7. Devuelve SOLO el JSON sin delimitadores markdown ni texto adicional.`;

            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: mimeType || "image/png",
                                        data: imageBase64,
                                    },
                                },
                                { text: prompt },
                            ],
                        }],
                        generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
                    }),
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new HttpsError("internal", `Error de IA: ${result.error?.message || "Fallo desconocido"}`);
                }

                const rawJson = result.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!rawJson) throw new HttpsError("internal", "La IA no devolvió respuesta.");

                const parsed = JSON.parse(rawJson.replace(/```json/g, "").replace(/```/g, "").trim());
                return { data: parsed };
            } catch (err) {
                if (err instanceof HttpsError) throw err;
                if (err instanceof SyntaxError) {
                    throw new HttpsError("internal", "La IA devolvió JSON inválido. Intenta con otra imagen.");
                }
                throw new HttpsError("internal", err.message);
            }
        }
    );
    // ── Improve Task Descriptions with AI ──
    const improveTaskDescriptions = onCall(
        { secrets: [geminiApiKey], timeoutSeconds: 120 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const { tasks } = request.data;
            if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
                throw new HttpsError("invalid-argument", "Se requiere un array de tareas.");
            }
            if (tasks.length > 20) {
                throw new HttpsError("invalid-argument", "Máximo 20 tareas por lote.");
            }

            const apiKey = geminiApiKey.value();
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

            const taskList = tasks.map((t, i) => {
                let entry = `${i + 1}. Título: "${t.title || ""}"`;
                if (t.description) entry += `\n   Descripción: "${t.description}"`;
                if (t.area) entry += `\n   Área: ${t.area}`;
                if (t.taskType) entry += `\n   Tipo de tarea: ${t.taskType}`;
                if (t.project) entry += `\n   Proyecto: ${t.project}`;
                return entry;
            }).join("\n");

            const prompt = `Eres un ingeniero de proyectos senior en una planta de manufactura de dispositivos médicos en Costa Rica. Tu trabajo es mejorar los títulos y descripciones de tareas de ingeniería para que sean más claras y profesionales.

Tareas a mejorar:
${taskList}

Reglas:
1. El título mejorado debe ser conciso (máx 80 caracteres), en formato de acción (ej: "Realizar prueba de...", "Configurar setup de...", "Revisar backspike del...")
2. Si el título ya es claro, mantenlo igual o haz ajustes mínimos
3. La descripción mejorada debe ser clara y con contexto técnico (máx 200 caracteres). Si no hay descripción original, genera una breve basada en el título
4. USA EL CONTEXTO del área, tipo de tarea y proyecto para generar descripciones más relevantes y específicas al dominio. Por ejemplo: si el área es "Ensamblaje" y el tipo es "Mantenimiento Preventivo", la descripción debe reflejar ese contexto
5. IMPORTANTE: El equipo usa spanglish (mezcla de español e inglés), esto es NORMAL. Respeta los términos técnicos en inglés tal cual (ej: backspike, fixture, jig, setup, tape, liner, station, feeder, tooling, BOM, PLC, HMI, OEE, etc). NO traduzcas estos términos al español
6. No cambies el significado técnico
7. Corrige errores ortográficos y mejora la claridad, pero respeta el estilo spanglish natural del equipo
8. El resultado puede mezclar español e inglés naturalmente, como lo haría un ingeniero tico

Responde EXCLUSIVAMENTE con un JSON array:
[
  {
    "index": 1,
    "improvedTitle": "Título mejorado",
    "improvedDescription": "Descripción mejorada"
  }
]

Devuelve SOLO el JSON sin delimitadores markdown.`;

            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { response_mime_type: "application/json", temperature: 0.3 },
                    }),
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new HttpsError("internal", `Error de IA: ${result.error?.message || "Fallo desconocido"}`);
                }

                const rawJson = result.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!rawJson) throw new HttpsError("internal", "La IA no devolvió respuesta.");

                const parsed = JSON.parse(rawJson.replace(/```json/g, "").replace(/```/g, "").trim());

                // Map back to task IDs
                const suggestions = tasks.map((task, i) => {
                    const suggestion = parsed.find(s => s.index === i + 1) || {};
                    return {
                        id: task.id,
                        originalTitle: task.title || "",
                        originalDescription: task.description || "",
                        improvedTitle: suggestion.improvedTitle || task.title || "",
                        improvedDescription: suggestion.improvedDescription || task.description || "",
                    };
                });

                return { suggestions };
            } catch (err) {
                if (err instanceof HttpsError) throw err;
                if (err instanceof SyntaxError) {
                    throw new HttpsError("internal", "La IA devolvió JSON inválido. Intenta de nuevo.");
                }
                throw new HttpsError("internal", err.message);
            }
        }
    );

    return { testGeminiConnection, analyzeQuotePdf, searchImages, generateInsights, testAIExtraction, testAIBriefing, reprocesarReporteConIA, analyzeStationImage, improveTaskDescriptions };
}

module.exports = { createAiExports };
