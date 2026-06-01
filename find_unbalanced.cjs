const fs = require('fs');
const file = 'C:/Users/CJ00083620/.gemini/antigravity/scratch/autobom-pro/src/components/projects/TimingStudyManager.jsx';
let content = fs.readFileSync(file, 'utf8');

// Eliminar comentarios de una línea y de varias líneas para evitar falsos positivos
content = content.replace(/\/\*[\s\S]*?\*\//g, '');
content = content.replace(/\/\/.*/g, '');

const lines = content.split(/\r?\n/);
const stack = [];
const tagRegex = /<\/?[a-zA-Z0-9_\-]+(?:\s+[a-zA-Z0-9_\-]+(?:=(?:"[^"]*"|'[^']*'|{[\s\S]*?}))*)*\s*\/?>/g;

// Intentamos hacer un escaneo simple de JSX tags
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    // Buscamos etiquetas en la línea
    const localRegex = /<(\/?[a-zA-Z0-9_\-]+)(?:\s|>|\/>)/g;
    while ((match = localRegex.exec(line)) !== null) {
        const tag = match[1];
        
        // Evitamos expresiones que parezcan tags pero no lo sean (ej. operadores de comparación)
        if (tag.startsWith('/') ) {
            const closingName = tag.substring(1);
            if (stack.length > 0) {
                const last = stack.pop();
                if (last.name !== closingName) {
                    console.log(`Línea ${i + 1}: Error de etiqueta no coincidente. Cierra </${closingName}> pero se esperaba </${last.name}>. Abierta en línea ${last.line}`);
                    stack.push(last); // restaurar
                }
            } else {
                console.log(`Línea ${i + 1}: Etiqueta de cierre </${closingName}> sin etiqueta de apertura.`);
            }
        } else {
            // Verificamos si es auto-cerrada en la misma línea
            const fullMatch = line.substring(match.index);
            const isSelfClosing = /\/>/.test(fullMatch.split('>')[0]);
            if (!isSelfClosing) {
                stack.push({ name: tag, line: i + 1 });
            }
        }
    }
}

if (stack.length > 0) {
    console.log('Etiquetas de apertura sin cerrar al final del archivo:');
    stack.forEach(t => console.log(`  <${t.name}> abierta en línea ${t.line}`));
} else {
    console.log('Todas las etiquetas HTML/JSX parecen estar balanceadas.');
}
