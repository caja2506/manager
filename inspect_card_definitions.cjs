const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'projects', 'TimingStudyManager.jsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- Buscando ocurrencias de card IDs ---');
const ids = ['card-objDia', 'card-objHora', 'card-ppmObj', 'card-cicloTarget', 'card-cicloReal', 'card-ppmReal', 'card-bottleneck', 'card-realHora', 'card-status', 'card-piezasDia', 'card-piezasSem', 'card-piezasAno'];

ids.forEach(id => {
    console.log(`\nOcurrencias de ${id}:`);
    lines.forEach((line, index) => {
        if (line.includes(id)) {
            console.log(`  Línea ${index + 1}: ${line.trim()}`);
        }
    });
});
