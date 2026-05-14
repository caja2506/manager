/**
 * Quick test: verify NVIDIA NIM API connectivity.
 * Run: node functions/scripts/test-nvidia.js
 */

const { callNvidia, callWithFallback, NVIDIA_MODELS } = require("../ai/nvidiaClient");

const NVIDIA_KEY = process.env.NVIDIA_NIM_API_KEY || process.argv[2];

if (!NVIDIA_KEY) {
    console.error("Usage: node test-nvidia.js <NVIDIA_API_KEY>");
    process.exit(1);
}

async function main() {
    console.log("🧠 Testing NVIDIA NIM API...\n");
    console.log(`   Model: ${NVIDIA_MODELS.LLAMA_70B}`);
    console.log(`   Key: ${NVIDIA_KEY.substring(0, 12)}...${NVIDIA_KEY.substring(NVIDIA_KEY.length - 4)}\n`);

    // Test 1: Basic connectivity
    console.log("─── Test 1: Basic chat completion ───");
    const result1 = await callNvidia(NVIDIA_KEY, {
        model: NVIDIA_MODELS.LLAMA_70B,
        messages: [
            { role: "system", content: "Eres ARIA, un asistente de ingeniería. Responde en español, breve y amable." },
            { role: "user", content: "Hola, ¿quién eres y qué puedes hacer?" }
        ],
        maxTokens: 200,
        temperature: 0.7,
    });

    if (result1.ok) {
        console.log(`✅ Success (${result1.latencyMs}ms)`);
        console.log(`   Model: ${result1.model}`);
        console.log(`   Response: ${result1.text}`);
        if (result1.usage) {
            console.log(`   Tokens: prompt=${result1.usage.prompt_tokens}, completion=${result1.usage.completion_tokens}`);
        }
    } else {
        console.log(`❌ Failed: ${result1.error}`);
    }

    console.log("\n─── Test 2: JSON extraction capability ───");
    const result2 = await callNvidia(NVIDIA_KEY, {
        model: NVIDIA_MODELS.LLAMA_70B,
        messages: [
            { role: "system", content: "Extrae datos estructurados del texto. Responde SOLO con JSON válido." },
            { role: "user", content: "Hoy trabajé 6 horas en la tarea del conveyor, avancé un 75% pero me bloqueó la falta de un sensor." }
        ],
        maxTokens: 300,
        temperature: 0.2,
    });

    if (result2.ok) {
        console.log(`✅ Success (${result2.latencyMs}ms)`);
        console.log(`   Response: ${result2.text}`);
    } else {
        console.log(`❌ Failed: ${result2.error}`);
    }

    console.log("\n─── Test 3: Fallback mechanism (with invalid NVIDIA key) ───");
    const result3 = await callWithFallback(
        { nvidiaKey: "nvapi-INVALID_KEY", geminiKey: null },
        [
            { role: "user", content: "Hello" }
        ]
    );
    console.log(`   Provider: ${result3.provider}`);
    console.log(`   OK: ${result3.ok}`);
    console.log(`   Error (expected): ${result3.error || "none"}`);

    console.log("\n🏁 Tests complete.");
}

main().catch(console.error);
