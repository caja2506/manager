const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://mkymgptfmtlqpdswvywo.supabase.co',
    'sb_publishable_R4wQAwCSSp1BwuplVroLow_9XwFu_RD'
);

supabase.from('users').select('count').limit(1)
    .then(r => {
        if (r.error) {
            console.log('Conexion OK - tabla no existe aun (normal):', r.error.message);
        } else {
            console.log('Conexion OK, respuesta:', JSON.stringify(r.data));
        }
    })
    .catch(e => console.error('Error de red:', e.message));
