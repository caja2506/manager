const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'projects', 'TimingStudyManager.jsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const ids = [
    'card-objDia',
    'card-objHora',
    'card-ppmObj',
    'card-cicloTarget',
    'card-cicloReal',
    'card-ppmReal',
    'card-bottleneck',
    'card-realHora',
    'card-status',
    'card-piezasDia',
    'card-piezasSem',
    'card-piezasAno'
];

ids.forEach(id => {
    let cardIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(id) && lines[i].includes('onClick')) {
            cardIdx = i;
            break;
        }
    }

    if (cardIdx !== -1) {
        // Buscar en las siguientes 15 líneas la etiqueta que tiene font-black o el valor principal
        for (let j = cardIdx + 1; j < cardIdx + 15; j++) {
            const line = lines[j];
            if (line.includes('text-lg') || line.includes('text-xl') || line.includes('text-2xl') || line.includes('font-black') || line.includes('text-emerald') || line.includes('text-cyan') || line.includes('text-blue')) {
                console.log(`${id} ➜ Línea ${j + 1}: ${line.trim()}`);
                break;
            }
        }
    }
});
