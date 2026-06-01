const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'projects', 'TimingStudyManager.jsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let currentCardId = null;
let insideTooltip = false;
let tooltipStartLine = 0;
let tooltipContent = [];
const outputLines = [];

lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    if (line.includes('card-objDia') || line.includes('card-objHora') || line.includes('card-ppmObj') || line.includes('card-cicloTarget') || line.includes('card-cicloReal') || line.includes('card-ppmReal') || line.includes('card-bottleneck') || line.includes('card-realHora') || line.includes('card-status') || line.includes('card-piezasDia') || line.includes('card-piezasSem') || line.includes('card-piezasAno')) {
        const match = line.match(/card-\w+/);
        if (match) {
            currentCardId = match[0];
        }
    }
    
    if (line.includes('Tooltip') && line.includes('absolute')) {
        insideTooltip = true;
        tooltipStartLine = lineNum;
        tooltipContent = [line];
    } else if (insideTooltip) {
        tooltipContent.push(line);
        if (line.includes('</div>') && line.trim() === '</div>' && tooltipContent.filter(l => l.includes('<div')).length === tooltipContent.filter(l => l.includes('</div>')).length) {
            outputLines.push(`Card ID: ${currentCardId}`);
            outputLines.push(`Líneas: ${tooltipStartLine} - ${lineNum}`);
            const formulaLines = tooltipContent.filter(l => l.includes('text-') || l.includes('Fórmula') || l.includes('Cálculo'));
            formulaLines.forEach(fl => outputLines.push(`   ${fl.trim()}`));
            outputLines.push('');
            insideTooltip = false;
        }
    }
});

fs.writeFileSync(path.join(__dirname, 'tooltips_info.txt'), outputLines.join('\n'), 'utf8');
console.log('Resultados escritos en tooltips_info.txt');
