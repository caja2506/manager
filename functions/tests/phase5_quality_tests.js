/**
 * Phase 5 Quality Tests — Backend Modules
 * ==========================================
 * Tests: module loading, optimization engine, simulation engine,
 * planning assistant, intervention suggester, impact tracker,
 * insight generator.
 */

// ── 1. Module Loading Tests ──
function testModuleLoading() {
    const results = [];
    const modules = [
        { name: "analyticsConstants", path: "../analytics/analyticsConstants" },
        { name: "optimizationEngine", path: "../optimization/optimizationEngine" },
        { name: "simulationEngine", path: "../optimization/simulationEngine" },
        { name: "planningAssistant", path: "../optimization/planningAssistant" },
        { name: "insightGenerator", path: "../optimization/insightGenerator" },
        { name: "interventionSuggester", path: "../optimization/interventionSuggester" },
        { name: "impactTracker", path: "../optimization/impactTracker" },
        { name: "firestorePaths", path: "../automation/firestorePaths" },
    ];

    for (const mod of modules) {
        try {
            const m = require(mod.path);
            results.push({ name: mod.name, status: "PASS", exports: Object.keys(m).length });
        } catch (err) {
            results.push({ name: mod.name, status: "FAIL", error: err.message });
        }
    }
    return results;
}

// ── 2. Constants Integrity Tests ──
function testConstants() {
    const results = [];
    const c = require("../analytics/analyticsConstants");

    // Phase 5 enums must exist
    const phase5Enums = ["OPPORTUNITY_TYPE", "SIMULATION_TYPE", "PLAN_TYPE", "INTERVENTION_URGENCY", "IMPACT_STATUS"];
    for (const enumName of phase5Enums) {
        if (c[enumName] && Object.keys(c[enumName]).length > 0) {
            results.push({ test: `${enumName} exists`, status: "PASS", values: Object.keys(c[enumName]).length });
        } else {
            results.push({ test: `${enumName} exists`, status: "FAIL", error: "Missing or empty" });
        }
    }

    // Firestore paths must include Phase 5 collections
    const paths = require("../automation/firestorePaths");
    const phase5Paths = ["OPTIMIZATION_OPPORTUNITIES", "OPTIMIZATION_SIMULATIONS", "OPERATIONAL_PLANS", "APPLIED_RECOMMENDATIONS", "OPTIMIZATION_HISTORY"];
    for (const p of phase5Paths) {
        if (paths[p]) {
            results.push({ test: `Path ${p}`, status: "PASS", value: paths[p] });
        } else {
            results.push({ test: `Path ${p}`, status: "FAIL", error: "Missing" });
        }
    }

    return results;
}

