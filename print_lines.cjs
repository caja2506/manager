const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'projects', 'TimingStudyManager.jsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

for (let i = 2820; i <= 2865; i++) {
    console.log(`${i}: ${lines[i - 1]}`);
}
