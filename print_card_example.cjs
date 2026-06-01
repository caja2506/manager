const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'projects', 'TimingStudyManager.jsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let cardStartIndex = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('card-objDia') && lines[i].includes('onClick')) {
        cardStartIndex = i;
        break;
    }
}

if (cardStartIndex !== -1) {
    console.log(`Líneas de card-objDia (de la ${cardStartIndex + 1} a la ${cardStartIndex + 40}):`);
    for (let j = cardStartIndex; j < cardStartIndex + 40; j++) {
        console.log(`${j + 1}: ${lines[j]}`);
    }
} else {
    console.log('No se encontró card-objDia');
}