// ── 3. Optimization Engine Tests ──
function testOptimizationEngine() {
    const results = [];
    const { detectOpportunities } = require("../optimization/optimizationEngine");

    // Test 3.1: Empty data → no crash, returns array
    try {
        const opps = detectOpportunities({ globalKpis: {}, byUser: {}, byRoutine: {}, trends: {}, riskFlags: [] });
        results.push({
            test: "Empty data → no crash",
            status: Array.isArray(opps) ? "PASS" : "FAIL",
            opportunities: opps.length,
        });
    } catch (err) {
        results.push({ test: "Empty data → no crash", status: "FAIL", error: err.message });
    }

    // Test 3.2: Low routine success → opportunity detected
    try {
        const opps = detectOpportunities({
            globalKpis: { responseRate: { value: 0.8 }, escalationRate: { value: 0.1 } },
            byRoutine: {
                "morning_report": {
                    kpis: { routineSuccessRate: { value: 0.4 } },
                    routineName: "Morning Report",
                    totalRuns: 10,
                },
            },
            byUser: {},
            trends: {},
            riskFlags: [],
        });
        const routineOpp = opps.find(o => o.rule === "low_routine_effectiveness");
        results.push({
            test: "Low routine success → opportunity",
            status: routineOpp ? "PASS" : "FAIL",
            found: !!routineOpp,
        });
    } catch (err) {
        results.push({ test: "Low routine success → opportunity", status: "FAIL", error: err.message });
    }

    // Test 3.3: High escalation → opportunity detected
    try {
        const opps = detectOpportunities({
            globalKpis: { escalationRate: { value: 0.45 }, responseRate: { value: 0.6 } },
            byRoutine: {},
            byUser: {},
            trends: {},
            riskFlags: [],
        });
        const escOpp = opps.find(o => o.rule === "excessive_escalations");
        results.push({
            test: "High escalation → opportunity",
            status: escOpp ? "PASS" : "FAIL",
        });
    } catch (err) {
        results.push({ test: "High escalation → opportunity", status: "FAIL", error: err.message });
    }

    // Test 3.4: Overloaded user detection
    try {
        const opps = detectOpportunities({
            globalKpis: {},
            byRoutine: {},
            byUser: {
                "user1": {
                    userName: "Carlos",
                    kpis: {
                        responseRate: { value: 0.2 },
                        onTimeResponseRate: { value: 0.3 },
                        escalationRate: { value: 0.6 },
                        reportCompletionRate: { value: 0.1 },
                    },
                },
            },
            trends: {},
            riskFlags: [],
        });
        const userOpp = opps.find(o => o.rule === "overloaded_user");
        results.push({
            test: "Overloaded user → opportunity",
            status: userOpp ? "PASS" : "FAIL",
        });
    } catch (err) {
        results.push({ test: "Overloaded user → opportunity", status: "FAIL", error: err.message });
    }

    // Test 3.5: Multi-KPI deterioration
    try {
        const opps = detectOpportunities({
            globalKpis: {},
            byRoutine: {},
            byUser: {},
            trends: {
                responseRate: { hasHistory: true, isImproving: false, deltaPercent: -10 },
                onTimeResponseRate: { hasHistory: true, isImproving: false, deltaPercent: -8 },
                escalationRate: { hasHistory: true, isImproving: false, deltaPercent: 12 },
            },
            riskFlags: [],
        });
        const trendOpp = opps.find(o => o.rule === "multi_kpi_deterioration");
        results.push({
            test: "Multi-KPI deterioration → opportunity",
            status: trendOpp ? "PASS" : "FAIL",
        });
    } catch (err) {
        results.push({ test: "Multi-KPI deterioration → opportunity", status: "FAIL", error: err.message });
    }

    // Test 3.6: All opportunities have required fields
    try {
        const opps = detectOpportunities({
            globalKpis: { escalationRate: { value: 0.5 }, responseRate: { value: 0.3 }, onTimeResponseRate: { value: 0.3 }, lateResponseRate: { value: 0.5 }, reportCompletionRate: { value: 0.4 } },
            byRoutine: {},
            byUser: {},
            trends: {},
            riskFlags: [],
        });
        const requiredFields = ["type", "entityType", "entityId", "problemDetected", "suggestedAction", "impactEstimate", "confidence", "explanation", "supportingMetrics", "rule", "id", "generatedAt", "status"];
        let allValid = true;
        for (const opp of opps) {
            for (const field of requiredFields) {
                if (opp[field] === undefined) {
                    results.push({ test: `Opportunity field ${field}`, status: "FAIL", oppRule: opp.rule });
                    allValid = false;
                    break;
                }
            }
        }
        if (allValid) {
            results.push({ test: "All opportunities have required fields", status: "PASS", count: opps.length });
        }
    } catch (err) {
        results.push({ test: "All opportunities have required fields", status: "FAIL", error: err.message });
    }

    return results;
}

