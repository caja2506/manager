import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    const form = { date: '2026-05-14', startHour: '08:30', endHour: '14:13' };

    const [y, m, d] = form.date.split('-').map(Number);
    const [sh, sm] = form.startHour.split(':').map(Number);
    const [eh, em] = form.endHour.split(':').map(Number);

    const startDate = new Date(y, m - 1, d, sh, sm, 0);
    const endDate = new Date(y, m - 1, d, eh, em, 0);

    const startTime = startDate.toISOString();
    const endTime = endDate.toISOString();

    console.log("Generated ISO startTime:", startTime); // Expecting 14:30:00.000Z

    // INSERT a dummy record
    const { data: insertData, error: insertError } = await supabase.from('time_logs').insert({
        user_id: 'dummy_test_user',
        start_time: startTime,
        end_time: endTime,
        total_hours: 5,
        notes: 'TEST_TZ_FIX'
    }).select('id');

    if (insertError) {
        console.error("Insert error:", insertError);
        return;
    }
    const newId = insertData[0].id;
    console.log("Inserted dummy log ID:", newId);

    // Fetch it back
    const { data } = await supabase.from('time_logs').select('start_time, end_time').eq('id', newId).single();
    
    console.log("Fetched from Supabase:", data);

    const fetchedStart = new Date(data.start_time);
    console.log("Parsed locally as:", fetchedStart.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }));

    // Cleanup
    await supabase.from('time_logs').delete().eq('id', newId);
}
test();
