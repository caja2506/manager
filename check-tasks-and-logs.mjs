import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mkymgptfmtlqpdswvywo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reW1ncHRmbXRscXBkc3d2eXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE4MjEwMiwiZXhwIjoyMDkzNzU4MTAyfQ.IzegMIzSgWNXALkiHrsFRBJW2wmS6aG7YP5TJ02FYRY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const taskId = "c50aa7d9-5396-4545-aa12-459804c61a28";
    console.log(`Intentando actualizar prioridad de tarea ${taskId} a "high" directamente en Supabase...`);

    // Intentar actualizar usando la API de Supabase
    const { data, error } = await supabase
        .from("tasks")
        .update({ priority: "high", updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .select();

    if (error) {
        console.error("❌ Error de Supabase al actualizar:", error);
    } else {
        console.log("✅ Respuesta exitosa de Supabase:", data);
    }

    // Volver a consultar para verificar
    const { data: verified, error: verifyErr } = await supabase
        .from("tasks")
        .select("id, title, priority, updated_at")
        .eq("id", taskId)
        .single();

    if (verifyErr) {
        console.error("❌ Error verificando:", verifyErr.message);
    } else {
        console.log(`🔍 Valor verificado en base de datos:`, verified);
    }
}

main().catch(err => console.error("Error general:", err));
