/**
 * Optimization Domain Exports — functions/exports/optimization.js
 * [Phase M.5] Optimization scan, simulations, dashboard.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");

function createOptimizationExports(adminDb) {
    const { runOptimizationScan: doScan, getOptimizationDashboardData, handleSimulation } = require("../handlers/optimizationHandler");

    const runOptimizationScan = onCall(
        { timeoutSeconds: 120 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
            if (!roleDoc.exists || roleDoc.data().role !== "admin") throw new HttpsError("permission-denied", "Admin access required.");
            const { periodType = "daily" } = request.data || {};
            console.log(`[runOptimizationScan] Admin ${request.auth.uid} requested scan`);
            const result = await doScan(adminDb, { periodType });
            return result;
        }
    );

    const simulateChange = onCall(
        { timeoutSeconds: 30 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
            if (!roleDoc.exists || roleDoc.data().role !== "admin") throw new HttpsError("permission-denied", "Admin access required.");
            const { type, params } = request.data || {};
            if (!type) throw new HttpsError("invalid-argument", "Simulation type is required.");
            const result = await handleSimulation(adminDb, { type, params }, request.auth.uid);
            return result;
        }
    );

    const getOptimizationDashboard = onCall(
        { timeoutSeconds: 30 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const data = await getOptimizationDashboardData(adminDb);
            return data;
        }
    );

    return { runOptimizationScan, simulateChange, getOptimizationDashboard };
}

module.exports = { createOptimizationExports };
