const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'projects', 'TimingStudyManager.jsx');
const content = fs.readFileSync(filePath, 'utf8');

const regex = /<p\s+className=["'][^"']*bg-slate-900\/80[^"']*["']>([\s\S]*?)<\/p>/g;
let match;
let count = 0;

console.log('--- Bloques de Fórmulas y Cálculos en TimingStudyManager.jsx ---');
while ((match = regex.exec(content)) !== null) {
    count++;
    // Encontrar en qué línea aproximada ocurre
    const index = match.index;
    const lineNum = content.slice(0, index).split('\n').length;
    console.log(`\nBloque #${count} (Alrededor de línea ${lineNum}):`);
    console.log('Tag HTML:', content.slice(index, index + match[0].indexOf('>') + 1));
    console.log('Contenido:', match[1].trim().replace(/\s+/g, ' '));
}