// ── 4. Simulation Engine Tests ──
function testSimulationEngine() {
    const results = [];
    const { simulateChange } = require("../optimization/simulationEngine");

    const mockData = {
        globalKpis: {
            responseRate: { value: 0.5 },
            onTimeResponseRate: { value: 0.4 },
            escalationRate: { value: 0.35 },
            lateResponseRate: { value: 0.4 },
            reportCompletionRate: { value: 0.5 },
        },
        byRoutine: {},
    };

    // Test all 5 simulation types
    const simTypes = [
        { type: "schedule_change", params: { newHour: 8, routineKey: "test" } },
        { type: "grace_period_change", params: { currentMinutes: 30, newMinutes: 60 } },
        { type: "frequency_change", params: { currentFrequency: "daily", newFrequency: "weekly" } },
        { type: "add_checkpoint", params: { routineKey: "test", checkpointDescription: "Test" } },
        { type: "format_change", params: { simplify: true } },
    ];

    for (const sim of simTypes) {
        try {
            const result = simulateChange(mockData, sim);
            const hasRequired = result.scenario && result.estimatedImpact && result.confidence !== undefined && result.assumptions;
            results.push({
                test: `Simulation: ${sim.type}`,
                status: hasRequired ? "PASS" : "FAIL",
                scenario: result.scenario,
                confidence: result.confidence,
            });
        } catch (err) {
            results.push({ test: `Simulation: ${sim.type}`, status: "FAIL", error: err.message });
        }
    }

    // Test unknown type → graceful fallback
    try {
        const result = simulateChange(mockData, { type: "unknown_type", params: {} });
        results.push({
            test: "Unknown simulation type → graceful",
            status: result.confidence === 0 ? "PASS" : "FAIL",
        });
    } catch (err) {
        results.push({ test: "Unknown simulation type → graceful", status: "FAIL", error: err.message });
    }

    // Test impact values are within [0, 1]
    try {
        const result = simulateChange(mockData, { type: "schedule_change", params: { newHour: 8 } });
        let allBounded = true;
        for (const [key, impact] of Object.entries(result.estimatedImpact)) {
            if (impact.before !== undefined) {
                if (impact.after < 0 || impact.after > 1 || impact.before < 0 || impact.before > 1) {
                    allBounded = false;
                }
            }
        }
        results.push({
            test: "Impact values bounded [0,1]",
            status: allBounded ? "PASS" : "FAIL",
        });
    } catch (err) {
        results.push({ test: "Impact values bounded [0,1]", status: "FAIL", error: err.message });
    }

    return results;
}

// ── 5. Planning Assistant Tests ──
function testPlanningAssistant() {
    const results = [];
    const { generateDailyPlan, generateWeeklyOutlook } = require("../optimization/planningAssistant");

    const mockData = {
        globalKpis: { responseRate: { value: 0.4 } },
        byRoutine: {
            "test_routine": {
                kpis: { routineSuccessRate: { value: 0.5 }, escalationCount: 5 },
                routineName: "Test Routine",
                totalRuns: 10,
            },
        },
        byUser: {
            "user1": {
                userName: "Test User",
                userRole: "engineer",
                kpis: { responseRate: { value: 0.3 }, onTimeResponseRate: { value: 0.2 } },
            },
        },
        riskFlags: [{ severity: "critical", kpiName: "responseRate", justification: "Very low" }],
        trends: {
            responseRate: { hasHistory: true, isImproving: false, deltaPercent: -15 },
        },
    };

    // Daily plan
    try {
        const plan = generateDailyPlan(mockData, "2026-03-14");
        results.push({
            test: "Daily plan generation",
            status: plan.planType === "daily" && plan.focusAreas.length > 0 ? "PASS" : "FAIL",
            criticalRoutines: plan.criticalRoutines.length,
            riskWatchlist: plan.riskWatchlist.length,
            focusAreas: plan.focusAreas.length,
        });
    } catch (err) {
        results.push({ test: "Daily plan generation", status: "FAIL", error: err.message });
    }

    // Weekly outlook
    try {
        const outlook = generateWeeklyOutlook(mockData);
        results.push({
            test: "Weekly outlook generation",
            status: outlook.planType === "weekly" && outlook.trendPredictions ? "PASS" : "FAIL",
            predictions: outlook.trendPredictions?.length || 0,
        });
    } catch (err) {
        results.push({ test: "Weekly outlook generation", status: "FAIL", error: err.message });
    }

    // Empty data → no crash
    try {
        const plan = generateDailyPlan({ globalKpis: {}, byRoutine: {}, byUser: {}, riskFlags: [] });
        results.push({
            test: "Empty data → stable plan",
            status: plan.focusAreas.includes("✅ Operación estable — mantener monitoreo regular") ? "PASS" : "FAIL",
        });
    } catch (err) {
        results.push({ test: "Empty data → stable plan", status: "FAIL", error: err.message });
    }

    return results;
}

