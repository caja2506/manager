const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://mkymgptfmtlqpdswvywo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reW1ncHRmbXRscXBkc3d2eXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE4MjEwMiwiZXhwIjoyMDkzNzU4MTAyfQ.IzegMIzSgWNXALkiHrsFRBJW2wmS6aG7YP5TJ02FYRY'
);

async function run() {
  // 1. Create table
  const r1 = await s.rpc('exec_sql', {
    query: `CREATE TABLE IF NOT EXISTS motion_profiles (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL UNIQUE,
      value numeric NOT NULL DEFAULT 0,
      unit text NOT NULL DEFAULT 'mm/s',
      created_at timestamptz DEFAULT now()
    );`
  });
  console.log('CREATE:', r1.status, r1.error?.message || 'OK');

  // Wait for schema
  await new Promise(r => setTimeout(r, 2000));

  // 2. Seed profiles
  const profiles = [
    { name: 'Cilindro Neumático Estándar', value: 300, unit: 'mm/s' },
    { name: 'Cilindro Guiado', value: 200, unit: 'mm/s' },
    { name: 'Cilindro Sin Vástago', value: 350, unit: 'mm/s' },
    { name: 'Cilindro Carrera Corta', value: 450, unit: 'mm/s' },
    { name: 'Cilindro Eléctrico Estándar', value: 400, unit: 'mm/s' },
    { name: 'Cilindro Eléctrico Rápido', value: 800, unit: 'mm/s' },
    { name: 'Cilindro Hidráulico Estándar', value: 100, unit: 'mm/s' },
    { name: 'Pinza Chica', value: 150, unit: 'ms' },
    { name: 'Pinza Grande', value: 200, unit: 'ms' },
    { name: 'Ventosa de Vacío', value: 400, unit: 'ms' },
    { name: 'Rotativo Chico', value: 600, unit: 'deg/s' },
    { name: 'Rotativo Grande', value: 2400, unit: 'deg/s' },
    { name: 'Rotativo Eléctrico', value: 3600, unit: 'deg/s' },
    { name: 'Servo Banda', value: 500, unit: 'mm/s' },
    { name: 'Servo Husillo', value: 500, unit: 'mm/s' },
    { name: 'Servo Banda de Tiempo', value: 1000, unit: 'mm/s' },
    { name: 'Motor DC', value: 200, unit: 'mm/s' },
    { name: 'Sensor Lectura', value: 50, unit: 'ms' },
    { name: 'Sensor Visión', value: 150, unit: 'ms' },
    { name: 'Estación Inspección', value: 250, unit: 'ms' },
  ];

  const r2 = await s.from('motion_profiles').upsert(profiles, { onConflict: 'name' });
  console.log('SEED:', r2.status, r2.error?.message || 'OK');

  // 3. Verify
  const { data } = await s.from('motion_profiles').select('name, value, unit').order('name');
  console.log('\nResult:', JSON.stringify(data, null, 2));
}

run();
