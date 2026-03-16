const git = require('isomorphic-git');
const fs = require('fs');
const http = require('isomorphic-git/http/node');

const dir = 'C:/Users/CJ00083620/.gemini/antigravity/scratch/autobom-pro';
const message = 'feat: unified routine scheduler, schedule editor UI, expanded report recipients';

async function run() {
    console.log('=== Staging files ===');
    const status = await git.statusMatrix({ fs, dir });
    let staged = 0;
    for (const [filepath, head, workdir, stage] of status) {
        if (filepath.startsWith('node_modules/') || filepath.startsWith('dist/') || filepath.startsWith('.git/')) continue;

        if (workdir !== stage || head !== workdir) {
            if (workdir === 0) {
                await git.remove({ fs, dir, filepath });
                staged++;
            } else {
                await git.add({ fs, dir, filepath });
                staged++;
            }
        }
    }
    console.log(`Staged ${staged} files`);

    if (staged === 0) {
        console.log('Nothing to commit');
        return;
    }

    console.log('=== Committing ===');
    const sha = await git.commit({
        fs, dir,
        message,
        author: { name: 'caja2506', email: 'caja2506@gmail.com' },
    });
    console.log('Commit SHA:', sha);

    console.log('=== Pushing to origin/main ===');
    const result = await git.push({
        fs, http, dir,
        remote: 'origin',
        ref: 'main',
    });

    if (result.ok) {
        console.log('✅ Push exitoso!');
    } else {
        console.log('Push result:', JSON.stringify(result, null, 2));
    }
}

run().catch(err => {
    console.error('Error:', err.message);
    if (err.code === 'HttpError') {
        console.log('\n⚠️ Se requiere autenticación. Necesitas un token de GitHub.');
    }
});
