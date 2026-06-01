const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'projects', 'TimingStudyManager.jsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const cardKeywords = [
    { id: 'card-objDia', name: 'Objetivo / Día' },
    { id: 'card-objHora', name: 'Objetivo / Hora' },
    { id: 'card-ppmObj', name: 'CPM Obj / PPM Obj' },
    { id: 'card-cicloTarget', name: 'Ciclo Target' },
    { id: 'card-cicloReal', name: 'Ciclo Real' },
    { id: 'card-ppmReal', name: 'CPM Real / PPM Real' },
    { id: 'card-bottleneck', name: 'Bottleneck' },
    { id: 'card-realHora', name: 'Real / Hora (PPH Real)' },
    { id: 'card-status', name: 'Status' },
    { id: 'card-piezasDia', name: 'Piezas / Día Real' },
    { id: 'card-piezasSem', name: 'Piezas / Semana Real' },
    { id: 'card-piezasAno', name: 'Piezas / Año Real' }
];

console.log('--- Buscando clases de color de los valores principales de las tarjetas ---');

cardKeywords.forEach(card => {
    // Buscar la div de la tarjeta y luego el texto del valor que suele estar en las siguientes 10-20 líneas
    let foundIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(card.id) && lines[i].includes('card-')) {
            foundIndex = i;
            break;
        }
    }

    if (foundIndex !== -1) {
        console.log(`\nTarjeta: ${card.name} (${card.id}) - Alrededor de línea ${foundIndex + 1}:`);
        // Imprimir las siguientes 35 líneas buscando etiquetas de valor con clases de color
        for (let j = foundIndex; j < foundIndex + 35; j++) {
            const line = lines[j];
            if (line.includes('text-lg') || line.includes('text-xl') || line.includes('text-2xl') || line.includes('text-3xl') || line.includes('font-black') || line.includes('text-emerald') || line.includes('text-cyan') || line.includes('text-blue') || line.includes('text-violet') || line.includes('text-amber') || line.includes('text-purple')) {
                console.log(`  Línea ${j + 1}: ${line.trim()}`);
            }
        }
    } else {
        console.log(`No se encontró la tarjeta ${card.id}`);
    }
});