// ── 6. Intervention Suggester Tests ──
function testInterventionSuggester() {
    const results = [];
    const { generateInterventions } = require("../optimization/interventionSuggester");

    // Critical flags → ACT_NOW
    try {
        const interventions = generateInterventions({
            globalKpis: { responseRate: { value: 0.55 } },
            byUser: {},
            trends: {},
            riskFlags: [{ severity: "critical", kpiName: "responseRate", justification: "Below threshold", currentValue: 0.3 }],
        });
        const actNow = interventions.filter(i => i.urgency === "act_now");
        results.push({
            test: "Critical flag → ACT_NOW",
            status: actNow.length > 0 ? "PASS" : "FAIL",
            count: actNow.length,
        });
    } catch (err) {
        results.push({ test: "Critical flag → ACT_NOW", status: "FAIL", error: err.message });
    }

    // User in distress
    try {
        const interventions = generateInterventions({
            globalKpis: {},
            byUser: {
                "u1": { userName: "Ana", kpis: { responseRate: { value: 0.1 } } },
            },
            trends: {},
            riskFlags: [],
        });
        const userIntervention = interventions.find(i => i.target?.type === "user");
        results.push({
            test: "User distress → intervention",
            status: userIntervention ? "PASS" : "FAIL",
        });
    } catch (err) {
        results.push({ test: "User distress → intervention", status: "FAIL", error: err.message });
    }

    // All interventions have required fields
    try {
        const interventions = generateInterventions({
            globalKpis: { responseRate: { value: 0.55 }, escalationRate: { value: 0.25 } },
            byUser: {},
            trends: { responseRate: { hasHistory: true, isImproving: false, deltaPercent: -20 } },
            riskFlags: [{ severity: "critical", kpiName: "test", justification: "test", currentValue: 0.1 }],
        });
        const requiredFields = ["urgency", "target", "action", "reason", "id", "generatedAt"];
        let allValid = true;
        for (const i of interventions) {
            for (const f of requiredFields) {
                if (i[f] === undefined) { allValid = false; break; }
            }
        }
        results.push({
            test: "Interventions have required fields",
            status: allValid ? "PASS" : "FAIL",
            count: interventions.length,
        });
    } catch (err) {
        results.push({ test: "Interventions have required fields", status: "FAIL", error: err.message });
    }

    return results;
}

// ── 7. Impact Tracker Tests ──
function testImpactTracker() {
    const results = [];
    const { evaluateSuccess } = require("../optimization/impactTracker");

    // Improvement scenario
    try {
        const result = evaluateSuccess(
            { responseRate: 0.5, escalationRate: 0.4 },
            { responseRate: 0.7, escalationRate: 0.2 }
        );
        results.push({
            test: "Improvement detection",
            status: result.status === "improved" ? "PASS" : "FAIL",
            improvements: result.improvements.length,
        });
    } catch (err) {
        results.push({ test: "Improvement detection", status: "FAIL", error: err.message });
    }

    // Worsened scenario
    try {
        const result = evaluateSuccess(
            { responseRate: 0.8, onTimeResponseRate: 0.7 },
            { responseRate: 0.5, onTimeResponseRate: 0.4 }
        );
        results.push({
            test: "Worsened detection",
            status: result.status === "worsened" ? "PASS" : "FAIL",
            regressions: result.regressions.length,
        });
    } catch (err) {
        results.push({ test: "Worsened detection", status: "FAIL", error: err.message });
    }

    // No change scenario
    try {
        const result = evaluateSuccess(
            { responseRate: 0.7 },
            { responseRate: 0.71 }
        );
        results.push({
            test: "No change detection (within ±2%)",
            status: result.status === "no_change" ? "PASS" : "FAIL",
        });
    } catch (err) {
        results.push({ test: "No change detection", status: "FAIL", error: err.message });
    }

    return results;
}

