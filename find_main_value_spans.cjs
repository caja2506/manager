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

console.log('--- Buscando clases de color de los valores en las tarjetas ---');

ids.forEach(id => {
    let cardStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(id) && lines[i].includes('onClick')) {
            cardStartIndex = i;
            break;
        }
    }

    if (cardStartIndex !== -1) {
        // Encontrar el primer tag de texto grande despues de cardStartIndex (excluyendo el tooltip)
        let foundColor = 'No encontrado';
        for (let j = cardStartIndex + 1; j < cardStartIndex + 30; j++) {
            const line = lines[j];
            if (line.includes('Tooltip') || line.includes('absolute top-full')) {
                // Llegamos al tooltip, detener búsqueda del valor principal
                break;
            }
            if (line.includes('className=') && (line.includes('text-lg') || line.includes('text-xl') || line.includes('text-2xl') || line.includes('text-3xl') || line.includes('text-base'))) {
                const classMatch = line.match(/className=["']([^"']+)["']/);
                if (classMatch) {
                    foundColor = classMatch[1];
                    console.log(`Card: ${id} ➜ Línea ${j + 1}: ${line.trim()}`);
                    break;
                }
            }
        }
    } else {
        console.log(`Card no encontrada: ${id}`);
    }
});
