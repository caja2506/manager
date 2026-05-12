const fs = require('fs');
const path = require('path');
const pagesDir = 'c:/Users/CJ00083620/.gemini/antigravity/scratch/autobom-pro/src/pages';
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));
for (const file of files) {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  // Match <PageHeader title="" showBack={true} ... />
  const newContent = content.replace(/<PageHeader\s+title=""\s+showBack=\{true\}[^>]*\/>/g, '');
  if (content !== newContent) {
    if (!newContent.includes('<PageHeader')) {
       const lines = newContent.split('\n');
       const filteredLines = lines.filter(l => !l.includes('import PageHeader from'));
       fs.writeFileSync(filePath, filteredLines.join('\n'));
    } else {
       fs.writeFileSync(filePath, newContent);
    }
    console.log(`Updated ${file}`);
  }
}
