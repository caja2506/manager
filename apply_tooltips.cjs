const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/projects/TimingStudyManager.jsx');
const txtPath = path.join(__dirname, 'search_replace.txt');

let content = fs.readFileSync(filePath, 'utf8');
const textRaw = fs.readFileSync(txtPath, 'utf8');

// Normalizar saltos de línea a \n y caracteres unicode rotos
let normalizedContent = content.replace(/\r\n/g, '\n').replace(/ΓÇö/g, '—');
const parts = textRaw.replace(/\r\n/g, '\n').split('====== DELIMITER ======\n');

if (parts.length < 12) {
    console.error(`ERROR: Se esperaban al menos 12 fragmentos en search_replace.txt, pero se encontraron ${parts.length}`);
    process.exit(1);
}

const labels = [
    'Bottleneck',
    'Real / Hora',
    'Status',
    'Piezas / Día',
    'Piezas / Semana',
    'Piezas / Año'
];

let allSuccess = true;

// Reemplazar todos usando coincidencia exacta
for (let i = 0; i < 6; i++) {
    const label = labels[i];
    const searchVal = parts[i * 2].trim();
    const replaceVal = parts[i * 2 + 1].trim();
    
    const index = normalizedContent.indexOf(searchVal);
    if (index === -1) {
        console.error(`ERROR: No se encontró la coincidencia exacta para "${label}"`);
        // Imprimir los primeros 100 caracteres de searchVal para ayudar a depurar
        console.error(`Buscando (truncado): ${searchVal.slice(0, 100)}...`);
        allSuccess = false;
    } else {
        normalizedContent = normalizedContent.replace(searchVal, replaceVal);
        console.log(`Éxito al reemplazar: "${label}"`);
    }
}

if (allSuccess) {
    // Volver a guardar con el \r\n estándar de Windows
    const finalContent = normalizedContent.replace(/\n/g, '\r\n');
    fs.writeFileSync(filePath, finalContent, 'utf8');
    console.log('REEMPLAZO FINALIZADO CON ÉXITO!');
    process.exit(0);
} else {
    console.error('ERROR: No se pudieron aplicar todas las sustituciones.');
    process.exit(1);
}