// ── 8. Insight Generator Tests ──
function testInsightGenerator() {
    const results = [];
    const { explainTrend, summarizeOptimizations, generateBriefing } = require("../optimization/insightGenerator");

    // Trend explanation
    try {
        const explanation = explainTrend("responseRate", { hasHistory: true, direction: "down", deltaPercent: -10, isImproving: false });
        results.push({
            test: "Trend explanation",
            status: explanation.includes("Tasa de Respuesta") && explanation.includes("10%") ? "PASS" : "FAIL",
        });
    } catch (err) {
        results.push({ test: "Trend explanation", status: "FAIL", error: err.message });
    }

    // Summary with opportunities
    try {
        const summary = summarizeOptimizations([
            { type: "schedule", problemDetected: "Test", suggestedAction: "Fix" },
            { type: "process", problemDetected: "Test2", suggestedAction: "Fix2" },
        ]);
        results.push({
            test: "Optimization summary",
            status: summary.includes("2 oportunidades") ? "PASS" : "FAIL",
        });
    } catch (err) {
        results.push({ test: "Optimization summary", status: "FAIL", error: err.message });
    }

    // Empty summary
    try {
        const summary = summarizeOptimizations([]);
        results.push({
            test: "Empty summary → stable message",
            status: summary.includes("No se detectaron") ? "PASS" : "FAIL",
        });
    } catch (err) {
        results.push({ test: "Empty summary → stable message", status: "FAIL", error: err.message });
    }

    // Briefing generation
    try {
        const briefing = generateBriefing({
            date: "2026-03-14",
            focusAreas: ["Test focus"],
            criticalRoutines: [{ routineName: "Test", reason: "Low", successRate: 0.5 }],
            riskWatchlist: [{ severity: "critical", kpi: "test", justification: "bad" }],
            userLoads: [],
        }, "manager");
        results.push({
            test: "Manager briefing",
            status: briefing.includes("Briefing Operativo") && briefing.includes("Riesgos Activos") ? "PASS" : "FAIL",
        });
    } catch (err) {
        results.push({ test: "Manager briefing", status: "FAIL", error: err.message });
    }

    return results;
}

// ═══════════════════════════════════════
// RUN ALL TESTS
// ═══════════════════════════════════════

console.log("\n" + "═".repeat(60));
console.log("  PHASE 5 QUALITY TESTS — Optimization Engine");
console.log("═".repeat(60) + "\n");

const allResults = [];

const suites = [
    { name: "Module Loading", fn: testModuleLoading },
    { name: "Constants Integrity", fn: testConstants },
    { name: "Optimization Engine", fn: testOptimizationEngine },
    { name: "Simulation Engine", fn: testSimulationEngine },
    { name: "Planning Assistant", fn: testPlanningAssistant },
    { name: "Intervention Suggester", fn: testInterventionSuggester },
    { name: "Impact Tracker", fn: testImpactTracker },
    { name: "Insight Generator", fn: testInsightGenerator },
];

for (const suite of suites) {
    console.log(`\n── ${suite.name} ${"─".repeat(40 - suite.name.length)}`);
    try {
        const results = suite.fn();
        for (const r of results) {
            const icon = r.status === "PASS" ? "✅" : "❌";
            console.log(`  ${icon} ${r.test}`);
            if (r.status === "FAIL" && r.error) {
                console.log(`     → Error: ${r.error}`);
            }
            allResults.push(r);
        }
    } catch (err) {
        console.log(`  ❌ SUITE CRASHED: ${err.message}`);
        allResults.push({ test: `${suite.name} (CRASH)`, status: "FAIL", error: err.message });
    }
}

// Summary
const passed = allResults.filter(r => r.status === "PASS").length;
const failed = allResults.filter(r => r.status === "FAIL").length;
const total = allResults.length;

console.log("\n" + "═".repeat(60));
console.log(`  RESULTS: ${passed}/${total} passed, ${failed} failed`);
console.log("═".repeat(60));

if (failed > 0) {
    console.log("\n❌ FAILURES:");
    for (const r of allResults.filter(r => r.status === "FAIL")) {
        console.log(`  - ${r.test}: ${r.error || "assertion failed"}`);
    }
}

process.exit(failed > 0 ? 1 : 0);
