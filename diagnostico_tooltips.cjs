const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'projects', 'TimingStudyManager.jsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log('Total de líneas:', lines.length);

const matches = [];
lines.forEach((line, index) => {
    if (line.includes('CPM_real') || line.includes('FÓRMULA:') || line.includes('text-cyan-') || line.includes('text-cyan') || line.includes('text-emerald')) {
        matches.push({ lineNum: index + 1, content: line.trim() });
    }
});

console.log('Coincidencias encontradas:', matches.length);
matches.slice(0, 100).forEach(m => {
    console.log(`Línea ${m.lineNum}: ${m.content}`);
});
