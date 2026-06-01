const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'projects', 'TimingStudyManager.jsx');
const content = fs.readFileSync(filePath, 'utf8');

const regex = /<p\s+className=["']([^"']*text-cyan[^"']*)["']/g;
let match;
console.log('--- Buscando etiquetas p con clases text-cyan ---');
while ((match = regex.exec(content)) !== null) {
    console.log('Match encontrado:', match[0]);
}

const regex2 = /<p\s+className=["']([^"']*text-emerald[^"']*)["']/g;
while ((match = regex2.exec(content)) !== null) {
    console.log('Match encontrado (emerald):', match[0]);
}
