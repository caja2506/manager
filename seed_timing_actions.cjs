const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://mkymgptfmtlqpdswvywo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reW1ncHRmbXRscXBkc3d2eXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE4MjEwMiwiZXhwIjoyMDkzNzU4MTAyfQ.IzegMIzSgWNXALkiHrsFRBJW2wmS6aG7YP5TJ02FYRY'
);

async function run() {
  // 1. Add description column
  const r1 = await s.rpc('exec_sql', {
    query: "ALTER TABLE timing_actions ADD COLUMN IF NOT EXISTS description text DEFAULT '';"
  });
  console.log('ALTER:', r1.status, r1.error?.message || 'OK');

  // 2. Update descriptions
  const descriptions = {
    'EXT': 'Extender',
    'RET': 'Retraer',
    'CW':  'Giro Horario',
    'CCW': 'Giro Anti-Horario',
    'OPN': 'Abrir',
    'CLS': 'Cerrar',
    'UP':  'Subir',
    'DWN': 'Bajar',
    'ADV': 'Avanzar',
    'RTN': 'Retornar',
    'HOR': 'Horizontal',
    'ON':  'Encender',
    'OFF': 'Apagar',
    'READ':'Leer Sensor',
    'WAIT':'Esperar',
    'DELAY':'Retardo',
    'INSPECT':'Inspeccionar',
  };

  // Wait for schema cache
  await new Promise(r => setTimeout(r, 2000));

  for (const [name, desc] of Object.entries(descriptions)) {
    const r = await s.from('timing_actions').update({ description: desc }).eq('name', name);
    console.log(`  ${name} -> ${desc}:`, r.status, r.error?.message || 'OK');
  }

  // 3. Verify
  const { data } = await s.from('timing_actions').select('name, description').order('name');
  console.log('\nResult:', data);
}

run();
