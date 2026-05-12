import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envLocal.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envLocal.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Connecting to realtime...');

const channel = supabase.channel('engineering-data-test');

const tables = [
    'projects', 'tasks', 'subtasks', 'task_types', 'users', 'time_logs', 'delay_causes', 'delays'
];

for (const table of tables) {
    channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
            console.log(`[${table}] Event received:`, payload);
        }
    );
}

channel.subscribe((status) => {
    console.log('Subscribe status:', status);
    if (status === 'SUBSCRIBED') {
        console.log('Attempting an INSERT on tasks to test realtime...');
        // Insert a dummy task
        supabase.from('tasks').insert({
            title: 'Realtime Test Task',
            description: 'Testing realtime'
        }).select().then(({ data, error }) => {
            if (error) console.error('Insert error:', error);
            else {
                console.log('Insert success. Waiting for event...');
                // Then delete it
                setTimeout(() => {
                    supabase.from('tasks').delete().eq('id', data[0].id).then(() => {
                        console.log('Deleted dummy task.');
                        setTimeout(() => process.exit(0), 2000);
                    });
                }, 2000);
            }
        });
    }
});
