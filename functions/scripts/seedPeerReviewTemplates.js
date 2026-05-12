/**
 * Seed Peer Review Templates — one-time script
 * Uses Application Default Credentials (gcloud auth).
 * Run: node functions/scripts/seedPeerReviewTemplates.js
 */
const admin = require("firebase-admin");

admin.initializeApp({ projectId: "bom-ame-cr" });
const db = admin.firestore();

const now = new Date().toISOString();

const templates = [
    {
        id: "programming",
        name: "Programming Review",
        discipline: "programming",
        items: [
            { id: "p1", label: "La lógica cumple con el objetivo de la tarea", required: true },
            { id: "p2", label: "Secuencias e interlocks revisados", required: true },
            { id: "p3", label: "Alarmas y casos anormales considerados", required: true },
            { id: "p4", label: "Comportamiento de reset/recovery considerado", required: true },
            { id: "p5", label: "Impacto en comportamiento relacionado de la máquina considerado", required: true },
            { id: "p6", label: "Evidencia o notas de prueba adjuntas", required: false },
            { id: "p7", label: "Implementación comprensible para otro ingeniero/técnico", required: true },
        ],
        active: true,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: "electrical",
        name: "Electrical Review",
        discipline: "electrical",
        items: [
            { id: "e1", label: "El diseño eléctrico es técnicamente coherente", required: true },
            { id: "e2", label: "Referencias y nomenclatura consistentes", required: true },
            { id: "e3", label: "Relación I/O coherente con la intención de control", required: true },
            { id: "e4", label: "Protecciones y riesgos eléctricos considerados", required: true },
            { id: "e5", label: "Impacto de implementación documentado", required: false },
            { id: "e6", label: "Documentación relacionada actualizada", required: false },
        ],
        active: true,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: "mechanical",
        name: "Mechanical Review",
        discipline: "mechanical",
        items: [
            { id: "m1", label: "Cambio es mecánicamente coherente", required: true },
            { id: "m2", label: "Sin riesgo obvio de interferencia", required: true },
            { id: "m3", label: "Accesibilidad y ajuste considerados", required: true },
            { id: "m4", label: "Fijación y soporte adecuados", required: true },
            { id: "m5", label: "Impacto en sensores/actuadores/proceso considerado", required: true },
            { id: "m6", label: "Documentación/planos actualizados", required: false },
        ],
        active: true,
        createdAt: now,
        updatedAt: now,
    },
];

(async () => {
    try {
        for (const t of templates) {
            await db.collection("peerReviewTemplates").doc(t.id).set(t);
            console.log("Seeded:", t.id);
        }
        console.log("ALL TEMPLATES SEEDED SUCCESSFULLY");
    } catch (err) {
        console.error("SEED ERROR:", err.message);
    }
    process.exit(0);
})();
