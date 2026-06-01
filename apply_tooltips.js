const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/projects/TimingStudyManager.jsx');
const jsonPath = path.join(__dirname, 'search_replace.json');

let content = fs.readFileSync(filePath, 'utf8');
const tasks = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Normalizar a saltos de línea \n
let normalizedContent = content.replace(/\r\n/g, '\n');

let allSuccess = true;

for (const task of tasks) {
    const searchVal = task.search.replace(/\r\n/g, '\n').trim();
    const replaceVal = task.replace.replace(/\r\n/g, '\n').trim();
    
    const index = normalizedContent.indexOf(searchVal);
    if (index === -1) {
        console.error(`ERROR: No se encontró la coincidencia exacta para "${task.label}"`);
        allSuccess = false;
    } else {
        normalizedContent = normalizedContent.replace(searchVal, replaceVal);
        console.log(`Éxito al reemplazar: "${task.label}"`);
    }
}

if (allSuccess) {
    // Preservar \r\n nativo de Windows para el archivo final
    const finalContent = normalizedContent.replace(/\n/g, '\r\n');
    fs.writeFileSync(filePath, finalContent, 'utf8');
    console.log('REEMPLAZO FINALIZADO EXITOSAMENTE!');
    process.exit(0);
} else {
    console.error('ERROR: Algunas sustituciones no pudieron ser aplicadas.');
    process.exit(1);
}
