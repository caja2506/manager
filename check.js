const esbuild = require('esbuild');

esbuild.build({
    entryPoints: ['C:/Users/CJ00083620/.gemini/antigravity/scratch/autobom-pro/src/components/projects/TimingStudyManager.jsx'],
    bundle: false,
    write: false,
    logLevel: 'verbose'
}).then(() => {
    console.log('Compilación exitosa');
}).catch((err) => {
    console.error('Error de compilación:', err);
});
